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

/** Requires req.user + :cid or :id param. Attaches req.membership. */
export function requireCommunityMember(req: Request, res: Response, next: NextFunction) {
    const communityId = req.params.cid || req.params.id;
    if (!req.user || !communityId) { res.status(403).json({ error: "Forbidden" }); return; }

    AppDataSource.getRepository(CommunityMembership)
        .findOne({ where: { person_id: req.user.userId, community_id: communityId } })
        .then((m) => {
            if (!m) { res.status(403).json({ error: "Not a member of this community" }); return; }
            req.membership = m;
            next();
        })
        .catch(() => res.status(500).json({ error: "Internal error" }));
}

export function requireCommunityAdmin(req: Request, res: Response, next: NextFunction) {
    requireCommunityMember(req, res, () => {
        if (!req.membership?.is_admin) { res.status(403).json({ error: "Admin access required" }); return; }
        next();
    });
}
