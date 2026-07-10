# Organization eVault Sync — Design

**Goal:** every community in CORE gets one Organization MetaEnvelope in its eVault holding legal/juridical info, branding, board members, configurable membership types, and the member roster — replacing the retired Chat-envelope-based sync and the `is_aspirant`/`is_active_partner` boolean membership model.

**Context:** Community currently syncs its own fields (name/logo/color/font) and membership `participantIds` into a Chat MetaEnvelope (`Community.community_envelope_id`), created at community-link time via `linkCommunity` in `CommunityService.ts`. Per [[project_w3ds_chat_group_protocol]], groups are meant to use the Chat envelope for messaging identity — conflating it with legal/branding/membership data was a stopgap. This design retires that conflation and introduces a dedicated `Organization` ontology (schemaId not yet registered — same deferral as the `Workgroup` ontology from the prior sync feature).

This follows directly on the Workgroup eVault sync design (`docs/superpowers/specs/2026-07-10-workgroup-evault-sync-design.md`) and reuses its core principle unchanged.

## Principle: DB is cache, eVault is source of truth

Unchanged from the Workgroup design: create/update sync is fire-and-forget (self-heals — payload always rebuilt in full from Postgres, never diffed). Delete sync is synchronous and blocks the local delete on failure.

**Guard learned from the Workgroup feature's post-review fix:** deleting a `Role` while members still held it left orphan `WorkgroupMemberRole` rows that kept leaking into synced payloads (a non-self-healing bug, caught only in final review). This design applies the lesson up front: deleting a `membershipType` while any `CommunityMembership` still references it is **blocked** (409), not silently orphaned or auto-reassigned. Admin must reassign affected members to a different type first.

## Data model changes

### New table: `organization_membership_types`

```ts
@Entity("organization_membership_types")
export class OrganizationMembershipType {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid" })
    community_id: string;

    @Column()
    name: string;

    @Column({ type: "text", nullable: true })
    description: string | null;

    @Column({ type: "text", nullable: true })
    emoji: string | null;

    @Column({ default: 0 })
    sort_order: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
```

Per-community configurable list (De Woonwolk's initial set: "Aspirant", "Full member", "Active partner"). Nested into the Organization payload as `membershipTypes[]`, same pattern as `Workgroup`'s `roles[]`.

### `CommunityMembership` changes

Drop:
```ts
@Column({ default: false })
is_aspirant: boolean;

@Column({ default: false })
is_active_partner: boolean;
```

Add:
```ts
@Column({ type: "uuid", nullable: true })
membership_type_id: string | null;
```

`is_admin` is untouched — it is a permission flag orthogonal to membership type, not part of this ontology.

Membership type is single-select: exactly one `membership_type_id` per membership, matching how `is_aspirant`/`is_active_partner` were used today (mutually-exclusive-ish status), not stacked tags.

### `Community` changes

Drop:
```ts
@Column({ type: "text", nullable: true })
community_envelope_id: string | null;
```
And all `CommunityService.ts` code that syncs to it (Chat-envelope-based `syncCommunityToEvault`, and `MemberService.ts`'s participantId add/remove against this envelope) — fully retired, not merely stopped.

Add:
```ts
@Column({ type: "text", nullable: true })
organization_envelope_id: string | null;

@Column({ type: "text", nullable: true })
legal_form: string | null;

@Column({ type: "text", nullable: true })
official_name: string | null;

@Column({ type: "text", nullable: true })
kvk_number: string | null;

@Column({ type: "text", nullable: true })
rsin: string | null;

@Column({ type: "text", nullable: true })
iban: string | null;

@Column({ type: "text", nullable: true })
registered_address: string | null;

@Column({ type: "date", nullable: true })
founding_date: Date | null;

@Column({ type: "text", nullable: true })
statuten_file_uri: string | null;

@Column({ type: "jsonb", default: () => "'[]'" })
board_members: { eName: string; role: string }[];
```

`logo_url`, `primary_color`, `title_font` are unchanged in name/shape — they remain local cache columns, but their sync target moves from the retired Chat envelope to the new Organization envelope.

`board_members` is a jsonb column, not a dedicated table: whole-array replace on every edit, no per-row FK, `eName` is free text (a board member need not be a CORE `Person` — e.g. an external advisor).

### Migration (one-time, run against existing data)

1. For each community, seed `organization_membership_types` with the community's current set (De Woonwolk: "Aspirant", "Full member", "Active partner").
2. For each `CommunityMembership` row: `is_aspirant = true` → set `membership_type_id` to the community's Aspirant type; `is_active_partner = true` → Active-partner type; neither → Full-member type.
3. Drop `is_aspirant`, `is_active_partner` columns.
4. Drop `community_envelope_id` column. The old Chat MetaEnvelope this pointed to becomes orphaned in the real eVault — left as-is, not cleaned up (explicit decision: not worth the extra migration complexity for a one-off legacy envelope).

## Organization MetaEnvelope payload shape

One envelope per community, created at community-link time (same trigger point that used to create the Chat envelope in `linkCommunity`) — not lazily on first edit, since Community itself is always present once linked.

```json
{
  "legalInfo": {
    "legalForm": "cooperative",
    "officialName": "Coöperatie De Woonwolk U.A.",
    "kvkNumber": "12345678",
    "rsin": "123456789",
    "iban": "NL00BANK0123456789",
    "registeredAddress": "Voorbeeldstraat 1, 1234 AB Amsterdam",
    "foundingDate": "2020-01-15",
    "statutenFileUri": "w3ds://file?id=@<ename>/<meta-envelope-id>",
    "boardMembers": [{ "eName": "@...", "role": "Voorzitter" }]
  },
  "branding": {
    "logoUrl": "https://...",
    "primaryColor": "#C4622D",
    "titleFont": "Playfair Display"
  },
  "membershipTypes": [
    { "id": "...", "name": "Aspirant", "description": "...", "emoji": "🌱" },
    { "id": "...", "name": "Full member", "description": "...", "emoji": "🏡" },
    { "id": "...", "name": "Active partner", "description": "...", "emoji": "⭐" }
  ],
  "members": [
    { "participantId": "<person.meta_envelope_id>", "eName": "@...", "dateJoined": "2021-03-01", "membershipTypeId": "..." }
  ]
}
```

`members[]` carries both `participantId` (meta_envelope_id — matches the `Workgroup` convention, needed for eVault-side addressing/Awareness Protocol) and `eName` (human-readable, avoids a resolve round-trip). Any field in `legalInfo` may be `null`/omitted if not yet filled in locally (matches `buildWorkgroupPayload`'s existing description-omission convention — omit rather than send `null`).

Whole payload rebuilt in full from Postgres on every sync, never diffed or merged.

## Sync points

All sync functions live in a new `OrganizationService.ts` (or extend `CommunityService.ts` — implementation detail for the plan), following the `syncWorkgroupToEvault` pattern: a private `syncOrganizationToEvault(communityId, exclude?)` helper that loads all the above from Postgres, builds the payload, and calls `createEnvelope`/`updateEnvelope` against `Community.organization_envelope_id`.

**Fire-and-forget** (`.catch(err => logger.warn(err, ...))`, matching existing convention):
- legalInfo field edits (any of `legal_form`, `official_name`, `kvk_number`, `rsin`, `iban`, `registered_address`, `founding_date`, `statuten_file_uri`)
- branding edits (`logo_url`, `primary_color`, `title_font`)
- membershipType create/edit
- boardMember add/edit/reorder (whole `board_members` array rewritten)
- member add, member's `membership_type_id` change

**Synchronous, blocking** (failure propagates, Postgres delete never runs):
- member removal → `syncOrganizationToEvault` with the member excluded, awaited, before deleting the `CommunityMembership` row
- boardMember removal → sync with that entry excluded from `board_members`, awaited, before persisting the trimmed array
- membershipType removal → **pre-check first** (see below), then sync with the type excluded, awaited, before deleting the `OrganizationMembershipType` row

**membershipType removal pre-check:** before any sync or delete, check whether any `CommunityMembership.membership_type_id` still references the type being deleted. If so, reject with 409 and a message naming the affected member count. Do not delete, do not sync. This is a distinct guard from the sync-failure error handling below — it fires before sync is ever attempted.

## Error handling

- Create/update sync failures: logged via `logger.warn`, swallowed — self-heals next write.
- Delete sync failures: thrown up through the Service function to the controller, which returns a 500. The Postgres row/field is never removed in this case.
- membershipType-in-use: 409 pre-check, independent of sync — never reaches the sync/delete step at all.

## API surface (new/changed endpoints)

- `Community` update endpoint gains the legalInfo fields, `statutenFileUri`, and `board_members` array to its accepted body.
- New `OrganizationMembershipType` CRUD: list/create/update/delete, scoped to `community_id`.
- `CommunityMembership` update endpoint gains `membership_type_id` in its accepted body, drops `is_aspirant`/`is_active_partner`.

## Known tradeoff: loses Group-ontology interop

`community_envelope_id` was a MetaEnvelope under the real, registered **Group** ontology (`550e8400-e29b-41d4-a716-446655440003`), not a CORE-internal detail. `WebhookController.ts` has a live inbound path (`syncFromChatWebhook`) that receives Awareness Protocol updates when other W3DS platforms (e.g. ALVer) write to this community's Group envelope. Retiring `community_envelope_id` removes this inbound path — CORE stops receiving cross-platform Group updates. `Organization` is a new, unregistered ontology that no other platform knows about, so nothing replaces this interop.

**Explicit decision:** accept this loss for now. No other platform depends on it in practice today. Revisit if/when real cross-platform Group sync becomes load-bearing (e.g. if ALVer's W3DS work, see [[project_alver_w3ds_status]], resumes and needs it).

## Out of scope

- Registering the `Organization` schemaId in the W3DS Ontology service (same deferral as `Workgroup`).
- Actual UI screens/forms for editing legalInfo, branding, boardMembers, membershipTypes — required follow-on work, to be designed at plan time.
- Updating existing UI that reads the old booleans — `OrganogramView`'s "Show aspirants" filter and admin member forms currently branch on `is_aspirant`/`is_active_partner` and must be migrated to `membership_type_id`. Flagged as required, not designed here.
- Cleaning up the orphaned legacy Chat MetaEnvelope in the real eVault (explicit decision: leave it).
- Statuten version history (only the current file link is kept; no history array).
