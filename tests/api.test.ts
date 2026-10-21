/**
 * @jest-environment node
 *
 * Integration-style tests for the API route handlers.
 * We call the handler functions directly (no HTTP server needed).
 */

// Mock fetch for IMDSv2 — always returns local-dev fallback in tests
global.fetch = jest.fn().mockRejectedValue(new Error("IMDS not available"));

import { GET as healthGET } from "@/app/api/health/route";
import { GET as infoGET } from "@/app/api/info/route";
import { GET as metricsGET } from "@/app/api/metrics/route";

describe("GET /api/health", () => {
  it("returns HTTP 200 with healthy status", async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(typeof body.timestamp).toBe("string");
  });
});

describe("GET /api/info", () => {
  it("returns instance info with required fields", async () => {
    const res = await infoGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("instanceId");
    expect(body).toHaveProperty("region");
    expect(body).toHaveProperty("availabilityZone");
    expect(body).toHaveProperty("hostname");
    expect(body).toHaveProperty("appVersion");
    expect(typeof body.uptimeSeconds).toBe("number");
  });

  it("falls back gracefully when IMDS is unavailable", async () => {
    const res = await infoGET();
    const body = await res.json();
    // In test environment IMDS is mocked to fail — should return local-dev values
    expect(body.isEc2).toBe(false);
    expect(body.instanceId).toBe("local-dev");
  });
});

describe("GET /api/metrics", () => {
  it("returns metrics with required fields", async () => {
    const res = await metricsGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.requestsTotal).toBe("number");
    expect(body).toHaveProperty("memoryUsageMb");
    expect(typeof body.uptimeSeconds).toBe("number");
    expect(typeof body.nodeVersion).toBe("string");
  });
});
