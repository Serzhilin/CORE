# AvailabilityLog W3DS Ontology — Design

**Goal:** Close the one true data gap identified in `docs/superpowers/specs/2026-07-20-core-w3ds-native-analysis.md` — `AvailabilityLog` currently has zero eVault representation (Postgres-only). This plan gives it a real ontology and writes it going forward. It does **not** build read-back or cut Postgres out of the read path — see Non-goals.

## Ontology

New custom ontology `AvailabilityLog`, UUID `9cf4bb82-d18c-4eb8-b1cc-6730026800c7`, added to `api/src/lib/w3ds/ontology.ts`. Written to the **person's own vault** (matches the `Membership` ontology's precedent — member-owned, not community-owned).

## Shape: one envelope per log entry

Each closed-out availability period gets its own immutable envelope (`createEnvelope`, never `updateEnvelope`) — decided over the alternative (one growing-array envelope per membership) specifically because a growing array would make the Awareness Protocol fanout payload grow without bound over a long-lived community; one-envelope-per-entry keeps every fanout event a small, fixed size, forever, and makes append-only true by construction rather than by convention.

## Data flow

Hook point: `AvailabilityService.applyAvailability()` (`api/src/services/AvailabilityService.ts:99-137`). It already computes a `log` object (non-null exactly when a transition closes out a prior availability period) inside `computeAvailabilityChanges`, and already fires `syncAvailabilityToEvault(...)` fire-and-forget after the Postgres transaction commits. This plan adds a second fire-and-forget call in the same spot, only when `log` is non-null: `createAvailabilityLogEnvelope(membershipId, log)`.

New files, mirroring existing per-ontology conventions:

- **`api/src/services/availabilityLogPayload.ts`** — pure `buildAvailabilityLogPayload()`, versioned (`v: 1`) like `membershipPayload.ts`, taking `communityEname`, `typeName`, `typeEmoji`, `reason`, `fromDate` (ISO string), `untilDate` (ISO string).
- **`api/src/services/AvailabilityLogEnvelopeService.ts`** — `createAvailabilityLogEnvelope(membershipId, log)`: resolves the `CommunityMembership` → `Person` (for `ename`) and `Community` (for `ename`), then calls `createEnvelope({ vaultEname: person.ename, ontology: ONTOLOGIES.AvailabilityLog, payload, acl: [person.ename, community.ename] })`. No-ops (does not throw) if the person has no `ename` yet or the community isn't `linked` — same guard shape as `MembershipEnvelopeService.createMembershipEnvelope`.

## Error handling

Fire-and-forget after Postgres commit, `.catch(err => logger.warn(err, ...))` — loud (logged), never blocks or fails the request. This matches every existing envelope-sync call site in `AvailabilityService.ts`/`MemberService.ts`.

**Accepted limitation (explicit, not silent):** if a person has no `ename` yet at the moment a transition happens, that specific historical entry's eVault mirror is permanently skipped — unlike `Membership` envelopes (idempotent on a single `membership_envelope_id` column, so a later call can backfill), a per-entry log has no single slot to retroactively fill. Postgres remains the durable record regardless. Acceptable because this plan is write-only scope; whoever plans the eventual read-back cutover should account for this gap when reconciling.

## Non-goals

- No update/delete path for log envelopes — append-only, historical, never edited.
- No read-back: `MemberService.getMemberAvailabilityLog` keeps reading Postgres unchanged. A future `AvailabilityLogReader` + cache cutover is separate, later work.
- No registration into the packet-dispatch registry or reconciliation scheduler (built in the prior `w3ds-native-foundation` plan) — those exist for *inbound* sync of ontologies CORE reads back. This ontology is write-only from CORE's side today, same as `Organization`/`Workgroup`/`Availability` currently are.

## Testing

- `availabilityLogPayload.test.ts` — unit tests for the pure builder, mirroring `membershipPayload.test.ts`.
- `AvailabilityLogEnvelopeService.ts` gets no dedicated test file, matching the existing convention: `MembershipEnvelopeService.ts` and `AvailabilityEnvelopeService.ts` (DB + network side-effect wiring) have none either.
