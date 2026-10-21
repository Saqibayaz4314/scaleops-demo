// k6 load test script — Baseline test
// Usage:
//   k6 run tests/k6-baseline.js -e ALB_URL=http://YOUR-ALB-DNS-NAME
//
// This script performs a gentle baseline load — 5 VUs for 2 minutes.
// Sufficient to establish baseline CPU/request metrics.
// ONLY RUN AGAINST YOUR OWN AWS APPLICATION.

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");
const ALB_URL = __ENV.ALB_URL || "http://localhost:3000";

export const options = {
  vus: 5,
  duration: "2m",
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    errors: ["rate<0.05"],
    checks: ["rate>0.95"],
  },
};

export default function baseline() {
  // Hit the health endpoint
  const health = http.get(`${ALB_URL}/api/health`);
  check(health, {
    "health 200": (r) => r.status === 200,
    "health has status field": (r) => JSON.parse(r.body).status === "healthy",
  });
  errorRate.add(health.status !== 200);

  sleep(1);

  // Hit the info endpoint
  const info = http.get(`${ALB_URL}/api/info`);
  check(info, {
    "info 200": (r) => r.status === 200,
    "info has instanceId": (r) => JSON.parse(r.body).instanceId !== undefined,
  });
  errorRate.add(info.status !== 200);

  sleep(1);
}
