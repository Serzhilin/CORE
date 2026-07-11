# User Profile eVault Sync — Design

**Goal:** CORE's "My Profile" page gains display name, photo, and banner (fields it doesn't have yet), grouped the same way Onboarding's profile page groups them, and pushes bio/display name/photo/banner to the member's own W3DS eVault User envelope. Email and phone stay CORE-only in both directions, with a visible "not synced" indicator.

**Architecture:** Mirrors the payload-builder + orchestrator-service pattern already established for Organization sync (`organizationPayload.ts` + `OrganizationService.ts`), rather than Onboarding's inline approach. A new pure `buildUserProfilePayload` function is unit-tested in isolation; a new `UserProfileSyncService` does the read-modify-write against the person's own eVault User envelope, reusing the cached `Person.meta_envelope_id` where already resolved.

**Tech Stack:** No new dependencies. Reuses existing `evault-client.ts` GraphQL primitives, adding one new function (`uploadFile`) that CORE doesn't have yet but Onboarding already implements the same way.

## Global Constraints

- Email and phone are never sent to or read from eVault — DB-only, in both directions. The existing inbound webhook currently pulls `email` from eVault; this is a pre-existing inconsistency this work removes.
- First name, last name, and eName are **read-only** in CORE's profile UI. They are populated exclusively by the existing inbound webhook (`PersonService.upsertFromWebhook`) and never edited or pushed from CORE.
- Display name, bio, avatar, and banner are editable in CORE and pushed to the eVault User envelope on save (fire-and-forget, `.catch(logger.warn)`, consistent with every other outbound sync in this codebase — DB is cache, eVault is source of truth, but a sync failure never blocks or reverts the local save for these fields since they are non-destructive updates, unlike membership removal).
- Additive schema change only: two new nullable `Person` columns (`display_name`, `banner_url`). No formal migration system exists in this repo (dev relies on TypeORM `synchronize: true`); any production deploy note follows the same manual-step convention used for the Organization sync migration.

---

## Data Model

### `Person` entity (`api/src/database/entities/Person.ts`)

Add two nullable columns:

```ts
@Column({ type: "varchar", nullable: true })
display_name: string | null;

@Column({ type: "text", nullable: true })
banner_url: string | null;
```

Existing columns unchanged: `id, ename, first_name, last_name, email, phone, bio, avatar_url, meta_envelope_id, created_at, updated_at`.

## Backend

### `api/src/services/userProfilePayload.ts` (new)

Pure function, no I/O, unit-testable exactly like `organizationPayload.ts`:

```ts
export interface UserProfilePayloadInput {
    existing: Record<string, unknown>; // current envelope payload, spread first to preserve unmapped fields (isVerified, followers, etc.)
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null; // w3ds://file URI or plain URL
    bannerUrl: string | null;
}

export function buildUserProfilePayload(input: UserProfilePayloadInput): Record<string, unknown> {
    return {
        ...input.existing,
        displayName: input.displayName,
        bio: input.bio,
        avatarUrl: input.avatarUrl,
        bannerUrl: input.bannerUrl,
    };
}
```

Only overwrites the four fields CORE now owns; everything else in the existing envelope payload (email, isVerified, followers, whatever other platforms wrote) passes through untouched.

### `api/src/services/UserProfileSyncService.ts` (new)

```ts
export async function syncUserProfileToEvault(personId: string): Promise<void>
```

- Loads the `Person` row. If no `ename`, return (nothing to sync — not yet claimed).
- Resolves the envelope to update:
  - If `person.meta_envelope_id` is set, use it directly as `envelopeId` — no extra lookup.
  - Otherwise, call `findEnvelopesByOntology(person.ename, ONTOLOGIES.User, 1)`; if found, cache the id back onto `Person.meta_envelope_id`. If not found, return (no User envelope exists yet to update — CORE does not create User envelopes, only Organization/Workgroup ones; a User envelope is created by the wallet/provisioner, not by a platform).
- Builds the payload via `buildUserProfilePayload`, spreading the existing envelope's `parsed` payload first.
- Calls `updateEnvelope({ vaultEname: person.ename, envelopeId, ontology: ONTOLOGIES.User, payload, acl: ["*"] })`.

Called fire-and-forget (`.catch(logger.warn)`) from two call sites:
1. `updateMeHandler` (after a successful `updatePerson` save that touched `display_name` or `bio`).
2. The new `POST /api/profile/image` handler (after a successful avatar/banner upload).

### `api/src/lib/evault-client.ts` — add `uploadFile`

New export, same shape as Onboarding's (`Onboarding/api/api/src/lib/evault-client.ts`'s `uploadFile`): takes `(ename, filename, mimeType, base64Data)`, calls eVault's `uploadFile` GraphQL mutation, returns `{ uri, publicUrl }`. This is the one genuinely new capability CORE's client needs — every other primitive it uses already exists.

### `api/src/controllers/AuthController.ts` — `updateMeHandler`

- Whitelist becomes `email, phone, bio, avatar_url, display_name` — **`first_name`/`last_name` removed** (no longer editable via this endpoint).
- After `updatePerson` succeeds, if the patch touched `bio` or `display_name`, fire `syncUserProfileToEvault(personId).catch(...)`.
- `getMe`'s response DTO adds `displayName: p.display_name` and `bannerUrl: p.banner_url` alongside the existing fields.

### `api/src/controllers/AuthController.ts` — new `uploadProfileImageHandler`, registered as `POST /api/profile/image` in `api/src/index.ts`

Mirrors Onboarding's endpoint, as an exported handler alongside `updateMeHandler`/`getMe` (same file, since this is a "my own profile" action, not a distinct resource controller):
```ts
export async function uploadProfileImageHandler(req: Request, res: Response) { ... }
```
- Body: `{ field: 'avatar_url' | 'banner_url', file: { name, type, data } }` (base64 `data`).
- Calls `uploadFile`, gets `{ uri, publicUrl }`.
- Resolves a display URL via the existing `resolveW3dsFileUrl` if `publicUrl` isn't already present (same fallback Onboarding uses).
- Updates `Person.avatar_url` or `Person.banner_url` in DB to the resolved display URL.
- Fires `syncUserProfileToEvault(personId)` with `avatarUrl`/`bannerUrl` set to the `w3ds://file` URI (not the resolved HTTP URL — the envelope stores the portable URI, same as Onboarding).
- Returns `{ url: resolvedUrl }` to the frontend for immediate display.

### `api/src/services/PersonService.ts` — `upsertFromWebhook`

- Add: `if (typeof data.displayName === "string") existing.display_name = data.displayName;`
- Add: `if (typeof data.bannerUrl === "string") existing.banner_url = (await resolveW3dsFileUrl(data.bannerUrl)) ?? data.bannerUrl;` (same resolution pattern already used for `avatarUrl`).
- **Remove** the existing `if (typeof data.email === "string") existing.email = data.email;` line — email becomes DB-only in both directions, closing the inconsistency this design calls out.

## Frontend

### `app/src/views/MyProfile.jsx` — restructure into sections

Replacing the current single flat form, in this order (matching Onboarding's grouping, styled with CORE's existing `card`/`--color-sand` conventions):

1. **Banner** — full-width image area, click-to-upload (same file-input-hidden-behind-label pattern as the current avatar), posts to `/api/profile/image` with `field: 'banner_url'`.
2. **Avatar + display name row** — avatar circle (click-to-upload, same pattern, now posts to `/api/profile/image` with `field: 'avatar_url'`), display name as an editable text input inline next to it (not a separate section — keeps the "who is this" identity cluster together).
3. **Bio** — editable textarea, unchanged from today except relabeled/regrouped.
4. **Detail card** — read-only rows: eName (already read-only today), First name, Last name (newly made read-only — dropped from the editable form).
5. **Email / Phone** — editable inputs, each with a small inline "not synced" icon: an inline SVG (simple cloud-with-slash, ~14px, matching the existing inline-SVG convention used for the trash icon in `MembersTab.jsx`) placed after the label, with a `title` attribute reading "Not synced to eVault".

Saving: display name + bio + email + phone all continue to go through the existing `PATCH /api/me` (`updateMe` client call) in one combined form submit. Avatar/banner uploads are separate, immediate-on-select actions (as they are today), now hitting the new `/api/profile/image` endpoint instead of inlining a data URL.

### `app/src/api/client.js`

- `updateMe(data)` — unchanged signature, `data` may now include `display_name`.
- New `uploadProfileImage(field, file)` — reads the file as a data URL (same `FileReader` pattern `MyProfile.jsx` already uses for avatar), POSTs to `/api/profile/image`, returns `{ url }`.

## Testing

- `api/src/services/__tests__/userProfilePayload.test.ts` — unit tests for `buildUserProfilePayload`: spreads existing fields, overwrites exactly the 4 owned fields, handles `null` values, never includes `email`/`phone`/`firstName`/`lastName` in its output (a test explicitly assert these keys are absent from the payload's own inputs/outputs, to guard the "never synced" constraint going forward).
- No integration test for `UserProfileSyncService` or the eVault-hitting endpoints, matching the existing convention (`OrganizationService.ts`, `WorkgroupService.ts` have no direct tests either — only their payload builders do).

## Out of scope (explicitly, per this conversation)

- Website, location, language fields (Onboarding has them; not requested).
- Syncing first name / last name outbound (display-only per this design).
- Any change to the inbound webhook's resolution logic beyond adding `displayName`/`bannerUrl` and removing `email`.
