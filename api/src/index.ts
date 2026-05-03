import "reflect-metadata";
import path from "path";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { AppDataSource } from "./database/data-source";
import { requireAuth } from "./middleware/auth";
import { requireCommunityMember, requireCommunityAdmin } from "./middleware/communityAccess";
import { getOffer, epassportLogin, sseAuthStream, devLogin, getMe, updateMe } from "./controllers/AuthController";
import { listCommunities, createCommunityHandler, getCommunityHandler, updateCommunityHandler, getCommunityGraphHandler } from "./controllers/CommunityController";
import { listMembersHandler, addMemberHandler, updateMemberHandler, deleteMemberHandler, setMyAvailability, setMemberAvailability, getMemberAvailabilityLogHandler } from "./controllers/MemberController";
import { listHandler as listAtHandler, createHandler as createAtHandler, updateHandler as updateAtHandler, archiveHandler as archiveAtHandler } from "./controllers/AvailabilityTypeController";
import {
    listWorkgroupsHandler, createWorkgroupHandler, updateWorkgroupHandler, deleteWorkgroupHandler,
    createRoleHandler, updateRoleHandler, deleteRoleHandler,
    addWgMemberHandler, updateWgMemberHandler, removeWgMemberHandler,
    assignRoleHandler, unassignRoleHandler,
} from "./controllers/WorkgroupController";

config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const port = process.env.PORT || 3002;

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));
app.use(express.json({ limit: "10mb" }));
app.use(pinoHttp({
    logger,
    autoLogging: { ignore: (req) => !!req.url?.includes("/stream") },
    customLogLevel: (_req, res) => {
        if (res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
    },
}));

app.get("/api/health", (_, res) =>
    res.json({ status: "ok", db: AppDataSource.isInitialized ? "connected" : "disconnected" })
);

// ── Auth ──────────────────────────────────────────────────────────────────────
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.get("/api/auth/offer", authLimiter, getOffer);
app.post("/api/auth/login", authLimiter, epassportLogin);
app.post("/api/auth/dev-login", devLogin);
app.get("/api/auth/sessions/:id", sseAuthStream);
app.get("/api/me", requireAuth, getMe);
app.patch("/api/me", requireAuth, updateMe);

// ── Communities ───────────────────────────────────────────────────────────────
app.get("/api/communities", requireAuth, listCommunities);
app.post("/api/communities", requireAuth, createCommunityHandler);
app.get("/api/communities/:id", requireAuth, requireCommunityMember, getCommunityHandler);
app.get("/api/communities/:id/graph", requireAuth, requireCommunityMember, getCommunityGraphHandler);
app.patch("/api/communities/:id", requireAuth, requireCommunityAdmin, updateCommunityHandler);

// ── Community Members ─────────────────────────────────────────────────────────
app.get("/api/communities/:cid/members", requireAuth, requireCommunityMember, listMembersHandler);
app.post("/api/communities/:cid/members", requireAuth, requireCommunityAdmin, addMemberHandler);
app.patch("/api/communities/:cid/members/:pid", requireAuth, requireCommunityAdmin, updateMemberHandler);
app.delete("/api/communities/:cid/members/:pid", requireAuth, requireCommunityAdmin, deleteMemberHandler);
app.patch("/api/communities/:cid/me/availability", requireAuth, requireCommunityMember, setMyAvailability);
app.patch("/api/communities/:cid/members/:pid/availability", requireAuth, requireCommunityAdmin, setMemberAvailability);
app.get("/api/communities/:cid/members/:pid/availability-log", requireAuth, requireCommunityAdmin, getMemberAvailabilityLogHandler);

// ── Availability Types ────────────────────────────────────────────────────────
app.get("/api/communities/:cid/availability-types", requireAuth, requireCommunityMember, listAtHandler);
app.post("/api/communities/:cid/availability-types", requireAuth, requireCommunityAdmin, createAtHandler);
app.patch("/api/communities/:cid/availability-types/:tid", requireAuth, requireCommunityAdmin, updateAtHandler);
app.delete("/api/communities/:cid/availability-types/:tid", requireAuth, requireCommunityAdmin, archiveAtHandler);

// ── Workgroups ────────────────────────────────────────────────────────────────
app.get("/api/communities/:cid/workgroups", requireAuth, requireCommunityMember, listWorkgroupsHandler);
app.post("/api/communities/:cid/workgroups", requireAuth, requireCommunityAdmin, createWorkgroupHandler);
app.patch("/api/communities/:cid/workgroups/:wid", requireAuth, requireCommunityAdmin, updateWorkgroupHandler);
app.delete("/api/communities/:cid/workgroups/:wid", requireAuth, requireCommunityAdmin, deleteWorkgroupHandler);

app.post("/api/workgroups/:wid/roles", requireAuth, createRoleHandler);
app.patch("/api/workgroups/:wid/roles/:rid", requireAuth, updateRoleHandler);
app.delete("/api/workgroups/:wid/roles/:rid", requireAuth, deleteRoleHandler);

app.post("/api/workgroups/:wid/members", requireAuth, addWgMemberHandler);
app.patch("/api/workgroups/:wid/members/:pid", requireAuth, updateWgMemberHandler);
app.delete("/api/workgroups/:wid/members/:pid", requireAuth, removeWgMemberHandler);
app.post("/api/workgroups/:wid/members/:pid/roles", requireAuth, assignRoleHandler);
app.delete("/api/workgroups/:wid/members/:pid/roles/:rid", requireAuth, unassignRoleHandler);

// ── Production: serve React app ───────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
    const clientPath = path.join(__dirname, "../client");
    app.use(express.static(clientPath));
    app.use((_req, res) => res.sendFile(path.join(clientPath, "index.html")));
}

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(err);
    res.status(500).json({ error: "Internal server error" });
});

AppDataSource.initialize()
    .then(() => {
        app.listen(port, () => logger.info(`CORE API running on :${port}`));
    })
    .catch((err) => {
        logger.error(err, "DB init failed");
        process.exit(1);
    });

export { app };
