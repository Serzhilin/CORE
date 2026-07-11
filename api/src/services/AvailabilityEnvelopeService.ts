import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { AvailabilityType } from "../database/entities/AvailabilityType";
import { Person } from "../database/entities/Person";
import { createEnvelope, updateEnvelope, getUserMetaEnvelopeId } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { buildAvailabilityPayload } from "./availabilityPayload";

const communityRepo = () => AppDataSource.getRepository(Community);
const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const availabilityTypeRepo = () => AppDataSource.getRepository(AvailabilityType);
const personRepo = () => AppDataSource.getRepository(Person);

/** Syncs community availability statuses + per-member assignments to their own eVault
 *  envelope. Kept separate from the Organization envelope: statuses churn far more often
 *  than legal/branding info, and bundling them would fan out unrelated Awareness Protocol
 *  webhooks to every linked platform on every status flip. */
export async function syncAvailabilityToEvault(communityId: string): Promise<void> {
    const community = await communityRepo().findOne({ where: { id: communityId } });
    if (!community || community.provisioning_status !== "linked" || !community.ename) return;

    const types = await availabilityTypeRepo().find({
        where: { community_id: communityId, is_archived: false },
        order: { sort_order: "ASC" },
    });

    const memberships = await membershipRepo().find({ where: { community_id: communityId } });

    const entries: { participantId: string; eName: string; statusId: string | null; reason: string | null; from: string | null; until: string | null }[] = [];
    for (const m of memberships) {
        if (!m.availability_type_id) continue;
        const person = await personRepo().findOne({ where: { id: m.person_id } });
        if (!person?.ename) continue;
        let metaId = person.meta_envelope_id;
        if (!metaId) {
            metaId = await getUserMetaEnvelopeId(person.ename);
            if (metaId) await personRepo().update(person.id, { meta_envelope_id: metaId });
        }
        if (!metaId) continue;
        entries.push({
            participantId: metaId,
            eName: person.ename,
            statusId: m.availability_type_id,
            reason: m.availability_reason,
            from: m.availability_from ? String(m.availability_from) : null,
            until: m.availability_until ? String(m.availability_until) : null,
        });
    }

    const payload = buildAvailabilityPayload({
        statuses: types.map((t) => ({ id: t.id, name: t.name, emoji: t.emoji, sortOrder: t.sort_order })),
        entries,
    });

    if (community.availability_envelope_id) {
        await updateEnvelope({
            vaultEname: community.ename,
            envelopeId: community.availability_envelope_id,
            ontology: ONTOLOGIES.Availability,
            payload: { ...payload },
            acl: ["*"],
        });
    } else {
        const envelopeId = await createEnvelope({
            vaultEname: community.ename,
            ontology: ONTOLOGIES.Availability,
            payload: { ...payload },
            acl: ["*"],
        });
        await communityRepo().update(community.id, { availability_envelope_id: envelopeId });
    }
}
