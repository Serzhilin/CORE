import { Request, Response } from "express";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { verifySignature } from "../lib/signature-validator";
import { findOrCreateByEname, fetchEVaultProfile, updatePerson, displayName, findById } from "../services/PersonService";
import { signToken } from "../middleware/auth";
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Community } from "../database/entities/Community";

const sessions = new EventEmitter();
sessions.setMaxListeners(500);
const sessionResults = new Map<string, object>();
const sessionReturnTo = new Map<string, string>();
setInterval(() => { sessionResults.clear(); sessionReturnTo.clear(); }, 30 * 60 * 1000);

function serializePerson(p: any) {
    return { id: p.id, ename: p.ename, firstName: p.first_name, lastName: p.last_name, displayName: displayName(p) };
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
    const { ename, session, signature } = req.body;
    if (!ename || !session || !signature) { res.status(400).json({ error: "Missing ename, session, or signature" }); return; }

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

    const token = signToken({ userId: person.id, ename: person.ename! });
    const returnTo = sessionReturnTo.get(session) ?? "/";
    sessionReturnTo.delete(session);
    const payload = { token, user: serializePerson(person), returnTo };
    sessionResults.set(session, payload);
    sessions.emit(session, payload);
    res.json(payload);
}

export async function sseAuthStream(req: Request, res: Response) {
    const { id } = req.params;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" });
    res.write(": connected\n\n");
    const handler = (data: object) => { res.write(`data: ${JSON.stringify(data)}\n\n`); res.end(); };
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
    res.json({ token, user: serializePerson(person) });
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
            isAspirant: m.is_aspirant,
            community: communities.find((c) => c.id === m.community_id),
        })),
    });
}

export async function updateMe(req: Request, res: Response) {
    const { first_name, last_name, email, phone, bio, avatar_url } = req.body;
    const person = await updatePerson(req.user!.userId, { first_name, last_name, email, phone, bio, avatar_url });
    res.json(serializePerson(person));
}
