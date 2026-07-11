export interface AvailabilityPayloadStatus {
    id: string;
    name: string;
    emoji: string;
    sortOrder: number;
}

export interface AvailabilityPayloadEntry {
    participantId: string;
    eName: string;
    statusId: string | null;
    reason: string | null;
    from: string | null;
    until: string | null;
}

export interface AvailabilityEnvelopeEntry {
    participantId: string;
    eName: string;
    statusId: string;
    reason: string | null;
    from: string | null;
    until: string | null;
}

export interface AvailabilityPayloadInput {
    statuses: AvailabilityPayloadStatus[];
    entries: AvailabilityPayloadEntry[];
}

export interface AvailabilityEnvelopePayload {
    statuses: AvailabilityPayloadStatus[];
    entries: AvailabilityEnvelopeEntry[];
}

// Members with no status currently set carry no useful information for other platforms —
// omit them rather than syncing a bare participantId/eName pair.
export function buildAvailabilityPayload(input: AvailabilityPayloadInput): AvailabilityEnvelopePayload {
    const entries: AvailabilityEnvelopeEntry[] = [];
    for (const e of input.entries) {
        if (!e.statusId) continue;
        entries.push({
            participantId: e.participantId,
            eName: e.eName,
            statusId: e.statusId,
            reason: e.reason,
            from: e.from,
            until: e.until,
        });
    }
    return {
        statuses: input.statuses,
        entries,
    };
}
