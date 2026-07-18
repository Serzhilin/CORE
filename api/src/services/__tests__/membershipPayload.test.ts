import { buildMembershipPayload } from "../membershipPayload";

describe("buildMembershipPayload", () => {
    it("maps communityEname and joinedAt verbatim, sets v to 1", () => {
        const result = buildMembershipPayload({
            communityEname: "@de68861c-8ea9-55be-9258-2a8cc3057a60",
            joinedAt: "2026-07-18T06:49:01.000Z",
        });
        expect(result).toEqual({
            v: 1,
            communityEname: "@de68861c-8ea9-55be-9258-2a8cc3057a60",
            joinedAt: "2026-07-18T06:49:01.000Z",
        });
    });

    it("carries a different communityEname/joinedAt through unchanged", () => {
        const result = buildMembershipPayload({
            communityEname: "@ff7fab8a-bed8-505e-b9c8-4e1ec6c9c411",
            joinedAt: "2020-01-15T00:00:00.000Z",
        });
        expect(result.communityEname).toBe("@ff7fab8a-bed8-505e-b9c8-4e1ec6c9c411");
        expect(result.joinedAt).toBe("2020-01-15T00:00:00.000Z");
        expect(result.v).toBe(1);
    });
});
