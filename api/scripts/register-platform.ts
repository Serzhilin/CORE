import path from "path";
import fs from "fs";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../.env") });

import { registerPlatform, PlatformIdentity } from "poplar";

const IDENTITY_PATH = path.resolve(__dirname, "../data/platform-identity.json");

function readIdentity(): PlatformIdentity | null {
    if (!fs.existsSync(IDENTITY_PATH)) return null;
    return JSON.parse(fs.readFileSync(IDENTITY_PATH, "utf-8"));
}

function writeIdentity(identity: PlatformIdentity): void {
    fs.mkdirSync(path.dirname(IDENTITY_PATH), { recursive: true });
    fs.writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2) + "\n");
}

async function main(): Promise<void> {
    const registryUrl = process.env.PUBLIC_REGISTRY_URL;
    const provisionerUrl = process.env.PUBLIC_PROVISIONER_URL;
    const verificationId = process.env.DEMO_VERIFICATION_CODE;
    const apiKey = process.env.DEVELOPER_API_KEY;
    if (!registryUrl) throw new Error("[register-platform] PUBLIC_REGISTRY_URL not set");
    if (!provisionerUrl) throw new Error("[register-platform] PUBLIC_PROVISIONER_URL not set");
    if (!verificationId) throw new Error("[register-platform] DEMO_VERIFICATION_CODE not set");
    if (!apiKey) throw new Error("[register-platform] DEVELOPER_API_KEY not set");

    const before = readIdentity();
    if (before?.metaEnvelopeId) {
        console.log(`[register-platform] already registered: w3id=${before.w3id} metaEnvelopeId=${before.metaEnvelopeId}`);
        return;
    }

    const identity = await registerPlatform(
        {
            registryUrl,
            provisionerUrl,
            verificationId,
            apiKey,
            profile: {
                platformName: "CommunityOrganisationAndRolesEngine",
                displayName: "CORE",
                description: "Manages community roles, membership and governance",
                url: "https://core.lab.ecommons.space",
                logoUrl: "https://core.lab.ecommons.space/logo.png",
                category: "Productivity",
                version: "1.0.0",
            },
        },
        before
    );
    writeIdentity(identity);

    console.log(`[register-platform] done. w3id=${identity.w3id} metaEnvelopeId=${identity.metaEnvelopeId}`);
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
