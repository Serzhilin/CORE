import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { findEnvelopesByOntology } from "../lib/evault-client";
import { logger } from "../lib/logger";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { OrganizationEnvelopePayload } from "./organizationPayload";
import { reconcileOrganizationFromEvault } from "./OrganizationReconciler";

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

export async function triggerOrganizationReconcile(communityId: string): Promise<void> {
    const now = Date.now();
    if (!shouldReconcile(lastReconciledAt.get(communityId), now)) return;
    lastReconciledAt.set(communityId, now);

    const community = await communityRepo().findOne({ where: { id: communityId } });
    if (!community?.ename) return;

    const envelopes = await findEnvelopesByOntology(community.ename, ONTOLOGIES.Organization, 1);
    const payload = envelopes[0]?.parsed as unknown as OrganizationEnvelopePayload | null;
    if (!payload) return;

    await reconcileOrganizationFromEvault(communityId, payload);
}

// Test-only: clears the debounce map between test files so state doesn't leak.
export function _resetForTests(): void {
    lastReconciledAt.clear();
}
