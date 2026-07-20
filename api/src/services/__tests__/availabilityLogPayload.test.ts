import { buildAvailabilityLogPayload } from "../availabilityLogPayload";

describe("buildAvailabilityLogPayload", () => {
    it("builds a versioned payload with all fields carried through", () => {
        const result = buildAvailabilityLogPayload({
            communityEname: "@community-ename",
            typeName: "Holiday",
            typeEmoji: "🏖️",
            reason: "family trip",
            fromDate: "2026-04-01",
            untilDate: "2026-04-21",
        });

        expect(result).toEqual({
            v: 1,
            communityEname: "@community-ename",
            typeName: "Holiday",
            typeEmoji: "🏖️",
            reason: "family trip",
            fromDate: "2026-04-01",
            untilDate: "2026-04-21",
        });
    });

    it("carries a null reason through unchanged", () => {
        const result = buildAvailabilityLogPayload({
            communityEname: "@community-ename",
            typeName: "Sick",
            typeEmoji: "🤒",
            reason: null,
            fromDate: "2026-05-01",
            untilDate: "2026-05-03",
        });

        expect(result.reason).toBeNull();
    });
});
