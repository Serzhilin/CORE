---
name: platform-info-authoring
description: "Use when authoring or refreshing the PlatformInfo markdown docs that Poplar's syncPlatformInfo() pushes to a platform's own eVault — generating docs/platform-info content by reading the platform's actual codebase (routes, package.json, README, existing docs). Also use when asked to \"write platform-info docs\", \"generate agent docs for this platform\", or \"prep docs for PP registration\"."
license: Apache 2.0
---

# Authoring PlatformInfo docs

Poplar's `syncPlatformInfo()` only pushes markdown files to the platform's eVault — it never
writes their content. This skill is the missing half: read the platform's own codebase and
produce that markdown, grounded in what the platform actually does, not invented capabilities.

## Where the files go

`docsRoot` (passed to `SyncPlatformInfoConfig`) is a folder with exactly one subfolder per
audience. Check the platform's own `sync-platform-info.ts`/wrapper script for its `docsRoot`
value — default convention is `docs/platform-info/`:

```
docs/platform-info/
  user/            — for end users of this platform
  marketplace/      — for the W3DS platform directory / other platforms deciding whether to link
  agents/           — for AI agents or automation integrating with this platform's data
  ontology-spec/    — for schema-level integrators: which ontologies this platform reads/writes
```

A folder name outside this set of four is rejected by `syncPlatformInfo` at sync time
(`deriveAudience` throws) — don't invent a fifth audience.

## File format

Every file needs a frontmatter block, exact format (Poplar's parser is a fixed regex, not a
YAML library — don't deviate):

```markdown
---
title: "Short title"
w3id: null
---

Body content here.
```

- `title`: quoted string, one line.
- `w3id`: literally `null` for a brand-new doc. **Never fabricate an id.** `syncPlatformInfo`
  creates the eVault envelope and rewrites this field with the real id on first sync — if the
  file already has a real `w3id` (a re-sync/refresh task), leave it untouched so the existing
  envelope gets updated instead of a duplicate created.
- Body: everything after the closing `---` and blank line, trimmed.

## What to write per audience

Ground every claim in the actual codebase — read `package.json`/`README.md` for what the
platform does, and its routes/controllers for what's really implemented. Do not describe planned
or aspirational features as if they exist.

- **user/** — a real guide, not a blurb. Two sentences is a failure here. Structure:
  1. One short paragraph: what the platform is, who it's for.
  2. A **user story per distinct role** the platform has (e.g. regular member vs admin/owner) —
     each story is "As a [role], you can [concrete action]", grounded in an actual route,
     screen, or button, not a paraphrase of the data model. Group related actions under a
     subheading per role. Cover the platform's real workflows end to end (onboarding →
     day-to-day actions → any admin/management actions), not just a features bullet list.
  3. If the platform syncs data to the user's own eVault (most W3DS platforms do), one closing
     paragraph on what that means for the user in practice (e.g. "other W3DS platforms can see
     your workgroup membership without you re-entering it").
  Plain language throughout, no API/ontology/implementation detail — but complete enough that
  someone who has never opened the app could read it and know every major thing they can do.
  To write this accurately, read the actual frontend routes/views (not just README/package.json)
  — for each route, note what a user can click or submit there, and which routes are gated to
  an admin role vs open to any member.
- **marketplace/** — a short pitch for the W3DS platform directory: one paragraph on what the
  platform does and who it's for, written as if a stranger platform is deciding whether to
  recommend it to their users.
- **agents/** — technical: what data this platform's eVault envelopes contain (which
  ontologies it writes, e.g. `PlatformInfo`, `Workgroup`, `Chat`), and any endpoints or
  conventions another platform's automation would need to interoperate. Pull ontology UUIDs and
  field shapes from the platform's actual `ontology.ts`/schema files — don't guess.
  If the target repo has a `w3ds` skill available, load its `reference/registry.md` for the
  canonical ontology UUID table rather than re-deriving field names from memory.
- **ontology-spec/** — one file per ontology this platform **writes to**, regardless of whether
  the platform originated that schema, and regardless of whether the write touches every field or
  only a few. Schema ownership and being a data source are different questions — an integrator
  reading this file wants to know exactly what fields *this platform* puts in envelopes of that
  schemaId, even if another platform designed the schema (e.g. a chat-notification ontology
  defined by a separate messaging platform that this one also writes instances of) or if this
  platform only patches 1-2 fields of an otherwise shared, well-known ontology (e.g. patching just
  `displayName`/`bio` on a `User` envelope still counts as writing `User` — say so explicitly and
  list only the fields actually touched, don't describe the whole schema). If this platform only
  *reads* an ontology and never writes any field of it, it does not get a file here — cover it in
  `agents/` instead. List the exact fields and types as they appear in the platform's
  payload-building code (e.g. `buildWorkgroupPayload`-style functions), not an idealized schema. If
  the schema is owned elsewhere, say so in one line at the top of the file and note that the
  owning platform's spec wins on conflict.

## Process

1. Find or confirm `docsRoot` from the platform's `sync-platform-info.ts` wrapper (or the
   `SyncPlatformInfoConfig` call site).
2. Read `package.json` description, top-level `README.md`, and the main route/controller files
   to learn what the platform actually does. For `user/` specifically, also read the frontend's
   route definitions and each routed view/component — the user guide is wrong if it's built from
   the README alone.
3. Find the platform's ontology constants file (e.g. `ontology.ts`) and enumerate **every entry
   in it as a checklist** — don't rely on ontologies surfacing incidentally while reading routes.
   If no single constants file exists (schemaIds instead appear as inline string/UUID literals
   scattered near eVault-client calls), build the checklist by grepping for the mutation calls
   below across the whole codebase and collecting every distinct schemaId literal passed to them
   — the absence of a constants file is not an excuse to skip enumeration, only a different way to
   build the same list.
   For each entry, grep its usages to classify it: does this platform ever write it, or does it
   only read it? "Write" means *any* of: `createMetaEnvelope`, `updateMetaEnvelope`,
   `removeMetaEnvelope`, `bulkCreateMetaEnvelopes`, and their legacy aliases
   `storeMetaEnvelope`/`updateMetaEnvelopeById` (see the `w3ds` skill's terminology notes if
   present), or any platform-specific payload-builder function that feeds one of those calls —
   even a call that only sets 1-2 fields counts as a write. Written ontologies each get an
   `ontology-spec/` file (see below) whether or not this platform originated the schema and
   whether the write is a full envelope or a partial-field patch; read-only ontologies get a
   mention in `agents/` only, never their own `ontology-spec/` file. Skipping this enumeration is
   the most common way an agent under-covers a platform's real integration surface.
4. For any existing `docs/platform-info/**/*.md` files, treat them as the current source of
   truth to refresh, not overwrite blindly — keep their `w3id` as-is.
5. Write one new file per audience/ontology that doesn't already have coverage; each starts with
   `w3id: null`.
6. Before finishing, recount: every ontology your step 3 checklist marked "written" must have a
   matching `ontology-spec/*.md` file, one-to-one. If the counts don't match, you skipped one —
   go back and add the missing file rather than reporting completion. This recount is the
   agent's own check, not something the reader of the docs can catch later.
7. Do not run `syncPlatformInfo` yourself unless asked — authoring the docs and pushing them to
   a real eVault are separate steps. Tell the user the files are ready for `syncPlatformInfo`.

## Non-goals

- Not a content style guide beyond audience separation — match the platform's existing
  documentation tone if it has one.
- Not a substitute for the `w3ds` skill's ontology reference — load that skill (if present in
  the target repo) for authoritative ontology UUIDs and field names instead of guessing.
