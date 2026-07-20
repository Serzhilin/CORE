# AvailabilityReader — Design

**Goal:** Second read-back path in CORE's W3DS-native migration (staged per `docs/superpowers/specs/2026-07-20-core-w3ds-native-analysis.md`), following `OrganizationReader` (`docs/superpowers/specs/2026-07-20-organization-reader-design.md`, shipped on main, commits `e157d13..7a59898`). Today `Availability` is write-only — `AvailabilityEnvelopeService.ts` pushes a full snapshot to eVault on every status change, nothing reads it back. Postgres `AvailabilityType` (community-scoped status list) and `CommunityMembership.availability_type_id/availability_reason/availability_from/availability_until` (per-member current status) remain the sole source of truth. This plan wires the same three-trigger cache-update strategy used for `Organization`, scoped to the `Availability` ontology.

## Architecture: three triggers, one reconcile function

New `api/src/services/AvailabilityReconciler.ts`, single entry point `reconcileAvailabilityFromEvault(communityId, payload)`. Three independent triggers, same pattern as `OrganizationReconciler.ts`:

1. **Packet handler (event-driven).** `registerPacketHandler(ONTOLOGIES.Availability, ...)` added to `registerOntologyHandlers.ts`, alongside the existing `User`/`Organization` handlers. Looks up `Community` by `ename === w3id`; if found, casts the packet's `data` to `AvailabilityEnvelopePayload` and calls the reconcile function. No-ops with a warn log if no matching community is found locally.

2. **Request-triggered (debounced).** New `triggerAvailabilityReconcile(communityId)` in a new `AvailabilityReconcileTrigger.ts` — its own file, its own in-memory `Map<communityId, lastReconciledAtMs>`, its own 60-second debounce window, kept **separate** from `OrganizationReconcileTrigger.ts`'s debounce map (explicit decision: the two ontologies churn independently and the write path already keeps them as separate envelopes/services, so the read side keeps that separation too, rather than coupling both behind one debounce timestamp). Called from `getCommunityHandler` (`CommunityController.ts`) alongside — not instead of — the existing `triggerOrganizationReconcile` call. Fire-and-forget (`.catch(logger.warn)`), not awaited.

3. **Periodic sweep (safety net).** `registerReconciler("availability", 60 * 60_000, availabilityReconciliationSweep)` added to the existing `registerReconcilers()` hub (`registerReconcilers.ts`), same hourly cadence as Organization's sweep, same `provisioning_status === "linked" && ename` community filter. The sweep's job is bounding worst-case drift from a dropped AaaS/webhook packet (fire-and-forget, no delivery guarantee — see the W3DS skill's protocol notes) for communities nobody is actively viewing; it is not the freshness mechanism (that's trigger 2), so its cadence doesn't need to track how often Availability data actually churns.

## Reconciliation semantics (inside `reconcileAvailabilityFromEvault`)

**Statuses** (`AvailabilityType`, keyed by `id`) — same pattern as Organization's membership-types reconcile:
- Envelope `id` matches a local row → update `name`/`emoji` if changed.
- Envelope `id` has no matching local row → **create it, preserving the exact `id` from the envelope.** Not optional: `CommunityMembership.availability_type_id` foreign-keys into this id; a fresh id on resurrection would orphan any membership row still pointing at the old one. Resurrected rows get `sort_order` appended at the end and `is_archived: false` (the envelope doesn't carry either — archived types are already filtered out of the payload at write time, so their absence from the envelope is never evidence to archive/delete a *live* local type).
- Local row's `id` absent from the envelope's list → delete it.

**Entries** (per-member current status, on `CommunityMembership`) — no `CommunityMembership` rows are ever created or deleted by this reconciler (roster membership itself is `OrganizationReconciler`'s job, not this one's). Only four fields are ever touched: `availability_type_id`, `availability_reason`, `availability_from`, `availability_until`. Matched by `Person.ename` against `entries[].eName`:
- Local membership's person matches an envelope entry → update the four fields to the entry's values if changed.
- Local membership's person has no matching entry → batch-fetch that person's row (single `In(...)` query across all unmatched memberships, avoiding N+1) and check eligibility exactly as `AvailabilityEnvelopeService.ts` does at write time (`person.ename` present **and** `person.meta_envelope_id` present — same gate `OrganizationReconciler.ts`'s roster-deletion fix already uses):
  - **Eligible** (could have appeared in the envelope) and unmatched → the true state has no status now → clear the four fields to `null`.
  - **Ineligible** (no `ename` or unresolved `meta_envelope_id` — could never have appeared in the envelope regardless of their actual status) → skip entirely, leave untouched. This is the exact bug class `OrganizationReconciler`'s final review caught, applied here to field-clearing instead of row-deletion: envelope-absence is not evidence of anything for a person the write path structurally excludes.

## Error handling

- All three trigger call sites wrap the call in `.catch(err => logger.warn(err, ...))` — never throws past its caller.
- No envelope found for a linked community → no-op (expected transiently right after linking, before the first sync).
- Every create/update/delete/clear is independently try/caught and logged — one failing row doesn't abort reconciliation of the rest.
- Structural drift (a status type resurrected/deleted, or an entry's fields cleared) logs a warning even though it's auto-corrected — loud, never silent, per the project's standing cache-correction rule.

## Non-goals

- No changes to the write path — `AvailabilityEnvelopeService.ts` / `availabilityPayload.ts` untouched.
- No changes to `AvailabilityLog` — separate ontology, already has its own Reader from the prior (`availabilitylog-ontology`) plan.
- No admin "force reconcile now" endpoint — the three existing triggers cover it.
- `Workgroup`, `Membership` ontologies stay out of scope for this plan — each gets its own Reader plan later, per the analysis spec's staged approach.

## Testing

Same convention as `OrganizationReader`: no test file in this repo touches `AppDataSource`/a real database, and this plan doesn't introduce a first exception. Verified via typecheck plus a manual smoke-test sequence specified in the implementation plan:

1. Delete an `AvailabilityType` locally without letting the deletion sync to eVault, trigger reconciliation, confirm it's resurrected with its original id.
2. Set a (envelope-eligible) member's status locally without syncing, trigger reconciliation, confirm it's cleared to match the envelope's absence of that entry.
3. Repeat with an eName-less/unresolved member who has a local status set, trigger reconciliation, confirm the status is left untouched (envelope-ineligible case — mirrors the Organization fix's control case).

`registerOntologyHandlers.test.ts` gets a new case: registering `ONTOLOGIES.Availability` routes to a mocked `reconcileAvailabilityFromEvault`, mirroring the existing `User`/`Organization` tests. `AvailabilityReconcileTrigger.ts` duplicates the same 4-line `shouldReconcile(lastReconciledAtMs, nowMs, debounceMs)` pure-function pattern `OrganizationReconcileTrigger.ts` already uses (not imported cross-file — each trigger file owns its own debounce logic and its own `Map`, matching the "separate debounce" decision above), and gets its own dedicated unit test mirroring the existing one.
