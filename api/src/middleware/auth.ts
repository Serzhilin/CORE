import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthPayload {
    userId: string;
    ename: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}

function getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET required");
        return "core-dev-secret";
    }
    return secret;
}

export function signToken(payload: AuthPayload): string {
    return jwt.sign(payload, getSecret(), { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthPayload | null {
    try { return jwt.verify(token, getSecret()) as AuthPayload; }
    catch { return null; }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) { res.status(401).json({ error: "Authentication required" }); return; }
    const payload = verifyToken(header.slice(7));
    if (!payload) { res.status(401).json({ error: "Invalid or expired token" }); return; }
    req.user = payload;
    next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
        const payload = verifyToken(header.slice(7));
        if (payload) req.user = payload;
    }
    next();
}
