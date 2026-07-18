export interface MembershipPayloadInput {
    communityEname: string;
    joinedAt: string;
}

export interface MembershipEnvelopePayload {
    v: 1;
    communityEname: string;
    joinedAt: string;
}

export function buildMembershipPayload(input: MembershipPayloadInput): MembershipEnvelopePayload {
    return {
        v: 1,
        communityEname: input.communityEname,
        joinedAt: input.joinedAt,
    };
}
