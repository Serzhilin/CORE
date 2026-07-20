import { registerPacketHandler, getRegisteredOntologies, dispatchPacket, _resetForTests } from "../packetDispatch";

describe("packetDispatch", () => {
    beforeEach(() => {
        _resetForTests();
    });

    it("dispatches to the handler registered for that ontology", async () => {
        const calls: Array<[string, string, Record<string, unknown>]> = [];
        registerPacketHandler("ontology-a", async (w3id, metaEnvelopeId, data) => {
            calls.push([w3id, metaEnvelopeId, data]);
        });

        await dispatchPacket("ontology-a", "@w3id-1", "meta-1", { foo: "bar" });

        expect(calls).toEqual([["@w3id-1", "meta-1", { foo: "bar" }]]);
    });

    it("does nothing when no handler is registered for the ontology", async () => {
        await expect(dispatchPacket("unregistered-ontology", "@w3id-1", "meta-1", {})).resolves.toBeUndefined();
    });

    it("keeps handlers for different ontologies independent", async () => {
        const aCalls: string[] = [];
        const bCalls: string[] = [];
        registerPacketHandler("ontology-a", async (w3id) => { aCalls.push(w3id); });
        registerPacketHandler("ontology-b", async (w3id) => { bCalls.push(w3id); });

        await dispatchPacket("ontology-a", "@w3id-1", "meta-1", {});
        await dispatchPacket("ontology-b", "@w3id-2", "meta-2", {});

        expect(aCalls).toEqual(["@w3id-1"]);
        expect(bCalls).toEqual(["@w3id-2"]);
    });

    it("getRegisteredOntologies reflects every registered ontology", () => {
        registerPacketHandler("ontology-a", async () => {});
        registerPacketHandler("ontology-b", async () => {});

        expect(getRegisteredOntologies().sort()).toEqual(["ontology-a", "ontology-b"]);
    });

    it("_resetForTests clears all registered handlers", () => {
        registerPacketHandler("ontology-a", async () => {});
        _resetForTests();

        expect(getRegisteredOntologies()).toEqual([]);
    });
});
