import { Request, Response } from "express";
import { listMembers, addMember, updateMember, removeMember, getMemberAvailabilityLog } from "../services/MemberService";
import { updatePerson } from "../services/PersonService";
import { applyAvailability } from "../services/AvailabilityService";
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Person } from "../database/entities/Person";
import { getById as getCommunityById, addParticipantToEnvelope } from "../services/CommunityService";
import { getUserMetaEnvelopeId } from "../lib/evault-client";
import { logger } from "../lib/logger";

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
    const existing = await AppDataSource.getRepository(CommunityMembership).findOne({
        where: { person_id: req.params.pid, community_id: req.params.cid },
    });
    if (!existing) { res.status(404).json({ error: "Membership not found in this community" }); return; }

    const { type_id, reason, until, clear } = req.body;
    if (until && isNaN(new Date(until).getTime())) {
        res.status(400).json({ error: "Invalid until date" }); return;
    }
    try {
        const updated = await applyAvailability(existing.id, {
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
        if (ename) {
            syncClaimedIdentity(req.params.cid, person).catch((err) =>
                logger.warn(err, "Chat envelope sync failed after identity claim for person %s", person.id)
            );
        }
        res.json(person);
    } catch (err: any) {
        if (err.name === "EntityNotFoundError") { res.status(404).json({ error: "Person not found" }); return; }
        if (err.code === "23505") { res.status(409).json({ error: "eName already in use" }); return; }
        throw err;
    }
}

// CORE's "claim identity" moment: an admin has just set a shell Person's eName.
// Resolve their W3DS User MetaEnvelope ID and add them to the community's Chat envelope, if linked.
async function syncClaimedIdentity(communityId: string, person: Person): Promise<void> {
    if (!person.ename) return;
    const community = await getCommunityById(communityId);
    if (!community) return;

    const metaEnvelopeId = person.meta_envelope_id ?? (await getUserMetaEnvelopeId(person.ename));
    if (!metaEnvelopeId) return;
    if (!person.meta_envelope_id) await AppDataSource.getRepository(Person).update(person.id, { meta_envelope_id: metaEnvelopeId });

    const membership = await AppDataSource.getRepository(CommunityMembership).findOne({
        where: { person_id: person.id, community_id: communityId },
    });
    if (membership) await AppDataSource.getRepository(CommunityMembership).update(membership.id, { meta_envelope_id: metaEnvelopeId });

    await addParticipantToEnvelope(community, metaEnvelopeId);
}
