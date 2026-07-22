# Platform-Info eVault Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CORE publishes self-descriptive documentation (user-facing, marketplace listing, AI-agent integration guide, full ontology reference) as `PlatformInfo` MetaEnvelopes inside CORE's own platform eVault, sourced from markdown files in `docs/platform-info/`, via a manual dev-run sync script.

**Architecture:** New custom ontology `PlatformInfo` added to the existing `ONTOLOGIES` const. Each markdown file under `docs/platform-info/{user,marketplace,agents,ontology-spec}/*.md` carries its own identity (`w3id`) in YAML frontmatter — `null` until first publish, then filled in by the sync script and committed. `api/scripts/sync-platform-info.ts` walks the tree, creates-or-updates one envelope per file via the existing `evault-client.ts`, and rewrites frontmatter on first create. No inbound sync — CORE is sole writer.

**Tech Stack:** TypeScript, `ts-node`, `axios` (via existing `evault-client.ts`), Jest — all already in `api/`. No new dependencies (frontmatter is hand-parsed; only two flat string/null keys, doesn't need a YAML library).

## Global Constraints

- No new npm dependencies (per design's YAGNI note — the existing `axios`/`dotenv`/`uuid` stack and a small hand-rolled frontmatter parser cover everything needed).
- `PlatformInfo` gets no inbound packet handler in `registerOntologyHandlers.ts` — CORE is sole writer, per spec's Non-goals.
- `audience` is derived from the containing folder name at sync time, never read from frontmatter.
- Updates are unconditional every run — no content-hash/skip logic (per spec).
- Manual, dev-run trigger only (`npm run sync-platform-info --prefix api`) — no server-startup hook, no CI trigger.
- Full spec: `docs/superpowers/specs/2026-07-22-platform-info-evault-docs-design.md`.

---

### Task 1: `PlatformInfo` ontology constant + frontmatter helper

**Files:**
- Modify: `api/src/lib/w3ds/ontology.ts`
- Modify: `api/jest.config.js`
- Create: `api/scripts/frontmatter.ts`
- Test: `api/scripts/__tests__/frontmatter.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ONTOLOGIES.PlatformInfo: string`. `parseFrontmatter(raw: string): { meta: { title: string; w3id: string | null }; body: string }`. `stringifyFrontmatter(meta: { title: string; w3id: string | null }, body: string): string`. Task 2 imports both functions from `./frontmatter`.

- [ ] **Step 1: Add the ontology constant**

Modify `api/src/lib/w3ds/ontology.ts`, adding one line inside the existing `ONTOLOGIES` object (after `AvailabilityLog`):

```ts
  PlatformInfo: '18a83870-04cf-4694-817a-edf037d7b256', // Custom ontology — not yet registered in the Ontology service. Platform's own self-description, written to its own eVault.
```

- [ ] **Step 2: Widen Jest's `roots` to cover `scripts/`**

`api/jest.config.js` currently has `roots: ['<rootDir>/src']`, so anything under `api/scripts/__tests__/` would never be discovered by `npm test`. Modify `api/jest.config.js`:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/scripts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
};
```

- [ ] **Step 3: Write the failing frontmatter tests**

Create `api/scripts/__tests__/frontmatter.test.ts`:

```ts
import { parseFrontmatter, stringifyFrontmatter } from "../frontmatter";

describe("parseFrontmatter", () => {
    it("parses title and null w3id", () => {
        const raw = '---\ntitle: "What is CORE"\nw3id: null\n---\n\nCORE is a platform.\n';
        const { meta, body } = parseFrontmatter(raw);
        expect(meta).toEqual({ title: "What is CORE", w3id: null });
        expect(body).toBe("CORE is a platform.\n");
    });

    it("parses a populated w3id", () => {
        const raw = '---\ntitle: "What is CORE"\nw3id: "ce71a783-6ad3-50ea-994f-b671fbc58387"\n---\n\nBody text.\n';
        const { meta } = parseFrontmatter(raw);
        expect(meta.w3id).toBe("ce71a783-6ad3-50ea-994f-b671fbc58387");
    });

    it("throws when the frontmatter block is missing", () => {
        expect(() => parseFrontmatter("no frontmatter here")).toThrow("missing frontmatter block");
    });

    it("throws when title is missing", () => {
        const raw = '---\nw3id: null\n---\n\nBody.\n';
        expect(() => parseFrontmatter(raw)).toThrow("frontmatter missing title");
    });
});

describe("stringifyFrontmatter", () => {
    it("round-trips a null w3id", () => {
        const out = stringifyFrontmatter({ title: "What is CORE", w3id: null }, "CORE is a platform.");
        const { meta, body } = parseFrontmatter(out);
        expect(meta).toEqual({ title: "What is CORE", w3id: null });
        expect(body).toBe("CORE is a platform.\n");
    });

    it("round-trips a populated w3id", () => {
        const out = stringifyFrontmatter({ title: "What is CORE", w3id: "abc-123" }, "Body text.");
        const { meta } = parseFrontmatter(out);
        expect(meta.w3id).toBe("abc-123");
    });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd api && npx jest scripts/__tests__/frontmatter.test.ts`
Expected: FAIL — `Cannot find module '../frontmatter'`.

- [ ] **Step 5: Implement the frontmatter helper**

Create `api/scripts/frontmatter.ts`:

```ts
export interface FrontmatterMeta {
    title: string;
    w3id: string | null;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export function parseFrontmatter(raw: string): { meta: FrontmatterMeta; body: string } {
    const match = FRONTMATTER_RE.exec(raw);
    if (!match) throw new Error("missing frontmatter block");
    const [, yaml, rest] = match;

    const titleMatch = /^title:\s*"(.*)"\s*$/m.exec(yaml);
    if (!titleMatch) throw new Error("frontmatter missing title");

    const w3idMatch = /^w3id:\s*(.+?)\s*$/m.exec(yaml);
    if (!w3idMatch) throw new Error("frontmatter missing w3id");
    const w3idRaw = w3idMatch[1].trim();
    const w3id = w3idRaw === "null" ? null : w3idRaw.replace(/^"(.*)"$/, "$1");

    const body = rest.replace(/^\n+/, "");
    return { meta: { title: titleMatch[1], w3id }, body };
}

export function stringifyFrontmatter(meta: FrontmatterMeta, body: string): string {
    const w3idLine = meta.w3id === null ? "w3id: null" : `w3id: "${meta.w3id}"`;
    return `---\ntitle: "${meta.title}"\n${w3idLine}\n---\n\n${body.trim()}\n`;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd api && npx jest scripts/__tests__/frontmatter.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 7: Commit**

```bash
git add api/src/lib/w3ds/ontology.ts api/jest.config.js api/scripts/frontmatter.ts api/scripts/__tests__/frontmatter.test.ts
git commit -m "feat: add PlatformInfo ontology and frontmatter parse/stringify helper"
```

---

### Task 2: `sync-platform-info.ts` script + npm wiring

**Files:**
- Create: `api/scripts/sync-platform-info.ts`
- Test: `api/scripts/__tests__/sync-platform-info.test.ts`
- Modify: `api/package.json`

**Interfaces:**
- Consumes: `parseFrontmatter`, `stringifyFrontmatter` from `./frontmatter` (Task 1). `ONTOLOGIES.PlatformInfo` (Task 1). `createEnvelope`, `updateEnvelope` from `../src/lib/evault-client` (existing, signatures: `createEnvelope(input: { vaultEname: string; ontology: string; payload: Record<string, unknown>; acl: string[] }): Promise<string>`; `updateEnvelope(input: { vaultEname: string; ontology: string; payload: Record<string, unknown>; acl: string[]; envelopeId: string }): Promise<void>`).
- Produces: exported `deriveAudience(filePath: string, root: string): "user" | "marketplace" | "agents" | "ontology-spec"` and `buildPayload(title: string, audience: string, content: string, updatedAt: string): { title: string; audience: string; content: string; updatedAt: string }`, both unit-tested. `main()` is the CLI entrypoint, not unit-tested (matches the existing convention — `register-platform.ts` and every `*EnvelopeService.ts` file with network/filesystem side effects has no dedicated test file).

- [ ] **Step 1: Write the failing tests for the pure functions**

Create `api/scripts/__tests__/sync-platform-info.test.ts`:

```ts
import path from "path";
import { deriveAudience, buildPayload } from "../sync-platform-info";

const ROOT = path.resolve(__dirname, "../../../docs/platform-info");

describe("deriveAudience", () => {
    it("derives 'user' from a file under docs/platform-info/user/", () => {
        const filePath = path.join(ROOT, "user", "overview.md");
        expect(deriveAudience(filePath, ROOT)).toBe("user");
    });

    it("derives 'ontology-spec' from a file under docs/platform-info/ontology-spec/", () => {
        const filePath = path.join(ROOT, "ontology-spec", "user.md");
        expect(deriveAudience(filePath, ROOT)).toBe("ontology-spec");
    });

    it("throws for a file under an unrecognized folder", () => {
        const filePath = path.join(ROOT, "bogus", "file.md");
        expect(() => deriveAudience(filePath, ROOT)).toThrow('not a valid audience');
    });
});

describe("buildPayload", () => {
    it("assembles the envelope payload verbatim", () => {
        const payload = buildPayload("What is CORE", "user", "CORE is a platform.", "2026-07-22T00:00:00.000Z");
        expect(payload).toEqual({
            title: "What is CORE",
            audience: "user",
            content: "CORE is a platform.",
            updatedAt: "2026-07-22T00:00:00.000Z",
        });
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd api && npx jest scripts/__tests__/sync-platform-info.test.ts`
Expected: FAIL — `Cannot find module '../sync-platform-info'`.

- [ ] **Step 3: Implement the script**

Create `api/scripts/sync-platform-info.ts`:

```ts
import path from "path";
import fs from "fs";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../.env") });

import { createEnvelope, updateEnvelope } from "../src/lib/evault-client";
import { ONTOLOGIES } from "../src/lib/w3ds/ontology";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter";

const DOCS_ROOT = path.resolve(__dirname, "../../docs/platform-info");
const IDENTITY_PATH = path.resolve(__dirname, "../data/platform-identity.json");
const VALID_AUDIENCES = ["user", "marketplace", "agents", "ontology-spec"] as const;
type Audience = (typeof VALID_AUDIENCES)[number];

interface PlatformIdentity {
    w3id: string;
}

function readPlatformEname(): string {
    if (!fs.existsSync(IDENTITY_PATH)) {
        throw new Error(`[sync-platform-info] ${IDENTITY_PATH} not found — run "npm run register-platform" first`);
    }
    const identity: PlatformIdentity = JSON.parse(fs.readFileSync(IDENTITY_PATH, "utf-8"));
    if (!identity.w3id) {
        throw new Error("[sync-platform-info] platform-identity.json has no w3id");
    }
    return identity.w3id;
}

function findMarkdownFiles(root: string): string[] {
    return (fs.readdirSync(root, { recursive: true }) as string[])
        .filter((entry) => entry.endsWith(".md"))
        .map((entry) => path.join(root, entry))
        .sort();
}

export function deriveAudience(filePath: string, root: string): Audience {
    const relative = path.relative(root, filePath);
    const segment = relative.split(path.sep)[0];
    if (!(VALID_AUDIENCES as readonly string[]).includes(segment)) {
        throw new Error(
            `[sync-platform-info] ${filePath}: parent folder "${segment}" is not a valid audience (${VALID_AUDIENCES.join(", ")})`
        );
    }
    return segment as Audience;
}

export function buildPayload(title: string, audience: Audience | string, content: string, updatedAt: string) {
    return { title, audience, content, updatedAt };
}

async function syncFile(filePath: string, platformEname: string): Promise<{ created: boolean }> {
    const raw = fs.readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    const audience = deriveAudience(filePath, DOCS_ROOT);
    const now = new Date().toISOString();
    const payload = buildPayload(meta.title, audience, body, now);

    if (meta.w3id === null) {
        const envelopeId = await createEnvelope({
            vaultEname: platformEname,
            ontology: ONTOLOGIES.PlatformInfo,
            payload,
            acl: ["*"],
        });
        fs.writeFileSync(filePath, stringifyFrontmatter({ title: meta.title, w3id: envelopeId }, body));
        return { created: true };
    }

    await updateEnvelope({
        vaultEname: platformEname,
        envelopeId: meta.w3id,
        ontology: ONTOLOGIES.PlatformInfo,
        payload,
        acl: ["*"],
    });
    return { created: false };
}

async function main(): Promise<void> {
    const platformEname = readPlatformEname();
    const files = findMarkdownFiles(DOCS_ROOT);
    let created = 0;
    let updated = 0;

    for (const filePath of files) {
        const result = await syncFile(filePath, platformEname);
        if (result.created) created++;
        else updated++;
        console.log(`[sync-platform-info] ${result.created ? "created" : "updated"}: ${path.relative(DOCS_ROOT, filePath)}`);
    }

    console.log(`[sync-platform-info] done. created=${created} updated=${updated}`);
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    });
}
```

Note the `if (require.main === module)` guard around the `main()` call — this is the one deviation from `register-platform.ts`'s pattern, needed so Jest can `import { deriveAudience, buildPayload }` from this file in Step 1's test without triggering a real network run on every `jest` invocation.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd api && npx jest scripts/__tests__/sync-platform-info.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Add the npm script**

Modify `api/package.json` — add one line inside the existing `"scripts"` object (after `"register-platform"`):

```json
    "sync-platform-info": "ts-node scripts/sync-platform-info.ts",
```

- [ ] **Step 6: Commit**

```bash
git add api/scripts/sync-platform-info.ts api/scripts/__tests__/sync-platform-info.test.ts api/package.json
git commit -m "feat: add sync-platform-info script to publish platform docs to CORE's eVault"
```

---

### Task 3: Author user/marketplace/agents docs

**Files:**
- Create: `docs/platform-info/user/overview.md`
- Create: `docs/platform-info/marketplace/listing.md`
- Create: `docs/platform-info/agents/integration.md`

**Interfaces:**
- Consumes: nothing (Task 2's script consumes these files at runtime, not at plan-authoring time).
- Produces: three markdown files with `w3id: null` frontmatter, ready for Task 5's sync run.

- [ ] **Step 1: Write the user-facing overview**

Create `docs/platform-info/user/overview.md`:

```markdown
---
title: "What is CORE"
w3id: null
---

CORE (Community Organisation and Roles Engine) is a W3DS platform for managing
community membership, roles, workgroups, and governance data.

Communities on CORE track:

- **Membership** — who belongs to a community, and since when.
- **Workgroups** — sub-teams within a community, with named roles and members.
- **Availability** — each member's current status (e.g. active, on leave), with
  a history log of past periods.
- **Organization details** — legal form, registration numbers, and other
  official information a community may need to record.

All of this data lives in each user's own eVault, not only in CORE's database —
CORE is one interchangeable frontend onto data you own. Other W3DS-aware
platforms can read the same membership, workgroup, and availability data
without going through CORE at all.
```

- [ ] **Step 2: Write the marketplace listing**

Create `docs/platform-info/marketplace/listing.md`:

```markdown
---
title: "CORE — Marketplace Listing"
w3id: null
---

- **Display name:** CORE
- **Platform name:** CommunityOrganisationAndRolesEngine
- **Description:** Manages community roles, membership and governance
- **URL:** https://core.lab.ecommons.space
- **Logo:** https://core.lab.ecommons.space/logo.png
- **Category:** Productivity

These fields mirror the `PlatformProfile` envelope CORE writes to its own
eVault under the `User` ontology (see `ontology-spec/user.md` in this same
directory) — this listing is the human-readable restatement of that same
identity record.
```

- [ ] **Step 3: Write the agent integration guide**

Create `docs/platform-info/agents/integration.md`:

```markdown
---
title: "Integrating with CORE (for AI agents and platforms)"
w3id: null
---

CORE is a W3DS platform. To read or write CORE-related data from another
platform or agent:

1. Resolve CORE's own eName via the Registry's `/resolve` endpoint (or the
   member's/community's own eName if you're working with their data instead
   of CORE's platform-level data).
2. Query the resulting eVault's `/graphql` endpoint with header
   `X-ENAME: @<the resolved eName>`.

**Ontologies CORE reads back from other platforms** (inbound webhook handlers
registered in `api/src/lib/w3ds/registerOntologyHandlers.ts`): `User`,
`Organization`, `Availability`, `Workgroup`.

**Ontologies CORE only writes** (no inbound handler — CORE is the sole
writer, no other platform should assume it can update these and have CORE
notice): `Membership`, `AvailabilityLog`, `PlatformInfo` (this document
itself, and everything else under `docs/platform-info/` in CORE's repo).

`Community` uses the shared W3DS Chat envelope shape, not a CORE-specific
payload — see `ontology-spec/community.md`.

Full field-level payload shapes for every ontology CORE uses: see the
`ontology-spec/` folder alongside this file.
```

- [ ] **Step 4: Commit**

```bash
git add docs/platform-info/user/overview.md docs/platform-info/marketplace/listing.md docs/platform-info/agents/integration.md
git commit -m "docs: author user/marketplace/agent platform-info content"
```

---

### Task 4: Author ontology-spec reference docs

**Files:**
- Create: `docs/platform-info/ontology-spec/community.md`
- Create: `docs/platform-info/ontology-spec/user.md`
- Create: `docs/platform-info/ontology-spec/workgroup.md`
- Create: `docs/platform-info/ontology-spec/organization.md`
- Create: `docs/platform-info/ontology-spec/availability.md`
- Create: `docs/platform-info/ontology-spec/membership.md`
- Create: `docs/platform-info/ontology-spec/availabilitylog.md`
- Create: `docs/platform-info/ontology-spec/platforminfo.md`

**Interfaces:**
- Consumes: UUIDs and field shapes from `api/src/lib/w3ds/ontology.ts` (Task 1) and the existing `*Payload.ts` files (already in the codebase, unmodified by this plan).
- Produces: eight markdown files with `w3id: null` frontmatter, ready for Task 5's sync run.

- [ ] **Step 1: `community.md`**

Create `docs/platform-info/ontology-spec/community.md`:

```markdown
---
title: "Ontology: Community"
w3id: null
---

UUID: `550e8400-e29b-41d4-a716-446655440003` (source: `api/src/lib/w3ds/ontology.ts`)

Uses the shared W3DS Chat envelope shape (not a CORE-specific payload) — a
Community in CORE is represented as a Chat group. `participantsID` fields on
this envelope are MetaEnvelope IDs of each member's `User` profile envelope,
not their eName.
```

- [ ] **Step 2: `user.md`**

Create `docs/platform-info/ontology-spec/user.md`:

```markdown
---
title: "Ontology: User"
w3id: null
---

UUID: `550e8400-e29b-41d4-a716-446655440000` (source: `api/src/lib/w3ds/ontology.ts`)

Two distinct uses in CORE:

1. **Person profile** — read inbound via webhook in
   `api/src/services/PersonService.ts`'s `upsertFromWebhook`. Tolerant field
   reader, accepts either of:
   - `displayName` or `name`
   - `firstName` or `givenName`
   - `lastName` or `familyName`

2. **Platform self-representation** — written once by
   `api/scripts/register-platform.ts`'s `writePlatformProfile()`:

```json
{
  "platformName": "string",
  "displayName": "string",
  "description": "string",
  "ename": "string",
  "url": "string",
  "logoUrl": "string",
  "category": "string",
  "isActive": "boolean",
  "isArchived": "boolean",
  "version": "string",
  "createdAt": "ISO date-time string",
  "updatedAt": "ISO date-time string"
}
```
```

- [ ] **Step 3: `workgroup.md`**

Create `docs/platform-info/ontology-spec/workgroup.md`:

```markdown
---
title: "Ontology: Workgroup"
w3id: null
---

UUID: `7867abbd-420e-4dd9-bad6-8ad894c50b94` — custom ontology, not yet
registered in the W3DS Ontology service (source: `api/src/lib/w3ds/ontology.ts`).

Payload shape (source: `api/src/services/workgroupPayload.ts`):

```json
{
  "communityId": "string",
  "name": "string",
  "description": "string (optional)",
  "color": "string",
  "createdAt": "ISO date-time string",
  "updatedAt": "ISO date-time string",
  "roles": [{ "id": "string", "name": "string", "color": "string" }],
  "members": [{ "participantId": "string", "roleIds": ["string"] }],
  "chatId": "string (optional)"
}
```
```

- [ ] **Step 4: `organization.md`**

Create `docs/platform-info/ontology-spec/organization.md`:

```markdown
---
title: "Ontology: Organization"
w3id: null
---

UUID: `ad226473-640e-4d16-90e5-2fd96f261554` — custom ontology, not yet
registered in the W3DS Ontology service (source: `api/src/lib/w3ds/ontology.ts`).

Payload shape (source: `api/src/services/organizationPayload.ts`), key fields:

```json
{
  "name": "string | null",
  "chatId": "string | null",
  "legalInfo": {
    "legalForm": "string | null",
    "officialName": "string | null",
    "kvkNumber": "string | null",
    "rsin": "string | null",
    "iban": "string | null",
    "registeredAddress": "string | null",
    "foundingDate": "string | null (YYYY-MM-DD)"
  },
  "membershipTypes": [{ "id": "string", "name": "string", "description": "string | null", "emoji": "string | null" }],
  "members": [{ "participantId": "string", "eName": "string", "dateJoined": "string | null", "membershipTypeId": "string | null" }],
  "admins": ["string"]
}
```

Field list abbreviated to what's relevant to other platforms — the full type
is `OrganizationEnvelopePayload` in the source file above.
```

- [ ] **Step 5: `availability.md`**

Create `docs/platform-info/ontology-spec/availability.md`:

```markdown
---
title: "Ontology: Availability"
w3id: null
---

UUID: `fcdc28d2-f22e-469b-a2f0-dad6bf3dd152` — custom ontology, not yet
registered in the W3DS Ontology service (source: `api/src/lib/w3ds/ontology.ts`).

Payload shape (source: `api/src/services/availabilityPayload.ts`):

```json
{
  "statuses": [{ "id": "string", "name": "string", "emoji": "string", "sortOrder": "number" }],
  "entries": [{ "participantId": "string", "eName": "string", "statusId": "string", "reason": "string | null", "from": "string | null", "until": "string | null" }]
}
```

Members with no status currently set are omitted from `entries` rather than
synced as a bare `participantId`/`eName` pair.
```

- [ ] **Step 6: `membership.md`**

Create `docs/platform-info/ontology-spec/membership.md`:

```markdown
---
title: "Ontology: Membership"
w3id: null
---

UUID: `d300f6d4-a018-446c-add4-b34abc95de05` — custom ontology, not yet
registered in the W3DS Ontology service (source: `api/src/lib/w3ds/ontology.ts`).

Written to the **member's own vault**, not the community's. Payload shape
(source: `api/src/services/membershipPayload.ts`):

```json
{
  "v": 1,
  "communityEname": "string",
  "joinedAt": "ISO date-time string"
}
```

Write-only from CORE's side — no inbound handler registered.
```

- [ ] **Step 7: `availabilitylog.md`**

Create `docs/platform-info/ontology-spec/availabilitylog.md`:

```markdown
---
title: "Ontology: AvailabilityLog"
w3id: null
---

UUID: `9cf4bb82-d18c-4eb8-b1cc-6730026800c7` — custom ontology, not yet
registered in the W3DS Ontology service (source: `api/src/lib/w3ds/ontology.ts`).

Written to the **member's own vault**, one immutable envelope per closed-out
availability period (never updated, only created). Payload shape (source:
`api/src/services/availabilityLogPayload.ts`):

```json
{
  "v": 1,
  "communityEname": "string",
  "typeName": "string",
  "typeEmoji": "string",
  "reason": "string | null",
  "fromDate": "ISO date-time string",
  "untilDate": "ISO date-time string"
}
```

Write-only from CORE's side — no inbound handler registered.
```

- [ ] **Step 8: `platforminfo.md`**

Create `docs/platform-info/ontology-spec/platforminfo.md`:

```markdown
---
title: "Ontology: PlatformInfo"
w3id: null
---

UUID: `18a83870-04cf-4694-817a-edf037d7b256` — custom ontology, not yet
registered in the W3DS Ontology service (source: `api/src/lib/w3ds/ontology.ts`).

Written to CORE's **own** platform eVault (not a member's or community's) —
this document itself is one such envelope. Payload shape:

```json
{
  "title": "string",
  "audience": "\"user\" | \"marketplace\" | \"agents\" | \"ontology-spec\"",
  "content": "string (markdown body)",
  "updatedAt": "ISO date-time string"
}
```

Write-only, sole writer is CORE itself — no inbound handler registered.
Source of truth for these docs: `docs/platform-info/**/*.md` in this repo,
published via `npm run sync-platform-info --prefix api`.
```

- [ ] **Step 9: Commit**

```bash
git add docs/platform-info/ontology-spec/
git commit -m "docs: author ontology-spec reference docs"
```

---

### Task 5: End-to-end smoke test

**Files:**
- No new files. Modifies the `w3id` frontmatter field in all 11 files created by Tasks 3 and 4.

**Interfaces:**
- Consumes: `sync-platform-info` npm script (Task 2), all 11 markdown files (Tasks 3-4), the real `api/data/platform-identity.json` (already present in the repo with `w3id: "@3e83c2a5-20b5-56e3-bf30-388d3e73179a"`).
- Produces: nothing consumed by later tasks — this is the terminal task.

- [ ] **Step 1: Confirm the required env vars are set**

Run: `grep -E "^PUBLIC_REGISTRY_URL=|^DEVELOPER_API_KEY=" .env`
Expected: both present (the script's `evault-client.ts` needs `PUBLIC_REGISTRY_URL` to resolve CORE's own eVault; `DEVELOPER_API_KEY` is sent as the bearer token). If either is missing, stop and ask the user for the value rather than guessing — do not hardcode credentials into the script or the repo.

- [ ] **Step 2: Run the sync script for real**

Run: `cd api && npm run sync-platform-info`
Expected: 11 lines of `[sync-platform-info] created: <relative-path>`, followed by `[sync-platform-info] done. created=11 updated=0`. No errors.

- [ ] **Step 3: Verify every file's frontmatter got a real w3id**

Run: `grep -L 'w3id: null' docs/platform-info/*/*.md | wc -l`
Expected: `11` (every file's `w3id: null` was replaced — none should still read `null`).

Run: `grep -c 'w3id: "' docs/platform-info/*/*.md | grep -c ':1'`
Expected: `11` (every file has exactly one populated `w3id:` line).

- [ ] **Step 4: Re-run the script to verify update path (idempotency)**

Run: `cd api && npm run sync-platform-info`
Expected: 11 lines of `[sync-platform-info] updated: <relative-path>` (not `created`), followed by `[sync-platform-info] done. created=0 updated=11`. Frontmatter `w3id` values must be unchanged from Step 3 — confirm with `git diff docs/platform-info/` showing no changes (the second run only rewrites `updatedAt` inside the eVault payload, not the files on disk).

- [ ] **Step 5: Spot-check one envelope is queryable via GraphQL**

Pick one file's `w3id`, e.g. from `docs/platform-info/user/overview.md`, and query it:

```bash
W3ID=$(grep -oP 'w3id: "\K[^"]+' docs/platform-info/user/overview.md)
ENAME=$(node -e "console.log(JSON.parse(require('fs').readFileSync('api/data/platform-identity.json')).w3id)")
URI=$(curl -s "$PUBLIC_REGISTRY_URL/resolve?w3id=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$ENAME")" | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).uri))")
curl -s "$URI/graphql" \
  -H "Content-Type: application/json" \
  -H "X-ENAME: $ENAME" \
  -d "{\"query\": \"query { metaEnvelope(id: \\\"$W3ID\\\") { id ontology parsed } }\"}"
```

Expected: JSON response with `"ontology"` matching the `PlatformInfo` UUID (`18a83870-04cf-4694-817a-edf037d7b256`) and `"parsed"` containing `"audience": "user"` and the file's title/content.

- [ ] **Step 6: Commit the frontmatter updates**

```bash
git add docs/platform-info/
git commit -m "chore: publish platform-info docs to CORE's eVault (populate w3id frontmatter)"
```
