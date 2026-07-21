import { reconcileWorkgroupsForCommunity } from "./WorkgroupReconciler";

const lastReconciledAt = new Map<string, number>();

export function shouldReconcile(
    lastReconciledAtMs: number | undefined,
    nowMs: number,
    debounceMs = 60_000
): boolean {
    if (lastReconciledAtMs === undefined) return true;
    return nowMs - lastReconciledAtMs >= debounceMs;
}

export async function triggerWorkgroupReconcile(communityId: string): Promise<void> {
    const now = Date.now();
    if (!shouldReconcile(lastReconciledAt.get(communityId), now)) return;
    lastReconciledAt.set(communityId, now);

    await reconcileWorkgroupsForCommunity(communityId);
}

// Test-only: clears the debounce map between test files so state doesn't leak.
export function _resetForTests(): void {
    lastReconciledAt.clear();
}
