// api/src/services/MemberService.ts
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Person } from "../database/entities/Person";
import { AvailabilityLog } from "../database/entities/AvailabilityLog";
import { syncOrganizationToEvault } from "./OrganizationService";
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

    syncOrganizationToEvault(communityId).catch((err) =>
        logger.warn(err, "Organization envelope sync failed for member %s", membership.id)
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
    await syncOrganizationToEvault(communityId, { excludeMembershipId: membershipId });
    await memberRepo().delete({ id: membershipId, community_id: communityId });
}

export async function getMemberAvailabilityLog(membershipId: string): Promise<AvailabilityLog[]> {
    return AppDataSource.getRepository(AvailabilityLog).find({
        where: { community_membership_id: membershipId },
        order: { created_at: "DESC" },
    });
}
