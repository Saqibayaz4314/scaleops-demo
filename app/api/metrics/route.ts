import { NextResponse } from "next/server";
import { getMetrics, incrementCounter } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  incrementCounter("/api/metrics");
  const metrics = getMetrics();

  return NextResponse.json({
    ...metrics,
    timestamp: new Date().toISOString(),
  });
}
