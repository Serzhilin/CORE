import { Request, Response } from "express";
import { logger } from "../lib/logger";
import { dispatchPacket } from "../lib/w3ds/packetDispatch";

interface WebhookPacket {
    id: string;
    w3id: string;
    schemaId: string;
    data: Record<string, unknown>;
    evaultPublicKey?: string;
}

// Awareness Protocol delivery: fire-and-forget, no retries, no auth. Respond 200 immediately
// and process async — must be idempotent since duplicate/out-of-order delivery is possible.
export async function handleWebhook(req: Request, res: Response) {
    res.status(200).json({ received: true });

    const packet = req.body as WebhookPacket;
    if (!packet?.id || !packet?.w3id || !packet?.schemaId) return;

    try {
        await dispatchPacket(packet.schemaId, packet.w3id, packet.id, packet.data ?? {});
    } catch (err) {
        logger.warn(err, "Webhook processing failed for %s / %s", packet.w3id, packet.schemaId);
    }
}
