import { buildWorkgroupPayload } from "../workgroupPayload";

const BASE_INPUT = {
    communityEname: "@de68861c-8ea9-55be-9258-2a8cc3057a60",
    name: "Interiors wg",
    description: null as string | null,
    color: "#5D8C1E",
    createdAt: new Date("2026-07-10T08:35:27.573Z"),
    updatedAt: new Date("2026-07-10T09:20:00.000Z"),
    roles: [],
    members: [],
    chatId: null as string | null,
};

describe("buildWorkgroupPayload", () => {
    it("maps communityEname to communityId", () => {
        const result = buildWorkgroupPayload(BASE_INPUT);
        expect(result.communityId).toBe("@de68861c-8ea9-55be-9258-2a8cc3057a60");
    });

    it("omits description key when null", () => {
        const result = buildWorkgroupPayload(BASE_INPUT);
        expect(result.description).toBeUndefined();
        expect("description" in result).toBe(false);
    });

    it("includes description when present", () => {
        const result = buildWorkgroupPayload({ ...BASE_INPUT, description: "Handles interior design" });
        expect(result.description).toBe("Handles interior design");
    });

    it("formats createdAt/updatedAt as ISO strings", () => {
        const result = buildWorkgroupPayload(BASE_INPUT);
        expect(result.createdAt).toBe("2026-07-10T08:35:27.573Z");
        expect(result.updatedAt).toBe("2026-07-10T09:20:00.000Z");
    });

    it("maps roles 1:1", () => {
        const result = buildWorkgroupPayload({
            ...BASE_INPUT,
            roles: [
                { id: "role-1", name: "Boekhouder", color: "#EAB308" },
                { id: "role-2", name: "Facilitator", color: "#C87DD6" },
            ],
        });
        expect(result.roles).toEqual([
            { id: "role-1", name: "Boekhouder", color: "#EAB308" },
            { id: "role-2", name: "Facilitator", color: "#C87DD6" },
        ]);
    });

    it("maps members 1:1 with their roleIds", () => {
        const result = buildWorkgroupPayload({
            ...BASE_INPUT,
            members: [{ participantId: "meta-env-1", roleIds: ["role-1"] }],
        });
        expect(result.members).toEqual([{ participantId: "meta-env-1", roleIds: ["role-1"] }]);
    });

    it("returns empty arrays for roles/members when none given", () => {
        const result = buildWorkgroupPayload(BASE_INPUT);
        expect(result.roles).toEqual([]);
        expect(result.members).toEqual([]);
    });

    it("omits chatId key when null, includes it when present", () => {
        const nullResult = buildWorkgroupPayload(BASE_INPUT);
        expect("chatId" in nullResult).toBe(false);

        const setResult = buildWorkgroupPayload({ ...BASE_INPUT, chatId: "chat-env-1" });
        expect(setResult.chatId).toBe("chat-env-1");
    });
});
