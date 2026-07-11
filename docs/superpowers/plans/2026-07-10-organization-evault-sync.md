# Organization eVault Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every community gets one `Organization` MetaEnvelope in its eVault holding legal/juridical info, branding, board members, configurable membership types, and the member roster — replacing the retired Chat-envelope conflation and the `is_aspirant`/`is_active_partner` boolean membership model.

**Architecture:** New `OrganizationMembershipType` entity (per-community configurable list). `Community` gains legal/branding/board-member columns plus `organization_envelope_id`. `CommunityMembership` gains `membership_type_id`, drops the two booleans. A new `OrganizationService.ts` exports `syncOrganizationToEvault(communityId, exclude?)` — rebuilds the whole payload from Postgres every time (never diffed) and writes it via `createEnvelope`/`updateEnvelope`, mirroring the already-shipped `WorkgroupService.ts` pattern. The old Chat-envelope sync (`syncCommunityToEvault`, `addParticipantToEnvelope`, `removeParticipantFromEnvelope`, `syncFromChatWebhook`) is deleted outright, not merely stopped.

**Tech Stack:** Node.js + Express + TypeORM + PostgreSQL (dev `synchronize: true`, no migrations system — schema changes are additive-only until a final cleanup task drops legacy columns). React 19 frontend. eVault via `api/src/lib/evault-client.ts`'s GraphQL wrapper.

## Global Constraints

- **DB is cache, eVault is source of truth.** Create/update sync is fire-and-forget: `.catch((err) => logger.warn(err, ...))`, self-heals because the payload is rebuilt in full from Postgres on every call, never diffed or merged. Delete sync is synchronous and blocking: awaited before the local Postgres delete runs; a thrown error propagates to the controller (which returns 500) and the Postgres row is never removed.
- **membershipType removal pre-check:** before any sync or delete, check whether any `CommunityMembership.membership_type_id` still references the type being deleted. If so, reject with 409 naming the affected member count. Do not delete, do not sync. This is independent of and precedes the sync-failure error handling.
- **No migrations system exists in this repo** (`data-source.ts` has `synchronize: !isProduction`, no `scripts/` or `*migration*` files). All schema changes in this plan are additive only until Task 12, which drops the three legacy columns (`is_aspirant`, `is_active_partner`, `community_envelope_id`) only after every call site has been migrated off them — dropping earlier would break compilation on files this plan hasn't touched yet.
- **`resolveW3id` is unchanged.** Its ownership check queries `findEnvelopesByOntology(normalized, ONTOLOGIES.Community)` live against eVault — independent of the Postgres `community_envelope_id` column. Only downstream consumers (`linkCommunity`, `createCommunityFromEname`) change.
- **TypeORM `type: "date"` columns return plain `'YYYY-MM-DD'` strings at runtime, not `Date` objects**, despite being typed `Date | null` in the entity (confirmed via `MembersTab.jsx`'s existing `m.joinedAt.slice(0, 10)` call, which only works on a string). `Community.founding_date` is such a column. `organizationPayload.ts`'s `foundingDate` field must be typed `string | null`, and `OrganizationService.ts` must pass it through as `community.founding_date ? String(community.founding_date) : null` — never `.toISOString()`.
- **`{ ...payload }` spread required at `createEnvelope`/`updateEnvelope` call sites** — TypeScript needs the spread-into-object-literal to satisfy the `Record<string, unknown>` parameter type when passing a named payload interface. `WorkgroupService.ts` already does this at lines 83/91; reuse verbatim.
- **Scope amendment (binding):** dropping `is_aspirant`/`is_active_partner` requires migrating all 11 call sites in the same plan — `MemberService.ts`, `MemberController.ts`, `AuthController.ts`, `CommunityService.ts`, `CommunityMembership.ts`, and 7 frontend files: `CardGrid.jsx`, `PersonNode.jsx`, `useGraphData.js`, `UserContext.jsx`, `MembersTab.jsx`, `PersonModal.jsx`, `InfoPanel.jsx`. None may be deferred.
- **Known, accepted tradeoff:** retiring `community_envelope_id` drops CORE's inbound cross-platform Group-ontology sync (`WebhookController.ts`'s `syncFromChatWebhook` dispatch). No other platform depends on it today. Not revisited by this plan.
- **Out of scope:** registering the `Organization` schemaId with the real W3DS Ontology service; UI screens for editing legalInfo/branding/boardMembers beyond the minimal admin form additions in Task 9/11; cleaning up the orphaned legacy Chat MetaEnvelope in the real eVault; statuten version history.

---

### Task 1: `OrganizationMembershipType` entity + additive columns on `Community`/`CommunityMembership`

**Files:**
- Create: `api/src/database/entities/OrganizationMembershipType.ts`
- Modify: `api/src/database/entities/Community.ts`
- Modify: `api/src/database/entities/CommunityMembership.ts`
- Modify: `api/src/database/data-source.ts`

**Interfaces:**
- Produces: `OrganizationMembershipType` entity with columns `id, community_id, name, description, emoji, sort_order, created_at, updated_at`. `Community.organization_envelope_id`, `.legal_form`, `.official_name`, `.kvk_number`, `.rsin`, `.iban`, `.registered_address`, `.founding_date` (type `Date | null` per entity convention, runtime string per Global Constraints), `.statuten_file_uri`, `.board_members` (`{ eName: string; role: string }[]`). `CommunityMembership.membership_type_id: string | null`.
- Consumes: nothing new (pure schema addition).

- [ ] **Step 1: Create the `OrganizationMembershipType` entity**

```ts
// api/src/database/entities/OrganizationMembershipType.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("organization_membership_types")
export class OrganizationMembershipType {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid" })
    community_id: string;

    @Column()
    name: string;

    @Column({ type: "text", nullable: true })
    description: string | null;

    @Column({ type: "text", nullable: true })
    emoji: string | null;

    @Column({ default: 0 })
    sort_order: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
```

- [ ] **Step 2: Add new columns to `Community.ts` (additive — do not touch `community_envelope_id` yet)**

In `api/src/database/entities/Community.ts`, add these columns after `evault_uri` and before the existing `community_envelope_id` comment/column (which stays untouched until Task 12):

```ts
    @Column({ type: "text", nullable: true })
    organization_envelope_id: string | null;

    @Column({ type: "text", nullable: true })
    legal_form: string | null;

    @Column({ type: "text", nullable: true })
    official_name: string | null;

    @Column({ type: "text", nullable: true })
    kvk_number: string | null;

    @Column({ type: "text", nullable: true })
    rsin: string | null;

    @Column({ type: "text", nullable: true })
    iban: string | null;

    @Column({ type: "text", nullable: true })
    registered_address: string | null;

    @Column({ type: "date", nullable: true })
    founding_date: Date | null;

    @Column({ type: "text", nullable: true })
    statuten_file_uri: string | null;

    @Column({ type: "jsonb", default: () => "'[]'" })
    board_members: { eName: string; role: string }[];
```

- [ ] **Step 3: Add `membership_type_id` to `CommunityMembership.ts` (additive — leave `is_aspirant`/`is_active_partner` untouched)**

In `api/src/database/entities/CommunityMembership.ts`, add after `is_active_partner`:

```ts
    @Column({ type: "uuid", nullable: true })
    membership_type_id: string | null;
```

- [ ] **Step 4: Register the new entity in `data-source.ts`**

In `api/src/database/data-source.ts`, add the import:

```ts
import { OrganizationMembershipType } from "./entities/OrganizationMembershipType";
```

And add `OrganizationMembershipType` to the `entities` array:

```ts
    entities: [
        Person, Community, CommunityMembership,
        AvailabilityType, AvailabilityLog,
        Workgroup, Role, WorkgroupMembership, WorkgroupMemberRole,
        OrganizationMembershipType,
    ],
```

- [ ] **Step 5: Verify — typecheck and schema sync**

Run from `api/`:
```bash
npx tsc --noEmit
```
Expected: no errors.

Start the dev API (`npm run dev` from `api/`, or however it's normally started) briefly to let TypeORM's `synchronize: true` create the new table and columns against the dev DB, then stop it. Confirm via:
```bash
PGPASSWORD=core psql -h localhost -p 5436 -U core -d core -c "\d organization_membership_types" -c "\d communities" -c "\d community_memberships"
```
Expected: `organization_membership_types` table exists with the 7 columns from Step 1; `communities` has the 9 new columns from Step 2 alongside the untouched `community_envelope_id`; `community_memberships` has `membership_type_id` alongside the untouched `is_aspirant`/`is_active_partner`.

- [ ] **Step 6: Commit**

```bash
git add api/src/database/entities/OrganizationMembershipType.ts api/src/database/entities/Community.ts api/src/database/entities/CommunityMembership.ts api/src/database/data-source.ts
git commit -m "feat: add OrganizationMembershipType entity and additive Organization columns"
```

---

### Task 2: Register the `Organization` ontology

**Files:**
- Modify: `api/src/lib/w3ds/ontology.ts`

**Interfaces:**
- Produces: `ONTOLOGIES.Organization` string constant.
- Consumes: nothing new.

- [ ] **Step 1: Add the `Organization` entry**

```ts
// api/src/lib/w3ds/ontology.ts
export const ONTOLOGIES = {
  Community: '550e8400-e29b-41d4-a716-446655440003', // Chat envelope — group identity (GroupManifest is retiring)
  User:      '550e8400-e29b-41d4-a716-446655440000', // User profile envelope
  Workgroup: '7867abbd-420e-4dd9-bad6-8ad894c50b94', // Custom ontology — not yet registered in the Ontology service
  Organization: 'ad226473-640e-4d16-90e5-2fd96f261554', // Custom ontology — not yet registered in the Ontology service
} as const
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add api/src/lib/w3ds/ontology.ts
git commit -m "feat: register Organization ontology constant"
```

---

### Task 3: One-off data backfill (raw SQL, not a checked-in script)

**Files:** none (this task runs SQL directly against the dev database via `psql`; no file is created or modified, matching the precedent set by the Workgroup feature's own undocumented backfill per `.superpowers/sdd/progress.md`'s "Task 6: backfill UPDATE 12").

**Interfaces:**
- Consumes: `organization_membership_types` table and `community_memberships.membership_type_id` column from Task 1.
- Produces: every existing community gets 3 seeded membership types (Aspirant, Full member, Active partner); every existing `community_memberships` row gets a non-null `membership_type_id` matching its current `is_aspirant`/`is_active_partner` booleans.

- [ ] **Step 1: Seed default membership types per community**

Run against the dev DB:
```bash
PGPASSWORD=core psql -h localhost -p 5436 -U core -d core <<'SQL'
INSERT INTO organization_membership_types (id, community_id, name, description, emoji, sort_order)
SELECT gen_random_uuid(), id, 'Aspirant', NULL, '🌱', 0 FROM communities;

INSERT INTO organization_membership_types (id, community_id, name, description, emoji, sort_order)
SELECT gen_random_uuid(), id, 'Full member', NULL, '🏡', 1 FROM communities;

INSERT INTO organization_membership_types (id, community_id, name, description, emoji, sort_order)
SELECT gen_random_uuid(), id, 'Active partner', NULL, '⭐', 2 FROM communities;
SQL
```
Expected: `INSERT 0 <N>` three times, where `<N>` is the current row count of `communities`.

- [ ] **Step 2: Backfill `membership_type_id` from the booleans**

```bash
PGPASSWORD=core psql -h localhost -p 5436 -U core -d core <<'SQL'
UPDATE community_memberships cm
SET membership_type_id = t.id
FROM organization_membership_types t
WHERE t.community_id = cm.community_id
  AND t.name = 'Aspirant'
  AND cm.is_aspirant = true;

UPDATE community_memberships cm
SET membership_type_id = t.id
FROM organization_membership_types t
WHERE t.community_id = cm.community_id
  AND t.name = 'Active partner'
  AND cm.is_active_partner = true
  AND cm.membership_type_id IS NULL;

UPDATE community_memberships cm
SET membership_type_id = t.id
FROM organization_membership_types t
WHERE t.community_id = cm.community_id
  AND t.name = 'Full member'
  AND cm.membership_type_id IS NULL;
SQL
```
Expected: three `UPDATE <N>` results. The third statement's `<N>` should equal the count of memberships where both booleans were false (everyone not already assigned by the first two statements).

- [ ] **Step 3: Verify no row was missed**

```bash
PGPASSWORD=core psql -h localhost -p 5436 -U core -d core -c "SELECT count(*) FROM community_memberships WHERE membership_type_id IS NULL;"
```
Expected: `0`.

No commit for this task — it changes only the dev database's data, not any tracked file.

---

### Task 4: `organizationPayload.ts` builder + test

**Files:**
- Create: `api/src/services/organizationPayload.ts`
- Create: `api/src/services/__tests__/organizationPayload.test.ts`

**Interfaces:**
- Produces: `buildOrganizationPayload(input: OrganizationPayloadInput): OrganizationEnvelopePayload`, and the exported types `OrganizationPayloadInput`, `OrganizationEnvelopePayload`, `OrganizationPayloadMembershipType`, `OrganizationPayloadMember`, `OrganizationPayloadBoardMember`.
- Consumes: nothing (pure function, no DB/eVault access).

- [ ] **Step 1: Write the failing tests**

```ts
// api/src/services/__tests__/organizationPayload.test.ts
import { buildOrganizationPayload } from "../organizationPayload";

const BASE_INPUT = {
    communityEname: "@de68861c-8ea9-55be-9258-2a8cc3057a60",
    legalForm: null as string | null,
    officialName: null as string | null,
    kvkNumber: null as string | null,
    rsin: null as string | null,
    iban: null as string | null,
    registeredAddress: null as string | null,
    foundingDate: null as string | null,
    statutenFileUri: null as string | null,
    boardMembers: [],
    logoUrl: null as string | null,
    primaryColor: "#C4622D",
    titleFont: "Playfair Display",
    membershipTypes: [],
    members: [],
};

describe("buildOrganizationPayload", () => {
    it("nests legalInfo fields under legalInfo, omitting null ones", () => {
        const result = buildOrganizationPayload(BASE_INPUT);
        expect(result.legalInfo).toEqual({ boardMembers: [] });
    });

    it("includes legalInfo fields when present, including foundingDate as a plain string", () => {
        const result = buildOrganizationPayload({
            ...BASE_INPUT,
            legalForm: "cooperative",
            officialName: "Coöperatie De Woonwolk U.A.",
            kvkNumber: "12345678",
            rsin: "123456789",
            iban: "NL00BANK0123456789",
            registeredAddress: "Voorbeeldstraat 1, 1234 AB Amsterdam",
            foundingDate: "2020-01-15",
            statutenFileUri: "w3ds://file?id=@de68861c-8ea9-55be-9258-2a8cc3057a60/env-1",
        });
        expect(result.legalInfo).toEqual({
            legalForm: "cooperative",
            officialName: "Coöperatie De Woonwolk U.A.",
            kvkNumber: "12345678",
            rsin: "123456789",
            iban: "NL00BANK0123456789",
            registeredAddress: "Voorbeeldstraat 1, 1234 AB Amsterdam",
            foundingDate: "2020-01-15",
            statutenFileUri: "w3ds://file?id=@de68861c-8ea9-55be-9258-2a8cc3057a60/env-1",
            boardMembers: [],
        });
    });

    it("maps boardMembers 1:1 under legalInfo", () => {
        const result = buildOrganizationPayload({
            ...BASE_INPUT,
            boardMembers: [{ eName: "@abc", role: "Voorzitter" }],
        });
        expect(result.legalInfo.boardMembers).toEqual([{ eName: "@abc", role: "Voorzitter" }]);
    });

    it("maps branding fields verbatim", () => {
        const result = buildOrganizationPayload({ ...BASE_INPUT, logoUrl: "https://example.com/logo.png" });
        expect(result.branding).toEqual({
            logoUrl: "https://example.com/logo.png",
            primaryColor: "#C4622D",
            titleFont: "Playfair Display",
        });
    });

    it("maps membershipTypes 1:1, omitting description when null", () => {
        const result = buildOrganizationPayload({
            ...BASE_INPUT,
            membershipTypes: [
                { id: "type-1", name: "Aspirant", description: null, emoji: "🌱" },
                { id: "type-2", name: "Full member", description: "Voting member", emoji: "🏡" },
            ],
        });
        expect(result.membershipTypes).toEqual([
            { id: "type-1", name: "Aspirant", emoji: "🌱" },
            { id: "type-2", name: "Full member", description: "Voting member", emoji: "🏡" },
        ]);
    });

    it("maps members 1:1 with participantId, eName, dateJoined, membershipTypeId", () => {
        const result = buildOrganizationPayload({
            ...BASE_INPUT,
            members: [{ participantId: "meta-env-1", eName: "@member1", dateJoined: "2021-03-01", membershipTypeId: "type-2" }],
        });
        expect(result.members).toEqual([
            { participantId: "meta-env-1", eName: "@member1", dateJoined: "2021-03-01", membershipTypeId: "type-2" },
        ]);
    });

    it("returns empty arrays for membershipTypes/members when none given", () => {
        const result = buildOrganizationPayload(BASE_INPUT);
        expect(result.membershipTypes).toEqual([]);
        expect(result.members).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd api && npx jest organizationPayload -v
```
Expected: FAIL — `Cannot find module '../organizationPayload'`.

- [ ] **Step 3: Write the implementation**

```ts
// api/src/services/organizationPayload.ts
export interface OrganizationPayloadBoardMember {
    eName: string;
    role: string;
}

export interface OrganizationPayloadMembershipType {
    id: string;
    name: string;
    description: string | null;
    emoji: string | null;
}

export interface OrganizationPayloadMember {
    participantId: string;
    eName: string;
    dateJoined: string | null;
    membershipTypeId: string | null;
}

export interface OrganizationPayloadInput {
    communityEname: string;
    legalForm: string | null;
    officialName: string | null;
    kvkNumber: string | null;
    rsin: string | null;
    iban: string | null;
    registeredAddress: string | null;
    // Runtime value of Community.founding_date is a plain 'YYYY-MM-DD' string, not a Date
    // instance, despite the entity's `Date | null` type annotation (TypeORM `type: "date"`
    // columns deserialize to strings, not Dates). Callers must pass it through unchanged.
    foundingDate: string | null;
    statutenFileUri: string | null;
    boardMembers: OrganizationPayloadBoardMember[];
    logoUrl: string | null;
    primaryColor: string;
    titleFont: string;
    membershipTypes: OrganizationPayloadMembershipType[];
    members: OrganizationPayloadMember[];
}

interface LegalInfoPayload {
    legalForm?: string;
    officialName?: string;
    kvkNumber?: string;
    rsin?: string;
    iban?: string;
    registeredAddress?: string;
    foundingDate?: string;
    statutenFileUri?: string;
    boardMembers: OrganizationPayloadBoardMember[];
}

interface BrandingPayload {
    logoUrl: string | null;
    primaryColor: string;
    titleFont: string;
}

interface MembershipTypePayload {
    id: string;
    name: string;
    description?: string;
    emoji: string | null;
}

export interface OrganizationEnvelopePayload {
    legalInfo: LegalInfoPayload;
    branding: BrandingPayload;
    membershipTypes: MembershipTypePayload[];
    members: OrganizationPayloadMember[];
}

export function buildOrganizationPayload(input: OrganizationPayloadInput): OrganizationEnvelopePayload {
    const legalInfo: LegalInfoPayload = { boardMembers: input.boardMembers };
    if (input.legalForm) legalInfo.legalForm = input.legalForm;
    if (input.officialName) legalInfo.officialName = input.officialName;
    if (input.kvkNumber) legalInfo.kvkNumber = input.kvkNumber;
    if (input.rsin) legalInfo.rsin = input.rsin;
    if (input.iban) legalInfo.iban = input.iban;
    if (input.registeredAddress) legalInfo.registeredAddress = input.registeredAddress;
    if (input.foundingDate) legalInfo.foundingDate = input.foundingDate;
    if (input.statutenFileUri) legalInfo.statutenFileUri = input.statutenFileUri;

    return {
        legalInfo,
        branding: {
            logoUrl: input.logoUrl,
            primaryColor: input.primaryColor,
            titleFont: input.titleFont,
        },
        membershipTypes: input.membershipTypes.map((t) => {
            const mt: MembershipTypePayload = { id: t.id, name: t.name, emoji: t.emoji };
            if (t.description) mt.description = t.description;
            return mt;
        }),
        members: input.members,
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd api && npx jest organizationPayload -v
```
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/organizationPayload.ts api/src/services/__tests__/organizationPayload.test.ts
git commit -m "feat: add buildOrganizationPayload envelope builder"
```

---

### Task 5: `OrganizationService.ts` sync orchestration

**Files:**
- Create: `api/src/services/OrganizationService.ts`

**Interfaces:**
- Consumes: `buildOrganizationPayload` and its types from Task 4 (`organizationPayload.ts`); `createEnvelope`, `updateEnvelope`, `getUserMetaEnvelopeId` from `api/src/lib/evault-client.ts`; `ONTOLOGIES.Organization` from Task 2; `Community`, `CommunityMembership`, `OrganizationMembershipType`, `Person` entities.
- Produces: `export async function syncOrganizationToEvault(communityId: string, exclude: OrgSyncExclusions = {}): Promise<void>` and `export interface OrgSyncExclusions { excludeMembershipId?: string; excludeMembershipTypeId?: string; boardMembersOverride?: { eName: string; role: string }[]; }`. Exported (not private) — Task 6, 7, and 8 all call it directly from their own files.

- [ ] **Step 1: Write `OrganizationService.ts`**

```ts
// api/src/services/OrganizationService.ts
import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { OrganizationMembershipType } from "../database/entities/OrganizationMembershipType";
import { Person } from "../database/entities/Person";
import { createEnvelope, updateEnvelope, getUserMetaEnvelopeId } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { buildOrganizationPayload } from "./organizationPayload";

const communityRepo = () => AppDataSource.getRepository(Community);
const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const membershipTypeRepo = () => AppDataSource.getRepository(OrganizationMembershipType);
const personRepo = () => AppDataSource.getRepository(Person);

export interface OrgSyncExclusions {
    excludeMembershipId?: string;
    excludeMembershipTypeId?: string;
    boardMembersOverride?: { eName: string; role: string }[];
}

export async function syncOrganizationToEvault(communityId: string, exclude: OrgSyncExclusions = {}): Promise<void> {
    const community = await communityRepo().findOne({ where: { id: communityId } });
    if (!community || community.provisioning_status !== "linked" || !community.ename) return;

    let membershipTypes = await membershipTypeRepo().find({ where: { community_id: communityId }, order: { sort_order: "ASC" } });
    if (exclude.excludeMembershipTypeId) {
        membershipTypes = membershipTypes.filter((t) => t.id !== exclude.excludeMembershipTypeId);
    }

    let memberships = await membershipRepo().find({ where: { community_id: communityId } });
    if (exclude.excludeMembershipId) {
        memberships = memberships.filter((m) => m.id !== exclude.excludeMembershipId);
    }

    const members: { participantId: string; eName: string; dateJoined: string | null; membershipTypeId: string | null }[] = [];
    for (const m of memberships) {
        const person = await personRepo().findOne({ where: { id: m.person_id } });
        if (!person?.ename) continue;
        let metaId = person.meta_envelope_id;
        if (!metaId) {
            metaId = await getUserMetaEnvelopeId(person.ename);
            if (metaId) await personRepo().update(person.id, { meta_envelope_id: metaId });
        }
        if (!metaId) continue;
        members.push({
            participantId: metaId,
            eName: person.ename,
            dateJoined: m.joined_at ? String(m.joined_at) : null,
            membershipTypeId: m.membership_type_id,
        });
    }

    const boardMembers = exclude.boardMembersOverride ?? community.board_members;

    const payload = buildOrganizationPayload({
        communityEname: community.ename,
        legalForm: community.legal_form,
        officialName: community.official_name,
        kvkNumber: community.kvk_number,
        rsin: community.rsin,
        iban: community.iban,
        registeredAddress: community.registered_address,
        // Community.founding_date is declared Date | null but TypeORM's "date" column type
        // deserializes to a plain 'YYYY-MM-DD' string at runtime — String() is a safe passthrough.
        foundingDate: community.founding_date ? String(community.founding_date) : null,
        statutenFileUri: community.statuten_file_uri,
        boardMembers,
        logoUrl: community.logo_url,
        primaryColor: community.primary_color,
        titleFont: community.title_font,
        membershipTypes: membershipTypes.map((t) => ({ id: t.id, name: t.name, description: t.description, emoji: t.emoji })),
        members,
    });

    if (community.organization_envelope_id) {
        await updateEnvelope({
            vaultEname: community.ename,
            envelopeId: community.organization_envelope_id,
            ontology: ONTOLOGIES.Organization,
            payload: { ...payload },
            acl: ["*"],
        });
    } else {
        const envelopeId = await createEnvelope({
            vaultEname: community.ename,
            ontology: ONTOLOGIES.Organization,
            payload: { ...payload },
            acl: ["*"],
        });
        await communityRepo().update(community.id, { organization_envelope_id: envelopeId });
    }
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```
Expected: no errors. (No dedicated test file for this task — matches the established convention that DB-orchestration sync functions like `syncWorkgroupToEvault` in `WorkgroupService.ts` have no direct unit test, per `.superpowers/sdd/fix-1-brief.md`'s note: "consistent with the untested-DB-orchestration convention already established.")

- [ ] **Step 3: Commit**

```bash
git add api/src/services/OrganizationService.ts
git commit -m "feat: add syncOrganizationToEvault orchestration"
```

---

### Task 6: Wire sync into `CommunityService.ts`; retire the Chat-envelope conflation

**Files:**
- Modify: `api/src/services/CommunityService.ts`
- Modify: `api/src/controllers/WebhookController.ts`

**Interfaces:**
- Consumes: `syncOrganizationToEvault`, `OrgSyncExclusions` from Task 5 (`OrganizationService.ts`).
- Produces: `updateCommunity` accepts the new legalInfo/branding/board_members fields and fires `syncOrganizationToEvault`; `linkCommunity`/`createCommunityFromEname`/`unlinkCommunity` no longer touch `community_envelope_id`. `syncCommunityToEvault`, `addParticipantToEnvelope`, `removeParticipantFromEnvelope`, `syncFromChatWebhook` are deleted — Task 7/8 callers of these are updated in those tasks, but `MemberService.ts` and `MemberController.ts` still import them until Task 8, so **do this task and Task 8 as one uninterrupted sequence** (Task 7 sits safely between them since it doesn't touch these imports) — actually simpler: this task deletes the 4 functions and updates their imports in `MemberService.ts`/`MemberController.ts`/`WebhookController.ts` right here, so nothing is left dangling. See Step 4.

- [ ] **Step 1: Replace `updateCommunity`'s field whitelist, sync call, and add board-member-removal handling**

Replace (currently lines 209-224):
```ts
export async function updateCommunity(
    id: string,
    data: Partial<Pick<Community, "name" | "slug" | "description" | "logo_url" | "primary_color" | "title_font">>
): Promise<Community> {
    const community = await communityRepo().findOneOrFail({ where: { id } });
    Object.assign(community, data);
    const saved = await communityRepo().save(community);

    if (saved.provisioning_status === "linked" && saved.ename && saved.community_envelope_id) {
        syncCommunityToEvault(saved).catch((err) =>
            logger.warn(err, "Community envelope update failed for %s", saved.id)
        );
    }

    return saved;
}

async function syncCommunityToEvault(community: Community): Promise<void> {
    const envelope = await getEnvelope(community.ename!, community.community_envelope_id!);
    if (!envelope) return;
    await updateEnvelope({
        vaultEname: community.ename!,
        envelopeId: community.community_envelope_id!,
        ontology: ONTOLOGIES.Community,
        payload: {
            ...envelope,
            name: community.name,
            description: community.description ?? envelope.description,
            avatar: community.logo_url ?? envelope.avatar,
            updatedAt: new Date().toISOString(),
        },
        acl: ["*"],
    });
}
```
with:
```ts
export async function updateCommunity(
    id: string,
    data: Partial<Pick<Community,
        "name" | "slug" | "description" | "logo_url" | "primary_color" | "title_font" |
        "legal_form" | "official_name" | "kvk_number" | "rsin" | "iban" | "registered_address" |
        "founding_date" | "statuten_file_uri" | "board_members"
    >>
): Promise<Community> {
    const community = await communityRepo().findOneOrFail({ where: { id } });

    const isBoardMemberRemoval = data.board_members !== undefined && data.board_members.length < community.board_members.length;

    if (isBoardMemberRemoval) {
        await syncOrganizationToEvault(id, { boardMembersOverride: data.board_members });
        Object.assign(community, data);
        return communityRepo().save(community);
    }

    Object.assign(community, data);
    const saved = await communityRepo().save(community);

    if (saved.provisioning_status === "linked" && saved.ename) {
        syncOrganizationToEvault(saved.id).catch((err) =>
            logger.warn(err, "Organization envelope update failed for %s", saved.id)
        );
    }

    return saved;
}
```

- [ ] **Step 2: Simplify `linkCommunity`, `unlinkCommunity`, `createCommunityFromEname`**

Replace (currently lines 316-323):
```ts
    community.ename = resolution.w3id;
    community.evault_uri = resolution.evault_uri;
    community.provisioning_status = "linked";
    community.community_envelope_id = resolution.envelopeId;
    if (resolution.envelope?.name) community.name = resolution.envelope.name;
    if (resolution.envelope?.logo_url) community.logo_url = resolution.envelope.logo_url;
    if (resolution.envelope?.description) community.description = resolution.envelope.description;
    const saved = await communityRepo().save(community);
```
with:
```ts
    community.ename = resolution.w3id;
    community.evault_uri = resolution.evault_uri;
    community.provisioning_status = "linked";
    if (resolution.envelope?.name) community.name = resolution.envelope.name;
    if (resolution.envelope?.logo_url) community.logo_url = resolution.envelope.logo_url;
    if (resolution.envelope?.description) community.description = resolution.envelope.description;
    const saved = await communityRepo().save(community);
```

Replace (currently lines 325-350, the async envelope-creation chain) with:
```ts
    syncOrganizationToEvault(saved.id).catch((err) =>
        logger.warn(err, "Organization envelope creation failed for linked community %s", saved.id)
    );
```

Replace `unlinkCommunity` (currently lines 356-363):
```ts
export async function unlinkCommunity(communityId: string): Promise<Community> {
    const community = await communityRepo().findOneOrFail({ where: { id: communityId } });
    community.ename = null;
    community.evault_uri = null;
    community.community_envelope_id = null;
    community.provisioning_status = "unlinked";
    return communityRepo().save(community);
}
```
with:
```ts
export async function unlinkCommunity(communityId: string): Promise<Community> {
    const community = await communityRepo().findOneOrFail({ where: { id: communityId } });
    community.ename = null;
    community.evault_uri = null;
    community.organization_envelope_id = null;
    community.provisioning_status = "unlinked";
    return communityRepo().save(community);
}
```

Replace (currently lines 416-428, inside `createCommunityFromEname`'s transaction):
```ts
    return AppDataSource.transaction(async (manager) => {
        const community = await manager.save(
            manager.create(Community, {
                name: resolution.envelope.name,
                slug,
                description: resolution.envelope.description,
                logo_url: resolution.envelope.logo_url,
                ename: resolution.w3id,
                evault_uri: resolution.evault_uri,
                community_envelope_id: resolution.envelopeId,
                provisioning_status: "linked",
            })
        );
        await manager.save(
            DEFAULT_AVAILABILITY_TYPES.map((t) =>
                manager.create(AvailabilityType, { ...t, community_id: community.id })
            )
        );
        return community;
    });
```
with:
```ts
    const community = await AppDataSource.transaction(async (manager) => {
        const created = await manager.save(
            manager.create(Community, {
                name: resolution.envelope.name,
                slug,
                description: resolution.envelope.description,
                logo_url: resolution.envelope.logo_url,
                ename: resolution.w3id,
                evault_uri: resolution.evault_uri,
                provisioning_status: "linked",
            })
        );
        await manager.save(
            DEFAULT_AVAILABILITY_TYPES.map((t) =>
                manager.create(AvailabilityType, { ...t, community_id: created.id })
            )
        );
        return created;
    });
    syncOrganizationToEvault(community.id).catch((err) =>
        logger.warn(err, "Organization envelope creation failed for community %s", community.id)
    );
    return community;
```

- [ ] **Step 3: Delete the four retired functions**

Delete `addParticipantToEnvelope` and `removeParticipantFromEnvelope` in full (currently lines 438-473):
```ts
/** Adds a member's User-profile MetaEnvelope ID to the community's Chat envelope participantIds.
 *  No-op if the community isn't linked to a W3DS eName. */
export async function addParticipantToEnvelope(community: Community, metaEnvelopeId: string): Promise<void> {
    if (community.provisioning_status !== "linked" || !community.ename || !community.community_envelope_id) return;
    const envelope = await getEnvelope(community.ename, community.community_envelope_id);
    if (!envelope) return;
    const participantIds = Array.isArray(envelope.participantIds) ? (envelope.participantIds as string[]) : [];
    if (participantIds.includes(metaEnvelopeId)) return;
    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: community.community_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: { ...envelope, participantIds: [...participantIds, metaEnvelopeId], updatedAt: new Date().toISOString() },
        acl: ["*"],
    });
}

/** Removes a member's MetaEnvelope ID from the community's Chat envelope participantIds. */
export async function removeParticipantFromEnvelope(community: Community, metaEnvelopeId: string): Promise<void> {
    if (community.provisioning_status !== "linked" || !community.ename || !community.community_envelope_id) return;
    const envelope = await getEnvelope(community.ename, community.community_envelope_id);
    if (!envelope) return;
    const participantIds = Array.isArray(envelope.participantIds) ? (envelope.participantIds as string[]) : [];
    if (!participantIds.includes(metaEnvelopeId)) return;
    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: community.community_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: {
            ...envelope,
            participantIds: participantIds.filter((id) => id !== metaEnvelopeId),
            updatedAt: new Date().toISOString(),
        },
        acl: ["*"],
    });
}
```

Delete `syncFromChatWebhook` in full (currently lines 475-489):
```ts
/** Inbound Awareness Protocol sync: another platform changed this community's Chat envelope.
 *  Refreshes our cached display fields only — Postgres stays the source of truth for membership. */
export async function syncFromChatWebhook(
    w3id: string,
    metaEnvelopeId: string,
    data: Record<string, unknown>
): Promise<void> {
    const community = await communityRepo().findOne({ where: { ename: w3id } });
    if (!community) return;
    if (typeof data.name === "string") community.name = data.name;
    if (typeof data.description === "string") community.description = data.description;
    if (typeof data.avatar === "string") community.logo_url = data.avatar;
    community.community_envelope_id = metaEnvelopeId;
    await communityRepo().save(community);
}
```

Add the import for `syncOrganizationToEvault` near the top of `CommunityService.ts` (alongside the other local imports):
```ts
import { syncOrganizationToEvault } from "./OrganizationService";
```

The `getEnvelope` import at the top of `CommunityService.ts` is now unused by this file's remaining functions except... check: `resolveEnameForNewCommunity`/`resolveW3id` use `findEnvelopesByOntology`, not `getEnvelope`. Remove `getEnvelope` from the import line:
```ts
import { createEnvelope, getEnvelope, updateEnvelope, findEnvelopesByOntology, getUserMetaEnvelopeId } from "../lib/evault-client";
```
becomes:
```ts
import { createEnvelope, updateEnvelope, findEnvelopesByOntology, getUserMetaEnvelopeId } from "../lib/evault-client";
```

- [ ] **Step 4: Update `WebhookController.ts` — remove the retired dispatch branch**

Replace:
```ts
import { upsertFromWebhook } from "../services/PersonService";
import { syncFromChatWebhook } from "../services/CommunityService";
```
with:
```ts
import { upsertFromWebhook } from "../services/PersonService";
```

Replace:
```ts
    try {
        if (packet.schemaId === ONTOLOGIES.User) {
            await upsertFromWebhook(packet.w3id, packet.id, packet.data ?? {});
        } else if (packet.schemaId === ONTOLOGIES.Community) {
            await syncFromChatWebhook(packet.w3id, packet.id, packet.data ?? {});
        }
    } catch (err) {
```
with:
```ts
    try {
        if (packet.schemaId === ONTOLOGIES.User) {
            await upsertFromWebhook(packet.w3id, packet.id, packet.data ?? {});
        }
    } catch (err) {
```

- [ ] **Step 5: Verify**

```bash
cd api && npx tsc --noEmit
```
Expected: two errors, both expected and temporary — `MemberService.ts` and `MemberController.ts` still import `addParticipantToEnvelope`/`removeParticipantFromEnvelope` from `CommunityService.ts`, which no longer exports them. These are resolved in Task 8, which rewires both files in the same work session. Confirm the *only* errors are these two missing-import errors (no others) before proceeding — this confirms Steps 1-4 introduced no unrelated breakage.

- [ ] **Step 6: Commit**

```bash
git add api/src/services/CommunityService.ts api/src/controllers/WebhookController.ts
git commit -m "feat: wire Organization sync into CommunityService, retire Chat-envelope conflation"
```

Note: this commit leaves `tsc --noEmit` red on purpose (two known errors from `MemberService.ts`/`MemberController.ts` fixed in Task 8). If your process requires green commits, do Task 7 and Task 8 immediately after this one before running the final suite-wide check — Task 12's final verification step is the actual gate.

---

### Task 7: `OrganizationMembershipType` CRUD — service, controller, routes, client

**Files:**
- Create: `api/src/services/OrganizationMembershipTypeService.ts`
- Create: `api/src/controllers/OrganizationMembershipTypeController.ts`
- Modify: `api/src/index.ts`
- Modify: `app/src/api/client.js`

**Interfaces:**
- Consumes: `syncOrganizationToEvault` from Task 5; `requireAuth`, `requireCommunityAdmin`, `requireCommunityMember` middleware (existing, used identically to the Workgroup routes).
- Produces: `listMembershipTypes(communityId)`, `createMembershipType(communityId, data)`, `updateMembershipType(id, communityId, data)`, `deleteMembershipType(id, communityId): Promise<void>` (throws an `Error` with `.code === "membership_type_in_use"` and `.affectedCount` when blocked). Frontend `client.js` gains `listMembershipTypes(cid)`, `createMembershipType(cid, data)`, `updateMembershipType(cid, tid, data)`, `deleteMembershipType(cid, tid)`.

- [ ] **Step 1: Write `OrganizationMembershipTypeService.ts`**

```ts
// api/src/services/OrganizationMembershipTypeService.ts
import { AppDataSource } from "../database/data-source";
import { OrganizationMembershipType } from "../database/entities/OrganizationMembershipType";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { syncOrganizationToEvault } from "./OrganizationService";
import { logger } from "../lib/logger";

const typeRepo = () => AppDataSource.getRepository(OrganizationMembershipType);
const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);

export async function listMembershipTypes(communityId: string): Promise<OrganizationMembershipType[]> {
    return typeRepo().find({ where: { community_id: communityId }, order: { sort_order: "ASC" } });
}

export async function createMembershipType(
    communityId: string,
    data: { name: string; description?: string; emoji?: string }
): Promise<OrganizationMembershipType> {
    const maxOrder = (await typeRepo().maximum("sort_order", { community_id: communityId }) as number | null) ?? -1;
    const saved = await typeRepo().save(
        typeRepo().create({
            community_id: communityId,
            name: data.name,
            description: data.description ?? null,
            emoji: data.emoji ?? null,
            sort_order: maxOrder + 1,
        })
    );
    syncOrganizationToEvault(communityId).catch((err) =>
        logger.warn(err, "Organization envelope sync failed for %s", communityId)
    );
    return saved;
}

export async function updateMembershipType(
    id: string,
    communityId: string,
    data: Partial<Pick<OrganizationMembershipType, "name" | "description" | "emoji" | "sort_order">>
): Promise<OrganizationMembershipType> {
    const type = await typeRepo().findOneOrFail({ where: { id, community_id: communityId } });
    Object.assign(type, data);
    const saved = await typeRepo().save(type);
    syncOrganizationToEvault(communityId).catch((err) =>
        logger.warn(err, "Organization envelope sync failed for %s", communityId)
    );
    return saved;
}

export async function deleteMembershipType(id: string, communityId: string): Promise<void> {
    const affectedCount = await membershipRepo().count({ where: { community_id: communityId, membership_type_id: id } });
    if (affectedCount > 0) {
        throw Object.assign(new Error(`${affectedCount} member(s) still use this membership type`), {
            code: "membership_type_in_use",
            affectedCount,
        });
    }
    await syncOrganizationToEvault(communityId, { excludeMembershipTypeId: id });
    await typeRepo().delete({ id, community_id: communityId });
}
```

- [ ] **Step 2: Write `OrganizationMembershipTypeController.ts`**

```ts
// api/src/controllers/OrganizationMembershipTypeController.ts
import { Request, Response, NextFunction } from "express";
import {
    listMembershipTypes, createMembershipType, updateMembershipType, deleteMembershipType,
} from "../services/OrganizationMembershipTypeService";

export const listMembershipTypesHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await listMembershipTypes(req.params.cid));
    } catch (err) {
        next(err);
    }
};

export const createMembershipTypeHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, description, emoji } = req.body;
        if (!name) { res.status(400).json({ error: "name required" }); return; }
        res.status(201).json(await createMembershipType(req.params.cid, { name, description, emoji }));
    } catch (err) {
        next(err);
    }
};

export const updateMembershipTypeHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, description, emoji, sort_order } = req.body;
        res.json(await updateMembershipType(req.params.tid, req.params.cid, { name, description, emoji, sort_order }));
    } catch (err) {
        next(err);
    }
};

export const deleteMembershipTypeHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await deleteMembershipType(req.params.tid, req.params.cid);
        res.status(204).send();
    } catch (err: any) {
        if (err.code === "membership_type_in_use") {
            res.status(409).json({ error: err.message, affectedCount: err.affectedCount });
            return;
        }
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Membership type not found" }); return; }
        next(err);
    }
};
```

- [ ] **Step 3: Register routes in `index.ts`**

Add the import alongside the existing `WorkgroupController` import:
```ts
import {
    listMembershipTypesHandler, createMembershipTypeHandler, updateMembershipTypeHandler, deleteMembershipTypeHandler,
} from "./controllers/OrganizationMembershipTypeController";
```

Add a new section after the `// ── Workgroups ──` block (after `app.delete("/api/workgroups/:wid/members/:pid/roles/:rid", ...)`, before `// ── Production: serve React app ──`):
```ts
// ── Organization Membership Types ─────────────────────────────────────────────
app.get("/api/communities/:cid/membership-types", requireAuth, requireCommunityMember, listMembershipTypesHandler);
app.post("/api/communities/:cid/membership-types", requireAuth, requireCommunityAdmin, createMembershipTypeHandler);
app.patch("/api/communities/:cid/membership-types/:tid", requireAuth, requireCommunityAdmin, updateMembershipTypeHandler);
app.delete("/api/communities/:cid/membership-types/:tid", requireAuth, requireCommunityAdmin, deleteMembershipTypeHandler);
```

- [ ] **Step 4: Add client wrapper functions in `app/src/api/client.js`**

Add after the `// ── Workgroup Members ──` section, at the end of the file:
```js
// ── Organization Membership Types ─────────────────────────────────────────────
export const listMembershipTypes = (cid) => req('GET', `/communities/${cid}/membership-types`)
export const createMembershipType = (cid, data) => req('POST', `/communities/${cid}/membership-types`, data)
export const updateMembershipType = (cid, tid, data) => req('PATCH', `/communities/${cid}/membership-types/${tid}`, data)
export const deleteMembershipType = (cid, tid) => req('DELETE', `/communities/${cid}/membership-types/${tid}`)
```

- [ ] **Step 5: Verify**

```bash
cd api && npx tsc --noEmit
```
Expected: same two pre-existing errors from Task 6 Step 5 (unrelated to this task, fixed in Task 8), no new errors from this task's files.

- [ ] **Step 6: Commit**

```bash
git add api/src/services/OrganizationMembershipTypeService.ts api/src/controllers/OrganizationMembershipTypeController.ts api/src/index.ts app/src/api/client.js
git commit -m "feat: add OrganizationMembershipType CRUD endpoints"
```

---

### Task 8: `MemberService.ts` / `MemberController.ts` rewiring — fixes the sync-ordering bug

**Files:**
- Modify: `api/src/services/MemberService.ts`
- Modify: `api/src/controllers/MemberController.ts`
- Modify: `api/src/controllers/CommunityController.ts`

**Interfaces:**
- Consumes: `syncOrganizationToEvault`, `OrgSyncExclusions` from Task 5.
- Produces: `updateMember` accepts `is_admin | membership_type_id | joined_at` (drops `is_aspirant`/`is_active_partner`). `removeMember` now syncs (with exclusion) *before* deleting, fixing the pre-existing ordering bug. `updateCommunityHandler` accepts the new legalInfo/branding/board_members fields.

- [ ] **Step 1: Rewrite `MemberService.ts`**

Replace the whole file:
```ts
// api/src/services/MemberService.ts
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Person } from "../database/entities/Person";
import { AvailabilityLog } from "../database/entities/AvailabilityLog";
import { syncOrganizationToEvault } from "./OrganizationService";
import { logger } from "../lib/logger";

const memberRepo = () => AppDataSource.getRepository(CommunityMembership);
const personRepo = () => AppDataSource.getRepository(Person);

export async function listMembers(communityId: string): Promise<CommunityMembership[]> {
    return memberRepo().find({ where: { community_id: communityId } });
}

export async function addMember(
    communityId: string,
    data: { first_name: string; last_name: string; email?: string }
): Promise<CommunityMembership> {
    // Reuse shell Person with matching email, else create new shell
    let person: Person | null = null;
    if (data.email) {
        person = await personRepo().findOne({ where: { email: data.email } });
    }
    if (!person) {
        person = await personRepo().save(
            personRepo().create({
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email ?? null,
            })
        );
    }
    let membership: CommunityMembership;
    try {
        membership = await memberRepo().save(
            memberRepo().create({ person_id: person.id, community_id: communityId })
        );
    } catch (err: any) {
        if (err.code === "23505") throw Object.assign(new Error("Already a member"), { code: "23505" });
        throw err;
    }

    syncOrganizationToEvault(communityId).catch((err) =>
        logger.warn(err, "Organization envelope sync failed for member %s", membership.id)
    );

    return membership;
}

export async function updateMember(
    communityId: string,
    membershipId: string,
    data: Partial<Pick<CommunityMembership, "is_admin" | "membership_type_id" | "joined_at">>
): Promise<CommunityMembership> {
    const m = await memberRepo().findOneOrFail({ where: { id: membershipId } });
    Object.assign(m, data);
    const saved = await memberRepo().save(m);
    syncOrganizationToEvault(communityId).catch((err) =>
        logger.warn(err, "Organization envelope sync failed for member %s", membershipId)
    );
    return saved;
}

export async function removeMember(communityId: string, membershipId: string): Promise<void> {
    const membership = await memberRepo().findOne({ where: { id: membershipId, community_id: communityId } });
    if (!membership) return;
    await syncOrganizationToEvault(communityId, { excludeMembershipId: membershipId });
    await memberRepo().delete({ id: membershipId, community_id: communityId });
}

export async function getMemberAvailabilityLog(membershipId: string): Promise<AvailabilityLog[]> {
    return AppDataSource.getRepository(AvailabilityLog).find({
        where: { community_membership_id: membershipId },
        order: { created_at: "DESC" },
    });
}
```

Note the `updateMember` signature gained a leading `communityId` parameter (the old version only took `membershipId, data`) — needed because `syncOrganizationToEvault` is keyed by community, not membership. Step 2 updates both call sites in `MemberController.ts`.

- [ ] **Step 2: Update `MemberController.ts`**

Replace the import line:
```ts
import { listMembers, addMember, updateMember, removeMember, getMemberAvailabilityLog } from "../services/MemberService";
import { updatePerson } from "../services/PersonService";
import { applyAvailability } from "../services/AvailabilityService";
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Person } from "../database/entities/Person";
import { getById as getCommunityById, addParticipantToEnvelope } from "../services/CommunityService";
import { getUserMetaEnvelopeId } from "../lib/evault-client";
import { logger } from "../lib/logger";
```
with:
```ts
import { listMembers, addMember, updateMember, removeMember, getMemberAvailabilityLog } from "../services/MemberService";
import { updatePerson } from "../services/PersonService";
import { applyAvailability } from "../services/AvailabilityService";
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Person } from "../database/entities/Person";
import { syncOrganizationToEvault } from "../services/OrganizationService";
import { getUserMetaEnvelopeId } from "../lib/evault-client";
import { logger } from "../lib/logger";
```

Replace `updateMemberHandler` (currently lines 31-46):
```ts
export async function updateMemberHandler(req: Request, res: Response) {
    const patch = Object.fromEntries(
        Object.entries({ is_admin: req.body.is_admin, is_aspirant: req.body.is_aspirant, is_active_partner: req.body.is_active_partner, joined_at: req.body.joined_at })
            .filter(([, v]) => v !== undefined)
    );
    try {
        const membership = await AppDataSource.getRepository(CommunityMembership).findOneOrFail({
            where: { person_id: req.params.pid, community_id: req.params.cid },
        });
        const m = await updateMember(membership.id, patch);
        res.json(m);
    } catch (err: any) {
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Membership not found" }); return; }
        throw err;
    }
}
```
with:
```ts
export async function updateMemberHandler(req: Request, res: Response) {
    const patch = Object.fromEntries(
        Object.entries({ is_admin: req.body.is_admin, membership_type_id: req.body.membership_type_id, joined_at: req.body.joined_at })
            .filter(([, v]) => v !== undefined)
    );
    try {
        const membership = await AppDataSource.getRepository(CommunityMembership).findOneOrFail({
            where: { person_id: req.params.pid, community_id: req.params.cid },
        });
        const m = await updateMember(req.params.cid, membership.id, patch);
        res.json(m);
    } catch (err: any) {
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Membership not found" }); return; }
        throw err;
    }
}
```

Replace `syncClaimedIdentity` (currently lines 122-137):
```ts
// CORE's "claim identity" moment: an admin has just set a shell Person's eName.
// Resolve their W3DS User MetaEnvelope ID and add them to the community's Chat envelope, if linked.
async function syncClaimedIdentity(communityId: string, person: Person): Promise<void> {
    if (!person.ename) return;
    const community = await getCommunityById(communityId);
    if (!community) return;

    const metaEnvelopeId = person.meta_envelope_id ?? (await getUserMetaEnvelopeId(person.ename));
    if (!metaEnvelopeId) return;
    if (!person.meta_envelope_id) await AppDataSource.getRepository(Person).update(person.id, { meta_envelope_id: metaEnvelopeId });

    const membership = await AppDataSource.getRepository(CommunityMembership).findOne({
        where: { person_id: person.id, community_id: communityId },
    });
    if (membership) await AppDataSource.getRepository(CommunityMembership).update(membership.id, { meta_envelope_id: metaEnvelopeId });

    await addParticipantToEnvelope(community, metaEnvelopeId);
}
```
with:
```ts
// CORE's "claim identity" moment: an admin has just set a shell Person's eName.
// Resolve their W3DS User MetaEnvelope ID, cache it, and re-sync the Organization envelope
// so this member appears in members[] with a real participantId.
async function syncClaimedIdentity(communityId: string, person: Person): Promise<void> {
    if (!person.ename) return;

    const metaEnvelopeId = person.meta_envelope_id ?? (await getUserMetaEnvelopeId(person.ename));
    if (!metaEnvelopeId) return;
    if (!person.meta_envelope_id) await AppDataSource.getRepository(Person).update(person.id, { meta_envelope_id: metaEnvelopeId });

    await syncOrganizationToEvault(communityId);
}
```

- [ ] **Step 3: Extend `updateCommunityHandler`'s field whitelist in `CommunityController.ts`**

Replace (currently lines 34-39):
```ts
export async function updateCommunityHandler(req: Request, res: Response) {
    const { name, slug, description, logo_url, primary_color, title_font } = req.body;
    const patch = Object.fromEntries(
        Object.entries({ name, slug, description, logo_url, primary_color, title_font })
            .filter(([, v]) => v !== undefined)
    ) as Partial<Pick<Community, "name" | "slug" | "description" | "logo_url" | "primary_color" | "title_font">>;
```
with:
```ts
export async function updateCommunityHandler(req: Request, res: Response) {
    const {
        name, slug, description, logo_url, primary_color, title_font,
        legal_form, official_name, kvk_number, rsin, iban, registered_address,
        founding_date, statuten_file_uri, board_members,
    } = req.body;
    const patch = Object.fromEntries(
        Object.entries({
            name, slug, description, logo_url, primary_color, title_font,
            legal_form, official_name, kvk_number, rsin, iban, registered_address,
            founding_date, statuten_file_uri, board_members,
        }).filter(([, v]) => v !== undefined)
    ) as Partial<Pick<Community,
        "name" | "slug" | "description" | "logo_url" | "primary_color" | "title_font" |
        "legal_form" | "official_name" | "kvk_number" | "rsin" | "iban" | "registered_address" |
        "founding_date" | "statuten_file_uri" | "board_members"
    >>;
```

- [ ] **Step 4: Verify**

```bash
cd api && npx tsc --noEmit
```
Expected: no errors — this resolves the two errors carried since Task 6.

```bash
cd api && npm test
```
Expected: all existing suites pass (no test file directly covers `MemberService.ts`, matching the untested-DB-orchestration convention; `organizationPayload.test.ts` and `workgroupPayload.test.ts` still pass).

- [ ] **Step 5: Commit**

```bash
git add api/src/services/MemberService.ts api/src/controllers/MemberController.ts api/src/controllers/CommunityController.ts
git commit -m "fix: sync Organization envelope before removing member, migrate off Chat-envelope participant sync"
```

---

### Task 9: Backend DTO migration off `isAspirant`/`isActivePartner`

**Files:**
- Modify: `api/src/services/CommunityService.ts`
- Modify: `api/src/controllers/AuthController.ts`

**Interfaces:**
- Produces: `getCommunityFull`'s `members[]` entries carry `membershipTypeId` and `membershipType: { id, name, emoji } | null` instead of `isAspirant`/`isActivePartner`. `getCommunityGraph`'s `persons[]` entries drop `isAspirant` (no replacement — the graph view no longer renders membership-type visually, per the frontend design decision in Task 11). `AuthController.ts`'s `getMembershipsForPerson`/`getMe` drop `isAspirant` (grep-confirmed: no frontend code reads `memberships[].isAspirant` from these two endpoints — only a stale comment in `UserContext.jsx`, updated in Task 10).

- [ ] **Step 1: Update `getCommunityFull` in `CommunityService.ts`**

Add the `OrganizationMembershipType` import at the top:
```ts
import { OrganizationMembershipType } from "../database/entities/OrganizationMembershipType";
```

Insert a membership-type lookup right after the existing `atMap` block (after `const atMap = Object.fromEntries(availabilityTypes.map((t) => [t.id, t]));`, before `return { ...community, ...`):
```ts
    const membershipTypes = await AppDataSource.getRepository(OrganizationMembershipType).find({
        where: { community_id: communityId },
        order: { sort_order: "ASC" },
    });
    const mtMap = Object.fromEntries(membershipTypes.map((t) => [t.id, t]));
```

Replace, inside the `members: memberships.map((m) => { ... })` block:
```ts
                isAdmin: m.is_admin,
                isAspirant: m.is_aspirant,
                isActivePartner: m.is_active_partner,
                joinedAt: m.joined_at,
```
with:
```ts
                isAdmin: m.is_admin,
                membershipTypeId: m.membership_type_id,
                membershipType: m.membership_type_id && mtMap[m.membership_type_id]
                    ? { id: mtMap[m.membership_type_id].id, name: mtMap[m.membership_type_id].name, emoji: mtMap[m.membership_type_id].emoji }
                    : null,
                joinedAt: m.joined_at,
```

- [ ] **Step 2: Update `getCommunityGraph` in `CommunityService.ts`**

Replace, inside the `persons: communityMemberships.map((cm) => { ... })` block:
```ts
                id: cm.person_id,
                firstName: person?.first_name ?? null,
                lastName: person?.last_name ?? null,
                isAspirant: cm.is_aspirant,
                isAdmin: cm.is_admin,
```
with:
```ts
                id: cm.person_id,
                firstName: person?.first_name ?? null,
                lastName: person?.last_name ?? null,
                isAdmin: cm.is_admin,
```

- [ ] **Step 3: Update `AuthController.ts`**

Replace, inside `getMembershipsForPerson`:
```ts
    return memberships.map((m) => ({
        communityId: m.community_id,
        isAdmin: m.is_admin,
        isAspirant: m.is_aspirant,
        community: communities.find((c) => c.id === m.community_id),
    }));
```
with:
```ts
    return memberships.map((m) => ({
        communityId: m.community_id,
        isAdmin: m.is_admin,
        community: communities.find((c) => c.id === m.community_id),
    }));
```

Replace, inside `getMe`:
```ts
        memberships: memberships.map((m) => ({
            communityId: m.community_id,
            isAdmin: m.is_admin,
            isAspirant: m.is_aspirant,
            community: communities.find((c) => c.id === m.community_id),
        })),
```
with:
```ts
        memberships: memberships.map((m) => ({
            communityId: m.community_id,
            isAdmin: m.is_admin,
            community: communities.find((c) => c.id === m.community_id),
        })),
```

- [ ] **Step 4: Verify**

```bash
cd api && npx tsc --noEmit && npm test
```
Expected: no errors, all suites pass.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/CommunityService.ts api/src/controllers/AuthController.ts
git commit -m "refactor: migrate community/auth DTOs off isAspirant/isActivePartner"
```

---

### Task 10: Frontend migration — graph/card views and dead filter removal

**Files:**
- Modify: `app/src/views/CardGrid.jsx`
- Modify: `app/src/views/graph/PersonNode.jsx`
- Modify: `app/src/views/graph/useGraphData.js`
- Modify: `app/src/views/OrganogramView.jsx`
- Modify: `app/src/context/UserContext.jsx`

**Interfaces:**
- Consumes: `getCommunityFull`'s new `membershipType: { id, name, emoji } | null` field (Task 9) for the badge in `CardGrid.jsx`; `getCommunityGraph`'s persons no longer carry `isAspirant` (Task 9).
- Produces: solid-circle styling everywhere (no more dashed/faded "aspirant" treatment); dead `showAspirants` filter fully removed from state, filtering logic, and initial filter object.

- [ ] **Step 1: `CardGrid.jsx` — drop dead filter, solid circle, generic badge**

Replace:
```jsx
      .filter((m) => filter.showUnavailable !== false || !m.availability)
      .filter((m) => filter.showAspirants !== false || !m.isAspirant)
      .filter((m) => !q ||
```
with:
```jsx
      .filter((m) => filter.showUnavailable !== false || !m.availability)
      .filter((m) => !q ||
```

Replace:
```jsx
            <circle r={r} fill={wgColor} fillOpacity={m.isAspirant ? 0.35 : 0.85}
              stroke={m.isAspirant ? wgColor : 'white'} strokeWidth={1}
              strokeDasharray={m.isAspirant ? '3,2' : 'none'} />
```
with:
```jsx
            <circle r={r} fill={wgColor} fillOpacity={0.85} stroke="white" strokeWidth={1} />
```

Replace:
```jsx
        {m.firstName || m.lastName || 'Unknown'}{showLastInitial && m.lastName ? ` ${m.lastName[0]}.` : ''}
        {m.isAspirant && (
          <span style={{ marginLeft: 5, fontSize: '0.72rem', color: 'var(--color-charcoal-light)', fontStyle: 'italic' }}>
            aspirant
          </span>
        )}
```
with:
```jsx
        {m.firstName || m.lastName || 'Unknown'}{showLastInitial && m.lastName ? ` ${m.lastName[0]}.` : ''}
        {m.membershipType && (
          <span style={{ marginLeft: 5, fontSize: '0.72rem', color: 'var(--color-charcoal-light)', fontStyle: 'italic' }}>
            {m.membershipType.emoji ? `${m.membershipType.emoji} ` : ''}{m.membershipType.name}
          </span>
        )}
```

- [ ] **Step 2: `PersonNode.jsx` — solid circle only**

Replace:
```jsx
      <circle
        r={r}
        fill={node.isUnassigned ? '#ccc' : node.color}
        fillOpacity={node.isAspirant ? 0.35 : 0.85}
        stroke={node.isUnassigned ? '#aaa' : (node.isAspirant ? node.color : 'white')}
        strokeWidth={node.isAspirant ? 2 : 1.5}
        strokeDasharray={node.isAspirant ? '3,2' : 'none'}
        opacity={opacity}
      />
```
with:
```jsx
      <circle
        r={r}
        fill={node.isUnassigned ? '#ccc' : node.color}
        fillOpacity={0.85}
        stroke={node.isUnassigned ? '#aaa' : 'white'}
        strokeWidth={1.5}
        opacity={opacity}
      />
```

- [ ] **Step 3: `useGraphData.js` — remove dead filter and field**

Replace:
```js
    let visiblePersons = persons
    if (!filters.showUnavailable) visiblePersons = visiblePersons.filter(p => !p.availability)
    if (!filters.showAspirants) visiblePersons = visiblePersons.filter(p => !p.isAspirant)
    if (filters.workgroupId) {
```
with:
```js
    let visiblePersons = persons
    if (!filters.showUnavailable) visiblePersons = visiblePersons.filter(p => !p.availability)
    if (filters.workgroupId) {
```

Replace:
```js
        name: [p.firstName, p.lastName].filter(Boolean).join(' '),
        isAspirant: p.isAspirant,
        isUnassigned: p.memberships.length === 0,
```
with:
```js
        name: [p.firstName, p.lastName].filter(Boolean).join(' '),
        isUnassigned: p.memberships.length === 0,
```

- [ ] **Step 4: `OrganogramView.jsx` — remove dead `showAspirants` from initial filter**

Replace:
```jsx
const INITIAL_FILTER = { workgroupId: '', roleName: '', showUnavailable: true, showAspirants: true, search: '' }
```
with:
```jsx
const INITIAL_FILTER = { workgroupId: '', roleName: '', showUnavailable: true, search: '' }
```

- [ ] **Step 5: `UserContext.jsx` — update stale comment**

Replace:
```jsx
  const [memberships, setMemberships] = useState([]) // [{communityId, isAdmin, isAspirant, community}]
```
with:
```jsx
  const [memberships, setMemberships] = useState([]) // [{communityId, isAdmin, community}]
```

- [ ] **Step 6: Verify**

Start the frontend dev server (`npm run dev` from `app/`) and the API (`npm run dev` from `api/`). Log in via dev login, open the Organogram view in both Graph and Cards mode, confirm:
- No console errors about undefined `isAspirant`/`showAspirants`.
- Cards view renders solid circles (no dashed circles) and shows a membership-type badge (e.g. "🌱 Aspirant") for members that have one, nothing for members with `membershipType: null`.
- Graph view renders solid circles for every person, no crash.

- [ ] **Step 7: Commit**

```bash
git add app/src/views/CardGrid.jsx app/src/views/graph/PersonNode.jsx app/src/views/graph/useGraphData.js app/src/views/OrganogramView.jsx app/src/context/UserContext.jsx
git commit -m "refactor: migrate graph/card views off isAspirant, drop dead showAspirants filter"
```

---

### Task 11: Frontend migration — admin Members tab, PersonModal, InfoPanel

**Files:**
- Modify: `app/src/views/admin/MembersTab.jsx`
- Modify: `app/src/components/PersonModal.jsx`
- Modify: `app/src/components/InfoPanel.jsx`

**Interfaces:**
- Consumes: `listMembershipTypes(cid)` client function from Task 7; `membershipTypeId`/`membershipType` fields from Task 9's `getCommunityFull`.
- Produces: `MembersTab.jsx`'s add-member form and per-row control use a single membership-type `<select>` instead of two checkboxes; `PersonModal.jsx`/`InfoPanel.jsx`'s badge rows render one generic membership-type badge instead of the `isAspirant`/`isActivePartner` pair.

- [ ] **Step 1: Rewrite `MembersTab.jsx`**

Replace the whole file:
```jsx
import { useState, useEffect } from 'react'
import { useCommunity } from '../../context/CommunityContext'
import { addMember, updateMember, updateMemberPerson, removeMember, listMembershipTypes } from '../../api/client'

const inputStyle = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', fontSize: '0.9rem', background: 'white' }

export default function MembersTab() {
  const { communityId, community, refresh } = useCommunity()
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState({ first_name: '', last_name: '', email: '', membership_type_id: '', joined_at: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [membershipTypes, setMembershipTypes] = useState([])

  useEffect(() => {
    listMembershipTypes(communityId).then(setMembershipTypes).catch(() => setMembershipTypes([]))
  }, [communityId])

  async function handleAdd(e) {
    e.preventDefault()
    setAddSaving(true)
    try {
      const { membership_type_id, joined_at, ...rest } = addForm
      const newMembership = await addMember(communityId, rest)
      const extras = {}
      if (membership_type_id) extras.membership_type_id = membership_type_id
      if (joined_at) extras.joined_at = joined_at
      if (Object.keys(extras).length) await updateMember(communityId, newMembership.person_id, extras)
      await refresh()
      setAdding(false)
      setAddForm({ first_name: '', last_name: '', email: '', membership_type_id: '', joined_at: '' })
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setAddSaving(false)
    }
  }

  async function handleUpdate(pid, data) {
    try {
      await updateMember(communityId, pid, data)
      await refresh()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  async function handleRemove(pid, name) {
    if (!confirm(`Remove ${name} from this community?`)) return
    try {
      await removeMember(communityId, pid)
      await refresh()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-title)' }}>Members</h3>
        <button className="btn-primary" onClick={() => setAdding(true)} style={{ fontSize: '0.85rem' }}>Add member</button>
      </div>

      {adding && (
        <div className="card-warm" style={{ padding: 20, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 16px' }}>Add member</h4>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>First name</label>
              <input style={inputStyle} value={addForm.first_name} onChange={(e) => setAddForm((f) => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>Last name</label>
              <input style={inputStyle} value={addForm.last_name} onChange={(e) => setAddForm((f) => ({ ...f, last_name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>Email</label>
              <input type="email" style={inputStyle} value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>Joined</label>
              <input type="date" style={inputStyle} value={addForm.joined_at} onChange={(e) => setAddForm((f) => ({ ...f, joined_at: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem', fontWeight: 500 }}>Membership type</label>
              <select style={inputStyle} value={addForm.membership_type_id} onChange={(e) => setAddForm((f) => ({ ...f, membership_type_id: e.target.value }))}>
                <option value="">—</option>
                {membershipTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.emoji ? `${t.emoji} ` : ''}{t.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <button type="submit" className="btn-primary" disabled={addSaving} style={{ fontSize: '0.85rem' }}>Add</button>
              <button type="button" className="btn-secondary" onClick={() => setAdding(false)} style={{ fontSize: '0.85rem' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead style={{ borderBottom: '2px solid var(--color-sand)' }}>
            <tr>
              {['Name', 'Email', 'eName', 'Membership type', 'Joined', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...(community?.members || [])].sort((a, b) => (a.firstName || '').localeCompare(b.firstName || '')).map((m, idx) => {
              const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || 'Unknown'
              return (
                <tr key={m.personId} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--color-cream)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{name}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-charcoal-light)', fontSize: '0.85rem' }}>{m.email || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <input
                      style={{ ...inputStyle, fontSize: '0.8rem', padding: '4px 8px', width: 200, fontFamily: 'monospace' }}
                      defaultValue={m.ename || ''}
                      placeholder="@uuid…"
                      onBlur={(e) => {
                        const val = e.target.value.trim() || null
                        if (val !== (m.ename || null)) updateMemberPerson(communityId, m.personId, { ename: val }).then(refresh).catch((err) => alert(err.message))
                      }}
                    />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <select
                      style={{ ...inputStyle, fontSize: '0.8rem', padding: '4px 8px' }}
                      value={m.membershipTypeId || ''}
                      onChange={(e) => handleUpdate(m.personId, { membership_type_id: e.target.value || null })}
                    >
                      <option value="">—</option>
                      {membershipTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.emoji ? `${t.emoji} ` : ''}{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <input
                      type="date"
                      value={m.joinedAt ? m.joinedAt.slice(0, 10) : ''}
                      onChange={(e) => handleUpdate(m.personId, { joined_at: e.target.value || null })}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-sand-dark)', fontSize: '0.85rem' }}
                    />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => handleRemove(m.personId, name)}
                      title="Remove from community"
                      style={{ background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer', padding: '2px 4px', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `PersonModal.jsx` — generic badge**

Replace:
```jsx
                {member.isAdmin && <span style={{ fontSize: '0.75rem', background: 'var(--color-sand)', borderRadius: 4, padding: '2px 8px' }}>Admin</span>}
                {member.isAspirant && <span style={{ fontSize: '0.75rem', background: '#FFF3CD', borderRadius: 4, padding: '2px 8px' }}>Aspirant</span>}
                {member.isActivePartner && <span style={{ fontSize: '0.75rem', background: '#E8F5E9', borderRadius: 4, padding: '2px 8px' }}>Active partner</span>}
```
with:
```jsx
                {member.isAdmin && <span style={{ fontSize: '0.75rem', background: 'var(--color-sand)', borderRadius: 4, padding: '2px 8px' }}>Admin</span>}
                {member.membershipType && (
                  <span style={{ fontSize: '0.75rem', background: '#FFF3CD', borderRadius: 4, padding: '2px 8px' }}>
                    {member.membershipType.emoji ? `${member.membershipType.emoji} ` : ''}{member.membershipType.name}
                  </span>
                )}
```

- [ ] **Step 3: `InfoPanel.jsx` — generic badge**

Replace:
```jsx
            {member.isAdmin && <span style={{ fontSize: '0.68rem', background: 'var(--color-sand)', borderRadius: 4, padding: '1px 6px' }}>Admin</span>}
            {member.isAspirant && <span style={{ fontSize: '0.68rem', background: '#FFF3CD', borderRadius: 4, padding: '1px 6px' }}>Aspirant</span>}
            {member.isActivePartner && <span style={{ fontSize: '0.68rem', background: '#E8F5E9', borderRadius: 4, padding: '1px 6px' }}>Active partner</span>}
```
with:
```jsx
            {member.isAdmin && <span style={{ fontSize: '0.68rem', background: 'var(--color-sand)', borderRadius: 4, padding: '1px 6px' }}>Admin</span>}
            {member.membershipType && (
              <span style={{ fontSize: '0.68rem', background: '#FFF3CD', borderRadius: 4, padding: '1px 6px' }}>
                {member.membershipType.emoji ? `${member.membershipType.emoji} ` : ''}{member.membershipType.name}
              </span>
            )}
```

- [ ] **Step 4: Verify**

With API and frontend dev servers running, open `/admin/members` for a community: confirm the add-member form shows a "Membership type" dropdown (not two checkboxes), the table shows a "Membership type" column with a working per-row select, and changing it persists after refresh. Open a person's card/node to confirm `PersonModal`/`InfoPanel` show a single membership-type badge (e.g. "🌱 Aspirant") instead of the old Aspirant/Active partner pair.

- [ ] **Step 5: Commit**

```bash
git add app/src/views/admin/MembersTab.jsx app/src/components/PersonModal.jsx app/src/components/InfoPanel.jsx
git commit -m "refactor: migrate MembersTab/PersonModal/InfoPanel to configurable membership types"
```

---

### Task 12: Final cleanup — drop legacy columns

**Files:**
- Modify: `api/src/database/entities/Community.ts`
- Modify: `api/src/database/entities/CommunityMembership.ts`

**Interfaces:** none new — this task only removes dead columns now that Tasks 6-11 have migrated every call site.

- [ ] **Step 1: Grep-verify no remaining references**

```bash
grep -rn "is_aspirant\|is_active_partner\|community_envelope_id" /home/serzhilin/Projects/CORE/api/src /home/serzhilin/Projects/CORE/app/src
```
Expected: zero matches. If any remain, they were missed by an earlier task — go fix that task's file before continuing (do not patch around it here).

- [ ] **Step 2: Drop the three columns from `Community.ts`**

Remove:
```ts
    // MetaEnvelope ID of this community's Chat envelope (group identity), set on link.
    @Column({ type: "text", nullable: true })
    community_envelope_id: string | null;
```

- [ ] **Step 3: Drop the two columns from `CommunityMembership.ts`**

Remove:
```ts
    @Column({ default: false })
    is_aspirant: boolean;

    @Column({ default: false })
    is_active_partner: boolean;
```

Also update the now-stale comment on `meta_envelope_id` (it still references "the community's Chat envelope participantIds", which no longer exists):
```ts
    // MetaEnvelope ID of the member's User profile, cached once resolved — feeds the
    // Organization envelope's members[].participantId on every sync.
    @Column({ type: "varchar", nullable: true })
    meta_envelope_id: string | null;
```

- [ ] **Step 4: Apply the column drops to the dev database**

Start the API dev server briefly (TypeORM `synchronize: true` will detect the entity no longer declares these columns — note that TypeORM's `synchronize` does not drop columns automatically by default in some configurations; if the columns are not dropped automatically after restart, drop them explicitly):
```bash
PGPASSWORD=core psql -h localhost -p 5436 -U core -d core -c "ALTER TABLE communities DROP COLUMN IF EXISTS community_envelope_id;" -c "ALTER TABLE community_memberships DROP COLUMN IF EXISTS is_aspirant, DROP COLUMN IF EXISTS is_active_partner;"
```
Expected: `ALTER TABLE` x2.

- [ ] **Step 5: Full verification**

```bash
cd api && npx tsc --noEmit && npm test
```
Expected: no errors, all suites pass (organizationPayload, workgroupPayload, and any other pre-existing suites).

```bash
PGPASSWORD=core psql -h localhost -p 5436 -U core -d core -c "\d communities" -c "\d community_memberships"
```
Expected: neither table shows the three dropped columns.

Manually re-verify in the browser: Organogram (both views), admin Members tab, PersonModal, InfoPanel all still work with no console errors, matching the checks already done in Tasks 10/11.

- [ ] **Step 6: Commit**

```bash
git add api/src/database/entities/Community.ts api/src/database/entities/CommunityMembership.ts
git commit -m "chore: drop legacy is_aspirant/is_active_partner/community_envelope_id columns"
```
