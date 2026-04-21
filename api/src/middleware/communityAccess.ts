import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";

declare global {
    namespace Express {
        interface Request {
            membership?: CommunityMembership;
        }
    }
}

export async function requireCommunityMember(req: Request, res: Response, next: NextFunction) {
    const communityId = req.params.cid || req.params.id;
    if (!req.user || !communityId) { res.status(403).json({ error: "Forbidden" }); return; }
    try {
        const m = await AppDataSource.getRepository(CommunityMembership)
            .findOne({ where: { person_id: req.user.userId, community_id: communityId } });
        if (!m) { res.status(403).json({ error: "Not a member of this community" }); return; }
        req.membership = m;
        next();
    } catch (err) {
        next(err);
    }
}

export async function requireCommunityAdmin(req: Request, res: Response, next: NextFunction) {
    await requireCommunityMember(req, res, async () => {
        if (!req.membership?.is_admin) { res.status(403).json({ error: "Admin access required" }); return; }
        next();
    });
}
