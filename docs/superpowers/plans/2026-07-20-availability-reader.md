# AvailabilityReader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give CORE its second read-back path for the `Availability` ontology — reconcile eVault's envelope back into Postgres (`AvailabilityType` status list, `CommunityMembership`'s four per-member availability fields) via the same three triggers as `OrganizationReader`: an AaaS/webhook packet handler, a debounced request-triggered reconcile on community page load, and an hourly safety-net sweep.

**Architecture:** One shared function, `reconcileAvailabilityFromEvault(communityId, payload)` in a new `AvailabilityReconciler.ts`, fed by three independent call sites. A separate `AvailabilityReconcileTrigger.ts` holds its own debounced request-triggered wrapper (own `Map`, own 60s window — deliberately not shared with `OrganizationReconcileTrigger.ts`). `registerOntologyHandlers.ts` and the existing `registerReconcilers.ts` each get one more line wiring in the other two triggers at boot — `index.ts`'s boot sequence already calls both hub functions in the right order (done by the prior plan), so this plan does not touch `index.ts`.

**Tech Stack:** TypeORM (Postgres), Express, Jest.

## Global Constraints

- eVault is always the source of truth; on any conflict, eVault wins and Postgres is corrected, never the reverse.
- Every reconcile call site is fire-and-forget, `.catch(err => logger.warn(err, ...))` — never throws past its caller.
- Structural drift (a row created/deleted, or an entry's fields cleared, not just a field updated) is logged at warn level even though it's auto-corrected — cache correction must be loud, never silent.
- No changes to the write path (`AvailabilityEnvelopeService.ts` / `availabilityPayload.ts` stay untouched).
- No `CommunityMembership` rows are ever created or deleted by this reconciler — roster membership itself is `OrganizationReconciler`'s concern, not this one's. Only four fields (`availability_type_id`, `availability_reason`, `availability_from`, `availability_until`) are ever written on an already-existing row.
- The eligibility gate for clearing an unmatched member's status is `person.ename && person.meta_envelope_id` (cached value only — no `getUserMetaEnvelopeId` network resolution call), exactly matching `OrganizationReconciler.ts`'s roster-deletion fix. This can under-clear a genuinely-removed status for a person whose `meta_envelope_id` isn't cached yet; that's an accepted, self-healing, safe-direction residual — same tradeoff already accepted for `OrganizationReconciler`, not something this plan re-litigates.
- No dedicated automated test file for `AvailabilityReconciler.ts`'s core DB logic — matches this repo's existing convention (no test file touches `AppDataSource`); verified instead via typecheck + a manual smoke-test sequence.
- Request-triggered reconcile is debounced to at most once per 60 seconds per community, via its own in-memory process-local map (resets on restart, which is fine) — separate from `OrganizationReconcileTrigger.ts`'s map.
- Periodic sweep runs hourly (`60 * 60_000` ms), registered via `registerReconciler("availability", ...)` in the existing `registerReconcilers.ts`.

---

### Task 1: Core reconciliation logic

**Files:**
- Create: `api/src/services/AvailabilityReconciler.ts`

**Interfaces:**
- Consumes: `AvailabilityEnvelopePayload` from `./availabilityPayload` (already exists — `{ statuses: { id: string; name: string; emoji: string; sortOrder: number }[]; entries: { participantId: string; eName: string; statusId: string; reason: string | null; from: string | null; until: string | null }[] }`).
- Produces: `reconcileAvailabilityFromEvault(communityId: string, payload: AvailabilityEnvelopePayload): Promise<void>` and `reconcileAvailabilityPacket(communityEname: string, payload: AvailabilityEnvelopePayload): Promise<void>`. `reconcileAvailabilityFromEvault` is also consumed directly by Task 2's trigger and by Task 3's `availabilityReconciliationSweep` — Task 3 Step 1 appends `availabilityReconciliationSweep` to this same file; it is NOT part of Task 1's deliverable.

- [ ] **Step 1: Write `AvailabilityReconciler.ts`**

```typescript
import { In } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { AvailabilityType } from "../database/entities/AvailabilityType";
import { Person } from "../database/entities/Person";
import { logger } from "../lib/logger";
import { AvailabilityEnvelopePayload } from "./availabilityPayload";

const communityRepo = () => AppDataSource.getRepository(Community);
const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const availabilityTypeRepo = () => AppDataSource.getRepository(AvailabilityType);
const personRepo = () => AppDataSource.getRepository(Person);

async function reconcileStatuses(
    communityId: string,
    envelopeStatuses: AvailabilityEnvelopePayload["statuses"]
): Promise<void> {
    const repo = availabilityTypeRepo();
    const localTypes = await repo.find({ where: { community_id: communityId } });
    const localById = new Map(localTypes.map((t) => [t.id, t]));
    const envelopeIds = new Set(envelopeStatuses.map((s) => s.id));

    for (const status of envelopeStatuses) {
        try {
            const local = localById.get(status.id);
            if (!local) {
                const maxSortOrder = localTypes.reduce((max, t) => Math.max(max, t.sort_order), -1);
                await repo.save(
                    repo.create({
                        id: status.id,
                        community_id: communityId,
                        name: status.name,
                        emoji: status.emoji,
                        sort_order: maxSortOrder + 1,
                        is_archived: false,
                    })
                );
                logger.warn(
                    "AvailabilityReconciler: resurrected availability type %s for community %s (present in eVault, missing locally)",
                    status.id,
                    communityId
                );
            } else if (local.name !== status.name || local.emoji !== status.emoji) {
                await repo.update(local.id, { name: status.name, emoji: status.emoji });
            }
        } catch (err) {
            logger.warn(err, "AvailabilityReconciler: status reconcile failed for %s", status.id);
        }
    }

    for (const local of localTypes) {
        if (envelopeIds.has(local.id)) continue;
        try {
            await repo.delete(local.id);
            logger.warn(
                "AvailabilityReconciler: deleted availability type %s for community %s (absent from eVault)",
                local.id,
                communityId
            );
        } catch (err) {
            logger.warn(err, "AvailabilityReconciler: status delete failed for %s", local.id);
        }
    }
}

async function reconcileEntries(
    communityId: string,
    entries: AvailabilityEnvelopePayload["entries"]
): Promise<void> {
    const cmRepo = membershipRepo();
    const localMemberships = await cmRepo.find({ where: { community_id: communityId } });
    const matchedPersonIds = new Set<string>();

    for (const entry of entries) {
        try {
            const person = await personRepo().findOne({ where: { ename: entry.eName } });
            if (!person) continue;
            matchedPersonIds.add(person.id);

            // This reconciler never creates CommunityMembership rows — roster membership
            // itself is OrganizationReconciler's concern, not this one's.
            const local = localMemberships.find((m) => m.person_id === person.id);
            if (!local) continue;

            if (
                local.availability_type_id !== entry.statusId ||
                local.availability_reason !== entry.reason ||
                (local.availability_from as unknown as string | null) !== entry.from ||
                (local.availability_until as unknown as string | null) !== entry.until
            ) {
                await cmRepo.update(local.id, {
                    availability_type_id: entry.statusId,
                    availability_reason: entry.reason,
                    availability_from: entry.from as unknown as Date | null,
                    availability_until: entry.until as unknown as Date | null,
                });
            }
        } catch (err) {
            logger.warn(err, "AvailabilityReconciler: entry reconcile failed for %s", entry.eName);
        }
    }

    // Only memberships that currently HAVE a status set are candidates for clearing —
    // anyone else unmatched is already a no-op.
    const unmatchedLocal = localMemberships.filter(
        (local) => !matchedPersonIds.has(local.person_id) && local.availability_type_id !== null
    );
    const unmatchedPersonIds = unmatchedLocal.map((local) => local.person_id);
    const unmatchedPersons = unmatchedPersonIds.length
        ? await personRepo().find({ where: { id: In(unmatchedPersonIds) } })
        : [];
    const unmatchedPersonById = new Map(unmatchedPersons.map((p) => [p.id, p]));

    for (const local of unmatchedLocal) {
        // Mirrors OrganizationReconciler's roster-deletion fix: a person with no ename or no
        // cached meta_envelope_id could never have appeared in the envelope (see
        // AvailabilityEnvelopeService.ts's own eligibility check), so their absence from
        // entries[] is not evidence their status was cleared — leave them untouched.
        const person = unmatchedPersonById.get(local.person_id);
        if (!person || !person.ename || !person.meta_envelope_id) continue;

        try {
            await cmRepo.update(local.id, {
                availability_type_id: null,
                availability_reason: null,
                availability_from: null,
                availability_until: null,
            });
            logger.warn(
                "AvailabilityReconciler: cleared availability for membership %s in community %s (absent from eVault entries)",
                local.id,
                communityId
            );
        } catch (err) {
            logger.warn(err, "AvailabilityReconciler: entry clear failed for %s", local.id);
        }
    }
}

export async function reconcileAvailabilityFromEvault(
    communityId: string,
    payload: AvailabilityEnvelopePayload
): Promise<void> {
    await reconcileStatuses(communityId, payload.statuses);
    await reconcileEntries(communityId, payload.entries);
}

export async function reconcileAvailabilityPacket(
    communityEname: string,
    payload: AvailabilityEnvelopePayload
): Promise<void> {
    const community = await communityRepo().findOne({ where: { ename: communityEname } });
    if (!community) {
        logger.warn("AvailabilityReconciler: no local community found for ename %s", communityEname);
        return;
    }
    await reconcileAvailabilityFromEvault(community.id, payload);
}
```

- [ ] **Step 2: Manual verification (no automated test file for this task — matches repo convention for DB-touching reconciliation logic)**

Run a one-off script against your local dev Postgres to verify the create/update/delete/clear paths, since this logic has no automated test:

```bash
cd api && cat > /tmp/availability-reconciler-smoke.ts <<'EOF'
import { AppDataSource } from "./src/database/data-source";
import { reconcileAvailabilityFromEvault } from "./src/services/AvailabilityReconciler";
import { Community } from "./src/database/entities/Community";
import { AvailabilityType } from "./src/database/entities/AvailabilityType";
import { CommunityMembership } from "./src/database/entities/CommunityMembership";
import { Person } from "./src/database/entities/Person";

async function main() {
    await AppDataSource.initialize();
    const communityRepo = AppDataSource.getRepository(Community);
    const typeRepo = AppDataSource.getRepository(AvailabilityType);
    const membershipRepo = AppDataSource.getRepository(CommunityMembership);
    const personRepo = AppDataSource.getRepository(Person);

    const community = await communityRepo.findOne({ where: {} }); // pick any existing test community
    if (!community) { console.log("No community found — create one first via the app UI."); return; }

    // Scenario 1: a status type present in the envelope but missing locally must be resurrected.
    const fakeTypeId = "22222222-2222-2222-2222-222222222222";
    await reconcileAvailabilityFromEvault(community.id, {
        statuses: [{ id: fakeTypeId, name: "Resurrected Status", emoji: "🎉", sortOrder: 0 }],
        entries: [],
    });
    const resurrected = await typeRepo.findOne({ where: { id: fakeTypeId } });
    console.log("Resurrected status present:", !!resurrected, resurrected?.name);
    if (resurrected) await typeRepo.delete(fakeTypeId);

    // Scenario 2: an envelope-eligible member (ename + meta_envelope_id both set) with a
    // local status, absent from entries[], must have their status cleared.
    const eligibleMembership = await membershipRepo.findOne({ where: { community_id: community.id } });
    if (eligibleMembership) {
        const person = await personRepo.findOne({ where: { id: eligibleMembership.person_id } });
        if (person?.ename && person?.meta_envelope_id) {
            await membershipRepo.update(eligibleMembership.id, {
                availability_type_id: "33333333-3333-3333-3333-333333333333",
                availability_reason: "testing",
            });
            await reconcileAvailabilityFromEvault(community.id, { statuses: [], entries: [] });
            const cleared = await membershipRepo.findOne({ where: { id: eligibleMembership.id } });
            console.log("Eligible member's status cleared:", cleared?.availability_type_id === null);
        } else {
            console.log("Found membership has no eName/meta_envelope_id — skipped scenario 2. Pick a linked member to exercise it.");
        }
    } else {
        console.log("No membership on this community — skipped scenario 2. Create one via the app UI.");
    }

    // Scenario 3 (control): an eName-less/unresolved member with a local status must be
    // left untouched — envelope-ineligible, so their absence from entries[] proves nothing.
    const ineligibleMembership = await membershipRepo.findOne({ where: { community_id: community.id } });
    if (ineligibleMembership) {
        const person = await personRepo.findOne({ where: { id: ineligibleMembership.person_id } });
        if (!person?.ename || !person?.meta_envelope_id) {
            await membershipRepo.update(ineligibleMembership.id, {
                availability_type_id: "44444444-4444-4444-4444-444444444444",
                availability_reason: "control case",
            });
            await reconcileAvailabilityFromEvault(community.id, { statuses: [], entries: [] });
            const untouched = await membershipRepo.findOne({ where: { id: ineligibleMembership.id } });
            console.log("Ineligible member's status left untouched:", untouched?.availability_type_id === "44444444-4444-4444-4444-444444444444");
            await membershipRepo.update(ineligibleMembership.id, { availability_type_id: null, availability_reason: null });
        } else {
            console.log("Found membership IS eName-resolved — skipped scenario 3 (control case needs an unresolved member).");
        }
    }

    process.exit(0);
}

main();
EOF
npx ts-node /tmp/availability-reconciler-smoke.ts
```

Expected: logs a warning `"AvailabilityReconciler: resurrected availability type ..."`, then prints `Resurrected status present: true Resurrected Status`; then (if an eligible membership was found) logs `"AvailabilityReconciler: cleared availability for membership ..."` and prints `Eligible member's status cleared: true`; then (if an ineligible membership was found) prints `Ineligible member's status left untouched: true` with no clear-log line for that membership. Delete `/tmp/availability-reconciler-smoke.ts` after running. **Do not run this against a community you care about** — it mutates real `CommunityMembership` rows as part of the test; use a disposable test community, and re-verify the two skip messages don't both fire (you need at least one linked and, ideally, one unlinked member to exercise scenarios 2 and 3 — an unlinked member can be left as email-only via the normal invite flow).

- [ ] **Step 3: Typecheck**

Run: `cd api && npx tsc --noEmit --project tsconfig.typecheck.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add api/src/services/AvailabilityReconciler.ts
git commit -m "feat: add AvailabilityReconciler core reconciliation logic"
```

---

### Task 2: Debounced request-triggered reconcile

**Files:**
- Create: `api/src/services/AvailabilityReconcileTrigger.ts`
- Test: `api/src/services/__tests__/AvailabilityReconcileTrigger.test.ts`
- Modify: `api/src/controllers/CommunityController.ts`

**Interfaces:**
- Consumes: `reconcileAvailabilityFromEvault(communityId, payload)` from Task 1's `./AvailabilityReconciler`; `findEnvelopesByOntology(vaultEname, ontology, maxResults)` from `../lib/evault-client` (existing, returns `Array<{ id: string; parsed: Record<string, unknown> | null }>`); `ONTOLOGIES.Availability` from `../lib/w3ds/ontology` (existing, value `'fcdc28d2-f22e-469b-a2f0-dad6bf3dd152'`).
- Produces: `shouldReconcile(lastReconciledAtMs: number | undefined, nowMs: number, debounceMs?: number): boolean`, `triggerAvailabilityReconcile(communityId: string): Promise<void>`, `_resetForTests(): void` — all exported from `AvailabilityReconcileTrigger.ts`. This file duplicates the same 4-line `shouldReconcile` pattern `OrganizationReconcileTrigger.ts` already defines — not imported cross-file, each trigger file owns its own debounce logic and its own `Map` (see the design spec's "separate debounce, same call site" decision). Not consumed by later tasks in this plan, but wired directly into `CommunityController.getCommunityHandler` in this same task, alongside the existing `triggerOrganizationReconcile` call (not replacing it).

- [ ] **Step 1: Write the failing test for `shouldReconcile`**

```typescript
// api/src/services/__tests__/AvailabilityReconcileTrigger.test.ts
import { shouldReconcile } from "../AvailabilityReconcileTrigger";

describe("shouldReconcile", () => {
    it("returns true when there is no prior reconcile timestamp", () => {
        expect(shouldReconcile(undefined, 1_000_000)).toBe(true);
    });

    it("returns false when the debounce window has not elapsed", () => {
        expect(shouldReconcile(1_000_000, 1_030_000, 60_000)).toBe(false);
    });

    it("returns true once the debounce window has elapsed", () => {
        expect(shouldReconcile(1_000_000, 1_060_000, 60_000)).toBe(true);
    });

    it("defaults the debounce window to 60 seconds", () => {
        expect(shouldReconcile(1_000_000, 1_059_999)).toBe(false);
        expect(shouldReconcile(1_000_000, 1_060_000)).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx jest src/services/__tests__/AvailabilityReconcileTrigger.test.ts --watchman=false`
Expected: FAIL — `Cannot find module '../AvailabilityReconcileTrigger'`

- [ ] **Step 3: Write `AvailabilityReconcileTrigger.ts`**

```typescript
import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { findEnvelopesByOntology } from "../lib/evault-client";
import { logger } from "../lib/logger";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { AvailabilityEnvelopePayload } from "./availabilityPayload";
import { reconcileAvailabilityFromEvault } from "./AvailabilityReconciler";

const communityRepo = () => AppDataSource.getRepository(Community);

const lastReconciledAt = new Map<string, number>();

export function shouldReconcile(
    lastReconciledAtMs: number | undefined,
    nowMs: number,
    debounceMs = 60_000
): boolean {
    if (lastReconciledAtMs === undefined) return true;
    return nowMs - lastReconciledAtMs >= debounceMs;
}

export async function triggerAvailabilityReconcile(communityId: string): Promise<void> {
    const now = Date.now();
    if (!shouldReconcile(lastReconciledAt.get(communityId), now)) return;
    lastReconciledAt.set(communityId, now);

    const community = await communityRepo().findOne({ where: { id: communityId } });
    if (!community?.ename) return;

    const envelopes = await findEnvelopesByOntology(community.ename, ONTOLOGIES.Availability, 1);
    const payload = envelopes[0]?.parsed as unknown as AvailabilityEnvelopePayload | null;
    if (!payload) return;

    await reconcileAvailabilityFromEvault(communityId, payload);
}

// Test-only: clears the debounce map between test files so state doesn't leak.
export function _resetForTests(): void {
    lastReconciledAt.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npx jest src/services/__tests__/AvailabilityReconcileTrigger.test.ts --watchman=false`
Expected: PASS, 4/4 tests.

- [ ] **Step 5: Wire the trigger into `CommunityController.getCommunityHandler`, alongside the existing Organization trigger**

Modify `api/src/controllers/CommunityController.ts` — add this import near the existing `triggerOrganizationReconcile` import:

```typescript
import { triggerAvailabilityReconcile } from "../services/AvailabilityReconcileTrigger";
```

Then modify `getCommunityHandler` to fire both triggers (do not remove the existing `triggerOrganizationReconcile` call):

```typescript
export async function getCommunityHandler(req: Request, res: Response) {
    const community = await getCommunityFull(req.params.id);
    if (!community) { res.status(404).json({ error: "Community not found" }); return; }
    triggerOrganizationReconcile(req.params.id).catch((err) =>
        logger.warn(err, "OrganizationReconciler: request-triggered reconcile failed for community %s", req.params.id)
    );
    triggerAvailabilityReconcile(req.params.id).catch((err) =>
        logger.warn(err, "AvailabilityReconciler: request-triggered reconcile failed for community %s", req.params.id)
    );
    res.json(community);
}
```

- [ ] **Step 6: Run the full test suite**

Run: `cd api && npm test -- --watchman=false`
Expected: all suites pass, including the new `AvailabilityReconcileTrigger.test.ts`.

- [ ] **Step 7: Typecheck**

Run: `cd api && npx tsc --noEmit --project tsconfig.typecheck.json`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add api/src/services/AvailabilityReconcileTrigger.ts api/src/services/__tests__/AvailabilityReconcileTrigger.test.ts api/src/controllers/CommunityController.ts
git commit -m "feat: add debounced request-triggered Availability reconcile"
```

---

### Task 3: Packet handler + periodic sweep, wired at boot

**Files:**
- Modify: `api/src/lib/w3ds/registerOntologyHandlers.ts`
- Modify: `api/src/lib/w3ds/__tests__/registerOntologyHandlers.test.ts`
- Modify: `api/src/lib/w3ds/registerReconcilers.ts`

**Interfaces:**
- Consumes: `reconcileAvailabilityPacket(communityEname, payload)` from Task 1's `AvailabilityReconciler.ts`; needs a new export from that same file, `availabilityReconciliationSweep(): Promise<void>` (add it now — see Step 1 below, this is additive to Task 1's file); `registerPacketHandler(ontology, handler)` from `./packetDispatch` (existing); `registerReconciler(name, intervalMs, fn)` from `../../services/ReconciliationService` (existing). `index.ts` already calls `registerOntologyHandlers()` and `registerReconcilers()` in the right order at boot (wired by the prior plan) — this task does not touch `index.ts`.
- Produces: nothing consumed by later tasks — this is the final task.

- [ ] **Step 1: Add `availabilityReconciliationSweep` to `AvailabilityReconciler.ts`**

Append to `api/src/services/AvailabilityReconciler.ts` (after `reconcileAvailabilityPacket`):

```typescript
export async function availabilityReconciliationSweep(): Promise<void> {
    const communities = await communityRepo().find({ where: { provisioning_status: "linked" } });
    for (const community of communities) {
        if (!community.ename) continue;
        try {
            const envelopes = await findEnvelopesByOntology(community.ename, ONTOLOGIES.Availability, 1);
            const payload = envelopes[0]?.parsed as unknown as AvailabilityEnvelopePayload | null;
            if (!payload) continue;
            await reconcileAvailabilityFromEvault(community.id, payload);
        } catch (err) {
            logger.warn(err, "AvailabilityReconciler: sweep failed for community %s", community.id);
        }
    }
}
```

This needs two new imports at the top of `AvailabilityReconciler.ts`:

```typescript
import { findEnvelopesByOntology } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
```

- [ ] **Step 2: Add the packet-handler test case**

Modify `api/src/lib/w3ds/__tests__/registerOntologyHandlers.test.ts` — add the `AvailabilityReconciler` mock alongside the existing mocks, and two new test cases:

```typescript
import { ONTOLOGIES } from "../ontology";
import { getRegisteredOntologies, dispatchPacket, _resetForTests } from "../packetDispatch";

jest.mock("../../../services/PersonService", () => ({
    upsertFromWebhook: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../services/OrganizationReconciler", () => ({
    reconcileOrganizationPacket: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../services/AvailabilityReconciler", () => ({
    reconcileAvailabilityPacket: jest.fn().mockResolvedValue(undefined),
}));

import { upsertFromWebhook } from "../../../services/PersonService";
import { reconcileOrganizationPacket } from "../../../services/OrganizationReconciler";
import { reconcileAvailabilityPacket } from "../../../services/AvailabilityReconciler";
import { registerOntologyHandlers } from "../registerOntologyHandlers";

describe("registerOntologyHandlers", () => {
    beforeEach(() => {
        _resetForTests();
        jest.clearAllMocks();
    });

    it("registers a handler for ONTOLOGIES.User", () => {
        registerOntologyHandlers();

        expect(getRegisteredOntologies()).toContain(ONTOLOGIES.User);
    });

    it("routes User packets to upsertFromWebhook with the same arguments", async () => {
        registerOntologyHandlers();

        await dispatchPacket(ONTOLOGIES.User, "@w3id-1", "meta-1", { displayName: "Ada" });

        expect(upsertFromWebhook).toHaveBeenCalledWith("@w3id-1", "meta-1", { displayName: "Ada" });
    });

    it("registers a handler for ONTOLOGIES.Organization", () => {
        registerOntologyHandlers();

        expect(getRegisteredOntologies()).toContain(ONTOLOGIES.Organization);
    });

    it("routes Organization packets to reconcileOrganizationPacket with ename and data", async () => {
        registerOntologyHandlers();

        await dispatchPacket(ONTOLOGIES.Organization, "@community-ename", "meta-2", { name: "Test Community" });

        expect(reconcileOrganizationPacket).toHaveBeenCalledWith("@community-ename", { name: "Test Community" });
    });

    it("registers a handler for ONTOLOGIES.Availability", () => {
        registerOntologyHandlers();

        expect(getRegisteredOntologies()).toContain(ONTOLOGIES.Availability);
    });

    it("routes Availability packets to reconcileAvailabilityPacket with ename and data", async () => {
        registerOntologyHandlers();

        await dispatchPacket(ONTOLOGIES.Availability, "@community-ename", "meta-3", { statuses: [], entries: [] });

        expect(reconcileAvailabilityPacket).toHaveBeenCalledWith("@community-ename", { statuses: [], entries: [] });
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd api && npx jest src/lib/w3ds/__tests__/registerOntologyHandlers.test.ts --watchman=false`
Expected: FAIL — `ONTOLOGIES.Availability` handler not registered yet (`getRegisteredOntologies()` does not contain it).

- [ ] **Step 4: Wire the packet handler in `registerOntologyHandlers.ts`**

```typescript
import { registerPacketHandler } from "./packetDispatch";
import { ONTOLOGIES } from "./ontology";
import { upsertFromWebhook } from "../../services/PersonService";
import { reconcileOrganizationPacket } from "../../services/OrganizationReconciler";
import { reconcileAvailabilityPacket } from "../../services/AvailabilityReconciler";

// Called once at startup. Every ontology CORE needs to read back from eVault
// (via webhook or AaaS poll) gets one line here — see packetDispatch.ts.
export function registerOntologyHandlers(): void {
    registerPacketHandler(ONTOLOGIES.User, async (w3id, metaEnvelopeId, data) => {
        await upsertFromWebhook(w3id, metaEnvelopeId, data);
    });

    registerPacketHandler(ONTOLOGIES.Organization, async (w3id, _metaEnvelopeId, data) => {
        await reconcileOrganizationPacket(w3id, data as unknown as import("../../services/organizationPayload").OrganizationEnvelopePayload);
    });

    registerPacketHandler(ONTOLOGIES.Availability, async (w3id, _metaEnvelopeId, data) => {
        await reconcileAvailabilityPacket(w3id, data as unknown as import("../../services/availabilityPayload").AvailabilityEnvelopePayload);
    });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd api && npx jest src/lib/w3ds/__tests__/registerOntologyHandlers.test.ts --watchman=false`
Expected: PASS, 6/6 tests.

- [ ] **Step 6: Add the sweep registration to `registerReconcilers.ts`**

```typescript
// api/src/lib/w3ds/registerReconcilers.ts
import { registerReconciler } from "../../services/ReconciliationService";
import { organizationReconciliationSweep } from "../../services/OrganizationReconciler";
import { availabilityReconciliationSweep } from "../../services/AvailabilityReconciler";

// Called once at startup, alongside registerOntologyHandlers() and before
// startReconciliation() — every entity that cuts its cache over to
// eVault-backed reconciliation gets one line here.
export function registerReconcilers(): void {
    registerReconciler("organization", 60 * 60_000, organizationReconciliationSweep);
    registerReconciler("availability", 60 * 60_000, availabilityReconciliationSweep);
}
```

- [ ] **Step 7: Run the full test suite**

Run: `cd api && npm test -- --watchman=false`
Expected: all suites pass.

- [ ] **Step 8: Typecheck**

Run: `cd api && npx tsc --noEmit --project tsconfig.typecheck.json`
Expected: no errors.

- [ ] **Step 9: Manual smoke test — server boots with the new wiring**

```bash
cd api && PORT=3099 npx ts-node src/index.ts &
sleep 3
curl http://localhost:3099/api/health
kill %1
```

Expected: `{"status":"ok","db":"connected"}`, no crash or unhandled rejection in the startup logs (confirms `registerReconcilers()` → `registerReconciler("availability", ...)` → `startReconciliation()` wiring doesn't throw).

- [ ] **Step 10: Commit**

```bash
git add api/src/services/AvailabilityReconciler.ts api/src/lib/w3ds/registerOntologyHandlers.ts api/src/lib/w3ds/__tests__/registerOntologyHandlers.test.ts api/src/lib/w3ds/registerReconcilers.ts
git commit -m "feat: wire Availability packet handler and hourly reconciliation sweep"
```
