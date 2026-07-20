import { registerPacketHandler } from "./packetDispatch";
import { ONTOLOGIES } from "./ontology";
import { upsertFromWebhook } from "../../services/PersonService";

// Called once at startup. Every ontology CORE needs to read back from eVault
// (via webhook or AaaS poll) gets one line here — see packetDispatch.ts.
export function registerOntologyHandlers(): void {
    registerPacketHandler(ONTOLOGIES.User, async (w3id, metaEnvelopeId, data) => {
        await upsertFromWebhook(w3id, metaEnvelopeId, data);
    });
}
