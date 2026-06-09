import { describe, it, expect } from "bun:test";
import { haversineKm, pathDistanceKm, isInsideGeofence } from "../geo-distance";

describe("haversineKm", () => {
  it("is zero for identical points", () => {
    expect(haversineKm(43.65, -79.38, 43.65, -79.38)).toBe(0);
  });

  it("approximates a known distance (Toronto -> Ottawa ~350km)", () => {
    const d = haversineKm(43.6532, -79.3832, 45.4215, -75.6972);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(360);
  });

  it("is symmetric", () => {
    const a = haversineKm(40.0, -75.0, 41.0, -76.0);
    const b = haversineKm(41.0, -76.0, 40.0, -75.0);
    expect(Math.abs(a - b)).toBeLessThan(1e-9);
  });
});

describe("pathDistanceKm", () => {
  it("returns 0 for a single point or empty path", () => {
    expect(pathDistanceKm([])).toBe(0);
    expect(pathDistanceKm([{ lat: 43.6, lng: -79.3 }])).toBe(0);
  });

  it("filters out GPS jitter under 5 meters", () => {
    // two points ~1m apart
    const d = pathDistanceKm([
      { lat: 43.650000, lng: -79.380000 },
      { lat: 43.650005, lng: -79.380000 },
    ]);
    expect(d).toBe(0);
  });

  it("filters out unrealistic jumps over 5km", () => {
    const d = pathDistanceKm([
      { lat: 43.0, lng: -79.0 },
      { lat: 44.0, lng: -79.0 }, // ~111km jump => discarded
    ]);
    expect(d).toBe(0);
  });

  it("accumulates legitimate movement", () => {
    // ~500m apart, within bounds
    const d = pathDistanceKm([
      { lat: 43.6500, lng: -79.3800 },
      { lat: 43.6545, lng: -79.3800 },
    ]);
    expect(d).toBeGreaterThan(0.4);
    expect(d).toBeLessThan(0.6);
  });
});

describe("isInsideGeofence", () => {
  const target = { lat: 43.6532, lng: -79.3832 };

  it("returns true at the exact target", () => {
    expect(isInsideGeofence(target.lat, target.lng, target.lat, target.lng, 20)).toBe(true);
  });

  it("returns true for a point within the radius", () => {
    // ~10m north
    expect(isInsideGeofence(43.65329, target.lng, target.lat, target.lng, 50)).toBe(true);
  });

  it("returns false for a point outside the radius", () => {
    // ~100m+ away vs a 20m fence
    expect(isInsideGeofence(43.6542, target.lng, target.lat, target.lng, 20)).toBe(false);
  });

  it("treats a zero/invalid radius as a point fence", () => {
    expect(isInsideGeofence(43.6542, target.lng, target.lat, target.lng, 0)).toBe(false);
  });
});
