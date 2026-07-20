export type PacketHandler = (
    w3id: string,
    metaEnvelopeId: string,
    data: Record<string, unknown>
) => Promise<void>;

const handlers = new Map<string, PacketHandler>();

export function registerPacketHandler(ontology: string, handler: PacketHandler): void {
    handlers.set(ontology, handler);
}

export function getRegisteredOntologies(): string[] {
    return [...handlers.keys()];
}

export async function dispatchPacket(
    ontology: string,
    w3id: string,
    metaEnvelopeId: string,
    data: Record<string, unknown>
): Promise<void> {
    const handler = handlers.get(ontology);
    if (!handler) return;
    await handler(w3id, metaEnvelopeId, data);
}

// Test-only: clears registry state between test files so registrations don't leak.
export function _resetForTests(): void {
    handlers.clear();
}
