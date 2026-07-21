import { shouldReconcile } from "../MembershipReconcileTrigger";

describe("shouldReconcile", () => {
    it("returns true when there is no prior reconcile timestamp", () => {
        expect(shouldReconcile(undefined, 1_000_000)).toBe(true);
    });

    it("returns false when the debounce window has not elapsed", () => {
        expect(shouldReconcile(1_000_000, 1_030_000, 60_000)).toBe(false);
    });

    it("returns true once the debounce window has elapsed", () => {
        expect(shouldReconcile(1_000_000, 1_060_000, 60_000)).toBe(true);
    });

    it("defaults the debounce window to 60 seconds", () => {
        expect(shouldReconcile(1_000_000, 1_059_999)).toBe(false);
        expect(shouldReconcile(1_000_000, 1_060_000)).toBe(true);
    });
});
