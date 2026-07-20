# AvailabilityLog Ontology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `AvailabilityLog` a real W3DS ontology so every closed-out availability period gets written to the member's own eVault, closing the one true data gap identified in the w3ds-native-analysis spec.

**Architecture:** New custom ontology, one immutable envelope per log entry, written to the person's own vault, fire-and-forget from the existing `AvailabilityService.applyAvailability()` transaction-commit point — mirrors the existing `Membership` ontology's write pattern exactly. Write-only: Postgres stays the read path.

**Tech Stack:** TypeScript, TypeORM, Jest/ts-jest, existing `evault-client.ts` GraphQL wrapper.

## Global Constraints

- eVault is always the source of truth; Postgres (including this plan's untouched `AvailabilityLog` table) is never authoritative — this plan only *adds* an eVault write, it does not change what Postgres already does.
- Cache/sync failures must be loud, never silent — every new fire-and-forget call must `.catch()` into `logger.warn`, never swallow silently.
- One envelope per log entry (not a growing array) — keeps every Awareness Protocol fanout payload fixed-size, forever.
- Written to the **person's own vault**, not the community's — matches the `Membership` ontology precedent.
- No update/delete path for these envelopes — append-only, historical, never edited.
- No read-back in this plan — `MemberService.getMemberAvailabilityLog` keeps reading Postgres unchanged. Do not build a Reader service or touch that function.
- No registration into the packet-dispatch registry (`api/src/lib/w3ds/packetDispatch.ts`) or reconciliation scheduler (`api/src/services/ReconciliationService.ts`) — this ontology is write-only from CORE's side, nothing to dispatch or reconcile yet.

---

### Task 1: Ontology ID + payload builder

**Files:**
- Modify: `api/src/lib/w3ds/ontology.ts`
- Create: `api/src/services/availabilityLogPayload.ts`
- Test: `api/src/services/__tests__/availabilityLogPayload.test.ts`

**Interfaces:**
- Produces: `ONTOLOGIES.AvailabilityLog` (string UUID constant). `buildAvailabilityLogPayload(input: AvailabilityLogPayloadInput): AvailabilityLogEnvelopePayload`, where:
  ```typescript
  export interface AvailabilityLogPayloadInput {
      communityEname: string;
      typeName: string;
      typeEmoji: string;
      reason: string | null;
      fromDate: string;   // ISO date string, e.g. "2026-04-01"
      untilDate: string;  // ISO date string
  }

  export interface AvailabilityLogEnvelopePayload {
      v: 1;
      communityEname: string;
      typeName: string;
      typeEmoji: string;
      reason: string | null;
      fromDate: string;
      untilDate: string;
  }
  ```

- [ ] **Step 1: Add the ontology ID**

Open `api/src/lib/w3ds/ontology.ts`. Current content:

```typescript
export const ONTOLOGIES = {
  Community: '550e8400-e29b-41d4-a716-446655440003', // Chat envelope — group identity (GroupManifest is retiring)
  User:      '550e8400-e29b-41d4-a716-446655440000', // User profile envelope
  Workgroup: '7867abbd-420e-4dd9-bad6-8ad894c50b94', // Custom ontology — not yet registered in the Ontology service
  Organization: 'ad226473-640e-4d16-90e5-2fd96f261554', // Custom ontology — not yet registered in the Ontology service
  Availability: 'fcdc28d2-f22e-469b-a2f0-dad6bf3dd152', // Custom ontology — not yet registered in the Ontology service
  Membership: 'd300f6d4-a018-446c-add4-b34abc95de05', // Custom ontology — not yet registered in the Ontology service. Written to the MEMBER's own vault, not the community's.
} as const
```

Replace with:

```typescript
export const ONTOLOGIES = {
  Community: '550e8400-e29b-41d4-a716-446655440003', // Chat envelope — group identity (GroupManifest is retiring)
  User:      '550e8400-e29b-41d4-a716-446655440000', // User profile envelope
  Workgroup: '7867abbd-420e-4dd9-bad6-8ad894c50b94', // Custom ontology — not yet registered in the Ontology service
  Organization: 'ad226473-640e-4d16-90e5-2fd96f261554', // Custom ontology — not yet registered in the Ontology service
  Availability: 'fcdc28d2-f22e-469b-a2f0-dad6bf3dd152', // Custom ontology — not yet registered in the Ontology service
  Membership: 'd300f6d4-a018-446c-add4-b34abc95de05', // Custom ontology — not yet registered in the Ontology service. Written to the MEMBER's own vault, not the community's.
  AvailabilityLog: '9cf4bb82-d18c-4eb8-b1cc-6730026800c7', // Custom ontology — not yet registered in the Ontology service. One immutable envelope per closed-out availability period, written to the MEMBER's own vault.
} as const
```

- [ ] **Step 2: Write the failing test**

Create `api/src/services/__tests__/availabilityLogPayload.test.ts`:

```typescript
import { buildAvailabilityLogPayload } from "../availabilityLogPayload";

describe("buildAvailabilityLogPayload", () => {
    it("builds a versioned payload with all fields carried through", () => {
        const result = buildAvailabilityLogPayload({
            communityEname: "@community-ename",
            typeName: "Holiday",
            typeEmoji: "🏖️",
            reason: "family trip",
            fromDate: "2026-04-01",
            untilDate: "2026-04-21",
        });

        expect(result).toEqual({
            v: 1,
            communityEname: "@community-ename",
            typeName: "Holiday",
            typeEmoji: "🏖️",
            reason: "family trip",
            fromDate: "2026-04-01",
            untilDate: "2026-04-21",
        });
    });

    it("carries a null reason through unchanged", () => {
        const result = buildAvailabilityLogPayload({
            communityEname: "@community-ename",
            typeName: "Sick",
            typeEmoji: "🤒",
            reason: null,
            fromDate: "2026-05-01",
            untilDate: "2026-05-03",
        });

        expect(result.reason).toBeNull();
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd api && npx jest src/services/__tests__/availabilityLogPayload.test.ts --watchman=false`
Expected: FAIL — `Cannot find module '../availabilityLogPayload'`

- [ ] **Step 4: Write minimal implementation**

Create `api/src/services/availabilityLogPayload.ts`:

```typescript
export interface AvailabilityLogPayloadInput {
    communityEname: string;
    typeName: string;
    typeEmoji: string;
    reason: string | null;
    fromDate: string;
    untilDate: string;
}

export interface AvailabilityLogEnvelopePayload {
    v: 1;
    communityEname: string;
    typeName: string;
    typeEmoji: string;
    reason: string | null;
    fromDate: string;
    untilDate: string;
}

export function buildAvailabilityLogPayload(input: AvailabilityLogPayloadInput): AvailabilityLogEnvelopePayload {
    return {
        v: 1,
        communityEname: input.communityEname,
        typeName: input.typeName,
        typeEmoji: input.typeEmoji,
        reason: input.reason,
        fromDate: input.fromDate,
        untilDate: input.untilDate,
    };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd api && npx jest src/services/__tests__/availabilityLogPayload.test.ts --watchman=false`
Expected: PASS (2 tests)

- [ ] **Step 6: Typecheck**

Run: `cd api && npm run typecheck`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add api/src/lib/w3ds/ontology.ts api/src/services/availabilityLogPayload.ts api/src/services/__tests__/availabilityLogPayload.test.ts
git commit -m "feat: add AvailabilityLog ontology ID and payload builder"
```

---

### Task 2: Envelope-creation service

**Files:**
- Create: `api/src/services/AvailabilityLogEnvelopeService.ts`

**Interfaces:**
- Consumes: `ONTOLOGIES.AvailabilityLog` and `buildAvailabilityLogPayload` (Task 1); `createEnvelope` from `api/src/lib/evault-client.ts` (existing, signature `createEnvelope(input: { vaultEname: string; ontology: string; payload: Record<string, unknown>; acl: string[] }): Promise<string>`); `AppDataSource` from `api/src/database/data-source.ts`; `CommunityMembership` entity (`person_id`, `community_id` fields); `Person` entity (`ename` field); `Community` entity (`ename`, `provisioning_status` fields).
- Produces: `createAvailabilityLogEnvelope(membershipId: string, log: AvailabilityLogInput): Promise<void>`, where:
  ```typescript
  export interface AvailabilityLogInput {
      type_name: string;
      type_emoji: string;
      reason: string | null;
      from_date: Date;
      until_date: Date;
  }
  ```
  This matches the shape of the non-null `log` object already produced by `computeAvailabilityChanges` in `api/src/services/AvailabilityService.ts:22-32` (that type additionally carries `type_id`, which this function does not need and does not accept — the envelope payload never includes internal Postgres IDs).

This function has no dedicated test file — matching the existing repo convention that DB+network side-effect envelope services (`MembershipEnvelopeService.ts`, `AvailabilityEnvelopeService.ts`) are verified by typecheck + manual/integration testing, not unit tests. Task 3's manual smoke test exercises this function end-to-end.

- [ ] **Step 1: Write the implementation**

Create `api/src/services/AvailabilityLogEnvelopeService.ts`:

```typescript
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Community } from "../database/entities/Community";
import { Person } from "../database/entities/Person";
import { createEnvelope } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { buildAvailabilityLogPayload } from "./availabilityLogPayload";

const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const communityRepo = () => AppDataSource.getRepository(Community);
const personRepo = () => AppDataSource.getRepository(Person);

export interface AvailabilityLogInput {
    type_name: string;
    type_emoji: string;
    reason: string | null;
    from_date: Date;
    until_date: Date;
}

/** Creates one immutable AvailabilityLog envelope in the member's own vault for a closed-out
 *  availability period. No-op (not an error) if: the membership row no longer exists, the
 *  community isn't linked yet (no communityEname available), or the member has no ename yet
 *  (no vault to write into) — same guard shape as MembershipEnvelopeService.createMembershipEnvelope.
 *  Unlike that function, this is NOT self-healing: a skipped entry has no single slot to
 *  backfill into later, since every call creates a brand-new envelope. Postgres remains the
 *  durable record of the entry regardless. */
export async function createAvailabilityLogEnvelope(membershipId: string, log: AvailabilityLogInput): Promise<void> {
    const membership = await membershipRepo().findOne({ where: { id: membershipId } });
    if (!membership) return;

    const community = await communityRepo().findOne({ where: { id: membership.community_id } });
    if (!community || community.provisioning_status !== "linked" || !community.ename) return;

    const person = await personRepo().findOne({ where: { id: membership.person_id } });
    if (!person?.ename) return;

    const payload = buildAvailabilityLogPayload({
        communityEname: community.ename,
        typeName: log.type_name,
        typeEmoji: log.type_emoji,
        reason: log.reason,
        fromDate: log.from_date.toISOString(),
        untilDate: log.until_date.toISOString(),
    });

    await createEnvelope({
        vaultEname: person.ename,
        ontology: ONTOLOGIES.AvailabilityLog,
        payload: { ...payload },
        acl: [person.ename, community.ename],
    });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd api && npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add api/src/services/AvailabilityLogEnvelopeService.ts
git commit -m "feat: add AvailabilityLog envelope-creation service"
```

---

### Task 3: Wire into AvailabilityService + verify

**Files:**
- Modify: `api/src/services/AvailabilityService.ts:1-6` (imports), `api/src/services/AvailabilityService.ts:132-137` (post-commit sync block)

**Interfaces:**
- Consumes: `createAvailabilityLogEnvelope` (Task 2).

Current relevant section of `api/src/services/AvailabilityService.ts`:

```typescript
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { AvailabilityLog } from "../database/entities/AvailabilityLog";
import { AvailabilityType } from "../database/entities/AvailabilityType";
import { syncAvailabilityToEvault } from "./AvailabilityEnvelopeService";
import { logger } from "../lib/logger";
```

and:

```typescript
        m.availability_type_id = next.type_id;
        m.availability_reason = next.reason;
        m.availability_from = next.from;
        m.availability_until = next.until;
        const saved = await qr.manager.save(CommunityMembership, m);
        await qr.commitTransaction();
        syncAvailabilityToEvault(saved.community_id).catch((err) =>
            logger.warn(err, "Availability envelope sync failed for membership %s", membershipId)
        );
        return saved;
```

- [ ] **Step 1: Add the import**

In `api/src/services/AvailabilityService.ts`, change:

```typescript
import { syncAvailabilityToEvault } from "./AvailabilityEnvelopeService";
import { logger } from "../lib/logger";
```

to:

```typescript
import { syncAvailabilityToEvault } from "./AvailabilityEnvelopeService";
import { createAvailabilityLogEnvelope } from "./AvailabilityLogEnvelopeService";
import { logger } from "../lib/logger";
```

- [ ] **Step 2: Fire the log-envelope write alongside the existing sync**

Change:

```typescript
        m.availability_type_id = next.type_id;
        m.availability_reason = next.reason;
        m.availability_from = next.from;
        m.availability_until = next.until;
        const saved = await qr.manager.save(CommunityMembership, m);
        await qr.commitTransaction();
        syncAvailabilityToEvault(saved.community_id).catch((err) =>
            logger.warn(err, "Availability envelope sync failed for membership %s", membershipId)
        );
        return saved;
```

to:

```typescript
        m.availability_type_id = next.type_id;
        m.availability_reason = next.reason;
        m.availability_from = next.from;
        m.availability_until = next.until;
        const saved = await qr.manager.save(CommunityMembership, m);
        await qr.commitTransaction();
        syncAvailabilityToEvault(saved.community_id).catch((err) =>
            logger.warn(err, "Availability envelope sync failed for membership %s", membershipId)
        );
        if (log) {
            createAvailabilityLogEnvelope(membershipId, log).catch((err) =>
                logger.warn(err, "AvailabilityLog envelope creation failed for membership %s", membershipId)
            );
        }
        return saved;
```

- [ ] **Step 3: Run the existing pure-function tests to confirm no regression**

Run: `cd api && npx jest src/services/__tests__/AvailabilityService.test.ts --watchman=false`
Expected: PASS (5 tests, unchanged — `computeAvailabilityChanges` itself is untouched by this task)

- [ ] **Step 4: Run the full suite**

Run: `cd api && npm test -- --watchman=false`
Expected: all suites pass, no regressions

- [ ] **Step 5: Typecheck**

Run: `cd api && npm run typecheck`
Expected: no errors

- [ ] **Step 6: Manual smoke test**

Start the dev server on a free port (check `lsof -i :3004` first; if occupied by another running instance, use a different port such as 3099 rather than killing it):

```bash
cd api && PORT=3099 npx ts-node src/index.ts
```

In another terminal, confirm it boots cleanly (no errors referencing `AvailabilityLogEnvelopeService` or `createAvailabilityLogEnvelope`) and the health endpoint responds:

```bash
curl http://localhost:3099/api/health
```

Expected: `{"status":"ok","db":"connected"}`, no import/wiring errors in the server's startup log. Stop the server afterward (kill only the specific PID bound to the port you used, not a blanket process-name kill).

- [ ] **Step 7: Commit**

```bash
git add api/src/services/AvailabilityService.ts
git commit -m "feat: write AvailabilityLog envelope on every closed-out availability period"
```
