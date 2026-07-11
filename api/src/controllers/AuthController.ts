import { Request, Response, NextFunction } from "express";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { verifySignature } from "../lib/signature-validator";
import { findOrCreateByEname, fetchEVaultProfile, updatePerson, findById } from "../services/PersonService";
import { getUserMetaEnvelopeId, uploadFile, resolveW3dsFileUrl } from "../lib/evault-client";
import { syncUserProfileToEvault } from "../services/UserProfileSyncService";
import { logger } from "../lib/logger";
import { Person } from "../database/entities/Person";
import { signToken } from "../middleware/auth";
import { isPlatformAdminEname } from "../middleware/communityAccess";
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Community } from "../database/entities/Community";

const sessions = new EventEmitter();
sessions.setMaxListeners(500);
const sessionResults = new Map<string, object>();
const sessionReturnTo = new Map<string, string>();
setInterval(() => { sessionResults.clear(); sessionReturnTo.clear(); }, 30 * 60 * 1000);

function serializePerson(p: Person) {
    return {
        id: p.id,
        ename: p.ename,
        firstName: p.first_name,
        lastName: p.last_name,
        displayName: p.display_name,
        email: p.email,
        phone: p.phone,
        bio: p.bio,
        avatarUrl: p.avatar_url,
        bannerUrl: p.banner_url,
    };
}

async function getMembershipsForPerson(personId: string) {
    const memberships = await AppDataSource.getRepository(CommunityMembership).find({ where: { person_id: personId } });
    const communityIds = memberships.map((m) => m.community_id);
    const communities = communityIds.length
        ? await AppDataSource.getRepository(Community).findBy(communityIds.map((id) => ({ id })))
        : [];
    return memberships.map((m) => ({
        communityId: m.community_id,
        isAdmin: m.is_admin,
        community: communities.find((c) => c.id === m.community_id),
    }));
}

export async function getOffer(req: Request, res: Response) {
    const baseUrl = process.env.VITE_PUBLIC_CORE_BASE_URL || `http://localhost:${process.env.PORT || 3002}`;
    const sessionId = uuidv4();
    const returnTo = typeof req.query.returnTo === "string" && req.query.returnTo.startsWith("/") ? req.query.returnTo : "/";
    sessionReturnTo.set(sessionId, returnTo);
    const redirectUrl = new URL("/api/auth/login", baseUrl).toString();
    const offer = `w3ds://auth?redirect=${redirectUrl}&session=${sessionId}&platform=CORE`;
    res.json({ offer, sessionId });
}

export async function epassportLogin(req: Request, res: Response) {
    const { w3id, ename: enameField, session, signature } = req.body;
    const ename = w3id ?? enameField;
    if (!ename || !session || !signature) { res.status(400).json({ error: "Missing w3id, session, or signature" }); return; }

    const cached = sessionResults.get(session);
    if (cached) { sessionResults.delete(session); res.json(cached); return; }

    if (process.env.USE_LOCAL_W3DS !== "true") {
        const registryUrl = process.env.PUBLIC_REGISTRY_URL;
        if (!registryUrl) { res.status(500).json({ error: "PUBLIC_REGISTRY_URL not configured" }); return; }
        try {
            const result = await verifySignature({ eName: ename, signature, payload: session, registryBaseUrl: registryUrl });
            if (!result.valid) { res.status(401).json({ error: "Invalid signature" }); return; }
        } catch {
            res.status(401).json({ error: "Signature verification failed" }); return;
        }
    }

    let person = await findOrCreateByEname(ename);
    if (!person.first_name) {
        const profile = await fetchEVaultProfile(ename);
        if (profile?.first_name) {
            person = await updatePerson(person.id, { first_name: profile.first_name, last_name: profile.last_name });
        }
    }

    if (!person.meta_envelope_id) {
        const personId = person.id;
        getUserMetaEnvelopeId(ename)
            .then((metaEnvelopeId) => {
                if (metaEnvelopeId) return updatePerson(personId, { meta_envelope_id: metaEnvelopeId });
            })
            .catch((err) => logger.warn(err, "meta_envelope_id resolution failed for %s", ename));
    }

    const token = signToken({ userId: person.id, ename: person.ename! });
    const returnTo = sessionReturnTo.get(session) ?? "/";
    sessionReturnTo.delete(session);
    const memberships = await getMembershipsForPerson(person.id);
    const isPlatformAdmin = isPlatformAdminEname(person.ename);
    const payload = { token, user: serializePerson(person), memberships, returnTo, isPlatformAdmin };
    sessionResults.set(session, payload);
    sessions.emit(session, payload);
    res.json(payload);
}

export async function sseAuthStream(req: Request, res: Response) {
    const { id } = req.params;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" });
    res.write(": connected\n\n");
    const handler = (data: object) => {
        if (res.writableEnded) return;
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        res.end();
    };
    sessions.once(id, handler);
    req.on("close", () => sessions.off(id, handler));
}

export async function devLogin(req: Request, res: Response) {
    if (process.env.NODE_ENV === "production") { res.status(403).json({ error: "Not available in production" }); return; }
    const ename = req.body.ename || "@dev-user";
    let person = await findOrCreateByEname(ename);
    if (!person.first_name) {
        person = await updatePerson(person.id, { first_name: "Dev", last_name: "User" });
    }
    const token = signToken({ userId: person.id, ename: person.ename! });
    const memberships = await getMembershipsForPerson(person.id);
    res.json({ token, user: serializePerson(person), memberships, isPlatformAdmin: isPlatformAdminEname(person.ename) });
}

export async function getMe(req: Request, res: Response) {
    const person = await findById(req.user!.userId);
    if (!person) { res.status(404).json({ error: "Person not found" }); return; }

    const memberships = await AppDataSource.getRepository(CommunityMembership).find({
        where: { person_id: person.id },
    });
    const communityIds = memberships.map((m) => m.community_id);
    const communities = communityIds.length
        ? await AppDataSource.getRepository(Community).findBy(communityIds.map((id) => ({ id })))
        : [];

    res.json({
        person: serializePerson(person),
        memberships: memberships.map((m) => ({
            communityId: m.community_id,
            isAdmin: m.is_admin,
            community: communities.find((c) => c.id === m.community_id),
        })),
        isPlatformAdmin: isPlatformAdminEname(person.ename),
    });
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
    const { email, phone, bio, avatar_url, display_name } = req.body;
    try {
        const personId = req.user!.userId;
        const person = await updatePerson(personId, { email, phone, bio, avatar_url, display_name });
        res.json(serializePerson(person));
        if (bio !== undefined || display_name !== undefined) {
            syncUserProfileToEvault(personId).catch((err) => logger.warn(err, "user profile eVault sync failed for %s", personId));
        }
    } catch (err: any) {
        if (err.code === "23505") { res.status(409).json({ error: "Email already in use" }); return; }
        next(err);
    }
}

export async function uploadProfileImageHandler(req: Request, res: Response, next: NextFunction) {
    const { field, file } = req.body; // field: 'avatar_url' | 'banner_url'; file: { name, type, data }
    if (field !== "avatar_url" && field !== "banner_url") { res.status(400).json({ error: "field must be avatar_url or banner_url" }); return; }
    if (!file?.data || !file?.name || !file?.type) { res.status(400).json({ error: "file with name, type, data is required" }); return; }

    try {
        const personId = req.user!.userId;
        const person = await findById(personId);
        if (!person?.ename) { res.status(400).json({ error: "No eName linked to this account yet" }); return; }

        const { uri, publicUrl } = await uploadFile(person.ename, file.name, file.type, file.data);
        const resolvedUrl = publicUrl ?? (await resolveW3dsFileUrl(uri));

        await updatePerson(personId, { [field]: resolvedUrl } as Partial<Pick<Person, "avatar_url" | "banner_url">>);
        res.json({ url: resolvedUrl });

        const overrideKey = field === "avatar_url" ? "avatarUrl" : "bannerUrl";
        syncUserProfileToEvault(personId, { [overrideKey]: uri }).catch((err) => logger.warn(err, "user profile eVault sync failed for %s", personId));
    } catch (err) {
        next(err);
    }
}
