import { reconcileMembershipsForPerson } from "./MembershipReconciler";

const lastReconciledAt = new Map<string, number>();

export function shouldReconcile(
    lastReconciledAtMs: number | undefined,
    nowMs: number,
    debounceMs = 60_000
): boolean {
    if (lastReconciledAtMs === undefined) return true;
    return nowMs - lastReconciledAtMs >= debounceMs;
}

export async function triggerMembershipReconcile(personId: string): Promise<void> {
    const now = Date.now();
    if (!shouldReconcile(lastReconciledAt.get(personId), now)) return;
    lastReconciledAt.set(personId, now);

    await reconcileMembershipsForPerson(personId);
}

// Test-only: clears the debounce map between test files so state doesn't leak.
export function _resetForTests(): void {
    lastReconciledAt.clear();
}
