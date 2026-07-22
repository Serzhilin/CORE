# Platform-Info eVault Docs — Design

**Goal:** CORE publishes self-descriptive documentation (for humans, for the marketplace/directory listing, for AI agents integrating with CORE, and full ontology-spec reference) as structured data inside CORE's **own** platform eVault — not just as a website. Other W3DS-aware agents/platforms can then query it via GraphQL like any other eVault data, instead of only reading a rendered doc site.

CORE's platform eVault already exists (provisioned via `api/scripts/register-platform.ts`, identity cached at `api/data/platform-identity.json`) but nothing is wired to write documentation content into it yet. This plan adds that.

## Non-goals

- No inbound sync / read-back — CORE is the sole writer of its own `PlatformInfo` envelopes. No packet-dispatch registration, no reconciler (contrast with `Membership`/`AvailabilityLog`, which other platforms may also touch).
- No auto-generation of doc *content* from code (see Content Authoring) — only the eVault-publish step is scripted.
- No new website/renderer — [Dora](../../../Dora) (eVault explorer) already serves as a generic viewer for arbitrary eVault content; no CORE-specific UI is built here.
- Does not touch or supersede the existing `PlatformProfile` envelope (`ONTOLOGIES.User`, written by `register-platform.ts`'s `writePlatformProfile()`). See Open Question below.

## Ontology

New custom ontology `PlatformInfo`, fresh UUIDv4, added to `api/src/lib/w3ds/ontology.ts` following the existing convention (self-minted, commented `// Custom ontology — not yet registered in the Ontology service`):

```ts
PlatformInfo: '<fresh-uuidv4>', // Custom ontology — not yet registered in the Ontology service. Platform's own self-description, written to its own eVault.
```

Schema:

```json
{
  "title": "PlatformInfo",
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "audience": { "type": "string", "enum": ["user", "marketplace", "agents", "ontology-spec"] },
    "content": { "type": "string" },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "required": ["title", "audience", "content", "updatedAt"],
  "additionalProperties": false
}
```

One envelope per markdown file (not one giant envelope per audience) — keeps each doc independently queryable/updatable and keeps Awareness Protocol fanout payloads small, matching the `AvailabilityLog` one-envelope-per-entry precedent.

## File structure

```
docs/platform-info/
  user/*.md
  marketplace/*.md
  agents/*.md
  ontology-spec/*.md
```

Each file:

```markdown
---
title: "..."
w3id: null
---

<markdown body — becomes `content`>
```

`audience` is **not** a frontmatter field — it's derived from the containing folder name at sync time, so it can't drift independently of where the file actually lives.

`w3id` starts `null`. After first successful publish, the script writes the returned MetaEnvelope id back into the frontmatter and the file is committed — the file's own frontmatter is the sole identity record. No separate mapping table, no content-hash/skip logic: updates are unconditional and idempotent on every run.

## Content authoring

Hand-written markdown in all four folders, authored by a dev reading the actual code as source of truth — not auto-generated. Reason: no per-ontology field-level JSON Schema exists yet in code (`ontology.ts` today only carries a UUID + one-line comment), so there is nothing structured to generate `ontology-spec/` from without first building a schema source-of-truth — out of scope here (YAGNI).

- `user/` — plain prose, what CORE is/does. No code source.
- `marketplace/` — short structured facts (name, description, category, url, logo). See Open Question — likely restates the same fields `writePlatformProfile()` already writes to the `PlatformProfile` (`ONTOLOGIES.User`) envelope.
- `agents/` — prose plus concrete facts transcribed by hand from code: GraphQL endpoint, platform-certification auth flow, which ontologies CORE currently handles inbound (`registerOntologyHandlers.ts`'s four: `User`, `Organization`, `Availability`, `Workgroup`), noting `PlatformInfo` itself has no inbound handler (write-only).
- `ontology-spec/` — one file per ontology in `ONTOLOGIES`, hand-transcribed from the const file plus the payload shape used at each ontology's actual `createEnvelope`/`updateEnvelope` call site. Highest drift risk since it duplicates code; each file should note its own source location (e.g. "source: `api/src/lib/w3ds/ontology.ts`, `api/src/services/availabilityLogPayload.ts`") so a future reader knows where to check for staleness.

## Sync script

New `api/scripts/sync-platform-info.ts`, modeled on `register-platform.ts`'s existing manual-script convention:

1. Read `PLATFORM_ENAME` from `api/data/platform-identity.json`'s `w3id` field (same file `register-platform.ts` already maintains — no new env var).
2. Glob `docs/platform-info/**/*.md`.
3. Per file: parse YAML frontmatter (`title`, `w3id`) and body (`content`). `audience` = parent folder name.
4. `w3id` empty → `createEnvelope({ vaultEname: PLATFORM_ENAME, ontology: ONTOLOGIES.PlatformInfo, payload: { title, audience, content, updatedAt: now }, acl: ["*"] })`, write the returned id into the file's frontmatter, save.
5. `w3id` present → `updateEnvelope({ vaultEname: PLATFORM_ENAME, envelopeId: w3id, payload: { title, audience, content, updatedAt: now } })`. Unconditional, every run — no skip/hash logic.
6. Print a summary (`created N, updated N`) and exit. Frontmatter diffs (new `w3id` values) are left for the dev to `git add`/commit — the same "provision once, cache in a file, commit the result" shape as `register-platform.ts`'s `identity` file.

`api/package.json` gets one new script entry:

```json
"sync-platform-info": "ts-node scripts/sync-platform-info.ts"
```

## Trigger model: manual, dev-run

Same as `register-platform` — no server-startup hook, no CI trigger. Dev edits a doc, runs `npm run sync-platform-info --prefix api`, reviews the frontmatter diff, commits. Reasons: writes go to the real platform eVault; auto-triggering risks silent repeat-writes on every deploy; the frontmatter-commit is meant to be the audit trail of "who published what, when" — a bot-run trigger would blur that.

## Testing

- `sync-platform-info` gets no dedicated unit-test file, matching `register-platform.ts` (network/filesystem side-effect script, no existing test convention for this class of script in `api/scripts/`).
- Manual smoke check after implementation: run against one real doc file, confirm `w3id` gets written back and the envelope is queryable via GraphQL with the platform's `X-ENAME`.

## Open question

`marketplace/*.md` content likely duplicates the existing `PlatformProfile` envelope (`ONTOLOGIES.User`, written by `writePlatformProfile()` in `register-platform.ts` — same fields: platformName, displayName, description, url, logoUrl, category). Not resolved in this design: whether `marketplace/` should be a longer-form listing beyond that envelope's scope, or whether it should be dropped in favor of pointing consumers at the existing `PlatformProfile` envelope directly. Flagged here for a follow-up decision before/during implementation, not blocking the rest of this design.
