import { ONTOLOGIES } from "../ontology";
import { getRegisteredOntologies, dispatchPacket, _resetForTests } from "../packetDispatch";

jest.mock("../../../services/PersonService", () => ({
    upsertFromWebhook: jest.fn().mockResolvedValue(undefined),
}));

import { upsertFromWebhook } from "../../../services/PersonService";
import { registerOntologyHandlers } from "../registerOntologyHandlers";

describe("registerOntologyHandlers", () => {
    beforeEach(() => {
        _resetForTests();
        jest.clearAllMocks();
    });

    it("registers a handler for ONTOLOGIES.User", () => {
        registerOntologyHandlers();

        expect(getRegisteredOntologies()).toContain(ONTOLOGIES.User);
    });

    it("routes User packets to upsertFromWebhook with the same arguments", async () => {
        registerOntologyHandlers();

        await dispatchPacket(ONTOLOGIES.User, "@w3id-1", "meta-1", { displayName: "Ada" });

        expect(upsertFromWebhook).toHaveBeenCalledWith("@w3id-1", "meta-1", { displayName: "Ada" });
    });
});
