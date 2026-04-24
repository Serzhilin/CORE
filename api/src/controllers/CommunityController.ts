import { Request, Response } from "express";
import { createCommunity, getMyCommunities, getCommunityFull, updateCommunity, getCommunityGraph } from "../services/CommunityService";
import { Community } from "../database/entities/Community";

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
    const { name, slug, description, logo_url, primary_color, title_font } = req.body;
    const patch = Object.fromEntries(
        Object.entries({ name, slug, description, logo_url, primary_color, title_font })
            .filter(([, v]) => v !== undefined)
    ) as Partial<Pick<Community, "name" | "slug" | "description" | "logo_url" | "primary_color" | "title_font">>;

    try {
        const community = await updateCommunity(req.params.id, patch);
        res.json(community);
    } catch (err: any) {
        if (err.code === "23505") { res.status(409).json({ error: "Slug already taken" }); return; }
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Community not found" }); return; }
        throw err;
    }
}
