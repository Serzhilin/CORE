import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Person } from "../database/entities/Person";
import { AvailabilityLog } from "../database/entities/AvailabilityLog";
import { getById as getCommunityById, addParticipantToEnvelope, removeParticipantFromEnvelope } from "./CommunityService";
import { getUserMetaEnvelopeId } from "../lib/evault-client";
import { logger } from "../lib/logger";

const memberRepo = () => AppDataSource.getRepository(CommunityMembership);
const personRepo = () => AppDataSource.getRepository(Person);

export async function listMembers(communityId: string): Promise<CommunityMembership[]> {
    return memberRepo().find({ where: { community_id: communityId } });
}

export async function addMember(
    communityId: string,
    data: { first_name: string; last_name: string; email?: string }
): Promise<CommunityMembership> {
    // Reuse shell Person with matching email, else create new shell
    let person: Person | null = null;
    if (data.email) {
        person = await personRepo().findOne({ where: { email: data.email } });
    }
    if (!person) {
        person = await personRepo().save(
            personRepo().create({
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email ?? null,
            })
        );
    }
    let membership: CommunityMembership;
    try {
        membership = await memberRepo().save(
            memberRepo().create({ person_id: person.id, community_id: communityId })
        );
    } catch (err: any) {
        if (err.code === "23505") throw Object.assign(new Error("Already a member"), { code: "23505" });
        throw err;
    }

    if (person.ename) {
        syncMemberAdd(communityId, person, membership).catch((err) =>
            logger.warn(err, "Chat envelope participant sync failed for member %s", membership.id)
        );
    }

    return membership;
}

async function syncMemberAdd(communityId: string, person: Person, membership: CommunityMembership): Promise<void> {
    const community = await getCommunityById(communityId);
    if (!community) return;
    const metaEnvelopeId = person.meta_envelope_id ?? (await getUserMetaEnvelopeId(person.ename!));
    if (!metaEnvelopeId) return;
    if (!person.meta_envelope_id) await personRepo().update(person.id, { meta_envelope_id: metaEnvelopeId });
    await memberRepo().update(membership.id, { meta_envelope_id: metaEnvelopeId });
    await addParticipantToEnvelope(community, metaEnvelopeId);
}

export async function updateMember(
    membershipId: string,
    data: Partial<Pick<CommunityMembership, "is_admin" | "is_aspirant" | "is_active_partner" | "joined_at">>
): Promise<CommunityMembership> {
    const m = await memberRepo().findOneOrFail({ where: { id: membershipId } });
    Object.assign(m, data);
    return memberRepo().save(m);
}

export async function removeMember(communityId: string, membershipId: string): Promise<void> {
    const membership = await memberRepo().findOne({ where: { id: membershipId, community_id: communityId } });
    if (!membership) return;
    await memberRepo().delete({ id: membershipId, community_id: communityId });

    if (membership.meta_envelope_id) {
        syncMemberRemove(communityId, membership.meta_envelope_id).catch((err) =>
            logger.warn(err, "Chat envelope participant removal failed for member %s", membershipId)
        );
    }
}

async function syncMemberRemove(communityId: string, metaEnvelopeId: string): Promise<void> {
    const community = await getCommunityById(communityId);
    if (!community) return;
    await removeParticipantFromEnvelope(community, metaEnvelopeId);
}

export async function getMemberAvailabilityLog(membershipId: string): Promise<AvailabilityLog[]> {
    return AppDataSource.getRepository(AvailabilityLog).find({
        where: { community_membership_id: membershipId },
        order: { created_at: "DESC" },
    });
}
