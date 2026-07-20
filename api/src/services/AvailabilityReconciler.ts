import { In } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { AvailabilityType } from "../database/entities/AvailabilityType";
import { Person } from "../database/entities/Person";
import { logger } from "../lib/logger";
import { AvailabilityEnvelopePayload } from "./availabilityPayload";

const communityRepo = () => AppDataSource.getRepository(Community);
const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const availabilityTypeRepo = () => AppDataSource.getRepository(AvailabilityType);
const personRepo = () => AppDataSource.getRepository(Person);

async function reconcileStatuses(
    communityId: string,
    envelopeStatuses: AvailabilityEnvelopePayload["statuses"]
): Promise<void> {
    const repo = availabilityTypeRepo();
    const localTypes = await repo.find({ where: { community_id: communityId, is_archived: false } });
    const localById = new Map(localTypes.map((t) => [t.id, t]));
    const envelopeIds = new Set(envelopeStatuses.map((s) => s.id));

    for (const status of envelopeStatuses) {
        try {
            const local = localById.get(status.id);
            if (!local) {
                const maxSortOrder = localTypes.reduce((max, t) => Math.max(max, t.sort_order), -1);
                await repo.save(
                    repo.create({
                        id: status.id,
                        community_id: communityId,
                        name: status.name,
                        emoji: status.emoji,
                        sort_order: maxSortOrder + 1,
                        is_archived: false,
                    })
                );
                logger.warn(
                    "AvailabilityReconciler: resurrected availability type %s for community %s (present in eVault, missing locally)",
                    status.id,
                    communityId
                );
            } else if (local.name !== status.name || local.emoji !== status.emoji) {
                await repo.update(local.id, { name: status.name, emoji: status.emoji });
            }
        } catch (err) {
            logger.warn(err, "AvailabilityReconciler: status reconcile failed for %s", status.id);
        }
    }

    for (const local of localTypes) {
        if (envelopeIds.has(local.id)) continue;
        try {
            await repo.delete(local.id);
            logger.warn(
                "AvailabilityReconciler: deleted availability type %s for community %s (absent from eVault)",
                local.id,
                communityId
            );
        } catch (err) {
            logger.warn(err, "AvailabilityReconciler: status delete failed for %s", local.id);
        }
    }
}

async function reconcileEntries(
    communityId: string,
    entries: AvailabilityEnvelopePayload["entries"]
): Promise<void> {
    const cmRepo = membershipRepo();
    const localMemberships = await cmRepo.find({ where: { community_id: communityId } });
    const matchedPersonIds = new Set<string>();

    for (const entry of entries) {
        try {
            const person = await personRepo().findOne({ where: { ename: entry.eName } });
            if (!person) continue;
            matchedPersonIds.add(person.id);

            // This reconciler never creates CommunityMembership rows — roster membership
            // itself is OrganizationReconciler's concern, not this one's.
            const local = localMemberships.find((m) => m.person_id === person.id);
            if (!local) continue;

            if (
                local.availability_type_id !== entry.statusId ||
                local.availability_reason !== entry.reason ||
                (local.availability_from as unknown as string | null) !== entry.from ||
                (local.availability_until as unknown as string | null) !== entry.until
            ) {
                await cmRepo.update(local.id, {
                    availability_type_id: entry.statusId,
                    availability_reason: entry.reason,
                    availability_from: entry.from as unknown as Date | null,
                    availability_until: entry.until as unknown as Date | null,
                });
            }
        } catch (err) {
            logger.warn(err, "AvailabilityReconciler: entry reconcile failed for %s", entry.eName);
        }
    }

    // Only memberships that currently HAVE a status set are candidates for clearing —
    // anyone else unmatched is already a no-op.
    const unmatchedLocal = localMemberships.filter(
        (local) => !matchedPersonIds.has(local.person_id) && local.availability_type_id !== null
    );
    const unmatchedPersonIds = unmatchedLocal.map((local) => local.person_id);
    const unmatchedPersons = unmatchedPersonIds.length
        ? await personRepo().find({ where: { id: In(unmatchedPersonIds) } })
        : [];
    const unmatchedPersonById = new Map(unmatchedPersons.map((p) => [p.id, p]));

    for (const local of unmatchedLocal) {
        // Mirrors OrganizationReconciler's roster-deletion fix: a person with no ename or no
        // cached meta_envelope_id could never have appeared in the envelope (see
        // AvailabilityEnvelopeService.ts's own eligibility check), so their absence from
        // entries[] is not evidence their status was cleared — leave them untouched.
        const person = unmatchedPersonById.get(local.person_id);
        if (!person || !person.ename || !person.meta_envelope_id) continue;

        try {
            await cmRepo.update(local.id, {
                availability_type_id: null,
                availability_reason: null,
                availability_from: null,
                availability_until: null,
            });
            logger.warn(
                "AvailabilityReconciler: cleared availability for membership %s in community %s (absent from eVault entries)",
                local.id,
                communityId
            );
        } catch (err) {
            logger.warn(err, "AvailabilityReconciler: entry clear failed for %s", local.id);
        }
    }
}

export async function reconcileAvailabilityFromEvault(
    communityId: string,
    payload: AvailabilityEnvelopePayload
): Promise<void> {
    await reconcileStatuses(communityId, payload.statuses);
    await reconcileEntries(communityId, payload.entries);
}

export async function reconcileAvailabilityPacket(
    communityEname: string,
    payload: AvailabilityEnvelopePayload
): Promise<void> {
    const community = await communityRepo().findOne({ where: { ename: communityEname } });
    if (!community) {
        logger.warn("AvailabilityReconciler: no local community found for ename %s", communityEname);
        return;
    }
    await reconcileAvailabilityFromEvault(community.id, payload);
}
