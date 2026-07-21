import axios from "axios";

jest.mock("axios");
jest.mock("../../lib/w3ds/packetDispatch", () => ({
    dispatchPacket: jest.fn().mockResolvedValue(undefined),
    getRegisteredOntologies: jest.fn(),
}));

import { dispatchPacket, getRegisteredOntologies } from "../../lib/w3ds/packetDispatch";
import { pollOnce } from "../AaaSService";

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("AaaSService.pollOnce", () => {
    const originalApiKey = process.env.AAAS_API_KEY;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.AAAS_API_KEY = "test-key";
        (getRegisteredOntologies as jest.Mock).mockReturnValue(["ontology-a", "ontology-b"]);
    });

    afterAll(() => {
        process.env.AAAS_API_KEY = originalApiKey;
    });

    it("does nothing when AAAS_API_KEY is not set", async () => {
        delete process.env.AAAS_API_KEY;

        await pollOnce();

        expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("polls every registered ontology and dispatches each packet", async () => {
        mockedAxios.get.mockImplementation((url: string) => {
            if (url.includes("ontology=ontology-a")) {
                return Promise.resolve({ data: { packets: [{ id: "meta-a1", w3id: "@w3id-a", schemaId: "ontology-a", data: { x: 1 } }] } });
            }
            if (url.includes("ontology=ontology-b")) {
                return Promise.resolve({ data: { packets: [{ id: "meta-b1", w3id: "@w3id-b", schemaId: "ontology-b", data: { y: 2 } }] } });
            }
            return Promise.resolve({ data: { packets: [] } });
        });

        await pollOnce();

        expect(dispatchPacket).toHaveBeenCalledWith("ontology-a", "@w3id-a", "meta-a1", { x: 1 });
        expect(dispatchPacket).toHaveBeenCalledWith("ontology-b", "@w3id-b", "meta-b1", { y: 2 });
    });

    it("continues polling remaining ontologies when dispatch fails for one packet", async () => {
        mockedAxios.get.mockResolvedValue({ data: { packets: [{ id: "meta-1", w3id: "@w3id-1", schemaId: "ontology-a", data: {} }] } });
        (dispatchPacket as jest.Mock).mockRejectedValueOnce(new Error("boom"));

        await expect(pollOnce()).resolves.toBeUndefined();
        expect(mockedAxios.get).toHaveBeenCalledTimes(2); // one call per ontology, second ontology still polled
    });
});
