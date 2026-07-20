import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { findEnvelopesByOntology } from "../lib/evault-client";
import { logger } from "../lib/logger";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { AvailabilityEnvelopePayload } from "./availabilityPayload";
import { reconcileAvailabilityFromEvault } from "./AvailabilityReconciler";

const communityRepo = () => AppDataSource.getRepository(Community);

const lastReconciledAt = new Map<string, number>();

export function shouldReconcile(
    lastReconciledAtMs: number | undefined,
    nowMs: number,
    debounceMs = 60_000
): boolean {
    if (lastReconciledAtMs === undefined) return true;
    return nowMs - lastReconciledAtMs >= debounceMs;
}

export async function triggerAvailabilityReconcile(communityId: string): Promise<void> {
    const now = Date.now();
    if (!shouldReconcile(lastReconciledAt.get(communityId), now)) return;
    lastReconciledAt.set(communityId, now);

    const community = await communityRepo().findOne({ where: { id: communityId } });
    if (!community?.ename) return;

    const envelopes = await findEnvelopesByOntology(community.ename, ONTOLOGIES.Availability, 1);
    const payload = envelopes[0]?.parsed as unknown as AvailabilityEnvelopePayload | null;
    if (!payload) return;

    await reconcileAvailabilityFromEvault(communityId, payload);
}

// Test-only: clears the debounce map between test files so state doesn't leak.
export function _resetForTests(): void {
    lastReconciledAt.clear();
}
