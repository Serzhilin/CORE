import { ONTOLOGIES } from "../ontology";
import { getRegisteredOntologies, dispatchPacket, _resetForTests } from "../packetDispatch";

jest.mock("../../../services/PersonService", () => ({
    upsertFromWebhook: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../services/OrganizationReconciler", () => ({
    reconcileOrganizationPacket: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../services/AvailabilityReconciler", () => ({
    reconcileAvailabilityPacket: jest.fn().mockResolvedValue(undefined),
}));

import { upsertFromWebhook } from "../../../services/PersonService";
import { reconcileOrganizationPacket } from "../../../services/OrganizationReconciler";
import { reconcileAvailabilityPacket } from "../../../services/AvailabilityReconciler";
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

    it("registers a handler for ONTOLOGIES.Organization", () => {
        registerOntologyHandlers();

        expect(getRegisteredOntologies()).toContain(ONTOLOGIES.Organization);
    });

    it("routes Organization packets to reconcileOrganizationPacket with ename and data", async () => {
        registerOntologyHandlers();

        await dispatchPacket(ONTOLOGIES.Organization, "@community-ename", "meta-2", { name: "Test Community" });

        expect(reconcileOrganizationPacket).toHaveBeenCalledWith("@community-ename", { name: "Test Community" });
    });

    it("registers a handler for ONTOLOGIES.Availability", () => {
        registerOntologyHandlers();

        expect(getRegisteredOntologies()).toContain(ONTOLOGIES.Availability);
    });

    it("routes Availability packets to reconcileAvailabilityPacket with ename and data", async () => {
        registerOntologyHandlers();

        await dispatchPacket(ONTOLOGIES.Availability, "@community-ename", "meta-3", { statuses: [], entries: [] });

        expect(reconcileAvailabilityPacket).toHaveBeenCalledWith("@community-ename", { statuses: [], entries: [] });
    });
});
