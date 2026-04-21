import { Request, Response } from "express";
import {
    listAvailabilityTypes,
    createAvailabilityType,
    updateAvailabilityType,
    archiveAvailabilityType,
} from "../services/AvailabilityTypeService";

export async function listHandler(req: Request, res: Response) {
    res.json(await listAvailabilityTypes(req.params.cid));
}

export async function createHandler(req: Request, res: Response) {
    const { name, emoji } = req.body;
    if (!name || !emoji) { res.status(400).json({ error: "name and emoji are required" }); return; }
    res.status(201).json(await createAvailabilityType(req.params.cid, { name, emoji }));
}

export async function updateHandler(req: Request, res: Response) {
    const { name, emoji, sort_order } = req.body;
    try {
        res.json(await updateAvailabilityType(req.params.tid, req.params.cid, { name, emoji, sort_order }));
    } catch (err: any) {
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Availability type not found" }); return; }
        throw err;
    }
}

export async function archiveHandler(req: Request, res: Response) {
    try {
        await archiveAvailabilityType(req.params.tid, req.params.cid);
        res.status(204).send();
    } catch (err: any) {
        if (err.code === "IN_USE") { res.status(409).json({ error: "Type is currently in use by members" }); return; }
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Availability type not found" }); return; }
        throw err;
    }
}
