# Workgroup eVault Sync — Design

**Goal:** every CRUD on workgroups, roles, workgroup memberships, and role assignments in a linked community is reflected in that community's eVault, using the `Workgroup` ontology (schemaId `7867abbd-420e-4dd9-bad6-8ad894c50b94`, not yet registered in the Ontology service).

**Context:** CORE already syncs some entities to eVault (`Community` fields, Chat envelope `participantIds` on community membership add/remove) via explicit calls from the Service layer to `api/src/lib/evault-client.ts` — no TypeORM subscriber is active in this codebase (a stale `dist/web3adapter/subscriber.js` build artifact exists but is not wired into `data-source.ts`; ignore it). `WorkgroupService.ts` currently has zero eVault sync — pure Postgres CRUD.

Twelve De Woonwolk workgroups were already written manually as `Workgroup` MetaEnvelopes to de Woonwolk's eVault (`http://64.227.64.55:4000`, ename `@de68861c-8ea9-55be-9258-2a8cc3057a60`) prior to this design, as a one-off script. Their returned MetaEnvelope IDs are recorded and must be backfilled so future syncs update rather than duplicate them.

## Principle: DB is cache, eVault is source of truth

Postgres holds a cached copy of workgroup state; the eVault envelope is authoritative. This has one concrete consequence for this design: **create/update sync may remain fire-and-forget** (a missed sync self-heals on the next write, since payload is always rebuilt in full from Postgres), but **delete sync must be synchronous and failure must block the local delete**. If a delete only removes the Postgres row and the eVault call fails silently, the cache diverges from the source of truth with no visible error — the one failure mode that doesn't self-heal.

## Data model change

Add to `Workgroup` entity (`api/src/database/entities/Workgroup.ts`):

```ts
@Column({ type: "text", nullable: true })
envelope_id: string | null;
```

Nullable — `null` means the workgroup exists locally but has no eVault envelope yet (community not linked, or not yet synced). One MetaEnvelope per workgroup; roles, workgroup memberships, and role assignments are NOT separate envelopes — they're nested JSON arrays inside the parent Workgroup payload, matching the schema:

```json
{
  "communityId": "@de68861c-8ea9-55be-9258-2a8cc3057a60",
  "name": "Interiors wg",
  "color": "#5D8C1E",
  "createdAt": "2026-07-10T08:35:27.573Z",
  "updatedAt": "2026-07-10T09:20:00.000Z",
  "roles": [{ "id": "...", "name": "Boekhouder", "color": "#EAB308" }],
  "members": [{ "participantId": "<person.meta_envelope_id>", "roleIds": ["..."] }]
}
```

No new columns needed on `Role`, `WorkgroupMembership`, or `WorkgroupMemberRole` — their state is only ever read to rebuild the parent Workgroup payload.

## Sync points

All sync functions live in `WorkgroupService.ts`, following the existing pattern in `CommunityService.ts` (`syncCommunityToEvault`, `addParticipantToEnvelope`): a private `syncWorkgroupToEvault(workgroupId)` helper that:

1. Loads the workgroup row (bail if community isn't `linked` or has no `ename`/`evault_uri`).
2. Loads its roles, workgroup memberships, and member-role assignments from Postgres.
3. Loads each member's `Person.meta_envelope_id` (same lookup CommunityService/MemberService already use — `getUserMetaEnvelopeId` fallback if not cached).
4. Builds the full payload per the schema above.
5. If `workgroup.envelope_id` is set → `updateEnvelope`. Otherwise → `createEnvelope`, then persist the returned id to `workgroup.envelope_id`.

**Create/update triggers** (fire-and-forget, `.catch(err => logger.warn(err, ...))`, matching existing convention):
`createWorkgroup`, `updateWorkgroup`, `createRole`, `updateRole`, `addWorkgroupMember`, `assignRole`.

`updateWorkgroupMember` only toggles `is_workgroup_admin`, which isn't a field in the `Workgroup` schema's `members[]` shape — no sync trigger needed there (nothing to reflect).

**Delete triggers** (synchronous, blocking, failure propagates):
`deleteRole`, `removeWorkgroupMember`, `unassignRole` — these call `syncWorkgroupToEvault` (an `updateEnvelope` with the item removed from the nested array) **before** the Postgres delete; if the eVault call throws, the Service function throws too and the Postgres delete never runs.

`deleteWorkgroup` is a true envelope removal: call `removeEnvelope(vaultEname, envelopeId)` synchronously before `wgRepo().delete(...)`. If eVault delete fails, throw — do not delete the Postgres row.

## New helper: `removeEnvelope`

`evault-client.ts` has `createEnvelope`/`updateEnvelope`/`getEnvelope`/`findEnvelopesByOntology` but no delete wrapper. Add:

```ts
const GQL_REMOVE = `
  mutation RemoveMetaEnvelope($id: ID!) {
    removeMetaEnvelope(id: $id) {
      deletedId
      success
      errors { message code }
    }
  }
`

export async function removeEnvelope(vaultEname: string, envelopeId: string): Promise<void> {
  const data = await gqlRequest<{
    removeMetaEnvelope: { success: boolean; errors?: Array<{ message?: string }> }
  }>(vaultEname, GQL_REMOVE, { id: envelopeId })
  if (!data.removeMetaEnvelope.success || data.removeMetaEnvelope.errors?.length) {
    throw new Error(data.removeMetaEnvelope.errors?.[0]?.message ?? 'removeEnvelope failed')
  }
}
```

Per `evault.md`, `removeMetaEnvelope` requires only `X-ENAME` (same as create/update) — no additional auth.

## Backfill (one-time, not a recurring code path)

A one-off script (not part of the app) matches the 12 already-written envelope IDs to `Workgroup.id` rows by name and sets `envelope_id`:

| Workgroup name | envelope_id |
|---|---|
| Activiteiten | `18fc4e60-cd74-59be-ac77-8220142e1b96` |
| Architectuur | `84597456-ab25-5aed-a186-dcf2c20743df` |
| Bestuur | `a44c9216-5b3f-5790-aacf-73949ee7932f` |
| Care | `285d1d72-d5cf-5c5a-9848-c3801168338c` |
| Communicatie | `673626e1-d507-5bdb-8eb9-3bd6f757c0cb` |
| Coordinatie | `f7d66953-8818-5f44-8263-ac91a47dfc49` |
| Crowdlending | `85b9f3ed-a8ab-5bce-bb64-56c73aca60d4` |
| Financieel | `85582657-0938-5bab-860a-fc55f33459fd` |
| Interiors wg | `ccabea81-4666-5be3-9cae-5b9db05924c4` |
| Subsidies | `2935a395-0221-526f-a817-6a9ff1ee969d` |
| Toe-/uittreding | `326f4a97-cffa-5f4d-a1f7-931971e7f5f2` |
| Verdeling wg | `8283bba4-0ac7-5f3c-a67d-ac95703195b9` |

Runs once, against the real De Woonwolk community (`1ca7e1c6-df01-400d-8474-456abbc01b8b`) only. Without this, the first `updateWorkgroup`/role/member change creates 12 duplicate envelopes instead of updating the existing ones.

## Error handling

- Create/update sync failures: logged via `logger.warn`, swallowed — self-heals next write (payload is always rebuilt in full, not diffed).
- Delete sync failures: NOT swallowed. Thrown up through the Service function to the controller, which returns a 500. The Postgres row is never deleted in this case — local state and eVault state may disagree on other fields but never on existence (no row disappears from cache while its envelope still exists in the source of truth, and no envelope is removed while a cached row still references it).

## Out of scope

- Registering the `Workgroup` schemaId in the Ontology service (separate follow-up, not blocking sync working).
- Any change to `deleteWorkgroup`'s cascade behavior beyond adding the eVault call — it already cascades locally via FK/explicit deletes.
- Nested workgroups (`parentId`) — the schema supports it, nothing in this design populates or reads it yet.
