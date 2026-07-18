# Community Membership Envelope — Design

**Goal:** any platform that knows a user's eName should be able to discover which communities that user belongs to, without the user manually re-entering community enames per platform. Surfaced by WVTTK's ActionCard integration, see [[project_wvttk]].

**Context:** CORE's `addMember`/`createCommunity`/`removeMember` only ever write into the **community's** own eVault (Organization/Chat envelopes). Nothing is ever written back onto the joining member's own vault. Registry's `/list` has no membership-index capability, and no other W3DS service tracks "who belongs to what" — confirmed by direct code/doc inspection, not assumption. Result: every platform must be manually told a user's community enames today (WVTTK's current requirement), which contradicts W3DS's self-sovereign-data model — the member's own vault should be the discoverable source for this fact.

## Approved design

New custom ontology **`Membership`**, minted UUID **`d300f6d4-a018-446c-add4-b34abc95de05`** (no MetaState approval needed for custom ontologies, per [[feedback_w3ds_custom_ontologies]] — same precedent as WVTTK's `ActionCard` ontology).

One envelope per community membership, written to the **member's own eVault** (`X-ENAME: @<member ename>`):

```json
{
  "v": 1,
  "communityEname": "@de68861c-8ea9-55be-9258-2a8cc3057a60",
  "joinedAt": "2026-07-18T06:49:01Z"
}
```

Deliberately minimal — no name, role, or workgroup data. Any platform reading this envelope treats `communityEname` as a pointer and resolves everything else (community name, the member's roles/workgroups within it, current standing) live from the community's own eVault, which remains the single source of truth for that data. This was the user's explicit simplification: "just community ename is enough no? all other things should be checked in community evault!"

**ACL:** `[memberEname, communityEname]`. Both the member (owns the vault) and the community (needs to read it back to detect drift, e.g. for future reconciliation tooling) can read; per prototype ACL semantics ([[feedback_w3ds_custom_ontologies]] context — no read-only split exists yet), both can also write, but only CORE's own code writes today.

## Data model changes

### `CommunityMembership` changes

Add:
```ts
@Column({ type: "text", nullable: true })
membership_envelope_id: string | null;
```

Same convention as `Community.organization_envelope_id` / `.chat_envelope_id` (`~/Projects/CORE/api/src/database/entities/Community.ts`) — a nullable string column on the owning entity tracking the real eVault-assigned envelope id, so later update/delete calls can address it. Note this is distinct from the pre-existing `CommunityMembership.meta_envelope_id` column, which stores the *member's own* User meta-envelope id for `participantId` reference purposes — unrelated to this feature.

### New service: `MembershipEnvelopeService.ts`

Following the existing `syncOrganizationToEvault`/`syncWorkgroupToEvault` pattern (private helper, called from the service layer, not the controller layer):

- `createMembershipEnvelope(membership: CommunityMembership): Promise<string>` — builds the payload above, calls `createEnvelope` against the member's own vault, returns the new envelope id for the caller to persist onto `membership_envelope_id`.
- `deleteMembershipEnvelope(membership: CommunityMembership): Promise<void>` — calls `removeEnvelope` (or equivalent) against `membership.membership_envelope_id`. Throws on failure — does not swallow.

## Exhaustive trigger inventory (confirmed via code read)

Community-level only — NOT workgroup-level (user's explicit call: workgroup membership doesn't get its own envelope; it's part of what a reader resolves live from the community vault).

Three trigger points, all in CORE, all previously read in full this session:

1. **`createCommunity()`** (`CommunityService.ts:28-46`) — creator is auto-added as admin member. Call `createMembershipEnvelope`, **fire-and-forget** (`.catch(err => logger.warn(...))`), matching this function's existing sync-call convention. Persist the returned envelope id onto the new `CommunityMembership` row's `membership_envelope_id` only on success; on failure the column stays `null` and the row is otherwise complete (self-heals: see Known gaps).

2. **`addMember()`** (`MemberService.ts:25-73`) — admin adds an existing person as a member. Call `createMembershipEnvelope` **fire-and-forget** at the same point as the existing sync call (lines 65-67), same success/failure handling as above.

3. **`removeMember()`** (`MemberService.ts:89-109`) — admin removes a member. Call `deleteMembershipEnvelope`, **`await`ed, before** the local `CommunityMembership` DB delete (mirrors this function's existing pattern: it already `await`s `syncOrganizationToEvault` before deleting at line 104-105). If the envelope delete throws, the request aborts and the DB row is NOT deleted — asymmetric with the fire-and-forget create path.

**Why asymmetric:** per [[feedback_evault_source_of_truth]], a stale "still a member" envelope surviving in the member's own vault after real removal is a correctness/privacy leak — the member's vault would keep claiming membership in a community they've actually left, and any platform trusting it would be wrong. That risk outweighs the minor UX cost of removal occasionally failing/retrying. A delayed *create* (envelope momentarily missing right after join) is comparatively harmless — the member just isn't discoverable for a few seconds, self-heals on any future write.

### Confirmed dead ends — no wiring needed

- Role toggles (`assignRole()`/`unassignRole()`, `CommunityService.ts`) — never create or delete `CommunityMembership` rows, only change permissions on an existing membership. No envelope impact.
- Workgroup-level join/leave (`WorkgroupService.ts`) — separate table (`WorkgroupMembership`), explicitly out of scope per the community-level-only decision above.
- No invite system exists anywhere in CORE today — nothing to wire for an invite-acceptance path because none exists.

### Confirmed pre-existing CORE gaps — not this feature's job to fix

- No self-leave route (a member cannot remove themselves; only an admin can remove another member via `removeMember()`).
- No community-deletion route/cascade.
- `deleteWorkgroup()` (`WorkgroupService.ts:128-136`) already orphans `WorkgroupMembership` rows — pre-existing bug, unrelated to this feature, not touched here.

If any of these gaps are filled in the future, they will need their own membership-envelope wiring at that time (self-leave and community-deletion would both need envelope deletes; today it's not needed because the code paths don't exist).

## Error handling

- Create (`createCommunity`, `addMember`): fire-and-forget, `logger.warn` on failure, `membership_envelope_id` stays `null` — does not block the surrounding request.
- Delete (`removeMember`): synchronous, failure propagates to the controller (existing 500 path, same as `syncOrganizationToEvault`'s existing blocking-delete failure handling), local DB delete never runs.

## Known gaps (explicit, out of scope for this feature)

- **No backfill migration for existing members.** Every `CommunityMembership` row that predates this feature has `membership_envelope_id = null` and no corresponding real envelope, except the two rows manually backfilled for the user during design (see below). Existing members remain non-discoverable until they trigger some future update path — there is no such path today (no "re-sync my membership" action exists), so in practice they stay `null` indefinitely unless a one-off backfill script is run separately. Not part of this plan; flag to the user as a follow-up decision.
- **Two manual backfill envelopes already exist** in production, created directly via GraphQL ahead of this code being wired (see [[project_core_membership_envelope]] for full detail):
  - Community `@ff7fab8a-bed8-505e-b9c8-4e1ec6c9c411` → envelope id `e119227a-eac1-5c18-9e2d-7c0079cc0e99`
  - Community `@de68861c-8ea9-55be-9258-2a8cc3057a60` → envelope id `a0dfda65-9558-5ff5-aecb-8288347d9dd2`

  Both belong to the user's own memberships (`@9dafa031-4118-564c-bfa6-5917ddc8ab88`, see [[user_ename]]). Once the `membership_envelope_id` column exists, the implementation plan must include a one-time data-fix step: locate the two corresponding `CommunityMembership` rows and set their `membership_envelope_id` to these existing ids — **not** create new envelopes for them, or the old two become orphaned duplicates and `removeMember()`'s delete path won't find the real one.

## Out of scope

- Backfill for any other pre-existing member besides the user's own two rows above.
- Workgroup-level membership envelopes.
- Any reconciliation/drift-detection tooling that would use the community's read access from the ACL.
- Registering the `Membership` ontology in the W3DS Ontology service (consistent with `Organization`/`Workgroup`'s existing deferral — custom ontologies need no registration to function).
- Self-leave and community-deletion cascades (don't exist yet; out of scope per "Confirmed pre-existing CORE gaps" above).
