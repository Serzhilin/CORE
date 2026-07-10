# Superadmin page: platform-wide W3DS eVault linking

## Purpose

CORE communities are created fully locally (unchanged). Linking a community to an existing W3DS eName is currently only reachable by that community's own local admins, via a card in `CommunityTab.jsx` (`resolveW3id`/`linkCommunity`, added earlier). There is no way for someone who administers the *platform* but isn't a member of a given community to browse all communities and link/unlink their eVaults. This adds that capability as a new `/superadmin` page, mirroring Onboarding's `PLATFORM_ADMIN_ENAMES` pattern.

Workgroup/WorkgroupMembership eVault sync remains out of scope and untouched.

## 1. Platform-admin identity (backend)

- New env var `PLATFORM_ADMIN_ENAMES` (comma-separated eNames), added to `.env` and `.env.example`, mirroring Onboarding exactly.
- `middleware/communityAccess.ts`: add `isPlatformAdminEname(ename: string): boolean` reading and parsing that var (trim, filter empty, same as Onboarding's implementation).
- Extend the existing `requireCommunityAdmin` middleware: pass if the caller is a platform admin (by ename) **OR** a local admin of the target community (existing `CommunityMembership.is_admin` check, unchanged). This means platform admins automatically gain access to every route already gated by `requireCommunityAdmin` (community update, member management, resolve-w3id, link-w3id, etc.) — no route duplication.
- Add a new, stricter `requirePlatformAdmin` middleware (platform-admin only, no local-admin fallback) for the global "list all communities" route, since a regular community admin should not see every community on the platform.
- `AuthController`: `getMe` and the login response (`epassportLogin`, dev-login) gain an `isPlatformAdmin: boolean` field, computed the same way as `requirePlatformAdmin`.

## 2. New/changed endpoints

- `GET /api/admin/communities` (`requireAuth`, `requirePlatformAdmin`) — new. Returns **all** communities regardless of the caller's membership, including `id`, `name`, `slug`, `community_envelope_id`, `provisioning_status`.
- `DELETE /api/communities/:id/link-w3id` (`requireAuth`, `requireCommunityAdmin`) — new. Calls a new `unlinkCommunity(id)` in `CommunityService` that clears `community_envelope_id` and resets `provisioning_status` back to local/unlinked. This is CORE-side only — no deletion or mutation on the eVault itself, no Awareness Protocol traffic.
- Existing `GET /api/communities/:id/resolve-w3id` and `POST /api/communities/:id/link-w3id` are unchanged in path/behavior; they become reachable by platform admins as a side effect of the `requireCommunityAdmin` extension in section 1.

## 3. Frontend

- `App.jsx`: add a new top-level route `/superadmin`, sibling to the existing `/deeplink-login` route — outside `CommunityProvider` and outside `Layout`'s membership gate. This matters because a platform admin may have zero community memberships and would otherwise be stuck on `OnboardingScreen` if nested under the normal `Layout` tree. Wrapped in its own `UserProvider` instance, same as the rest of the app pattern.
- New `views/SuperadminPage.jsx`:
  - `loading` (from `useUser()`) → spinner.
  - `!user` → render existing `LoginScreen` component (reuse, no new auth flow).
  - `user && !isPlatformAdmin` → "Platform admin access required." message.
  - Otherwise → fetch `adminListAllCommunities()`, render a table (name, slug, link-status badge: linked / not linked). Clicking a row expands/opens the link flow for that community.
- Extract the resolve-preview → confirm-link UI already built inline in `CommunityTab.jsx`'s W3DS card into a shared `components/W3dsLinkCard.jsx`, taking `communityId` and current link status as props, calling `resolveCommunityW3id`/`linkCommunityW3id` as before. Add an "Unlink" button/action wired to the new `unlinkCommunityW3id(id)` call, shown only when already linked. Both `CommunityTab.jsx` and `SuperadminPage.jsx` render this shared component instead of duplicating the flow.
- `api/client.js`: add `adminListAllCommunities()` (`GET /api/admin/communities`) and `unlinkCommunityW3id(id)` (`DELETE /api/communities/:id/link-w3id`).
- `context/UserContext.jsx`: thread `isPlatformAdmin` through from `getMe`/`login` payloads alongside `user`/`memberships`, so `SuperadminPage` (and anywhere else) can read it via `useUser()`.

## Out of scope

- Workgroup/WorkgroupMembership eVault sync (deliberately deferred, per standing instruction).
- Full community CRUD (create/delete) on the superadmin page — community creation/deletion stays where it already is.
- A dedicated `/superadmin`-only login page — reuses the normal wallet login flow.
- Granting/revoking platform-admin status via UI — env var only, edited directly for now.
