// api/src/services/MemberService.ts
import { In } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Person } from "../database/entities/Person";
import { AvailabilityLog } from "../database/entities/AvailabilityLog";
import { Workgroup } from "../database/entities/Workgroup";
import { WorkgroupMembership } from "../database/entities/WorkgroupMembership";
import { syncOrganizationToEvault } from "./OrganizationService";
import { createMembershipEnvelope } from "./MembershipEnvelopeService";
import { syncAvailabilityToEvault } from "./AvailabilityEnvelopeService";
import { removeWorkgroupMember } from "./WorkgroupService";
import { addPersonToCommunityChat, removePersonFromCommunityChat } from "./ChatService";
import { getUserMetaEnvelopeId } from "../lib/evault-client";
import { logger } from "../lib/logger";

const memberRepo = () => AppDataSource.getRepository(CommunityMembership);
const personRepo = () => AppDataSource.getRepository(Person);
const workgroupRepo = () => AppDataSource.getRepository(Workgroup);
const workgroupMembershipRepo = () => AppDataSource.getRepository(WorkgroupMembership);

export async function listMembers(communityId: string): Promise<CommunityMembership[]> {
    return memberRepo().find({ where: { community_id: communityId } });
}

export async function addMember(
    communityId: string,
    data: { first_name: string; last_name: string; email?: string; ename?: string }
): Promise<CommunityMembership> {
    // Reuse shell Person with matching ename or email, else create new shell
    let person: Person | null = null;
    if (data.ename) {
        person = await personRepo().findOne({ where: { ename: data.ename } });
    }
    if (!person && data.email) {
        person = await personRepo().findOne({ where: { email: data.email } });
    }
    if (!person) {
        person = await personRepo().save(
            personRepo().create({
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email ?? null,
                ename: data.ename ?? null,
            })
        );
    } else if (data.ename && !person.ename) {
        person.ename = data.ename;
        person = await personRepo().save(person);
    }

    if (person.ename && !person.meta_envelope_id) {
        const metaId = await getUserMetaEnvelopeId(person.ename);
        if (metaId) person = await personRepo().save(Object.assign(person, { meta_envelope_id: metaId }));
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

    syncOrganizationToEvault(communityId).catch((err) =>
        logger.warn(err, "Organization envelope sync failed for member %s", membership.id)
    );
    addPersonToCommunityChat(communityId, person.id).catch((err) =>
        logger.warn(err, "Community chat sync failed for member %s", membership.id)
    );
    createMembershipEnvelope(membership.id).catch((err) =>
        logger.warn(err, "Membership envelope creation failed for member %s", membership.id)
    );

    return membership;
}

export async function updateMember(
    communityId: string,
    membershipId: string,
    data: Partial<Pick<CommunityMembership, "is_admin" | "membership_type_id" | "joined_at">>
): Promise<CommunityMembership> {
    const m = await memberRepo().findOneOrFail({ where: { id: membershipId } });
    Object.assign(m, data);
    const saved = await memberRepo().save(m);
    syncOrganizationToEvault(communityId).catch((err) =>
        logger.warn(err, "Organization envelope sync failed for member %s", membershipId)
    );
    return saved;
}

export async function removeMember(communityId: string, membershipId: string): Promise<void> {
    const membership = await memberRepo().findOne({ where: { id: membershipId, community_id: communityId } });
    if (!membership) return;

    const workgroupIds = (await workgroupRepo().find({ where: { community_id: communityId } })).map((w) => w.id);
    if (workgroupIds.length) {
        const wgMemberships = await workgroupMembershipRepo().find({
            where: { person_id: membership.person_id, workgroup_id: In(workgroupIds) },
        });
        for (const wm of wgMemberships) {
            await removeWorkgroupMember(wm.workgroup_id, membership.person_id, true);
        }
    }

    await removePersonFromCommunityChat(communityId, membership.person_id);
    await syncOrganizationToEvault(communityId, { excludeMembershipId: membershipId });
    await memberRepo().delete({ id: membershipId, community_id: communityId });
    syncAvailabilityToEvault(communityId).catch((err) =>
        logger.warn(err, "Availability envelope sync failed after removing member %s", membershipId)
    );
}

export async function getMemberAvailabilityLog(membershipId: string): Promise<AvailabilityLog[]> {
    return AppDataSource.getRepository(AvailabilityLog).find({
        where: { community_membership_id: membershipId },
        order: { created_at: "DESC" },
    });
}
