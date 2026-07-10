import axios from "axios";
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
import { logger } from "../lib/logger";
import { createEnvelope, getEnvelope, updateEnvelope, findEnvelopesByOntology, getUserMetaEnvelopeId } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";

const communityRepo = () => AppDataSource.getRepository(Community);

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

export async function getById(id: string): Promise<Community | null> {
    return communityRepo().findOne({ where: { id } });
}

export async function getMyCommunities(personId: string): Promise<Community[]> {
    const memberships = await AppDataSource.getRepository(CommunityMembership).find({
        where: { person_id: personId },
    });
    if (!memberships.length) return [];
    return AppDataSource.getRepository(Community).findBy({ id: In(memberships.map(m => m.community_id)) });
}

export async function getAllCommunities(): Promise<Community[]> {
    return communityRepo().find({ order: { name: "ASC" } });
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
                bio: person?.bio ?? null,
                ename: person?.ename ?? null,
                isAdmin: m.is_admin,
                isAspirant: m.is_aspirant,
                isActivePartner: m.is_active_partner,
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
    const community = await communityRepo().findOneOrFail({ where: { id } });
    Object.assign(community, data);
    const saved = await communityRepo().save(community);

    if (saved.provisioning_status === "linked" && saved.ename && saved.community_envelope_id) {
        syncCommunityToEvault(saved).catch((err) =>
            logger.warn(err, "Community envelope update failed for %s", saved.id)
        );
    }

    return saved;
}

async function syncCommunityToEvault(community: Community): Promise<void> {
    const envelope = await getEnvelope(community.ename!, community.community_envelope_id!);
    if (!envelope) return;
    await updateEnvelope({
        vaultEname: community.ename!,
        envelopeId: community.community_envelope_id!,
        ontology: ONTOLOGIES.Community,
        payload: {
            ...envelope,
            name: community.name,
            description: community.description ?? envelope.description,
            avatar: community.logo_url ?? envelope.avatar,
            updatedAt: new Date().toISOString(),
        },
        acl: ["*"],
    });
}

// ── W3DS manual link ──────────────────────────────────────────────────────────

export interface W3idResolution {
    evault_uri: string;
    w3id: string;
    envelopeId: string | null;
    envelope: {
        name: string | null;
        logo_url: string | null;
        description: string | null;
        ownerEname: string | null;
    } | null;
}

/** Resolves a candidate eName and, if it has a Chat envelope already, verifies the acting
 *  person is recognized as its owner/admin before returning envelope details for preview. */
export async function resolveW3id(w3id: string, actingPersonId: string): Promise<W3idResolution> {
    const registryUrl = process.env.PUBLIC_REGISTRY_URL as string;
    const normalized = w3id.startsWith("@") ? w3id : `@${w3id}`;

    let evault_uri: string;
    try {
        const res = await axios.get<{ uri: string }>(
            `${registryUrl}/resolve?w3id=${encodeURIComponent(normalized)}`,
            { timeout: 10_000 }
        );
        evault_uri = res.data.uri;
    } catch {
        throw new Error("w3id_not_found");
    }

    const envelopes = await findEnvelopesByOntology(normalized, ONTOLOGIES.Community);
    if (envelopes.length === 0) {
        return { evault_uri, w3id: normalized, envelopeId: null, envelope: null };
    }

    const env = envelopes[0];
    const payload = env.parsed ?? {};
    const ownerField = (payload.owner as string | null) ?? null;
    const adminsField = Array.isArray(payload.admins) ? (payload.admins as string[]) : [];

    const actor = await AppDataSource.getRepository(Person).findOneOrFail({ where: { id: actingPersonId } });
    if (!actor.ename) throw new Error("actor_has_no_ename");
    const metaId = actor.meta_envelope_id ?? (await getUserMetaEnvelopeId(actor.ename));
    const isAdminByMetaId = metaId ? adminsField.includes(metaId) : false;
    const isAdminByOwner = ownerField === actor.ename;
    if (!isAdminByMetaId && !isAdminByOwner) throw new Error("not_admin");

    return {
        evault_uri,
        w3id: normalized,
        envelopeId: env.id,
        envelope: {
            name: (payload.name as string) ?? null,
            logo_url: (payload.avatar as string | null) ?? null,
            description: (payload.description as string) ?? null,
            ownerEname: ownerField,
        },
    };
}

/** Manually links an already-created local Community to an existing W3DS eName the acting
 *  person owns/administers. If the eName has no Chat envelope yet, creates one. */
export async function linkCommunity(communityId: string, w3id: string, actingPersonId: string): Promise<Community> {
    const community = await communityRepo().findOneOrFail({ where: { id: communityId } });
    if (community.provisioning_status === "linked") throw new Error("already_linked");

    const resolution = await resolveW3id(w3id, actingPersonId);

    const existingW3id = await communityRepo().findOne({ where: { ename: resolution.w3id } });
    if (existingW3id) throw new Error("w3id_already_linked");

    community.ename = resolution.w3id;
    community.evault_uri = resolution.evault_uri;
    community.provisioning_status = "linked";
    community.community_envelope_id = resolution.envelopeId;
    if (resolution.envelope?.name) community.name = resolution.envelope.name;
    if (resolution.envelope?.logo_url) community.logo_url = resolution.envelope.logo_url;
    if (resolution.envelope?.description) community.description = resolution.envelope.description;
    const saved = await communityRepo().save(community);

    if (!resolution.envelopeId) {
        const actor = await AppDataSource.getRepository(Person).findOneOrFail({ where: { id: actingPersonId } });
        const now = new Date().toISOString();
        getUserMetaEnvelopeId(actor.ename!)
            .then((adminMetaId) =>
                createEnvelope({
                    vaultEname: resolution.w3id,
                    ontology: ONTOLOGIES.Community,
                    payload: {
                        ename: resolution.w3id,
                        name: saved.name,
                        type: "group",
                        description: saved.description ?? `${saved.name} — W3DS community`,
                        avatar: saved.logo_url,
                        owner: actor.ename,
                        admins: adminMetaId ? [adminMetaId] : [],
                        participantIds: adminMetaId ? [adminMetaId] : [],
                        createdAt: now,
                        updatedAt: now,
                    },
                    acl: ["*"],
                })
            )
            .then((envelopeId) => communityRepo().update(saved.id, { community_envelope_id: envelopeId }))
            .catch((err) => logger.warn(err, "Community envelope write failed for linked community %s", saved.id));
    }

    return saved;
}

/** Resets a linked community back to local-only. CORE-side only — does not touch the eVault. */
export async function unlinkCommunity(communityId: string): Promise<Community> {
    const community = await communityRepo().findOneOrFail({ where: { id: communityId } });
    community.ename = null;
    community.evault_uri = null;
    community.community_envelope_id = null;
    community.provisioning_status = "unlinked";
    return communityRepo().save(community);
}

export type EnameGroupPreview = {
    evault_uri: string;
    w3id: string;
    envelopeId: string;
    envelope: { name: string; logo_url: string | null; description: string | null };
};

/** Platform-admin-only: resolves an eName and reads its Chat/Community envelope for preview.
 *  Unlike resolveW3id, performs no local-ownership check. Read-only — never writes to the eVault.
 *  Throws "group_not_found" if the eName has no Chat envelope yet. */
export async function resolveEnameForNewCommunity(w3id: string): Promise<EnameGroupPreview> {
    const registryUrl = process.env.PUBLIC_REGISTRY_URL as string;
    const normalized = w3id.startsWith("@") ? w3id : `@${w3id}`;

    let evault_uri: string;
    try {
        const res = await axios.get<{ uri: string }>(
            `${registryUrl}/resolve?w3id=${encodeURIComponent(normalized)}`,
            { timeout: 10_000 }
        );
        evault_uri = res.data.uri;
    } catch {
        throw new Error("w3id_not_found");
    }

    const envelopes = await findEnvelopesByOntology(normalized, ONTOLOGIES.Community);
    if (envelopes.length === 0) throw new Error("group_not_found");

    const env = envelopes[0];
    const payload = env.parsed ?? {};

    return {
        evault_uri,
        w3id: normalized,
        envelopeId: env.id,
        envelope: {
            name: (payload.name as string) ?? normalized,
            logo_url: (payload.avatar as string | null) ?? null,
            description: (payload.description as string | null) ?? null,
        },
    };
}

/** Platform-admin-only: creates a new local Community row directly from an existing eVault
 *  group, already linked. Read-only against the eVault — never writes an envelope. */
export async function createCommunityFromEname(w3id: string, slug: string): Promise<Community> {
    const resolution = await resolveEnameForNewCommunity(w3id);

    const existingEname = await communityRepo().findOne({ where: { ename: resolution.w3id } });
    if (existingEname) throw new Error("w3id_already_linked");

    return AppDataSource.transaction(async (manager) => {
        const community = await manager.save(
            manager.create(Community, {
                name: resolution.envelope.name,
                slug,
                description: resolution.envelope.description,
                logo_url: resolution.envelope.logo_url,
                ename: resolution.w3id,
                evault_uri: resolution.evault_uri,
                community_envelope_id: resolution.envelopeId,
                provisioning_status: "linked",
            })
        );
        await manager.save(
            DEFAULT_AVAILABILITY_TYPES.map((t) =>
                manager.create(AvailabilityType, { ...t, community_id: community.id })
            )
        );
        return community;
    });
}

/** Adds a member's User-profile MetaEnvelope ID to the community's Chat envelope participantIds.
 *  No-op if the community isn't linked to a W3DS eName. */
export async function addParticipantToEnvelope(community: Community, metaEnvelopeId: string): Promise<void> {
    if (community.provisioning_status !== "linked" || !community.ename || !community.community_envelope_id) return;
    const envelope = await getEnvelope(community.ename, community.community_envelope_id);
    if (!envelope) return;
    const participantIds = Array.isArray(envelope.participantIds) ? (envelope.participantIds as string[]) : [];
    if (participantIds.includes(metaEnvelopeId)) return;
    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: community.community_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: { ...envelope, participantIds: [...participantIds, metaEnvelopeId], updatedAt: new Date().toISOString() },
        acl: ["*"],
    });
}

/** Removes a member's MetaEnvelope ID from the community's Chat envelope participantIds. */
export async function removeParticipantFromEnvelope(community: Community, metaEnvelopeId: string): Promise<void> {
    if (community.provisioning_status !== "linked" || !community.ename || !community.community_envelope_id) return;
    const envelope = await getEnvelope(community.ename, community.community_envelope_id);
    if (!envelope) return;
    const participantIds = Array.isArray(envelope.participantIds) ? (envelope.participantIds as string[]) : [];
    if (!participantIds.includes(metaEnvelopeId)) return;
    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: community.community_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: {
            ...envelope,
            participantIds: participantIds.filter((id) => id !== metaEnvelopeId),
            updatedAt: new Date().toISOString(),
        },
        acl: ["*"],
    });
}

/** Inbound Awareness Protocol sync: another platform changed this community's Chat envelope.
 *  Refreshes our cached display fields only — Postgres stays the source of truth for membership. */
export async function syncFromChatWebhook(
    w3id: string,
    metaEnvelopeId: string,
    data: Record<string, unknown>
): Promise<void> {
    const community = await communityRepo().findOne({ where: { ename: w3id } });
    if (!community) return;
    if (typeof data.name === "string") community.name = data.name;
    if (typeof data.description === "string") community.description = data.description;
    if (typeof data.avatar === "string") community.logo_url = data.avatar;
    community.community_envelope_id = metaEnvelopeId;
    await communityRepo().save(community);
}
