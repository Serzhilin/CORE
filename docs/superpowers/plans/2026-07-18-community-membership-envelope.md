# Community Membership Envelope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Task 8 is a manual, human-supervised production data-fix — do NOT delegate it to an autonomous subagent. It must be run interactively with the user present.**

**Goal:** write a minimal `Membership` envelope to a community member's own eVault on join, and delete it on removal, so any W3DS platform holding a user's eName can discover which communities they belong to — without CORE ever being asked.

**Architecture:** a pure payload builder (`membershipPayload.ts`) plus a small orchestration service (`MembershipEnvelopeService.ts`) that loads the `CommunityMembership`/`Person`/`Community` rows, builds the payload, and calls the existing `evault-client.ts` GraphQL wrapper. Wired into the two real membership-creation call sites and the one removal call site. Follows the `OrganizationService.ts` pattern already in this codebase exactly — same fire-and-forget-create / awaited-blocking-delete split as `syncOrganizationToEvault`.

**Tech Stack:** TypeScript, TypeORM (Postgres, `synchronize: true` in dev — entity column changes take effect on next server restart; production has `DB_SYNCHRONIZE` disabled after first deploy per `DEPLOY.md` Step 8, so the new column needs a manual `ALTER TABLE` there — see Task 2), Jest (plain `describe`/`it`, no mocking framework used anywhere in this codebase's service tests), existing `api/src/lib/evault-client.ts` GraphQL wrapper.

## Global Constraints

- Ontology UUID for `Membership` is **`d300f6d4-a018-446c-add4-b34abc95de05`** — already minted during brainstorming, reuse exactly, do not generate a new one.
- Payload shape is exactly `{ v: 1, communityEname: string, joinedAt: string }` — no additional fields (per spec: "just community ename is enough... all other things checked in community evault").
- ACL is exactly `[memberEname, communityEname]`.
- Envelope is written to the **member's own vault** (`vaultEname` = the `Person.ename`, never the community's).
- No unit tests for I/O-orchestration functions (matches this codebase's existing convention: `OrganizationService.ts`, `MemberService.ts`, `CommunityService.ts` have no test files; only pure payload builders like `organizationPayload.ts` do). Only `membershipPayload.ts` gets a test file.
- No migration files exist or are used anywhere in this codebase — schema changes are TypeORM entity edits only (`synchronize: true` picks them up in dev on restart).

---

## Task 1: Mint the `Membership` ontology constant

**Files:**
- Modify: `api/src/lib/w3ds/ontology.ts`

**Interfaces:**
- Produces: `ONTOLOGIES.Membership` (string constant `'d300f6d4-a018-446c-add4-b34abc95de05'`), consumed by Task 4.

- [ ] **Step 1: Add the constant**

Current file:
```ts
export const ONTOLOGIES = {
  Community: '550e8400-e29b-41d4-a716-446655440003', // Chat envelope — group identity (GroupManifest is retiring)
  User:      '550e8400-e29b-41d4-a716-446655440000', // User profile envelope
  Workgroup: '7867abbd-420e-4dd9-bad6-8ad894c50b94', // Custom ontology — not yet registered in the Ontology service
  Organization: 'ad226473-640e-4d16-90e5-2fd96f261554', // Custom ontology — not yet registered in the Ontology service
  Availability: 'fcdc28d2-f22e-469b-a2f0-dad6bf3dd152', // Custom ontology — not yet registered in the Ontology service
} as const
```

Change to:
```ts
export const ONTOLOGIES = {
  Community: '550e8400-e29b-41d4-a716-446655440003', // Chat envelope — group identity (GroupManifest is retiring)
  User:      '550e8400-e29b-41d4-a716-446655440000', // User profile envelope
  Workgroup: '7867abbd-420e-4dd9-bad6-8ad894c50b94', // Custom ontology — not yet registered in the Ontology service
  Organization: 'ad226473-640e-4d16-90e5-2fd96f261554', // Custom ontology — not yet registered in the Ontology service
  Availability: 'fcdc28d2-f22e-469b-a2f0-dad6bf3dd152', // Custom ontology — not yet registered in the Ontology service
  Membership: 'd300f6d4-a018-446c-add4-b34abc95de05', // Custom ontology — not yet registered in the Ontology service. Written to the MEMBER's own vault, not the community's.
} as const
```

- [ ] **Step 2: Typecheck**

Run: `cd api && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add api/src/lib/w3ds/ontology.ts
git commit -m "feat: mint Membership ontology constant"
```

---

## Task 2: Add `membership_envelope_id` column to `CommunityMembership`

**Files:**
- Modify: `api/src/database/entities/CommunityMembership.ts`

**Interfaces:**
- Produces: `CommunityMembership.membership_envelope_id: string | null`, consumed by Task 4 (read/write) and Tasks 5-7 (call-site guards).

- [ ] **Step 1: Add the column**

Current relevant section:
```ts
    // MetaEnvelope ID of the member's User profile, cached once resolved — feeds the
    // Organization envelope's members[].participantId on every sync.
    @Column({ type: "varchar", nullable: true })
    meta_envelope_id: string | null;

    @CreateDateColumn()
    created_at: Date;
```

Change to:
```ts
    // MetaEnvelope ID of the member's User profile, cached once resolved — feeds the
    // Organization envelope's members[].participantId on every sync.
    @Column({ type: "varchar", nullable: true })
    meta_envelope_id: string | null;

    // Real eVault envelope id of this membership's Membership envelope, written to the
    // MEMBER's own vault (not the community's) — distinct from meta_envelope_id above.
    // Null until the community is linked AND the member has an ename (see MembershipEnvelopeService).
    @Column({ type: "text", nullable: true })
    membership_envelope_id: string | null;

    @CreateDateColumn()
    created_at: Date;
```

- [ ] **Step 2: Restart the dev API and confirm the column exists**

Run: `cd api && npm run dev` (or restart if already running), then in another terminal:
```bash
docker exec -it <core-postgres-container> psql -U <user> -d core -c "\d community_memberships" | grep membership_envelope_id
```
Expected: a row showing `membership_envelope_id | text |`.

- [ ] **Step 3: Commit**

```bash
git add api/src/database/entities/CommunityMembership.ts
git commit -m "feat: add membership_envelope_id column to CommunityMembership"
```

---

## Task 3: Membership payload builder

**Files:**
- Create: `api/src/services/membershipPayload.ts`
- Test: `api/src/services/__tests__/membershipPayload.test.ts`

**Interfaces:**
- Produces: `buildMembershipPayload(input: MembershipPayloadInput): MembershipEnvelopePayload`, consumed by Task 4.
  - `MembershipPayloadInput = { communityEname: string; joinedAt: string }`
  - `MembershipEnvelopePayload = { v: 1; communityEname: string; joinedAt: string }`

- [ ] **Step 1: Write the failing test**

```ts
import { buildMembershipPayload } from "../membershipPayload";

describe("buildMembershipPayload", () => {
    it("maps communityEname and joinedAt verbatim, sets v to 1", () => {
        const result = buildMembershipPayload({
            communityEname: "@de68861c-8ea9-55be-9258-2a8cc3057a60",
            joinedAt: "2026-07-18T06:49:01.000Z",
        });
        expect(result).toEqual({
            v: 1,
            communityEname: "@de68861c-8ea9-55be-9258-2a8cc3057a60",
            joinedAt: "2026-07-18T06:49:01.000Z",
        });
    });

    it("carries a different communityEname/joinedAt through unchanged", () => {
        const result = buildMembershipPayload({
            communityEname: "@ff7fab8a-bed8-505e-b9c8-4e1ec6c9c411",
            joinedAt: "2020-01-15T00:00:00.000Z",
        });
        expect(result.communityEname).toBe("@ff7fab8a-bed8-505e-b9c8-4e1ec6c9c411");
        expect(result.joinedAt).toBe("2020-01-15T00:00:00.000Z");
        expect(result.v).toBe(1);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx jest membershipPayload --runInBand`
Expected: FAIL — `Cannot find module '../membershipPayload'`.

- [ ] **Step 3: Write the implementation**

```ts
export interface MembershipPayloadInput {
    communityEname: string;
    joinedAt: string;
}

export interface MembershipEnvelopePayload {
    v: 1;
    communityEname: string;
    joinedAt: string;
}

export function buildMembershipPayload(input: MembershipPayloadInput): MembershipEnvelopePayload {
    return {
        v: 1,
        communityEname: input.communityEname,
        joinedAt: input.joinedAt,
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npx jest membershipPayload --runInBand`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/membershipPayload.ts api/src/services/__tests__/membershipPayload.test.ts
git commit -m "feat: add buildMembershipPayload"
```

---

## Task 4: `MembershipEnvelopeService` — create/delete orchestration

**Files:**
- Create: `api/src/services/MembershipEnvelopeService.ts`

**Interfaces:**
- Consumes: `buildMembershipPayload` (Task 3), `ONTOLOGIES.Membership` (Task 1), `CommunityMembership.membership_envelope_id` (Task 2), `createEnvelope`/`removeEnvelope` from `../lib/evault-client` (existing, signatures confirmed: `createEnvelope(input: { vaultEname, ontology, payload, acl }): Promise<string>`, `removeEnvelope(vaultEname: string, envelopeId: string): Promise<void>`).
- Produces:
  - `createMembershipEnvelope(membershipId: string): Promise<void>` — consumed by Tasks 5 and 6.
  - `deleteMembershipEnvelope(membershipId: string): Promise<void>` — consumed by Task 7.

No test file for this task — matches this codebase's existing convention that DB+network orchestration functions (`syncOrganizationToEvault`, `addMember`, `removeMember`, etc.) have no unit tests; only pure payload builders do. Verified manually in Task 7's step 2 instead.

- [ ] **Step 1: Write the service**

```ts
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Community } from "../database/entities/Community";
import { Person } from "../database/entities/Person";
import { createEnvelope, removeEnvelope } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { buildMembershipPayload } from "./membershipPayload";

const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const communityRepo = () => AppDataSource.getRepository(Community);
const personRepo = () => AppDataSource.getRepository(Person);

/** Creates a Membership envelope in the member's own vault for one CommunityMembership row.
 *  No-op (not an error) if: the row no longer exists, already has an envelope, the community
 *  isn't linked yet (no communityEname available), or the member has no ename yet (no vault
 *  to write into). Safe to call fire-and-forget — self-heals on any future call since it's
 *  idempotent on membership_envelope_id. */
export async function createMembershipEnvelope(membershipId: string): Promise<void> {
    const membership = await membershipRepo().findOne({ where: { id: membershipId } });
    if (!membership || membership.membership_envelope_id) return;

    const community = await communityRepo().findOne({ where: { id: membership.community_id } });
    if (!community || community.provisioning_status !== "linked" || !community.ename) return;

    const person = await personRepo().findOne({ where: { id: membership.person_id } });
    if (!person?.ename) return;

    const payload = buildMembershipPayload({
        communityEname: community.ename,
        joinedAt: membership.created_at.toISOString(),
    });

    const envelopeId = await createEnvelope({
        vaultEname: person.ename,
        ontology: ONTOLOGIES.Membership,
        payload: { ...payload },
        acl: [person.ename, community.ename],
    });

    await membershipRepo().update(membership.id, { membership_envelope_id: envelopeId });
}

/** Deletes a CommunityMembership row's Membership envelope from the member's own vault.
 *  No-op if the row has no envelope (never created, or community was never linked).
 *  Throws (does not swallow) if the row has an envelope but the owning Person has no
 *  ename — that combination should be impossible (ename is never cleared once set on a
 *  Person that already has a membership envelope) and signals a data-integrity bug that
 *  must not fail silently. */
export async function deleteMembershipEnvelope(membershipId: string): Promise<void> {
    const membership = await membershipRepo().findOneOrFail({ where: { id: membershipId } });
    if (!membership.membership_envelope_id) return;

    const person = await personRepo().findOneOrFail({ where: { id: membership.person_id } });
    if (!person.ename) {
        throw new Error(
            `Person ${person.id} has no ename but owns Membership envelope ${membership.membership_envelope_id}`
        );
    }

    await removeEnvelope(person.ename, membership.membership_envelope_id);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd api && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/MembershipEnvelopeService.ts
git commit -m "feat: add MembershipEnvelopeService create/delete"
```

---

## Task 5: Wire `linkCommunity()` — backfill envelopes for pre-existing members

**Files:**
- Modify: `api/src/services/CommunityService.ts`

**Interfaces:**
- Consumes: `createMembershipEnvelope` (Task 4), `CommunityMembership` entity (already imported in this file at line 5), `logger` (already imported at line 13).

- [ ] **Step 1: Add the import**

At the top of `api/src/services/CommunityService.ts`, alongside the existing `syncOrganizationToEvault` import:
```ts
import { syncOrganizationToEvault } from "./OrganizationService";
import { createMembershipEnvelope } from "./MembershipEnvelopeService";
```

- [ ] **Step 2: Wire the backfill loop into `linkCommunity()`**

Current code (`linkCommunity`, ends around line 340):
```ts
    await getOrCreateCommunityChatId(saved.id, resolution.envelopeId);

    syncOrganizationToEvault(saved.id).catch((err) =>
        logger.warn(err, "Organization envelope creation failed for linked community %s", saved.id)
    );

    return saved;
}
```

Change to:
```ts
    await getOrCreateCommunityChatId(saved.id, resolution.envelopeId);

    syncOrganizationToEvault(saved.id).catch((err) =>
        logger.warn(err, "Organization envelope creation failed for linked community %s", saved.id)
    );

    const existingMemberships = await AppDataSource.getRepository(CommunityMembership).find({
        where: { community_id: saved.id },
    });
    for (const m of existingMemberships) {
        createMembershipEnvelope(m.id).catch((err) =>
            logger.warn(err, "Membership envelope creation failed for member %s", m.id)
        );
    }

    return saved;
}
```

`createMembershipEnvelope` internally no-ops for rows that already have `membership_envelope_id` set (relevant after an unlink→relink cycle — see `unlinkCommunity`'s note below), so no pre-filter is needed here.

- [ ] **Step 3: Typecheck**

Run: `cd api && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Requires a real linkable community + real eNames — not automatable without live eVault access. Skip automated verification for this step; Task 7's manual verification (full join→remove cycle) covers this path in practice since `createCommunity()` + `linkCommunity()` is the normal flow that creates the first membership row before linking.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/CommunityService.ts
git commit -m "feat: backfill Membership envelopes when a community is linked"
```

---

## Task 6: Wire `addMember()` — create envelope on join

**Files:**
- Modify: `api/src/services/MemberService.ts`

**Interfaces:**
- Consumes: `createMembershipEnvelope` (Task 4).

- [ ] **Step 1: Add the import**

At the top of `api/src/services/MemberService.ts`, alongside the existing `syncOrganizationToEvault` import:
```ts
import { syncOrganizationToEvault } from "./OrganizationService";
import { createMembershipEnvelope } from "./MembershipEnvelopeService";
```

- [ ] **Step 2: Wire the call into `addMember()`**

Current code (lines 65-70):
```ts
    syncOrganizationToEvault(communityId).catch((err) =>
        logger.warn(err, "Organization envelope sync failed for member %s", membership.id)
    );
    addPersonToCommunityChat(communityId, person.id).catch((err) =>
        logger.warn(err, "Community chat sync failed for member %s", membership.id)
    );

    return membership;
```

Change to:
```ts
    syncOrganizationToEvault(communityId).catch((err) =>
        logger.warn(err, "Organization envelope sync failed for member %s", membership.id)
    );
    addPersonToCommunityChat(communityId, person.id).catch((err) =>
        logger.warn(err, "Community chat sync failed for member %s", membership.id)
    );
    createMembershipEnvelope(membership.id).catch((err) =>
        logger.warn(err, "Membership envelope creation failed for member %s", membership.id)
    );

    return membership;
```

No linked-status pre-check needed here — `createMembershipEnvelope` already no-ops if the community isn't linked (Task 4, Step 1).

- [ ] **Step 3: Typecheck**

Run: `cd api && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add api/src/services/MemberService.ts
git commit -m "feat: create Membership envelope when a member is added"
```

---

## Task 7: Wire `removeMember()` — blocking delete on removal

**Files:**
- Modify: `api/src/services/MemberService.ts`

**Interfaces:**
- Consumes: `deleteMembershipEnvelope` (Task 4).

- [ ] **Step 1: Add the import**

Extend the same import line added in Task 6:
```ts
import { createMembershipEnvelope, deleteMembershipEnvelope } from "./MembershipEnvelopeService";
```

- [ ] **Step 2: Wire the blocking delete into `removeMember()`**

Current code (lines 89-109):
```ts
export async function removeMember(communityId: string, membershipId: string): Promise<void> {
    const membership = await memberRepo().findOne({ where: { id: membershipId, community_id: communityId } });
    if (!membership) return;

    const workgroupIds = (await workgroupRepo().find({ where: { community_id: communityId } })).map((w) => w.id);
    if (workgroupIds.length) {
        const wgMemberships = await workgroupMembershipRepo().find({
            where: { person_id: membership.person_id, workgroup_id: In(workgroupIds) },
        });
        for (const wm of wgMemberships) {
            await removeWorkgroupMember(wm.workgroup_id, membership.person_id, true);
        }
    }

    await removePersonFromCommunityChat(communityId, membership.person_id);
    await syncOrganizationToEvault(communityId, { excludeMembershipId: membershipId });
    await memberRepo().delete({ id: membershipId, community_id: communityId });
    syncAvailabilityToEvault(communityId).catch((err) =>
        logger.warn(err, "Availability envelope sync failed after removing member %s", membershipId)
    );
}
```

Change to:
```ts
export async function removeMember(communityId: string, membershipId: string): Promise<void> {
    const membership = await memberRepo().findOne({ where: { id: membershipId, community_id: communityId } });
    if (!membership) return;

    const workgroupIds = (await workgroupRepo().find({ where: { community_id: communityId } })).map((w) => w.id);
    if (workgroupIds.length) {
        const wgMemberships = await workgroupMembershipRepo().find({
            where: { person_id: membership.person_id, workgroup_id: In(workgroupIds) },
        });
        for (const wm of wgMemberships) {
            await removeWorkgroupMember(wm.workgroup_id, membership.person_id, true);
        }
    }

    await removePersonFromCommunityChat(communityId, membership.person_id);
    await syncOrganizationToEvault(communityId, { excludeMembershipId: membershipId });
    await deleteMembershipEnvelope(membershipId);
    await memberRepo().delete({ id: membershipId, community_id: communityId });
    syncAvailabilityToEvault(communityId).catch((err) =>
        logger.warn(err, "Availability envelope sync failed after removing member %s", membershipId)
    );
}
```

`deleteMembershipEnvelope` is placed before the local delete and `await`ed unwrapped (no `.catch`) — a thrown error propagates out of `removeMember`, aborting before `memberRepo().delete(...)` runs. This matches the existing `syncOrganizationToEvault` line directly above it, and is the asymmetric behavior the spec calls for: a stale "still a member" envelope is worse than a removal that has to be retried.

- [ ] **Step 3: Typecheck**

Run: `cd api && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual end-to-end verification**

This is the only real verification available for Tasks 4-7 combined — there's no mocking infrastructure in this codebase to unit-test eVault I/O, so a live round-trip against a real (non-production) linked community and a real eName is the actual test:

1. Start the dev API (`npm run dev`) against a local/dev community that is linked to a real, disposable eName you control.
2. Call `addMember` for that community with a person who has a real `ename` set (via the existing admin UI or API directly).
3. Query that person's eVault directly (per the `w3ds` skill's `reference/evault.md` — resolve via Registry, then GraphQL `metaEnvelopes(filter: { ontologyId: "d300f6d4-a018-446c-add4-b34abc95de05" })`) and confirm a new envelope appears with `{ v: 1, communityEname: "<the community's ename>", joinedAt: "<ISO timestamp>" }`.
4. Confirm the corresponding `community_memberships.membership_envelope_id` column in Postgres is now set to that envelope's id.
5. Call `removeMember` for that same membership.
6. Re-query the same person's eVault and confirm the envelope is gone (`metaEnvelopes` filter returns nothing for that id, or a direct `metaEnvelope(id)` lookup 404s).
7. Confirm the `community_memberships` row itself is gone (delete cascades as before).

Expected: envelope appears after step 3, disappears after step 6, no errors in either direction.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/MemberService.ts
git commit -m "feat: delete Membership envelope when a member is removed"
```

---

## Task 8: Production data-fix — backfill the two manually-created envelopes (manual, human-supervised)

**Do not delegate this task to an autonomous subagent.** It mutates production data directly via SQL and must be run interactively with the user watching the output at each step, per this session's standing rule on hard-to-reverse actions affecting shared state.

**Context:** two Membership envelopes were already created directly via GraphQL against the user's real eVault during brainstorming, ahead of this code existing (see `project_core_membership_envelope.md` in memory):
- Community `@ff7fab8a-bed8-505e-b9c8-4e1ec6c9c411` → envelope id `e119227a-eac1-5c18-9e2d-7c0079cc0e99`
- Community `@de68861c-8ea9-55be-9258-2a8cc3057a60` → envelope id `a0dfda65-9558-5ff5-aecb-8288347d9dd2`

Both belong to the user's own memberships, ename `@9dafa031-4118-564c-bfa6-5917ddc8ab88`. Once the `membership_envelope_id` column exists in the production schema, these two ids must be written onto the corresponding `community_memberships` rows directly — **not** regenerated by the application code, or the old two envelopes become orphaned duplicates and this feature's `removeMember` delete path won't find the real ones.

**Prerequisite:** Task 2's column must already be live in the production schema. Since production has `DB_SYNCHRONIZE` disabled (`DEPLOY.md` Step 8), the column will NOT appear automatically on deploy/restart — it needs an explicit `ALTER TABLE`, run once, before or alongside this task.

- [ ] **Step 1: Find the live production DB container**

Do not reuse a container name/id from memory without checking — it may have changed since it was last recorded. SSH into the host (`ssh root@wvttk.lab.ecommons.space` — same host runs CORE's containers too) and run:
```bash
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i postgres
```
Confirm which one is CORE's database (cross-check against `docker inspect <name> --format '{{json .Config.Env}}'` for `POSTGRES_DB=core` or similar) before proceeding — the host runs Postgres containers for multiple apps.

- [ ] **Step 2: Add the column (if Task 2's entity change hasn't reached prod schema yet)**

```bash
docker exec -it <core-postgres-container> psql -U <postgres-user> -d core -c \
  "ALTER TABLE community_memberships ADD COLUMN IF NOT EXISTS membership_envelope_id text;"
```
Expected output: `ALTER TABLE`.

- [ ] **Step 3: Confirm the two target rows exist and are currently null**

```bash
docker exec -it <core-postgres-container> psql -U <postgres-user> -d core -c "
SELECT cm.id, c.ename AS community_ename, p.ename AS person_ename, cm.membership_envelope_id
FROM community_memberships cm
JOIN communities c ON c.id = cm.community_id
JOIN persons p ON p.id = cm.person_id
WHERE p.ename = '@9dafa031-4118-564c-bfa6-5917ddc8ab88'
  AND c.ename IN ('@ff7fab8a-bed8-505e-b9c8-4e1ec6c9c411', '@de68861c-8ea9-55be-9258-2a8cc3057a60');
"
```
Expected: exactly 2 rows, both with `membership_envelope_id` currently NULL. If fewer than 2 rows come back, STOP — the local `CommunityMembership` rows for these memberships don't exist yet in production (they may only exist in the eVault, not in CORE's own DB) and this update would silently affect nothing. Investigate before continuing rather than assuming the UPDATE below is a no-op-safe default.

- [ ] **Step 4: Run the two updates**

```bash
docker exec -it <core-postgres-container> psql -U <postgres-user> -d core -c "
UPDATE community_memberships cm
SET membership_envelope_id = 'e119227a-eac1-5c18-9e2d-7c0079cc0e99'
FROM persons p, communities c
WHERE cm.person_id = p.id AND cm.community_id = c.id
  AND p.ename = '@9dafa031-4118-564c-bfa6-5917ddc8ab88'
  AND c.ename = '@ff7fab8a-bed8-505e-b9c8-4e1ec6c9c411';
"
```
Expected: `UPDATE 1`.

```bash
docker exec -it <core-postgres-container> psql -U <postgres-user> -d core -c "
UPDATE community_memberships cm
SET membership_envelope_id = 'a0dfda65-9558-5ff5-aecb-8288347d9dd2'
FROM persons p, communities c
WHERE cm.person_id = p.id AND cm.community_id = c.id
  AND p.ename = '@9dafa031-4118-564c-bfa6-5917ddc8ab88'
  AND c.ename = '@de68861c-8ea9-55be-9258-2a8cc3057a60';
"
```
Expected: `UPDATE 1`.

- [ ] **Step 5: Re-run Step 3's SELECT to confirm both rows now show the expected ids**

Expected: both `membership_envelope_id` values populated, matching the ids above exactly.

No commit for this task — it's a one-time production data change, not a code change.

---

## Self-Review

**Spec coverage:**
- Ontology mint (`d300f6d4-...`) → Task 1. ✓
- Payload shape `{v, communityEname, joinedAt}` → Task 3. ✓
- ACL `[memberEname, communityEname]` → Task 4, `createMembershipEnvelope`. ✓
- `membership_envelope_id` column → Task 2. ✓
- Trigger 1 (`linkCommunity` backfill) → Task 5. ✓
- Trigger 2 (`createCommunityFromEname`, confirmed dead end) → no task, documented in spec's scope amendment; not repeated here since it requires no code. ✓
- Trigger 3 (`addMember`) → Task 6. ✓
- Trigger 4 (`removeMember`, blocking) → Task 7. ✓
- `unlinkCommunity` dead end → no task, confirmed in spec; no code changes needed since it already doesn't touch `membership_envelope_id`. ✓
- Backfill of the two manually-created envelopes → Task 8. ✓
- Asymmetric fire-and-forget-create / blocking-delete → Tasks 4/6 (fire-and-forget) vs Task 7 (blocking). ✓

**Placeholder scan:** no TBD/TODO; the two `<core-postgres-container>`/`<postgres-user>` placeholders in Task 8 are intentional — Step 1 exists specifically to resolve them live rather than trusting a possibly-stale value from memory, consistent with this session's own established practice.

**Type consistency:** `createMembershipEnvelope(membershipId: string)` and `deleteMembershipEnvelope(membershipId: string)` signatures are identical everywhere they're referenced (Tasks 4, 5, 6, 7).

**Scope check:** single feature, one plan. No decomposition needed.
