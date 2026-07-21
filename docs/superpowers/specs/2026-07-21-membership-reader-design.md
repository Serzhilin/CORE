# MembershipReader — Design

**Goal:** Third read-back path in CORE's W3DS-native migration (staged per `docs/superpowers/specs/2026-07-20-core-w3ds-native-analysis.md`), following `OrganizationReader` and `AvailabilityReader` (both shipped locally on main). Today `Membership` is write-only — `MembershipEnvelopeService.ts` writes one envelope per `CommunityMembership` row into **the member's own vault** (not the community's), so that other W3DS platforms can discover a person's community memberships. CORE never reads this ontology back. This plan makes CORE a consumer of it too, delivering the actual point of the ontology: a person who joins a community through any other W3DS platform sees it appear in CORE the next time they use CORE, with no manual linking step.

This is a structurally different shape from Organization/Availability (one envelope per community, one payload holding a full list) — Membership is one minimal envelope (`{v:1, communityEname, joinedAt}`) per membership, per person, immutable after creation. The design below does not reuse their three-trigger pattern; the reasoning for the deviation is in the Architecture section.

## Architecture: single trigger, person-keyed, no polling

New `api/src/services/MembershipReconciler.ts`, single entry point `reconcileMembershipsForPerson(personId)`.

**Why not the three-trigger pattern (packet handler + periodic sweep + request-trigger)?** Organization/Availability's packet handler and hourly sweep exist to keep a community's cached data fresh for a viewer who isn't the one whose action changed it — e.g. anyone loading a community page benefits from a sweep that ran because someone else's edit landed. Membership data has no equivalent audience: the only consumer of "which communities is Alice a member of" is Alice's own CORE session. Nobody needs it fresh unless she's actively there to see it. A packet handler for this ontology would mean polling AaaS for every Membership envelope written anywhere on the network, for people CORE may never have heard of, to catch the rare case that one of them is a person CORE actually has a session for right now — a global firehose to serve a single-person, single-session need. A periodic sweep over every local Person has the same shape of waste. Neither is justified when the one real trigger (the person interacting with CORE) already covers the need.

**The one trigger:** request-triggered, debounced by `personId`. New `MembershipReconcileTrigger.ts` — own `Map<personId, lastReconciledAtMs>`, own 60-second debounce window (mirroring `AvailabilityReconcileTrigger.ts`'s structure exactly, keyed by person instead of community), exporting `triggerMembershipReconcile(personId)` and `_resetForTests()`. Called from `AuthController.ts` at both `epassportLogin` (line ~63-108, the real W3DS login flow) and `getMe` (line ~135-156, called on every authenticated session refresh) — fire-and-forget, `.catch(err => logger.warn(...))`, not awaited, so it never delays the response.

**Consequence:** no `ONTOLOGIES.Membership` entry in `registerOntologyHandlers.ts`, no `registerReconciler("membership", ...)` in `registerReconcilers.ts`. `AaaSService.ts`'s poll loop (`getRegisteredOntologies()`-driven) never touches this ontology — untouched by this plan.

**Trade-off accepted:** if Alice joins a community on another platform while a CORE tab is already open and never refreshes it, she won't see the new community until her next login or session refresh. This is a staleness window bounded by "how long until she reloads CORE," not a correctness gap — the data is right the moment she actually asks. Consistent with how session-cached apps already behave.

## Reconciliation semantics (inside `reconcileMembershipsForPerson`)

1. Look up `Person` by `personId`. If `!person.ename || !person.meta_envelope_id` (no vault to read — same eligibility gate `OrganizationReconciler`/`AvailabilityReconciler` already use), no-op.
2. Fetch this person's own Membership envelopes: `findEnvelopesByOntology(person.ename, ONTOLOGIES.Membership, 200)`. Track every `communityEname` seen, in a `Set`, for step 4.
3. **Forward direction — for each envelope entry (`communityEname`, `joinedAt`):**
   - Look up local `Community` by `ename === communityEname`.
   - **Found** → this community is already known to CORE. Fetch its Organization envelope (`findEnvelopesByOntology(community.ename, ONTOLOGIES.Organization, 1)`) and call the already-shipped `reconcileOrganizationFromEvault(community.id, orgPayload)` if an envelope exists. This is the only thing that ever creates/updates this person's own `CommunityMembership` row for that community — `MembershipReconciler` never touches `CommunityMembership` rows directly, so there is exactly one authority for roster membership in the system (`OrganizationReconciler.reconcileRoster`), never two reconcilers racing to create or delete the same row off two different envelopes.
   - **Not found** → foreign-platform discovery. Bootstrap a minimal `Community` stub (see below), then do the same Organization-envelope fetch-and-reconcile as the found case. If the stub bootstrap fails (unresolvable eName, no Chat/Community envelope yet), log a warning and skip this entry — same "can't act on what can't be resolved" boundary `reconcileRoster` already applies to unresolvable `eName`s in a roster list.
   - Every entry is independently try/caught — one bad entry never aborts the rest of the person's memberships.
4. **Reverse direction — self-heal CORE's own write gaps.** Fetch this person's local `CommunityMembership` rows, join to their `Community` rows. For each membership whose community is `provisioning_status === "linked"` with an `ename` **not** in the envelope-`communityEname` set from step 2: call the existing `createMembershipEnvelope(membershipId)`. That function is already idempotent (no-ops if `membership_envelope_id` is already set) and already no-ops safely if the community isn't linked or the person has no ename — so this is a safe, repeated, fire-and-forget repair for a membership CORE created via the normal join flow but never got (or lost) its own outbound envelope for.

   This reverse direction never deletes anything. A missing envelope for a membership CORE's own roster (`OrganizationReconciler`) still considers current is treated as a write gap to repair, not as evidence the membership ended — deletion authority for `CommunityMembership` rows stays exclusively with `OrganizationReconciler.reconcileRoster`, which already has its own eligibility-gated deletion logic reviewed under the Organization plan.

### Bootstrapping a foreign community stub

`resolveEnameForNewCommunity(ename)` (existing, `CommunityService.ts:372`, read-only, throws `"w3id_not_found"`/`"group_not_found"`) already does exactly the resolution a stub needs: resolves the eName via the Registry, reads its Chat/Community envelope for `name`/`description`/`logo_url`. Reused as-is.

**Not reused as-is:** `createCommunityFromEname` (`CommunityService.ts:407`). It ends with `syncOrganizationToEvault(community.id)` — a **write** that pushes a fresh, empty Organization envelope to the community's own vault. That's correct for its actual purpose (a platform admin manually adopting a community CORE will now author going forward) and would be destructive here: overwriting the real roster/admin/membership-type data some other platform already authoritatively wrote for that community, for every other platform reading it, with CORE's blank defaults. A private `bootstrapCommunityStub(ename)` in `MembershipReconciler.ts` duplicates only `createCommunityFromEname`'s creation block (dedup-check by `ename`, `resolveEnameForNewCommunity` call, default-availability-type seeding, `provisioning_status: "linked"`) and stops there — no write-back. The caller (`reconcileMembershipsForPerson`) does the hydration afterward, by reading the real Organization envelope if one exists, same as the found-community path.

**Slug:** `Community.slug` is `NOT NULL UNIQUE` with no natural W3DS-side value — a CORE-only concept, confirmed by `createCommunityFromEnameHandler` requiring a human-supplied slug for the manual-adopt flow. A stub has no human present, so a small new helper generates one: `slugify(name)` (lowercase, diacritics stripped, non-alphanumerics collapsed to hyphens, `"community"` fallback for an empty result) plus a numeric-suffix loop (`-2`, `-3`, ...) against `communityRepo().findOne({ where: { slug } })` until unique.

**Race handling:** `Community.ename` has no DB-level uniqueness constraint, so two concurrent triggers discovering the same never-before-seen community (e.g. two logins landing close together) could both pass the pre-create dedup check. The create is wrapped in try/catch: on a unique-violation (Postgres `23505`, from the `slug` constraint colliding is far more likely than two threads generating the same slug, but either way) the catch re-queries by `ename` and uses the row that won the race instead of failing the pass. This mirrors the "loud but self-correcting" posture the other reconcilers already take toward races — logged, not silent, never a hard failure of the whole reconcile call.

## Error handling

- All Person/community-level failures are logged (`logger.warn`) and do not throw past `reconcileMembershipsForPerson` — the trigger call site already wraps it in `.catch`, but internal steps are independently caught too, matching Organization/Availability's per-row isolation.
- No envelopes found for an eligible person → no-op (a person with zero community memberships, or someone who hasn't joined anything through any platform yet).
- Structural drift this reconciler causes (a bootstrapped stub, a repaired missing envelope) logs at `warn`, never silently — same standing rule the other reconcilers follow.

## Non-goals

- No packet handler, no periodic sweep — see Architecture section for why this ontology doesn't need them.
- No changes to the write path — `MembershipEnvelopeService.ts` / `membershipPayload.ts` untouched, `createMembershipEnvelope`/`deleteMembershipEnvelope` reused as-is.
- No changes to `OrganizationReconciler.ts`/`AvailabilityReconciler.ts` — pure consumer of `reconcileOrganizationFromEvault`.
- No admin review/approval queue for bootstrapped stub communities — discovery is fully automatic, matching "she can use any platform" with no manual linking step. A bootstrapped community is a real, if minimal, local `Community` row from the moment it's discovered.
- `WorkgroupReader` stays out of scope, its own future plan.

## Testing

Same convention as the prior two Readers: no test in this repo touches a real `AppDataSource`/database. `slugify()` is pure and gets direct unit tests (diacritics, empty/symbols-only input, normal names). `MembershipReconcileTrigger.ts` gets the same 4-test suite shape as `AvailabilityReconcileTrigger.test.ts`, keyed by `personId`. The rest of `MembershipReconciler.ts` is verified via a manual smoke-test sequence (specified in the implementation plan):

1. A local Person with an existing Membership envelope pointing at a `communityEname` with no local `Community` row — trigger reconcile, confirm a stub is created (correct name/logo from the Chat envelope, generated unique slug, `provisioning_status: "linked"`) and, if that community also has a real Organization envelope, confirm the person's own `CommunityMembership` row appears with the right `membership_type_id`/admin status.
2. A local Person eligible and linked to a known community locally, with a Membership envelope for it already present — confirm no duplicate work, no duplicate stub.
3. Two never-before-seen communities whose names normalize to the same slug — confirm the second gets a `-2` suffix.
4. A local eligible `CommunityMembership` row on a linked community with `membership_envelope_id: null` and no matching envelope in the vault — trigger reconcile, confirm `createMembershipEnvelope` fires and the row gets its `membership_envelope_id` populated.
