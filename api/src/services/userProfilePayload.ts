export interface UserProfilePayloadInput {
    existing: Record<string, unknown>;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
}

export function buildUserProfilePayload(input: UserProfilePayloadInput): Record<string, unknown> {
    return {
        ...input.existing,
        displayName: input.displayName,
        bio: input.bio,
        avatarUrl: input.avatarUrl,
        bannerUrl: input.bannerUrl,
    };
}
