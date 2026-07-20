# CORE W3DS-Native Feasibility Analysis

> This is an **analysis document**, not an implementation plan. No implementation plan follows from this spec yet — a follow-up planning pass is a separate, explicit decision.

**Goal:** Determine what it would take for CORE to become W3DS-native like WVTTK (eVault as sole source of truth, no Postgres as primary store), and identify exactly what data is already synced to eVault vs. Postgres-only today.

## Current State (as of this analysis)

CORE is **Postgres-primary, eVault-secondary**. 10 TypeORM entities in `api/src/database/entities/`: `Community`, `Person`, `CommunityMembership`, `Workgroup`, `Role`, `WorkgroupMembership`, `WorkgroupMemberRole`, `AvailabilityType`, `AvailabilityLog`, `OrganizationMembershipType`.

### eVault write coverage by ontology

| Ontology | ID | Call site | Vault written to |
|---|---|---|---|
| `User` | `550e8400-e29b-41d4-a716-446655440000` | `UserProfileSyncService.ts` | person's own vault |
| `Community` (Chat) | `550e8400-e29b-41d4-a716-446655440003` | `ChatService.ts` | community's own vault |
| `Organization` | `ad226473-...` | `OrganizationService.ts` | community's own vault |
| `Availability` | `fcdc28d2-...` | `AvailabilityEnvelopeService.ts` | community's own vault |
| `Workgroup` (custom) | `7867abbd-...` | `WorkgroupService.ts` | community's own vault |
| `Membership` (custom) | `d300f6d4-...` | `MembershipEnvelopeService.ts` | member's own vault |

### Read-back (sync consumer) coverage

Only `User` is round-tripped: `WebhookController.ts` (`/api/webhook`) and `AaaSService.ts` (60s poll of `AAAS_BASE_URL/api/packets`) both call `PersonService.upsertFromWebhook`, writing inbound `Person` changes into Postgres. **Every other ontology CORE owns is write-only** — CORE pushes to eVault but never reads back; Postgres alone remains authoritative for `Community`, `Organization`, `Availability`, `Workgroup`, `Membership` data.

### The one real gap: `AvailabilityLog`

`AvailabilityLog` (`community_membership_id`, `type_name`, `type_emoji`, `reason`, `from_date`, `until_date`) is written by `AvailabilityService.ts` on every status transition and read by `MemberService.getMemberAvailabilityLog`. **No ontology or call site pushes this history to eVault at all** — unlike the other entities above, it isn't even write-only, it has zero eVault representation. This is CORE's only true data gap versus a fully W3DS-covered model; everything else is a caching/architecture question, not a missing-data question.

Minor local-only fields, not gaps: `WorkgroupMemberRole` has no standalone envelope but is folded into `Workgroup` envelope's `members[].roleIds` on every sync, so it round-trips through the envelope already. `sort_order` fields and `AvailabilityType.is_archived` are local UI/ordering concerns, included in synced payloads where relevant (`is_archived` is a local soft-delete flag, not surfaced in the already-filtered `Availability` payload — this is intentional filtering, not a gap).

## Reference: WVTTK's actual pattern

WVTTK is not literally zero-database — it kept exactly one TypeORM entity, `Person` (ename, names, bio, avatar/banner URLs, `meta_envelope_id`, plus a demo `hello_world_envelope_id`), on `better-sqlite3`/libsql (`api/data/wvttk.db`, `synchronize: true`, no migrations). It dropped Postgres entirely on 2026-07-17 with the stated reason "one table never justified a container's dev/maintenance overhead." Every other domain concept (community/org branding, workgroups, availability, meetings) is read live from eVault via stateless Reader modules (`CommunityReader.ts`, `WorkgroupReader.ts`, `AvailabilityReader.ts`, `MembershipReader.ts`) calling `findEnvelopesByOntology`/`getEnvelope` directly — no local cache table backs any of them.

This works for WVTTK because its domain has **no roster/join queries** — the heaviest read is a single meeting's attendee list, driven off one `CalendarEvent` envelope per meeting.

## Why CORE can't copy WVTTK's approach directly

CORE's domain is relationally heavier: listing a community's roster, checking "is this person a workgroup admin across any of their memberships," and enforcing `Community.slug` uniqueness across all communities are all queries that would require live cross-vault fan-out under WVTTK's model — read one `Organization`/`Workgroup` envelope to get a list of member eNames, then N parallel `getEnvelope` calls (one per member's own vault) to hydrate names/avatars for display. WVTTK never needs this pattern because it has no multi-owner rosters.

**Conclusion: a literal zero-table port of WVTTK's pattern is not viable for CORE.** A thin, explicitly-rebuildable local cache is required for roster/permission queries to stay fast — this is a design constraint, not a compromise of "W3DS-native," as long as the cache is provably reconstructible from eVault data alone and never the source of truth.

## Global constraint: eVault is always the source of truth

This holds for every ontology, without exception. Postgres — including the thin cache tables described below — is never authoritative for anything. A cache row existing, missing, or stale must never block or override an eVault read; on any conflict, eVault wins and the cache is corrected, not the reverse. This matches the standing project rule that DB is disposable cache and eVault is truth, deletes must remove the eVault envelope (not just a local row), and cache failures must be loud, never silent.

**Cache update strategy** (resolves the "cache invalidation strategy" open question below): hybrid, not either/or —
1. **Event-driven via AaaS**: extend `AaaSService.ts`'s existing poll (currently `User`-only) to cover all 6 ontologies, updating the relevant cache row as events arrive — same pattern CORE already runs in production, just widened.
2. **Periodic reconciliation sweep**: AaaS/webhook delivery is fire-and-forget with no delivery guarantee (per the Awareness Protocol's prototype-level semantics), so event-driven updates alone can silently drift. A scheduled full (or diffed) re-read of each cached entity from its eVault envelope catches anything a missed event let slip — cadence TBD at planning time, but this sweep is mandatory, not optional, given event delivery has no guarantee.

## Target architecture (if pursued)

1. **eVault becomes authoritative for all 6 ontologies above**, not just `User`. CORE would need to actually read them back (currently only `User` round-trips).
2. **Build Reader services** (WVTTK naming convention): `OrganizationReader`, `WorkgroupReader`, `MembershipReader`, `AvailabilityReader` — hydrate domain objects from eVault on demand, replacing today's direct-Postgres reads in `CommunityService`/`MemberService`/etc.
3. **Local tables become caches, not stores**: same physical tables could remain (`Workgroup`, `CommunityMembership`, etc.) but reclassified as a write-through/rebuild-on-boot index over eVault state, never written to directly by business logic — every write goes to eVault first, cache updates are derived via the AaaS + reconciliation strategy above.
4. **Fix the `AvailabilityLog` gap**: give it a real ontology. Recommended: a new custom ontology `AvailabilityLog`, append-only, in the **person's own vault** (matches how `Membership` envelopes already live in the member's vault, not the community's) — kept separate from the `Availability` envelope for the same reason `Availability` was already split from `Organization`: avoid Awareness Protocol webhook noise on every append.
5. **Roster fan-out needs batching**: any roster-rendering path must parallelize the N per-member `getEnvelope` calls and lean on the local cache (item 3) to avoid a live N-call fan-out on every page load.
6. **Slug uniqueness**: `Community.slug` has no natural eVault-side uniqueness enforcement (it's a CORE business rule, not a W3DS identity concept) — the local cache index remains the practical place to enforce this, rebuilt from every community's `Organization` envelope at boot/on write.

## Open design questions (not resolved by this analysis)

- Exact shape of the new `AvailabilityLog` ontology (single growing array vs. one envelope per log entry) — affects Awareness Protocol payload size over a long-lived community.
- Reconciliation sweep cadence (how often, full rebuild vs. diff) — cache update *strategy* is settled (AaaS-driven + mandatory periodic sweep, see above), but the interval and rebuild-vs-diff mechanics are a planning-time decision, not resolved here.
- Migration ordering: reading back the 5 currently-write-only ontologies is a prerequisite for cache-ification of each entity independently — this could be staged per-entity rather than as one cutover.

## Non-goals of this analysis

- No decision has been made to actually pursue this migration.
- No implementation plan is included — if the user decides to proceed, `superpowers:writing-plans` would produce one from this spec as a separate step.
