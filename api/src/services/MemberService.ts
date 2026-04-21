import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Person } from "../database/entities/Person";
import { AvailabilityLog } from "../database/entities/AvailabilityLog";

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
    try {
        return await memberRepo().save(
            memberRepo().create({ person_id: person.id, community_id: communityId })
        );
    } catch (err: any) {
        if (err.code === "23505") throw Object.assign(new Error("Already a member"), { code: "23505" });
        throw err;
    }
}

export async function updateMember(
    membershipId: string,
    data: Partial<Pick<CommunityMembership, "is_admin" | "is_aspirant" | "joined_at">>
): Promise<CommunityMembership> {
    const m = await memberRepo().findOneOrFail({ where: { id: membershipId } });
    Object.assign(m, data);
    return memberRepo().save(m);
}

export async function removeMember(communityId: string, membershipId: string): Promise<void> {
    await memberRepo().delete({ id: membershipId, community_id: communityId });
}

export async function getMemberAvailabilityLog(membershipId: string): Promise<AvailabilityLog[]> {
    return AppDataSource.getRepository(AvailabilityLog).find({
        where: { community_membership_id: membershipId },
        order: { created_at: "DESC" },
    });
}
