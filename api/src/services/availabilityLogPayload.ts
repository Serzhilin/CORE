export interface AvailabilityLogPayloadInput {
    communityEname: string;
    typeName: string;
    typeEmoji: string;
    reason: string | null;
    fromDate: string;
    untilDate: string;
}

export interface AvailabilityLogEnvelopePayload {
    v: 1;
    communityEname: string;
    typeName: string;
    typeEmoji: string;
    reason: string | null;
    fromDate: string;
    untilDate: string;
}

export function buildAvailabilityLogPayload(input: AvailabilityLogPayloadInput): AvailabilityLogEnvelopePayload {
    return {
        v: 1,
        communityEname: input.communityEname,
        typeName: input.typeName,
        typeEmoji: input.typeEmoji,
        reason: input.reason,
        fromDate: input.fromDate,
        untilDate: input.untilDate,
    };
}
