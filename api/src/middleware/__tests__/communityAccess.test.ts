import { isPlatformAdminEname } from "../communityAccess";

describe("isPlatformAdminEname", () => {
    const OLD_ENV = process.env.PLATFORM_ADMIN_ENAMES;
    afterEach(() => { process.env.PLATFORM_ADMIN_ENAMES = OLD_ENV; });

    it("returns false when env var is unset", () => {
        delete process.env.PLATFORM_ADMIN_ENAMES;
        expect(isPlatformAdminEname("@alice")).toBe(false);
    });

    it("returns false when env var is empty string", () => {
        process.env.PLATFORM_ADMIN_ENAMES = "";
        expect(isPlatformAdminEname("@alice")).toBe(false);
    });

    it("matches an ename in a single-entry list", () => {
        process.env.PLATFORM_ADMIN_ENAMES = "@alice";
        expect(isPlatformAdminEname("@alice")).toBe(true);
    });

    it("matches an ename in a comma-separated list, trimming whitespace", () => {
        process.env.PLATFORM_ADMIN_ENAMES = "@alice, @bob , @carol";
        expect(isPlatformAdminEname("@bob")).toBe(true);
        expect(isPlatformAdminEname("@carol")).toBe(true);
    });

    it("returns false for an ename not in the list", () => {
        process.env.PLATFORM_ADMIN_ENAMES = "@alice,@bob";
        expect(isPlatformAdminEname("@mallory")).toBe(false);
    });

    it("returns false for null/undefined ename", () => {
        process.env.PLATFORM_ADMIN_ENAMES = "@alice";
        expect(isPlatformAdminEname(null)).toBe(false);
        expect(isPlatformAdminEname(undefined)).toBe(false);
    });
});
