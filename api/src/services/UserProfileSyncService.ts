import { AppDataSource } from "../database/data-source";
import { Person } from "../database/entities/Person";
import { findEnvelopesByOntology, getEnvelope, updateEnvelope } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";
import { buildUserProfilePayload } from "./userProfilePayload";

const personRepo = () => AppDataSource.getRepository(Person);

export interface UserProfileSyncOverrides {
    avatarUrl?: string;
    bannerUrl?: string;
}

export async function syncUserProfileToEvault(personId: string, overrides: UserProfileSyncOverrides = {}): Promise<void> {
    const person = await personRepo().findOne({ where: { id: personId } });
    if (!person?.ename) return;

    let envelopeId = person.meta_envelope_id;
    if (!envelopeId) {
        const envelopes = await findEnvelopesByOntology(person.ename, ONTOLOGIES.User, 1);
        if (!envelopes[0]) return;
        envelopeId = envelopes[0].id;
        await personRepo().update(person.id, { meta_envelope_id: envelopeId });
    }

    const existing = (await getEnvelope(person.ename, envelopeId)) ?? {};
    const payload = buildUserProfilePayload({
        existing,
        displayName: person.display_name,
        bio: person.bio,
        avatarUrl: overrides.avatarUrl ?? (existing.avatarUrl as string | undefined) ?? null,
        bannerUrl: overrides.bannerUrl ?? (existing.bannerUrl as string | undefined) ?? null,
        email: person.email,
        phone: person.phone,
        website: person.website,
        location: person.location,
        birthDate: person.birth_date,
    });

    await updateEnvelope({ vaultEname: person.ename, envelopeId, ontology: ONTOLOGIES.User, payload, acl: ["*"] });
}
