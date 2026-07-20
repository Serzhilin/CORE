import { logger } from "../lib/logger";

export type Reconciler = () => Promise<void>;

interface RegisteredReconciler {
    name: string;
    intervalMs: number;
    fn: Reconciler;
}

const reconcilers: RegisteredReconciler[] = [];
let intervals: ReturnType<typeof setInterval>[] = [];

// Registered by each entity's own migration plan once it cuts its cache over —
// this file has no entity-specific reconcilers wired in yet.
export function registerReconciler(name: string, intervalMs: number, fn: Reconciler): void {
    reconcilers.push({ name, intervalMs, fn });
}

function runReconciler(r: RegisteredReconciler): void {
    r.fn().catch((err) => logger.warn(err, "Reconciliation: %s sweep failed", r.name));
}

export function startReconciliation(): void {
    if (intervals.length > 0) return;
    for (const r of reconcilers) {
        runReconciler(r);
        intervals.push(setInterval(() => runReconciler(r), r.intervalMs));
    }
}

export function stopReconciliation(): void {
    for (const id of intervals) clearInterval(id);
    intervals = [];
}

// Test-only: clears registered reconcilers between test files.
export function _resetForTests(): void {
    stopReconciliation();
    reconcilers.length = 0;
}
