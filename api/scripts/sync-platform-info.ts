import path from "path";
import fs from "fs";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../.env") });

import { syncPlatformInfo } from "poplar";

const DOCS_ROOT = path.resolve(__dirname, "../../docs/platform-info");
const IDENTITY_PATH = path.resolve(__dirname, "../data/platform-identity.json");

interface PlatformIdentity {
    w3id: string;
}

function readPlatformEname(): string {
    if (!fs.existsSync(IDENTITY_PATH)) {
        throw new Error(`[sync-platform-info] ${IDENTITY_PATH} not found — run "npm run register-platform" first`);
    }
    const identity: PlatformIdentity = JSON.parse(fs.readFileSync(IDENTITY_PATH, "utf-8"));
    if (!identity.w3id) {
        throw new Error("[sync-platform-info] platform-identity.json has no w3id");
    }
    return identity.w3id;
}

async function main(): Promise<void> {
    const registryUrl = process.env.PUBLIC_REGISTRY_URL;
    const apiKey = process.env.DEVELOPER_API_KEY;
    if (!registryUrl) throw new Error("[sync-platform-info] PUBLIC_REGISTRY_URL not set");
    if (!apiKey) throw new Error("[sync-platform-info] DEVELOPER_API_KEY not set");

    const platformEname = readPlatformEname();
    const result = await syncPlatformInfo({
        registryUrl,
        apiKey,
        platformEname,
        docsRoot: DOCS_ROOT,
    });

    for (const relative of result.created) console.log(`[sync-platform-info] created: ${relative}`);
    for (const relative of result.updated) console.log(`[sync-platform-info] updated: ${relative}`);
    console.log(`[sync-platform-info] done. created=${result.created.length} updated=${result.updated.length}`);
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    });
}
