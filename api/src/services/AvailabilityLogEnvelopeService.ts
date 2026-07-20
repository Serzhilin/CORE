import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Community } from "../database/entities/Community";
import { Person } from "../database/entities/Person";
import { createEnvelope } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { buildAvailabilityLogPayload } from "./availabilityLogPayload";

const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const communityRepo = () => AppDataSource.getRepository(Community);
const personRepo = () => AppDataSource.getRepository(Person);

export interface AvailabilityLogInput {
    type_name: string;
    type_emoji: string;
    reason: string | null;
    from_date: Date;
    until_date: Date;
}

/** Creates one immutable AvailabilityLog envelope in the member's own vault for a closed-out
 *  availability period. No-op (not an error) if: the membership row no longer exists, the
 *  community isn't linked yet (no communityEname available), or the member has no ename yet
 *  (no vault to write into) — same guard shape as MembershipEnvelopeService.createMembershipEnvelope.
 *  Unlike that function, this is NOT self-healing: a skipped entry has no single slot to
 *  backfill into later, since every call creates a brand-new envelope. Postgres remains the
 *  durable record of the entry regardless. */
export async function createAvailabilityLogEnvelope(membershipId: string, log: AvailabilityLogInput): Promise<void> {
    const membership = await membershipRepo().findOne({ where: { id: membershipId } });
    if (!membership) return;

    const community = await communityRepo().findOne({ where: { id: membership.community_id } });
    if (!community || community.provisioning_status !== "linked" || !community.ename) return;

    const person = await personRepo().findOne({ where: { id: membership.person_id } });
    if (!person?.ename) return;

    const payload = buildAvailabilityLogPayload({
        communityEname: community.ename,
        typeName: log.type_name,
        typeEmoji: log.type_emoji,
        reason: log.reason,
        fromDate: log.from_date.toISOString(),
        untilDate: log.until_date.toISOString(),
    });

    await createEnvelope({
        vaultEname: person.ename,
        ontology: ONTOLOGIES.AvailabilityLog,
        payload: { ...payload },
        acl: [person.ename, community.ename],
    });
}
