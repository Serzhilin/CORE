import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { AvailabilityLog } from "../database/entities/AvailabilityLog";
import { AvailabilityType } from "../database/entities/AvailabilityType";
import { syncAvailabilityToEvault } from "./AvailabilityEnvelopeService";
import { createAvailabilityLogEnvelope } from "./AvailabilityLogEnvelopeService";
import { logger } from "../lib/logger";

export interface AvailabilityState {
    type_id: string | null;
    reason: string | null;
    from: Date | null;
    until: Date | null;
}

export interface AvailabilityPayload {
    clear: boolean;
    type_id: string | null;
    reason: string | null;
    until: Date | null;
}

export interface AvailabilityChanges {
    log: {
        type_id: string;
        type_name: string;
        type_emoji: string;
        reason: string | null;
        from_date: Date;
        until_date: Date;
    } | null;
    next: AvailabilityState;
}

/** Pure function — no DB access. Computes what changes to make given current state + payload. */
export function computeAvailabilityChanges(
    current: AvailabilityState,
    payload: AvailabilityPayload,
    today: Date,
    typeName = "",
    typeEmoji = ""
): AvailabilityChanges {
    if (payload.clear) {
        const log = current.type_id
            ? {
                  type_id: current.type_id,
                  type_name: typeName,
                  type_emoji: typeEmoji,
                  reason: current.reason,
                  from_date: current.from ?? today,
                  until_date: today,
              }
            : null;
        return { log, next: { type_id: null, reason: null, from: null, until: null } };
    }

    if (payload.type_id === current.type_id && current.type_id !== null) {
        // Same type — extend reason/until, keep from
        return {
            log: null,
            next: { type_id: current.type_id, reason: payload.reason, from: current.from, until: payload.until },
        };
    }

    // New type (or first time)
    const log = current.type_id
        ? {
              type_id: current.type_id,
              type_name: typeName,
              type_emoji: typeEmoji,
              reason: current.reason,
              from_date: current.from ?? today,
              until_date: today,
          }
        : null;
    return {
        log,
        next: { type_id: payload.type_id, reason: payload.reason, from: today, until: payload.until },
    };
}

/** Applies availability change to DB for a given CommunityMembership id. */
export async function applyAvailability(
    membershipId: string,
    payload: AvailabilityPayload
): Promise<CommunityMembership> {
    const atRepo = AppDataSource.getRepository(AvailabilityType);

    const m = await AppDataSource.getRepository(CommunityMembership).findOneOrFail({ where: { id: membershipId } });
    const today = new Date();

    let typeName = "";
    let typeEmoji = "";
    if (m.availability_type_id) {
        const at = await atRepo.findOne({ where: { id: m.availability_type_id } });
        typeName = at?.name ?? "";
        typeEmoji = at?.emoji ?? "";
    }

    const { log, next } = computeAvailabilityChanges(
        {
            type_id: m.availability_type_id,
            reason: m.availability_reason,
            from: m.availability_from,
            until: m.availability_until,
        },
        payload,
        today,
        typeName,
        typeEmoji
    );

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
        if (log) {
            await qr.manager.save(
                qr.manager.create(AvailabilityLog, {
                    community_membership_id: membershipId,
                    type_name: log.type_name,
                    type_emoji: log.type_emoji,
                    reason: log.reason,
                    from_date: log.from_date,
                    until_date: log.until_date,
                })
            );
        }
        m.availability_type_id = next.type_id;
        m.availability_reason = next.reason;
        m.availability_from = next.from;
        m.availability_until = next.until;
        const saved = await qr.manager.save(CommunityMembership, m);
        await qr.commitTransaction();
        syncAvailabilityToEvault(saved.community_id).catch((err) =>
            logger.warn(err, "Availability envelope sync failed for membership %s", membershipId)
        );
        if (log) {
            createAvailabilityLogEnvelope(membershipId, log).catch((err) =>
                logger.warn(err, "AvailabilityLog envelope creation failed for membership %s", membershipId)
            );
        }
        return saved;
    } catch (err) {
        await qr.rollbackTransaction();
        throw err;
    } finally {
        await qr.release();
    }
}
