# User Profile eVault Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CORE's "My Profile" page gains display name and banner fields (new), grouped like Onboarding's profile page, and pushes bio/display name/avatar/banner to the member's own W3DS eVault User envelope. Email and phone stay CORE-only in both directions, with a "not synced" icon. First/last name become read-only display fields, populated only by the inbound webhook.

**Architecture:** Mirrors the payload-builder + orchestrator-service pattern from Organization sync (`organizationPayload.ts` + `OrganizationService.ts`): a pure `buildUserProfilePayload` function, unit-tested in isolation, and a `UserProfileSyncService` that does the read-modify-write against the person's own eVault User envelope, reusing the cached `Person.meta_envelope_id`.

**Tech Stack:** No new dependencies. Extends `api/src/lib/evault-client.ts` with one new primitive (`uploadFile`, mirrored from Onboarding's existing implementation).

## Global Constraints

- Email and phone are never sent to or read from eVault — DB-only, both directions. Remove the existing inbound-webhook pull of `email`.
- First name, last name, and eName are **read-only** in the UI. Populated only by `PersonService.upsertFromWebhook`. Never editable, never pushed outbound.
- Display name, bio, avatar, banner are editable and pushed to the eVault User envelope on save, fire-and-forget (`.catch(logger.warn)`) — a sync failure never blocks or reverts the local DB save.
- **Read-modify-write correctness (critical):** `Person.avatar_url`/`Person.banner_url` in Postgres cache the *resolved HTTP display URL*. The eVault envelope must store the portable `w3ds://file` URI instead. `UserProfileSyncService` must never read `Person.avatar_url`/`Person.banner_url` and write them into the envelope — doing so would overwrite a correct `w3ds://file` URI with an HTTP URL on every bio/displayName-only save. The service must preserve the envelope's own existing `avatarUrl`/`bannerUrl` unless the caller explicitly passes a fresh URI to write (see Task 4).
- Additive schema change only: two new nullable `Person` columns (`display_name`, `banner_url`). No formal migration system exists (dev uses TypeORM `synchronize: true`).
- Ontology reference: `ONTOLOGIES.User = '550e8400-e29b-41d4-a716-446655440000'` (`api/src/lib/w3ds/ontology.ts`). The User ontology has no `email`/`phone`/`firstName`/`lastName` fields at all — those never legitimately appear in an envelope payload.

---

### Task 1: `Person` entity — add `display_name`, `banner_url` columns

**Files:**
- Modify: `api/src/database/entities/Person.ts`

**Interfaces:**
- Produces: `Person.display_name: string | null`, `Person.banner_url: string | null` — consumed by Tasks 4, 5, 6, 7.

No dedicated test — entity column additions aren't unit-tested elsewhere in this codebase (Organization/Workgroup entities follow the same precedent); Task 2's payload test and `tsc --noEmit` are the safety net.

- [ ] **Step 1: Add the two columns**

In `api/src/database/entities/Person.ts`, insert after the existing `avatar_url` column (before the `meta_envelope_id` comment/column):

```ts
    @Column({ type: "varchar", nullable: true })
    display_name: string | null;

    @Column({ type: "text", nullable: true })
    banner_url: string | null;
```

- [ ] **Step 2: Verify**

```bash
cd api && npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add api/src/database/entities/Person.ts
git commit -m "feat: add display_name and banner_url columns to Person"
```

---

### Task 2: `userProfilePayload.ts` — pure payload builder + unit tests

**Files:**
- Create: `api/src/services/userProfilePayload.ts`
- Test: `api/src/services/__tests__/userProfilePayload.test.ts`

**Interfaces:**
- Consumes: nothing (pure function, no I/O).
- Produces: `buildUserProfilePayload(input: UserProfilePayloadInput): Record<string, unknown>` and the `UserProfilePayloadInput` type — consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

Create `api/src/services/__tests__/userProfilePayload.test.ts`:

```ts
import { buildUserProfilePayload } from "../userProfilePayload";

describe("buildUserProfilePayload", () => {
    it("overwrites displayName, bio, avatarUrl, bannerUrl on top of the existing payload", () => {
        const result = buildUserProfilePayload({
            existing: { isVerified: true, followers: ["@a"], displayName: "Old Name", bio: "Old bio" },
            displayName: "New Name",
            bio: "New bio",
            avatarUrl: "w3ds://file?id=@user/env-1",
            bannerUrl: "w3ds://file?id=@user/env-2",
        });
        expect(result).toEqual({
            isVerified: true,
            followers: ["@a"],
            displayName: "New Name",
            bio: "New bio",
            avatarUrl: "w3ds://file?id=@user/env-1",
            bannerUrl: "w3ds://file?id=@user/env-2",
        });
    });

    it("preserves fields on the existing payload that CORE does not own", () => {
        const result = buildUserProfilePayload({
            existing: { ename: "@user", isPrivate: false, username: "woonwolf" },
            displayName: null,
            bio: null,
            avatarUrl: null,
            bannerUrl: null,
        });
        expect(result.ename).toBe("@user");
        expect(result.isPrivate).toBe(false);
        expect(result.username).toBe("woonwolf");
    });

    it("writes null for the 4 owned fields when given null, rather than omitting them", () => {
        const result = buildUserProfilePayload({ existing: {}, displayName: null, bio: null, avatarUrl: null, bannerUrl: null });
        expect(result).toEqual({ displayName: null, bio: null, avatarUrl: null, bannerUrl: null });
    });

    it("never introduces email, phone, firstName, or lastName — CORE never owns these fields", () => {
        const result = buildUserProfilePayload({
            existing: { username: "woonwolf", ename: "@user", isVerified: true },
            displayName: "New Name",
            bio: "bio text",
            avatarUrl: null,
            bannerUrl: null,
        });
        expect(result).not.toHaveProperty("email");
        expect(result).not.toHaveProperty("phone");
        expect(result).not.toHaveProperty("firstName");
        expect(result).not.toHaveProperty("lastName");
    });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd api && npx jest userProfilePayload --no-coverage
```
Expected: FAIL — `Cannot find module '../userProfilePayload'`.

- [ ] **Step 3: Implement `userProfilePayload.ts`**

Create `api/src/services/userProfilePayload.ts`:

```ts
export interface UserProfilePayloadInput {
    existing: Record<string, unknown>;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
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

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd api && npx jest userProfilePayload --no-coverage
```
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/userProfilePayload.ts api/src/services/__tests__/userProfilePayload.test.ts
git commit -m "feat: add buildUserProfilePayload pure builder for user profile eVault sync"
```

---

### Task 3: `evault-client.ts` — add `uploadFile`

**Files:**
- Modify: `api/src/lib/evault-client.ts`

**Interfaces:**
- Consumes: existing `gqlRequest<T>` helper in the same file.
- Produces: `uploadFile(vaultEname: string, filename: string, contentType: string, content: string, acl?: string[]): Promise<{ uri: string; publicUrl: string | null }>` — consumed by Task 6.

No dedicated test — none of this file's existing GraphQL primitives (`createEnvelope`, `updateEnvelope`, etc.) have unit tests; they require a live eVault. `tsc --noEmit` is the safety net.

- [ ] **Step 1: Add `GQL_UPLOAD` and `uploadFile`**

In `api/src/lib/evault-client.ts`, add after `getUserMetaEnvelopeId` (before `resolveW3dsFileUrl`):

```ts
const GQL_UPLOAD = `
  mutation UploadFile($input: UploadFileInput!) {
    uploadFile(input: $input) {
      uri
      metaEnvelopeId
      publicUrl
      errors { field message code }
    }
  }
`

export async function uploadFile(
  vaultEname: string,
  filename: string,
  contentType: string,
  content: string,
  acl: string[] = ['*']
): Promise<{ uri: string; publicUrl: string | null }> {
  const data = await gqlRequest<{
    uploadFile: {
      uri: string
      metaEnvelopeId: string
      publicUrl: string | null
      errors?: Array<{ message?: string }>
    }
  }>(vaultEname, GQL_UPLOAD, {
    input: { filename, contentType, content, acl },
  })
  if (data.uploadFile.errors?.length) {
    throw new Error(data.uploadFile.errors[0]?.message ?? 'uploadFile failed')
  }
  return { uri: data.uploadFile.uri, publicUrl: data.uploadFile.publicUrl ?? null }
}
```

- [ ] **Step 2: Verify**

```bash
cd api && npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add api/src/lib/evault-client.ts
git commit -m "feat: add uploadFile primitive to evault-client"
```

---

### Task 4: `UserProfileSyncService.ts` — orchestrator

**Files:**
- Create: `api/src/services/UserProfileSyncService.ts`

**Interfaces:**
- Consumes: `Person` entity (Task 1), `buildUserProfilePayload` (Task 2), `findEnvelopesByOntology`/`getEnvelope`/`updateEnvelope` (existing `evault-client.ts`), `ONTOLOGIES.User` (existing `ontology.ts`).
- Produces: `syncUserProfileToEvault(personId: string, overrides?: { avatarUrl?: string; bannerUrl?: string }): Promise<void>` — consumed by Task 6. Overrides let a caller push a freshly uploaded `w3ds://file` URI for exactly one of `avatarUrl`/`bannerUrl` without disturbing the other or the envelope's other fields (see Global Constraints — this is the fix for the DB-cache-vs-envelope-URI mismatch).

No dedicated test — matches the existing no-test precedent for `OrganizationService.ts`/`WorkgroupService.ts` (orchestrators aren't directly tested, only their payload builders).

- [ ] **Step 1: Implement `UserProfileSyncService.ts`**

Create `api/src/services/UserProfileSyncService.ts`:

```ts
import { AppDataSource } from "../database/data-source";
import { Person } from "../database/entities/Person";
import { findEnvelopesByOntology, getEnvelope, updateEnvelope } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { buildUserProfilePayload } from "./userProfilePayload";

const personRepo = () => AppDataSource.getRepository(Person);

export interface UserProfileSyncOverrides {
    avatarUrl?: string;
    bannerUrl?: string;
}

export async function syncUserProfileToEvault(personId: string, overrides: UserProfileSyncOverrides = {}): Promise<void> {
    const person = await personRepo().findOne({ where: { id: personId } });
    if (!person?.ename) return;

    let envelopeId = person.meta_envelope_id;
    if (!envelopeId) {
        const envelopes = await findEnvelopesByOntology(person.ename, ONTOLOGIES.User, 1);
        if (!envelopes[0]) return;
        envelopeId = envelopes[0].id;
        await personRepo().update(person.id, { meta_envelope_id: envelopeId });
    }

    const existing = (await getEnvelope(person.ename, envelopeId)) ?? {};
    const payload = buildUserProfilePayload({
        existing,
        displayName: person.display_name,
        bio: person.bio,
        avatarUrl: overrides.avatarUrl ?? (existing.avatarUrl as string | undefined) ?? null,
        bannerUrl: overrides.bannerUrl ?? (existing.bannerUrl as string | undefined) ?? null,
    });

    await updateEnvelope({ vaultEname: person.ename, envelopeId, ontology: ONTOLOGIES.User, payload, acl: ["*"] });
}
```

- [ ] **Step 2: Verify**

```bash
cd api && npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add api/src/services/UserProfileSyncService.ts
git commit -m "feat: add UserProfileSyncService orchestrator for outbound user profile sync"
```

---

### Task 5: `PersonService.ts` — whitelist, inbound webhook

**Files:**
- Modify: `api/src/services/PersonService.ts`

**Interfaces:**
- Consumes: `Person.display_name`/`Person.banner_url` (Task 1), `resolveW3dsFileUrl` (existing).
- Produces: `updatePerson` accepts `display_name`/`banner_url` in its whitelist — consumed by Task 6.

- [ ] **Step 1: Widen `updatePerson`'s whitelist**

In `api/src/services/PersonService.ts`, replace:

```ts
export async function updatePerson(id: string, data: Partial<Pick<Person,
    "first_name" | "last_name" | "email" | "phone" | "bio" | "avatar_url" | "ename" | "meta_envelope_id">>): Promise<Person> {
```

with:

```ts
export async function updatePerson(id: string, data: Partial<Pick<Person,
    "first_name" | "last_name" | "email" | "phone" | "bio" | "avatar_url" | "display_name" | "banner_url" | "ename" | "meta_envelope_id">>): Promise<Person> {
```

- [ ] **Step 2: Update `upsertFromWebhook` — add displayName/bannerUrl, remove email pull**

Replace:

```ts
    if (firstName) existing.first_name = firstName;
    if (lastName) existing.last_name = lastName;
    if (typeof data.bio === "string") existing.bio = data.bio;
    if (typeof data.email === "string") existing.email = data.email;
    if (typeof data.avatarUrl === "string") {
        existing.avatar_url = (await resolveW3dsFileUrl(data.avatarUrl)) ?? data.avatarUrl;
    }
```

with:

```ts
    if (firstName) existing.first_name = firstName;
    if (lastName) existing.last_name = lastName;
    if (typeof data.bio === "string") existing.bio = data.bio;
    if (typeof data.displayName === "string") existing.display_name = data.displayName;
    if (typeof data.avatarUrl === "string") {
        existing.avatar_url = (await resolveW3dsFileUrl(data.avatarUrl)) ?? data.avatarUrl;
    }
    if (typeof data.bannerUrl === "string") {
        existing.banner_url = (await resolveW3dsFileUrl(data.bannerUrl)) ?? data.bannerUrl;
    }
```

- [ ] **Step 3: Verify**

```bash
cd api && npx tsc --noEmit && npm test
```
Expected: 0 errors, all suites pass.

- [ ] **Step 4: Commit**

```bash
git add api/src/services/PersonService.ts
git commit -m "feat: sync displayName/bannerUrl inbound, stop pulling email from eVault"
```

---

### Task 6: `AuthController.ts` — serializer, `updateMe`, new upload endpoint, route wiring

**Files:**
- Modify: `api/src/controllers/AuthController.ts`
- Modify: `api/src/index.ts`

**Interfaces:**
- Consumes: `updatePerson` (Task 5), `syncUserProfileToEvault` (Task 4), `uploadFile`/`resolveW3dsFileUrl` (Task 3 / existing).
- Produces: `serializePerson` output gains `displayName: p.display_name` (replacing the old computed-from-first/last-name value) and `bannerUrl: p.banner_url`. New `POST /api/profile/image` endpoint. Consumed by Task 7 (frontend).

The existing `displayName(p)` helper in `PersonService.ts` (computed from first/last name) becomes unused by this change — grep confirms it has no other callers. Remove the helper and its import rather than leaving dead code.

- [ ] **Step 1: Remove the now-unused `displayName` helper from `PersonService.ts`**

In `api/src/services/PersonService.ts`, delete:

```ts
export function displayName(p: Person): string {
    if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
    if (p.first_name) return p.first_name;
    return p.ename ?? p.id;
}

```

- [ ] **Step 2: Update imports and `serializePerson` in `AuthController.ts`**

Replace:

```ts
import { Request, Response } from "express";
```

with:

```ts
import { Request, Response, NextFunction } from "express";
```

Replace:

```ts
import { findOrCreateByEname, fetchEVaultProfile, updatePerson, displayName, findById } from "../services/PersonService";
import { getUserMetaEnvelopeId } from "../lib/evault-client";
```

with:

```ts
import { findOrCreateByEname, fetchEVaultProfile, updatePerson, findById } from "../services/PersonService";
import { getUserMetaEnvelopeId, uploadFile, resolveW3dsFileUrl } from "../lib/evault-client";
import { syncUserProfileToEvault } from "../services/UserProfileSyncService";
```

Replace:

```ts
function serializePerson(p: Person) {
    return {
        id: p.id,
        ename: p.ename,
        firstName: p.first_name,
        lastName: p.last_name,
        displayName: displayName(p),
        email: p.email,
        phone: p.phone,
        bio: p.bio,
        avatarUrl: p.avatar_url,
    };
}
```

with:

```ts
function serializePerson(p: Person) {
    return {
        id: p.id,
        ename: p.ename,
        firstName: p.first_name,
        lastName: p.last_name,
        displayName: p.display_name,
        email: p.email,
        phone: p.phone,
        bio: p.bio,
        avatarUrl: p.avatar_url,
        bannerUrl: p.banner_url,
    };
}
```

- [ ] **Step 3: Update `updateMe`, add `uploadProfileImageHandler`**

Replace the entire `updateMe` function:

```ts
export async function updateMe(req: Request, res: Response) {
    const { first_name, last_name, email, phone, bio, avatar_url } = req.body;
    try {
        const person = await updatePerson(req.user!.userId, { first_name, last_name, email, phone, bio, avatar_url });
        res.json(serializePerson(person));
    } catch (err: any) {
        if (err.code === "23505") { res.status(409).json({ error: "Email already in use" }); return; }
        throw err;
    }
}
```

with:

```ts
export async function updateMe(req: Request, res: Response, next: NextFunction) {
    const { email, phone, bio, avatar_url, display_name } = req.body;
    try {
        const personId = req.user!.userId;
        const person = await updatePerson(personId, { email, phone, bio, avatar_url, display_name });
        res.json(serializePerson(person));
        if (bio !== undefined || display_name !== undefined) {
            syncUserProfileToEvault(personId).catch((err) => logger.warn(err, "user profile eVault sync failed for %s", personId));
        }
    } catch (err: any) {
        if (err.code === "23505") { res.status(409).json({ error: "Email already in use" }); return; }
        next(err);
    }
}

export async function uploadProfileImageHandler(req: Request, res: Response, next: NextFunction) {
    const { field, file } = req.body; // field: 'avatar_url' | 'banner_url'; file: { name, type, data }
    if (field !== "avatar_url" && field !== "banner_url") { res.status(400).json({ error: "field must be avatar_url or banner_url" }); return; }
    if (!file?.data || !file?.name || !file?.type) { res.status(400).json({ error: "file with name, type, data is required" }); return; }

    try {
        const personId = req.user!.userId;
        const person = await findById(personId);
        if (!person?.ename) { res.status(400).json({ error: "No eName linked to this account yet" }); return; }

        const { uri, publicUrl } = await uploadFile(person.ename, file.name, file.type, file.data);
        const resolvedUrl = publicUrl ?? (await resolveW3dsFileUrl(uri));

        await updatePerson(personId, { [field]: resolvedUrl } as Partial<Pick<Person, "avatar_url" | "banner_url">>);
        res.json({ url: resolvedUrl });

        const overrideKey = field === "avatar_url" ? "avatarUrl" : "bannerUrl";
        syncUserProfileToEvault(personId, { [overrideKey]: uri }).catch((err) => logger.warn(err, "user profile eVault sync failed for %s", personId));
    } catch (err) {
        next(err);
    }
}
```

- [ ] **Step 4: Wire the new route in `api/src/index.ts`**

Replace:

```ts
import { getOffer, epassportLogin, sseAuthStream, devLogin, getMe, updateMe } from "./controllers/AuthController";
```

with:

```ts
import { getOffer, epassportLogin, sseAuthStream, devLogin, getMe, updateMe, uploadProfileImageHandler } from "./controllers/AuthController";
```

Replace:

```ts
app.patch("/api/me", requireAuth, updateMe);
```

with:

```ts
app.patch("/api/me", requireAuth, updateMe);
app.post("/api/profile/image", requireAuth, uploadProfileImageHandler);
```

- [ ] **Step 5: Verify**

```bash
cd api && npx tsc --noEmit && npm test
```
Expected: 0 errors, all suites pass.

- [ ] **Step 6: Commit**

```bash
git add api/src/controllers/AuthController.ts api/src/services/PersonService.ts api/src/index.ts
git commit -m "feat: sync bio/displayName on save, add profile image upload endpoint"
```

---

### Task 7: Frontend — `MyProfile.jsx` restructure, `client.js`

**Files:**
- Modify: `app/src/views/MyProfile.jsx`
- Modify: `app/src/api/client.js`

**Interfaces:**
- Consumes: `serializePerson`'s `displayName`/`bannerUrl` fields (Task 6), `PATCH /api/me` (existing, whitelist changed in Task 6), `POST /api/profile/image` (Task 6).
- Produces: `uploadProfileImage(field, file)` client function.

No automated test — this is a manual-form React view with no existing test harness for `MyProfile.jsx` or sibling views (`CardGrid.jsx`, `MembersTab.jsx`) in this codebase; verification is `npm run build` + manual browser check, matching the precedent set by Tasks 10/11 of the Organization sync plan.

- [ ] **Step 1: Add `uploadProfileImage` to `client.js`**

In `app/src/api/client.js`, replace:

```js
export const getMe = () => req('GET', '/me')
export const updateMe = (data) => req('PATCH', '/me', data)
```

with:

```js
export const getMe = () => req('GET', '/me')
export const updateMe = (data) => req('PATCH', '/me', data)

export function uploadProfileImage(field, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const [, base64] = String(reader.result).split(',')
        const result = await req('POST', '/profile/image', { field, file: { name: file.name, type: file.type, data: base64 } })
        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
```

- [ ] **Step 2: Rewrite `MyProfile.jsx`**

Replace the whole file:

```jsx
import { useState } from 'react'
import { useUser } from '../context/UserContext'
import { updateMe, uploadProfileImage } from '../api/client'

const NOT_SYNCED_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 5, verticalAlign: 'middle', color: 'var(--color-charcoal-light)' }}>
    <path d="M4 4l16 16" />
    <path d="M9.5 5.5A5 5 0 0 1 20 8a4 4 0 0 1-1 7.9" />
    <path d="M6.5 6.8A4.5 4.5 0 0 0 7 15.5H16" />
  </svg>
)

export default function MyProfile() {
  const { user, refreshMe } = useUser()

  const [form, setForm] = useState({
    display_name: user?.displayName || '',
    bio: user?.bio || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [bannerSaving, setBannerSaving] = useState(false)

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid var(--color-sand-dark)', fontSize: '0.95rem', background: 'white',
    boxSizing: 'border-box',
  }
  const readOnlyStyle = {
    padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-sand)',
    background: 'var(--color-cream)', fontSize: '0.9rem', color: 'var(--color-charcoal-light)',
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    try {
      await updateMe(form)
      await refreshMe()
      setSaveMsg('Saved!')
    } catch (err) {
      setSaveMsg('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleImageUpload(field, setImageSaving) {
    return (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      setImageSaving(true)
      uploadProfileImage(field, file)
        .then(() => refreshMe())
        .catch((err) => alert('Upload failed: ' + err.message))
        .finally(() => setImageSaving(false))
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'var(--font-title)', marginBottom: 24 }}>My Profile</h2>

      <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
        {/* Banner */}
        <label style={{ cursor: 'pointer', display: 'block' }} title={bannerSaving ? 'Saving…' : 'Click to change banner'}>
          <div style={{
            width: '100%', height: 140, background: user?.bannerUrl ? undefined : 'var(--color-sand-dark)',
            opacity: bannerSaving ? 0.6 : 1, transition: 'opacity 0.15s',
          }}>
            {user?.bannerUrl && (
              <img src={user.bannerUrl} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
          </div>
          <input type="file" accept="image/*" onChange={handleImageUpload('banner_url', setBannerSaving)} style={{ display: 'none' }} disabled={bannerSaving} />
        </label>

        <div style={{ padding: 28 }}>
          {/* Avatar + display name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: -56, marginBottom: 20 }}>
            <label style={{ cursor: 'pointer', flexShrink: 0 }} title={avatarSaving ? 'Saving…' : 'Click to change avatar'}>
              <div style={{
                width: 88, height: 88, borderRadius: '50%', overflow: 'hidden',
                background: 'var(--color-sand-dark)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: 'white',
                border: '3px solid white', opacity: avatarSaving ? 0.6 : 1, transition: 'opacity 0.15s',
              }}>
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (user?.displayName?.[0] || user?.firstName?.[0] || '?').toUpperCase()
                }
              </div>
              <input type="file" accept="image/*" onChange={handleImageUpload('avatar_url', setAvatarSaving)} style={{ display: 'none' }} disabled={avatarSaving} />
            </label>
            <div style={{ flex: 1, paddingTop: 32 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Display name</label>
              <input style={inputStyle} value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
            </div>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Bio */}
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Bio</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
            </div>

            {/* Read-only detail card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>First name</label>
                <div style={readOnlyStyle}>{user?.firstName || '—'}</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>Last name</label>
                <div style={readOnlyStyle}>{user?.lastName || '—'}</div>
              </div>
            </div>
            {user?.ename && (
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>W3DS identity (eName)</label>
                <div style={{ ...readOnlyStyle, fontFamily: 'monospace', fontSize: '0.88rem' }}>{user.ename}</div>
              </div>
            )}

            {/* Email / phone — DB-only, not synced */}
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>
                Email
                <span title="Not synced to eVault">{NOT_SYNCED_ICON}</span>
              </label>
              <input type="email" style={inputStyle} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 500 }}>
                Phone
                <span title="Not synced to eVault">{NOT_SYNCED_ICON}</span>
              </label>
              <input style={inputStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              {saveMsg && <span style={{ fontSize: '0.85rem', color: saveMsg.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>{saveMsg}</span>}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
```

Note: this drops the old `myMembership?.joinedAt` "Member since" block — it depended on `useCommunity()`, which is community-scoped context not guaranteed to be in scope wherever `MyProfile` is mounted account-wide, and wasn't part of the approved field list. If a reviewer finds this view is only ever mounted inside a `CommunityContext` provider and the "Member since" block was load-bearing, re-add it using the original code (`useCommunity` import + the same conditional block from the pre-change file) — but do not add it speculatively.

- [ ] **Step 3: Verify**

```bash
cd app && npm run build
```
Expected: build succeeds, 0 errors.

Then, with API (`cd api && npm run dev`) and frontend (`cd app && npm run dev`) dev servers running: log in via dev login, open My Profile, confirm:
- Banner area is click-to-upload; selecting an image shows it immediately after upload completes.
- Avatar circle overlaps the banner, click-to-upload works the same way.
- Display name is an editable input, saved via "Save profile".
- Bio textarea saves via "Save profile".
- First name / Last name / eName render as read-only boxes, no inputs.
- Email and Phone each show a small "not synced" icon next to the label, still editable, still saved via "Save profile".

- [ ] **Step 4: Commit**

```bash
git add app/src/views/MyProfile.jsx app/src/api/client.js
git commit -m "refactor: restructure MyProfile with banner/display-name sync, read-only names, not-synced icons"
```

---

## Self-Review Notes

- **Spec coverage:** Data model (Task 1), payload builder + tests (Task 2), `uploadFile` (Task 3), sync orchestrator (Task 4), inbound webhook + whitelist (Task 5), `updateMe`/upload endpoint/route wiring (Task 6), frontend restructure + client (Task 7) — every section of the design doc maps to a task. Out-of-scope items (website/location/language fields, outbound first/last name sync) are not present in any task.
- **Read-modify-write bug caught during planning:** the design doc's prose ("push bio/displayName/photo/banner") glossed over a corruption risk — naively reading `Person.avatar_url`/`banner_url` (resolved HTTP URLs) into the envelope on every save would clobber the correct `w3ds://file` URI. Task 4's `syncUserProfileToEvault` takes optional `avatarUrl`/`bannerUrl` overrides and otherwise preserves the envelope's own existing values, closing that gap. Flagged in Global Constraints so no implementer re-introduces it.
- **Dead code removal:** `PersonService.displayName(p)` (computed first+last name fallback) has no callers once `serializePerson` switches to the raw `display_name` column (grep-confirmed, Task 6 Step 1) — removed rather than left unused.
- **Type consistency:** `Person.display_name`/`banner_url` (Task 1) → `UserProfilePayloadInput.displayName`/`bannerUrl` (Task 2, camelCase, matches envelope convention) → `UserProfileSyncOverrides.avatarUrl`/`bannerUrl` (Task 4) → `updatePerson`'s Pick type (Task 5) → `serializePerson`'s `displayName`/`bannerUrl` (Task 6) → `user.displayName`/`user.bannerUrl` (Task 7) — names consistent at each layer's natural casing (snake_case DB column, camelCase DTO/envelope field).
- **No placeholders:** every step has complete, runnable code; no "TBD"/"add error handling"/"similar to Task N" shortcuts.
