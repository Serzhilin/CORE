# MembershipReader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give CORE its third read-back path — consume the `Membership` ontology (today write-only, one minimal envelope per `CommunityMembership` row, written into the **member's own vault**) so that a community a person joined through any other W3DS platform appears in CORE automatically, with no manual admin linking step.

**Architecture:** One new file, `MembershipReconciler.ts`, exporting a single entry point `reconcileMembershipsForPerson(personId)`. Unlike `OrganizationReader`/`AvailabilityReader`, there is only one trigger — a debounced, person-keyed request trigger fired from `AuthController.ts`'s `epassportLogin` and `getMe` — no packet handler, no periodic sweep (see `docs/superpowers/specs/2026-07-21-membership-reader-design.md`'s Architecture section for why: this ontology's only consumer is the person's own session, so there's no "someone else is viewing this and needs it fresh" case for a packet/sweep to protect). Forward direction: for each Membership envelope in the person's vault, ensure a local `Community` row exists (bootstrapping a minimal stub via a **read-only** path if the community is unknown to CORE — deliberately not reusing `createCommunityFromEname`, which writes an empty Organization envelope back and would corrupt a foreign community's real roster data), then delegate all `CommunityMembership` creation/update to the already-shipped `reconcileOrganizationFromEvault`. Reverse direction: self-heal a local membership whose own outbound Membership envelope never got written.

**Tech Stack:** TypeORM (Postgres), Express, Jest.

## Global Constraints

- eVault is always the source of truth; on any conflict, eVault wins and Postgres is corrected, never the reverse.
- `MembershipReconciler.ts` never creates, updates, or deletes a `CommunityMembership` row directly. All roster mechanics are delegated to `reconcileOrganizationFromEvault` (from `OrganizationReconciler.ts`) — the single authority for that table, avoiding two reconcilers racing to decide the same row's fate off two different envelopes.
- No packet handler, no periodic sweep for this ontology — single debounced request trigger only, keyed by `personId` (not `communityId`).
- The eligibility gate for reading a person's own vault is `person.ename && person.meta_envelope_id` — same cached-value gate `OrganizationReconciler.ts`/`AvailabilityReconciler.ts` already use.
- Foreign-community bootstrap never calls `syncOrganizationToEvault` — that write path is exclusive to the human-driven `createCommunityFromEname` admin flow (`CommunityService.ts:407`) and must never run automatically from a background reconcile, since it would overwrite a foreign community's real Organization envelope with CORE's empty defaults.
- Every reconcile call site is fire-and-forget, `.catch(err => logger.warn(err, ...))` — never throws past its caller.
- Structural drift this reconciler causes (a bootstrapped community stub, a repaired missing envelope) is logged at `warn` level even though it's auto-corrected — cache correction must be loud, never silent.
- No changes to the write path — `MembershipEnvelopeService.ts` / `membershipPayload.ts` stay untouched; `createMembershipEnvelope` / `deleteMembershipEnvelope` are reused as-is.
- No dedicated automated test file for `MembershipReconciler.ts`'s core DB-touching logic — matches this repo's existing convention (no test file touches `AppDataSource`); verified instead via typecheck + a manual smoke-test sequence. `slugify()` is pure and gets real automated unit tests.
- Request-triggered reconcile is debounced to at most once per 60 seconds per person, via its own in-memory process-local map (resets on restart, which is fine) — separate `Map` from every other trigger file in this codebase.

---

### Task 1: Core reconciliation logic

**Files:**
- Create: `api/src/lib/slugify.ts`
- Test: `api/src/lib/__tests__/slugify.test.ts`
- Create: `api/src/services/MembershipReconciler.ts`
- Modify: `api/src/services/CommunityService.ts:22` (export `DEFAULT_AVAILABILITY_TYPES`)

**Interfaces:**
- Consumes: `MembershipEnvelopePayload` from `./membershipPayload` (existing — `{ v: 1; communityEname: string; joinedAt: string }`); `OrganizationEnvelopePayload` from `./organizationPayload` (existing); `reconcileOrganizationFromEvault(communityId: string, payload: OrganizationEnvelopePayload): Promise<void>` from `./OrganizationReconciler` (existing, unmodified); `resolveEnameForNewCommunity(w3id: string): Promise<EnameGroupPreview>` from `./CommunityService` (existing, unmodified — `EnameGroupPreview` is `{ evault_uri: string; w3id: string; envelopeId: string; envelope: { name: string; logo_url: string | null; description: string | null } }`); `createMembershipEnvelope(membershipId: string): Promise<void>` from `./MembershipEnvelopeService` (existing, unmodified, already idempotent); `findEnvelopesByOntology(vaultEname, ontology, maxResults)` from `../lib/evault-client` (existing); `ONTOLOGIES.Membership` / `ONTOLOGIES.Organization` from `../lib/w3ds/ontology` (existing).
- Produces: `slugify(name: string): string` from `../lib/slugify.ts`. `reconcileMembershipsForPerson(personId: string): Promise<void>` from `MembershipReconciler.ts` — consumed directly by Task 2's trigger. `DEFAULT_AVAILABILITY_TYPES` becomes an exported value from `CommunityService.ts` (was already defined there, just not exported) — consumed by `MembershipReconciler.ts`'s stub-bootstrap path.

- [ ] **Step 1: Write the failing test for `slugify`**

```typescript
// api/src/lib/__tests__/slugify.test.ts
import { slugify } from "../slugify";

describe("slugify", () => {
    it("lowercases and hyphenates a normal name", () => {
        expect(slugify("De Woonwolk")).toBe("de-woonwolk");
    });

    it("strips diacritics", () => {
        expect(slugify("Café Society")).toBe("cafe-society");
    });

    it("collapses non-alphanumeric runs into a single hyphen", () => {
        expect(slugify("Foo & Bar!!  Baz")).toBe("foo-bar-baz");
    });

    it("trims leading and trailing hyphens", () => {
        expect(slugify("--Community--")).toBe("community");
    });

    it("falls back to 'community' when nothing alphanumeric remains", () => {
        expect(slugify("!!!")).toBe("community");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx jest src/lib/__tests__/slugify.test.ts --watchman=false`
Expected: FAIL — `Cannot find module '../slugify'`

- [ ] **Step 3: Write `slugify.ts`**

```typescript
// api/src/lib/slugify.ts

// Normalizes a display name into a URL-safe Community.slug candidate. Diacritics are
// stripped (not transliterated) — "Café" -> "cafe", not "caf-e". Never returns an empty
// string, so it's always safe to use directly or with a numeric dedup suffix appended.
export function slugify(name: string): string {
    const slug = name
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug || "community";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npx jest src/lib/__tests__/slugify.test.ts --watchman=false`
Expected: PASS, 5/5 tests.

- [ ] **Step 5: Export `DEFAULT_AVAILABILITY_TYPES` from `CommunityService.ts`**

In `api/src/services/CommunityService.ts:22`, change:

```typescript
const DEFAULT_AVAILABILITY_TYPES = [
```

to:

```typescript
export const DEFAULT_AVAILABILITY_TYPES = [
```

No other line in that file changes.

- [ ] **Step 6: Write `MembershipReconciler.ts`**

```typescript
import { In } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { AvailabilityType } from "../database/entities/AvailabilityType";
import { Person } from "../database/entities/Person";
import { logger } from "../lib/logger";
import { findEnvelopesByOntology } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { slugify } from "../lib/slugify";
import { MembershipEnvelopePayload } from "./membershipPayload";
import { OrganizationEnvelopePayload } from "./organizationPayload";
import { reconcileOrganizationFromEvault } from "./OrganizationReconciler";
import { resolveEnameForNewCommunity, DEFAULT_AVAILABILITY_TYPES } from "./CommunityService";
import { createMembershipEnvelope } from "./MembershipEnvelopeService";

const communityRepo = () => AppDataSource.getRepository(Community);
const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const personRepo = () => AppDataSource.getRepository(Person);

async function generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let suffix = 2;
    while (await communityRepo().findOne({ where: { slug: candidate } })) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }
    return candidate;
}

/** Creates a minimal local Community row for a communityEname CORE has never seen,
 *  discovered via a Membership envelope in some person's vault. Deliberately does NOT
 *  call syncOrganizationToEvault (unlike createCommunityFromEname) — this community's
 *  real Organization envelope, if any, belongs to whichever platform actually manages
 *  it; the caller hydrates from it read-only immediately after this returns. Returns
 *  null (logged, not thrown) if the eName can't be resolved (registry miss, no Chat
 *  envelope yet) — same "can't act on what can't be resolved" boundary
 *  OrganizationReconciler.reconcileRoster already applies to unresolvable members. */
async function bootstrapCommunityStub(communityEname: string): Promise<Community | null> {
    const existing = await communityRepo().findOne({ where: { ename: communityEname } });
    if (existing) return existing;

    let preview;
    try {
        preview = await resolveEnameForNewCommunity(communityEname);
    } catch (err) {
        logger.warn(err, "MembershipReconciler: could not resolve foreign community %s", communityEname);
        return null;
    }

    const slug = await generateUniqueSlug(preview.envelope.name);

    try {
        const community = await AppDataSource.transaction(async (manager) => {
            const created = await manager.save(
                manager.create(Community, {
                    name: preview.envelope.name,
                    slug,
                    description: preview.envelope.description,
                    logo_url: preview.envelope.logo_url,
                    ename: communityEname,
                    evault_uri: preview.evault_uri,
                    provisioning_status: "linked",
                })
            );
            await manager.save(
                DEFAULT_AVAILABILITY_TYPES.map((t) =>
                    manager.create(AvailabilityType, { ...t, community_id: created.id })
                )
            );
            return created;
        });
        logger.warn(
            "MembershipReconciler: bootstrapped community stub %s (%s) from foreign membership discovery",
            community.id,
            communityEname
        );
        return community;
    } catch (err: any) {
        // Two concurrent discoveries of the same never-before-seen community can both pass
        // the dedup check above before either commits — Community.ename has no DB-level
        // uniqueness constraint, but Community.slug does, so the loser hits 23505 here.
        // Re-fetch and use whichever row actually won, rather than failing the whole pass.
        if (err.code === "23505") {
            const winner = await communityRepo().findOne({ where: { ename: communityEname } });
            if (winner) return winner;
        }
        logger.warn(err, "MembershipReconciler: failed to bootstrap community stub for %s", communityEname);
        return null;
    }
}

async function hydrateFromOrganization(community: Community): Promise<void> {
    if (!community.ename) return;
    try {
        const envelopes = await findEnvelopesByOntology(community.ename, ONTOLOGIES.Organization, 1);
        const payload = envelopes[0]?.parsed as unknown as OrganizationEnvelopePayload | null;
        if (!payload) return;
        await reconcileOrganizationFromEvault(community.id, payload);
    } catch (err) {
        logger.warn(err, "MembershipReconciler: organization hydration failed for community %s", community.id);
    }
}

export async function reconcileMembershipsForPerson(personId: string): Promise<void> {
    const person = await personRepo().findOne({ where: { id: personId } });
    if (!person?.ename || !person.meta_envelope_id) return;

    const envelopes = await findEnvelopesByOntology(person.ename, ONTOLOGIES.Membership, 200);
    const matchedEnames = new Set<string>();

    for (const envelope of envelopes) {
        const payload = envelope.parsed as unknown as MembershipEnvelopePayload | null;
        if (!payload?.communityEname) continue;
        matchedEnames.add(payload.communityEname);

        try {
            let community = await communityRepo().findOne({ where: { ename: payload.communityEname } });
            if (!community) {
                community = await bootstrapCommunityStub(payload.communityEname);
            }
            if (!community) continue;
            await hydrateFromOrganization(community);
        } catch (err) {
            logger.warn(err, "MembershipReconciler: forward reconcile failed for community %s", payload.communityEname);
        }
    }

    // Reverse direction: self-heal a linked, locally-eligible membership whose own
    // outbound Membership envelope never made it into this person's vault. Never deletes
    // anything — a missing envelope here is a write gap to repair, not evidence the
    // membership ended. Deletion stays exclusively OrganizationReconciler.reconcileRoster's.
    const localMemberships = await membershipRepo().find({ where: { person_id: person.id } });
    if (!localMemberships.length) return;

    const communityIds = localMemberships.map((m) => m.community_id);
    const communities = await communityRepo().find({ where: { id: In(communityIds) } });
    const communityById = new Map(communities.map((c) => [c.id, c]));

    for (const membership of localMemberships) {
        const community = communityById.get(membership.community_id);
        if (!community || community.provisioning_status !== "linked" || !community.ename) continue;
        if (matchedEnames.has(community.ename)) continue;

        try {
            await createMembershipEnvelope(membership.id);
            logger.warn(
                "MembershipReconciler: repaired missing Membership envelope for membership %s (community %s)",
                membership.id,
                community.ename
            );
        } catch (err) {
            logger.warn(err, "MembershipReconciler: envelope repair failed for membership %s", membership.id);
        }
    }
}
```

- [ ] **Step 7: Manual verification (no automated test file for this task — matches repo convention for DB-touching reconciliation logic)**

Run a one-off script against your local dev Postgres to verify the self-heal (reverse-direction) path, since this logic has no automated test:

```bash
cd api && cat > /tmp/membership-reconciler-smoke.ts <<'EOF'
import { AppDataSource } from "./src/database/data-source";
import { reconcileMembershipsForPerson } from "./src/services/MembershipReconciler";
import { deleteMembershipEnvelope } from "./src/services/MembershipEnvelopeService";
import { Community } from "./src/database/entities/Community";
import { CommunityMembership } from "./src/database/entities/CommunityMembership";
import { Person } from "./src/database/entities/Person";
import { slugify } from "./src/lib/slugify";

async function main() {
    await AppDataSource.initialize();
    const communityRepo = AppDataSource.getRepository(Community);
    const membershipRepo = AppDataSource.getRepository(CommunityMembership);
    const personRepo = AppDataSource.getRepository(Person);

    // Scenario: slug collision. Two communities whose names normalize to the same slug
    // must not collide — this only exercises the dedup-suffix loop directly (not a full
    // bootstrap), since forcing bootstrapCommunityStub to run twice needs a second real
    // foreign eName (see the optional foreign-discovery check below).
    const base = "Smoke Test Collision";
    const first = await communityRepo.save(
        communityRepo.create({ name: base, slug: slugify(base), ename: null, provisioning_status: "unlinked" })
    );
    const dupSlug = slugify(base); // what a naive second insert would collide on
    const secondSlugCandidate = (await communityRepo.findOne({ where: { slug: dupSlug } }))
        ? `${dupSlug}-2`
        : dupSlug;
    console.log("Collision dedup would assign:", secondSlugCandidate, "(expect '-2' suffix since first row exists)");
    await communityRepo.delete(first.id); // clean up the disposable row

    // Scenario: a linked, eName-eligible membership whose Membership envelope genuinely
    // does not exist in the vault (simulated by deleting it) must be repaired.
    const membership = await membershipRepo.findOne({ where: {} }); // pick any existing membership
    if (!membership?.membership_envelope_id) {
        console.log("No membership with an existing membership_envelope_id found — skipped. Pick a linked member who has already synced once.");
        process.exit(0);
    }

    const community = await communityRepo.findOne({ where: { id: membership.community_id } });
    const person = await personRepo.findOne({ where: { id: membership.person_id } });
    if (!community?.ename || community.provisioning_status !== "linked" || !person?.ename || !person?.meta_envelope_id) {
        console.log("Found membership isn't fully eligible/linked — skipped. Need a linked community + eName-resolved member.");
        process.exit(0);
    }

    await deleteMembershipEnvelope(membership.id); // removes the real envelope from the vault
    await membershipRepo.update(membership.id, { membership_envelope_id: null }); // clear the now-stale local pointer

    await reconcileMembershipsForPerson(person.id);

    const repaired = await membershipRepo.findOne({ where: { id: membership.id } });
    console.log("Missing Membership envelope repaired:", !!repaired?.membership_envelope_id);

    process.exit(0);
}

main();
EOF
npx ts-node /tmp/membership-reconciler-smoke.ts
```

Expected: prints `Missing Membership envelope repaired: true`, and a log line `"MembershipReconciler: repaired missing Membership envelope for membership ..."`. Delete `/tmp/membership-reconciler-smoke.ts` after running. **Do not run this against a membership you care about** — it deletes and recreates a real eVault envelope as part of the test; use a disposable test member.

Optional, environment-dependent — the true foreign-discovery path (bootstrapping a stub for a community CORE has never linked) needs a second real W3DS community that exists in the local registry/eVault but has no local `Community` row in this CORE database. If your local dev stack (see `project_w3ds_local_dev.md`) has such a community available, verify it manually: write a Membership envelope into a test person's vault via `createEnvelope({ vaultEname: person.ename, ontology: ONTOLOGIES.Membership, payload: { v: 1, communityEname: "@<foreign-community-ename>", joinedAt: new Date().toISOString() }, acl: [person.ename, "@<foreign-community-ename>"] })`, call `reconcileMembershipsForPerson(person.id)`, and confirm a new `Community` row appears with `provisioning_status: "linked"`, a generated `slug`, and (if that community has its own Organization envelope) the test person's own `CommunityMembership` row. Skip if no second community is available in your local stack — this is exercised end-to-end by Task 3's manual verification too.

- [ ] **Step 8: Typecheck**

Run: `cd api && npx tsc --noEmit --project tsconfig.typecheck.json`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add api/src/lib/slugify.ts api/src/lib/__tests__/slugify.test.ts api/src/services/MembershipReconciler.ts api/src/services/CommunityService.ts
git commit -m "feat: add MembershipReconciler core reconciliation logic"
```

---

### Task 2: Debounced person-keyed request trigger

**Files:**
- Create: `api/src/services/MembershipReconcileTrigger.ts`
- Test: `api/src/services/__tests__/MembershipReconcileTrigger.test.ts`

**Interfaces:**
- Consumes: `reconcileMembershipsForPerson(personId: string): Promise<void>` from Task 1's `./MembershipReconciler`.
- Produces: `shouldReconcile(lastReconciledAtMs: number | undefined, nowMs: number, debounceMs?: number): boolean`, `triggerMembershipReconcile(personId: string): Promise<void>`, `_resetForTests(): void` — all exported from `MembershipReconcileTrigger.ts`. Consumed directly by Task 3's `AuthController.ts` wiring. This file duplicates the same 4-line `shouldReconcile` pattern every other trigger file in this codebase already defines — not imported cross-file, each trigger file owns its own debounce logic and its own `Map`.

Unlike `AvailabilityReconcileTrigger.ts` / `OrganizationReconcileTrigger.ts` (which fetch their own envelope before calling their reconciler, since community-keyed reconcile needs exactly one envelope), this trigger has nothing to fetch itself — `reconcileMembershipsForPerson` already does its own multi-envelope fetch internally. The trigger here is pure debounce-and-delegate.

- [ ] **Step 1: Write the failing test for `shouldReconcile`**

```typescript
// api/src/services/__tests__/MembershipReconcileTrigger.test.ts
import { shouldReconcile } from "../MembershipReconcileTrigger";

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

Run: `cd api && npx jest src/services/__tests__/MembershipReconcileTrigger.test.ts --watchman=false`
Expected: FAIL — `Cannot find module '../MembershipReconcileTrigger'`

- [ ] **Step 3: Write `MembershipReconcileTrigger.ts`**

```typescript
import { reconcileMembershipsForPerson } from "./MembershipReconciler";

const lastReconciledAt = new Map<string, number>();

export function shouldReconcile(
    lastReconciledAtMs: number | undefined,
    nowMs: number,
    debounceMs = 60_000
): boolean {
    if (lastReconciledAtMs === undefined) return true;
    return nowMs - lastReconciledAtMs >= debounceMs;
}

export async function triggerMembershipReconcile(personId: string): Promise<void> {
    const now = Date.now();
    if (!shouldReconcile(lastReconciledAt.get(personId), now)) return;
    lastReconciledAt.set(personId, now);

    await reconcileMembershipsForPerson(personId);
}

// Test-only: clears the debounce map between test files so state doesn't leak.
export function _resetForTests(): void {
    lastReconciledAt.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npx jest src/services/__tests__/MembershipReconcileTrigger.test.ts --watchman=false`
Expected: PASS, 4/4 tests.

- [ ] **Step 5: Run the full test suite**

Run: `cd api && npm test -- --watchman=false`
Expected: all suites pass, including the new `MembershipReconcileTrigger.test.ts`.

- [ ] **Step 6: Typecheck**

Run: `cd api && npx tsc --noEmit --project tsconfig.typecheck.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add api/src/services/MembershipReconcileTrigger.ts api/src/services/__tests__/MembershipReconcileTrigger.test.ts
git commit -m "feat: add debounced person-keyed Membership reconcile trigger"
```

---

### Task 3: Wire into login/session endpoints

**Files:**
- Modify: `api/src/controllers/AuthController.ts`

**Interfaces:**
- Consumes: `triggerMembershipReconcile(personId: string): Promise<void>` from Task 2's `../services/MembershipReconcileTrigger`.
- Produces: nothing consumed by later tasks — this is the final task.

- [ ] **Step 1: Add the import**

In `api/src/controllers/AuthController.ts`, add near the top with the other service imports (after the existing `import { logger } from "../lib/logger";` line):

```typescript
import { triggerMembershipReconcile } from "../services/MembershipReconcileTrigger";
```

- [ ] **Step 2: Fire the trigger in `epassportLogin`**

`epassportLogin` currently ends with (lines 102-108):

```typescript
    const memberships = await getMembershipsForPerson(person.id);
    const isPlatformAdmin = isPlatformAdminEname(person.ename);
    const payload = { token, user: serializePerson(person), memberships, returnTo, isPlatformAdmin };
    sessionResults.set(session, payload);
    sessions.emit(session, payload);
    res.json(payload);
}
```

Change it to fire the trigger right after computing `memberships`, without delaying the response:

```typescript
    const memberships = await getMembershipsForPerson(person.id);
    triggerMembershipReconcile(person.id).catch((err) =>
        logger.warn(err, "MembershipReconciler: request-triggered reconcile failed for person %s", person.id)
    );
    const isPlatformAdmin = isPlatformAdminEname(person.ename);
    const payload = { token, user: serializePerson(person), memberships, returnTo, isPlatformAdmin };
    sessionResults.set(session, payload);
    sessions.emit(session, payload);
    res.json(payload);
}
```

- [ ] **Step 3: Fire the trigger in `getMe`**

`getMe` currently reads (lines 135-156):

```typescript
export async function getMe(req: Request, res: Response) {
    const person = await findById(req.user!.userId);
    if (!person) { res.status(404).json({ error: "Person not found" }); return; }

    const memberships = await AppDataSource.getRepository(CommunityMembership).find({
        where: { person_id: person.id },
    });
    const communityIds = memberships.map((m) => m.community_id);
    const communities = communityIds.length
        ? await AppDataSource.getRepository(Community).findBy(communityIds.map((id) => ({ id })))
        : [];

    res.json({
        person: serializePerson(person),
        memberships: memberships.map((m) => ({
            communityId: m.community_id,
            isAdmin: m.is_admin,
            community: communities.find((c) => c.id === m.community_id),
        })),
        isPlatformAdmin: isPlatformAdminEname(person.ename),
    });
}
```

Change it to fire the trigger right after resolving `person`, before the response is built:

```typescript
export async function getMe(req: Request, res: Response) {
    const person = await findById(req.user!.userId);
    if (!person) { res.status(404).json({ error: "Person not found" }); return; }

    triggerMembershipReconcile(person.id).catch((err) =>
        logger.warn(err, "MembershipReconciler: request-triggered reconcile failed for person %s", person.id)
    );

    const memberships = await AppDataSource.getRepository(CommunityMembership).find({
        where: { person_id: person.id },
    });
    const communityIds = memberships.map((m) => m.community_id);
    const communities = communityIds.length
        ? await AppDataSource.getRepository(Community).findBy(communityIds.map((id) => ({ id })))
        : [];

    res.json({
        person: serializePerson(person),
        memberships: memberships.map((m) => ({
            communityId: m.community_id,
            isAdmin: m.is_admin,
            community: communities.find((c) => c.id === m.community_id),
        })),
        isPlatformAdmin: isPlatformAdminEname(person.ename),
    });
}
```

Note: this fires the trigger before `memberships` is queried in `getMe`, so a fresh sign-in's very first `getMe` response won't yet reflect a reconcile that's still in flight (it's fire-and-forget, not awaited) — the newly-discovered community shows up on the *next* `getMe` call, which matches this plan's accepted "fresh on next ask, not mid-flight" trade-off from the design spec.

- [ ] **Step 4: Run the full test suite**

Run: `cd api && npm test -- --watchman=false`
Expected: all suites pass.

- [ ] **Step 5: Typecheck**

Run: `cd api && npx tsc --noEmit --project tsconfig.typecheck.json`
Expected: no errors.

- [ ] **Step 6: Manual smoke test — server boots with the new wiring**

```bash
cd api && PORT=3099 npx ts-node src/index.ts &
sleep 3
curl http://localhost:3099/api/health
kill %1
```

Expected: `{"status":"ok","db":"connected"}`, no crash or unhandled rejection in the startup logs.

- [ ] **Step 7: Manual smoke test — dev login exercises the trigger end-to-end**

```bash
cd api && PORT=3099 npx ts-node src/index.ts &
sleep 3
curl -s -X POST http://localhost:3099/api/auth/dev-login -H 'Content-Type: application/json' -d '{"ename":"@dev-user"}' | head -c 500
sleep 2
curl -s http://localhost:3099/api/health
kill %1
```

Expected: the login response includes `memberships`; no warning log containing `"MembershipReconciler: request-triggered reconcile failed"` in the server output (a clean pass means the debounced trigger ran without throwing — if `@dev-user` has no `meta_envelope_id`/`ename` set yet, `reconcileMembershipsForPerson` no-ops silently per its eligibility gate, which is also a valid pass). Confirm the actual route path for dev login against `api/src/routes/` if `/api/auth/dev-login` 404s — the handler is `devLogin` in `AuthController.ts`, but this task doesn't modify routing, so the mount path must already exist.

- [ ] **Step 8: Commit**

```bash
git add api/src/controllers/AuthController.ts
git commit -m "feat: wire Membership reconcile trigger into login and session endpoints"
```
