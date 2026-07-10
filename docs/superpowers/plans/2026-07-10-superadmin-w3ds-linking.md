# Superadmin W3DS Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a platform-wide `/superadmin` page where a designated platform admin can browse every CORE community and link/unlink it to a W3DS eName, without needing local admin membership in that community.

**Architecture:** A new `PLATFORM_ADMIN_ENAMES` env var (comma-separated eNames) drives an `isPlatformAdminEname()` helper. The existing `requireCommunityAdmin` middleware is extended to short-circuit past the membership check for platform admins, so every route already gated by it (including the existing `resolve-w3id`/`link-w3id` routes) becomes reachable platform-wide with zero route duplication. A new strict `requirePlatformAdmin` middleware (no local-admin fallback) guards a new `GET /api/admin/communities` list-all endpoint. A new `unlinkCommunity` service function and `DELETE /api/communities/:id/link-w3id` route let a linked community be reset to local-only. On the frontend, the resolve/preview/confirm-link UI already built inline in `CommunityTab.jsx` is extracted into a shared `W3dsLinkCard.jsx` (gains an Unlink button) and reused by both `CommunityTab.jsx` and the new `SuperadminPage.jsx`, reached via a new top-level `/superadmin` route that sits outside the membership-gated `Layout` tree.

**Tech Stack:** Express + TypeORM (API), React + react-router-dom (app), Jest (API unit tests, pure-function style — this codebase has no DB/HTTP integration test harness; verification of DB/HTTP-dependent code is done via `curl` against the running dev server, matching how this codebase has been verified so far).

## Global Constraints

- Workgroup/WorkgroupMembership eVault sync stays untouched — do not add any code that syncs those to eVault.
- `PLATFORM_ADMIN_ENAMES` is the only source of platform-admin identity — no DB column, no UI to grant/revoke it.
- No new login flow — `/superadmin` reuses the existing `LoginScreen` component via its own `UserProvider` instance.
- `requireCommunityAdmin`'s extension must not change behavior for non-platform-admin callers — existing local-admin-only routes keep working exactly as before.
- Follow this repo's existing spec/plan location convention: specs in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`.

---

## File Map

| File | Action |
|------|--------|
| `api/.env`, `api/.env.example` (actually root `.env`/`.env.example`, see Task 1) | **Modify** — add `PLATFORM_ADMIN_ENAMES` |
| `api/src/middleware/communityAccess.ts` | **Modify** — add `isPlatformAdminEname`, `requirePlatformAdmin`; extend `requireCommunityAdmin` |
| `api/src/middleware/__tests__/communityAccess.test.ts` | **Create** — unit test for `isPlatformAdminEname` |
| `api/src/controllers/AuthController.ts` | **Modify** — add `isPlatformAdmin` to `epassportLogin`/`devLogin`/`getMe` payloads |
| `api/src/services/CommunityService.ts` | **Modify** — add `getAllCommunities()`, `unlinkCommunity(id)` |
| `api/src/controllers/CommunityController.ts` | **Modify** — add `listAllCommunitiesHandler`, `unlinkCommunityHandler` |
| `api/src/index.ts` | **Modify** — wire `GET /api/admin/communities`, `DELETE /api/communities/:id/link-w3id` |
| `app/src/api/client.js` | **Modify** — add `adminListAllCommunities()`, `unlinkCommunityW3id(id)` |
| `app/src/components/LoginScreen.jsx` | **Modify** — pass `isPlatformAdmin` to `onSuccess` |
| `app/src/context/UserContext.jsx` | **Modify** — thread `isPlatformAdmin` through `login`/`loadSession`/`refreshMe` |
| `app/src/components/W3dsLinkCard.jsx` | **Create** — extracted shared link/unlink UI |
| `app/src/views/admin/CommunityTab.jsx` | **Modify** — use `W3dsLinkCard` instead of inline JSX/logic |
| `app/src/views/SuperadminPage.jsx` | **Create** — new platform-wide page |
| `app/src/App.jsx` | **Modify** — update `LoginScreen` `onSuccess` call, add `/superadmin` route |

---

### Task 1: Platform-admin env var + `isPlatformAdminEname` helper (with test)

**Files:**
- Modify: `/home/serzhilin/Projects/CORE/.env`
- Modify: `/home/serzhilin/Projects/CORE/.env.example`
- Modify: `/home/serzhilin/Projects/CORE/api/src/middleware/communityAccess.ts`
- Test: `/home/serzhilin/Projects/CORE/api/src/middleware/__tests__/communityAccess.test.ts`

**Interfaces:**
- Produces: `isPlatformAdminEname(ename: string | null | undefined): boolean` — exported from `communityAccess.ts`, used by Task 2 (`requireCommunityAdmin` extension, `requirePlatformAdmin`) and Task 3 (`AuthController`).

- [ ] **Step 1: Add the env var**

Append to `/home/serzhilin/Projects/CORE/.env` (after `DEVELOPER_API_KEY=`):
```
PLATFORM_ADMIN_ENAMES=
```

Append to `/home/serzhilin/Projects/CORE/.env.example` (after `DEVELOPER_API_KEY=your-w3ds-developer-api-key`):
```
PLATFORM_ADMIN_ENAMES=@your-ename-here
```

- [ ] **Step 2: Write the failing test**

Create `/home/serzhilin/Projects/CORE/api/src/middleware/__tests__/communityAccess.test.ts`:

```typescript
import { isPlatformAdminEname } from "../communityAccess";

describe("isPlatformAdminEname", () => {
    const OLD_ENV = process.env.PLATFORM_ADMIN_ENAMES;
    afterEach(() => { process.env.PLATFORM_ADMIN_ENAMES = OLD_ENV; });

    it("returns false when env var is unset", () => {
        delete process.env.PLATFORM_ADMIN_ENAMES;
        expect(isPlatformAdminEname("@alice")).toBe(false);
    });

    it("returns false when env var is empty string", () => {
        process.env.PLATFORM_ADMIN_ENAMES = "";
        expect(isPlatformAdminEname("@alice")).toBe(false);
    });

    it("matches an ename in a single-entry list", () => {
        process.env.PLATFORM_ADMIN_ENAMES = "@alice";
        expect(isPlatformAdminEname("@alice")).toBe(true);
    });

    it("matches an ename in a comma-separated list, trimming whitespace", () => {
        process.env.PLATFORM_ADMIN_ENAMES = "@alice, @bob , @carol";
        expect(isPlatformAdminEname("@bob")).toBe(true);
        expect(isPlatformAdminEname("@carol")).toBe(true);
    });

    it("returns false for an ename not in the list", () => {
        process.env.PLATFORM_ADMIN_ENAMES = "@alice,@bob";
        expect(isPlatformAdminEname("@mallory")).toBe(false);
    });

    it("returns false for null/undefined ename", () => {
        process.env.PLATFORM_ADMIN_ENAMES = "@alice";
        expect(isPlatformAdminEname(null)).toBe(false);
        expect(isPlatformAdminEname(undefined)).toBe(false);
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /home/serzhilin/Projects/CORE/api && npx jest communityAccess --no-coverage`
Expected: FAIL with `isPlatformAdminEname is not a function` (or module has no exported member).

- [ ] **Step 4: Implement `isPlatformAdminEname`**

In `/home/serzhilin/Projects/CORE/api/src/middleware/communityAccess.ts`, add near the top (after the existing imports, before `requireCommunityMember`):

```typescript
export function isPlatformAdminEname(ename: string | null | undefined): boolean {
    if (!ename) return false;
    const admins = (process.env.PLATFORM_ADMIN_ENAMES || "").split(",").map((s) => s.trim()).filter(Boolean);
    return admins.includes(ename);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/serzhilin/Projects/CORE/api && npx jest communityAccess --no-coverage`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add .env .env.example api/src/middleware/communityAccess.ts api/src/middleware/__tests__/communityAccess.test.ts
git commit -m "Add PLATFORM_ADMIN_ENAMES env var and isPlatformAdminEname helper"
```

---

### Task 2: Extend `requireCommunityAdmin`, add `requirePlatformAdmin`

**Files:**
- Modify: `/home/serzhilin/Projects/CORE/api/src/middleware/communityAccess.ts`

**Interfaces:**
- Consumes: `isPlatformAdminEname` from Task 1.
- Produces: `requirePlatformAdmin(req, res, next)` — new Express middleware, used by Task 5 (`GET /api/admin/communities` route). `requireCommunityAdmin` behavior change — used by Task 4/6 (`unlinkCommunity` route) and already-wired routes (no call-site changes needed).

**Current file content (for context — do not skip re-reading it before editing):**
```typescript
import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";

declare global {
    namespace Express {
        interface Request {
            membership?: CommunityMembership;
        }
    }
}

export async function requireCommunityMember(req: Request, res: Response, next: NextFunction) {
    const communityId = req.params.cid || req.params.id;
    if (!req.user || !communityId) { res.status(403).json({ error: "Forbidden" }); return; }
    try {
        const m = await AppDataSource.getRepository(CommunityMembership)
            .findOne({ where: { person_id: req.user.userId, community_id: communityId } });
        if (!m) { res.status(403).json({ error: "Not a member of this community" }); return; }
        req.membership = m;
        next();
    } catch (err) {
        next(err);
    }
}

export async function requireCommunityAdmin(req: Request, res: Response, next: NextFunction) {
    await requireCommunityMember(req, res, async () => {
        if (!req.membership?.is_admin) { res.status(403).json({ error: "Admin access required" }); return; }
        next();
    });
}
```

**Why a plain OR on `is_admin` isn't enough:** `requireCommunityAdmin` currently delegates straight to `requireCommunityMember`, which 403s with "Not a member of this community" if no `CommunityMembership` row exists at all for that community — a platform admin with zero membership in the target community never even reaches the `is_admin` check. The fix must short-circuit *before* the membership lookup, not just override its result.

- [ ] **Step 1: Rewrite `requireCommunityAdmin`**

Replace the `requireCommunityAdmin` function in `/home/serzhilin/Projects/CORE/api/src/middleware/communityAccess.ts` with:

```typescript
export async function requireCommunityAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
    if (isPlatformAdminEname(req.user.ename)) { next(); return; }
    await requireCommunityMember(req, res, async () => {
        if (!req.membership?.is_admin) { res.status(403).json({ error: "Admin access required" }); return; }
        next();
    });
}

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!isPlatformAdminEname(req.user.ename)) { res.status(403).json({ error: "Platform admin access required" }); return; }
    next();
}
```

Note: none of the existing handlers behind `requireCommunityAdmin` (`updateCommunityHandler`, `resolveW3idHandler`, `linkCommunityHandler`, member/workgroup/availability-type handlers) read `req.membership` — they only use `req.user!.userId` and `req.params.id`/`req.params.cid`. Confirmed by grep — `req.membership` has zero call sites outside `communityAccess.ts` itself. So leaving `req.membership` undefined on the platform-admin short-circuit path is safe.

- [ ] **Step 2: Typecheck**

Run: `cd /home/serzhilin/Projects/CORE/api && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Re-run existing tests to confirm no regression**

Run: `cd /home/serzhilin/Projects/CORE/api && npx jest --no-coverage`
Expected: all suites PASS (existing `AvailabilityService.test.ts` plus Task 1's `communityAccess.test.ts`).

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add api/src/middleware/communityAccess.ts
git commit -m "Let platform admins bypass local community-admin checks"
```

---

### Task 3: `isPlatformAdmin` on auth payloads

**Files:**
- Modify: `/home/serzhilin/Projects/CORE/api/src/controllers/AuthController.ts`

**Interfaces:**
- Consumes: `isPlatformAdminEname` from Task 1 (`../middleware/communityAccess`).
- Produces: `epassportLogin`/`devLogin` JSON responses gain top-level `isPlatformAdmin: boolean`; `getMe` response gains top-level `isPlatformAdmin: boolean`. Consumed by Task 6 (`LoginScreen.jsx`, `UserContext.jsx`).

- [ ] **Step 1: Import the helper**

In `/home/serzhilin/Projects/CORE/api/src/controllers/AuthController.ts`, add to the imports:

```typescript
import { isPlatformAdminEname } from "../middleware/communityAccess";
```

- [ ] **Step 2: Add `isPlatformAdmin` to `epassportLogin`'s response**

Find this block near the end of `epassportLogin`:

```typescript
    const token = signToken({ userId: person.id, ename: person.ename! });
    const returnTo = sessionReturnTo.get(session) ?? "/";
    sessionReturnTo.delete(session);
    const memberships = await getMembershipsForPerson(person.id);
    const payload = { token, user: serializePerson(person), memberships, returnTo };
```

Replace with:

```typescript
    const token = signToken({ userId: person.id, ename: person.ename! });
    const returnTo = sessionReturnTo.get(session) ?? "/";
    sessionReturnTo.delete(session);
    const memberships = await getMembershipsForPerson(person.id);
    const isPlatformAdmin = isPlatformAdminEname(person.ename);
    const payload = { token, user: serializePerson(person), memberships, returnTo, isPlatformAdmin };
```

- [ ] **Step 3: Add `isPlatformAdmin` to `devLogin`'s response**

Find:

```typescript
    const token = signToken({ userId: person.id, ename: person.ename! });
    const memberships = await getMembershipsForPerson(person.id);
    res.json({ token, user: serializePerson(person), memberships });
}

export async function getMe(req: Request, res: Response) {
```

Replace with:

```typescript
    const token = signToken({ userId: person.id, ename: person.ename! });
    const memberships = await getMembershipsForPerson(person.id);
    res.json({ token, user: serializePerson(person), memberships, isPlatformAdmin: isPlatformAdminEname(person.ename) });
}

export async function getMe(req: Request, res: Response) {
```

- [ ] **Step 4: Add `isPlatformAdmin` to `getMe`'s response**

Find the end of `getMe`:

```typescript
    res.json({
        person: serializePerson(person),
        memberships: memberships.map((m) => ({
            communityId: m.community_id,
            isAdmin: m.is_admin,
            isAspirant: m.is_aspirant,
            community: communities.find((c) => c.id === m.community_id),
        })),
    });
}
```

Replace with:

```typescript
    res.json({
        person: serializePerson(person),
        memberships: memberships.map((m) => ({
            communityId: m.community_id,
            isAdmin: m.is_admin,
            isAspirant: m.is_aspirant,
            community: communities.find((c) => c.id === m.community_id),
        })),
        isPlatformAdmin: isPlatformAdminEname(person.ename),
    });
}
```

- [ ] **Step 5: Typecheck**

Run: `cd /home/serzhilin/Projects/CORE/api && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 6: Manual verification against running dev server**

Ensure the dev stack is running (`npm run dev` from repo root, or confirm it's already up), then:

Run: `curl -s -X POST http://localhost:3004/api/auth/dev-login -H "Content-Type: application/json" -d '{"ename":"@dev-user"}' | python3 -m json.tool`
Expected: JSON response includes `"isPlatformAdmin": false` (since `@dev-user` isn't in `PLATFORM_ADMIN_ENAMES`, which is empty).

Then temporarily test the true path: `PLATFORM_ADMIN_ENAMES=@dev-user npx ts-node -e "console.log(require('./src/middleware/communityAccess').isPlatformAdminEname('@dev-user'))"` from `api/` — expect `true` printed. (This avoids needing to restart the dev server with a changed `.env` just to check the boolean flips.)

- [ ] **Step 7: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add api/src/controllers/AuthController.ts
git commit -m "Include isPlatformAdmin flag in auth responses"
```

---

### Task 4: `unlinkCommunity` service + `getAllCommunities`

**Files:**
- Modify: `/home/serzhilin/Projects/CORE/api/src/services/CommunityService.ts`

**Interfaces:**
- Consumes: `communityRepo()` (existing local helper in this file).
- Produces: `getAllCommunities(): Promise<Community[]>`, `unlinkCommunity(id: string): Promise<Community>` — both used by Task 5 (`CommunityController.ts`).

**Why unlink must clear `ename`/`evault_uri`, not just `community_envelope_id`/`provisioning_status`:** `linkCommunity` guards against double-linking an eName with `communityRepo().findOne({ where: { ename: resolution.w3id } })` — if unlink left the old `ename` in place on a now-"unlinked" community, a *different* community later trying to link that same eName would be incorrectly blocked with `w3id_already_linked`, even though no community is actively using it anymore. Clearing `ename`/`evault_uri` alongside the other two fields avoids that stale-conflict bug.

- [ ] **Step 1: Add `getAllCommunities` and `unlinkCommunity`**

In `/home/serzhilin/Projects/CORE/api/src/services/CommunityService.ts`, add after the existing `getMyCommunities` function:

```typescript
export async function getAllCommunities(): Promise<Community[]> {
    return communityRepo().find({ order: { name: "ASC" } });
}
```

Add after the existing `linkCommunity` function (before `addParticipantToEnvelope`):

```typescript
/** Resets a linked community back to local-only. CORE-side only — does not touch the eVault. */
export async function unlinkCommunity(communityId: string): Promise<Community> {
    const community = await communityRepo().findOneOrFail({ where: { id: communityId } });
    community.ename = null;
    community.evault_uri = null;
    community.community_envelope_id = null;
    community.provisioning_status = "unlinked";
    return communityRepo().save(community);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /home/serzhilin/Projects/CORE/api && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add api/src/services/CommunityService.ts
git commit -m "Add getAllCommunities and unlinkCommunity to CommunityService"
```

---

### Task 5: Controller handlers + route wiring

**Files:**
- Modify: `/home/serzhilin/Projects/CORE/api/src/controllers/CommunityController.ts`
- Modify: `/home/serzhilin/Projects/CORE/api/src/index.ts`

**Interfaces:**
- Consumes: `getAllCommunities`, `unlinkCommunity` from Task 4 (`../services/CommunityService`); `requirePlatformAdmin`, extended `requireCommunityAdmin` from Task 2 (`../middleware/communityAccess`).
- Produces: `GET /api/admin/communities`, `DELETE /api/communities/:id/link-w3id` — new HTTP endpoints, used by Task 6 (`client.js`).

- [ ] **Step 1: Add handlers to `CommunityController.ts`**

In `/home/serzhilin/Projects/CORE/api/src/controllers/CommunityController.ts`, update the import line:

```typescript
import { createCommunity, getMyCommunities, getAllCommunities, getCommunityFull, updateCommunity, getCommunityGraph, resolveW3id, linkCommunity, unlinkCommunity } from "../services/CommunityService";
```

Add these two handlers at the end of the file:

```typescript
export async function listAllCommunitiesHandler(req: Request, res: Response) {
    const communities = await getAllCommunities();
    res.json(communities);
}

export async function unlinkCommunityHandler(req: Request, res: Response) {
    try {
        const community = await unlinkCommunity(req.params.id);
        res.json(community);
    } catch (err: any) {
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Community not found" }); return; }
        throw err;
    }
}
```

- [ ] **Step 2: Wire routes in `index.ts`**

Update the `CommunityController` import in `/home/serzhilin/Projects/CORE/api/src/index.ts`:

```typescript
import { listCommunities, createCommunityHandler, getCommunityHandler, updateCommunityHandler, getCommunityGraphHandler, resolveW3idHandler, linkCommunityHandler, listAllCommunitiesHandler, unlinkCommunityHandler } from "./controllers/CommunityController";
```

Update the import from `./middleware/communityAccess`:

```typescript
import { requireCommunityMember, requireCommunityAdmin, requirePlatformAdmin } from "./middleware/communityAccess";
```

Add these two routes directly after the existing `app.post("/api/communities/:id/link-w3id", ...)` line:

```typescript
app.delete("/api/communities/:id/link-w3id", requireAuth, requireCommunityAdmin, unlinkCommunityHandler);
app.get("/api/admin/communities", requireAuth, requirePlatformAdmin, listAllCommunitiesHandler);
```

- [ ] **Step 3: Typecheck**

Run: `cd /home/serzhilin/Projects/CORE/api && npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 4: Manual verification against running dev server**

With the dev server running and a valid dev-login token in hand (`TOKEN=$(curl -s -X POST http://localhost:3004/api/auth/dev-login -H "Content-Type: application/json" -d '{"ename":"@dev-user"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")`):

Run: `curl -s http://localhost:3004/api/admin/communities -H "Authorization: Bearer $TOKEN"`
Expected: `{"error":"Platform admin access required"}` with 403 (since `@dev-user` is not a platform admin) — confirms `requirePlatformAdmin` rejects non-admins correctly.

- [ ] **Step 5: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add api/src/controllers/CommunityController.ts api/src/index.ts
git commit -m "Add list-all-communities and unlink-w3id endpoints"
```

---

### Task 6: Frontend plumbing — client, LoginScreen, UserContext

**Files:**
- Modify: `/home/serzhilin/Projects/CORE/app/src/api/client.js`
- Modify: `/home/serzhilin/Projects/CORE/app/src/components/LoginScreen.jsx`
- Modify: `/home/serzhilin/Projects/CORE/app/src/context/UserContext.jsx`
- Modify: `/home/serzhilin/Projects/CORE/app/src/App.jsx`

**Interfaces:**
- Consumes: `GET /api/admin/communities`, `DELETE /api/communities/:id/link-w3id` from Task 5.
- Produces: `adminListAllCommunities(): Promise<Community[]>`, `unlinkCommunityW3id(id: string): Promise<Community>` (from `client.js`); `useUser()` now also exposes `isPlatformAdmin: boolean` — used by Task 8 (`SuperadminPage.jsx`) and Task 7 (`CommunityTab.jsx` doesn't need it, but `W3dsLinkCard.jsx` doesn't either — this field is consumed only by `SuperadminPage.jsx`).

- [ ] **Step 1: Add API wrappers to `client.js`**

In `/home/serzhilin/Projects/CORE/app/src/api/client.js`, add after the existing `linkCommunityW3id` line:

```javascript
export const unlinkCommunityW3id = (id) => req('DELETE', `/communities/${id}/link-w3id`)
export const adminListAllCommunities = () => req('GET', '/admin/communities')
```

- [ ] **Step 2: Thread `isPlatformAdmin` through `LoginScreen.jsx`**

In `/home/serzhilin/Projects/CORE/app/src/components/LoginScreen.jsx`, find:

```javascript
    function finish(token, user, memberships) {
      if (done) return
      done = true
      if (unsub) unsub()
      onSuccess(token, user, memberships)
    }
```

Replace with:

```javascript
    function finish(token, user, memberships, isPlatformAdmin) {
      if (done) return
      done = true
      if (unsub) unsub()
      onSuccess(token, user, memberships, isPlatformAdmin)
    }
```

Find:

```javascript
          unsub = subscribeToAuthSession(sessionId, ({ token, user, memberships }) =>
            finish(token, user, memberships)
          )
```

Replace with:

```javascript
          unsub = subscribeToAuthSession(sessionId, ({ token, user, memberships, isPlatformAdmin }) =>
            finish(token, user, memberships, isPlatformAdmin)
          )
```

- [ ] **Step 3: Thread `isPlatformAdmin` through `UserContext.jsx`**

In `/home/serzhilin/Projects/CORE/app/src/context/UserContext.jsx`, replace the whole file with:

```jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getMe } from '../api/client'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)           // full person object from /api/me
  const [memberships, setMemberships] = useState([]) // [{communityId, isAdmin, isAspirant, community}]
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem('core_token')
    if (!token) { setLoading(false); return }
    try {
      const { person, memberships: m, isPlatformAdmin: ipa } = await getMe()
      setUser(person)
      setMemberships(m)
      setIsPlatformAdmin(!!ipa)
    } catch {
      localStorage.removeItem('core_token')
      setUser(null)
      setMemberships([])
      setIsPlatformAdmin(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSession() }, [loadSession])

  const login = useCallback((token, person, memberships, isPlatformAdmin) => {
    localStorage.setItem('core_token', token)
    setUser(person)
    setMemberships(memberships || [])
    setIsPlatformAdmin(!!isPlatformAdmin)
    setLoading(false)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('core_token')
    localStorage.removeItem('core_community_id')
    setUser(null)
    setMemberships([])
    setIsPlatformAdmin(false)
  }, [])

  const refreshMe = useCallback(async () => {
    try {
      const { person, memberships: m, isPlatformAdmin: ipa } = await getMe()
      setUser(person)
      setMemberships(m)
      setIsPlatformAdmin(!!ipa)
    } catch {}
  }, [])

  return (
    <UserContext.Provider value={{ user, memberships, isPlatformAdmin, loading, login, logout, refreshMe }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
```

- [ ] **Step 4: Update the `LoginScreen` call site in `App.jsx`**

In `/home/serzhilin/Projects/CORE/app/src/App.jsx`, find:

```jsx
    return <LoginScreen onSuccess={(token, person, memberships) => login(token, person, memberships)} />
```

Replace with:

```jsx
    return <LoginScreen onSuccess={(token, person, memberships, isPlatformAdmin) => login(token, person, memberships, isPlatformAdmin)} />
```

- [ ] **Step 5: Typecheck / build**

Run: `cd /home/serzhilin/Projects/CORE/app && npx vite build`
Expected: build succeeds, no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/api/client.js app/src/components/LoginScreen.jsx app/src/context/UserContext.jsx app/src/App.jsx
git commit -m "Thread isPlatformAdmin through login flow and add w3id client wrappers"
```

---

### Task 7: Extract `W3dsLinkCard.jsx`, wire into `CommunityTab.jsx` with unlink

**Files:**
- Create: `/home/serzhilin/Projects/CORE/app/src/components/W3dsLinkCard.jsx`
- Modify: `/home/serzhilin/Projects/CORE/app/src/views/admin/CommunityTab.jsx`

**Interfaces:**
- Consumes: `resolveCommunityW3id`, `linkCommunityW3id`, `unlinkCommunityW3id` from `../api/client` (last one added in Task 6).
- Produces: `W3dsLinkCard({ communityId, community, onChange })` — a default-exported React component. `community` must have `{ provisioning_status, ename, evault_uri }`. `onChange` is called (no args) after a successful link or unlink, so the parent can refetch. Used by Task 8 (`SuperadminPage.jsx`).

- [ ] **Step 1: Create `W3dsLinkCard.jsx`**

This is the existing W3DS card block from `CommunityTab.jsx` (currently lines 29-33 for state, 72-101 for handlers, 191-239 for markup), extracted as a standalone component with an added Unlink action:

```jsx
import { useState } from 'react'
import { resolveCommunityW3id, linkCommunityW3id, unlinkCommunityW3id } from '../api/client'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--color-sand-dark)', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box',
}

export default function W3dsLinkCard({ communityId, community, onChange }) {
  const [w3idInput, setW3idInput] = useState('')
  const [w3idPreview, setW3idPreview] = useState(null)
  const [w3idResolving, setW3idResolving] = useState(false)
  const [w3idLinking, setW3idLinking] = useState(false)
  const [w3idUnlinking, setW3idUnlinking] = useState(false)
  const [w3idError, setW3idError] = useState(null)

  async function handleResolveW3id() {
    if (!w3idInput.trim()) return
    setW3idResolving(true)
    setW3idError(null)
    setW3idPreview(null)
    try {
      const resolution = await resolveCommunityW3id(communityId, w3idInput.trim())
      setW3idPreview(resolution)
    } catch (err) {
      setW3idError(err.message)
    } finally {
      setW3idResolving(false)
    }
  }

  async function handleLinkW3id() {
    if (!w3idInput.trim()) return
    setW3idLinking(true)
    setW3idError(null)
    try {
      await linkCommunityW3id(communityId, w3idInput.trim())
      setW3idPreview(null)
      setW3idInput('')
      onChange?.()
    } catch (err) {
      setW3idError(err.message)
    } finally {
      setW3idLinking(false)
    }
  }

  async function handleUnlink() {
    if (!confirm(`Unlink this community from ${community.ename}? CORE will stop syncing to that eVault.`)) return
    setW3idUnlinking(true)
    setW3idError(null)
    try {
      await unlinkCommunityW3id(communityId)
      onChange?.()
    } catch (err) {
      setW3idError(err.message)
    } finally {
      setW3idUnlinking(false)
    }
  }

  return (
    <div className="card" style={{ padding: 28 }}>
      <h3 style={{ margin: '0 0 20px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
        W3DS identity
      </h3>

      {community?.provisioning_status === 'linked' ? (
        <div style={{ fontSize: '0.9rem' }}>
          <div>Linked to <strong>{community.ename}</strong></div>
          <div style={{ color: 'var(--color-charcoal-light)', fontSize: '0.82rem', marginTop: 4 }}>{community.evault_uri}</div>
          {w3idError && <div style={{ fontSize: '0.8rem', color: 'var(--color-red)', marginTop: 8 }}>{w3idError}</div>}
          <button type="button" className="btn-secondary" style={{ marginTop: 12, color: 'var(--color-red)' }} onClick={handleUnlink} disabled={w3idUnlinking}>
            {w3idUnlinking ? 'Unlinking…' : 'Unlink'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-charcoal-light)' }}>
            This community is local-only. Link it to an existing W3DS eName you own or administer
            to sync its identity and membership to your eVault.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="@ename or w3id"
              value={w3idInput}
              onChange={(e) => { setW3idInput(e.target.value); setW3idPreview(null) }}
            />
            <button type="button" className="btn-secondary" onClick={handleResolveW3id} disabled={w3idResolving || !w3idInput.trim()}>
              {w3idResolving ? 'Resolving…' : 'Preview'}
            </button>
          </div>

          {w3idError && <div style={{ fontSize: '0.8rem', color: 'var(--color-red)' }}>{w3idError}</div>}

          {w3idPreview && (
            <div style={{ border: '1px solid var(--color-sand)', borderRadius: 8, padding: 14, fontSize: '0.85rem' }}>
              {w3idPreview.envelope ? (
                <>
                  <div><strong>{w3idPreview.envelope.name || w3idPreview.w3id}</strong></div>
                  {w3idPreview.envelope.description && <div style={{ marginTop: 4 }}>{w3idPreview.envelope.description}</div>}
                </>
              ) : (
                <div>No existing group identity found — a new one will be created with you as owner.</div>
              )}
              <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={handleLinkW3id} disabled={w3idLinking}>
                {w3idLinking ? 'Linking…' : `Confirm link to ${w3idPreview.w3id}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `CommunityTab.jsx` to use it**

In `/home/serzhilin/Projects/CORE/app/src/views/admin/CommunityTab.jsx`:

Replace the import line:

```jsx
import { updateCommunity, updateMember, resolveCommunityW3id, linkCommunityW3id } from '../../api/client'
```

with:

```jsx
import { updateCommunity, updateMember } from '../../api/client'
import W3dsLinkCard from '../../components/W3dsLinkCard'
```

Remove these state declarations (no longer needed — now live inside `W3dsLinkCard`):

```jsx
  const [w3idInput, setW3idInput] = useState('')
  const [w3idPreview, setW3idPreview] = useState(null)
  const [w3idResolving, setW3idResolving] = useState(false)
  const [w3idLinking, setW3idLinking] = useState(false)
  const [w3idError, setW3idError] = useState(null)
```

Remove these two handlers (no longer needed):

```jsx
  async function handleResolveW3id() {
    if (!w3idInput.trim()) return
    setW3idResolving(true)
    setW3idError(null)
    setW3idPreview(null)
    try {
      const resolution = await resolveCommunityW3id(communityId, w3idInput.trim())
      setW3idPreview(resolution)
    } catch (err) {
      setW3idError(err.message)
    } finally {
      setW3idResolving(false)
    }
  }

  async function handleLinkW3id() {
    if (!w3idInput.trim()) return
    setW3idLinking(true)
    setW3idError(null)
    try {
      await linkCommunityW3id(communityId, w3idInput.trim())
      await refresh()
      setW3idPreview(null)
      setW3idInput('')
    } catch (err) {
      setW3idError(err.message)
    } finally {
      setW3idLinking(false)
    }
  }
```

Replace the entire "W3DS link" block:

```jsx
      {/* W3DS link */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-charcoal-light)' }}>
          W3DS identity
        </h3>

        {community?.provisioning_status === 'linked' ? (
          <div style={{ fontSize: '0.9rem' }}>
            <div>Linked to <strong>{community.ename}</strong></div>
            <div style={{ color: 'var(--color-charcoal-light)', fontSize: '0.82rem', marginTop: 4 }}>{community.evault_uri}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-charcoal-light)' }}>
              This community is local-only. Link it to an existing W3DS eName you own or administer
              to sync its identity and membership to your eVault.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="@ename or w3id"
                value={w3idInput}
                onChange={(e) => { setW3idInput(e.target.value); setW3idPreview(null) }}
              />
              <button type="button" className="btn-secondary" onClick={handleResolveW3id} disabled={w3idResolving || !w3idInput.trim()}>
                {w3idResolving ? 'Resolving…' : 'Preview'}
              </button>
            </div>

            {w3idError && <div style={{ fontSize: '0.8rem', color: 'var(--color-red)' }}>{w3idError}</div>}

            {w3idPreview && (
              <div style={{ border: '1px solid var(--color-sand)', borderRadius: 8, padding: 14, fontSize: '0.85rem' }}>
                {w3idPreview.envelope ? (
                  <>
                    <div><strong>{w3idPreview.envelope.name || w3idPreview.w3id}</strong></div>
                    {w3idPreview.envelope.description && <div style={{ marginTop: 4 }}>{w3idPreview.envelope.description}</div>}
                  </>
                ) : (
                  <div>No existing group identity found — a new one will be created with you as owner.</div>
                )}
                <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={handleLinkW3id} disabled={w3idLinking}>
                  {w3idLinking ? 'Linking…' : `Confirm link to ${w3idPreview.w3id}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
```

with:

```jsx
      <div style={{ marginBottom: 24 }}>
        <W3dsLinkCard communityId={communityId} community={community} onChange={refresh} />
      </div>
```

- [ ] **Step 3: Build**

Run: `cd /home/serzhilin/Projects/CORE/app && npx vite build`
Expected: build succeeds, no errors, `AdminPanel` chunk includes the new `W3dsLinkCard` module.

- [ ] **Step 4: Manual smoke test in browser**

With `npm run dev` running at the repo root, open the app, log in as a local community admin, go to that community's admin panel → Community tab, and confirm the "W3DS identity" card renders exactly as before (same preview/link flow). This is a visual-only regression check — the extraction shouldn't change any behavior for the existing per-community flow.

- [ ] **Step 5: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/components/W3dsLinkCard.jsx app/src/views/admin/CommunityTab.jsx
git commit -m "Extract W3dsLinkCard from CommunityTab and add unlink action"
```

---

### Task 8: `SuperadminPage.jsx` + `/superadmin` route

**Files:**
- Create: `/home/serzhilin/Projects/CORE/app/src/views/SuperadminPage.jsx`
- Modify: `/home/serzhilin/Projects/CORE/app/src/App.jsx`

**Interfaces:**
- Consumes: `adminListAllCommunities` from `../api/client` (Task 6); `useUser()` → `{ user, isPlatformAdmin, loading, login }` (Task 6); `LoginScreen` (`../components/LoginScreen`); `W3dsLinkCard` (`../components/W3dsLinkCard`, Task 7).

- [ ] **Step 1: Create `SuperadminPage.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useUser } from '../context/UserContext'
import LoginScreen from '../components/LoginScreen'
import W3dsLinkCard from '../components/W3dsLinkCard'
import { adminListAllCommunities } from '../api/client'

export default function SuperadminPage() {
  const { user, isPlatformAdmin, loading, login } = useUser()
  const [communities, setCommunities] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [listError, setListError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const list = await adminListAllCommunities()
      setCommunities(list)
    } catch (err) {
      setListError(err.message)
    }
  }, [])

  useEffect(() => {
    if (user && isPlatformAdmin) refresh()
  }, [user, isPlatformAdmin, refresh])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: 'var(--color-charcoal-light)' }}>
        Loading…
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onSuccess={(token, person, memberships, ipa) => login(token, person, memberships, ipa)} />
  }

  if (!isPlatformAdmin) {
    return (
      <div style={{ padding: 32, fontFamily: 'Inter, sans-serif', color: 'var(--color-red)' }}>
        Platform admin access required.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 32, fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontFamily: 'var(--font-title)', margin: '0 0 24px' }}>Superadmin — Communities</h1>

      {listError && <div style={{ color: 'var(--color-red)', marginBottom: 16 }}>{listError}</div>}

      {communities.map((c) => (
        <div key={c.id} className="card" style={{ padding: '14px 18px', marginBottom: 10 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-charcoal-light)' }}>/{c.slug}</div>
            </div>
            <span style={{
              fontSize: '0.78rem', padding: '3px 10px', borderRadius: 999,
              background: c.provisioning_status === 'linked' ? 'var(--color-green, #dcfce7)' : 'var(--color-sand)',
              color: c.provisioning_status === 'linked' ? '#166534' : 'var(--color-charcoal-light)',
            }}>
              {c.provisioning_status === 'linked' ? `linked · ${c.ename}` : 'local only'}
            </span>
          </div>

          {expandedId === c.id && (
            <div style={{ marginTop: 16 }}>
              <W3dsLinkCard communityId={c.id} community={c} onChange={refresh} />
            </div>
          )}
        </div>
      ))}

      {communities.length === 0 && !listError && (
        <p style={{ color: 'var(--color-charcoal-light)' }}>No communities yet.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the `/superadmin` route**

In `/home/serzhilin/Projects/CORE/app/src/App.jsx`, add the lazy import alongside the existing ones:

```jsx
const SuperadminPage = lazy(() => import('./views/SuperadminPage'))
```

Find:

```jsx
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/deeplink-login" element={<DeeplinkLogin />} />
        <Route path="*" element={
          <UserProvider>
            <CommunityProvider>
              <Layout />
            </CommunityProvider>
          </UserProvider>
        } />
      </Routes>
    </BrowserRouter>
  )
}
```

Replace with:

```jsx
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/deeplink-login" element={<DeeplinkLogin />} />
        <Route path="/superadmin" element={
          <UserProvider>
            <Suspense fallback={<div style={{ padding: 32, color: 'var(--color-charcoal-light)' }}>Loading…</div>}>
              <SuperadminPage />
            </Suspense>
          </UserProvider>
        } />
        <Route path="*" element={
          <UserProvider>
            <CommunityProvider>
              <Layout />
            </CommunityProvider>
          </UserProvider>
        } />
      </Routes>
    </BrowserRouter>
  )
}
```

This places `/superadmin` as a sibling of the main `*` route — outside `CommunityProvider` and outside `Layout`'s membership gate, so a platform admin with zero community memberships isn't redirected to `OnboardingScreen`.

- [ ] **Step 3: Build**

Run: `cd /home/serzhilin/Projects/CORE/app && npx vite build`
Expected: build succeeds, `SuperadminPage` appears as its own lazy chunk.

- [ ] **Step 4: Manual end-to-end verification**

1. Stop the API process, add your own ename to `PLATFORM_ADMIN_ENAMES` in `/home/serzhilin/Projects/CORE/.env` (e.g. `PLATFORM_ADMIN_ENAMES=@your-actual-ename`), restart it (`touch api/src/index.ts` if using nodemon, or restart the `npm run dev` process).
2. Open `http://localhost:5175/superadmin` in a browser.
3. Log in via the QR/wallet flow as usual.
4. Expected: the page shows "Superadmin — Communities" with a list of every community in the DB (not just ones you're a member of), each with a "local only" or "linked · @ename" badge.
5. Click a community row, confirm the `W3dsLinkCard` expands and the resolve/link (or unlink, if already linked) flow works exactly as it does from the per-community `CommunityTab`.
6. Log in as a non-platform-admin dev user and confirm `/superadmin` shows "Platform admin access required."

- [ ] **Step 5: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/views/SuperadminPage.jsx app/src/App.jsx
git commit -m "Add platform-wide /superadmin page for W3DS community linking"
```

---

## Self-Review Notes

- **Spec coverage:** Section 1 (platform-admin identity) → Tasks 1-3. Section 2 (new endpoints) → Tasks 4-5. Section 3 (frontend) → Tasks 6-8. All three spec sections have corresponding tasks.
- **Type consistency:** `isPlatformAdminEname` (Task 1) is the single name used everywhere it's referenced (Task 2, Task 3) — no aliasing. `W3dsLinkCard` props (`communityId`, `community`, `onChange`) are consistent between its definition (Task 7) and both call sites (Task 7's `CommunityTab.jsx`, Task 8's `SuperadminPage.jsx`). `login(token, person, memberships, isPlatformAdmin)` signature is consistent across `UserContext.jsx` (Task 6), `App.jsx`'s call site (Task 6), and `SuperadminPage.jsx`'s call site (Task 8).
- **No placeholders:** every step has complete, runnable code or an exact command with expected output.
