import { describe, it, expect } from "bun:test";
import { liveOnSiteMinutes } from "../../shared/clock";

describe("liveOnSiteMinutes (booking on-site clock)", () => {
  it("returns banked minutes when the clock is idle", () => {
    expect(liveOnSiteMinutes({ accumulatedMs: 30 * 60_000, clockState: "idle", lastResumeAt: null })).toBe(30);
  });

  it("returns banked minutes when paused (running segment excluded)", () => {
    expect(
      liveOnSiteMinutes({ accumulatedMs: 12 * 60_000, clockState: "paused", lastResumeAt: new Date(Date.now() - 60_000) }),
    ).toBe(12);
  });

  it("adds the in-flight running segment to banked time", () => {
    const m = liveOnSiteMinutes({
      accumulatedMs: 10 * 60_000,
      clockState: "running",
      lastResumeAt: new Date(Date.now() - 5 * 60_000), // +5 min live
    });
    // ~15 minutes, allow tiny timing slack
    expect(m).toBeGreaterThanOrEqual(14.9);
    expect(m).toBeLessThanOrEqual(15.1);
  });

  it("handles a zero/fresh clock", () => {
    expect(liveOnSiteMinutes({ accumulatedMs: 0, clockState: "idle", lastResumeAt: null })).toBe(0);
  });

  it("ignores a running state with no resume timestamp", () => {
    expect(liveOnSiteMinutes({ accumulatedMs: 6 * 60_000, clockState: "running", lastResumeAt: null })).toBe(6);
  });
});
