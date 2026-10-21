// lib/instanceMetadata.ts
// Fetches AWS EC2 instance metadata using IMDSv2 (token-based)
// Falls back to safe local-dev values when not running on EC2.

const IMDS_BASE = "http://169.254.169.254/latest";
const TOKEN_TTL = "21600"; // seconds

/** Obtain an IMDSv2 session token */
async function getImdsToken(): Promise<string> {
  const res = await fetch(`${IMDS_BASE}/api/token`, {
    method: "PUT",
    headers: { "X-aws-ec2-metadata-token-ttl-seconds": TOKEN_TTL },
    // Short timeout — fail fast when not on EC2
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`IMDS token request failed: ${res.status}`);
  return res.text();
}

/** Read a single IMDS path using an existing token */
async function readImds(token: string, path: string): Promise<string> {
  const res = await fetch(`${IMDS_BASE}/meta-data/${path}`, {
    headers: { "X-aws-ec2-metadata-token": token },
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) return "";
  return (await res.text()).trim();
}

export interface InstanceInfo {
  instanceId: string;
  region: string;
  availabilityZone: string;
  hostname: string;
  appVersion: string;
  uptimeSeconds: number;
  isEc2: boolean;
}

/** Fetch EC2 instance metadata; returns safe local-dev fallback on failure */
export async function getInstanceInfo(): Promise<InstanceInfo> {
  const hostname =
    (await import("os").then((m) => m.hostname())) || "localhost";
  const uptimeSeconds = process.uptime();
  const appVersion = process.env.APP_VERSION || "local";

  try {
    const token = await getImdsToken();
    const [instanceId, az] = await Promise.all([
      readImds(token, "instance-id"),
      readImds(token, "placement/availability-zone"),
    ]);

    const region = az ? az.slice(0, -1) : process.env.AWS_REGION || "local";

    return {
      instanceId: instanceId || "unknown",
      region,
      availabilityZone: az || "unknown",
      hostname,
      appVersion,
      uptimeSeconds,
      isEc2: Boolean(instanceId),
    };
  } catch {
    // Not running on EC2 — return local-dev defaults
    return {
      instanceId: "local-dev",
      region: process.env.AWS_REGION || "local",
      availabilityZone: "local",
      hostname,
      appVersion,
      uptimeSeconds,
      isEc2: false,
    };
  }
}
