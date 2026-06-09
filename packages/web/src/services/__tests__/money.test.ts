import { describe, it, expect } from "bun:test";
import { toMinor, fromMinor } from "../stripe";

describe("Stripe money conversion", () => {
  it("converts dollars to integer cents", () => {
    expect(toMinor(1)).toBe(100);
    expect(toMinor(19.99)).toBe(1999);
    expect(toMinor(0)).toBe(0);
  });

  it("rounds floating point dollar amounts to the nearest cent", () => {
    // classic 0.1+0.2 float artifact
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(12.005)).toBe(1201); // round half up
  });

  it("converts cents back to dollars", () => {
    expect(fromMinor(100)).toBe(1);
    expect(fromMinor(1999)).toBe(19.99);
  });

  it("round-trips a range of amounts without drift", () => {
    for (const amt of [1, 19.99, 100.5, 0.05, 1234.56]) {
      expect(fromMinor(toMinor(amt))).toBe(amt);
    }
  });
});
