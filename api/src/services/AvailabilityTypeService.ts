import { AppDataSource } from "../database/data-source";
import { AvailabilityType } from "../database/entities/AvailabilityType";
import { CommunityMembership } from "../database/entities/CommunityMembership";

const repo = () => AppDataSource.getRepository(AvailabilityType);

export async function listAvailabilityTypes(communityId: string): Promise<AvailabilityType[]> {
    return repo().find({
        where: { community_id: communityId, is_archived: false },
        order: { sort_order: "ASC" },
    });
}

export async function createAvailabilityType(
    communityId: string,
    data: { name: string; emoji: string }
): Promise<AvailabilityType> {
    const maxOrder = (await repo().maximum("sort_order", { community_id: communityId })) as number | null;
    return repo().save(
        repo().create({
            community_id: communityId,
            name: data.name,
            emoji: data.emoji,
            sort_order: (maxOrder ?? -1) + 1,
        })
    );
}

export async function updateAvailabilityType(
    id: string,
    communityId: string,
    data: Partial<Pick<AvailabilityType, "name" | "emoji" | "sort_order">>
): Promise<AvailabilityType> {
    const at = await repo().findOneOrFail({ where: { id, community_id: communityId } });
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    Object.assign(at, patch);
    return repo().save(at);
}

export async function archiveAvailabilityType(id: string, communityId: string): Promise<void> {
    const at = await repo().findOneOrFail({ where: { id, community_id: communityId } });
    const inUse = await AppDataSource.getRepository(CommunityMembership).count({
        where: { community_id: communityId, availability_type_id: id },
    });
    if (inUse > 0) throw Object.assign(new Error("Type is currently in use"), { code: "IN_USE" });
    at.is_archived = true;
    await repo().save(at);
}
