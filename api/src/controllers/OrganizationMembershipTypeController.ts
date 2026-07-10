// api/src/controllers/OrganizationMembershipTypeController.ts
import { Request, Response, NextFunction } from "express";
import {
    listMembershipTypes, createMembershipType, updateMembershipType, deleteMembershipType,
} from "../services/OrganizationMembershipTypeService";

export const listMembershipTypesHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await listMembershipTypes(req.params.cid));
    } catch (err) {
        next(err);
    }
};

export const createMembershipTypeHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, description, emoji } = req.body;
        if (!name) { res.status(400).json({ error: "name required" }); return; }
        res.status(201).json(await createMembershipType(req.params.cid, { name, description, emoji }));
    } catch (err) {
        next(err);
    }
};

export const updateMembershipTypeHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, description, emoji, sort_order } = req.body;
        res.json(await updateMembershipType(req.params.tid, req.params.cid, { name, description, emoji, sort_order }));
    } catch (err) {
        next(err);
    }
};

export const deleteMembershipTypeHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await deleteMembershipType(req.params.tid, req.params.cid);
        res.status(204).send();
    } catch (err: any) {
        if (err.code === "membership_type_in_use") {
            res.status(409).json({ error: err.message, affectedCount: err.affectedCount });
            return;
        }
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Membership type not found" }); return; }
        next(err);
    }
};
