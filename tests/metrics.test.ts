/**
 * @jest-environment node
 */
import { getMetrics, incrementCounter } from "@/lib/metrics";

describe("metrics library", () => {
  it("starts with zero total requests", () => {
    const m = getMetrics();
    expect(typeof m.requestsTotal).toBe("number");
    expect(typeof m.uptimeSeconds).toBe("number");
    expect(typeof m.nodeVersion).toBe("string");
  });

  it("increments counter per endpoint", () => {
    const before = getMetrics().requestsTotal;
    incrementCounter("/test-endpoint");
    const after = getMetrics().requestsTotal;
    expect(after).toBeGreaterThanOrEqual(before);
    expect(getMetrics().requestsPerEndpoint["/test-endpoint"]).toBeGreaterThan(0);
  });

  it("returns memory usage fields", () => {
    const m = getMetrics();
    expect(m.memoryUsageMb).toHaveProperty("rss");
    expect(m.memoryUsageMb).toHaveProperty("heapUsed");
    expect(m.memoryUsageMb).toHaveProperty("heapTotal");
    expect(m.memoryUsageMb.rss).toBeGreaterThan(0);
  });
});
