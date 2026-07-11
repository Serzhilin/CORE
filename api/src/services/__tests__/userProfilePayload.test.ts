import { buildUserProfilePayload } from "../userProfilePayload";

describe("buildUserProfilePayload", () => {
    it("overwrites displayName, bio, avatarUrl, bannerUrl, email, phone, website, location, birthDate on top of the existing payload", () => {
        const result = buildUserProfilePayload({
            existing: { isVerified: true, followers: ["@a"], displayName: "Old Name", bio: "Old bio" },
            displayName: "New Name",
            bio: "New bio",
            avatarUrl: "w3ds://file?id=@user/env-1",
            bannerUrl: "w3ds://file?id=@user/env-2",
            email: "new@example.com",
            phone: "+31600000000",
            website: "https://example.com",
            location: "Amsterdam, NL",
            birthDate: "1990-01-01",
        });
        expect(result).toEqual({
            isVerified: true,
            followers: ["@a"],
            displayName: "New Name",
            bio: "New bio",
            avatarUrl: "w3ds://file?id=@user/env-1",
            bannerUrl: "w3ds://file?id=@user/env-2",
            email: "new@example.com",
            phone: "+31600000000",
            website: "https://example.com",
            location: "Amsterdam, NL",
            birthDate: "1990-01-01",
        });
    });

    it("preserves fields on the existing payload that CORE does not own", () => {
        const result = buildUserProfilePayload({
            existing: { ename: "@user", isPrivate: false, username: "woonwolf" },
            displayName: null,
            bio: null,
            avatarUrl: null,
            bannerUrl: null,
            email: null,
            phone: null,
            website: null,
            location: null,
            birthDate: null,
        });
        expect(result.ename).toBe("@user");
        expect(result.isPrivate).toBe(false);
        expect(result.username).toBe("woonwolf");
    });

    it("writes null for the owned fields when given null, rather than omitting them", () => {
        const result = buildUserProfilePayload({
            existing: {}, displayName: null, bio: null, avatarUrl: null, bannerUrl: null,
            email: null, phone: null, website: null, location: null, birthDate: null,
        });
        expect(result).toEqual({
            displayName: null, bio: null, avatarUrl: null, bannerUrl: null,
            email: null, phone: null, website: null, location: null, birthDate: null,
        });
    });

    it("never introduces firstName or lastName — CORE never owns these fields", () => {
        const result = buildUserProfilePayload({
            existing: { username: "woonwolf", ename: "@user", isVerified: true },
            displayName: "New Name",
            bio: "bio text",
            avatarUrl: null,
            bannerUrl: null,
            email: null,
            phone: null,
            website: null,
            location: null,
            birthDate: null,
        });
        expect(result).not.toHaveProperty("firstName");
        expect(result).not.toHaveProperty("lastName");
    });
});
