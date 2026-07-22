import path from "path";
import fs from "fs";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../.env") });

import { registerPlatform, PlatformIdentity, PlatformConfigFile } from "poplar";

const IDENTITY_PATH = path.resolve(__dirname, "../data/platform-identity.json");
const CONFIG_PATH = path.resolve(__dirname, "../platform.config.json");

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

    const platformConfig: PlatformConfigFile = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

    const identity = await registerPlatform(
        {
            registryUrl,
            provisionerUrl,
            verificationId,
            apiKey,
            // CORE has no cryptographic keypair — a keyless platform eVault,
            // so publicKey stays unset (see platform.config.json).
            publicKey: platformConfig.publicKey,
            profile: platformConfig,
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
