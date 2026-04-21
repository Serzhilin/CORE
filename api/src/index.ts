import "reflect-metadata";
import path from "path";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import { logger } from "./lib/logger";
import { AppDataSource } from "./database/data-source";

config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const port = process.env.PORT || 3002;

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_, res) =>
    res.json({ status: "ok", db: AppDataSource.isInitialized ? "connected" : "disconnected" })
);

AppDataSource.initialize()
    .then(() => {
        app.listen(port, () => logger.info(`CORE API running on :${port}`));
    })
    .catch((err) => {
        logger.error(err, "DB init failed");
        process.exit(1);
    });

export { app };
