import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { OrganizationMembershipType } from "../database/entities/OrganizationMembershipType";
import { Person } from "../database/entities/Person";
import { createEnvelope, updateEnvelope, getUserMetaEnvelopeId } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { buildOrganizationPayload } from "./organizationPayload";

const communityRepo = () => AppDataSource.getRepository(Community);
const membershipRepo = () => AppDataSource.getRepository(CommunityMembership);
const membershipTypeRepo = () => AppDataSource.getRepository(OrganizationMembershipType);
const personRepo = () => AppDataSource.getRepository(Person);

export interface OrgSyncExclusions {
	excludeMembershipId?: string;
	excludeMembershipTypeId?: string;
}

export async function syncOrganizationToEvault(communityId: string, exclude: OrgSyncExclusions = {}): Promise<void> {
	const community = await communityRepo().findOne({ where: { id: communityId } });
	if (!community || community.provisioning_status !== "linked" || !community.ename) return;

	let membershipTypes = await membershipTypeRepo().find({ where: { community_id: communityId }, order: { sort_order: "ASC" } });
	if (exclude.excludeMembershipTypeId) {
		membershipTypes = membershipTypes.filter((t) => t.id !== exclude.excludeMembershipTypeId);
	}

	let memberships = await membershipRepo().find({ where: { community_id: communityId } });
	if (exclude.excludeMembershipId) {
		memberships = memberships.filter((m) => m.id !== exclude.excludeMembershipId);
	}

	const members: { participantId: string; eName: string; dateJoined: string | null; membershipTypeId: string | null }[] = [];
	const admins: string[] = [];
	for (const m of memberships) {
		const person = await personRepo().findOne({ where: { id: m.person_id } });
		if (!person?.ename) continue;
		let metaId = person.meta_envelope_id;
		if (!metaId) {
			metaId = await getUserMetaEnvelopeId(person.ename);
			if (metaId) await personRepo().update(person.id, { meta_envelope_id: metaId });
		}
		if (!metaId) continue;
		members.push({
			participantId: metaId,
			eName: person.ename,
			dateJoined: m.joined_at ? String(m.joined_at) : null,
			membershipTypeId: m.membership_type_id,
		});
		if (m.is_admin) admins.push(metaId);
	}

	const payload = buildOrganizationPayload({
		communityEname: community.ename,
		name: community.name,
		chatId: community.chat_envelope_id,
		legalForm: community.legal_form,
		officialName: community.official_name,
		kvkNumber: community.kvk_number,
		rsin: community.rsin,
		iban: community.iban,
		registeredAddress: community.registered_address,
		// Community.founding_date is declared Date | null but TypeORM's "date" column type
		// deserializes to a plain 'YYYY-MM-DD' string at runtime — String() is a safe passthrough.
		foundingDate: community.founding_date ? String(community.founding_date) : null,
		statutenFileUri: community.statuten_file_uri,
		logoUrl: community.logo_url,
		photoUrl: community.photo_url,
		primaryColor: community.primary_color,
		titleFont: community.title_font,
		membershipTypes: membershipTypes.map((t) => ({ id: t.id, name: t.name, description: t.description, emoji: t.emoji })),
		members,
		admins,
	});

	if (community.organization_envelope_id) {
		await updateEnvelope({
			vaultEname: community.ename,
			envelopeId: community.organization_envelope_id,
			ontology: ONTOLOGIES.Organization,
			payload: { ...payload },
			acl: ["*"],
		});
	} else {
		const envelopeId = await createEnvelope({
			vaultEname: community.ename,
			ontology: ONTOLOGIES.Organization,
			payload: { ...payload },
			acl: ["*"],
		});
		await communityRepo().update(community.id, { organization_envelope_id: envelopeId });
	}
}
