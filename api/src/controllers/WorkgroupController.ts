import { Request, Response } from "express";
import {
    listWorkgroups, createWorkgroup, updateWorkgroup, deleteWorkgroup,
    createRole, updateRole, deleteRole,
    addWorkgroupMember, updateWorkgroupMember, removeWorkgroupMember,
    assignRole, unassignRole, getWorkgroupMembership,
} from "../services/WorkgroupService";

export const listWorkgroupsHandler = async (req: Request, res: Response) =>
    res.json(await listWorkgroups(req.params.cid));

export const createWorkgroupHandler = async (req: Request, res: Response) => {
    const { name, description, color } = req.body;
    if (!name) { res.status(400).json({ error: "name required" }); return; }
    res.status(201).json(await createWorkgroup(req.params.cid, { name, description, color }));
};

export const updateWorkgroupHandler = async (req: Request, res: Response) =>
    res.json(await updateWorkgroup(req.params.wid, req.params.cid, req.body));

export const deleteWorkgroupHandler = async (req: Request, res: Response) => {
    await deleteWorkgroup(req.params.wid, req.params.cid);
    res.status(204).send();
};

export const createRoleHandler = async (req: Request, res: Response) => {
    const { name, description, color } = req.body;
    if (!name) { res.status(400).json({ error: "name required" }); return; }
    res.status(201).json(await createRole(req.params.wid, { name, description, color }));
};

export const updateRoleHandler = async (req: Request, res: Response) =>
    res.json(await updateRole(req.params.rid, req.params.wid, req.body));

export const deleteRoleHandler = async (req: Request, res: Response) => {
    await deleteRole(req.params.rid, req.params.wid);
    res.status(204).send();
};

export const addWgMemberHandler = async (req: Request, res: Response) => {
    const { person_id } = req.body;
    if (!person_id) { res.status(400).json({ error: "person_id required" }); return; }
    try {
        res.status(201).json(await addWorkgroupMember(req.params.wid, person_id));
    } catch (err: any) {
        if (err.code === "23505") { res.status(409).json({ error: "Already a member" }); return; }
        throw err;
    }
};

export const updateWgMemberHandler = async (req: Request, res: Response) =>
    res.json(await updateWorkgroupMember(req.params.pid, { is_workgroup_admin: !!req.body.is_workgroup_admin }));

export const removeWgMemberHandler = async (req: Request, res: Response) => {
    await removeWorkgroupMember(req.params.wid, req.params.pid);
    res.status(204).send();
};

export const assignRoleHandler = async (req: Request, res: Response) => {
    const { role_id } = req.body;
    if (!role_id) { res.status(400).json({ error: "role_id required" }); return; }
    const wm = await getWorkgroupMembership(req.params.wid, req.params.pid);
    if (!wm) { res.status(404).json({ error: "Workgroup membership not found" }); return; }
    try {
        res.status(201).json(await assignRole(wm.id, role_id));
    } catch (err: any) {
        if (err.code === "23505") { res.status(409).json({ error: "Role already assigned" }); return; }
        throw err;
    }
};

export const unassignRoleHandler = async (req: Request, res: Response) => {
    const wm = await getWorkgroupMembership(req.params.wid, req.params.pid);
    if (!wm) { res.status(404).json({ error: "Workgroup membership not found" }); return; }
    await unassignRole(wm.id, req.params.rid);
    res.status(204).send();
};
