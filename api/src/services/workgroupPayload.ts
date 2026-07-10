export interface WorkgroupPayloadRole {
    id: string;
    name: string;
    color: string;
}

export interface WorkgroupPayloadMember {
    participantId: string;
    roleIds: string[];
}

export interface WorkgroupPayloadInput {
    communityEname: string;
    name: string;
    description: string | null;
    color: string;
    createdAt: Date;
    updatedAt: Date;
    roles: WorkgroupPayloadRole[];
    members: WorkgroupPayloadMember[];
}

export interface WorkgroupEnvelopePayload {
    communityId: string;
    name: string;
    description?: string;
    color: string;
    createdAt: string;
    updatedAt: string;
    roles: WorkgroupPayloadRole[];
    members: WorkgroupPayloadMember[];
}

export function buildWorkgroupPayload(input: WorkgroupPayloadInput): WorkgroupEnvelopePayload {
    const payload: WorkgroupEnvelopePayload = {
        communityId: input.communityEname,
        name: input.name,
        color: input.color,
        createdAt: input.createdAt.toISOString(),
        updatedAt: input.updatedAt.toISOString(),
        roles: input.roles,
        members: input.members,
    };
    if (input.description) payload.description = input.description;
    return payload;
}
