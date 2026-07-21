// Normalizes a display name into a URL-safe Community.slug candidate. Diacritics are
// stripped (not transliterated) — "Café" -> "cafe", not "caf-e". Never returns an empty
// string, so it's always safe to use directly or with a numeric dedup suffix appended.
export function slugify(name: string): string {
    const slug = name
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug || "community";
}
