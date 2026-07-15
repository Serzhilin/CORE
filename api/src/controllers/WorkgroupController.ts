import { Request, Response, NextFunction } from "express";
import {
    listWorkgroups, createWorkgroup, updateWorkgroup, deleteWorkgroup,
    createRole, updateRole, deleteRole,
    addWorkgroupMember, updateWorkgroupMember, removeWorkgroupMember,
    assignRole, unassignRole, getWorkgroupMembership,
} from "../services/WorkgroupService";

export const listWorkgroupsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await listWorkgroups(req.params.cid));
    } catch (err) {
        next(err);
    }
};

export const createWorkgroupHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, description, color } = req.body;
        if (!name) { res.status(400).json({ error: "name required" }); return; }
        res.status(201).json(await createWorkgroup(req.params.cid, { name, description, color }));
    } catch (err) {
        next(err);
    }
};

export const updateWorkgroupHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, description, color, sort_order } = req.body;
        res.json(await updateWorkgroup(req.params.wid, req.params.cid, { name, description, color, sort_order }));
    } catch (err) {
        next(err);
    }
};

export const deleteWorkgroupHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await deleteWorkgroup(req.params.wid, req.params.cid);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

export const createRoleHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, description, color } = req.body;
        if (!name) { res.status(400).json({ error: "name required" }); return; }
        res.status(201).json(await createRole(req.params.wid, { name, description, color }));
    } catch (err) {
        next(err);
    }
};

export const updateRoleHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, description, color, sort_order } = req.body;
        res.json(await updateRole(req.params.rid, req.params.wid, { name, description, color, sort_order }));
    } catch (err) {
        next(err);
    }
};

export const deleteRoleHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await deleteRole(req.params.rid, req.params.wid);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

export const addWgMemberHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { person_id } = req.body;
        if (!person_id) { res.status(400).json({ error: "person_id required" }); return; }
        try {
            res.status(201).json(await addWorkgroupMember(req.params.wid, person_id));
        } catch (err: any) {
            if (err.code === "23505") { res.status(409).json({ error: "Already a member" }); return; }
            next(err);
        }
    } catch (err) {
        next(err);
    }
};

export const updateWgMemberHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const wm = await getWorkgroupMembership(req.params.wid, req.params.pid);
        if (!wm) { res.status(404).json({ error: "Workgroup membership not found" }); return; }
        res.json(await updateWorkgroupMember(wm.id, { is_workgroup_admin: !!req.body.is_workgroup_admin }));
    } catch (err) {
        next(err);
    }
};

export const removeWgMemberHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const alsoRemoveFromChat = req.query.alsoRemoveFromChat === "true";
        await removeWorkgroupMember(req.params.wid, req.params.pid, alsoRemoveFromChat);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

export const assignRoleHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { role_id } = req.body;
        if (!role_id) { res.status(400).json({ error: "role_id required" }); return; }
        const wm = await getWorkgroupMembership(req.params.wid, req.params.pid);
        if (!wm) { res.status(404).json({ error: "Workgroup membership not found" }); return; }
        try {
            res.status(201).json(await assignRole(wm.id, role_id));
        } catch (err: any) {
            if (err.code === "23505") { res.status(409).json({ error: "Role already assigned" }); return; }
            next(err);
        }
    } catch (err) {
        next(err);
    }
};

export const unassignRoleHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const wm = await getWorkgroupMembership(req.params.wid, req.params.pid);
        if (!wm) { res.status(404).json({ error: "Workgroup membership not found" }); return; }
        await unassignRole(wm.id, req.params.rid);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};
