import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { Workgroup } from "../database/entities/Workgroup";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Person } from "../database/entities/Person";
import { createEnvelope, updateEnvelope, getEnvelope, getUserMetaEnvelopeId } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { logger } from "../lib/logger";
import {
    mergeCommunityChatFields,
    addParticipant,
    removeParticipant,
    renameChat,
    archiveChat,
    buildNewChatPayload,
} from "./chatPayloadHelpers";

// This module reuses ONTOLOGIES.Community (schemaId 550e8400-e29b-41d4-a716-446655440003)
// for BOTH the community-level chat and every workgroup chat — it is the platform's
// generic Chat/Group ontology, not specific to the community entity. The constant name
// is a pre-existing naming choice from before this feature; not renamed here.

const communityRepo = () => AppDataSource.getRepository(Community);
const workgroupRepo = () => AppDataSource.getRepository(Workgroup);
const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const personRepo = () => AppDataSource.getRepository(Person);

async function resolveParticipant(personId: string): Promise<{ metaId: string; ename: string } | null> {
    const person = await personRepo().findOne({ where: { id: personId } });
    if (!person?.ename) return null;
    let metaId = person.meta_envelope_id;
    if (!metaId) {
        metaId = await getUserMetaEnvelopeId(person.ename);
        if (metaId) await personRepo().update(person.id, { meta_envelope_id: metaId });
    }
    if (!metaId) return null;
    return { metaId, ename: person.ename };
}

// ── Community chat ──────────────────────────────────────────────────────────

/** Used once at link time. If envelopeId is set (the target eName already has a
 *  Chat/Group envelope), just persists it. If null, creates a fresh one seeded from
 *  the community being linked, so every linked community ends up with a chat. */
export async function getOrCreateCommunityChatId(communityId: string, envelopeId: string | null): Promise<void> {
    const community = await communityRepo().findOneOrFail({ where: { id: communityId } });
    if (envelopeId) {
        await communityRepo().update(community.id, { chat_envelope_id: envelopeId });
        return;
    }
    if (!community.ename) return;
    const payload = buildNewChatPayload({ name: community.name, participantIds: [], members: [] });
    const newEnvelopeId = await createEnvelope({
        vaultEname: community.ename,
        ontology: ONTOLOGIES.Community,
        payload,
        acl: ["*"],
    });
    await communityRepo().update(community.id, { chat_envelope_id: newEnvelopeId });
}

/** Fetch-merge-write: rebuilds name/description/avatar/participantIds/members from current
 *  Community + membership state, preserving every other field. Fire-and-forget caller. */
export async function syncCommunityChatToEvault(communityId: string): Promise<void> {
    const community = await communityRepo().findOne({ where: { id: communityId } });
    if (!community?.chat_envelope_id || !community.ename) {
        logger.warn("Skipping community chat sync for %s — no chat_envelope_id linked", communityId);
        return;
    }

    const current = await getEnvelope(community.ename, community.chat_envelope_id);
    if (!current) {
        logger.warn("Community chat envelope fetch failed for %s, skipping sync", communityId);
        return;
    }

    const memberships = await membershipRepo().find({ where: { community_id: communityId } });
    const participantIds: string[] = [];
    const members: string[] = [];
    for (const m of memberships) {
        const p = await resolveParticipant(m.person_id);
        if (!p) continue;
        participantIds.push(p.metaId);
        members.push(p.ename);
    }

    const merged = mergeCommunityChatFields(current, {
        name: community.name,
        description: community.description,
        avatar: community.logo_url,
        participantIds,
        members,
    });

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: community.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: merged,
        acl: ["*"],
    });
}

/** Fire-and-forget caller. Splices one person in without touching anything else. */
export async function addPersonToCommunityChat(communityId: string, personId: string): Promise<void> {
    const community = await communityRepo().findOne({ where: { id: communityId } });
    if (!community?.chat_envelope_id || !community.ename) {
        logger.warn("Skipping community chat add for %s — no chat_envelope_id linked", communityId);
        return;
    }
    const p = await resolveParticipant(personId);
    if (!p) return;

    const current = await getEnvelope(community.ename, community.chat_envelope_id);
    if (!current) {
        logger.warn("Community chat envelope fetch failed for %s, skipping add", communityId);
        return;
    }

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: community.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: addParticipant(current, p.metaId, p.ename),
        acl: ["*"],
    });
}

/** Synchronous caller (blocks the Postgres member removal). Throws if the envelope fetch
 *  fails so the caller's delete does not silently proceed while the chat still lists them. */
export async function removePersonFromCommunityChat(communityId: string, personId: string): Promise<void> {
    const community = await communityRepo().findOne({ where: { id: communityId } });
    if (!community?.chat_envelope_id || !community.ename) {
        logger.warn("Skipping community chat removal for %s — no chat_envelope_id linked", communityId);
        return;
    }
    const p = await resolveParticipant(personId);
    if (!p) return;

    const current = await getEnvelope(community.ename, community.chat_envelope_id);
    if (!current) {
        throw new Error(`Failed to fetch community chat envelope ${community.chat_envelope_id} for removal`);
    }

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: community.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: removeParticipant(current, p.metaId, p.ename),
        acl: ["*"],
    });
}

/** Fire-and-forget caller. Re-prefixes every child workgroup chat's name with the new
 *  community name by calling renameWorkgroupChat with each workgroup's own (unchanged) name. */
export async function cascadeCommunityRenameToWorkgroupChats(communityId: string, _newCommunityName: string): Promise<void> {
    const workgroups = await workgroupRepo().find({ where: { community_id: communityId } });
    for (const wg of workgroups) {
        if (!wg.chat_envelope_id) continue;
        await renameWorkgroupChat(wg.id, wg.name).catch((err) =>
            logger.warn(err, "Workgroup chat rename failed for %s during community rename", wg.id)
        );
    }
}

// ── Workgroup chat ──────────────────────────────────────────────────────────

/** Creates a fresh envelope named "<community name>: <workgroup name>", persists the id.
 *  Returns null (not an error) if the community isn't linked yet. Throws on eVault failure. */
export async function createWorkgroupChat(workgroupId: string): Promise<string | null> {
    const wg = await workgroupRepo().findOneOrFail({ where: { id: workgroupId } });
    const community = await communityRepo().findOne({ where: { id: wg.community_id } });
    if (!community?.ename) {
        logger.warn("Cannot create workgroup chat for %s — community not linked", workgroupId);
        return null;
    }

    const payload = buildNewChatPayload({
        name: `${community.name}: ${wg.name}`,
        participantIds: [],
        members: [],
    });
    const envelopeId = await createEnvelope({
        vaultEname: community.ename,
        ontology: ONTOLOGIES.Community,
        payload,
        acl: ["*"],
    });
    await workgroupRepo().update(wg.id, { chat_envelope_id: envelopeId });
    return envelopeId;
}

/** Fire-and-forget caller. */
export async function renameWorkgroupChat(workgroupId: string, newWorkgroupName: string): Promise<void> {
    const wg = await workgroupRepo().findOne({ where: { id: workgroupId } });
    if (!wg?.chat_envelope_id) {
        logger.warn("Skipping workgroup chat rename for %s — no chat_envelope_id", workgroupId);
        return;
    }
    const community = await communityRepo().findOne({ where: { id: wg.community_id } });
    if (!community?.ename) return;

    const current = await getEnvelope(community.ename, wg.chat_envelope_id);
    if (!current) {
        logger.warn("Workgroup chat envelope fetch failed for %s, skipping rename", workgroupId);
        return;
    }

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: wg.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: renameChat(current, `${community.name}: ${newWorkgroupName}`),
        acl: ["*"],
    });
}

/** Synchronous caller (blocks workgroup deletion). Throws if the envelope fetch fails. */
export async function archiveWorkgroupChat(workgroupId: string): Promise<void> {
    const wg = await workgroupRepo().findOne({ where: { id: workgroupId } });
    if (!wg?.chat_envelope_id) {
        logger.warn("Skipping workgroup chat archive for %s — no chat_envelope_id", workgroupId);
        return;
    }
    const community = await communityRepo().findOne({ where: { id: wg.community_id } });
    if (!community?.ename) return;

    const current = await getEnvelope(community.ename, wg.chat_envelope_id);
    if (!current) {
        throw new Error(`Failed to fetch workgroup chat envelope ${wg.chat_envelope_id} for archive`);
    }

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: wg.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: archiveChat(current),
        acl: ["*"],
    });
}

/** Fire-and-forget caller. */
export async function addPersonToWorkgroupChat(workgroupId: string, personId: string): Promise<void> {
    const wg = await workgroupRepo().findOne({ where: { id: workgroupId } });
    if (!wg?.chat_envelope_id) {
        logger.warn("Skipping workgroup chat add for %s — no chat_envelope_id", workgroupId);
        return;
    }
    const community = await communityRepo().findOne({ where: { id: wg.community_id } });
    if (!community?.ename) return;
    const p = await resolveParticipant(personId);
    if (!p) return;

    const current = await getEnvelope(community.ename, wg.chat_envelope_id);
    if (!current) {
        logger.warn("Workgroup chat envelope fetch failed for %s, skipping add", workgroupId);
        return;
    }

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: wg.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: addParticipant(current, p.metaId, p.ename),
        acl: ["*"],
    });
}

/** Synchronous caller when invoked with alsoRemoveFromChat=true. Throws if the envelope
 *  fetch fails so the caller's removal does not silently proceed. */
export async function removePersonFromWorkgroupChat(workgroupId: string, personId: string): Promise<void> {
    const wg = await workgroupRepo().findOne({ where: { id: workgroupId } });
    if (!wg?.chat_envelope_id) {
        logger.warn("Skipping workgroup chat removal for %s — no chat_envelope_id", workgroupId);
        return;
    }
    const community = await communityRepo().findOne({ where: { id: wg.community_id } });
    if (!community?.ename) return;
    const p = await resolveParticipant(personId);
    if (!p) return;

    const current = await getEnvelope(community.ename, wg.chat_envelope_id);
    if (!current) {
        throw new Error(`Failed to fetch workgroup chat envelope ${wg.chat_envelope_id} for removal`);
    }

    await updateEnvelope({
        vaultEname: community.ename,
        envelopeId: wg.chat_envelope_id,
        ontology: ONTOLOGIES.Community,
        payload: removeParticipant(current, p.metaId, p.ename),
        acl: ["*"],
    });
}
