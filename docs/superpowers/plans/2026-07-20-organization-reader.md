# OrganizationReader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give CORE its first read-back path for the `Organization` ontology — reconcile eVault's envelope back into Postgres (`Community` scalars, `OrganizationMembershipType` rows, `CommunityMembership` roster/admin flags) via three triggers: an AaaS/webhook packet handler, a debounced request-triggered reconcile on community page load, and an hourly safety-net sweep.

**Architecture:** One shared function, `reconcileOrganizationFromEvault(communityId, payload)` in a new `OrganizationReconciler.ts`, fed by three independent call sites. A separate `OrganizationReconcileTrigger.ts` holds the debounced request-triggered wrapper. `registerOntologyHandlers.ts` and a new `registerReconcilers.ts` wire the other two triggers at boot, called together in `index.ts` (resolving the prior plan's carried-forward finding that reconciler registration lacked boot-hook symmetry with packet handlers).

**Tech Stack:** TypeORM (Postgres), Express, Jest.

## Global Constraints

- eVault is always the source of truth; on any conflict, eVault wins and Postgres is corrected, never the reverse.
- Every reconcile call site is fire-and-forget, `.catch(err => logger.warn(err, ...))` — never throws past its caller.
- Structural drift (a row created or deleted, not just a field updated) is logged at warn level even though it's auto-corrected — cache correction must be loud, never silent.
- `chatId` in the `Organization` envelope is explicitly ignored by this reconciliation — owned by `ChatService`'s own write path.
- No changes to the write path (`OrganizationService.ts` / `organizationPayload.ts` stay untouched).
- No dedicated automated test file for `OrganizationReconciler.ts`'s core DB logic — matches this repo's existing convention that every test either covers a pure function or mocks the DB-touching dependency away; verified instead via typecheck + a manual smoke-test sequence.
- Request-triggered reconcile is debounced to at most once per 60 seconds per community (in-memory, process-local map — resets on restart, which is fine).
- Periodic sweep runs hourly (`60 * 60_000` ms), registered via `registerReconciler("organization", ...)` — must be called before `startReconciliation()` in `index.ts`, matching the existing symmetry with `registerOntologyHandlers()`.

---

### Task 1: Core reconciliation logic

**Files:**
- Create: `api/src/services/OrganizationReconciler.ts`

**Interfaces:**
- Consumes: `OrganizationEnvelopePayload`, `OrganizationPayloadMember` from `./organizationPayload` (already exist — `OrganizationEnvelopePayload` has `name: string | null`, `chatId: string | null`, `legalInfo: { legalForm?, officialName?, kvkNumber?, rsin?, iban?, registeredAddress?, foundingDate?, statutenFileUri? }`, `branding: { logoUrl: string|null, photoUrl: string|null, primaryColor: string, titleFont: string }`, `membershipTypes: { id, name, description?, emoji: string|null }[]`, `members: OrganizationPayloadMember[]` (`{ participantId, eName, dateJoined: string|null, membershipTypeId: string|null }`), `admins: string[]`).
- Produces: `reconcileOrganizationFromEvault(communityId: string, payload: OrganizationEnvelopePayload): Promise<void>` and `reconcileOrganizationPacket(communityEname: string, payload: OrganizationEnvelopePayload): Promise<void>`. `reconcileOrganizationFromEvault` is also consumed directly by Task 2's trigger and by Task 3's `organizationReconciliationSweep` — Task 3 Step 1 appends `organizationReconciliationSweep` to this same file; it is NOT part of Task 1's deliverable.

- [ ] **Step 1: Write `OrganizationReconciler.ts`**

```typescript
import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { OrganizationMembershipType } from "../database/entities/OrganizationMembershipType";
import { Person } from "../database/entities/Person";
import { logger } from "../lib/logger";
import { OrganizationEnvelopePayload, OrganizationPayloadMember } from "./organizationPayload";

const communityRepo = () => AppDataSource.getRepository(Community);
const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const membershipTypeRepo = () => AppDataSource.getRepository(OrganizationMembershipType);
const personRepo = () => AppDataSource.getRepository(Person);

async function reconcileScalars(communityId: string, payload: OrganizationEnvelopePayload): Promise<void> {
    try {
        const community = await communityRepo().findOne({ where: { id: communityId } });
        if (!community) return;

        const legalForm = payload.legalInfo.legalForm ?? null;
        const officialName = payload.legalInfo.officialName ?? null;
        const kvkNumber = payload.legalInfo.kvkNumber ?? null;
        const rsin = payload.legalInfo.rsin ?? null;
        const iban = payload.legalInfo.iban ?? null;
        const registeredAddress = payload.legalInfo.registeredAddress ?? null;
        const foundingDate = payload.legalInfo.foundingDate ?? null;
        const statutenFileUri = payload.legalInfo.statutenFileUri ?? null;

        const updates: Record<string, unknown> = {};
        if (payload.name !== null && payload.name !== community.name) updates.name = payload.name;
        if (legalForm !== community.legal_form) updates.legal_form = legalForm;
        if (officialName !== community.official_name) updates.official_name = officialName;
        if (kvkNumber !== community.kvk_number) updates.kvk_number = kvkNumber;
        if (rsin !== community.rsin) updates.rsin = rsin;
        if (iban !== community.iban) updates.iban = iban;
        if (registeredAddress !== community.registered_address) updates.registered_address = registeredAddress;
        // Community.founding_date deserializes to a plain 'YYYY-MM-DD' string at runtime
        // (TypeORM "date" column), so this string-to-string compare is correct despite the
        // Date|null type annotation — same quirk documented in OrganizationService.ts.
        if (foundingDate !== (community.founding_date as unknown as string | null)) {
            updates.founding_date = foundingDate;
        }
        if (statutenFileUri !== community.statuten_file_uri) updates.statuten_file_uri = statutenFileUri;
        if (payload.branding.logoUrl !== community.logo_url) updates.logo_url = payload.branding.logoUrl;
        if (payload.branding.photoUrl !== community.photo_url) updates.photo_url = payload.branding.photoUrl;
        if (payload.branding.primaryColor !== community.primary_color) updates.primary_color = payload.branding.primaryColor;
        if (payload.branding.titleFont !== community.title_font) updates.title_font = payload.branding.titleFont;

        if (Object.keys(updates).length > 0) {
            await communityRepo().update(communityId, updates);
        }
    } catch (err) {
        logger.warn(err, "OrganizationReconciler: scalar reconcile failed for community %s", communityId);
    }
}

async function reconcileMembershipTypes(
    communityId: string,
    envelopeTypes: OrganizationEnvelopePayload["membershipTypes"]
): Promise<void> {
    const repo = membershipTypeRepo();
    const localTypes = await repo.find({ where: { community_id: communityId } });
    const localById = new Map(localTypes.map((t) => [t.id, t]));
    const envelopeIds = new Set(envelopeTypes.map((t) => t.id));

    for (const et of envelopeTypes) {
        try {
            const description = et.description ?? null;
            const local = localById.get(et.id);
            if (!local) {
                const maxSortOrder = localTypes.reduce((max, t) => Math.max(max, t.sort_order), -1);
                await repo.save(
                    repo.create({
                        id: et.id,
                        community_id: communityId,
                        name: et.name,
                        description,
                        emoji: et.emoji,
                        sort_order: maxSortOrder + 1,
                    })
                );
                logger.warn(
                    "OrganizationReconciler: resurrected membership type %s for community %s (present in eVault, missing locally)",
                    et.id,
                    communityId
                );
            } else if (local.name !== et.name || local.description !== description || local.emoji !== et.emoji) {
                await repo.update(local.id, { name: et.name, description, emoji: et.emoji });
            }
        } catch (err) {
            logger.warn(err, "OrganizationReconciler: membership type reconcile failed for %s", et.id);
        }
    }

    for (const local of localTypes) {
        if (envelopeIds.has(local.id)) continue;
        try {
            await repo.delete(local.id);
            logger.warn(
                "OrganizationReconciler: deleted membership type %s for community %s (absent from eVault)",
                local.id,
                communityId
            );
        } catch (err) {
            logger.warn(err, "OrganizationReconciler: membership type delete failed for %s", local.id);
        }
    }
}

async function reconcileRoster(
    communityId: string,
    members: OrganizationPayloadMember[],
    admins: string[]
): Promise<void> {
    const cmRepo = membershipRepo();
    const localMemberships = await cmRepo.find({ where: { community_id: communityId } });
    const localByPersonId = new Map(localMemberships.map((m) => [m.person_id, m]));
    const adminSet = new Set(admins);
    const matchedPersonIds = new Set<string>();

    for (const member of members) {
        try {
            const person = await personRepo().findOne({ where: { ename: member.eName } });
            if (!person) continue;
            matchedPersonIds.add(person.id);

            const isAdmin = adminSet.has(member.participantId);
            const local = localByPersonId.get(person.id);

            if (!local) {
                await cmRepo.save(
                    cmRepo.create({
                        community_id: communityId,
                        person_id: person.id,
                        membership_type_id: member.membershipTypeId,
                        joined_at: member.dateJoined as unknown as Date | null,
                        is_admin: isAdmin,
                    })
                );
                logger.warn(
                    "OrganizationReconciler: created membership for person %s in community %s (present in eVault, missing locally)",
                    person.id,
                    communityId
                );
            } else if (
                local.membership_type_id !== member.membershipTypeId ||
                (local.joined_at as unknown as string | null) !== member.dateJoined ||
                local.is_admin !== isAdmin
            ) {
                await cmRepo.update(local.id, {
                    membership_type_id: member.membershipTypeId,
                    joined_at: member.dateJoined as unknown as Date | null,
                    is_admin: isAdmin,
                });
            }
        } catch (err) {
            logger.warn(err, "OrganizationReconciler: roster reconcile failed for %s", member.eName);
        }
    }

    for (const local of localMemberships) {
        if (matchedPersonIds.has(local.person_id)) continue;
        try {
            await cmRepo.delete(local.id);
            logger.warn(
                "OrganizationReconciler: deleted membership %s for community %s (absent from eVault roster)",
                local.id,
                communityId
            );
        } catch (err) {
            logger.warn(err, "OrganizationReconciler: membership delete failed for %s", local.id);
        }
    }
}

export async function reconcileOrganizationFromEvault(
    communityId: string,
    payload: OrganizationEnvelopePayload
): Promise<void> {
    await reconcileScalars(communityId, payload);
    await reconcileMembershipTypes(communityId, payload.membershipTypes);
    await reconcileRoster(communityId, payload.members, payload.admins);
}

export async function reconcileOrganizationPacket(
    communityEname: string,
    payload: OrganizationEnvelopePayload
): Promise<void> {
    const community = await communityRepo().findOne({ where: { ename: communityEname } });
    if (!community) {
        logger.warn("OrganizationReconciler: no local community found for ename %s", communityEname);
        return;
    }
    await reconcileOrganizationFromEvault(community.id, payload);
}
```

- [ ] **Step 2: Manual verification (no automated test file for this task — matches repo convention for DB-touching reconciliation logic)**

Run a one-off script against your local dev Postgres to verify the create/update/delete paths, since this logic has no automated test:

```bash
cd api && cat > /tmp/reconciler-smoke.ts <<'EOF'
import { AppDataSource } from "./src/database/data-source";
import { reconcileOrganizationFromEvault } from "./src/services/OrganizationReconciler";
import { Community } from "./src/database/entities/Community";
import { OrganizationMembershipType } from "./src/database/entities/OrganizationMembershipType";
import { CommunityMembership } from "./src/database/entities/CommunityMembership";

async function main() {
    await AppDataSource.initialize();
    const communityRepo = AppDataSource.getRepository(Community);
    const typeRepo = AppDataSource.getRepository(OrganizationMembershipType);

    const community = await communityRepo().findOne({ where: {} }); // pick any existing test community
    if (!community) { console.log("No community found — create one first via the app UI."); return; }

    // Fabricate a payload with a membership-type id that does NOT exist locally.
    const fakeTypeId = "11111111-1111-1111-1111-111111111111";
    await reconcileOrganizationFromEvault(community.id, {
        name: community.name,
        chatId: null,
        legalInfo: {},
        branding: { logoUrl: null, photoUrl: null, primaryColor: "#000000", titleFont: "Arial" },
        membershipTypes: [{ id: fakeTypeId, name: "Resurrected Type", emoji: "🎉" }],
        members: [],
        admins: [],
    });

    const resurrected = await typeRepo.findOne({ where: { id: fakeTypeId } });
    console.log("Resurrected type present:", !!resurrected, resurrected?.name);

    // Clean up.
    if (resurrected) await typeRepo.delete(fakeTypeId);

    // Second scenario: a roster member present locally but absent from the
    // envelope's roster must be deleted.
    const membershipRepo = AppDataSource.getRepository(CommunityMembership);
    const existingMembership = await membershipRepo.findOne({ where: { community_id: community.id } });
    if (existingMembership) {
        await reconcileOrganizationFromEvault(community.id, {
            name: community.name,
            chatId: null,
            legalInfo: {},
            branding: { logoUrl: null, photoUrl: null, primaryColor: "#000000", titleFont: "Arial" },
            membershipTypes: [],
            members: [], // empty roster — the existing local membership is absent
            admins: [],
        });
        const stillThere = await membershipRepo.findOne({ where: { id: existingMembership.id } });
        console.log("Membership deleted after roster reconcile:", !stillThere);
    } else {
        console.log("No existing membership on this community — skipped roster-deletion scenario. Create one via the app UI to exercise it.");
    }

    process.exit(0);
}

main();
EOF
npx ts-node /tmp/reconciler-smoke.ts
```

Expected: logs a warning `"OrganizationReconciler: resurrected membership type ..."`, then prints `Resurrected type present: true Resurrected Type`; then logs a warning `"OrganizationReconciler: deleted membership ..."`, then prints `Membership deleted after roster reconcile: true`. Delete `/tmp/reconciler-smoke.ts` after running. **Do not run this against a community you care about** — it deletes a real membership row as part of the test; use a disposable test community.

- [ ] **Step 3: Typecheck**

Run: `cd api && npx tsc --noEmit --project tsconfig.typecheck.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add api/src/services/OrganizationReconciler.ts
git commit -m "feat: add OrganizationReconciler core reconciliation logic"
```

---

### Task 2: Debounced request-triggered reconcile

**Files:**
- Create: `api/src/services/OrganizationReconcileTrigger.ts`
- Test: `api/src/services/__tests__/OrganizationReconcileTrigger.test.ts`
- Modify: `api/src/controllers/CommunityController.ts`

**Interfaces:**
- Consumes: `reconcileOrganizationFromEvault(communityId, payload)` from Task 1's `./OrganizationReconciler`; `findEnvelopesByOntology(vaultEname, ontology, maxResults)` from `../lib/evault-client` (existing, returns `Array<{ id: string; parsed: Record<string, unknown> | null }>`); `ONTOLOGIES.Organization` from `../lib/w3ds/ontology` (existing).
- Produces: `shouldReconcile(lastReconciledAtMs: number | undefined, nowMs: number, debounceMs?: number): boolean`, `triggerOrganizationReconcile(communityId: string): Promise<void>`, `_resetForTests(): void` — all exported from `OrganizationReconcileTrigger.ts`. Not consumed by later tasks in this plan, but wired directly into `CommunityController.getCommunityHandler` in this same task.

- [ ] **Step 1: Write the failing test for `shouldReconcile`**

```typescript
// api/src/services/__tests__/OrganizationReconcileTrigger.test.ts
import { shouldReconcile } from "../OrganizationReconcileTrigger";

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

Run: `cd api && npx jest src/services/__tests__/OrganizationReconcileTrigger.test.ts --watchman=false`
Expected: FAIL — `Cannot find module '../OrganizationReconcileTrigger'`

- [ ] **Step 3: Write `OrganizationReconcileTrigger.ts`**

```typescript
import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { findEnvelopesByOntology } from "../lib/evault-client";
import { logger } from "../lib/logger";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { OrganizationEnvelopePayload } from "./organizationPayload";
import { reconcileOrganizationFromEvault } from "./OrganizationReconciler";

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

export async function triggerOrganizationReconcile(communityId: string): Promise<void> {
    const now = Date.now();
    if (!shouldReconcile(lastReconciledAt.get(communityId), now)) return;
    lastReconciledAt.set(communityId, now);

    const community = await communityRepo().findOne({ where: { id: communityId } });
    if (!community?.ename) return;

    const envelopes = await findEnvelopesByOntology(community.ename, ONTOLOGIES.Organization, 1);
    const payload = envelopes[0]?.parsed as OrganizationEnvelopePayload | null;
    if (!payload) return;

    await reconcileOrganizationFromEvault(communityId, payload);
}

// Test-only: clears the debounce map between test files so state doesn't leak.
export function _resetForTests(): void {
    lastReconciledAt.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npx jest src/services/__tests__/OrganizationReconcileTrigger.test.ts --watchman=false`
Expected: PASS, 4/4 tests.

- [ ] **Step 5: Wire the trigger into `CommunityController.getCommunityHandler`**

Modify `api/src/controllers/CommunityController.ts` — add these two imports near the top (after the existing `uploadFile` import):

```typescript
import { logger } from "../lib/logger";
import { triggerOrganizationReconcile } from "../services/OrganizationReconcileTrigger";
```

Then modify `getCommunityHandler`:

```typescript
export async function getCommunityHandler(req: Request, res: Response) {
    const community = await getCommunityFull(req.params.id);
    if (!community) { res.status(404).json({ error: "Community not found" }); return; }
    triggerOrganizationReconcile(req.params.id).catch((err) =>
        logger.warn(err, "OrganizationReconciler: request-triggered reconcile failed for community %s", req.params.id)
    );
    res.json(community);
}
```

- [ ] **Step 6: Run the full test suite**

Run: `cd api && npm test -- --watchman=false`
Expected: all suites pass, including the new `OrganizationReconcileTrigger.test.ts`.

- [ ] **Step 7: Typecheck**

Run: `cd api && npx tsc --noEmit --project tsconfig.typecheck.json`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add api/src/services/OrganizationReconcileTrigger.ts api/src/services/__tests__/OrganizationReconcileTrigger.test.ts api/src/controllers/CommunityController.ts
git commit -m "feat: add debounced request-triggered Organization reconcile"
```

---

### Task 3: Packet handler + periodic sweep, wired at boot

**Files:**
- Create: `api/src/lib/w3ds/registerReconcilers.ts`
- Modify: `api/src/lib/w3ds/registerOntologyHandlers.ts`
- Modify: `api/src/lib/w3ds/__tests__/registerOntologyHandlers.test.ts`
- Modify: `api/src/index.ts`

**Interfaces:**
- Consumes: `reconcileOrganizationPacket(communityEname, payload)` from Task 1's `OrganizationReconciler.ts`; needs a new export from that same file, `organizationReconciliationSweep(): Promise<void>` (add it now — see Step 1 below, this is additive to Task 1's file); `registerPacketHandler(ontology, handler)` from `./packetDispatch` (existing); `registerReconciler(name, intervalMs, fn)` from `../../services/ReconciliationService` (existing).
- Produces: nothing consumed by later tasks — this is the final task.

- [ ] **Step 1: Add `organizationReconciliationSweep` to `OrganizationReconciler.ts`**

Append to `api/src/services/OrganizationReconciler.ts` (after `reconcileOrganizationPacket`):

```typescript
export async function organizationReconciliationSweep(): Promise<void> {
    const communities = await communityRepo().find({ where: { provisioning_status: "linked" } });
    for (const community of communities) {
        if (!community.ename) continue;
        try {
            const envelopes = await findEnvelopesByOntology(community.ename, ONTOLOGIES.Organization, 1);
            const payload = envelopes[0]?.parsed as OrganizationEnvelopePayload | null;
            if (!payload) continue;
            await reconcileOrganizationFromEvault(community.id, payload);
        } catch (err) {
            logger.warn(err, "OrganizationReconciler: sweep failed for community %s", community.id);
        }
    }
}
```

This needs two new imports at the top of `OrganizationReconciler.ts`:

```typescript
import { findEnvelopesByOntology } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
```

- [ ] **Step 2: Add the packet-handler test case**

Modify `api/src/lib/w3ds/__tests__/registerOntologyHandlers.test.ts` — add the `OrganizationReconciler` mock alongside the existing `PersonService` mock, and a new `describe` block:

```typescript
import { ONTOLOGIES } from "../ontology";
import { getRegisteredOntologies, dispatchPacket, _resetForTests } from "../packetDispatch";

jest.mock("../../../services/PersonService", () => ({
    upsertFromWebhook: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../services/OrganizationReconciler", () => ({
    reconcileOrganizationPacket: jest.fn().mockResolvedValue(undefined),
}));

import { upsertFromWebhook } from "../../../services/PersonService";
import { reconcileOrganizationPacket } from "../../../services/OrganizationReconciler";
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
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd api && npx jest src/lib/w3ds/__tests__/registerOntologyHandlers.test.ts --watchman=false`
Expected: FAIL — `ONTOLOGIES.Organization` handler not registered yet (`getRegisteredOntologies()` does not contain it).

- [ ] **Step 4: Wire the packet handler in `registerOntologyHandlers.ts`**

```typescript
import { registerPacketHandler } from "./packetDispatch";
import { ONTOLOGIES } from "./ontology";
import { upsertFromWebhook } from "../../services/PersonService";
import { reconcileOrganizationPacket } from "../../services/OrganizationReconciler";

// Called once at startup. Every ontology CORE needs to read back from eVault
// (via webhook or AaaS poll) gets one line here — see packetDispatch.ts.
export function registerOntologyHandlers(): void {
    registerPacketHandler(ONTOLOGIES.User, async (w3id, metaEnvelopeId, data) => {
        await upsertFromWebhook(w3id, metaEnvelopeId, data);
    });

    registerPacketHandler(ONTOLOGIES.Organization, async (w3id, _metaEnvelopeId, data) => {
        await reconcileOrganizationPacket(w3id, data as unknown as import("../../services/organizationPayload").OrganizationEnvelopePayload);
    });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd api && npx jest src/lib/w3ds/__tests__/registerOntologyHandlers.test.ts --watchman=false`
Expected: PASS, 4/4 tests.

- [ ] **Step 6: Create `registerReconcilers.ts`**

```typescript
// api/src/lib/w3ds/registerReconcilers.ts
import { registerReconciler } from "../../services/ReconciliationService";
import { organizationReconciliationSweep } from "../../services/OrganizationReconciler";

// Called once at startup, alongside registerOntologyHandlers() and before
// startReconciliation() — every entity that cuts its cache over to
// eVault-backed reconciliation gets one line here.
export function registerReconcilers(): void {
    registerReconciler("organization", 60 * 60_000, organizationReconciliationSweep);
}
```

- [ ] **Step 7: Wire `registerReconcilers()` into `index.ts`**

Modify `api/src/index.ts` — add the import near the other two registration imports:

```typescript
import { registerReconcilers } from "./lib/w3ds/registerReconcilers";
```

Then modify the boot sequence (must run before `startReconciliation()`, matching the existing `registerOntologyHandlers()` boot-hook symmetry):

```typescript
AppDataSource.initialize()
    .then(() => {
        registerOntologyHandlers();
        registerReconcilers();
        app.listen(port, () => logger.info(`CORE API running on :${port}`));
        startPolling();
        startReconciliation();
    })
    .catch((err) => {
        logger.error(err, "DB init failed");
        process.exit(1);
    });
```

- [ ] **Step 8: Run the full test suite**

Run: `cd api && npm test -- --watchman=false`
Expected: all suites pass.

- [ ] **Step 9: Typecheck**

Run: `cd api && npx tsc --noEmit --project tsconfig.typecheck.json`
Expected: no errors.

- [ ] **Step 10: Manual smoke test — server boots with the new wiring**

```bash
cd api && PORT=3099 npx ts-node src/index.ts &
sleep 3
curl http://localhost:3099/api/health
kill %1
```

Expected: `{"status":"ok","db":"connected"}`, no crash or unhandled rejection in the startup logs (confirms `registerReconcilers()` → `registerReconciler("organization", ...)` → `startReconciliation()` wiring doesn't throw).

- [ ] **Step 11: Commit**

```bash
git add api/src/services/OrganizationReconciler.ts api/src/lib/w3ds/registerOntologyHandlers.ts api/src/lib/w3ds/__tests__/registerOntologyHandlers.test.ts api/src/lib/w3ds/registerReconcilers.ts api/src/index.ts
git commit -m "feat: wire Organization packet handler and hourly reconciliation sweep"
```
