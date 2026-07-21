import { slugify } from "../slugify";

describe("slugify", () => {
    it("lowercases and hyphenates a normal name", () => {
        expect(slugify("De Woonwolk")).toBe("de-woonwolk");
    });

    it("strips diacritics", () => {
        expect(slugify("Café Society")).toBe("cafe-society");
    });

    it("collapses non-alphanumeric runs into a single hyphen", () => {
        expect(slugify("Foo & Bar!!  Baz")).toBe("foo-bar-baz");
    });

    it("trims leading and trailing hyphens", () => {
        expect(slugify("--Community--")).toBe("community");
    });

    it("falls back to 'community' when nothing alphanumeric remains", () => {
        expect(slugify("!!!")).toBe("community");
    });
});
