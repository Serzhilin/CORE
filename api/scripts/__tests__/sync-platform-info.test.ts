import path from "path";
import { deriveAudience, buildPayload } from "../sync-platform-info";

const ROOT = path.resolve(__dirname, "../../../docs/platform-info");

describe("deriveAudience", () => {
    it("derives 'user' from a file under docs/platform-info/user/", () => {
        const filePath = path.join(ROOT, "user", "overview.md");
        expect(deriveAudience(filePath, ROOT)).toBe("user");
    });

    it("derives 'ontology-spec' from a file under docs/platform-info/ontology-spec/", () => {
        const filePath = path.join(ROOT, "ontology-spec", "user.md");
        expect(deriveAudience(filePath, ROOT)).toBe("ontology-spec");
    });

    it("throws for a file under an unrecognized folder", () => {
        const filePath = path.join(ROOT, "bogus", "file.md");
        expect(() => deriveAudience(filePath, ROOT)).toThrow('not a valid audience');
    });
});

describe("buildPayload", () => {
    it("assembles the envelope payload verbatim", () => {
        const payload = buildPayload("What is CORE", "user", "CORE is a platform.", "2026-07-22T00:00:00.000Z");
        expect(payload).toEqual({
            title: "What is CORE",
            audience: "user",
            content: "CORE is a platform.",
            updatedAt: "2026-07-22T00:00:00.000Z",
        });
    });
});
