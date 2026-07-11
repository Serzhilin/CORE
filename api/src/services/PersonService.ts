import { AppDataSource } from "../database/data-source";
import { Person } from "../database/entities/Person";
import { findEnvelopesByOntology, resolveW3dsFileUrl } from "../lib/evault-client";
import { ONTOLOGIES } from "../lib/w3ds/ontology";

const repo = () => AppDataSource.getRepository(Person);

export async function findOrCreateByEname(ename: string): Promise<Person> {
    const existing = await repo().findOne({ where: { ename } });
    if (existing) return existing;
    return repo().save(repo().create({ ename }));
}

export async function findById(id: string): Promise<Person | null> {
    return repo().findOne({ where: { id } });
}

export async function findByMetaEnvelopeId(metaEnvelopeId: string): Promise<Person | null> {
    return repo().findOne({ where: { meta_envelope_id: metaEnvelopeId } });
}

export async function updatePerson(id: string, data: Partial<Pick<Person,
    "first_name" | "last_name" | "email" | "phone" | "website" | "location" | "birth_date" | "bio" | "avatar_url" | "display_name" | "banner_url" | "ename" | "meta_envelope_id">>): Promise<Person> {
    const person = await repo().findOneOrFail({ where: { id } });
    Object.assign(person, data);
    return repo().save(person);
}

/** Fetch profile from eVault on first login. Returns null if unavailable. */
export async function fetchEVaultProfile(ename: string): Promise<{ first_name: string; last_name: string } | null> {
    const envelopes = await findEnvelopesByOntology(ename, ONTOLOGIES.User, 1);
    const data = envelopes[0]?.parsed;
    if (!data) return null;

    const displayNameStr = (data.displayName as string | undefined) ?? (data.name as string | undefined) ?? "";
    const firstName = (data.firstName as string | undefined) ?? (data.givenName as string | undefined) ?? displayNameStr.split(/\s+/)[0] ?? "";
    const lastName = (data.lastName as string | undefined) ?? (data.familyName as string | undefined) ?? displayNameStr.split(/\s+/).slice(1).join(" ") ?? "";
    if (!firstName) return null;
    return { first_name: firstName, last_name: lastName };
}

/** Upsert a Person from an inbound Awareness Protocol webhook for the User ontology. */
export async function upsertFromWebhook(
    ename: string,
    metaEnvelopeId: string,
    data: Record<string, unknown>
): Promise<Person> {
    const byEname = await repo().findOne({ where: { ename } });
    const byMeta = byEname ? null : await repo().findOne({ where: { meta_envelope_id: metaEnvelopeId } });
    const existing = byEname ?? byMeta ?? repo().create();
    existing.ename = ename;
    existing.meta_envelope_id = metaEnvelopeId;

    const displayNameStr = (data.displayName as string | undefined) ?? (data.name as string | undefined) ?? "";
    const firstName = (data.firstName as string | undefined) ?? (data.givenName as string | undefined) ?? displayNameStr.split(/\s+/)[0];
    const lastName = (data.lastName as string | undefined) ?? (data.familyName as string | undefined) ?? displayNameStr.split(/\s+/).slice(1).join(" ");
    if (firstName) existing.first_name = firstName;
    if (lastName) existing.last_name = lastName;
    if (typeof data.bio === "string") existing.bio = data.bio;
    if (typeof data.displayName === "string") existing.display_name = data.displayName;
    if (typeof data.email === "string") existing.email = data.email;
    if (typeof data.phone === "string") existing.phone = data.phone;
    if (typeof data.website === "string") existing.website = data.website;
    if (typeof data.location === "string") existing.location = data.location;
    if (typeof data.birthDate === "string") existing.birth_date = data.birthDate;
    if (typeof data.avatarUrl === "string") {
        existing.avatar_url = (await resolveW3dsFileUrl(data.avatarUrl)) ?? data.avatarUrl;
    }
    if (typeof data.bannerUrl === "string") {
        existing.banner_url = (await resolveW3dsFileUrl(data.bannerUrl)) ?? data.bannerUrl;
    }

    return repo().save(existing);
}
