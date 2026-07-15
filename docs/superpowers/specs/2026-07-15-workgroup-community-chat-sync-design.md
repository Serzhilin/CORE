# Workgroup & Community Chat Sync — Design

**Goal:** wire up the `Chat` ontology (schemaId `550e8400-e29b-41d4-a716-446655440003`, already mapped as `ONTOLOGIES.Community`) so every linked community has a chat containing exactly its current membership, every workgroup has its own chat, and CORE keeps both in sync one-directionally (CORE → chat), without clobbering data other platforms write into the same envelopes.

**Context:** CORE currently only *reads* the community's Chat/Group envelope (`CommunityService.resolveW3id`/`resolveEnameForNewCommunity`, both via `findEnvelopesByOntology`), and never persists the discovered envelope id. Live verification against De Woonwolk's production eVault confirmed this envelope is **not orphaned** — it already holds a real `charter`, `owner`, `admins`, `signatureIds`, and 32 `participantIds`/`members` that match Postgres 1:1, almost certainly maintained by ALVer's charter feature. Workgroups have no chat at all today — `ONTOLOGIES.Community`/Chat is only ever used for the community-level envelope.

Two hard constraints from the platform, verified by reading `evault-client.ts`:
- `updateMetaEnvelope` replaces the full payload — there is no partial-field update.
- The formal Chat JSON Schema declares only 8 fields with `additionalProperties: false`, but the eVault backend does not enforce this at write time — the whole W3DS ecosystem (blabsy, group-charter-manager, egroups, etc.) already writes extra fields (`owner`, `admins`, `charter`, `description`, `avatar`, `signatureIds`) onto this same schemaId. Treat the schema as descriptive, not a runtime validator.

## Principle: two different ownership models

- **Community chat** — CORE does **not** own this envelope; other platforms (ALVer) write to it too. Every write is fetch-current → merge-in-owned-fields → write-back-full-payload. CORE owns `name`, `description`, `avatar`, `participantIds`, `members`, `updatedAt`. CORE must never touch `type`, `charter`, `owner`, `admins`, `signatureIds`, `createdAt`, `lastMessageId`, `isArchived`, `ename` — always carry these through unmodified from the fetched payload.
- **Workgroup chats** — CORE creates and fully owns these envelopes, but membership is deliberately **not** rebuilt wholesale from CORE's roster on every write. Per the user's stated philosophy ("free and transparent organization"), people may join/leave a workgroup chat directly in another app; CORE only ever adds or removes the specific person it's acting on, never diffs-and-overwrites the full participant list. The sync is strictly one-directional CORE → chat: CORE never reads a workgroup chat's `participantIds` back and never lets a chat-side join/leave change actual `workgroup_memberships` rows in Postgres. There is no code path that reads a workgroup chat envelope for this purpose — the absence of such a path is the enforcement.

## Data model changes

`api/src/database/entities/Community.ts`:
```ts
@Column({ type: "text", nullable: true })
chat_envelope_id: string | null;
```

`api/src/database/entities/Workgroup.ts`:
```ts
@Column({ type: "text", nullable: true })
chat_envelope_id: string | null;
```

Both nullable — `null` means no chat linked/created yet (unlinked community, or pre-backfill workgroup). Dev picks these up automatically via `synchronize:true`. Prod has no migration framework (pre-existing gap); ships as hand-written SQL:

```sql
-- docs/superpowers/migrations/2026-07-15-chat-envelope-columns.sql
ALTER TABLE communities ADD COLUMN chat_envelope_id text;
ALTER TABLE workgroups ADD COLUMN chat_envelope_id text;
```

Payload additions (both one-directional, CORE-writes-only, never read back):
- `organizationPayload.ts` (`buildOrganizationPayload`): add `chatId` sourced from `community.chat_envelope_id`.
- `workgroupPayload.ts` (`buildWorkgroupPayload`): add `chatId` sourced from `workgroup.chat_envelope_id`.

## New module: `ChatService.ts`

Lives at `api/src/services/ChatService.ts`, follows the existing `WorkgroupService.ts`/`OrganizationService.ts` shape (private eVault-facing helpers, exported functions called from other services).

**Community chat:**
- `captureExistingCommunityChatId(communityId)` — used once at link time; reads the envelope already discovered by `resolveW3id`, persists its id to `communities.chat_envelope_id`. No eVault write.
- `syncCommunityChatToEvault(communityId)` — fetch envelope by `chat_envelope_id` (no-op + `logger.warn` if null), merge in `name`/`description`/`avatar`/`participantIds`/`members`/`updatedAt` from current Community + membership state, `updateMetaEnvelope`. Preserves every other field untouched.
- `addPersonToCommunityChat(communityId, personId)` / `removePersonFromCommunityChat(communityId, personId)` — fetch envelope, splice one id in/out of `participantIds`/`members`, write back. Used instead of a full rebuild for single-member add/remove (avoids clobbering a concurrent charter edit any more than necessary).
- `cascadeCommunityRenameToWorkgroupChats(communityId, newCommunityName)` — loads every workgroup in the community that has a `chat_envelope_id`, calls `renameWorkgroupChat(wg.id, `${newCommunityName}: ${wg.name}`)` for each. Per confirmed requirement: a community rename must re-prefix every child workgroup chat name, not just the community chat itself.

**Workgroup chat:**
- `createWorkgroupChat(workgroupId)` — builds a fresh envelope (`type: 'group'`, `name: "<community name>: <workgroup name>"`, `participantIds: []`, `members: []`, `createdAt`, `updatedAt`), `createMetaEnvelope`, persists returned id to `workgroups.chat_envelope_id`, triggers a Workgroup payload re-sync (existing `syncWorkgroupToEvault`) so `chatId` lands there too.
- `renameWorkgroupChat(workgroupId, newName)` — fetch, set `name` only, write back. No-op + warn if `chat_envelope_id` is null.
- `archiveWorkgroupChat(workgroupId)` — fetch, set `isArchived: true` only, write back.
- `addPersonToWorkgroupChat(workgroupId, personId)` / `removePersonFromWorkgroupChat(workgroupId, personId)` — fetch, splice one id in/out, write back.

## Hook points (calls added to existing functions — no new call sites)

| Existing function | New call | Timing |
|---|---|---|
| `CommunityService.linkCommunity` | `captureExistingCommunityChatId` | synchronous (cheap, no eVault write) |
| `CommunityService.updateCommunity` (name/logo/description change) | `syncCommunityChatToEvault`; and if `name` changed, also `cascadeCommunityRenameToWorkgroupChats` | both fire-and-forget |
| `MemberService.addMember` | `addPersonToCommunityChat` | fire-and-forget |
| `MemberService.removeMember` | `removePersonFromCommunityChat`; and inside its existing per-workgroup cascade loop, call `removeWorkgroupMember(wm.workgroup_id, membership.person_id, { alsoRemoveFromChat: true })` | both synchronous |
| `WorkgroupService.createWorkgroup` | `createWorkgroupChat` | **awaited** (deviates from the fire-and-forget create convention — the id must exist in Postgres before anyone can join; workgroup creation is rare/admin-only so the extra latency is cheap) |
| `WorkgroupService.updateWorkgroup` (name changed) | `renameWorkgroupChat` | fire-and-forget |
| `WorkgroupService.deleteWorkgroup` | `archiveWorkgroupChat` (not delete — chat history isn't CORE's to destroy) | synchronous |
| `WorkgroupService.addWorkgroupMember` | `addPersonToWorkgroupChat` | fire-and-forget |
| `WorkgroupService.removeWorkgroupMember` | new optional param `alsoRemoveFromChat?: boolean` (default `false`); if true, `removePersonFromWorkgroupChat` | synchronous when true |

Admin-initiated workgroup-member removal (admin Members tab) always passes `alsoRemoveFromChat: false` — force-removing someone from a workgroup roster doesn't imply removing their chat access, matching the "chats are free" philosophy. Only two call sites ever pass `true`: user-confirmed self-leave, and the community-removal cascade.

## Frontend change

`app/src/views/MyWorkgroups.jsx`, `handleLeave`:

```js
async function handleLeave(wg) {
  if (!confirm(`Leave "${wg.name}"?`)) return
  const alsoRemoveFromChat = wg.chat_envelope_id
    ? confirm(`Also remove yourself from its chat?`)
    : false
  setBusy((s) => ({ ...s, [wg.id]: true }))
  try { await removeWorkgroupMember(wg.id, user.id, alsoRemoveFromChat); await refresh() }
  catch (err) { alert(err.message) }
  setBusy((s) => ({ ...s, [wg.id]: false }))
}
```

`app/src/api/client.js`:
```js
export const removeWorkgroupMember = (wid, pid, alsoRemoveFromChat) =>
  req('DELETE', `/workgroups/${wid}/members/${pid}${alsoRemoveFromChat ? '?alsoRemoveFromChat=true' : ''}`)
```

`WorkgroupController.ts`'s remove-member route reads `req.query.alsoRemoveFromChat === 'true'` and passes it through.

Second `confirm()` is skipped (defaults `false`) when `wg.chat_envelope_id` is falsy — guards pre-backfill/partial states, shouldn't occur in steady state.

## Error handling / concurrency

- Fire-and-forget ops: `.catch(err => logger.warn(err, ...))`, never block the Postgres write. Matches existing `WorkgroupService`/`MemberService` convention.
- Synchronous ops (removals, archive): `await`, throw blocks the corresponding Postgres mutation. Matches `feedback_evault_source_of_truth` — deletes must be loud, not silent.
- **Accepted, unaddressed limitation:** `updateMetaEnvelope` has no optimistic lock. Two concurrent fetch-merge-writes to the same envelope (e.g. CORE syncing a rename while ALVer edits the charter) can race; last write wins, the loser's change is silently dropped. Same limitation already accepted for the existing Workgroup-sync feature — not solved here.
- Any op targeting a null `chat_envelope_id` (workgroup pre-backfill, or a backfill that partially failed) is a no-op + `logger.warn`, not a thrown error — a missing chat must never block unrelated workgroup/member operations.
- Workgroup-chat *creation* failure is not swallowed: if `createWorkgroupChat` throws, `createWorkgroup` throws too — no workgroup is left in Postgres without a chat id.

## Backfill: De Woonwolk

One-off script, `api/scratch_backfill_chat.ts`, deleted after use (same pattern as the earlier stale-envelope fix):

1. Capture the existing Chat/Group envelope id → `communities.chat_envelope_id`. No eVault write — the 32-member roster is already verified correct.
2. For each of the 12 existing workgroups (currently zero chats): call `ChatService.createWorkgroupChat(wg.id)` — creates a fresh envelope named `"de Woonwolk: <workgroup name>"`, seeded with that workgroup's current Postgres roster as `participantIds`/`members`, persists the id, triggers the Workgroup payload re-sync so `chatId` is written there too.
3. Verify: re-dump all 12 new envelopes plus the community envelope via a read-only GraphQL query, confirm rosters/shapes match Postgres.

Runs against the real production eVault (`http://64.227.64.55:4000`, same credentials as prior work). Requires explicit confirmation before any actual write, per standing practice — not run automatically as part of this feature's implementation plan.

## Out of scope

- Registering the `Chat`/`Workgroup` ontology schemaIds in the W3DS Ontology service (pre-existing gap, unrelated to this feature).
- Optimistic locking / conflict resolution on `updateMetaEnvelope` writes.
- Any UI for browsing/reading chat contents inside CORE — this feature only creates/maintains the envelopes, never renders them.
- Backfill for any community other than De Woonwolk.
