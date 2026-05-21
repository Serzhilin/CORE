import { AppDataSource } from "../database/data-source";
import { In } from "typeorm";
import { Community } from "../database/entities/Community";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { AvailabilityType } from "../database/entities/AvailabilityType";
import { Workgroup } from "../database/entities/Workgroup";
import { WorkgroupMembership } from "../database/entities/WorkgroupMembership";
import { WorkgroupMemberRole } from "../database/entities/WorkgroupMemberRole";
import { Role } from "../database/entities/Role";
import { Person } from "../database/entities/Person";

const DEFAULT_AVAILABILITY_TYPES = [
    { name: "Vakantie", emoji: "🏖", sort_order: 0 },
    { name: "Burnout", emoji: "🔋", sort_order: 1 },
    { name: "Ziek", emoji: "🤒", sort_order: 2 },
    { name: "Anders", emoji: "📅", sort_order: 3 },
];

export async function createCommunity(
    data: { name: string; slug: string; description?: string },
    creatorPersonId: string
): Promise<Community> {
    return AppDataSource.transaction(async (manager) => {
        const community = await manager.save(
            manager.create(Community, { name: data.name, slug: data.slug, description: data.description ?? null })
        );
        await manager.save(
            manager.create(CommunityMembership, { person_id: creatorPersonId, community_id: community.id, is_admin: true })
        );
        await manager.save(
            DEFAULT_AVAILABILITY_TYPES.map((t) =>
                manager.create(AvailabilityType, { ...t, community_id: community.id })
            )
        );
        return community;
    });
}

export async function getMyCommunities(personId: string): Promise<Community[]> {
    const memberships = await AppDataSource.getRepository(CommunityMembership).find({
        where: { person_id: personId },
    });
    if (!memberships.length) return [];
    return AppDataSource.getRepository(Community).findBy({ id: In(memberships.map(m => m.community_id)) });
}

export async function getCommunityFull(communityId: string) {
    const community = await AppDataSource.getRepository(Community).findOne({ where: { id: communityId } });
    if (!community) return null;

    const memberships = await AppDataSource.getRepository(CommunityMembership).find({
        where: { community_id: communityId },
    });
    const personIds = memberships.map((m) => m.person_id);
    const persons = personIds.length
        ? await AppDataSource.getRepository(Person).findBy({ id: In(personIds) })
        : [];

    const workgroups = await AppDataSource.getRepository(Workgroup).find({
        where: { community_id: communityId },
        order: { sort_order: "ASC" },
    });
    const wgIds = workgroups.map((w) => w.id);

    const wgMemberships = wgIds.length
        ? await AppDataSource.getRepository(WorkgroupMembership).findBy({ workgroup_id: In(wgIds) })
        : [];

    const wgmIds = wgMemberships.map((m) => m.id);
    const wgRoles = wgmIds.length
        ? await AppDataSource.getRepository(WorkgroupMemberRole).findBy({ workgroup_membership_id: In(wgmIds) })
        : [];

    const roles = wgIds.length
        ? await AppDataSource.getRepository(Role).findBy({ workgroup_id: In(wgIds) })
        : [];

    const atIds = [...new Set(memberships.map((m) => m.availability_type_id).filter((id): id is string => id !== null))];
    const availabilityTypes = atIds.length
        ? await AppDataSource.getRepository(AvailabilityType).findBy({ id: In(atIds) })
        : [];
    const atMap = Object.fromEntries(availabilityTypes.map((t) => [t.id, t]));

    return {
        ...community,
        members: memberships.map((m) => {
            const person = persons.find((p) => p.id === m.person_id);
            const at = m.availability_type_id ? atMap[m.availability_type_id] : null;
            return {
                membershipId: m.id,
                personId: m.person_id,
                firstName: person?.first_name ?? null,
                lastName: person?.last_name ?? null,
                email: person?.email ?? null,
                avatarUrl: person?.avatar_url ?? null,
                isAdmin: m.is_admin,
                isAspirant: m.is_aspirant,
                joinedAt: m.joined_at,
                availability: at
                    ? {
                          type: { id: at.id, name: at.name, emoji: at.emoji },
                          reason: m.availability_reason,
                          from: m.availability_from,
                          until: m.availability_until,
                      }
                    : null,
            };
        }),
        workgroups: workgroups.map((wg) => {
            const wgMembs = wgMemberships.filter((m) => m.workgroup_id === wg.id);
            return {
                ...wg,
                roles: roles.filter((r) => r.workgroup_id === wg.id),
                members: wgMembs.map((wm) => ({
                    ...wm,
                    roles: wgRoles
                        .filter((r) => r.workgroup_membership_id === wm.id)
                        .map((r) => r.role_id),
                })),
            };
        }),
    };
}

export async function getCommunityGraph(communityId: string) {
    const workgroups = await AppDataSource.getRepository(Workgroup).find({
        where: { community_id: communityId },
        order: { sort_order: "ASC" },
    });
    const wgIds = workgroups.map((w) => w.id);

    const roles = wgIds.length
        ? await AppDataSource.getRepository(Role).findBy({ workgroup_id: In(wgIds) })
        : [];

    const wgMemberships = wgIds.length
        ? await AppDataSource.getRepository(WorkgroupMembership).findBy({ workgroup_id: In(wgIds) })
        : [];
    const wgmIds = wgMemberships.map((m) => m.id);
    const wgMemberRoles = wgmIds.length
        ? await AppDataSource.getRepository(WorkgroupMemberRole).findBy({ workgroup_membership_id: In(wgmIds) })
        : [];

    const communityMemberships = await AppDataSource.getRepository(CommunityMembership).find({
        where: { community_id: communityId },
    });
    const personIds = communityMemberships.map((m) => m.person_id);
    const persons = personIds.length
        ? await AppDataSource.getRepository(Person).findBy({ id: In(personIds) })
        : [];

    const atIds = [...new Set(
        communityMemberships.map((m) => m.availability_type_id).filter((id): id is string => id !== null)
    )];
    const availabilityTypes = atIds.length
        ? await AppDataSource.getRepository(AvailabilityType).findBy({ id: In(atIds) })
        : [];
    const atMap = Object.fromEntries(availabilityTypes.map((t) => [t.id, t]));

    return {
        workgroups: workgroups.map((wg) => ({
            id: wg.id,
            name: wg.name,
            color: wg.color,
            description: wg.description,
        })),
        persons: communityMemberships.map((cm) => {
            const person = persons.find((p) => p.id === cm.person_id)!;
            const at = cm.availability_type_id ? atMap[cm.availability_type_id] : null;
            const myMemberships = wgMemberships.filter((wm) => wm.person_id === cm.person_id);
            return {
                id: cm.person_id,
                firstName: person?.first_name ?? null,
                lastName: person?.last_name ?? null,
                isAspirant: cm.is_aspirant,
                isAdmin: cm.is_admin,
                availability: at ? { name: at.name, emoji: at.emoji } : null,
                memberships: myMemberships.map((wm) => {
                    const myRoleIds = wgMemberRoles
                        .filter((r) => r.workgroup_membership_id === wm.id)
                        .map((r) => r.role_id);
                    const myRoles = roles
                        .filter((r) => myRoleIds.includes(r.id))
                        .map((r) => ({ id: r.id, name: r.name, color: r.color }));
                    return { workgroupId: wm.workgroup_id, roles: myRoles };
                }),
            };
        }),
    };
}

export async function updateCommunity(
    id: string,
    data: Partial<Pick<Community, "name" | "slug" | "description" | "logo_url" | "primary_color" | "title_font">>
): Promise<Community> {
    const repo = AppDataSource.getRepository(Community);
    const community = await repo.findOneOrFail({ where: { id } });
    Object.assign(community, data);
    return repo.save(community);
}
