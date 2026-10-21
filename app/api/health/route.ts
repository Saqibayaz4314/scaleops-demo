import { NextResponse } from "next/server";
import { incrementCounter } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  incrementCounter("/api/health");
  return NextResponse.json(
    { status: "healthy", timestamp: new Date().toISOString() },
    { status: 200 }
  );
}
