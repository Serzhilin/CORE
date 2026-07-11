export interface OrganizationPayloadMembershipType {
    id: string;
    name: string;
    description: string | null;
    emoji: string | null;
}

export interface OrganizationPayloadMember {
    participantId: string;
    eName: string;
    dateJoined: string | null;
    membershipTypeId: string | null;
}

export interface OrganizationPayloadInput {
    communityEname: string;
    name: string | null;
    legalForm: string | null;
    officialName: string | null;
    kvkNumber: string | null;
    rsin: string | null;
    iban: string | null;
    registeredAddress: string | null;
    // Runtime value of Community.founding_date is a plain 'YYYY-MM-DD' string, not a Date
    // instance, despite the entity's `Date | null` type annotation (TypeORM `type: "date"`
    // columns deserialize to strings, not Dates). Callers must pass it through unchanged.
    foundingDate: string | null;
    statutenFileUri: string | null;
    logoUrl: string | null;
    photoUrl: string | null;
    primaryColor: string;
    titleFont: string;
    membershipTypes: OrganizationPayloadMembershipType[];
    members: OrganizationPayloadMember[];
    admins: string[];
}

interface LegalInfoPayload {
    legalForm?: string;
    officialName?: string;
    kvkNumber?: string;
    rsin?: string;
    iban?: string;
    registeredAddress?: string;
    foundingDate?: string;
    statutenFileUri?: string;
}

interface BrandingPayload {
    logoUrl: string | null;
    photoUrl: string | null;
    primaryColor: string;
    titleFont: string;
}

interface MembershipTypePayload {
    id: string;
    name: string;
    description?: string;
    emoji: string | null;
}

export interface OrganizationEnvelopePayload {
    name: string | null;
    legalInfo: LegalInfoPayload;
    branding: BrandingPayload;
    membershipTypes: MembershipTypePayload[];
    members: OrganizationPayloadMember[];
    admins: string[];
}

export function buildOrganizationPayload(input: OrganizationPayloadInput): OrganizationEnvelopePayload {
    const legalInfo: LegalInfoPayload = {};
    if (input.legalForm) legalInfo.legalForm = input.legalForm;
    if (input.officialName) legalInfo.officialName = input.officialName;
    if (input.kvkNumber) legalInfo.kvkNumber = input.kvkNumber;
    if (input.rsin) legalInfo.rsin = input.rsin;
    if (input.iban) legalInfo.iban = input.iban;
    if (input.registeredAddress) legalInfo.registeredAddress = input.registeredAddress;
    if (input.foundingDate) legalInfo.foundingDate = input.foundingDate;
    if (input.statutenFileUri) legalInfo.statutenFileUri = input.statutenFileUri;

    return {
        name: input.name,
        legalInfo,
        branding: {
            logoUrl: input.logoUrl,
            photoUrl: input.photoUrl,
            primaryColor: input.primaryColor,
            titleFont: input.titleFont,
        },
        membershipTypes: input.membershipTypes.map((t) => {
            const mt: MembershipTypePayload = { id: t.id, name: t.name, emoji: t.emoji };
            if (t.description) mt.description = t.description;
            return mt;
        }),
        members: input.members,
        admins: input.admins,
    };
}
