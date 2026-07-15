# Workgroup & Community Chat Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the W3DS Chat ontology (schemaId `550e8400-e29b-41d4-a716-446655440003`, already mapped as `ONTOLOGIES.Community`) so every linked community has a chat containing exactly its current membership, every workgroup gets its own chat, and CORE keeps both in sync one-directionally (CORE → chat) without clobbering fields other platforms write into the shared community chat envelope.

**Architecture:** Two ownership models. Community chat is shared with other platforms (ALVer writes `charter`/`owner`/`admins`/`signatureIds` there) — every CORE write is fetch-current → merge-in-CORE-owned-fields → write-back-full-payload. Workgroup chats are CORE-owned but membership sync is always incremental (single add/remove), never a full-roster rebuild, so joins/leaves made in other apps survive CORE's writes. Pure payload-merging logic lives in a new `chatPayloadHelpers.ts` (tested); the impure eVault/DB orchestration lives in a new `ChatService.ts` (untested, matching this codebase's existing convention — see Global Constraints).

**Tech Stack:** Node.js/Express/TypeORM/PostgreSQL backend (`api/`), React 19/Vite frontend (`app/`), Jest + ts-jest for tests, W3DS eVault GraphQL for sync.

## Global Constraints

- `updateEnvelope` (`api/src/lib/evault-client.ts`) replaces the full payload — no partial-field update exists. Every write to a shared or existing envelope must fetch-current first.
- `getEnvelope` and `findEnvelopesByOntology` are fail-soft: they catch their own errors, log a warn, and return `null`/`[]`. They never throw. Code that needs a synchronous/delete-class failure to propagate must explicitly check for a null/empty result and throw itself — do not rely on these helpers to throw.
- Chat ontology reused for both community and workgroup chats: import `ONTOLOGIES.Community` from `api/src/lib/w3ds/ontology` for every chat envelope create/update in this feature (existing constant name, not renamed — renaming it is out of scope).
- Community chat CORE-owned fields: `name`, `description`, `avatar`, `participantIds`, `members`, `updatedAt`. Never touch `type`, `charter`, `owner`, `admins`, `signatureIds`, `createdAt`, `lastMessageId`, `isArchived`, `ename` — always carry these through unmodified from the fetched payload.
- Workgroup chat name format is exactly `"<community name>: <workgroup name>"` (colon-space separator, no other punctuation).
- Fire-and-forget for create/update-class syncs: `.catch((err) => logger.warn(err, ...))`, never blocks the Postgres write. Synchronous/delete-class syncs: `await`, let the error throw and block the corresponding Postgres mutation. This matches the existing `WorkgroupService.ts`/`MemberService.ts`/`OrganizationService.ts` convention (per `feedback_evault_source_of_truth`: deletes must be loud, not silent).
- Workgroup-chat membership sync is one-directional CORE → chat only: no code path in this feature ever reads a workgroup chat's `participantIds` back into Postgres.
- `alsoRemoveFromChat` (new `removeWorkgroupMember` param) defaults to `false`. Only two call sites ever pass `true`: `MemberService.removeMember`'s cascade loop, and the frontend's user-confirmed self-leave flow.
- Test convention: this codebase tests pure functions only (see `AvailabilityService.test.ts`, `organizationPayload.test.ts`, `workgroupPayload.test.ts`). No existing service file that calls `AppDataSource` or `evault-client` has a test file. `ChatService.ts` and every hook-wiring edit in this plan follow that precedent — verified by `npx tsc --noEmit` and `npm test` (regression-only), not new unit tests. Only `chatPayloadHelpers.ts` (pure) gets TDD'd tests.
- Indentation: every file this plan touches or creates uses 4-space indentation, matching `WorkgroupService.ts`/`CommunityService.ts`/`MemberService.ts`/`organizationPayload.ts`/`workgroupPayload.ts` — **except** `OrganizationService.ts`, which uses tabs; preserve tabs exactly in the one line added there.
- No Postgres migration framework exists in this repo (pre-existing gap, `data-source.ts`'s `synchronize` is `!isProduction`-gated only). New columns ship as hand-written SQL in `docs/superpowers/migrations/2026-07-15-chat-envelope-columns.sql`, applied manually to prod — not part of any task's automated steps.

---

### Task 1: Pure chat payload helpers

**Files:**
- Create: `api/src/services/chatPayloadHelpers.ts`
- Test: `api/src/services/__tests__/chatPayloadHelpers.test.ts`

**Interfaces:**
- Produces: `mergeCommunityChatFields(current: Record<string, unknown>, fields: CommunityChatFields): Record<string, unknown>`, `addParticipant(current: Record<string, unknown>, participantId: string, memberEname: string): Record<string, unknown>`, `removeParticipant(current: Record<string, unknown>, participantId: string, memberEname: string): Record<string, unknown>`, `renameChat(current: Record<string, unknown>, name: string): Record<string, unknown>`, `archiveChat(current: Record<string, unknown>): Record<string, unknown>`, `buildNewChatPayload(input: NewChatInput): Record<string, unknown>`, plus exported interfaces `CommunityChatFields` and `NewChatInput`. Task 3 imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `api/src/services/__tests__/chatPayloadHelpers.test.ts`:

```ts
import {
    mergeCommunityChatFields,
    addParticipant,
    removeParticipant,
    renameChat,
    archiveChat,
    buildNewChatPayload,
} from "../chatPayloadHelpers";

describe("mergeCommunityChatFields", () => {
    it("overwrites owned fields and preserves foreign fields untouched", () => {
        const current = {
            type: "group",
            name: "Old name",
            description: "Old desc",
            avatar: "old.png",
            participantIds: ["old-1"],
            members: ["@old1"],
            charter: "Cooperative charter text",
            owner: "@owner",
            admins: ["admin-meta-1"],
            signatureIds: [],
            createdAt: "2020-01-01T00:00:00.000Z",
            lastMessageId: "msg-1",
            isArchived: false,
        };
        const result = mergeCommunityChatFields(current, {
            name: "New name",
            description: "New desc",
            avatar: "new.png",
            participantIds: ["p1", "p2"],
            members: ["@p1", "@p2"],
        });
        expect(result.name).toBe("New name");
        expect(result.description).toBe("New desc");
        expect(result.avatar).toBe("new.png");
        expect(result.participantIds).toEqual(["p1", "p2"]);
        expect(result.members).toEqual(["@p1", "@p2"]);
        expect(result.charter).toBe("Cooperative charter text");
        expect(result.owner).toBe("@owner");
        expect(result.admins).toEqual(["admin-meta-1"]);
        expect(result.signatureIds).toEqual([]);
        expect(result.createdAt).toBe("2020-01-01T00:00:00.000Z");
        expect(result.lastMessageId).toBe("msg-1");
        expect(result.isArchived).toBe(false);
    });

    it("sets updatedAt to a fresh ISO timestamp", () => {
        const result = mergeCommunityChatFields(
            {},
            { name: "N", description: null, avatar: null, participantIds: [], members: [] }
        );
        expect(typeof result.updatedAt).toBe("string");
        expect(() => new Date(result.updatedAt as string).toISOString()).not.toThrow();
    });
});

describe("addParticipant", () => {
    it("adds a new participant id and eName", () => {
        const result = addParticipant({ participantIds: ["p1"], members: ["@p1"] }, "p2", "@p2");
        expect(result.participantIds).toEqual(["p1", "p2"]);
        expect(result.members).toEqual(["@p1", "@p2"]);
    });

    it("is idempotent — adding an existing participant is a no-op", () => {
        const result = addParticipant({ participantIds: ["p1"], members: ["@p1"] }, "p1", "@p1");
        expect(result.participantIds).toEqual(["p1"]);
        expect(result.members).toEqual(["@p1"]);
    });

    it("preserves unrelated fields", () => {
        const result = addParticipant({ participantIds: [], members: [], charter: "text" }, "p1", "@p1");
        expect(result.charter).toBe("text");
    });

    it("defaults to empty arrays when current has no participantIds/members", () => {
        const result = addParticipant({}, "p1", "@p1");
        expect(result.participantIds).toEqual(["p1"]);
        expect(result.members).toEqual(["@p1"]);
    });
});

describe("removeParticipant", () => {
    it("removes an existing participant id and eName", () => {
        const result = removeParticipant(
            { participantIds: ["p1", "p2"], members: ["@p1", "@p2"] },
            "p1",
            "@p1"
        );
        expect(result.participantIds).toEqual(["p2"]);
        expect(result.members).toEqual(["@p2"]);
    });

    it("is safe when the participant is already absent", () => {
        const result = removeParticipant({ participantIds: ["p2"], members: ["@p2"] }, "p1", "@p1");
        expect(result.participantIds).toEqual(["p2"]);
        expect(result.members).toEqual(["@p2"]);
    });

    it("preserves unrelated fields", () => {
        const result = removeParticipant(
            { participantIds: ["p1"], members: ["@p1"], owner: "@owner" },
            "p1",
            "@p1"
        );
        expect(result.owner).toBe("@owner");
    });
});

describe("renameChat", () => {
    it("sets name and preserves everything else", () => {
        const result = renameChat({ name: "Old", isArchived: false }, "New");
        expect(result.name).toBe("New");
        expect(result.isArchived).toBe(false);
    });
});

describe("archiveChat", () => {
    it("sets isArchived true and preserves everything else", () => {
        const result = archiveChat({ name: "Keep", isArchived: false });
        expect(result.isArchived).toBe(true);
        expect(result.name).toBe("Keep");
    });
});

describe("buildNewChatPayload", () => {
    it("builds a group-type envelope with given name/participants", () => {
        const result = buildNewChatPayload({
            name: "de Woonwolk: Activities",
            participantIds: ["p1"],
            members: ["@p1"],
        });
        expect(result.type).toBe("group");
        expect(result.name).toBe("de Woonwolk: Activities");
        expect(result.participantIds).toEqual(["p1"]);
        expect(result.members).toEqual(["@p1"]);
        expect(result.isArchived).toBe(false);
        expect(typeof result.createdAt).toBe("string");
        expect(result.createdAt).toBe(result.updatedAt);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && npx jest chatPayloadHelpers --no-coverage`
Expected: FAIL — `Cannot find module '../chatPayloadHelpers'`

- [ ] **Step 3: Write the implementation**

Create `api/src/services/chatPayloadHelpers.ts`:

```ts
export interface CommunityChatFields {
    name: string;
    description: string | null;
    avatar: string | null;
    participantIds: string[];
    members: string[];
}

/** Merges CORE-owned fields into an existing Chat envelope payload, preserving every
 *  field CORE doesn't own (charter, owner, admins, signatureIds, type, createdAt,
 *  lastMessageId, isArchived, ename) untouched. */
export function mergeCommunityChatFields(
    current: Record<string, unknown>,
    fields: CommunityChatFields
): Record<string, unknown> {
    return {
        ...current,
        name: fields.name,
        description: fields.description,
        avatar: fields.avatar,
        participantIds: fields.participantIds,
        members: fields.members,
        updatedAt: new Date().toISOString(),
    };
}

/** Adds one participant to a Chat envelope's participantIds/members, idempotently. */
export function addParticipant(
    current: Record<string, unknown>,
    participantId: string,
    memberEname: string
): Record<string, unknown> {
    const participantIds = Array.isArray(current.participantIds) ? (current.participantIds as string[]) : [];
    const members = Array.isArray(current.members) ? (current.members as string[]) : [];
    return {
        ...current,
        participantIds: participantIds.includes(participantId) ? participantIds : [...participantIds, participantId],
        members: members.includes(memberEname) ? members : [...members, memberEname],
    };
}

/** Removes one participant from a Chat envelope's participantIds/members, safely if absent. */
export function removeParticipant(
    current: Record<string, unknown>,
    participantId: string,
    memberEname: string
): Record<string, unknown> {
    const participantIds = Array.isArray(current.participantIds) ? (current.participantIds as string[]) : [];
    const members = Array.isArray(current.members) ? (current.members as string[]) : [];
    return {
        ...current,
        participantIds: participantIds.filter((id) => id !== participantId),
        members: members.filter((m) => m !== memberEname),
    };
}

/** Renames a Chat envelope, touching only the name field. */
export function renameChat(current: Record<string, unknown>, name: string): Record<string, unknown> {
    return { ...current, name };
}

/** Archives a Chat envelope, touching only isArchived. */
export function archiveChat(current: Record<string, unknown>): Record<string, unknown> {
    return { ...current, isArchived: true };
}

export interface NewChatInput {
    name: string;
    participantIds: string[];
    members: string[];
}

/** Builds a brand-new Chat envelope payload (group type) for createEnvelope. */
export function buildNewChatPayload(input: NewChatInput): Record<string, unknown> {
    const now = new Date().toISOString();
    return {
        type: "group",
        name: input.name,
        participantIds: input.participantIds,
        members: input.members,
        createdAt: now,
        updatedAt: now,
        isArchived: false,
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd api && npx jest chatPayloadHelpers --no-coverage`
Expected: PASS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add api/src/services/chatPayloadHelpers.ts api/src/services/__tests__/chatPayloadHelpers.test.ts
git commit -m "$(cat <<'EOF'
Add pure chat payload helper functions

Extracted from the upcoming ChatService.ts orchestration layer so the
field-merging/participant-splicing logic is unit-testable, matching
this codebase's existing convention of testing pure functions only.
EOF
)"
```

---

### Task 2: Data model — entity columns and payload `chatId` fields

**Files:**
- Modify: `api/src/database/entities/Community.ts`
- Modify: `api/src/database/entities/Workgroup.ts`
- Modify: `api/src/services/organizationPayload.ts`
- Modify: `api/src/services/workgroupPayload.ts`
- Modify: `api/src/services/OrganizationService.ts` (thread `chatId` through the existing `buildOrganizationPayload` call)
- Test: `api/src/services/__tests__/organizationPayload.test.ts`
- Test: `api/src/services/__tests__/workgroupPayload.test.ts`
- Create: `docs/superpowers/migrations/2026-07-15-chat-envelope-columns.sql`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `Community.chat_envelope_id: string | null`, `Workgroup.chat_envelope_id: string | null` — Task 3 and Task 4/5/6 read/write these columns. `OrganizationPayloadInput.chatId: string | null` and `WorkgroupPayloadInput.chatId: string | null` — Task 4/5 pass these through when calling `syncWorkgroupToEvault`/`syncOrganizationToEvault`.

- [ ] **Step 1: Write the failing tests**

In `api/src/services/__tests__/organizationPayload.test.ts`, add `chatId: null as string | null,` to `BASE_INPUT` (after `admins: [],`):

```ts
const BASE_INPUT = {
    communityEname: "@de68861c-8ea9-55be-9258-2a8cc3057a60",
    name: null as string | null,
    legalForm: null as string | null,
    officialName: null as string | null,
    kvkNumber: null as string | null,
    rsin: null as string | null,
    iban: null as string | null,
    registeredAddress: null as string | null,
    foundingDate: null as string | null,
    statutenFileUri: null as string | null,
    logoUrl: null as string | null,
    photoUrl: null as string | null,
    primaryColor: "#C4622D",
    titleFont: "Playfair Display",
    membershipTypes: [],
    members: [],
    admins: [],
    chatId: null as string | null,
};
```

Add a new `describe` block at the end of the file, before the closing of the outer `describe("buildOrganizationPayload", ...)`:

```ts
    it("maps chatId verbatim, including null", () => {
        const nullResult = buildOrganizationPayload(BASE_INPUT);
        expect(nullResult.chatId).toBeNull();

        const setResult = buildOrganizationPayload({ ...BASE_INPUT, chatId: "chat-env-1" });
        expect(setResult.chatId).toBe("chat-env-1");
    });
```

In `api/src/services/__tests__/workgroupPayload.test.ts`, add `chatId: null as string | null,` to `BASE_INPUT` (after `members: [],`):

```ts
const BASE_INPUT = {
    communityEname: "@de68861c-8ea9-55be-9258-2a8cc3057a60",
    name: "Interiors wg",
    description: null as string | null,
    color: "#5D8C1E",
    createdAt: new Date("2026-07-10T08:35:27.573Z"),
    updatedAt: new Date("2026-07-10T09:20:00.000Z"),
    roles: [],
    members: [],
    chatId: null as string | null,
};
```

Add a new test at the end of the file, before the closing of `describe("buildWorkgroupPayload", ...)`:

```ts
    it("omits chatId key when null, includes it when present", () => {
        const nullResult = buildWorkgroupPayload(BASE_INPUT);
        expect("chatId" in nullResult).toBe(false);

        const setResult = buildWorkgroupPayload({ ...BASE_INPUT, chatId: "chat-env-1" });
        expect(setResult.chatId).toBe("chat-env-1");
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && npx jest organizationPayload workgroupPayload --no-coverage`
Expected: FAIL — `chatId` does not exist on type `OrganizationPayloadInput`/`WorkgroupPayloadInput` (ts-jest compile error), or assertion failures if types are loose.

- [ ] **Step 3: Implement entity columns**

In `api/src/database/entities/Community.ts`, after the `availability_envelope_id` column (line 40):

```ts
    @Column({ type: "text", nullable: true })
    availability_envelope_id: string | null;

    // MetaEnvelope ID of this community's Chat/Group envelope, shared with other
    // W3DS platforms (e.g. ALVer). Null until first linked/created.
    @Column({ type: "text", nullable: true })
    chat_envelope_id: string | null;

```

In `api/src/database/entities/Workgroup.ts`, after the `envelope_id` column (line 25):

```ts
    // MetaEnvelope ID of this workgroup's own envelope in the community's eVault. Null until first synced.
    @Column({ type: "text", nullable: true })
    envelope_id: string | null;

    // MetaEnvelope ID of this workgroup's own Chat/Group envelope. Null until first created.
    @Column({ type: "text", nullable: true })
    chat_envelope_id: string | null;

```

- [ ] **Step 4: Implement payload builder changes**

In `api/src/services/organizationPayload.ts`, add `chatId: string | null;` to `OrganizationPayloadInput` (after `admins: string[];`) and to `OrganizationEnvelopePayload` (after `name: string | null;`), and thread it through the return in `buildOrganizationPayload`:

```ts
export interface OrganizationPayloadInput {
    communityEname: string;
    name: string | null;
    legalForm: string | null;
    officialName: string | null;
    kvkNumber: string | null;
    rsin: string | null;
    iban: string | null;
    registeredAddress: string | null;
    foundingDate: string | null;
    statutenFileUri: string | null;
    logoUrl: string | null;
    photoUrl: string | null;
    primaryColor: string;
    titleFont: string;
    membershipTypes: OrganizationPayloadMembershipType[];
    members: OrganizationPayloadMember[];
    admins: string[];
    chatId: string | null;
}
```

```ts
export interface OrganizationEnvelopePayload {
    name: string | null;
    chatId: string | null;
    legalInfo: LegalInfoPayload;
    branding: BrandingPayload;
    membershipTypes: MembershipTypePayload[];
    members: OrganizationPayloadMember[];
    admins: string[];
}
```

```ts
    return {
        name: input.name,
        chatId: input.chatId,
        legalInfo,
        branding: {
            logoUrl: input.logoUrl,
            photoUrl: input.photoUrl,
            primaryColor: input.primaryColor,
            titleFont: input.titleFont,
        },
        membershipTypes: input.membershipTypes.map((t) => {
            const mt: MembershipTypePayload = { id: t.id, name: t.name, emoji: t.emoji };
            if (t.description) mt.description = t.description;
            return mt;
        }),
        members: input.members,
        admins: input.admins,
    };
```

In `api/src/services/workgroupPayload.ts`, add `chatId: string | null;` to `WorkgroupPayloadInput` (after `members: WorkgroupPayloadMember[];`), add optional `chatId?: string;` to `WorkgroupEnvelopePayload` (after `members: WorkgroupPayloadMember[];`), and add the same omit-if-null handling `description` already has:

```ts
export interface WorkgroupPayloadInput {
    communityEname: string;
    name: string;
    description: string | null;
    color: string;
    createdAt: Date;
    updatedAt: Date;
    roles: WorkgroupPayloadRole[];
    members: WorkgroupPayloadMember[];
    chatId: string | null;
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
    chatId?: string;
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
    if (input.chatId) payload.chatId = input.chatId;
    return payload;
}
```

- [ ] **Step 5: Thread `chatId` through `OrganizationService.ts`'s existing call site**

In `api/src/services/OrganizationService.ts`, the `buildOrganizationPayload({...})` call (tabs, not spaces — preserve exactly):

```ts
	const payload = buildOrganizationPayload({
		communityEname: community.ename,
		name: community.name,
		chatId: community.chat_envelope_id,
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
		logoUrl: community.logo_url,
		photoUrl: community.photo_url,
		primaryColor: community.primary_color,
		titleFont: community.title_font,
		membershipTypes: membershipTypes.map((t) => ({ id: t.id, name: t.name, description: t.description, emoji: t.emoji })),
		members,
		admins,
	});
```

(Only the new `chatId: community.chat_envelope_id,` line is added; everything else stays identical.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd api && npx jest organizationPayload workgroupPayload --no-coverage`
Expected: PASS

Run: `cd api && npx tsc --noEmit`
Expected: no errors (confirms `OrganizationService.ts`'s new call-site field type-checks and no other caller of these payload builders broke)

- [ ] **Step 7: Write the migration SQL file**

Create `docs/superpowers/migrations/2026-07-15-chat-envelope-columns.sql`:

```sql
-- docs/superpowers/migrations/2026-07-15-chat-envelope-columns.sql
-- Run manually against prod Postgres (no migration framework exists in this repo).
ALTER TABLE communities ADD COLUMN chat_envelope_id text;
ALTER TABLE workgroups ADD COLUMN chat_envelope_id text;
```

- [ ] **Step 8: Commit**

```bash
git add api/src/database/entities/Community.ts api/src/database/entities/Workgroup.ts \
    api/src/services/organizationPayload.ts api/src/services/workgroupPayload.ts \
    api/src/services/OrganizationService.ts \
    api/src/services/__tests__/organizationPayload.test.ts api/src/services/__tests__/workgroupPayload.test.ts \
    docs/superpowers/migrations/2026-07-15-chat-envelope-columns.sql
git commit -m "$(cat <<'EOF'
Add chat_envelope_id columns and chatId payload fields

Community/Workgroup entities gain a nullable chat_envelope_id column.
organizationPayload.ts and workgroupPayload.ts thread the new field
through so the community/workgroup's own envelope records a pointer
to its linked chat. Dev picks up the columns via synchronize:true;
prod needs the accompanying hand-written migration SQL (no migration
framework exists in this repo).
EOF
)"
```

---

### Task 3: `ChatService.ts` — community and workgroup chat orchestration

**Files:**
- Create: `api/src/services/ChatService.ts`

**Interfaces:**
- Consumes: `mergeCommunityChatFields`, `addParticipant`, `removeParticipant`, `renameChat`, `archiveChat`, `buildNewChatPayload` from `./chatPayloadHelpers` (Task 1). `createEnvelope`, `updateEnvelope`, `getEnvelope`, `getUserMetaEnvelopeId` from `../lib/evault-client`. `ONTOLOGIES.Community` from `../lib/w3ds/ontology`. `Community.chat_envelope_id`, `Workgroup.chat_envelope_id` (Task 2).
- Produces: `getOrCreateCommunityChatId(communityId: string, envelopeId: string | null): Promise<void>`, `syncCommunityChatToEvault(communityId: string): Promise<void>`, `addPersonToCommunityChat(communityId: string, personId: string): Promise<void>`, `removePersonFromCommunityChat(communityId: string, personId: string): Promise<void>` (throws on fetch failure), `cascadeCommunityRenameToWorkgroupChats(communityId: string, newCommunityName: string): Promise<void>`, `createWorkgroupChat(workgroupId: string): Promise<string | null>` (returns the new envelope id, or null if the community isn't linked; throws on eVault write failure), `renameWorkgroupChat(workgroupId: string, newWorkgroupName: string): Promise<void>`, `archiveWorkgroupChat(workgroupId: string): Promise<void>` (throws on fetch failure), `addPersonToWorkgroupChat(workgroupId: string, personId: string): Promise<void>`, `removePersonFromWorkgroupChat(workgroupId: string, personId: string): Promise<void>` (throws on fetch failure). Task 4/5/6 call all of these.

This task has no automated test file — per Global Constraints, this codebase never unit-tests functions that call `AppDataSource`/`evault-client` (see `WorkgroupService.ts`'s `syncWorkgroupToEvault`, `OrganizationService.ts`'s `syncOrganizationToEvault` — neither has a test file). Verification is `npx tsc --noEmit` plus the full existing suite staying green.

- [ ] **Step 1: Write the implementation**

Create `api/src/services/ChatService.ts`:

```ts
import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { Workgroup } from "../database/entities/Workgroup";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Person } from "../database/entities/Person";
import { createEnvelope, updateEnvelope, getEnvelope, getUserMetaEnvelopeId } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { logger } from "../lib/logger";
import {
    mergeCommunityChatFields,
    addParticipant,
    removeParticipant,
    renameChat,
    archiveChat,
    buildNewChatPayload,
} from "./chatPayloadHelpers";

// This module reuses ONTOLOGIES.Community (schemaId 550e8400-e29b-41d4-a716-446655440003)
// for BOTH the community-level chat and every workgroup chat — it is the platform's
// generic Chat/Group ontology, not specific to the community entity. The constant name
// is a pre-existing naming choice from before this feature; not renamed here.

const communityRepo = () => AppDataSource.getRepository(Community);
const workgroupRepo = () => AppDataSource.getRepository(Workgroup);
const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const personRepo = () => AppDataSource.getRepository(Person);

async function resolveParticipant(personId: string): Promise<{ metaId: string; ename: string } | null> {
    const person = await personRepo().findOne({ where: { id: personId } });
    if (!person?.ename) return null;
    let metaId = person.meta_envelope_id;
    if (!metaId) {
        metaId = await getUserMetaEnvelopeId(person.ename);
        if (metaId) await personRepo().update(person.id, { meta_envelope_id: metaId });
    }
    if (!metaId) return null;
    return { metaId, ename: person.ename };
}

// ── Community chat ──────────────────────────────────────────────────────────

/** Used once at link time. If envelopeId is set (the target eName already has a
 *  Chat/Group envelope), just persists it. If null, creates a fresh one seeded from
 *  the community being linked, so every linked community ends up with a chat. */
export async function getOrCreateCommunityChatId(communityId: string, envelopeId: string | null): Promise<void> {
    const community = await communityRepo().findOneOrFail({ where: { id: communityId } });
    if (envelopeId) {
        await communityRepo().update(community.id, { chat_envelope_id: envelopeId });
        return;
    }
    if (!community.ename) return;
    const payload = buildNewChatPayload({ name: community.name, participantIds: [], members: [] });
    const newEnvelopeId = await createEnvelope({
        vaultEname: community.ename,
        ontology: ONTOLOGIES.Community,
        payload,
        acl: ["*"],
    });
    await communityRepo().update(community.id, { chat_envelope_id: newEnvelopeId });
}

/** Fetch-merge-write: rebuilds name/description/avatar/participantIds/members from current
 *  Community + membership state, preserving every other field. Fire-and-forget caller. */
export async function syncCommunityChatToEvault(communityId: string): Promise<void> {
    const community = await communityRepo().findOne({ where: { id: communityId } });
    if (!community?.chat_envelope_id || !community.ename) {
        logger.warn("Skipping community chat sync for %s — no chat_envelope_id linked", communityId);
        return;
    }

    const current = await getEnvelope(community.ename, community.chat_envelope_id);
    if (!current) {
        logger.warn("Community chat envelope fetch failed for %s, skipping sync", communityId);
        return;
    }

    const memberships = await membershipRepo().find({ where: { community_id: communityId } });
    const participantIds: string[] = [];
    const members: string[] = [];
    for (const m of memberships) {
        const p = await resolveParticipant(m.person_id);
        if (!p) continue;
        participantIds.push(p.metaId);
        members.push(p.ename);
    }

    const merged = mergeCommunityChatFields(current, {
        name: community.name,
        description: community.description,
        avatar: community.logo_url,
        participantIds,
        members,
    });

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: community.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: merged,
        acl: ["*"],
    });
}

/** Fire-and-forget caller. Splices one person in without touching anything else. */
export async function addPersonToCommunityChat(communityId: string, personId: string): Promise<void> {
    const community = await communityRepo().findOne({ where: { id: communityId } });
    if (!community?.chat_envelope_id || !community.ename) {
        logger.warn("Skipping community chat add for %s — no chat_envelope_id linked", communityId);
        return;
    }
    const p = await resolveParticipant(personId);
    if (!p) return;

    const current = await getEnvelope(community.ename, community.chat_envelope_id);
    if (!current) {
        logger.warn("Community chat envelope fetch failed for %s, skipping add", communityId);
        return;
    }

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: community.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: addParticipant(current, p.metaId, p.ename),
        acl: ["*"],
    });
}

/** Synchronous caller (blocks the Postgres member removal). Throws if the envelope fetch
 *  fails so the caller's delete does not silently proceed while the chat still lists them. */
export async function removePersonFromCommunityChat(communityId: string, personId: string): Promise<void> {
    const community = await communityRepo().findOne({ where: { id: communityId } });
    if (!community?.chat_envelope_id || !community.ename) {
        logger.warn("Skipping community chat removal for %s — no chat_envelope_id linked", communityId);
        return;
    }
    const p = await resolveParticipant(personId);
    if (!p) return;

    const current = await getEnvelope(community.ename, community.chat_envelope_id);
    if (!current) {
        throw new Error(`Failed to fetch community chat envelope ${community.chat_envelope_id} for removal`);
    }

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: community.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: removeParticipant(current, p.metaId, p.ename),
        acl: ["*"],
    });
}

/** Fire-and-forget caller. Re-prefixes every child workgroup chat's name with the new
 *  community name by calling renameWorkgroupChat with each workgroup's own (unchanged) name. */
export async function cascadeCommunityRenameToWorkgroupChats(communityId: string, _newCommunityName: string): Promise<void> {
    const workgroups = await workgroupRepo().find({ where: { community_id: communityId } });
    for (const wg of workgroups) {
        if (!wg.chat_envelope_id) continue;
        await renameWorkgroupChat(wg.id, wg.name).catch((err) =>
            logger.warn(err, "Workgroup chat rename failed for %s during community rename", wg.id)
        );
    }
}

// ── Workgroup chat ──────────────────────────────────────────────────────────

/** Creates a fresh envelope named "<community name>: <workgroup name>", persists the id.
 *  Returns null (not an error) if the community isn't linked yet. Throws on eVault failure. */
export async function createWorkgroupChat(workgroupId: string): Promise<string | null> {
    const wg = await workgroupRepo().findOneOrFail({ where: { id: workgroupId } });
    const community = await communityRepo().findOne({ where: { id: wg.community_id } });
    if (!community?.ename) {
        logger.warn("Cannot create workgroup chat for %s — community not linked", workgroupId);
        return null;
    }

    const payload = buildNewChatPayload({
        name: `${community.name}: ${wg.name}`,
        participantIds: [],
        members: [],
    });
    const envelopeId = await createEnvelope({
        vaultEname: community.ename,
        ontology: ONTOLOGIES.Community,
        payload,
        acl: ["*"],
    });
    await workgroupRepo().update(wg.id, { chat_envelope_id: envelopeId });
    return envelopeId;
}

/** Fire-and-forget caller. */
export async function renameWorkgroupChat(workgroupId: string, newWorkgroupName: string): Promise<void> {
    const wg = await workgroupRepo().findOne({ where: { id: workgroupId } });
    if (!wg?.chat_envelope_id) {
        logger.warn("Skipping workgroup chat rename for %s — no chat_envelope_id", workgroupId);
        return;
    }
    const community = await communityRepo().findOne({ where: { id: wg.community_id } });
    if (!community?.ename) return;

    const current = await getEnvelope(community.ename, wg.chat_envelope_id);
    if (!current) {
        logger.warn("Workgroup chat envelope fetch failed for %s, skipping rename", workgroupId);
        return;
    }

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: wg.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: renameChat(current, `${community.name}: ${newWorkgroupName}`),
        acl: ["*"],
    });
}

/** Synchronous caller (blocks workgroup deletion). Throws if the envelope fetch fails. */
export async function archiveWorkgroupChat(workgroupId: string): Promise<void> {
    const wg = await workgroupRepo().findOne({ where: { id: workgroupId } });
    if (!wg?.chat_envelope_id) {
        logger.warn("Skipping workgroup chat archive for %s — no chat_envelope_id", workgroupId);
        return;
    }
    const community = await communityRepo().findOne({ where: { id: wg.community_id } });
    if (!community?.ename) return;

    const current = await getEnvelope(community.ename, wg.chat_envelope_id);
    if (!current) {
        throw new Error(`Failed to fetch workgroup chat envelope ${wg.chat_envelope_id} for archive`);
    }

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: wg.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: archiveChat(current),
        acl: ["*"],
    });
}

/** Fire-and-forget caller. */
export async function addPersonToWorkgroupChat(workgroupId: string, personId: string): Promise<void> {
    const wg = await workgroupRepo().findOne({ where: { id: workgroupId } });
    if (!wg?.chat_envelope_id) {
        logger.warn("Skipping workgroup chat add for %s — no chat_envelope_id", workgroupId);
        return;
    }
    const community = await communityRepo().findOne({ where: { id: wg.community_id } });
    if (!community?.ename) return;
    const p = await resolveParticipant(personId);
    if (!p) return;

    const current = await getEnvelope(community.ename, wg.chat_envelope_id);
    if (!current) {
        logger.warn("Workgroup chat envelope fetch failed for %s, skipping add", workgroupId);
        return;
    }

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: wg.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: addParticipant(current, p.metaId, p.ename),
        acl: ["*"],
    });
}

/** Synchronous caller when invoked with alsoRemoveFromChat=true. Throws if the envelope
 *  fetch fails so the caller's removal does not silently proceed. */
export async function removePersonFromWorkgroupChat(workgroupId: string, personId: string): Promise<void> {
    const wg = await workgroupRepo().findOne({ where: { id: workgroupId } });
    if (!wg?.chat_envelope_id) {
        logger.warn("Skipping workgroup chat removal for %s — no chat_envelope_id", workgroupId);
        return;
    }
    const community = await communityRepo().findOne({ where: { id: wg.community_id } });
    if (!community?.ename) return;
    const p = await resolveParticipant(personId);
    if (!p) return;

    const current = await getEnvelope(community.ename, wg.chat_envelope_id);
    if (!current) {
        throw new Error(`Failed to fetch workgroup chat envelope ${wg.chat_envelope_id} for removal`);
    }

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: wg.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: removeParticipant(current, p.metaId, p.ename),
        acl: ["*"],
    });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd api && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run full test suite to confirm no regressions**

Run: `cd api && npm test`
Expected: all existing tests still pass (this file adds no new tests, per Global Constraints)

- [ ] **Step 4: Commit**

```bash
git add api/src/services/ChatService.ts
git commit -m "$(cat <<'EOF'
Add ChatService.ts: community and workgroup chat orchestration

Community chat functions fetch-merge-write into the shared Chat
envelope other platforms (ALVer) also write to, touching only
CORE-owned fields. Workgroup chat functions create/rename/archive
CORE-owned envelopes and splice single participants in/out —
membership sync is always incremental, never a full-roster rebuild,
and there is no code path that reads a workgroup chat's participant
list back into Postgres.

No test file: this module calls AppDataSource/evault-client directly,
matching the existing untested-wrapper convention already established
by WorkgroupService.ts/OrganizationService.ts.
EOF
)"
```

---

### Task 4: Wire hooks into `WorkgroupService.ts` and `WorkgroupController.ts`

**Files:**
- Modify: `api/src/services/WorkgroupService.ts`
- Modify: `api/src/controllers/WorkgroupController.ts`

**Interfaces:**
- Consumes: `createWorkgroupChat`, `renameWorkgroupChat`, `archiveWorkgroupChat`, `addPersonToWorkgroupChat`, `removePersonFromWorkgroupChat` from `./ChatService` (Task 3).
- Produces: `removeWorkgroupMember(workgroupId: string, personId: string, alsoRemoveFromChat = false): Promise<void>` — new 3rd param. Task 6 (`MemberService.ts`) calls this with `true`; the frontend (Task 7) calls it via the controller with the query param.

No test file — same untested-wrapper convention as Task 3 (this file already has no test coverage for its impure functions).

- [ ] **Step 1: Add the ChatService import**

In `api/src/services/WorkgroupService.ts`, after the existing imports (after `import { logger } from "../lib/logger";`):

```ts
import { logger } from "../lib/logger";
import { createWorkgroupChat, renameWorkgroupChat, archiveWorkgroupChat, addPersonToWorkgroupChat, removePersonFromWorkgroupChat } from "./ChatService";
```

Also add `chatId: wg.chat_envelope_id,` to the existing `buildWorkgroupPayload({...})` call inside `syncWorkgroupToEvault` (after `members,`):

```ts
    const payload = buildWorkgroupPayload({
        communityEname: community.ename,
        name: wg.name,
        description: wg.description,
        color: wg.color,
        createdAt: wg.created_at,
        updatedAt: wg.updated_at,
        roles: roles.map((r) => ({ id: r.id, name: r.name, color: r.color })),
        members,
        chatId: wg.chat_envelope_id,
    });
```

- [ ] **Step 2: Wire `createWorkgroup`**

Replace:

```ts
export async function createWorkgroup(communityId: string, data: { name: string; description?: string; color?: string }): Promise<Workgroup> {
    const maxOrder = (await wgRepo().maximum("sort_order", { community_id: communityId }) as number | null) ?? -1;
    const saved = await wgRepo().save(wgRepo().create({ community_id: communityId, name: data.name, description: data.description ?? null, color: data.color ?? "#C4622D", sort_order: maxOrder + 1 }));
    syncWorkgroupToEvault(saved.id).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", saved.id));
    return saved;
}
```

with:

```ts
export async function createWorkgroup(communityId: string, data: { name: string; description?: string; color?: string }): Promise<Workgroup> {
    const maxOrder = (await wgRepo().maximum("sort_order", { community_id: communityId }) as number | null) ?? -1;
    const saved = await wgRepo().save(wgRepo().create({ community_id: communityId, name: data.name, description: data.description ?? null, color: data.color ?? "#C4622D", sort_order: maxOrder + 1 }));
    // Awaited, not fire-and-forget: the chat id must exist before anyone can join.
    // Workgroup creation is rare/admin-only, so the extra latency is cheap. If this
    // throws, saved may already have persisted in Postgres with chat_envelope_id
    // null — a recoverable, self-describing state, not data corruption.
    const chatEnvelopeId = await createWorkgroupChat(saved.id);
    if (chatEnvelopeId) saved.chat_envelope_id = chatEnvelopeId;
    syncWorkgroupToEvault(saved.id).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", saved.id));
    return saved;
}
```

- [ ] **Step 3: Wire `updateWorkgroup`**

Replace:

```ts
export async function updateWorkgroup(id: string, communityId: string, data: Partial<Pick<Workgroup, "name" | "description" | "color" | "sort_order">>): Promise<Workgroup> {
    const wg = await wgRepo().findOneOrFail({ where: { id, community_id: communityId } });
    Object.assign(wg, data);
    const saved = await wgRepo().save(wg);
    syncWorkgroupToEvault(saved.id).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", saved.id));
    return saved;
}
```

with:

```ts
export async function updateWorkgroup(id: string, communityId: string, data: Partial<Pick<Workgroup, "name" | "description" | "color" | "sort_order">>): Promise<Workgroup> {
    const wg = await wgRepo().findOneOrFail({ where: { id, community_id: communityId } });
    const nameChanged = data.name !== undefined && data.name !== wg.name;
    Object.assign(wg, data);
    const saved = await wgRepo().save(wg);
    syncWorkgroupToEvault(saved.id).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", saved.id));
    if (nameChanged) {
        renameWorkgroupChat(saved.id, saved.name).catch((err) => logger.warn(err, "Workgroup chat rename failed for %s", saved.id));
    }
    return saved;
}
```

- [ ] **Step 4: Wire `deleteWorkgroup`**

Replace:

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

with:

```ts
export async function deleteWorkgroup(id: string, communityId: string): Promise<void> {
    const wg = await wgRepo().findOneOrFail({ where: { id, community_id: communityId } });
    if (wg.envelope_id) {
        const community = await communityRepo().findOne({ where: { id: communityId } });
        if (community?.ename) await removeEnvelope(community.ename, wg.envelope_id);
    }
    await archiveWorkgroupChat(id);
    await wgRepo().delete({ id, community_id: communityId });
}
```

- [ ] **Step 5: Wire `addWorkgroupMember`**

Replace:

```ts
export async function addWorkgroupMember(workgroupId: string, personId: string): Promise<WorkgroupMembership> {
    const saved = await wgmRepo().save(wgmRepo().create({ workgroup_id: workgroupId, person_id: personId }));
    syncWorkgroupToEvault(workgroupId).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", workgroupId));
    return saved;
}
```

with:

```ts
export async function addWorkgroupMember(workgroupId: string, personId: string): Promise<WorkgroupMembership> {
    const saved = await wgmRepo().save(wgmRepo().create({ workgroup_id: workgroupId, person_id: personId }));
    syncWorkgroupToEvault(workgroupId).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", workgroupId));
    addPersonToWorkgroupChat(workgroupId, personId).catch((err) => logger.warn(err, "Workgroup chat add failed for %s", workgroupId));
    return saved;
}
```

- [ ] **Step 6: Wire `removeWorkgroupMember`**

Replace:

```ts
export async function removeWorkgroupMember(workgroupId: string, personId: string): Promise<void> {
    const wm = await wgmRepo().findOne({ where: { workgroup_id: workgroupId, person_id: personId } });
    if (!wm) return;
    await syncWorkgroupToEvault(workgroupId, { excludeMembershipId: wm.id });
    await wmrRepo().delete({ workgroup_membership_id: wm.id });
    await wgmRepo().delete(wm.id);
}
```

with:

```ts
export async function removeWorkgroupMember(workgroupId: string, personId: string, alsoRemoveFromChat = false): Promise<void> {
    const wm = await wgmRepo().findOne({ where: { workgroup_id: workgroupId, person_id: personId } });
    if (!wm) return;
    await syncWorkgroupToEvault(workgroupId, { excludeMembershipId: wm.id });
    if (alsoRemoveFromChat) {
        await removePersonFromWorkgroupChat(workgroupId, personId);
    }
    await wmrRepo().delete({ workgroup_membership_id: wm.id });
    await wgmRepo().delete(wm.id);
}
```

- [ ] **Step 7: Wire the controller's query param**

In `api/src/controllers/WorkgroupController.ts`, replace:

```ts
export const removeWgMemberHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await removeWorkgroupMember(req.params.wid, req.params.pid);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};
```

with:

```ts
export const removeWgMemberHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const alsoRemoveFromChat = req.query.alsoRemoveFromChat === "true";
        await removeWorkgroupMember(req.params.wid, req.params.pid, alsoRemoveFromChat);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};
```

- [ ] **Step 8: Verify it compiles and existing tests still pass**

Run: `cd api && npx tsc --noEmit`
Expected: no errors

Run: `cd api && npm test`
Expected: all existing tests pass

- [ ] **Step 9: Commit**

```bash
git add api/src/services/WorkgroupService.ts api/src/controllers/WorkgroupController.ts
git commit -m "$(cat <<'EOF'
Wire workgroup chat hooks into WorkgroupService

createWorkgroup awaits chat creation (id must exist before anyone can
join); updateWorkgroup/addWorkgroupMember fire-and-forget rename/add;
deleteWorkgroup synchronously archives the chat before deleting the
workgroup row. removeWorkgroupMember gains an alsoRemoveFromChat param
(default false), threaded from the controller's query string.
EOF
)"
```

---

### Task 5: Wire hooks into `CommunityService.ts`

**Files:**
- Modify: `api/src/services/CommunityService.ts`

**Interfaces:**
- Consumes: `getOrCreateCommunityChatId`, `syncCommunityChatToEvault`, `cascadeCommunityRenameToWorkgroupChats` from `./ChatService` (Task 3).
- Produces: nothing new consumed by later tasks — this task only adds hook calls.

No test file — same convention as Task 3/4.

- [ ] **Step 1: Add the ChatService import**

In `api/src/services/CommunityService.ts`, after the existing `syncOrganizationToEvault` import:

```ts
import { syncOrganizationToEvault } from "./OrganizationService";
import { getOrCreateCommunityChatId, syncCommunityChatToEvault, cascadeCommunityRenameToWorkgroupChats } from "./ChatService";
```

- [ ] **Step 2: Wire `updateCommunity`**

Replace:

```ts
export async function updateCommunity(
    id: string,
    data: Partial<Pick<Community,
        "name" | "slug" | "description" | "logo_url" | "photo_url" | "primary_color" | "title_font" |
        "legal_form" | "official_name" | "kvk_number" | "rsin" | "iban" | "registered_address" |
        "founding_date" | "statuten_file_uri"
    >>
): Promise<Community> {
    const community = await communityRepo().findOneOrFail({ where: { id } });

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

with:

```ts
export async function updateCommunity(
    id: string,
    data: Partial<Pick<Community,
        "name" | "slug" | "description" | "logo_url" | "photo_url" | "primary_color" | "title_font" |
        "legal_form" | "official_name" | "kvk_number" | "rsin" | "iban" | "registered_address" |
        "founding_date" | "statuten_file_uri"
    >>
): Promise<Community> {
    const community = await communityRepo().findOneOrFail({ where: { id } });

    const nameChanged = data.name !== undefined && data.name !== community.name;
    Object.assign(community, data);
    const saved = await communityRepo().save(community);

    if (saved.provisioning_status === "linked" && saved.ename) {
        syncOrganizationToEvault(saved.id).catch((err) =>
            logger.warn(err, "Organization envelope update failed for %s", saved.id)
        );
        syncCommunityChatToEvault(saved.id).catch((err) =>
            logger.warn(err, "Community chat sync failed for %s", saved.id)
        );
        if (nameChanged) {
            cascadeCommunityRenameToWorkgroupChats(saved.id, saved.name).catch((err) =>
                logger.warn(err, "Workgroup chat rename cascade failed for %s", saved.id)
            );
        }
    }

    return saved;
}
```

- [ ] **Step 3: Wire `linkCommunity`**

Replace:

```ts
    community.ename = resolution.w3id;
    community.evault_uri = resolution.evault_uri;
    community.provisioning_status = "linked";
    if (resolution.envelope?.name) community.name = resolution.envelope.name;
    if (resolution.envelope?.logo_url) community.logo_url = resolution.envelope.logo_url;
    if (resolution.envelope?.description) community.description = resolution.envelope.description;
    const saved = await communityRepo().save(community);

    syncOrganizationToEvault(saved.id).catch((err) =>
        logger.warn(err, "Organization envelope creation failed for linked community %s", saved.id)
    );

    return saved;
}
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

    await getOrCreateCommunityChatId(saved.id, resolution.envelopeId);

    syncOrganizationToEvault(saved.id).catch((err) =>
        logger.warn(err, "Organization envelope creation failed for linked community %s", saved.id)
    );

    return saved;
}
```

- [ ] **Step 4: Verify it compiles and existing tests still pass**

Run: `cd api && npx tsc --noEmit`
Expected: no errors

Run: `cd api && npm test`
Expected: all existing tests pass

- [ ] **Step 5: Commit**

```bash
git add api/src/services/CommunityService.ts
git commit -m "$(cat <<'EOF'
Wire community chat hooks into CommunityService

linkCommunity synchronously gets-or-creates the community's chat id
before returning (create-if-missing needs the id available). updateCommunity
fire-and-forget syncs the shared chat envelope on name/logo/description
change, and cascades a rename into every child workgroup chat's name
prefix when the community name itself changes.
EOF
)"
```

---

### Task 6: Wire hooks into `MemberService.ts`

**Files:**
- Modify: `api/src/services/MemberService.ts`

**Interfaces:**
- Consumes: `addPersonToCommunityChat`, `removePersonFromCommunityChat` from `./ChatService` (Task 3). `removeWorkgroupMember(workgroupId, personId, alsoRemoveFromChat)` — the 3-arg signature from Task 4.

No test file — same convention as Task 3/4/5.

- [ ] **Step 1: Add the ChatService import**

In `api/src/services/MemberService.ts`, after the existing `removeWorkgroupMember` import:

```ts
import { removeWorkgroupMember } from "./WorkgroupService";
import { addPersonToCommunityChat, removePersonFromCommunityChat } from "./ChatService";
```

- [ ] **Step 2: Wire `addMember`**

Replace:

```ts
    syncOrganizationToEvault(communityId).catch((err) =>
        logger.warn(err, "Organization envelope sync failed for member %s", membership.id)
    );

    return membership;
}
```

with:

```ts
    syncOrganizationToEvault(communityId).catch((err) =>
        logger.warn(err, "Organization envelope sync failed for member %s", membership.id)
    );
    addPersonToCommunityChat(communityId, person.id).catch((err) =>
        logger.warn(err, "Community chat sync failed for member %s", membership.id)
    );

    return membership;
}
```

- [ ] **Step 3: Wire `removeMember`**

Replace:

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
            await removeWorkgroupMember(wm.workgroup_id, membership.person_id);
        }
    }

    await syncOrganizationToEvault(communityId, { excludeMembershipId: membershipId });
    await memberRepo().delete({ id: membershipId, community_id: communityId });
    syncAvailabilityToEvault(communityId).catch((err) =>
        logger.warn(err, "Availability envelope sync failed after removing member %s", membershipId)
    );
}
```

with:

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

- [ ] **Step 4: Verify it compiles and existing tests still pass**

Run: `cd api && npx tsc --noEmit`
Expected: no errors

Run: `cd api && npm test`
Expected: all existing tests pass

- [ ] **Step 5: Commit**

```bash
git add api/src/services/MemberService.ts
git commit -m "$(cat <<'EOF'
Wire community chat hooks into MemberService

addMember fire-and-forget adds the new member to the community chat.
removeMember synchronously removes them (blocking the Postgres delete
on failure, per the loud-not-silent delete convention) and now also
removes them from every workgroup chat they belonged to, since full
community removal should not leave stray chat access behind.
EOF
)"
```

---

### Task 7: Frontend — leave-workgroup chat prompt

**Files:**
- Modify: `app/src/views/MyWorkgroups.jsx`
- Modify: `app/src/api/client.js`

**Interfaces:**
- Consumes: `wg.chat_envelope_id` (present on workgroup objects returned by `GET /communities/:cid` once Task 2's column exists and `getCommunityFull` — unchanged, already spreads `...wg` — includes it automatically).
- Produces: nothing consumed by later tasks (final task in this plan).

No test file — this app has no existing frontend test suite/framework configured (no `app/**/__tests__` or test runner in `app/package.json`); verification is manual browser check plus `npm run build`.

- [ ] **Step 1: Update `client.js`'s `removeWorkgroupMember`**

Replace:

```js
export const removeWorkgroupMember = (wid, pid) => req('DELETE', `/workgroups/${wid}/members/${pid}`)
```

with:

```js
export const removeWorkgroupMember = (wid, pid, alsoRemoveFromChat) =>
  req('DELETE', `/workgroups/${wid}/members/${pid}${alsoRemoveFromChat ? '?alsoRemoveFromChat=true' : ''}`)
```

- [ ] **Step 2: Update `MyWorkgroups.jsx`'s `handleLeave`**

Replace:

```js
  async function handleLeave(wg) {
    if (!confirm(`Leave "${wg.name}"?`)) return
    setBusy((s) => ({ ...s, [wg.id]: true }))
    try { await removeWorkgroupMember(wg.id, user.id); await refresh() }
    catch (err) { alert(err.message) }
    setBusy((s) => ({ ...s, [wg.id]: false }))
  }
```

with:

```js
  async function handleLeave(wg) {
    if (!confirm(`Leave "${wg.name}"?`)) return
    const alsoRemoveFromChat = wg.chat_envelope_id
      ? confirm('Also remove yourself from its chat?')
      : false
    setBusy((s) => ({ ...s, [wg.id]: true }))
    try { await removeWorkgroupMember(wg.id, user.id, alsoRemoveFromChat); await refresh() }
    catch (err) { alert(err.message) }
    setBusy((s) => ({ ...s, [wg.id]: false }))
  }
```

- [ ] **Step 3: Verify the build**

Run: `cd app && npm run build`
Expected: build succeeds, no errors

- [ ] **Step 4: Manual browser verification**

Start the dev servers (`api`: `npm run dev`, `app`: `npm run dev`), log in as a member of a workgroup whose community has a `chat_envelope_id` set (any community linked via Task 5's `linkCommunity` flow, or De Woonwolk post-backfill), navigate to My Workgroups, click the leave icon on a joined workgroup, confirm the first dialog, then confirm the second "Also remove yourself from its chat?" dialog appears and both accept/decline paths complete without error. Then repeat for a workgroup whose community has no `chat_envelope_id` (a fresh unlinked community) and confirm only the first dialog appears (no chat prompt).

- [ ] **Step 5: Commit**

```bash
git add app/src/views/MyWorkgroups.jsx app/src/api/client.js
git commit -m "$(cat <<'EOF'
Add optional chat-removal prompt to workgroup self-leave

Second confirm() asks whether to also remove the user from the
workgroup's chat; skipped entirely when the workgroup has no linked
chat yet. removeWorkgroupMember's client wrapper gains a 3rd param
that appends the alsoRemoveFromChat query flag.
EOF
)"
```

---

## Post-Plan Manual Steps (not part of subagent-driven execution)

These are executed by the assistant directly, with explicit user confirmation before any real write, after all 7 tasks above are implemented and reviewed:

**De Woonwolk backfill:**
1. Write a one-off script `api/scratch_backfill_chat.ts` (deleted after use, same pattern as the earlier `scratch_resync_wg.ts`): capture De Woonwolk's existing Chat/Group envelope id into `communities.chat_envelope_id` (no eVault write — the 32-member roster is already verified correct). For each of the 12 existing workgroups, call `ChatService.createWorkgroupChat(wg.id)` to create a fresh envelope seeded with that workgroup's current Postgres roster, then call `WorkgroupService`'s exported `updateWorkgroup(id, communityId, {})` (existing no-op-diff force-resync pattern) so the workgroup's own envelope picks up the new `chatId`.
2. Re-dump all 12 new envelopes plus the community envelope via a read-only GraphQL query, confirm rosters/shapes match Postgres.
3. Runs against the real production eVault (`http://64.227.64.55:4000`) — requires explicit user confirmation before any write.

**Prod migration:**
Apply `docs/superpowers/migrations/2026-07-15-chat-envelope-columns.sql` by hand against the prod Postgres instance before deploying this feature — requires explicit user confirmation before running.
