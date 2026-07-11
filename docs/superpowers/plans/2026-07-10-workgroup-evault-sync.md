# Workgroup eVault Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every CRUD on workgroups, roles, workgroup memberships, and role assignments in a linked community is reflected in that community's eVault as a `Workgroup` MetaEnvelope, with delete operations synchronous and failure-blocking (eVault is source of truth; Postgres is cache).

**Architecture:** one MetaEnvelope per `Workgroup` row (schemaId `7867abbd-420e-4dd9-bad6-8ad894c50b94`), with roles/members/role-assignments nested as JSON arrays inside its payload — never separate envelopes. A single orchestration function (`syncWorkgroupToEvault`) rebuilds the full payload from Postgres and creates/updates the envelope; it accepts optional exclusion params so delete paths can compute "state after removal" before the Postgres row actually disappears.

**Tech Stack:** TypeScript, TypeORM (Postgres, `synchronize: true` in dev — no migration files, entity column changes take effect on next server restart), Jest (`ts-jest`), existing `api/src/lib/evault-client.ts` GraphQL wrapper (axios-based).

## Global Constraints

- Workgroup ontology schemaId: `7867abbd-420e-4dd9-bad6-8ad894c50b94` (already used for the 12 manually-written De Woonwolk envelopes — do not mint a new one).
- Real De Woonwolk community id: `1ca7e1c6-df01-400d-8474-456abbc01b8b`, ename `@de68861c-8ea9-55be-9258-2a8cc3057a60`, eVault `http://64.227.64.55:4000`.
- Create/update sync: fire-and-forget, `.catch(err => logger.warn(err, ...))` — matches existing convention in `CommunityService.ts`/`MemberService.ts`.
- Delete sync: synchronous, NOT wrapped in try/catch that swallows — a thrown error must propagate to the controller and the Postgres delete must not run.
- No new column/table beyond `Workgroup.envelope_id` (nullable text) — roles/memberships/role-assignments are read-only inputs to the payload builder, never separately synced.
- This codebase has no DB-mocking or integration-test infra (`api/src/services/__tests__/AvailabilityService.test.ts` only tests a pure function with no DB). Only new pure, DB-free logic gets unit tests in this plan — DB-touching orchestration functions remain untested, consistent with all existing untested Service-layer eVault sync code (`CommunityService.syncCommunityToEvault`, `MemberService.syncMemberAdd`, etc.).
- Test command: `npm test` (root: `cd api && npm test`, runs `jest --runInBand`).

---

### Task 1: Ontology constant + `envelope_id` column

**Files:**
- Modify: `api/src/lib/w3ds/ontology.ts`
- Modify: `api/src/database/entities/Workgroup.ts`

**Interfaces:**
- Produces: `ONTOLOGIES.Workgroup` (string constant `'7867abbd-420e-4dd9-bad6-8ad894c50b94'`), `Workgroup.envelope_id: string | null` column — both consumed by Task 4.

No test for this task — it's a constant and a column declaration, nothing to assert against yet (covered indirectly once Task 4's payload/sync code uses them).

- [ ] **Step 1: Add the Workgroup ontology constant**

Edit `api/src/lib/w3ds/ontology.ts` — current full contents:

```ts
export const ONTOLOGIES = {
  Community: '550e8400-e29b-41d4-a716-446655440003', // Chat envelope — group identity (GroupManifest is retiring)
  User:      '550e8400-e29b-41d4-a716-446655440000', // User profile envelope
} as const
```

Replace with:

```ts
export const ONTOLOGIES = {
  Community: '550e8400-e29b-41d4-a716-446655440003', // Chat envelope — group identity (GroupManifest is retiring)
  User:      '550e8400-e29b-41d4-a716-446655440000', // User profile envelope
  Workgroup: '7867abbd-420e-4dd9-bad6-8ad894c50b94', // Custom ontology — not yet registered in the Ontology service
} as const
```

- [ ] **Step 2: Add `envelope_id` to the `Workgroup` entity**

Edit `api/src/database/entities/Workgroup.ts` — current full contents:

```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("workgroups")
export class Workgroup {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid" })
    community_id: string;

    @Column()
    name: string;

    @Column({ type: "text", nullable: true })
    description: string | null;

    @Column({ default: "#C4622D" })
    color: string;

    @Column({ type: "integer", default: 0 })
    sort_order: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
```

Replace with:

```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("workgroups")
export class Workgroup {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid" })
    community_id: string;

    @Column()
    name: string;

    @Column({ type: "text", nullable: true })
    description: string | null;

    @Column({ default: "#C4622D" })
    color: string;

    @Column({ type: "integer", default: 0 })
    sort_order: number;

    // MetaEnvelope ID of this workgroup's envelope in the community's eVault. Null until first synced.
    @Column({ type: "text", nullable: true })
    envelope_id: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd api && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add api/src/lib/w3ds/ontology.ts api/src/database/entities/Workgroup.ts
git commit -m "feat: add Workgroup ontology id and envelope_id column"
```

---

### Task 2: `removeEnvelope` helper in `evault-client.ts`

**Files:**
- Modify: `api/src/lib/evault-client.ts`

**Interfaces:**
- Consumes: `gqlRequest<T>(vaultEname, query, variables)` — existing private helper in this file (`api/src/lib/evault-client.ts:41-54`), already used by `createEnvelope`/`updateEnvelope`.
- Produces: `export async function removeEnvelope(vaultEname: string, envelopeId: string): Promise<void>` — throws on failure. Consumed by Task 5's `deleteWorkgroup`.

No unit test — this file has zero existing test coverage (all functions do live network calls via axios with no mock injected), consistent with the rest of `evault-client.ts`.

- [ ] **Step 1: Add the `GQL_REMOVE` query constant**

In `api/src/lib/evault-client.ts`, insert after `GQL_FIND_BY_ONTOLOGY` (currently ends at line 89, right before the `// ── Mutations ──...` comment is not present there — insert right before `export async function createEnvelope`, i.e. after line 89's closing backtick):

```ts
const GQL_REMOVE = `
  mutation RemoveMetaEnvelope($id: ID!) {
    removeMetaEnvelope(id: $id) {
      deletedId
      success
      errors { message code }
    }
  }
`
```

- [ ] **Step 2: Add the `removeEnvelope` export**

Insert after the existing `updateEnvelope` function (currently `api/src/lib/evault-client.ts:106-119`):

```ts
export async function removeEnvelope(vaultEname: string, envelopeId: string): Promise<void> {
  const data = await gqlRequest<{
    removeMetaEnvelope: { deletedId: string | null; success: boolean; errors?: Array<{ message?: string }> }
  }>(vaultEname, GQL_REMOVE, { id: envelopeId })
  if (!data.removeMetaEnvelope.success || data.removeMetaEnvelope.errors?.length) {
    throw new Error(data.removeMetaEnvelope.errors?.[0]?.message ?? 'removeEnvelope failed')
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd api && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add api/src/lib/evault-client.ts
git commit -m "feat: add removeEnvelope helper for eVault envelope deletion"
```

---

### Task 3: Pure `buildWorkgroupPayload` function + unit tests

**Files:**
- Create: `api/src/services/workgroupPayload.ts`
- Test: `api/src/services/__tests__/workgroupPayload.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface WorkgroupPayloadRole { id: string; name: string; color: string }
  export interface WorkgroupPayloadMember { participantId: string; roleIds: string[] }
  export interface WorkgroupPayloadInput {
    communityEname: string;
    name: string;
    description: string | null;
    color: string;
    createdAt: Date;
    updatedAt: Date;
    roles: WorkgroupPayloadRole[];
    members: WorkgroupPayloadMember[];
  }
  export interface WorkgroupEnvelopePayload {
    communityId: string;
    name: string;
    description?: string;
    color: string;
    createdAt: string;
    updatedAt: string;
    roles: WorkgroupPayloadRole[];
    members: WorkgroupPayloadMember[];
  }
  export function buildWorkgroupPayload(input: WorkgroupPayloadInput): WorkgroupEnvelopePayload
  ```
  Consumed by Task 4's `syncWorkgroupToEvault`.

- [ ] **Step 1: Write the failing tests**

Create `api/src/services/__tests__/workgroupPayload.test.ts`:

```ts
import { buildWorkgroupPayload } from "../workgroupPayload";

const BASE_INPUT = {
    communityEname: "@de68861c-8ea9-55be-9258-2a8cc3057a60",
    name: "Interiors wg",
    description: null as string | null,
    color: "#5D8C1E",
    createdAt: new Date("2026-07-10T08:35:27.573Z"),
    updatedAt: new Date("2026-07-10T09:20:00.000Z"),
    roles: [],
    members: [],
};

describe("buildWorkgroupPayload", () => {
    it("maps communityEname to communityId", () => {
        const result = buildWorkgroupPayload(BASE_INPUT);
        expect(result.communityId).toBe("@de68861c-8ea9-55be-9258-2a8cc3057a60");
    });

    it("omits description key when null", () => {
        const result = buildWorkgroupPayload(BASE_INPUT);
        expect(result.description).toBeUndefined();
        expect("description" in result).toBe(false);
    });

    it("includes description when present", () => {
        const result = buildWorkgroupPayload({ ...BASE_INPUT, description: "Handles interior design" });
        expect(result.description).toBe("Handles interior design");
    });

    it("formats createdAt/updatedAt as ISO strings", () => {
        const result = buildWorkgroupPayload(BASE_INPUT);
        expect(result.createdAt).toBe("2026-07-10T08:35:27.573Z");
        expect(result.updatedAt).toBe("2026-07-10T09:20:00.000Z");
    });

    it("maps roles 1:1", () => {
        const result = buildWorkgroupPayload({
            ...BASE_INPUT,
            roles: [
                { id: "role-1", name: "Boekhouder", color: "#EAB308" },
                { id: "role-2", name: "Facilitator", color: "#C87DD6" },
            ],
        });
        expect(result.roles).toEqual([
            { id: "role-1", name: "Boekhouder", color: "#EAB308" },
            { id: "role-2", name: "Facilitator", color: "#C87DD6" },
        ]);
    });

    it("maps members 1:1 with their roleIds", () => {
        const result = buildWorkgroupPayload({
            ...BASE_INPUT,
            members: [{ participantId: "meta-env-1", roleIds: ["role-1"] }],
        });
        expect(result.members).toEqual([{ participantId: "meta-env-1", roleIds: ["role-1"] }]);
    });

    it("returns empty arrays for roles/members when none given", () => {
        const result = buildWorkgroupPayload(BASE_INPUT);
        expect(result.roles).toEqual([]);
        expect(result.members).toEqual([]);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && npx jest workgroupPayload -v`
Expected: FAIL — `Cannot find module '../workgroupPayload'`.

- [ ] **Step 3: Write the implementation**

Create `api/src/services/workgroupPayload.ts`:

```ts
export interface WorkgroupPayloadRole {
    id: string;
    name: string;
    color: string;
}

export interface WorkgroupPayloadMember {
    participantId: string;
    roleIds: string[];
}

export interface WorkgroupPayloadInput {
    communityEname: string;
    name: string;
    description: string | null;
    color: string;
    createdAt: Date;
    updatedAt: Date;
    roles: WorkgroupPayloadRole[];
    members: WorkgroupPayloadMember[];
}

export interface WorkgroupEnvelopePayload {
    communityId: string;
    name: string;
    description?: string;
    color: string;
    createdAt: string;
    updatedAt: string;
    roles: WorkgroupPayloadRole[];
    members: WorkgroupPayloadMember[];
}

export function buildWorkgroupPayload(input: WorkgroupPayloadInput): WorkgroupEnvelopePayload {
    const payload: WorkgroupEnvelopePayload = {
        communityId: input.communityEname,
        name: input.name,
        color: input.color,
        createdAt: input.createdAt.toISOString(),
        updatedAt: input.updatedAt.toISOString(),
        roles: input.roles,
        members: input.members,
    };
    if (input.description) payload.description = input.description;
    return payload;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd api && npx jest workgroupPayload -v`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/workgroupPayload.ts api/src/services/__tests__/workgroupPayload.test.ts
git commit -m "feat: add pure Workgroup eVault payload builder"
```

---

### Task 4: `syncWorkgroupToEvault` orchestration + wire into create/update paths

**Files:**
- Modify: `api/src/services/WorkgroupService.ts`

**Interfaces:**
- Consumes: `buildWorkgroupPayload` + types from `../services/workgroupPayload` (Task 3); `createEnvelope`, `updateEnvelope`, `getUserMetaEnvelopeId` from `../lib/evault-client` (existing + Task 2); `ONTOLOGIES` from `../lib/w3ds/ontology` (Task 1); `Workgroup.envelope_id` (Task 1).
- Produces: `async function syncWorkgroupToEvault(workgroupId: string, exclude?: SyncExclusions): Promise<void>` (not exported — internal to this file) and `interface SyncExclusions { excludeRoleId?: string; excludeMembershipId?: string; excludeRoleAssignment?: { membershipId: string; roleId: string } }` — the `exclude` param is unused by this task (always called with no second argument) but consumed by Task 5's delete paths.

No new test file — this function does live DB reads (`AppDataSource.getRepository`), matching the untested-DB-orchestration convention stated in Global Constraints.

- [ ] **Step 1: Add imports**

In `api/src/services/WorkgroupService.ts`, replace the current import block (lines 1-5):

```ts
import { AppDataSource } from "../database/data-source";
import { Workgroup } from "../database/entities/Workgroup";
import { Role } from "../database/entities/Role";
import { WorkgroupMembership } from "../database/entities/WorkgroupMembership";
import { WorkgroupMemberRole } from "../database/entities/WorkgroupMemberRole";
```

with:

```ts
import { In } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Workgroup } from "../database/entities/Workgroup";
import { Role } from "../database/entities/Role";
import { WorkgroupMembership } from "../database/entities/WorkgroupMembership";
import { WorkgroupMemberRole } from "../database/entities/WorkgroupMemberRole";
import { Community } from "../database/entities/Community";
import { Person } from "../database/entities/Person";
import { createEnvelope, updateEnvelope, getUserMetaEnvelopeId } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { buildWorkgroupPayload } from "./workgroupPayload";
import { logger } from "../lib/logger";
```

- [ ] **Step 2: Add repo helpers and the sync orchestration function**

After the existing repo helper lines (currently lines 7-10: `wgRepo`, `roleRepo`, `wgmRepo`, `wmrRepo`), add:

```ts
const communityRepo = () => AppDataSource.getRepository(Community);
const personRepo = () => AppDataSource.getRepository(Person);

interface SyncExclusions {
    excludeRoleId?: string;
    excludeMembershipId?: string;
    excludeRoleAssignment?: { membershipId: string; roleId: string };
}

async function syncWorkgroupToEvault(workgroupId: string, exclude: SyncExclusions = {}): Promise<void> {
    const wg = await wgRepo().findOne({ where: { id: workgroupId } });
    if (!wg) return;
    const community = await communityRepo().findOne({ where: { id: wg.community_id } });
    if (!community || community.provisioning_status !== "linked" || !community.ename) return;

    let roles = await roleRepo().find({ where: { workgroup_id: workgroupId } });
    if (exclude.excludeRoleId) roles = roles.filter((r) => r.id !== exclude.excludeRoleId);

    let memberships = await wgmRepo().find({ where: { workgroup_id: workgroupId } });
    if (exclude.excludeMembershipId) memberships = memberships.filter((m) => m.id !== exclude.excludeMembershipId);

    const wgmIds = memberships.map((m) => m.id);
    let memberRoles = wgmIds.length
        ? await wmrRepo().find({ where: { workgroup_membership_id: In(wgmIds) } })
        : [];
    if (exclude.excludeRoleAssignment) {
        const { membershipId, roleId } = exclude.excludeRoleAssignment;
        memberRoles = memberRoles.filter(
            (r) => !(r.workgroup_membership_id === membershipId && r.role_id === roleId)
        );
    }

    const members: { participantId: string; roleIds: string[] }[] = [];
    for (const m of memberships) {
        const person = await personRepo().findOne({ where: { id: m.person_id } });
        if (!person?.ename) continue;
        let metaId = person.meta_envelope_id;
        if (!metaId) {
            metaId = await getUserMetaEnvelopeId(person.ename);
            if (metaId) await personRepo().update(person.id, { meta_envelope_id: metaId });
        }
        if (!metaId) continue;
        const roleIds = memberRoles.filter((r) => r.workgroup_membership_id === m.id).map((r) => r.role_id);
        members.push({ participantId: metaId, roleIds });
    }

    const payload = buildWorkgroupPayload({
        communityEname: community.ename,
        name: wg.name,
        description: wg.description,
        color: wg.color,
        createdAt: wg.created_at,
        updatedAt: wg.updated_at,
        roles: roles.map((r) => ({ id: r.id, name: r.name, color: r.color })),
        members,
    });

    if (wg.envelope_id) {
        await updateEnvelope({
            vaultEname: community.ename,
            envelopeId: wg.envelope_id,
            ontology: ONTOLOGIES.Workgroup,
            payload,
            acl: ["*"],
        });
    } else {
        const envelopeId = await createEnvelope({
            vaultEname: community.ename,
            ontology: ONTOLOGIES.Workgroup,
            payload,
            acl: ["*"],
        });
        await wgRepo().update(wg.id, { envelope_id: envelopeId });
    }
}
```

- [ ] **Step 3: Wire fire-and-forget sync into `createWorkgroup`**

Current function (`api/src/services/WorkgroupService.ts:16-19`):

```ts
export async function createWorkgroup(communityId: string, data: { name: string; description?: string; color?: string }): Promise<Workgroup> {
    const maxOrder = (await wgRepo().maximum("sort_order", { community_id: communityId }) as number | null) ?? -1;
    return wgRepo().save(wgRepo().create({ community_id: communityId, name: data.name, description: data.description ?? null, color: data.color ?? "#C4622D", sort_order: maxOrder + 1 }));
}
```

Replace with:

```ts
export async function createWorkgroup(communityId: string, data: { name: string; description?: string; color?: string }): Promise<Workgroup> {
    const maxOrder = (await wgRepo().maximum("sort_order", { community_id: communityId }) as number | null) ?? -1;
    const saved = await wgRepo().save(wgRepo().create({ community_id: communityId, name: data.name, description: data.description ?? null, color: data.color ?? "#C4622D", sort_order: maxOrder + 1 }));
    syncWorkgroupToEvault(saved.id).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", saved.id));
    return saved;
}
```

- [ ] **Step 4: Wire fire-and-forget sync into `updateWorkgroup`, `createRole`, `updateRole`, `addWorkgroupMember`, `assignRole`**

Current functions (`api/src/services/WorkgroupService.ts:21-25, 31-34, 36-40, 46-48, 63-65`):

```ts
export async function updateWorkgroup(id: string, communityId: string, data: Partial<Pick<Workgroup, "name" | "description" | "color" | "sort_order">>): Promise<Workgroup> {
    const wg = await wgRepo().findOneOrFail({ where: { id, community_id: communityId } });
    Object.assign(wg, data);
    return wgRepo().save(wg);
}
```
```ts
export async function createRole(workgroupId: string, data: { name: string; description?: string; color?: string }): Promise<Role> {
    const maxOrder = (await roleRepo().maximum("sort_order", { workgroup_id: workgroupId }) as number | null) ?? -1;
    return roleRepo().save(roleRepo().create({ workgroup_id: workgroupId, name: data.name, description: data.description ?? null, color: data.color ?? "#C4622D", sort_order: maxOrder + 1 }));
}

export async function updateRole(id: string, workgroupId: string, data: Partial<Pick<Role, "name" | "description" | "color" | "sort_order">>): Promise<Role> {
    const role = await roleRepo().findOneOrFail({ where: { id, workgroup_id: workgroupId } });
    Object.assign(role, data);
    return roleRepo().save(role);
}
```
```ts
export async function addWorkgroupMember(workgroupId: string, personId: string): Promise<WorkgroupMembership> {
    return wgmRepo().save(wgmRepo().create({ workgroup_id: workgroupId, person_id: personId }));
}
```
```ts
export async function assignRole(workgroupMembershipId: string, roleId: string): Promise<WorkgroupMemberRole> {
    return wmrRepo().save(wmrRepo().create({ workgroup_membership_id: workgroupMembershipId, role_id: roleId }));
}
```

Replace all four with:

```ts
export async function updateWorkgroup(id: string, communityId: string, data: Partial<Pick<Workgroup, "name" | "description" | "color" | "sort_order">>): Promise<Workgroup> {
    const wg = await wgRepo().findOneOrFail({ where: { id, community_id: communityId } });
    Object.assign(wg, data);
    const saved = await wgRepo().save(wg);
    syncWorkgroupToEvault(saved.id).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", saved.id));
    return saved;
}
```
```ts
export async function createRole(workgroupId: string, data: { name: string; description?: string; color?: string }): Promise<Role> {
    const maxOrder = (await roleRepo().maximum("sort_order", { workgroup_id: workgroupId }) as number | null) ?? -1;
    const saved = await roleRepo().save(roleRepo().create({ workgroup_id: workgroupId, name: data.name, description: data.description ?? null, color: data.color ?? "#C4622D", sort_order: maxOrder + 1 }));
    syncWorkgroupToEvault(workgroupId).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", workgroupId));
    return saved;
}

export async function updateRole(id: string, workgroupId: string, data: Partial<Pick<Role, "name" | "description" | "color" | "sort_order">>): Promise<Role> {
    const role = await roleRepo().findOneOrFail({ where: { id, workgroup_id: workgroupId } });
    Object.assign(role, data);
    const saved = await roleRepo().save(role);
    syncWorkgroupToEvault(workgroupId).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", workgroupId));
    return saved;
}
```
```ts
export async function addWorkgroupMember(workgroupId: string, personId: string): Promise<WorkgroupMembership> {
    const saved = await wgmRepo().save(wgmRepo().create({ workgroup_id: workgroupId, person_id: personId }));
    syncWorkgroupToEvault(workgroupId).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", workgroupId));
    return saved;
}
```
```ts
export async function assignRole(workgroupMembershipId: string, roleId: string): Promise<WorkgroupMemberRole> {
    const saved = await wmrRepo().save(wmrRepo().create({ workgroup_membership_id: workgroupMembershipId, role_id: roleId }));
    const wm = await wgmRepo().findOneOrFail({ where: { id: workgroupMembershipId } });
    syncWorkgroupToEvault(wm.workgroup_id).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", wm.workgroup_id));
    return saved;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd api && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run full test suite**

Run: `cd api && npm test`
Expected: all existing tests still pass, plus Task 3's 7 new tests (this task adds no new tests of its own — see Global Constraints on untested DB orchestration).

- [ ] **Step 7: Commit**

```bash
git add api/src/services/WorkgroupService.ts
git commit -m "feat: sync workgroup/role/member creates and updates to eVault"
```

---

### Task 5: Synchronous, failure-blocking sync on delete paths

**Files:**
- Modify: `api/src/services/WorkgroupService.ts`

**Interfaces:**
- Consumes: `syncWorkgroupToEvault(workgroupId, exclude)` and `SyncExclusions` (Task 4); `removeEnvelope` from `../lib/evault-client` (Task 2).
- Produces: no new exports — `deleteRole`, `removeWorkgroupMember`, `unassignRole`, `deleteWorkgroup` keep their existing signatures, but now throw (propagating to the controller's `next(err)` → Express default 500) if the eVault call fails, and skip the Postgres delete in that case.

No new test file — same untested-DB-orchestration rationale as Task 4.

- [ ] **Step 1: Add `removeEnvelope` to the evault-client import**

In `api/src/services/WorkgroupService.ts`, change the import added in Task 4 Step 1:

```ts
import { createEnvelope, updateEnvelope, getUserMetaEnvelopeId } from "../lib/evault-client";
```

to:

```ts
import { createEnvelope, updateEnvelope, removeEnvelope, getUserMetaEnvelopeId } from "../lib/evault-client";
```

- [ ] **Step 2: Make `deleteWorkgroup` remove the eVault envelope before the Postgres delete**

Current function (`api/src/services/WorkgroupService.ts:27-29`):

```ts
export async function deleteWorkgroup(id: string, communityId: string): Promise<void> {
    await wgRepo().delete({ id, community_id: communityId });
}
```

Replace with:

```ts
export async function deleteWorkgroup(id: string, communityId: string): Promise<void> {
    const wg = await wgRepo().findOneOrFail({ where: { id, community_id: communityId } });
    if (wg.envelope_id) {
        const community = await communityRepo().findOne({ where: { id: communityId } });
        if (community?.ename) await removeEnvelope(community.ename, wg.envelope_id);
    }
    await wgRepo().delete({ id, community_id: communityId });
}
```

- [ ] **Step 3: Make `deleteRole` sync the exclusion before deleting**

Current function (`api/src/services/WorkgroupService.ts:42-44`):

```ts
export async function deleteRole(id: string, workgroupId: string): Promise<void> {
    await roleRepo().delete({ id, workgroup_id: workgroupId });
}
```

Replace with:

```ts
export async function deleteRole(id: string, workgroupId: string): Promise<void> {
    await syncWorkgroupToEvault(workgroupId, { excludeRoleId: id });
    await roleRepo().delete({ id, workgroup_id: workgroupId });
}
```

- [ ] **Step 4: Make `removeWorkgroupMember` sync the exclusion before deleting**

Current function (`api/src/services/WorkgroupService.ts:56-61`):

```ts
export async function removeWorkgroupMember(workgroupId: string, personId: string): Promise<void> {
    const wm = await wgmRepo().findOne({ where: { workgroup_id: workgroupId, person_id: personId } });
    if (!wm) return;
    await wmrRepo().delete({ workgroup_membership_id: wm.id });
    await wgmRepo().delete(wm.id);
}
```

Replace with:

```ts
export async function removeWorkgroupMember(workgroupId: string, personId: string): Promise<void> {
    const wm = await wgmRepo().findOne({ where: { workgroup_id: workgroupId, person_id: personId } });
    if (!wm) return;
    await syncWorkgroupToEvault(workgroupId, { excludeMembershipId: wm.id });
    await wmrRepo().delete({ workgroup_membership_id: wm.id });
    await wgmRepo().delete(wm.id);
}
```

- [ ] **Step 5: Make `unassignRole` sync the exclusion before deleting**

Current function (`api/src/services/WorkgroupService.ts:67-69`):

```ts
export async function unassignRole(workgroupMembershipId: string, roleId: string): Promise<void> {
    await wmrRepo().delete({ workgroup_membership_id: workgroupMembershipId, role_id: roleId });
}
```

Replace with:

```ts
export async function unassignRole(workgroupMembershipId: string, roleId: string): Promise<void> {
    const wm = await wgmRepo().findOneOrFail({ where: { id: workgroupMembershipId } });
    await syncWorkgroupToEvault(wm.workgroup_id, { excludeRoleAssignment: { membershipId: workgroupMembershipId, roleId } });
    await wmrRepo().delete({ workgroup_membership_id: workgroupMembershipId, role_id: roleId });
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd api && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Run full test suite**

Run: `cd api && npm test`
Expected: all tests still pass (no new tests added this task).

- [ ] **Step 8: Commit**

```bash
git add api/src/services/WorkgroupService.ts
git commit -m "feat: make workgroup/role/member deletes remove eVault state synchronously"
```

---

### Task 6: Backfill `envelope_id` for the 12 already-written De Woonwolk workgroups

**Files:** none (operational data task against the real local CORE Postgres — `localhost:5436`, db `core`, user/pass `core`/`core`). No code, no commit.

**Interfaces:** none — this task only sets `Workgroup.envelope_id` on 12 existing rows so Task 4/5's sync code updates the correct envelope instead of creating a duplicate the first time any of them changes.

This must run AFTER Task 1 (the `envelope_id` column must exist) and can run any time after that, independent of Tasks 2-5.

- [ ] **Step 1: Verify the 12 rows currently have no `envelope_id`**

Run:

```bash
PGPASSWORD=core psql -h localhost -p 5436 -U core -d core -t -A -c "
select count(*) from workgroups
where community_id = '1ca7e1c6-df01-400d-8474-456abbc01b8b' and envelope_id is not null;
"
```

Expected: `0` (Task 1's migration only added the column, nothing has run Task 4's sync yet).

- [ ] **Step 2: Run the backfill UPDATE**

Run:

```bash
PGPASSWORD=core psql -h localhost -p 5436 -U core -d core -c "
update workgroups set envelope_id = v.envelope_id
from (values
  ('Activiteiten',      '18fc4e60-cd74-59be-ac77-8220142e1b96'),
  ('Architectuur',      '84597456-ab25-5aed-a186-dcf2c20743df'),
  ('Bestuur',           'a44c9216-5b3f-5790-aacf-73949ee7932f'),
  ('Care',              '285d1d72-d5cf-5c5a-9848-c3801168338c'),
  ('Communicatie',      '673626e1-d507-5bdb-8eb9-3bd6f757c0cb'),
  ('Coordinatie',       'f7d66953-8818-5f44-8263-ac91a47dfc49'),
  ('Crowdlending',      '85b9f3ed-a8ab-5bce-bb64-56c73aca60d4'),
  ('Financieel',        '85582657-0938-5bab-860a-fc55f33459fd'),
  ('Interiors wg',      'ccabea81-4666-5be3-9cae-5b9db05924c4'),
  ('Subsidies',         '2935a395-0221-526f-a817-6a9ff1ee969d'),
  ('Toe-/uittreding',   '326f4a97-cffa-5f4d-a1f7-931971e7f5f2'),
  ('Verdeling wg',      '8283bba4-0ac7-5f3c-a67d-ac95703195b9')
) as v(name, envelope_id)
where workgroups.community_id = '1ca7e1c6-df01-400d-8474-456abbc01b8b'
  and workgroups.name = v.name;
"
```

Expected output: `UPDATE 12`.

- [ ] **Step 3: Verify all 12 rows now have the correct `envelope_id`**

Run:

```bash
PGPASSWORD=core psql -h localhost -p 5436 -U core -d core -t -A -F'|' -c "
select name, envelope_id from workgroups
where community_id = '1ca7e1c6-df01-400d-8474-456abbc01b8b'
order by name;
"
```

Expected: all 12 rows listed, each with a non-null `envelope_id` matching the table in Step 2.

---

## Self-Review

**Spec coverage:**
- Data model change (`envelope_id` column) → Task 1. ✅
- `removeEnvelope` helper → Task 2. ✅
- Sync payload construction (schema-shaped) → Task 3. ✅
- Create/update triggers (fire-and-forget) → Task 4. ✅
- Delete triggers (synchronous, blocking) → Task 5. ✅
- Backfill of the 12 existing envelope IDs → Task 6. ✅
- "DB is cache" error-handling asymmetry (loud on delete, swallowed on create/update) → encoded directly in Tasks 4 and 5's code (no `.catch()` on the delete paths' `syncWorkgroupToEvault`/`removeEnvelope` calls).

**Placeholder scan:** no TBD/TODO; every step has literal code or literal SQL.

**Type consistency:** `SyncExclusions` interface (Task 4) is used identically in Task 5's three call sites (`excludeRoleId`, `excludeMembershipId`, `excludeRoleAssignment: { membershipId, roleId }`) — matches. `buildWorkgroupPayload`'s `WorkgroupPayloadInput` (Task 3) field names (`communityEname`, `description`, `roles`, `members`) match exactly what Task 4's `syncWorkgroupToEvault` passes in.

Out of scope (per design doc, unchanged): registering the schemaId in the Ontology service; nested workgroups (`parentId`).
