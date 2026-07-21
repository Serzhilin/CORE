# WorkgroupReader — Design

**Goal:** Fourth and last read-back path in CORE's W3DS-native migration (staged per `docs/superpowers/specs/2026-07-20-core-w3ds-native-analysis.md`), following `OrganizationReader`, `AvailabilityReader`, `MembershipReader` (all shipped locally on main). Today `Workgroup` is write-only — `WorkgroupService.ts`'s `syncWorkgroupToEvault` pushes create/update to **the community's own vault** on every workgroup/role/member mutation, but nothing ever reads it back (`grep findEnvelopesByOntology WorkgroupService.ts` → zero hits). This plan makes CORE a consumer too: another platform's workgroup edit becomes visible in CORE, and CORE's own writes that silently failed to reach eVault get repaired automatically.

Governed by the two axioms in `~/Projects/.claude/skills/w3ds/reference/philosophy.md`: eVault is authoritative (local `Workgroup`/`Role`/`WorkgroupMembership`/`WorkgroupMemberRole` rows are a cache), and other platforms both read and write this ontology (so both a forward ingest path and a reverse self-heal path are required — this is not a forward-only Reader like Organization/Availability).

## Architecture: three-trigger, community-keyed, full-list reconciliation

New `api/src/services/WorkgroupReconciler.ts`.

**Why the three-trigger pattern (packet handler + hourly sweep + request-trigger), not Membership's single-trigger?** Workgroup's payload shape — one envelope per workgroup, `members[]`/`roles[]` embedded, written to the community's own vault — matches Organization's shape, not Membership's (one minimal envelope per person-community pair, in the person's own vault). Workgroup data has the same "someone else benefits from background freshness" audience Organization has: any community member viewing workgroups benefits from a sweep that ran because a different member's edit landed, or because another platform wrote a change. That justifies all three triggers, same as Organization/Availability.

**Structural difference from Organization:** Organization has exactly one envelope per community. Workgroup has one envelope **per workgroup**, many workgroups per community. That forces two entry points instead of Organization's one:

- `reconcileWorkgroupFromEvault(communityId, metaEnvelopeId, payload)` — reconciles a single workgroup's scalars, roles, and members (create-or-update only, including bootstrapping a workgroup CORE never created locally). Shared by the packet handler and the per-entry loop inside the function below.
- `reconcileWorkgroupsForCommunity(communityId)` — the sweep/trigger entry point. Fetches the **full current list** via `findEnvelopesByOntology(community.ename, ONTOLOGIES.Workgroup, N)`, calls `reconcileWorkgroupFromEvault` for each entry, then:
  - hard-deletes any local `Workgroup` row whose `envelope_id` is absent from that list (see "Deletion" below), and
  - **reverse self-heal**: for any local `Workgroup` row with `envelope_id: null`, or whose `envelope_id` doesn't appear in the fetched list at all (distinct from "explicitly absent" — see below), calls the existing `syncWorkgroupToEvault(workgroupId)` to push it, repairing a write that never landed. This is the reverse direction Axiom 2 requires: `syncWorkgroupToEvault` is fire-and-forget (`.catch(logger.warn)`) at every call site except `deleteWorkgroup`, so a transient failure otherwise leaves a local workgroup permanently invisible to every other platform, with nothing to notice or repair it.

**Distinguishing "never synced" from "deleted by another platform"** (needed since both look like "local row, no matching envelope"): a local `Workgroup` row with `envelope_id: null` has never completed a sync — always a self-heal candidate, never a deletion candidate. A local row **with** a non-null `envelope_id` that's absent from the fetched list was synced once and is now gone from eVault — always a deletion candidate, never self-heal (re-pushing it would resurrect something another platform deliberately removed, which is exactly the mistake Axiom 1 rules out). The two cases are mutually exclusive by construction and require no additional signal to tell apart.

**Packet handler:** `registerPacketHandler(ONTOLOGIES.Workgroup, (w3id, metaEnvelopeId, data) => reconcileWorkgroupPacket(w3id, metaEnvelopeId, data))` in `registerOntologyHandlers.ts`. Resolves `communityId` from local `Community` where `ename === w3id`, then calls `reconcileWorkgroupFromEvault`. Create/update only — deletion is invisible to packets (see below), so the packet handler never deletes.

**Sweep:** `workgroupReconciliationSweep()`, registered in `registerReconcilers.ts` as `registerReconciler("workgroup", 60 * 60_000, workgroupReconciliationSweep)`. Iterates `communityRepo().find({ where: { provisioning_status: "linked" } })`, calls `reconcileWorkgroupsForCommunity(community.id)` per community.

**Request-trigger:** new `WorkgroupReconcileTrigger.ts` — own `Map<communityId, lastReconciledAtMs>`, 60s debounce (mirrors `OrganizationReconcileTrigger.ts` exactly), exports `triggerWorkgroupReconcile(communityId)` and `_resetForTests()`. Wired into `WorkgroupController.ts`'s `listWorkgroupsHandler` (the only Workgroup route keyed directly by `communityId`) — fire-and-forget, `.catch(err => logger.warn(...))`, right before `res.json(workgroups)`, same spot `getCommunityHandler` fires `triggerOrganizationReconcile`/`triggerAvailabilityReconcile`.

## Why deletion needs the full-list sweep, not the packet handler

Confirmed by reading `packetDispatch.ts` and `AaaSService.ts`: there is no delete/tombstone packet type anywhere in the W3DS packet or AaaS layer — every packet is implicitly "here's this envelope's current data." `WorkgroupService.deleteWorkgroup` calls `removeEnvelope` (a plain GraphQL mutation) directly, then hard-deletes the local row — no webhook or packet is emitted as a consequence. So a deletion is only ever discoverable by noticing an envelope id that used to appear in `findEnvelopesByOntology`'s result no longer does — exactly the pattern `AvailabilityReconciler` already uses for `AvailabilityType` removal (diff current local set against the latest full snapshot, hard-delete anything absent, `logger.warn`, no soft-mark step). `reconcileWorkgroupsForCommunity` applies the same rule to `Workgroup` rows.

## Matching keys (per-workgroup and nested rows)

- **Workgroup itself:** matched by local `Workgroup.envelope_id` == the envelope's own metaEnvelopeId. No match → bootstrap: create a local `Workgroup` row (`community_id`, `name`/`description`/`color`/`chat_envelope_id` from the payload, `sort_order` appended to the end of the community's existing list, `envelope_id` = the discovered id).
- **Roles:** payload `roles[].id` becomes the local `Role.id` directly — same precedent as `OrganizationReconciler.reconcileMembershipTypes`, which inserts the payload's UUID as the local primary key (`repo.create({ id: et.id, ... })`) rather than generating a fresh one and tracking a separate mapping. New role in payload → local `Role` row created with that exact id. Role no longer in payload → local `Role` row deleted (cascades to its `WorkgroupMemberRole` rows via the existing FK).
- **Members:** payload `members[].participantId` is the member's **User meta-envelope id**, not eName (confirmed in `workgroupPayload.ts` — a different join key than Organization's eName-based roster matching). Match local `Person` by `meta_envelope_id`, then local `WorkgroupMembership` by `person_id`. `WorkgroupMembership.id` is always DB-generated, never payload-sourced — same as `CommunityMembership`.
- **Member roles:** derived from `members[].roleIds` — reconcile each membership's `WorkgroupMemberRole` rows to match that array exactly (add missing, remove extra).
- **Deletion eligibility gate:** never delete a local `WorkgroupMembership` for a person missing `ename`/`meta_envelope_id` — such a person could never have appeared in the envelope's `members[]` to begin with, so their absence is not evidence of removal. Same safety `OrganizationReconciler.reconcileRoster` already applies.

## Write-path fix (prerequisite, same commit family as this plan)

`WorkgroupService.updateWorkgroupMember` (the `is_workgroup_admin` toggle) is currently the only Workgroup mutation that does not call `syncWorkgroupToEvault` — every other mutation (`createWorkgroup`, `updateWorkgroup`, role CRUD, `addWorkgroupMember`, `removeWorkgroupMember`, role assign/unassign) does. Once `WorkgroupReconciler` exists and treats eVault as authoritative, the next sweep/packet would silently revert any local admin-flag toggle back to its last-synced value, since eVault never learned about it. Fix: add the missing `syncWorkgroupToEvault(workgroupId).catch(...)` call to `updateWorkgroupMember`, matching the fire-and-forget pattern its sibling mutations already use.

## Error handling

- Per-workgroup, per-role, per-member isolation — each independently try/caught, one bad entry never aborts the rest of the community's reconcile pass (same as Organization/Availability/Membership).
- Structural drift (bootstrap, delete, reverse-self-heal repush) logs at `warn`, never silently — standing rule across all four Readers.
- An ineligible person (no `ename`/`meta_envelope_id`) is skipped, not treated as an error.

## Non-goals

- No changes to `workgroupPayload.ts`'s payload shape — pure consumer, aside from the one write-path fix above.
- No foreign-*community* bootstrap. `WorkgroupReconciler` only operates on communities CORE already knows locally (`provisioning_status: "linked"`), unlike `MembershipReconciler`'s foreign-community stub. A workgroup can be foreign to CORE; its parent community cannot be — the sweep is scoped to communities CORE already tracks.
- No admin-approval queue for bootstrapped workgroups — same automatic-discovery stance `MembershipReconciler` takes for community stubs.
- `AvailabilityLogReader` stays out of scope — separate future item, unrelated ontology.

## Testing

Same convention as the prior three Readers: no test in this repo touches a real `AppDataSource`/database. `WorkgroupReconcileTrigger.ts` gets the same 4-test debounce suite shape as `OrganizationReconcileTrigger.test.ts`/`AvailabilityReconcileTrigger.test.ts`, keyed by `communityId`. The rest of `WorkgroupReconciler.ts` is verified via a manual smoke-test sequence (specified in the implementation plan):

1. A community with a Workgroup envelope CORE has no local row for (`envelope_id` unmatched) — trigger reconcile, confirm a local `Workgroup` stub is created with the right scalars, roles, and members.
2. A locally known workgroup whose envelope scalars/roles/members changed remotely — confirm the local row, roles, and members update to match.
3. A locally known workgroup whose envelope was deleted (absent from the latest `findEnvelopesByOntology` list, `envelope_id` non-null) — confirm the local row (and cascaded roles/memberships) is hard-deleted, `logger.warn` fired.
4. A local workgroup with `envelope_id: null` (simulating a failed initial sync) — trigger reconcile, confirm `syncWorkgroupToEvault` fires and `envelope_id` gets populated, without deleting anything.
5. Toggle a workgroup member's admin flag via `updateWorkgroupMember` — confirm the write-path fix causes a sync call, and that the change round-trips through a subsequent reconcile without being reverted.
