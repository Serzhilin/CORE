import { registerPacketHandler } from "./packetDispatch";
import { ONTOLOGIES } from "./ontology";
import { upsertFromWebhook } from "../../services/PersonService";
import { reconcileOrganizationPacket } from "../../services/OrganizationReconciler";
import { reconcileAvailabilityPacket } from "../../services/AvailabilityReconciler";

// Called once at startup. Every ontology CORE needs to read back from eVault
// (via webhook or AaaS poll) gets one line here — see packetDispatch.ts.
export function registerOntologyHandlers(): void {
    registerPacketHandler(ONTOLOGIES.User, async (w3id, metaEnvelopeId, data) => {
        await upsertFromWebhook(w3id, metaEnvelopeId, data);
    });

    registerPacketHandler(ONTOLOGIES.Organization, async (w3id, _metaEnvelopeId, data) => {
        await reconcileOrganizationPacket(w3id, data as unknown as import("../../services/organizationPayload").OrganizationEnvelopePayload);
    });

    registerPacketHandler(ONTOLOGIES.Availability, async (w3id, _metaEnvelopeId, data) => {
        await reconcileAvailabilityPacket(w3id, data as unknown as import("../../services/availabilityPayload").AvailabilityEnvelopePayload);
    });
}
