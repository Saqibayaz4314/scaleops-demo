import { NextRequest, NextResponse } from "next/server";
import { incrementCounter } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ──────────────────────────────────────────────────────────────────────────────
// /api/workload — Bounded CPU workload for Auto Scaling demos
//
// SECURITY NOTICE
// ───────────────
// This endpoint is DISABLED by default.
// To enable it set the environment variable:
//   WORKLOAD_ENABLED=true
//
// The workload is bounded:
//   - Maximum duration: WORKLOAD_MAX_MS (default 20 000 ms)
//   - Maximum parallel requests: WORKLOAD_MAX_CONCURRENCY (default 3)
//   - No unlimited loops
//
// Never run load tests against systems you do not own/control.
// ──────────────────────────────────────────────────────────────────────────────

const MAX_DURATION_MS = Math.min(
  parseInt(process.env.WORKLOAD_MAX_MS || "20000", 10),
  30000 // hard ceiling — never allow more than 30 s
);

const MAX_CONCURRENCY = Math.min(
  parseInt(process.env.WORKLOAD_MAX_CONCURRENCY || "3", 10),
  10
);

let activeConcurrency = 0;

/** Synchronous bounded CPU work — prime sieve up to `n` */
function primeSieve(n: number): number {
  const sieve = new Uint8Array(n + 1).fill(1);
  sieve[0] = sieve[1] = 0;
  for (let i = 2; i * i <= n; i++) {
    if (sieve[i]) {
      for (let j = i * i; j <= n; j += i) sieve[j] = 0;
    }
  }
  return sieve.reduce((a, b) => a + b, 0);
}

/** Run bounded CPU work for ~durationMs milliseconds */
function runBoundedWork(durationMs: number): {
  primeCount: number;
  iterationsCompleted: number;
} {
  const deadline = Date.now() + durationMs;
  let primeCount = 0;
  let iterations = 0;

  // Each sieve(500_000) takes ~5–15 ms on a t3.micro
  while (Date.now() < deadline) {
    primeCount = primeSieve(500_000);
    iterations++;
  }

  return { primeCount, iterationsCompleted: iterations };
}

export async function GET(request: NextRequest) {
  incrementCounter("/api/workload");

  // Guard: endpoint must be explicitly enabled
  if (process.env.WORKLOAD_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: "Workload endpoint is disabled",
        hint: "Set WORKLOAD_ENABLED=true in the environment to enable for hackathon testing",
      },
      { status: 403 }
    );
  }

  // Guard: concurrency limit
  if (activeConcurrency >= MAX_CONCURRENCY) {
    return NextResponse.json(
      {
        error: "Too many concurrent workload requests",
        activeConcurrency,
        maxConcurrency: MAX_CONCURRENCY,
      },
      { status: 429 }
    );
  }

  // Parse requested duration from query param (bounded)
  const params = request.nextUrl.searchParams;
  const requestedMs = Math.min(
    parseInt(params.get("durationMs") || "10000", 10),
    MAX_DURATION_MS
  );

  activeConcurrency++;
  const startedAt = Date.now();

  try {
    const result = runBoundedWork(requestedMs);
    const elapsed = Date.now() - startedAt;

    return NextResponse.json({
      status: "completed",
      requestedDurationMs: requestedMs,
      actualDurationMs: elapsed,
      iterationsCompleted: result.iterationsCompleted,
      primesBelow500k: result.primeCount,
      activeConcurrency: activeConcurrency - 1, // after decrement
      maxConcurrency: MAX_CONCURRENCY,
      timestamp: new Date().toISOString(),
    });
  } finally {
    activeConcurrency--;
  }
}
