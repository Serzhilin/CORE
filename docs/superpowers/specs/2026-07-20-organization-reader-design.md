# OrganizationReader — Design

**Goal:** First read-back path in CORE's own codebase for the W3DS-native migration staged in `docs/superpowers/specs/2026-07-20-core-w3ds-native-analysis.md`. Today `Organization` is write-only — `OrganizationService.ts` pushes to eVault on every change, nothing reads it back, and Postgres `Community` (plus `OrganizationMembershipType` and `CommunityMembership` roster/admin fields) remains the sole source of truth. This plan wires the AaaS-driven + reconciliation-sweep cache-update strategy the analysis settled on, scoped to the `Organization` ontology, for all three kinds of data the envelope carries: scalar community fields, membership types, and roster/admin flags.

## Architecture: three triggers, one reconcile function

A single function, `reconcileOrganizationFromEvault(communityId, payload)` in a new `api/src/services/OrganizationReconciler.ts`, is the only place reconciliation logic lives. Three independent triggers feed it:

1. **Packet handler (event-driven).** `registerPacketHandler(ONTOLOGIES.Organization, ...)` added to `registerOntologyHandlers.ts`. Looks up `Community` by `ename === w3id`; if found, casts the packet's `data` to the envelope's payload shape (webhook/AaaS packets carry the full envelope, not a diff — same convention as the existing `User` handler) and calls the reconcile function. No-ops with a warn log if no matching community is found locally.

2. **Request-triggered (new, debounced).** `getCommunityHandler` (`GET /communities/:id` in `CommunityController.ts`) calls `triggerOrganizationReconcile(communityId)` before responding. An in-memory `Map<communityId, lastReconciledAtMs>` skips the call if this community was reconciled within the last 60 seconds; otherwise it fires `findEnvelopesByOntology(community.ename, ONTOLOGIES.Organization, 1)` → `reconcileOrganizationFromEvault(...)`, fire-and-forget (`.catch(logger.warn)`). Not awaited — the handler serves the current Postgres row immediately; any drift found lands in time for the *next* request to this community, not this one. The debounce map is process-local and resets on restart (acceptable: worst case is one extra reconcile after a deploy).

3. **Periodic sweep (safety net).** `registerReconciler("organization", 60 * 60_000, sweepFn)` — hourly. `sweepFn` iterates every `Community` with `provisioning_status === "linked" && ename`, reads its current `Organization` envelope, and feeds it through the same reconcile function. Its job is narrower than in the original analysis sketch: catch drift for communities nobody is actively viewing, not be the primary freshness mechanism — that's now the request-triggered path's job. Hourly (not the previously-considered 15 minutes) reflects that narrower scope.

Why three triggers and not one: the packet handler is near-real-time but depends on Awareness/AaaS delivery, which has no delivery guarantee. The request-triggered path guarantees freshness exactly when a human is about to look at the data, with zero wasted work on communities nobody's viewing. The hourly sweep is the last-resort net for communities that are simply idle. (See "Meshenger audit" note below for why this differs from a pure-timer or pure-log-cursor design.)

## Reconciliation semantics (inside `reconcileOrganizationFromEvault`)

**Scalars** — `name`, `legalInfo.*`, `branding.*` map directly onto `Community` columns; any changed field is written via `communityRepo().update(communityId, {...})`. `chatId` in the envelope is explicitly **ignored** by this sync — it's informational passthrough, owned by `ChatService`'s own write path, not this reconciler's concern.

**Membership types** (`OrganizationMembershipType`, keyed by `id`) — the envelope's `membershipTypes[]` carries CORE's own locally-generated UUIDs (they were written from local rows in the first place). Reconciliation:
- Existing local row with matching `id` → update changed fields (`name`, `description`, `emoji`).
- `id` present in the envelope but no matching local row → **create it, preserving the exact `id` from the envelope.** This is not optional: `CommunityMembership.membership_type_id` foreign-keys into this id. Assigning a fresh id on resurrection would silently orphan any membership row still pointing at the old one. New/resurrected rows get `sort_order` appended at the end (the envelope doesn't carry sort order).
- Local row whose `id` is absent from the envelope's list → delete it.

**Roster + admin flags** (`CommunityMembership`, matched via `Person.ename` from `members[].eName`) —
- Existing membership matched by `(community_id, person_id)` → update `membership_type_id`, `joined_at`, and `is_admin` (derived: `true` iff the person's `meta_envelope_id` appears in the envelope's `admins[]`).
- Envelope has a member with no matching local row → create one (new `CommunityMembership.id` — the envelope doesn't carry membership ids, only `participantId`/`eName`, so there's no id to preserve here).
- Local membership row whose person is absent from the envelope's roster → **delete it.** Accepted, explicit risk: this is more consequential than the membership-type case (it revokes a real person's community access, not just a label), and the trigger is a read of a payload snapshot that could be stale for reasons other than an intentional removal. Treated identically to membership-type deletion per explicit decision, not because the risk is equivalent — it is written down here so it's visible to whoever revisits this later, not silently assumed safe.

Every create/update/delete inside this function is independently try/caught and logged — one failing row does not abort reconciliation of the rest.

## Error handling

- All three trigger call sites wrap the call in `.catch(err => logger.warn(err, ...))` — never throws past its caller, matches the write-side convention throughout this codebase.
- No envelope found for a linked community → no-op (expected transiently right after linking, before `syncOrganizationToEvault`'s first write lands).
- Structural drift (a membership-type or roster row created or deleted, not just a field update) logs a warning even though it's auto-corrected — visible in logs, per the project's standing rule that cache-correction must be loud, never silent.

## Non-goals

- No changes to the write path — `OrganizationService.ts` / `organizationPayload.ts` untouched.
- No admin "force reconcile now" endpoint — the three existing triggers cover it; YAGNI.
- No historical audit trail of what a reconcile changed beyond the warning-level log line.
- `AvailabilityLog`, `Availability`, `Workgroup`, `Membership` ontologies are out of scope — this plan covers `Organization` only. Each remaining write-only ontology gets its own Reader plan later, per the analysis spec's staged-migration approach.

## Testing

Checked: no test file in this repo touches `AppDataSource`/a real database — every existing test either covers a pure function or mocks the DB-touching dependency away entirely. This plan follows that established convention rather than introducing a first exception, even though this reconciler's logic is more complex than prior envelope-service precedents (`MembershipEnvelopeService`, `AvailabilityLogEnvelopeService`) — that tradeoff is named explicitly below, not silently assumed away.

- `registerOntologyHandlers.test.ts` gets a new case: registering `ONTOLOGIES.Organization` routes to a mocked `reconcileOrganizationFromEvault`, mirroring the existing `User`-ontology test.
- The debounce check (`shouldReconcile(communityId, nowMs)` — "skip if reconciled within the last 60s") is extracted as a small pure function with an injectable clock, and gets a dedicated unit test.
- `OrganizationReconciler.ts`'s core DB logic (create/update/delete across `Community`/`OrganizationMembershipType`/`CommunityMembership`) gets **no dedicated automated test file** — verified via typecheck plus a manual smoke-test sequence specified in the implementation plan: create an org, delete a membership type locally without letting the deletion sync to eVault, trigger reconciliation, confirm the type is resurrected with its original id; separately, remove a roster membership locally without syncing, trigger reconciliation, confirm it gets deleted to match the envelope.

## Meshenger audit note (context for the three-trigger design)

`~/Projects/Meshenger` (also W3DS-native) uses a different pattern: a log-driven reconciler that polls each eVault's `/logs` endpoint with a persisted per-`(vault, actor)` cursor, triggered only by request-scoped events (SSE-stream-open, chat-page-open) — explicitly never on a timer, since their iron rules forbid TTL-based refresh and their Next.js deployment has no long-running process to host one anyway. CORE is a persistent Express server, so a `setInterval` sweep is viable here in a way it isn't for Meshenger; and CORE's reconciler reads one full current snapshot per community (not an incremental log delta), so there's no cursor/rescan-cost problem to solve. The request-triggered path adopted above borrows Meshenger's core insight (reconcile when a human's about to look at the data, not on a blind timer) without adopting machinery (log cursors, no-timer-ever) that solves problems specific to their architecture, not CORE's.
