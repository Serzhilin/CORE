import { buildOrganizationPayload } from "../organizationPayload";

const BASE_INPUT = {
    communityEname: "@de68861c-8ea9-55be-9258-2a8cc3057a60",
    name: null as string | null,
    legalForm: null as string | null,
    officialName: null as string | null,
    kvkNumber: null as string | null,
    rsin: null as string | null,
    iban: null as string | null,
    registeredAddress: null as string | null,
    foundingDate: null as string | null,
    statutenFileUri: null as string | null,
    logoUrl: null as string | null,
    photoUrl: null as string | null,
    primaryColor: "#C4622D",
    titleFont: "Playfair Display",
    membershipTypes: [],
    members: [],
    admins: [],
    chatId: null as string | null,
};

describe("buildOrganizationPayload", () => {
    it("maps name verbatim at the top level", () => {
        const result = buildOrganizationPayload({ ...BASE_INPUT, name: "De Woonwolk" });
        expect(result.name).toBe("De Woonwolk");
    });

    it("nests legalInfo fields under legalInfo, omitting null ones", () => {
        const result = buildOrganizationPayload(BASE_INPUT);
        expect(result.legalInfo).toEqual({});
    });

    it("includes legalInfo fields when present, including foundingDate as a plain string", () => {
        const result = buildOrganizationPayload({
            ...BASE_INPUT,
            legalForm: "cooperative",
            officialName: "Coöperatie De Woonwolk U.A.",
            kvkNumber: "12345678",
            rsin: "123456789",
            iban: "NL00BANK0123456789",
            registeredAddress: "Voorbeeldstraat 1, 1234 AB Amsterdam",
            foundingDate: "2020-01-15",
            statutenFileUri: "w3ds://file?id=@de68861c-8ea9-55be-9258-2a8cc3057a60/env-1",
        });
        expect(result.legalInfo).toEqual({
            legalForm: "cooperative",
            officialName: "Coöperatie De Woonwolk U.A.",
            kvkNumber: "12345678",
            rsin: "123456789",
            iban: "NL00BANK0123456789",
            registeredAddress: "Voorbeeldstraat 1, 1234 AB Amsterdam",
            foundingDate: "2020-01-15",
            statutenFileUri: "w3ds://file?id=@de68861c-8ea9-55be-9258-2a8cc3057a60/env-1",
        });
    });

    it("maps branding fields verbatim", () => {
        const result = buildOrganizationPayload({
            ...BASE_INPUT,
            logoUrl: "https://example.com/logo.png",
            photoUrl: "https://example.com/photo.jpg",
        });
        expect(result.branding).toEqual({
            logoUrl: "https://example.com/logo.png",
            photoUrl: "https://example.com/photo.jpg",
            primaryColor: "#C4622D",
            titleFont: "Playfair Display",
        });
    });

    it("maps membershipTypes 1:1, omitting description when null", () => {
        const result = buildOrganizationPayload({
            ...BASE_INPUT,
            membershipTypes: [
                { id: "type-1", name: "Aspirant", description: null, emoji: "🌱" },
                { id: "type-2", name: "Full member", description: "Voting member", emoji: "🏡" },
            ],
        });
        expect(result.membershipTypes).toEqual([
            { id: "type-1", name: "Aspirant", emoji: "🌱" },
            { id: "type-2", name: "Full member", description: "Voting member", emoji: "🏡" },
        ]);
    });

    it("maps members 1:1 with participantId, eName, dateJoined, membershipTypeId", () => {
        const result = buildOrganizationPayload({
            ...BASE_INPUT,
            members: [{ participantId: "meta-env-1", eName: "@member1", dateJoined: "2021-03-01", membershipTypeId: "type-2" }],
        });
        expect(result.members).toEqual([
            { participantId: "meta-env-1", eName: "@member1", dateJoined: "2021-03-01", membershipTypeId: "type-2" },
        ]);
    });

    it("returns empty arrays for membershipTypes/members when none given", () => {
        const result = buildOrganizationPayload(BASE_INPUT);
        expect(result.membershipTypes).toEqual([]);
        expect(result.members).toEqual([]);
    });

    it("maps admins 1:1 as participantIds", () => {
        const result = buildOrganizationPayload({
            ...BASE_INPUT,
            admins: ["meta-env-1", "meta-env-2"],
        });
        expect(result.admins).toEqual(["meta-env-1", "meta-env-2"]);
    });

    it("maps chatId verbatim, including null", () => {
        const nullResult = buildOrganizationPayload(BASE_INPUT);
        expect(nullResult.chatId).toBeNull();

        const setResult = buildOrganizationPayload({ ...BASE_INPUT, chatId: "chat-env-1" });
        expect(setResult.chatId).toBe("chat-env-1");
    });
});
