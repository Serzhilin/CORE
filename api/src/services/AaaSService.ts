import axios from "axios";
import { logger } from "../lib/logger";
import { dispatchPacket, getRegisteredOntologies } from "../lib/w3ds/packetDispatch";

const AAAS_URL = process.env.AAAS_BASE_URL || "https://aaas.w3ds.metastate.foundation";

interface AaaSPacket {
    id: string;
    w3id: string;
    ontology: string;
    data: Record<string, unknown> | null;
}

interface PacketsPage {
    packets: AaaSPacket[];
    hasMore?: boolean;
    nextCursor?: string | null;
}

// In-memory cursor — resets on restart, which is fine (we'll re-process recent packets).
let lastPolledAt: string = new Date(Date.now() - 5 * 60 * 1000).toISOString();

async function fetchPacketsPage(ontology: string, cursor?: string): Promise<PacketsPage> {
    const apiKey = process.env.AAAS_API_KEY;
    if (!apiKey) return { packets: [] };

    const params = new URLSearchParams({ ontology, from: lastPolledAt, limit: "100" });
    if (cursor) params.set("cursor", cursor);

    const res = await axios.get<PacketsPage>(`${AAAS_URL}/api/packets?${params}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15_000,
    });
    return { packets: res.data.packets ?? [], hasMore: res.data.hasMore, nextCursor: res.data.nextCursor };
}

async function pollOntology(ontology: string): Promise<number> {
    let cursor: string | undefined;
    let total = 0;
    for (let page = 0; page < 50; page++) {
        const { packets, hasMore, nextCursor } = await fetchPacketsPage(ontology, cursor);
        total += packets.length;
        for (const packet of packets) {
            await dispatchPacket(packet.ontology, packet.w3id, packet.id, packet.data ?? {}).catch((err) =>
                logger.warn(err, "AaaS: failed to handle packet %s", packet.id)
            );
        }
        if (!hasMore || !nextCursor) break;
        cursor = nextCursor;
    }
    return total;
}

export async function pollOnce(): Promise<void> {
    if (!process.env.AAAS_API_KEY) return;

    const pollStartedAt = new Date().toISOString();
    try {
        let total = 0;
        for (const ontology of getRegisteredOntologies()) {
            total += await pollOntology(ontology);
        }
        if (total > 0) logger.info({ count: total }, "AaaS: processed packets");
        lastPolledAt = pollStartedAt;
    } catch (err) {
        logger.warn(err, "AaaS: poll failed");
    }
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startPolling(intervalMs = 60_000): void {
    if (!process.env.AAAS_API_KEY) {
        logger.info("AaaS: AAAS_API_KEY not set — polling disabled");
        return;
    }
    if (pollInterval) return;
    logger.info({ intervalMs }, "AaaS: polling started");
    pollOnce();
    pollInterval = setInterval(pollOnce, intervalMs);
}

export function stopPolling(): void {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}
