// api/src/lib/w3ds/registerReconcilers.ts
import { registerReconciler } from "../../services/ReconciliationService";
import { organizationReconciliationSweep } from "../../services/OrganizationReconciler";
import { availabilityReconciliationSweep } from "../../services/AvailabilityReconciler";

// Called once at startup, alongside registerOntologyHandlers() and before
// startReconciliation() — every entity that cuts its cache over to
// eVault-backed reconciliation gets one line here.
export function registerReconcilers(): void {
    registerReconciler("organization", 60 * 60_000, organizationReconciliationSweep);
    registerReconciler("availability", 60 * 60_000, availabilityReconciliationSweep);
}
