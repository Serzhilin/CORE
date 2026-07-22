import path from "path";
import fs from "fs";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../.env") });

import { createEnvelope, updateEnvelope } from "../src/lib/evault-client";
import { ONTOLOGIES } from "../src/lib/w3ds/ontology";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter";

const DOCS_ROOT = path.resolve(__dirname, "../../docs/platform-info");
const IDENTITY_PATH = path.resolve(__dirname, "../data/platform-identity.json");
const VALID_AUDIENCES = ["user", "marketplace", "agents", "ontology-spec"] as const;
type Audience = (typeof VALID_AUDIENCES)[number];

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

function findMarkdownFiles(root: string): string[] {
    return (fs.readdirSync(root, { recursive: true }) as string[])
        .filter((entry) => entry.endsWith(".md"))
        .map((entry) => path.join(root, entry))
        .sort();
}

export function deriveAudience(filePath: string, root: string): Audience {
    const relative = path.relative(root, filePath);
    const segment = relative.split(path.sep)[0];
    if (!(VALID_AUDIENCES as readonly string[]).includes(segment)) {
        throw new Error(
            `[sync-platform-info] ${filePath}: parent folder "${segment}" is not a valid audience (${VALID_AUDIENCES.join(", ")})`
        );
    }
    return segment as Audience;
}

export function buildPayload(title: string, audience: Audience | string, content: string, updatedAt: string) {
    return { title, audience, content, updatedAt };
}

async function syncFile(filePath: string, platformEname: string): Promise<{ created: boolean }> {
    const raw = fs.readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    const audience = deriveAudience(filePath, DOCS_ROOT);
    const now = new Date().toISOString();
    const payload = buildPayload(meta.title, audience, body, now);

    if (meta.w3id === null) {
        const envelopeId = await createEnvelope({
            vaultEname: platformEname,
            ontology: ONTOLOGIES.PlatformInfo,
            payload,
            acl: ["*"],
        });
        fs.writeFileSync(filePath, stringifyFrontmatter({ title: meta.title, w3id: envelopeId }, body));
        return { created: true };
    }

    await updateEnvelope({
        vaultEname: platformEname,
        envelopeId: meta.w3id,
        ontology: ONTOLOGIES.PlatformInfo,
        payload,
        acl: ["*"],
    });
    return { created: false };
}

async function main(): Promise<void> {
    const platformEname = readPlatformEname();
    const files = findMarkdownFiles(DOCS_ROOT);
    let created = 0;
    let updated = 0;

    for (const filePath of files) {
        const result = await syncFile(filePath, platformEname);
        if (result.created) created++;
        else updated++;
        console.log(`[sync-platform-info] ${result.created ? "created" : "updated"}: ${path.relative(DOCS_ROOT, filePath)}`);
    }

    console.log(`[sync-platform-info] done. created=${created} updated=${updated}`);
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    });
}
