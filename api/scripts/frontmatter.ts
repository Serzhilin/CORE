export interface FrontmatterMeta {
    title: string;
    w3id: string | null;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export function parseFrontmatter(raw: string): { meta: FrontmatterMeta; body: string } {
    const match = FRONTMATTER_RE.exec(raw);
    if (!match) throw new Error("missing frontmatter block");
    const [, yaml, rest] = match;

    const titleMatch = /^title:\s*"(.*)"\s*$/m.exec(yaml);
    if (!titleMatch) throw new Error("frontmatter missing title");

    const w3idMatch = /^w3id:\s*(.+?)\s*$/m.exec(yaml);
    if (!w3idMatch) throw new Error("frontmatter missing w3id");
    const w3idRaw = w3idMatch[1].trim();
    const w3id = w3idRaw === "null" ? null : w3idRaw.replace(/^"(.*)"$/, "$1");

    const body = rest.replace(/^\n+/, "");
    return { meta: { title: titleMatch[1], w3id }, body };
}

export function stringifyFrontmatter(meta: FrontmatterMeta, body: string): string {
    const w3idLine = meta.w3id === null ? "w3id: null" : `w3id: "${meta.w3id}"`;
    return `---\ntitle: "${meta.title}"\n${w3idLine}\n---\n\n${body.trim()}\n`;
}
