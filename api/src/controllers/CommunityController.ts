import { Request, Response } from "express";
import { createCommunity, getMyCommunities, getAllCommunities, getCommunityFull, updateCommunity, getCommunityGraph, resolveW3id, linkCommunity, unlinkCommunity, resolveEnameForNewCommunity, createCommunityFromEname, getById } from "../services/CommunityService";
import { Community } from "../database/entities/Community";
import { uploadFile } from "../lib/evault-client";

export async function listCommunities(req: Request, res: Response) {
    const communities = await getMyCommunities(req.user!.userId);
    res.json(communities);
}

export async function createCommunityHandler(req: Request, res: Response) {
    const { name, slug, description } = req.body;
    if (!name || !slug) { res.status(400).json({ error: "name and slug are required" }); return; }
    if (!/^[a-z0-9-]+$/.test(slug)) { res.status(400).json({ error: "Slug must be lowercase letters, numbers, and hyphens only" }); return; }
    try {
        const community = await createCommunity({ name, slug, description }, req.user!.userId);
        res.status(201).json(community);
    } catch (err: any) {
        if (err.code === "23505") { res.status(409).json({ error: "Slug already taken" }); return; }
        throw err;
    }
}

export async function getCommunityHandler(req: Request, res: Response) {
    const community = await getCommunityFull(req.params.id);
    if (!community) { res.status(404).json({ error: "Community not found" }); return; }
    res.json(community);
}

export async function getCommunityGraphHandler(req: Request, res: Response) {
    const data = await getCommunityGraph(req.params.id);
    res.json(data);
}

export async function updateCommunityHandler(req: Request, res: Response) {
    const {
        name, slug, description, logo_url, photo_url, primary_color, title_font,
        legal_form, official_name, kvk_number, rsin, iban, registered_address,
        founding_date, statuten_file_uri,
    } = req.body;
    const patch = Object.fromEntries(
        Object.entries({
            name, slug, description, logo_url, photo_url, primary_color, title_font,
            legal_form, official_name, kvk_number, rsin, iban, registered_address,
            founding_date, statuten_file_uri,
        }).filter(([, v]) => v !== undefined)
    ) as Partial<Pick<Community,
        "name" | "slug" | "description" | "logo_url" | "photo_url" | "primary_color" | "title_font" |
        "legal_form" | "official_name" | "kvk_number" | "rsin" | "iban" | "registered_address" |
        "founding_date" | "statuten_file_uri"
    >>;

    try {
        const community = await updateCommunity(req.params.id, patch);
        res.json(community);
    } catch (err: any) {
        if (err.code === "23505") { res.status(409).json({ error: "Slug already taken" }); return; }
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Community not found" }); return; }
        throw err;
    }
}

export async function uploadStatutenFileHandler(req: Request, res: Response) {
    const { file } = req.body as { file?: { name: string; type: string; data: string } };
    if (!file?.data || !file?.name) { res.status(400).json({ error: "file with name and data is required" }); return; }

    const community = await getById(req.params.id);
    if (!community) { res.status(404).json({ error: "Community not found" }); return; }
    if (!community.ename) { res.status(400).json({ error: "Community is not linked to a W3DS eName yet" }); return; }

    try {
        const base64 = file.data.includes(",") ? file.data.slice(file.data.indexOf(",") + 1) : file.data;
        const { uri, publicUrl } = await uploadFile(community.ename, file.name, file.type || "application/octet-stream", base64);
        const updated = await updateCommunity(community.id, { statuten_file_uri: uri });
        res.json({ uri, url: publicUrl ?? uri, community: updated });
    } catch (err: any) {
        res.status(502).json({ error: "Failed to upload statuten file: " + err.message });
    }
}

function w3idErrorStatus(message: string): { status: number; error: string } | null {
    switch (message) {
        case "w3id_not_found": return { status: 404, error: "eName could not be resolved" };
        case "not_admin": return { status: 403, error: "You are not recognized as an admin/owner of that eVault group" };
        case "actor_has_no_ename": return { status: 400, error: "You must be logged in via W3DS to link a community" };
        case "already_linked": return { status: 409, error: "Community is already linked to a W3DS eName" };
        case "w3id_already_linked": return { status: 409, error: "That eName is already linked to another community" };
        case "group_not_found": return { status: 404, error: "No group envelope found for that eName yet" };
        default: return null;
    }
}

export async function resolveW3idHandler(req: Request, res: Response) {
    const { w3id } = req.query;
    if (typeof w3id !== "string" || !w3id) { res.status(400).json({ error: "w3id query param required" }); return; }
    try {
        const resolution = await resolveW3id(w3id, req.user!.userId);
        res.json(resolution);
    } catch (err: any) {
        const mapped = w3idErrorStatus(err.message);
        if (mapped) { res.status(mapped.status).json({ error: mapped.error }); return; }
        throw err;
    }
}

export async function linkCommunityHandler(req: Request, res: Response) {
    const { w3id } = req.body;
    if (!w3id) { res.status(400).json({ error: "w3id is required" }); return; }
    try {
        const community = await linkCommunity(req.params.id, w3id, req.user!.userId);
        res.json(community);
    } catch (err: any) {
        const mapped = w3idErrorStatus(err.message);
        if (mapped) { res.status(mapped.status).json({ error: mapped.error }); return; }
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Community not found" }); return; }
        throw err;
    }
}

export async function listAllCommunitiesHandler(req: Request, res: Response) {
    const communities = await getAllCommunities();
    res.json(communities);
}

export async function unlinkCommunityHandler(req: Request, res: Response) {
    try {
        const community = await unlinkCommunity(req.params.id);
        res.json(community);
    } catch (err: any) {
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Community not found" }); return; }
        throw err;
    }
}

export async function adminResolveEnameHandler(req: Request, res: Response) {
    const { w3id } = req.query;
    if (typeof w3id !== "string" || !w3id) { res.status(400).json({ error: "w3id query param required" }); return; }
    try {
        const resolution = await resolveEnameForNewCommunity(w3id);
        res.json(resolution);
    } catch (err: any) {
        const mapped = w3idErrorStatus(err.message);
        if (mapped) { res.status(mapped.status).json({ error: mapped.error }); return; }
        throw err;
    }
}

export async function createCommunityFromEnameHandler(req: Request, res: Response) {
    const { w3id, slug } = req.body;
    if (!w3id || !slug) { res.status(400).json({ error: "w3id and slug are required" }); return; }
    if (!/^[a-z0-9-]+$/.test(slug)) { res.status(400).json({ error: "Slug must be lowercase letters, numbers, and hyphens only" }); return; }
    try {
        const community = await createCommunityFromEname(w3id, slug);
        res.status(201).json(community);
    } catch (err: any) {
        if (err.code === "23505") { res.status(409).json({ error: "Slug already taken" }); return; }
        const mapped = w3idErrorStatus(err.message);
        if (mapped) { res.status(mapped.status).json({ error: mapped.error }); return; }
        throw err;
    }
}
