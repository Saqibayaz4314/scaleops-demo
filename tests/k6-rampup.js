// k6 ramp-up load test — triggers AWS Auto Scaling
// Usage:
//   k6 run tests/k6-rampup.js -e ALB_URL=http://YOUR-ALB-DNS-NAME
//
// ⚠️  IMPORTANT:
//   - Only run against your own AWS application
//   - Ensure WORKLOAD_ENABLED=true is set on EC2 instances
//   - Watch CloudWatch → EC2 → CPUUtilization while this runs
//   - The ASG will scale out at ~50% avg CPU

import http from "k6/http";
import { check, sleep, fail } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const workloadDuration = new Trend("workload_duration");
const ALB_URL = __ENV.ALB_URL || "http://localhost:3000";
const WORKLOAD_MS = parseInt(__ENV.WORKLOAD_MS || "10000", 10);

export const options = {
  stages: [
    { duration: "1m",  target: 2  },  // Warm-up
    { duration: "3m",  target: 10 },  // Ramp up — should trigger scale-out
    { duration: "5m",  target: 10 },  // Sustain — observe new instances joining
    { duration: "2m",  target: 2  },  // Ramp down — observe scale-in (may take ~10 min)
    { duration: "1m",  target: 0  },  // Cool-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<30000"],  // 30s max — workload endpoint is slow by design
    errors: ["rate<0.10"],
    checks: ["rate>0.95"],
  },
};

export function setup() {
  const response = http.get(`${ALB_URL}/api/workload?durationMs=10`);
  if (response.status !== 200) fail(`Workload preflight failed: HTTP ${response.status}. Enable the endpoint before testing.`);
}

export default function rampup() {
  // Generate CPU load via the bounded workload endpoint
  const start = Date.now();
  const workload = http.get(
    `${ALB_URL}/api/workload?durationMs=${WORKLOAD_MS}`,
    { timeout: "35s" }
  );
  workloadDuration.add(Date.now() - start);

  check(workload, {
    "workload completed": (r) => r.status === 200,
  });
  errorRate.add(workload.status !== 200);

  const health = http.get(`${ALB_URL}/api/health`, { timeout: "5s" });
  check(health, { "health stays available during load": (r) => r.status === 200 });
  errorRate.add(health.status !== 200);

  sleep(0.5);
}
