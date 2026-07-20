import { Request, Response } from "express";

jest.mock("../../lib/w3ds/packetDispatch", () => ({
    dispatchPacket: jest.fn().mockResolvedValue(undefined),
}));

import { dispatchPacket } from "../../lib/w3ds/packetDispatch";
import { handleWebhook } from "../WebhookController";

function fakeRes(): Response {
    const res: Partial<Response> = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
    return res as Response;
}

describe("handleWebhook", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("responds 200 immediately regardless of packet contents", async () => {
        const res = fakeRes();
        const req = { body: { id: "meta-1", w3id: "@w3id-1", schemaId: "some-ontology", data: { a: 1 } } } as Request;

        await handleWebhook(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it("dispatches the packet to the registry using schemaId as the ontology", async () => {
        const res = fakeRes();
        const req = { body: { id: "meta-1", w3id: "@w3id-1", schemaId: "some-ontology", data: { a: 1 } } } as Request;

        await handleWebhook(req, res);

        expect(dispatchPacket).toHaveBeenCalledWith("some-ontology", "@w3id-1", "meta-1", { a: 1 });
    });

    it("does not dispatch when required fields are missing", async () => {
        const res = fakeRes();
        const req = { body: { data: { a: 1 } } } as Request;

        await handleWebhook(req, res);

        expect(dispatchPacket).not.toHaveBeenCalled();
    });

    it("swallows dispatch errors without throwing", async () => {
        (dispatchPacket as jest.Mock).mockRejectedValueOnce(new Error("boom"));
        const res = fakeRes();
        const req = { body: { id: "meta-1", w3id: "@w3id-1", schemaId: "some-ontology", data: {} } } as Request;

        await expect(handleWebhook(req, res)).resolves.toBeUndefined();
    });
});
