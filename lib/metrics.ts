// lib/metrics.ts
// Simple in-process request counter — per-instance, intentionally not shared.
// This is stateless: each EC2 instance tracks its own counters independently,
// which is exactly what we want to demonstrate ALB load distribution.

export interface AppMetrics {
  requestsTotal: number;
  requestsPerEndpoint: Record<string, number>;
  startedAt: string;
  uptimeSeconds: number;
  nodeVersion: string;
  memoryUsageMb: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
}

const startedAt = new Date().toISOString();
const counters: Record<string, number> = {};

/** Increment counter for an endpoint path */
export function incrementCounter(endpoint: string): void {
  counters[endpoint] = (counters[endpoint] || 0) + 1;
  counters["__total__"] = (counters["__total__"] || 0) + 1;
}

/** Snapshot current metrics (safe to return in API responses) */
export function getMetrics(): AppMetrics {
  const mem = process.memoryUsage();
  const { __total__, ...perEndpoint } = counters;

  return {
    requestsTotal: __total__ || 0,
    requestsPerEndpoint: perEndpoint,
    startedAt,
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    memoryUsageMb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
  };
}
