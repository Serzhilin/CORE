import { buildAvailabilityPayload } from "../availabilityPayload";

describe("buildAvailabilityPayload", () => {
    it("maps statuses 1:1", () => {
        const result = buildAvailabilityPayload({
            statuses: [{ id: "type-1", name: "Available", emoji: "🟢", sortOrder: 0 }],
            entries: [],
        });
        expect(result.statuses).toEqual([{ id: "type-1", name: "Available", emoji: "🟢", sortOrder: 0 }]);
    });

    it("includes entries with a statusId", () => {
        const result = buildAvailabilityPayload({
            statuses: [],
            entries: [
                {
                    participantId: "meta-env-1",
                    eName: "@member1",
                    statusId: "type-1",
                    reason: "On holiday",
                    from: "2026-07-01",
                    until: "2026-07-15",
                },
            ],
        });
        expect(result.entries).toEqual([
            {
                participantId: "meta-env-1",
                eName: "@member1",
                statusId: "type-1",
                reason: "On holiday",
                from: "2026-07-01",
                until: "2026-07-15",
            },
        ]);
    });

    it("omits entries with no statusId set", () => {
        const result = buildAvailabilityPayload({
            statuses: [],
            entries: [
                { participantId: "meta-env-1", eName: "@member1", statusId: null, reason: null, from: null, until: null },
            ],
        });
        expect(result.entries).toEqual([]);
    });

    it("returns empty arrays when none given", () => {
        const result = buildAvailabilityPayload({ statuses: [], entries: [] });
        expect(result.statuses).toEqual([]);
        expect(result.entries).toEqual([]);
    });
});
