import { describe, expect, it } from "vitest";
import {
  capitaliseName,
  generateSku,
  generateSlug,
  normaliseColour,
  normaliseFinish,
  normaliseRingSize,
} from "./catalog-rules";

describe("generateSku", () => {
  it("builds <CAT>-<3-digit article>-<finish> with no LN prefix", () => {
    expect(generateSku("EARRINGS", 1, "GOLD")).toBe("EAR-001-GD");
    expect(generateSku("RINGS", 2, "SILVER")).toBe("RNG-002-SL");
    expect(generateSku("BRACELETS", 5, "GOLD")).toBe("BRC-005-GD");
    expect(generateSku("NECKLACE", 12, "GOLD")).toBe("NCK-012-GD");
    expect(generateSku("NECKLACE", 123, "SILVER")).toBe("NCK-123-SL");
  });
});

describe("capitaliseName", () => {
  it("capitalises each word, trims and collapses spaces", () => {
    expect(capitaliseName("Aveline pearl drop ")).toBe("Aveline Pearl Drop");
    expect(capitaliseName("whirls")).toBe("Whirls");
    expect(capitaliseName("  aura   drop")).toBe("Aura Drop");
  });
  it("leaves the rest of each word alone", () => {
    expect(capitaliseName("LUNA mOON")).toBe("LUNA MOON");
  });
});

describe("generateSlug", () => {
  it("is url-safe and includes category + article", () => {
    expect(generateSlug("Aveline Pearl Drop", "EARRINGS", 1)).toBe("aveline-pearl-drop-ear-001");
    expect(generateSlug("Rosé & Gold!", "RINGS", 7)).toBe("rose-gold-rng-007");
  });
});

describe("normalisers", () => {
  it("colour: blank → None / Single, case-insensitive match, unknown → null", () => {
    expect(normaliseColour("")).toBe("None / Single");
    expect(normaliseColour(null)).toBe("None / Single");
    expect(normaliseColour(" royal  blue ")).toBe("Royal Blue");
    expect(normaliseColour("Sparkly")).toBeNull();
  });
  it("finish: Gold/Silver/GD/SL in any case", () => {
    expect(normaliseFinish("gold")).toBe("GOLD");
    expect(normaliseFinish("SL")).toBe("SILVER");
    expect(normaliseFinish("Bronze")).toBeNull();
  });
  it("ring size: numbers lose .0, words match the list", () => {
    expect(normaliseRingSize(8)).toBe("8");
    expect(normaliseRingSize("8.0")).toBe("8");
    expect(normaliseRingSize("adjustable")).toBe("Adjustable");
    expect(normaliseRingSize(null)).toBe("");
  });
});
