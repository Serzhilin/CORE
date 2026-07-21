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
