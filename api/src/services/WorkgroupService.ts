import { AppDataSource } from "../database/data-source";
import { Workgroup } from "../database/entities/Workgroup";
import { Role } from "../database/entities/Role";
import { WorkgroupMembership } from "../database/entities/WorkgroupMembership";
import { WorkgroupMemberRole } from "../database/entities/WorkgroupMemberRole";

const wgRepo = () => AppDataSource.getRepository(Workgroup);
const roleRepo = () => AppDataSource.getRepository(Role);
const wgmRepo = () => AppDataSource.getRepository(WorkgroupMembership);
const wmrRepo = () => AppDataSource.getRepository(WorkgroupMemberRole);

export async function listWorkgroups(communityId: string) {
    return wgRepo().find({ where: { community_id: communityId }, order: { sort_order: "ASC" } });
}

export async function createWorkgroup(communityId: string, data: { name: string; description?: string; color?: string }): Promise<Workgroup> {
    const maxOrder = (await wgRepo().maximum("sort_order", { community_id: communityId }) as number | null) ?? -1;
    return wgRepo().save(wgRepo().create({ community_id: communityId, name: data.name, description: data.description ?? null, color: data.color ?? "#C4622D", sort_order: maxOrder + 1 }));
}

export async function updateWorkgroup(id: string, communityId: string, data: Partial<Pick<Workgroup, "name" | "description" | "color" | "sort_order">>): Promise<Workgroup> {
    const wg = await wgRepo().findOneOrFail({ where: { id, community_id: communityId } });
    Object.assign(wg, data);
    return wgRepo().save(wg);
}

export async function deleteWorkgroup(id: string, communityId: string): Promise<void> {
    await wgRepo().delete({ id, community_id: communityId });
}

export async function createRole(workgroupId: string, data: { name: string; description?: string; color?: string }): Promise<Role> {
    const maxOrder = (await roleRepo().maximum("sort_order", { workgroup_id: workgroupId }) as number | null) ?? -1;
    return roleRepo().save(roleRepo().create({ workgroup_id: workgroupId, name: data.name, description: data.description ?? null, color: data.color ?? "#C4622D", sort_order: maxOrder + 1 }));
}

export async function updateRole(id: string, workgroupId: string, data: Partial<Pick<Role, "name" | "description" | "color" | "sort_order">>): Promise<Role> {
    const role = await roleRepo().findOneOrFail({ where: { id, workgroup_id: workgroupId } });
    Object.assign(role, data);
    return roleRepo().save(role);
}

export async function deleteRole(id: string, workgroupId: string): Promise<void> {
    await roleRepo().delete({ id, workgroup_id: workgroupId });
}

export async function addWorkgroupMember(workgroupId: string, personId: string): Promise<WorkgroupMembership> {
    return wgmRepo().save(wgmRepo().create({ workgroup_id: workgroupId, person_id: personId }));
}

export async function updateWorkgroupMember(workgroupMembershipId: string, data: { is_workgroup_admin: boolean }): Promise<WorkgroupMembership> {
    const wm = await wgmRepo().findOneOrFail({ where: { id: workgroupMembershipId } });
    wm.is_workgroup_admin = data.is_workgroup_admin;
    return wgmRepo().save(wm);
}

export async function removeWorkgroupMember(workgroupId: string, personId: string): Promise<void> {
    await wgmRepo().delete({ workgroup_id: workgroupId, person_id: personId });
}

export async function assignRole(workgroupMembershipId: string, roleId: string): Promise<WorkgroupMemberRole> {
    return wmrRepo().save(wmrRepo().create({ workgroup_membership_id: workgroupMembershipId, role_id: roleId }));
}

export async function unassignRole(workgroupMembershipId: string, roleId: string): Promise<void> {
    await wmrRepo().delete({ workgroup_membership_id: workgroupMembershipId, role_id: roleId });
}

export async function getWorkgroupMembership(workgroupId: string, personId: string): Promise<WorkgroupMembership | null> {
    return wgmRepo().findOne({ where: { workgroup_id: workgroupId, person_id: personId } });
}
