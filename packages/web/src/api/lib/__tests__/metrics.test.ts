/**
 * Unit tests for the metrics module: path templating (cardinality control),
 * histogram/quantile math, and both exposition formats.
 */
import { describe, it, expect, beforeEach } from "bun:test";
import {
  templatePath,
  recordHttp,
  incr,
  renderProm,
  renderJson,
  resetMetrics,
} from "../metrics";

beforeEach(() => resetMetrics());

describe("templatePath — keeps cardinality low", () => {
  it("collapses numeric ids", () => {
    expect(templatePath("/api/bookings/12345")).toBe("/api/bookings/:id");
  });
  it("collapses uuid / long opaque ids", () => {
    expect(templatePath("/api/bookings/3f9a1c2e-1b2c-4d5e-8f90-aabbccddeeff")).toBe(
      "/api/bookings/:id",
    );
    expect(templatePath("/api/invoices/nvcpub_abcdefghijklmnopqrstuvwx")).toBe(
      "/api/invoices/:id",
    );
  });
  it("collapses emails in the path", () => {
    expect(templatePath("/api/users/jane@acme.com")).toBe("/api/users/:id");
  });
  it("leaves stable segments intact", () => {
    expect(templatePath("/api/bookings")).toBe("/api/bookings");
    expect(templatePath("/api/messages/dispatch/threads")).toBe(
      "/api/messages/dispatch/threads",
    );
  });
});

describe("recordHttp + renderJson — SLIs", () => {
  it("computes request total, error rate and per-route quantiles", () => {
    // 9 fast 2xx + 1 slow 5xx on the same route template (uuid-style ids fold
    // into one :id template — that's the cardinality guarantee).
    for (let i = 0; i < 9; i++)
      recordHttp("GET", "/api/bookings/3f9a1c2e-1b2c-4d5e-8f90-aabbccddee01", 200, 20);
    recordHttp("GET", "/api/bookings/3f9a1c2e-1b2c-4d5e-8f90-aabbccddee02", 500, 2000);

    const snap = renderJson();
    expect(snap.requests_total).toBe(10);
    expect(snap.errors_5xx_total).toBe(1);
    expect(snap.error_rate).toBeCloseTo(0.1, 3);

    // Both concrete ids fold into one templated route per status class.
    const routes = snap.routes.map((r) => r.route);
    expect(routes).toContain("/api/bookings/:id");

    // p95 should sit out near the slow tail, p50 near the fast cluster.
    expect(snap.latency_ms.p50).toBeLessThan(snap.latency_ms.p95);
  });
});

describe("incr + renderProm — business counters & Prom format", () => {
  it("emits counters and a well-formed histogram", () => {
    incr("bookings_created_total");
    incr("bookings_created_total");
    incr("invoices_paid_total", 1);
    recordHttp("POST", "/api/bookings", 201, 35);

    const prom = renderProm();
    expect(prom).toContain("bookings_created_total 2");
    expect(prom).toContain("invoices_paid_total 1");
    // histogram has the required Prometheus series.
    expect(prom).toContain("http_request_duration_seconds_bucket");
    expect(prom).toContain('le="+Inf"');
    expect(prom).toContain("http_request_duration_seconds_count");
    expect(prom).toContain("http_requests_total");
  });
});
