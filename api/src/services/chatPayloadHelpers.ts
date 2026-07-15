export interface CommunityChatFields {
    name: string;
    description: string | null;
    avatar: string | null;
    participantIds: string[];
    members: string[];
}

/** Merges CORE-owned fields into an existing Chat envelope payload, preserving every
 *  field CORE doesn't own (charter, owner, admins, signatureIds, type, createdAt,
 *  lastMessageId, isArchived, ename) untouched. */
export function mergeCommunityChatFields(
    current: Record<string, unknown>,
    fields: CommunityChatFields
): Record<string, unknown> {
    return {
        ...current,
        name: fields.name,
        description: fields.description,
        avatar: fields.avatar,
        participantIds: fields.participantIds,
        members: fields.members,
        updatedAt: new Date().toISOString(),
    };
}

/** Adds one participant to a Chat envelope's participantIds/members, idempotently. */
export function addParticipant(
    current: Record<string, unknown>,
    participantId: string,
    memberEname: string
): Record<string, unknown> {
    const participantIds = Array.isArray(current.participantIds) ? (current.participantIds as string[]) : [];
    const members = Array.isArray(current.members) ? (current.members as string[]) : [];
    return {
        ...current,
        participantIds: participantIds.includes(participantId) ? participantIds : [...participantIds, participantId],
        members: members.includes(memberEname) ? members : [...members, memberEname],
    };
}

/** Removes one participant from a Chat envelope's participantIds/members, safely if absent. */
export function removeParticipant(
    current: Record<string, unknown>,
    participantId: string,
    memberEname: string
): Record<string, unknown> {
    const participantIds = Array.isArray(current.participantIds) ? (current.participantIds as string[]) : [];
    const members = Array.isArray(current.members) ? (current.members as string[]) : [];
    return {
        ...current,
        participantIds: participantIds.filter((id) => id !== participantId),
        members: members.filter((m) => m !== memberEname),
    };
}

/** Renames a Chat envelope, touching only the name field. */
export function renameChat(current: Record<string, unknown>, name: string): Record<string, unknown> {
    return { ...current, name };
}

/** Archives a Chat envelope, touching only isArchived. */
export function archiveChat(current: Record<string, unknown>): Record<string, unknown> {
    return { ...current, isArchived: true };
}

export interface NewChatInput {
    name: string;
    participantIds: string[];
    members: string[];
}

/** Builds a brand-new Chat envelope payload (group type) for createEnvelope. */
export function buildNewChatPayload(input: NewChatInput): Record<string, unknown> {
    const now = new Date().toISOString();
    return {
        type: "group",
        name: input.name,
        participantIds: input.participantIds,
        members: input.members,
        createdAt: now,
        updatedAt: now,
        isArchived: false,
    };
}
