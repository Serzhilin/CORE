import { parseFrontmatter, stringifyFrontmatter } from "../frontmatter";

describe("parseFrontmatter", () => {
    it("parses title and null w3id", () => {
        const raw = '---\ntitle: "What is CORE"\nw3id: null\n---\n\nCORE is a platform.\n';
        const { meta, body } = parseFrontmatter(raw);
        expect(meta).toEqual({ title: "What is CORE", w3id: null });
        expect(body).toBe("CORE is a platform.\n");
    });

    it("parses a populated w3id", () => {
        const raw = '---\ntitle: "What is CORE"\nw3id: "ce71a783-6ad3-50ea-994f-b671fbc58387"\n---\n\nBody text.\n';
        const { meta } = parseFrontmatter(raw);
        expect(meta.w3id).toBe("ce71a783-6ad3-50ea-994f-b671fbc58387");
    });

    it("throws when the frontmatter block is missing", () => {
        expect(() => parseFrontmatter("no frontmatter here")).toThrow("missing frontmatter block");
    });

    it("throws when title is missing", () => {
        const raw = '---\nw3id: null\n---\n\nBody.\n';
        expect(() => parseFrontmatter(raw)).toThrow("frontmatter missing title");
    });
});

describe("stringifyFrontmatter", () => {
    it("round-trips a null w3id", () => {
        const out = stringifyFrontmatter({ title: "What is CORE", w3id: null }, "CORE is a platform.");
        const { meta, body } = parseFrontmatter(out);
        expect(meta).toEqual({ title: "What is CORE", w3id: null });
        expect(body).toBe("CORE is a platform.\n");
    });

    it("round-trips a populated w3id", () => {
        const out = stringifyFrontmatter({ title: "What is CORE", w3id: "abc-123" }, "Body text.");
        const { meta } = parseFrontmatter(out);
        expect(meta.w3id).toBe("abc-123");
    });
});
