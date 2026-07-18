import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Community } from "../database/entities/Community";
import { Person } from "../database/entities/Person";
import { createEnvelope, removeEnvelope } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { buildMembershipPayload } from "./membershipPayload";

const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const communityRepo = () => AppDataSource.getRepository(Community);
const personRepo = () => AppDataSource.getRepository(Person);

/** Creates a Membership envelope in the member's own vault for one CommunityMembership row.
 *  No-op (not an error) if: the row no longer exists, already has an envelope, the community
 *  isn't linked yet (no communityEname available), or the member has no ename yet (no vault
 *  to write into). Safe to call fire-and-forget — self-heals on any future call since it's
 *  idempotent on membership_envelope_id. */
export async function createMembershipEnvelope(membershipId: string): Promise<void> {
    const membership = await membershipRepo().findOne({ where: { id: membershipId } });
    if (!membership || membership.membership_envelope_id) return;

    const community = await communityRepo().findOne({ where: { id: membership.community_id } });
    if (!community || community.provisioning_status !== "linked" || !community.ename) return;

    const person = await personRepo().findOne({ where: { id: membership.person_id } });
    if (!person?.ename) return;

    const payload = buildMembershipPayload({
        communityEname: community.ename,
        joinedAt: membership.created_at.toISOString(),
    });

    const envelopeId = await createEnvelope({
        vaultEname: person.ename,
        ontology: ONTOLOGIES.Membership,
        payload: { ...payload },
        acl: [person.ename, community.ename],
    });

    await membershipRepo().update(membership.id, { membership_envelope_id: envelopeId });
}

/** Deletes a CommunityMembership row's Membership envelope from the member's own vault.
 *  No-op if the row has no envelope (never created, or community was never linked).
 *  Throws (does not swallow) if the row has an envelope but the owning Person has no
 *  ename — that combination should be impossible (ename is never cleared once set on a
 *  Person that already has a membership envelope) and signals a data-integrity bug that
 *  must not fail silently. */
export async function deleteMembershipEnvelope(membershipId: string): Promise<void> {
    const membership = await membershipRepo().findOneOrFail({ where: { id: membershipId } });
    if (!membership.membership_envelope_id) return;

    const person = await personRepo().findOneOrFail({ where: { id: membership.person_id } });
    if (!person.ename) {
        throw new Error(
            `Person ${person.id} has no ename but owns Membership envelope ${membership.membership_envelope_id}`
        );
    }

    await removeEnvelope(person.ename, membership.membership_envelope_id);
}
