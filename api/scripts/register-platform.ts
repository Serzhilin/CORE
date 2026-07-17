import path from "path";
import fs from "fs";
import { config } from "dotenv";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

config({ path: path.resolve(__dirname, "../../.env") });

import { createEnvelope } from "../src/lib/evault-client";
import { ONTOLOGIES } from "../src/lib/w3ds/ontology";

const IDENTITY_PATH = path.resolve(__dirname, "../data/platform-identity.json");

interface PlatformIdentity {
    w3id: string;
    uri: string;
    metaEnvelopeId: string | null;
    registeredAt: string | null;
}

function readIdentity(): PlatformIdentity | null {
    if (!fs.existsSync(IDENTITY_PATH)) return null;
    return JSON.parse(fs.readFileSync(IDENTITY_PATH, "utf-8"));
}

function writeIdentity(identity: PlatformIdentity): void {
    fs.mkdirSync(path.dirname(IDENTITY_PATH), { recursive: true });
    fs.writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2) + "\n");
}

function describeError(err: unknown): string {
    if (axios.isAxiosError(err)) {
        return `${err.response?.status ?? "no status"} ${JSON.stringify(err.response?.data ?? err.message)}`;
    }
    return err instanceof Error ? err.message : String(err);
}

async function fetchEntropy(registryUrl: string): Promise<string> {
    try {
        const res = await axios.get<{ token: string }>(`${registryUrl}/entropy`, { timeout: 10_000 });
        return res.data.token;
    } catch (err) {
        throw new Error(`[register-platform] GET /entropy failed: ${describeError(err)}`);
    }
}

async function provisionPlatformEvault(
    provisionerUrl: string,
    registryEntropy: string,
    verificationId: string
): Promise<{ w3id: string; uri: string }> {
    try {
        const res = await axios.post<{ success: boolean; w3id: string; uri: string }>(
            `${provisionerUrl}/provision`,
            { registryEntropy, namespace: uuidv4(), verificationId },
            { headers: { "Content-Type": "application/json" }, timeout: 15_000 }
        );
        if (res.data.success !== true) {
            throw new Error(`provisioner returned success!==true: ${JSON.stringify(res.data)}`);
        }
        return { w3id: res.data.w3id, uri: res.data.uri };
    } catch (err) {
        throw new Error(`[register-platform] POST /provision failed: ${describeError(err)}`);
    }
}

async function writePlatformProfile(w3id: string): Promise<string> {
    const now = new Date().toISOString();
    try {
        return await createEnvelope({
            vaultEname: w3id,
            ontology: ONTOLOGIES.User,
            payload: {
                platformName: "CommunityOrganisationAndRolesEngine",
                displayName: "CORE",
                description: "Manages community roles, membership and governance",
                ename: w3id,
                url: "https://core.lab.ecommons.space",
                logoUrl: "https://core.lab.ecommons.space/logo.png",
                category: "Productivity",
                isActive: true,
                isArchived: false,
                version: "1.0.0",
                createdAt: now,
                updatedAt: now,
            },
            acl: ["*"],
        });
    } catch (err) {
        throw new Error(`[register-platform] PlatformProfile envelope write failed: ${describeError(err)}`);
    }
}

async function main(): Promise<void> {
    const registryUrl = process.env.PUBLIC_REGISTRY_URL;
    const provisionerUrl = process.env.PUBLIC_PROVISIONER_URL;
    const verificationId = process.env.DEMO_VERIFICATION_CODE;
    if (!registryUrl) throw new Error("[register-platform] PUBLIC_REGISTRY_URL not set");
    if (!provisionerUrl) throw new Error("[register-platform] PUBLIC_PROVISIONER_URL not set");
    if (!verificationId) throw new Error("[register-platform] DEMO_VERIFICATION_CODE not set");

    let identity = readIdentity();

    if (identity?.metaEnvelopeId) {
        console.log(`[register-platform] already registered: w3id=${identity.w3id} metaEnvelopeId=${identity.metaEnvelopeId}`);
        return;
    }

    if (!identity?.w3id) {
        console.log("[register-platform] fetching entropy...");
        const entropy = await fetchEntropy(registryUrl);
        console.log("[register-platform] provisioning platform eVault...");
        const { w3id, uri } = await provisionPlatformEvault(provisionerUrl, entropy, verificationId);
        identity = { w3id, uri, metaEnvelopeId: null, registeredAt: null };
        writeIdentity(identity);
        console.log(`[register-platform] provisioned: w3id=${w3id} uri=${uri}`);
    } else {
        console.log(`[register-platform] resuming with existing w3id=${identity.w3id} (envelope write not yet confirmed)`);
    }

    console.log("[register-platform] writing PlatformProfile envelope...");
    const metaEnvelopeId = await writePlatformProfile(identity.w3id);
    identity = { ...identity, metaEnvelopeId, registeredAt: new Date().toISOString() };
    writeIdentity(identity);

    console.log(`[register-platform] done. w3id=${identity.w3id} metaEnvelopeId=${metaEnvelopeId}`);
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
