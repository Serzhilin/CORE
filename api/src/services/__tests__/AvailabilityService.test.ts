import { computeAvailabilityChanges } from "../AvailabilityService";

const TODAY = new Date("2026-04-21");
const TYPE_A = "type-a-uuid";
const TYPE_B = "type-b-uuid";

describe("computeAvailabilityChanges", () => {
    it("clear when no current availability — no log, clears fields", () => {
        const result = computeAvailabilityChanges(
            { type_id: null, reason: null, from: null, until: null },
            { clear: true, type_id: null, reason: null, until: null },
            TODAY
        );
        expect(result.log).toBeNull();
        expect(result.next.type_id).toBeNull();
    });

    it("clear when has availability — writes log with today as until_date", () => {
        const from = new Date("2026-04-01");
        const result = computeAvailabilityChanges(
            { type_id: TYPE_A, reason: "holiday", from, until: null },
            { clear: true, type_id: null, reason: null, until: null },
            TODAY
        );
        expect(result.log).not.toBeNull();
        expect(result.log!.until_date).toEqual(TODAY);
        expect(result.log!.from_date).toEqual(from);
        expect(result.next.type_id).toBeNull();
    });

    it("same type — updates reason and until, from stays unchanged", () => {
        const originalFrom = new Date("2026-04-10");
        const result = computeAvailabilityChanges(
            { type_id: TYPE_A, reason: "old reason", from: originalFrom, until: null },
            { clear: false, type_id: TYPE_A, reason: "new reason", until: new Date("2026-05-01") },
            TODAY
        );
        expect(result.log).toBeNull();
        expect(result.next.from).toEqual(originalFrom);
        expect(result.next.reason).toBe("new reason");
        expect(result.next.until?.toISOString()).toBe(new Date("2026-05-01").toISOString());
    });

    it("different type — logs old, sets new type with from = today", () => {
        const originalFrom = new Date("2026-04-01");
        const result = computeAvailabilityChanges(
            { type_id: TYPE_A, reason: "tired", from: originalFrom, until: null },
            { clear: false, type_id: TYPE_B, reason: "sick now", until: null },
            TODAY
        );
        expect(result.log).not.toBeNull();
        expect(result.log!.until_date).toEqual(TODAY);
        expect(result.next.type_id).toBe(TYPE_B);
        expect(result.next.from).toEqual(TODAY);
        expect(result.next.reason).toBe("sick now");
    });

    it("first time setting availability — no log, sets type and from = today", () => {
        const result = computeAvailabilityChanges(
            { type_id: null, reason: null, from: null, until: null },
            { clear: false, type_id: TYPE_A, reason: "vacation", until: null },
            TODAY
        );
        expect(result.log).toBeNull();
        expect(result.next.type_id).toBe(TYPE_A);
        expect(result.next.from).toEqual(TODAY);
    });
});
