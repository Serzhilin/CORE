export interface UserProfilePayloadInput {
    existing: Record<string, unknown>;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    location: string | null;
    birthDate: string | null;
}

export function buildUserProfilePayload(input: UserProfilePayloadInput): Record<string, unknown> {
    return {
        ...input.existing,
        displayName: input.displayName,
        bio: input.bio,
        avatarUrl: input.avatarUrl,
        bannerUrl: input.bannerUrl,
        email: input.email,
        phone: input.phone,
        website: input.website,
        location: input.location,
        birthDate: input.birthDate,
    };
}
