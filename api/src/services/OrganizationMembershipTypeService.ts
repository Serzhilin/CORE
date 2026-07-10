// api/src/services/OrganizationMembershipTypeService.ts
import { AppDataSource } from "../database/data-source";
import { OrganizationMembershipType } from "../database/entities/OrganizationMembershipType";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { syncOrganizationToEvault } from "./OrganizationService";
import { logger } from "../lib/logger";

const typeRepo = () => AppDataSource.getRepository(OrganizationMembershipType);
const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);

export async function listMembershipTypes(communityId: string): Promise<OrganizationMembershipType[]> {
    return typeRepo().find({ where: { community_id: communityId }, order: { sort_order: "ASC" } });
}

export async function createMembershipType(
    communityId: string,
    data: { name: string; description?: string; emoji?: string }
): Promise<OrganizationMembershipType> {
    const maxOrder = (await typeRepo().maximum("sort_order", { community_id: communityId }) as number | null) ?? -1;
    const saved = await typeRepo().save(
        typeRepo().create({
            community_id: communityId,
            name: data.name,
            description: data.description ?? null,
            emoji: data.emoji ?? null,
            sort_order: maxOrder + 1,
        })
    );
    syncOrganizationToEvault(communityId).catch((err) =>
        logger.warn(err, "Organization envelope sync failed for %s", communityId)
    );
    return saved;
}

export async function updateMembershipType(
    id: string,
    communityId: string,
    data: Partial<Pick<OrganizationMembershipType, "name" | "description" | "emoji" | "sort_order">>
): Promise<OrganizationMembershipType> {
    const type = await typeRepo().findOneOrFail({ where: { id, community_id: communityId } });
    Object.assign(type, data);
    const saved = await typeRepo().save(type);
    syncOrganizationToEvault(communityId).catch((err) =>
        logger.warn(err, "Organization envelope sync failed for %s", communityId)
    );
    return saved;
}

export async function deleteMembershipType(id: string, communityId: string): Promise<void> {
    const affectedCount = await membershipRepo().count({ where: { community_id: communityId, membership_type_id: id } });
    if (affectedCount > 0) {
        throw Object.assign(new Error(`${affectedCount} member(s) still use this membership type`), {
            code: "membership_type_in_use",
            affectedCount,
        });
    }
    await syncOrganizationToEvault(communityId, { excludeMembershipTypeId: id });
    await typeRepo().delete({ id, community_id: communityId });
}
