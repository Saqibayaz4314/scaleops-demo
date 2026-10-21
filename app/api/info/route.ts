import { NextResponse } from "next/server";
import { getInstanceInfo } from "@/lib/instanceMetadata";
import { incrementCounter } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  incrementCounter("/api/info");
  const info = await getInstanceInfo();

  return NextResponse.json({
    instanceId: info.instanceId,
    region: info.region,
    availabilityZone: info.availabilityZone,
    hostname: info.hostname,
    appVersion: info.appVersion,
    uptimeSeconds: Math.floor(info.uptimeSeconds),
    isEc2: info.isEc2,
    timestamp: new Date().toISOString(),
  });
}
