import { NextRequest } from "next/server";
import { GET } from "@/app/api/workload/route";
import { GET as health } from "@/app/api/health/route";

describe("bounded workload", () => {
  const original = process.env.WORKLOAD_ENABLED;
  afterEach(() => { if (original === undefined) delete process.env.WORKLOAD_ENABLED; else process.env.WORKLOAD_ENABLED = original; });
  const request = (duration: string) => new NextRequest("http://localhost/api/workload?durationMs=" + duration);
  it("rejects disabled workload", async () => {
    delete process.env.WORKLOAD_ENABLED;
    expect((await GET(request("10"))).status).toBe(403);
  });
  it("rejects invalid durations", async () => {
    process.env.WORKLOAD_ENABLED = "true";
    for (const duration of ["invalid", "-10", "0"]) expect((await GET(request(duration))).status).toBe(400);
  });
  it("keeps health available and enforces concurrency during CPU work", async () => {
    process.env.WORKLOAD_ENABLED = "true";
    const running = [GET(request("300")), GET(request("300")), GET(request("300"))];
    const rejected = await GET(request("10"));
    const healthResponse = await health();
    const results = await Promise.all(running);
    expect(rejected.status).toBe(429);
    expect(healthResponse.status).toBe(200);
    expect(results.every(result => result.status === 200)).toBe(true);
    expect((await GET(request("10"))).status).toBe(200);
  });
});
