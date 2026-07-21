import { In } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Workgroup } from "../database/entities/Workgroup";
import { Role } from "../database/entities/Role";
import { WorkgroupMembership } from "../database/entities/WorkgroupMembership";
import { WorkgroupMemberRole } from "../database/entities/WorkgroupMemberRole";
import { Community } from "../database/entities/Community";
import { Person } from "../database/entities/Person";
import { createEnvelope, updateEnvelope, removeEnvelope, getUserMetaEnvelopeId } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { buildWorkgroupPayload } from "./workgroupPayload";
import { logger } from "../lib/logger";
import { createWorkgroupChat, renameWorkgroupChat, archiveWorkgroupChat, addPersonToWorkgroupChat, removePersonFromWorkgroupChat } from "./ChatService";

const wgRepo = () => AppDataSource.getRepository(Workgroup);
const roleRepo = () => AppDataSource.getRepository(Role);
const wgmRepo = () => AppDataSource.getRepository(WorkgroupMembership);
const wmrRepo = () => AppDataSource.getRepository(WorkgroupMemberRole);
const communityRepo = () => AppDataSource.getRepository(Community);
const personRepo = () => AppDataSource.getRepository(Person);

interface SyncExclusions {
    excludeRoleId?: string;
    excludeMembershipId?: string;
    excludeRoleAssignment?: { membershipId: string; roleId: string };
}

export async function syncWorkgroupToEvault(workgroupId: string, exclude: SyncExclusions = {}): Promise<void> {
    const wg = await wgRepo().findOne({ where: { id: workgroupId } });
    if (!wg) return;
    const community = await communityRepo().findOne({ where: { id: wg.community_id } });
    if (!community || community.provisioning_status !== "linked" || !community.ename) return;

    let roles = await roleRepo().find({ where: { workgroup_id: workgroupId } });
    if (exclude.excludeRoleId) roles = roles.filter((r) => r.id !== exclude.excludeRoleId);

    let memberships = await wgmRepo().find({ where: { workgroup_id: workgroupId } });
    if (exclude.excludeMembershipId) memberships = memberships.filter((m) => m.id !== exclude.excludeMembershipId);

    const wgmIds = memberships.map((m) => m.id);
    let memberRoles = wgmIds.length
        ? await wmrRepo().find({ where: { workgroup_membership_id: In(wgmIds) } })
        : [];
    if (exclude.excludeRoleId) {
        memberRoles = memberRoles.filter((r) => r.role_id !== exclude.excludeRoleId);
    }
    if (exclude.excludeRoleAssignment) {
        const { membershipId, roleId } = exclude.excludeRoleAssignment;
        memberRoles = memberRoles.filter(
            (r) => !(r.workgroup_membership_id === membershipId && r.role_id === roleId)
        );
    }

    const members: { participantId: string; roleIds: string[] }[] = [];
    for (const m of memberships) {
        const person = await personRepo().findOne({ where: { id: m.person_id } });
        if (!person?.ename) continue;
        let metaId = person.meta_envelope_id;
        if (!metaId) {
            metaId = await getUserMetaEnvelopeId(person.ename);
            if (metaId) await personRepo().update(person.id, { meta_envelope_id: metaId });
        }
        if (!metaId) continue;
        const roleIds = memberRoles.filter((r) => r.workgroup_membership_id === m.id).map((r) => r.role_id);
        members.push({ participantId: metaId, roleIds });
    }

    const payload = buildWorkgroupPayload({
        communityEname: community.ename,
        name: wg.name,
        description: wg.description,
        color: wg.color,
        createdAt: wg.created_at,
        updatedAt: wg.updated_at,
        roles: roles.map((r) => ({ id: r.id, name: r.name, color: r.color })),
        members,
        chatId: wg.chat_envelope_id,
    });

    if (wg.envelope_id) {
        await updateEnvelope({
            vaultEname: community.ename,
            envelopeId: wg.envelope_id,
            ontology: ONTOLOGIES.Workgroup,
            payload: { ...payload },
            acl: ["*"],
        });
    } else {
        const envelopeId = await createEnvelope({
            vaultEname: community.ename,
            ontology: ONTOLOGIES.Workgroup,
            payload: { ...payload },
            acl: ["*"],
        });
        await wgRepo().update(wg.id, { envelope_id: envelopeId });
    }
}

export async function listWorkgroups(communityId: string) {
    return wgRepo().find({ where: { community_id: communityId }, order: { sort_order: "ASC" } });
}

export async function createWorkgroup(communityId: string, data: { name: string; description?: string; color?: string }): Promise<Workgroup> {
    const maxOrder = (await wgRepo().maximum("sort_order", { community_id: communityId }) as number | null) ?? -1;
    const saved = await wgRepo().save(wgRepo().create({ community_id: communityId, name: data.name, description: data.description ?? null, color: data.color ?? "#C4622D", sort_order: maxOrder + 1 }));
    // Awaited, not fire-and-forget: the chat id must exist before anyone can join.
    // Workgroup creation is rare/admin-only, so the extra latency is cheap. If this
    // throws, saved may already have persisted in Postgres with chat_envelope_id
    // null — a recoverable, self-describing state, not data corruption.
    const chatEnvelopeId = await createWorkgroupChat(saved.id);
    if (chatEnvelopeId) saved.chat_envelope_id = chatEnvelopeId;
    syncWorkgroupToEvault(saved.id).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", saved.id));
    return saved;
}

export async function updateWorkgroup(id: string, communityId: string, data: Partial<Pick<Workgroup, "name" | "description" | "color" | "sort_order">>): Promise<Workgroup> {
    const wg = await wgRepo().findOneOrFail({ where: { id, community_id: communityId } });
    const nameChanged = data.name !== undefined && data.name !== wg.name;
    Object.assign(wg, data);
    const saved = await wgRepo().save(wg);
    syncWorkgroupToEvault(saved.id).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", saved.id));
    if (nameChanged) {
        renameWorkgroupChat(saved.id, saved.name).catch((err) => logger.warn(err, "Workgroup chat rename failed for %s", saved.id));
    }
    return saved;
}

export async function deleteWorkgroup(id: string, communityId: string): Promise<void> {
    const wg = await wgRepo().findOneOrFail({ where: { id, community_id: communityId } });
    if (wg.envelope_id) {
        const community = await communityRepo().findOne({ where: { id: communityId } });
        if (community?.ename) await removeEnvelope(community.ename, wg.envelope_id);
    }
    await archiveWorkgroupChat(id);
    await wgRepo().delete({ id, community_id: communityId });
}

export async function createRole(workgroupId: string, data: { name: string; description?: string; color?: string }): Promise<Role> {
    const maxOrder = (await roleRepo().maximum("sort_order", { workgroup_id: workgroupId }) as number | null) ?? -1;
    const saved = await roleRepo().save(roleRepo().create({ workgroup_id: workgroupId, name: data.name, description: data.description ?? null, color: data.color ?? "#C4622D", sort_order: maxOrder + 1 }));
    syncWorkgroupToEvault(workgroupId).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", workgroupId));
    return saved;
}

export async function updateRole(id: string, workgroupId: string, data: Partial<Pick<Role, "name" | "description" | "color" | "sort_order">>): Promise<Role> {
    const role = await roleRepo().findOneOrFail({ where: { id, workgroup_id: workgroupId } });
    Object.assign(role, data);
    const saved = await roleRepo().save(role);
    syncWorkgroupToEvault(workgroupId).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", workgroupId));
    return saved;
}

export async function deleteRole(id: string, workgroupId: string): Promise<void> {
    await syncWorkgroupToEvault(workgroupId, { excludeRoleId: id });
    await wmrRepo().delete({ role_id: id });
    await roleRepo().delete({ id, workgroup_id: workgroupId });
}

export async function addWorkgroupMember(workgroupId: string, personId: string): Promise<WorkgroupMembership> {
    const saved = await wgmRepo().save(wgmRepo().create({ workgroup_id: workgroupId, person_id: personId }));
    syncWorkgroupToEvault(workgroupId).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", workgroupId));
    addPersonToWorkgroupChat(workgroupId, personId).catch((err) => logger.warn(err, "Workgroup chat add failed for %s", workgroupId));
    return saved;
}

export async function updateWorkgroupMember(workgroupMembershipId: string, data: { is_workgroup_admin: boolean }): Promise<WorkgroupMembership> {
    const wm = await wgmRepo().findOneOrFail({ where: { id: workgroupMembershipId } });
    wm.is_workgroup_admin = data.is_workgroup_admin;
    const saved = await wgmRepo().save(wm);
    syncWorkgroupToEvault(saved.workgroup_id).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", saved.workgroup_id));
    return saved;
}

export async function removeWorkgroupMember(workgroupId: string, personId: string, alsoRemoveFromChat = false): Promise<void> {
    const wm = await wgmRepo().findOne({ where: { workgroup_id: workgroupId, person_id: personId } });
    if (!wm) return;
    await syncWorkgroupToEvault(workgroupId, { excludeMembershipId: wm.id });
    if (alsoRemoveFromChat) {
        await removePersonFromWorkgroupChat(workgroupId, personId);
    }
    await wmrRepo().delete({ workgroup_membership_id: wm.id });
    await wgmRepo().delete(wm.id);
}

export async function assignRole(workgroupMembershipId: string, roleId: string): Promise<WorkgroupMemberRole> {
    const saved = await wmrRepo().save(wmrRepo().create({ workgroup_membership_id: workgroupMembershipId, role_id: roleId }));
    const wm = await wgmRepo().findOneOrFail({ where: { id: workgroupMembershipId } });
    syncWorkgroupToEvault(wm.workgroup_id).catch((err) => logger.warn(err, "Workgroup envelope sync failed for %s", wm.workgroup_id));
    return saved;
}

export async function unassignRole(workgroupMembershipId: string, roleId: string): Promise<void> {
    const wm = await wgmRepo().findOneOrFail({ where: { id: workgroupMembershipId } });
    await syncWorkgroupToEvault(wm.workgroup_id, { excludeRoleAssignment: { membershipId: workgroupMembershipId, roleId } });
    await wmrRepo().delete({ workgroup_membership_id: workgroupMembershipId, role_id: roleId });
}

export async function getWorkgroupMembership(workgroupId: string, personId: string): Promise<WorkgroupMembership | null> {
    return wgmRepo().findOne({ where: { workgroup_id: workgroupId, person_id: personId } });
}
