import { Request, Response } from "express";
import { logger } from "../lib/logger";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { upsertFromWebhook } from "../services/PersonService";

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
        if (packet.schemaId === ONTOLOGIES.User) {
            await upsertFromWebhook(packet.w3id, packet.id, packet.data ?? {});
        }
    } catch (err) {
        logger.warn(err, "Webhook processing failed for %s / %s", packet.w3id, packet.schemaId);
    }
}
