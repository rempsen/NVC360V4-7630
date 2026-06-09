import { describe, it, expect } from "bun:test";
import { lookupTax, taxRegionOptions, regionFromAddress } from "../tax";

describe("lookupTax — Canada", () => {
  it("resolves Ontario HST", () => {
    const t = lookupTax("ON")!;
    expect(t.country).toBe("CA");
    expect(t.rate).toBe(13);
    expect(t.label).toBe("HST 13%");
  });

  it("resolves Quebec combined rate", () => {
    expect(lookupTax("QC")!.rate).toBe(14.975);
  });

  it("resolves Alberta GST-only", () => {
    expect(lookupTax("AB")!.rate).toBe(5);
  });

  it("is case-insensitive and trims", () => {
    expect(lookupTax("  on ")!.rate).toBe(13);
  });
});

describe("lookupTax — US", () => {
  it("resolves a US state with the US- prefix", () => {
    const t = lookupTax("US-CA")!;
    expect(t.country).toBe("US");
    expect(t.rate).toBe(7.25);
  });

  it("labels zero-tax states correctly", () => {
    const t = lookupTax("US-OR")!;
    expect(t.rate).toBe(0);
    expect(t.label).toBe("No sales tax");
  });
});

describe("lookupTax — invalid", () => {
  it("returns null for unknown / empty codes", () => {
    expect(lookupTax(null)).toBeNull();
    expect(lookupTax("")).toBeNull();
    expect(lookupTax("ZZ")).toBeNull();
    expect(lookupTax("US-ZZ")).toBeNull();
  });
});

describe("taxRegionOptions", () => {
  it("returns both Canada and US groups", () => {
    const opts = taxRegionOptions();
    expect(opts.some((o) => o.group === "Canada")).toBe(true);
    expect(opts.some((o) => o.group === "United States")).toBe(true);
    expect(opts.find((o) => o.code === "ON")).toBeDefined();
    expect(opts.find((o) => o.code === "US-NY")).toBeDefined();
  });
});

describe("regionFromAddress", () => {
  it("detects a province by name", () => {
    expect(regionFromAddress("123 King St, Toronto, Ontario")).toBe("ON");
  });

  it("detects a province by major city", () => {
    expect(regionFromAddress("500 Granville, Vancouver")).toBe("BC");
    expect(regionFromAddress("Calgary AB")).toBe("AB");
  });

  it("detects a US state from a zip-coded address", () => {
    expect(regionFromAddress("350 5th Ave, New York NY 10001")).toBe("US-NY");
  });

  it("returns null when nothing matches", () => {
    expect(regionFromAddress("")).toBeNull();
    expect(regionFromAddress("somewhere unknown")).toBeNull();
  });
});
