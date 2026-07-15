import {
    mergeCommunityChatFields,
    addParticipant,
    removeParticipant,
    renameChat,
    archiveChat,
    buildNewChatPayload,
} from "../chatPayloadHelpers";

describe("mergeCommunityChatFields", () => {
    it("overwrites owned fields and preserves foreign fields untouched", () => {
        const current = {
            type: "group",
            name: "Old name",
            description: "Old desc",
            avatar: "old.png",
            participantIds: ["old-1"],
            members: ["@old1"],
            charter: "Cooperative charter text",
            owner: "@owner",
            admins: ["admin-meta-1"],
            signatureIds: [],
            createdAt: "2020-01-01T00:00:00.000Z",
            lastMessageId: "msg-1",
            isArchived: false,
        };
        const result = mergeCommunityChatFields(current, {
            name: "New name",
            description: "New desc",
            avatar: "new.png",
            participantIds: ["p1", "p2"],
            members: ["@p1", "@p2"],
        });
        expect(result.name).toBe("New name");
        expect(result.description).toBe("New desc");
        expect(result.avatar).toBe("new.png");
        expect(result.participantIds).toEqual(["p1", "p2"]);
        expect(result.members).toEqual(["@p1", "@p2"]);
        expect(result.charter).toBe("Cooperative charter text");
        expect(result.owner).toBe("@owner");
        expect(result.admins).toEqual(["admin-meta-1"]);
        expect(result.signatureIds).toEqual([]);
        expect(result.createdAt).toBe("2020-01-01T00:00:00.000Z");
        expect(result.lastMessageId).toBe("msg-1");
        expect(result.isArchived).toBe(false);
    });

    it("sets updatedAt to a fresh ISO timestamp", () => {
        const result = mergeCommunityChatFields(
            {},
            { name: "N", description: null, avatar: null, participantIds: [], members: [] }
        );
        expect(typeof result.updatedAt).toBe("string");
        expect(() => new Date(result.updatedAt as string).toISOString()).not.toThrow();
    });
});

describe("addParticipant", () => {
    it("adds a new participant id and eName", () => {
        const result = addParticipant({ participantIds: ["p1"], members: ["@p1"] }, "p2", "@p2");
        expect(result.participantIds).toEqual(["p1", "p2"]);
        expect(result.members).toEqual(["@p1", "@p2"]);
    });

    it("is idempotent — adding an existing participant is a no-op", () => {
        const result = addParticipant({ participantIds: ["p1"], members: ["@p1"] }, "p1", "@p1");
        expect(result.participantIds).toEqual(["p1"]);
        expect(result.members).toEqual(["@p1"]);
    });

    it("preserves unrelated fields", () => {
        const result = addParticipant({ participantIds: [], members: [], charter: "text" }, "p1", "@p1");
        expect(result.charter).toBe("text");
    });

    it("defaults to empty arrays when current has no participantIds/members", () => {
        const result = addParticipant({}, "p1", "@p1");
        expect(result.participantIds).toEqual(["p1"]);
        expect(result.members).toEqual(["@p1"]);
    });
});

describe("removeParticipant", () => {
    it("removes an existing participant id and eName", () => {
        const result = removeParticipant(
            { participantIds: ["p1", "p2"], members: ["@p1", "@p2"] },
            "p1",
            "@p1"
        );
        expect(result.participantIds).toEqual(["p2"]);
        expect(result.members).toEqual(["@p2"]);
    });

    it("is safe when the participant is already absent", () => {
        const result = removeParticipant({ participantIds: ["p2"], members: ["@p2"] }, "p1", "@p1");
        expect(result.participantIds).toEqual(["p2"]);
        expect(result.members).toEqual(["@p2"]);
    });

    it("preserves unrelated fields", () => {
        const result = removeParticipant(
            { participantIds: ["p1"], members: ["@p1"], owner: "@owner" },
            "p1",
            "@p1"
        );
        expect(result.owner).toBe("@owner");
    });
});

describe("renameChat", () => {
    it("sets name and preserves everything else", () => {
        const result = renameChat({ name: "Old", isArchived: false }, "New");
        expect(result.name).toBe("New");
        expect(result.isArchived).toBe(false);
    });
});

describe("archiveChat", () => {
    it("sets isArchived true and preserves everything else", () => {
        const result = archiveChat({ name: "Keep", isArchived: false });
        expect(result.isArchived).toBe(true);
        expect(result.name).toBe("Keep");
    });
});

describe("buildNewChatPayload", () => {
    it("builds a group-type envelope with given name/participants", () => {
        const result = buildNewChatPayload({
            name: "de Woonwolk: Activities",
            participantIds: ["p1"],
            members: ["@p1"],
        });
        expect(result.type).toBe("group");
        expect(result.name).toBe("de Woonwolk: Activities");
        expect(result.participantIds).toEqual(["p1"]);
        expect(result.members).toEqual(["@p1"]);
        expect(result.isArchived).toBe(false);
        expect(typeof result.createdAt).toBe("string");
        expect(result.createdAt).toBe(result.updatedAt);
    });
});
