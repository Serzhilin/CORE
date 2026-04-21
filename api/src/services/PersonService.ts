import { AppDataSource } from "../database/data-source";
import { Person } from "../database/entities/Person";

const repo = () => AppDataSource.getRepository(Person);

export async function findOrCreateByEname(ename: string): Promise<Person> {
    const existing = await repo().findOne({ where: { ename } });
    if (existing) return existing;
    return repo().save(repo().create({ ename }));
}

export async function findById(id: string): Promise<Person | null> {
    return repo().findOne({ where: { id } });
}

export async function updatePerson(id: string, data: Partial<Pick<Person,
    "first_name" | "last_name" | "email" | "phone" | "bio" | "avatar_url">>): Promise<Person> {
    const person = await repo().findOneOrFail({ where: { id } });
    Object.assign(person, data);
    return repo().save(person);
}

export function displayName(p: Person): string {
    if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
    if (p.first_name) return p.first_name;
    return p.ename ?? p.id;
}

/** Fetch profile from eVault on first login. Returns null if unavailable. */
export async function fetchEVaultProfile(ename: string): Promise<{ first_name: string; last_name: string } | null> {
    const registryUrl = process.env.PUBLIC_REGISTRY_URL;
    const platformUrl = process.env.VITE_PUBLIC_CORE_BASE_URL;
    if (!registryUrl || !platformUrl) return null;
    try {
        const tokenRes = await fetch(`${registryUrl}/platforms/certification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: platformUrl }),
        });
        if (!tokenRes.ok) return null;
        const { token } = await tokenRes.json() as { token: string };

        const resolveRes = await fetch(`${registryUrl}/resolve?w3id=${encodeURIComponent(ename)}`);
        if (!resolveRes.ok) return null;
        const { uri } = await resolveRes.json() as { uri: string };

        const USER_SCHEMA_ID = "550e8400-e29b-41d4-a716-446655440000";
        const gqlRes = await fetch(new URL("/graphql", uri).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-ENAME": ename },
            body: JSON.stringify({ query: `query { findMetaEnvelopesByOntology(ontology: "${USER_SCHEMA_ID}") { id parsed } }` }),
        });
        if (!gqlRes.ok) return null;
        const data = await gqlRes.json() as any;
        const envelopes: any[] = data?.data?.findMetaEnvelopesByOntology ?? [];
        if (!envelopes.length) return null;

        const merged: Record<string, any> = {};
        for (const env of envelopes) {
            for (const [k, v] of Object.entries(env.parsed ?? {})) {
                if (v !== null && v !== undefined && v !== "") merged[k] = v;
            }
        }
        const displayNameStr: string = merged.displayName ?? merged.name ?? "";
        const firstName: string = merged.firstName ?? displayNameStr.split(/\s+/)[0] ?? "";
        const lastName: string = merged.lastName ?? displayNameStr.split(/\s+/).slice(1).join(" ") ?? "";
        if (!firstName) return null;
        return { first_name: firstName, last_name: lastName };
    } catch {
        return null;
    }
}
