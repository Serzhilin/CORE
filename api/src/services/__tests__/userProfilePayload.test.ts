import { buildUserProfilePayload } from "../userProfilePayload";

describe("buildUserProfilePayload", () => {
    it("overwrites displayName, bio, avatarUrl, bannerUrl on top of the existing payload", () => {
        const result = buildUserProfilePayload({
            existing: { isVerified: true, followers: ["@a"], displayName: "Old Name", bio: "Old bio" },
            displayName: "New Name",
            bio: "New bio",
            avatarUrl: "w3ds://file?id=@user/env-1",
            bannerUrl: "w3ds://file?id=@user/env-2",
        });
        expect(result).toEqual({
            isVerified: true,
            followers: ["@a"],
            displayName: "New Name",
            bio: "New bio",
            avatarUrl: "w3ds://file?id=@user/env-1",
            bannerUrl: "w3ds://file?id=@user/env-2",
        });
    });

    it("preserves fields on the existing payload that CORE does not own", () => {
        const result = buildUserProfilePayload({
            existing: { ename: "@user", isPrivate: false, username: "woonwolf" },
            displayName: null,
            bio: null,
            avatarUrl: null,
            bannerUrl: null,
        });
        expect(result.ename).toBe("@user");
        expect(result.isPrivate).toBe(false);
        expect(result.username).toBe("woonwolf");
    });

    it("writes null for the 4 owned fields when given null, rather than omitting them", () => {
        const result = buildUserProfilePayload({ existing: {}, displayName: null, bio: null, avatarUrl: null, bannerUrl: null });
        expect(result).toEqual({ displayName: null, bio: null, avatarUrl: null, bannerUrl: null });
    });

    it("never introduces email, phone, firstName, or lastName — CORE never owns these fields", () => {
        const result = buildUserProfilePayload({
            existing: { username: "woonwolf", ename: "@user", isVerified: true },
            displayName: "New Name",
            bio: "bio text",
            avatarUrl: null,
            bannerUrl: null,
        });
        expect(result).not.toHaveProperty("email");
        expect(result).not.toHaveProperty("phone");
        expect(result).not.toHaveProperty("firstName");
        expect(result).not.toHaveProperty("lastName");
    });
});
