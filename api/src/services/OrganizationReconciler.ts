import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { OrganizationMembershipType } from "../database/entities/OrganizationMembershipType";
import { Person } from "../database/entities/Person";
import { logger } from "../lib/logger";
import { findEnvelopesByOntology } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { OrganizationEnvelopePayload, OrganizationPayloadMember } from "./organizationPayload";

const communityRepo = () => AppDataSource.getRepository(Community);
const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const membershipTypeRepo = () => AppDataSource.getRepository(OrganizationMembershipType);
const personRepo = () => AppDataSource.getRepository(Person);

async function reconcileScalars(communityId: string, payload: OrganizationEnvelopePayload): Promise<void> {
    try {
        const community = await communityRepo().findOne({ where: { id: communityId } });
        if (!community) return;

        const legalForm = payload.legalInfo.legalForm ?? null;
        const officialName = payload.legalInfo.officialName ?? null;
        const kvkNumber = payload.legalInfo.kvkNumber ?? null;
        const rsin = payload.legalInfo.rsin ?? null;
        const iban = payload.legalInfo.iban ?? null;
        const registeredAddress = payload.legalInfo.registeredAddress ?? null;
        const foundingDate = payload.legalInfo.foundingDate ?? null;
        const statutenFileUri = payload.legalInfo.statutenFileUri ?? null;

        const updates: Record<string, unknown> = {};
        if (payload.name !== null && payload.name !== community.name) updates.name = payload.name;
        if (legalForm !== community.legal_form) updates.legal_form = legalForm;
        if (officialName !== community.official_name) updates.official_name = officialName;
        if (kvkNumber !== community.kvk_number) updates.kvk_number = kvkNumber;
        if (rsin !== community.rsin) updates.rsin = rsin;
        if (iban !== community.iban) updates.iban = iban;
        if (registeredAddress !== community.registered_address) updates.registered_address = registeredAddress;
        // Community.founding_date deserializes to a plain 'YYYY-MM-DD' string at runtime
        // (TypeORM "date" column), so this string-to-string compare is correct despite the
        // Date|null type annotation — same quirk documented in OrganizationService.ts.
        if (foundingDate !== (community.founding_date as unknown as string | null)) {
            updates.founding_date = foundingDate;
        }
        if (statutenFileUri !== community.statuten_file_uri) updates.statuten_file_uri = statutenFileUri;
        if (payload.branding.logoUrl !== community.logo_url) updates.logo_url = payload.branding.logoUrl;
        if (payload.branding.photoUrl !== community.photo_url) updates.photo_url = payload.branding.photoUrl;
        if (payload.branding.primaryColor !== community.primary_color) updates.primary_color = payload.branding.primaryColor;
        if (payload.branding.titleFont !== community.title_font) updates.title_font = payload.branding.titleFont;

        if (Object.keys(updates).length > 0) {
            await communityRepo().update(communityId, updates);
        }
    } catch (err) {
        logger.warn(err, "OrganizationReconciler: scalar reconcile failed for community %s", communityId);
    }
}

async function reconcileMembershipTypes(
    communityId: string,
    envelopeTypes: OrganizationEnvelopePayload["membershipTypes"]
): Promise<void> {
    const repo = membershipTypeRepo();
    const localTypes = await repo.find({ where: { community_id: communityId } });
    const localById = new Map(localTypes.map((t) => [t.id, t]));
    const envelopeIds = new Set(envelopeTypes.map((t) => t.id));

    for (const et of envelopeTypes) {
        try {
            const description = et.description ?? null;
            const local = localById.get(et.id);
            if (!local) {
                const maxSortOrder = localTypes.reduce((max, t) => Math.max(max, t.sort_order), -1);
                await repo.save(
                    repo.create({
                        id: et.id,
                        community_id: communityId,
                        name: et.name,
                        description,
                        emoji: et.emoji,
                        sort_order: maxSortOrder + 1,
                    })
                );
                logger.warn(
                    "OrganizationReconciler: resurrected membership type %s for community %s (present in eVault, missing locally)",
                    et.id,
                    communityId
                );
            } else if (local.name !== et.name || local.description !== description || local.emoji !== et.emoji) {
                await repo.update(local.id, { name: et.name, description, emoji: et.emoji });
            }
        } catch (err) {
            logger.warn(err, "OrganizationReconciler: membership type reconcile failed for %s", et.id);
        }
    }

    for (const local of localTypes) {
        if (envelopeIds.has(local.id)) continue;
        try {
            await repo.delete(local.id);
            logger.warn(
                "OrganizationReconciler: deleted membership type %s for community %s (absent from eVault)",
                local.id,
                communityId
            );
        } catch (err) {
            logger.warn(err, "OrganizationReconciler: membership type delete failed for %s", local.id);
        }
    }
}

async function reconcileRoster(
    communityId: string,
    members: OrganizationPayloadMember[],
    admins: string[]
): Promise<void> {
    const cmRepo = membershipRepo();
    const localMemberships = await cmRepo.find({ where: { community_id: communityId } });
    const localByPersonId = new Map(localMemberships.map((m) => [m.person_id, m]));
    const adminSet = new Set(admins);
    const matchedPersonIds = new Set<string>();

    for (const member of members) {
        try {
            const person = await personRepo().findOne({ where: { ename: member.eName } });
            if (!person) continue;
            matchedPersonIds.add(person.id);

            const isAdmin = adminSet.has(member.participantId);
            const local = localByPersonId.get(person.id);

            if (!local) {
                await cmRepo.save(
                    cmRepo.create({
                        community_id: communityId,
                        person_id: person.id,
                        membership_type_id: member.membershipTypeId,
                        joined_at: member.dateJoined as unknown as Date | null,
                        is_admin: isAdmin,
                    })
                );
                logger.warn(
                    "OrganizationReconciler: created membership for person %s in community %s (present in eVault, missing locally)",
                    person.id,
                    communityId
                );
            } else if (
                local.membership_type_id !== member.membershipTypeId ||
                (local.joined_at as unknown as string | null) !== member.dateJoined ||
                local.is_admin !== isAdmin
            ) {
                await cmRepo.update(local.id, {
                    membership_type_id: member.membershipTypeId,
                    joined_at: member.dateJoined as unknown as Date | null,
                    is_admin: isAdmin,
                });
            }
        } catch (err) {
            logger.warn(err, "OrganizationReconciler: roster reconcile failed for %s", member.eName);
        }
    }

    for (const local of localMemberships) {
        if (matchedPersonIds.has(local.person_id)) continue;
        try {
            await cmRepo.delete(local.id);
            logger.warn(
                "OrganizationReconciler: deleted membership %s for community %s (absent from eVault roster)",
                local.id,
                communityId
            );
        } catch (err) {
            logger.warn(err, "OrganizationReconciler: membership delete failed for %s", local.id);
        }
    }
}

export async function reconcileOrganizationFromEvault(
    communityId: string,
    payload: OrganizationEnvelopePayload
): Promise<void> {
    await reconcileScalars(communityId, payload);
    await reconcileMembershipTypes(communityId, payload.membershipTypes);
    await reconcileRoster(communityId, payload.members, payload.admins);
}

export async function reconcileOrganizationPacket(
    communityEname: string,
    payload: OrganizationEnvelopePayload
): Promise<void> {
    const community = await communityRepo().findOne({ where: { ename: communityEname } });
    if (!community) {
        logger.warn("OrganizationReconciler: no local community found for ename %s", communityEname);
        return;
    }
    await reconcileOrganizationFromEvault(community.id, payload);
}

export async function organizationReconciliationSweep(): Promise<void> {
    const communities = await communityRepo().find({ where: { provisioning_status: "linked" } });
    for (const community of communities) {
        if (!community.ename) continue;
        try {
            const envelopes = await findEnvelopesByOntology(community.ename, ONTOLOGIES.Organization, 1);
            const payload = envelopes[0]?.parsed as unknown as OrganizationEnvelopePayload | null;
            if (!payload) continue;
            await reconcileOrganizationFromEvault(community.id, payload);
        } catch (err) {
            logger.warn(err, "OrganizationReconciler: sweep failed for community %s", community.id);
        }
    }
}
