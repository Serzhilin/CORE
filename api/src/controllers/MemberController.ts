import { Request, Response } from "express";
import { listMembers, addMember, updateMember, removeMember, getMemberAvailabilityLog } from "../services/MemberService";
import { updatePerson } from "../services/PersonService";
import { applyAvailability } from "../services/AvailabilityService";
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";

export async function listMembersHandler(req: Request, res: Response) {
    res.json(await listMembers(req.params.cid));
}

export async function addMemberHandler(req: Request, res: Response) {
    const { first_name, last_name, email } = req.body;
    if (!first_name || !last_name) {
        res.status(400).json({ error: "first_name and last_name are required" });
        return;
    }
    try {
        const m = await addMember(req.params.cid, { first_name, last_name, email });
        res.status(201).json(m);
    } catch (err: any) {
        if (err.code === "23505") { res.status(409).json({ error: "Person is already a member" }); return; }
        throw err;
    }
}

export async function updateMemberHandler(req: Request, res: Response) {
    const patch = Object.fromEntries(
        Object.entries({ is_admin: req.body.is_admin, is_aspirant: req.body.is_aspirant, is_active_partner: req.body.is_active_partner, joined_at: req.body.joined_at })
            .filter(([, v]) => v !== undefined)
    );
    try {
        const membership = await AppDataSource.getRepository(CommunityMembership).findOneOrFail({
            where: { person_id: req.params.pid, community_id: req.params.cid },
        });
        const m = await updateMember(membership.id, patch);
        res.json(m);
    } catch (err: any) {
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Membership not found" }); return; }
        throw err;
    }
}

export async function deleteMemberHandler(req: Request, res: Response) {
    const membership = await AppDataSource.getRepository(CommunityMembership).findOne({
        where: { person_id: req.params.pid, community_id: req.params.cid },
    });
    if (!membership) { res.status(404).json({ error: "Membership not found" }); return; }
    await removeMember(req.params.cid, membership.id);
    res.status(204).send();
}

export async function setMyAvailability(req: Request, res: Response) {
    const m = await AppDataSource.getRepository(CommunityMembership).findOne({
        where: { person_id: req.user!.userId, community_id: req.params.cid },
    });
    if (!m) { res.status(404).json({ error: "Membership not found" }); return; }
    const { type_id, reason, until, clear } = req.body;
    if (until && isNaN(new Date(until).getTime())) {
        res.status(400).json({ error: "Invalid until date" }); return;
    }
    const updated = await applyAvailability(m.id, {
        type_id: type_id ?? null,
        reason: reason ?? null,
        until: until ? new Date(until) : null,
        clear: !!clear,
    });
    res.json(updated);
}

export async function setMemberAvailability(req: Request, res: Response) {
    // Verify membership belongs to this community
    const existing = await AppDataSource.getRepository(CommunityMembership).findOne({
        where: { id: req.params.pid, community_id: req.params.cid },
    });
    if (!existing) { res.status(404).json({ error: "Membership not found in this community" }); return; }

    const { type_id, reason, until, clear } = req.body;
    if (until && isNaN(new Date(until).getTime())) {
        res.status(400).json({ error: "Invalid until date" }); return;
    }
    try {
        const updated = await applyAvailability(req.params.pid, {
            type_id: type_id ?? null,
            reason: reason ?? null,
            until: until ? new Date(until) : null,
            clear: !!clear,
        });
        res.json(updated);
    } catch (err: any) {
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Membership not found" }); return; }
        throw err;
    }
}

export async function getMemberAvailabilityLogHandler(req: Request, res: Response) {
    res.json(await getMemberAvailabilityLog(req.params.pid));
}

export async function updateMemberPersonHandler(req: Request, res: Response) {
    const { ename } = req.body;
    try {
        const person = await updatePerson(req.params.pid, { ename: ename ?? null });
        res.json(person);
    } catch (err: any) {
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Person not found" }); return; }
        if (err.code === "23505") { res.status(409).json({ error: "eName already in use" }); return; }
        throw err;
    }
}
