import { In } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { Workgroup } from "../database/entities/Workgroup";
import { Role } from "../database/entities/Role";
import { WorkgroupMembership } from "../database/entities/WorkgroupMembership";
import { WorkgroupMemberRole } from "../database/entities/WorkgroupMemberRole";
import { Person } from "../database/entities/Person";
import { logger } from "../lib/logger";
import { findEnvelopesByOntology } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { WorkgroupEnvelopePayload } from "./workgroupPayload";
import { syncWorkgroupToEvault } from "./WorkgroupService";

const communityRepo = () => AppDataSource.getRepository(Community);
const wgRepo = () => AppDataSource.getRepository(Workgroup);
const roleRepo = () => AppDataSource.getRepository(Role);
const wgmRepo = () => AppDataSource.getRepository(WorkgroupMembership);
const wmrRepo = () => AppDataSource.getRepository(WorkgroupMemberRole);
const personRepo = () => AppDataSource.getRepository(Person);

async function reconcileMemberRoles(membershipId: string, roleIds: string[]): Promise<void> {
    const local = await wmrRepo().find({ where: { workgroup_membership_id: membershipId } });
    const localRoleIds = new Set(local.map((r) => r.role_id));
    const envelopeRoleIds = new Set(roleIds);

    for (const roleId of roleIds) {
        if (localRoleIds.has(roleId)) continue;
        try {
            await wmrRepo().save(wmrRepo().create({ workgroup_membership_id: membershipId, role_id: roleId }));
            logger.warn("WorkgroupReconciler: assigned role %s to membership %s (present in eVault, missing locally)", roleId, membershipId);
        } catch (err) {
            logger.warn(err, "WorkgroupReconciler: member role assign failed for membership %s role %s", membershipId, roleId);
        }
    }

    for (const r of local) {
        if (envelopeRoleIds.has(r.role_id)) continue;
        try {
            await wmrRepo().delete(r.id);
            logger.warn("WorkgroupReconciler: unassigned role %s from membership %s (absent from eVault)", r.role_id, membershipId);
        } catch (err) {
            logger.warn(err, "WorkgroupReconciler: member role unassign failed for membership %s role %s", membershipId, r.role_id);
        }
    }
}

async function reconcileRoles(workgroupId: string, envelopeRoles: WorkgroupEnvelopePayload["roles"]): Promise<void> {
    const repo = roleRepo();
    const localRoles = await repo.find({ where: { workgroup_id: workgroupId } });
    const localById = new Map(localRoles.map((r) => [r.id, r]));
    const envelopeIds = new Set(envelopeRoles.map((r) => r.id));

    for (const er of envelopeRoles) {
        try {
            const local = localById.get(er.id);
            if (!local) {
                const maxSortOrder = localRoles.reduce((max, r) => Math.max(max, r.sort_order), -1);
                // WorkgroupPayloadRole carries no `description` — local-only field,
                // never round-trips through the envelope. Leave it null on bootstrap.
                await repo.save(
                    repo.create({
                        id: er.id,
                        workgroup_id: workgroupId,
                        name: er.name,
                        description: null,
                        color: er.color,
                        sort_order: maxSortOrder + 1,
                    })
                );
                logger.warn(
                    "WorkgroupReconciler: resurrected role %s for workgroup %s (present in eVault, missing locally)",
                    er.id,
                    workgroupId
                );
            } else if (local.name !== er.name || local.color !== er.color) {
                await repo.update(local.id, { name: er.name, color: er.color });
            }
        } catch (err) {
            logger.warn(err, "WorkgroupReconciler: role reconcile failed for %s", er.id);
        }
    }

    for (const local of localRoles) {
        if (envelopeIds.has(local.id)) continue;
        try {
            await wmrRepo().delete({ role_id: local.id });
            await repo.delete(local.id);
            logger.warn(
                "WorkgroupReconciler: deleted role %s for workgroup %s (absent from eVault)",
                local.id,
                workgroupId
            );
        } catch (err) {
            logger.warn(err, "WorkgroupReconciler: role delete failed for %s", local.id);
        }
    }
}

async function reconcileMembers(workgroupId: string, envelopeMembers: WorkgroupEnvelopePayload["members"]): Promise<void> {
    const localMemberships = await wgmRepo().find({ where: { workgroup_id: workgroupId } });
    const localByPersonId = new Map(localMemberships.map((m) => [m.person_id, m]));
    const matchedPersonIds = new Set<string>();

    for (const em of envelopeMembers) {
        try {
            const person = await personRepo().findOne({ where: { meta_envelope_id: em.participantId } });
            if (!person) continue;
            matchedPersonIds.add(person.id);

            let local = localByPersonId.get(person.id);
            if (!local) {
                local = await wgmRepo().save(
                    wgmRepo().create({ workgroup_id: workgroupId, person_id: person.id, is_workgroup_admin: false })
                );
                logger.warn(
                    "WorkgroupReconciler: created membership for person %s in workgroup %s (present in eVault, missing locally)",
                    person.id,
                    workgroupId
                );
            }

            await reconcileMemberRoles(local.id, em.roleIds);
        } catch (err) {
            logger.warn(err, "WorkgroupReconciler: member reconcile failed for %s", em.participantId);
        }
    }

    const unmatchedLocal = localMemberships.filter((local) => !matchedPersonIds.has(local.person_id));
    const unmatchedPersonIds = unmatchedLocal.map((local) => local.person_id);
    const unmatchedPersons = unmatchedPersonIds.length
        ? await personRepo().find({ where: { id: In(unmatchedPersonIds) } })
        : [];
    const unmatchedPersonById = new Map(unmatchedPersons.map((p) => [p.id, p]));

    for (const local of unmatchedLocal) {
        // Same eligibility gate as OrganizationReconciler.reconcileRoster: a person with
        // no ename/meta_envelope_id could never have appeared in members[], so their
        // absence here is not evidence of removal.
        const person = unmatchedPersonById.get(local.person_id);
        if (!person || !person.ename || !person.meta_envelope_id) continue;

        try {
            await wmrRepo().delete({ workgroup_membership_id: local.id });
            await wgmRepo().delete(local.id);
            logger.warn(
                "WorkgroupReconciler: deleted membership %s for workgroup %s (absent from eVault members)",
                local.id,
                workgroupId
            );
        } catch (err) {
            logger.warn(err, "WorkgroupReconciler: membership delete failed for %s", local.id);
        }
    }
}

export async function reconcileWorkgroupFromEvault(
    communityId: string,
    metaEnvelopeId: string,
    payload: WorkgroupEnvelopePayload
): Promise<void> {
    let wg = await wgRepo().findOne({ where: { envelope_id: metaEnvelopeId } });
    const description = payload.description ?? null;
    const chatEnvelopeId = payload.chatId ?? null;

    if (!wg) {
        const maxSortOrder = (await wgRepo().maximum("sort_order", { community_id: communityId }) as number | null) ?? -1;
        wg = await wgRepo().save(
            wgRepo().create({
                community_id: communityId,
                name: payload.name,
                description,
                color: payload.color,
                chat_envelope_id: chatEnvelopeId,
                sort_order: maxSortOrder + 1,
                envelope_id: metaEnvelopeId,
            })
        );
        logger.warn(
            "WorkgroupReconciler: bootstrapped workgroup %s for community %s (present in eVault, missing locally)",
            metaEnvelopeId,
            communityId
        );
    } else if (
        wg.name !== payload.name ||
        wg.description !== description ||
        wg.color !== payload.color ||
        wg.chat_envelope_id !== chatEnvelopeId
    ) {
        await wgRepo().update(wg.id, { name: payload.name, description, color: payload.color, chat_envelope_id: chatEnvelopeId });
    }

    await reconcileRoles(wg.id, payload.roles);
    await reconcileMembers(wg.id, payload.members);
}

export async function reconcileWorkgroupPacket(
    communityEname: string,
    metaEnvelopeId: string,
    payload: WorkgroupEnvelopePayload
): Promise<void> {
    const community = await communityRepo().findOne({ where: { ename: communityEname } });
    if (!community) {
        logger.warn("WorkgroupReconciler: no local community found for ename %s", communityEname);
        return;
    }
    await reconcileWorkgroupFromEvault(community.id, metaEnvelopeId, payload);
}

export async function reconcileWorkgroupsForCommunity(communityId: string): Promise<void> {
    const community = await communityRepo().findOne({ where: { id: communityId } });
    if (!community?.ename) return;

    const envelopes = await findEnvelopesByOntology(community.ename, ONTOLOGIES.Workgroup, 500);
    const envelopeIds = new Set(envelopes.map((e) => e.id));

    for (const envelope of envelopes) {
        if (!envelope.parsed) continue;
        try {
            await reconcileWorkgroupFromEvault(communityId, envelope.id, envelope.parsed as unknown as WorkgroupEnvelopePayload);
        } catch (err) {
            logger.warn(err, "WorkgroupReconciler: reconcile failed for envelope %s", envelope.id);
        }
    }

    const localWorkgroups = await wgRepo().find({ where: { community_id: communityId } });
    for (const local of localWorkgroups) {
        if (local.envelope_id && envelopeIds.has(local.envelope_id)) continue;

        if (!local.envelope_id) {
            // Reverse self-heal (Axiom 2): this workgroup never completed its initial
            // sync — syncWorkgroupToEvault's create/update calls are fire-and-forget
            // everywhere except deleteWorkgroup (see WorkgroupService.ts). Re-push it.
            try {
                await syncWorkgroupToEvault(local.id);
                logger.warn(
                    "WorkgroupReconciler: self-healed unsynced workgroup %s for community %s",
                    local.id,
                    communityId
                );
            } catch (err) {
                logger.warn(err, "WorkgroupReconciler: self-heal failed for workgroup %s", local.id);
            }
            continue;
        }

        // Synced once (non-null envelope_id) but now absent from eVault's current list —
        // genuinely deleted by another platform (Axiom 1: re-pushing would resurrect it).
        // No DB-level FK cascade exists, so cascade manually.
        try {
            const memberships = await wgmRepo().find({ where: { workgroup_id: local.id } });
            const membershipIds = memberships.map((m) => m.id);
            if (membershipIds.length) await wmrRepo().delete({ workgroup_membership_id: In(membershipIds) });
            await wgmRepo().delete({ workgroup_id: local.id });
            await roleRepo().delete({ workgroup_id: local.id });
            await wgRepo().delete(local.id);
            logger.warn(
                "WorkgroupReconciler: deleted workgroup %s for community %s (absent from eVault)",
                local.id,
                communityId
            );
        } catch (err) {
            logger.warn(err, "WorkgroupReconciler: workgroup delete failed for %s", local.id);
        }
    }
}

export async function workgroupReconciliationSweep(): Promise<void> {
    const communities = await communityRepo().find({ where: { provisioning_status: "linked" } });
    for (const community of communities) {
        if (!community.ename) continue;
        try {
            await reconcileWorkgroupsForCommunity(community.id);
        } catch (err) {
            logger.warn(err, "WorkgroupReconciler: sweep failed for community %s", community.id);
        }
    }
}
