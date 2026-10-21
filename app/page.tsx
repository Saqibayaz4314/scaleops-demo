"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface InstanceInfo {
  instanceId: string;
  region: string;
  availabilityZone: string;
  hostname: string;
  appVersion: string;
  uptimeSeconds: number;
  isEc2: boolean;
  timestamp: string;
}

interface AppMetrics {
  requestsTotal: number;
  requestsPerEndpoint: Record<string, number>;
  startedAt: string;
  uptimeSeconds: number;
  nodeVersion: string;
  memoryUsageMb: { rss: number; heapUsed: number; heapTotal: number };
  timestamp: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 backdrop-blur-xl bg-gray-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              ScaleOps
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="#status" className="hover:text-white transition-colors">Status</a>
            <a href="#info" className="hover:text-white transition-colors">Instance</a>
            <a href="#metrics" className="hover:text-white transition-colors">Metrics</a>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              HacktoberFest 3.0
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 left-1/2 w-96 h-48 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          AWS Cloud Club MUET — HacktoberFest 3.0
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold mb-6 leading-tight">
          <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-300 bg-clip-text text-transparent">
            ScaleOps
          </span>{" "}
          <span className="text-gray-200">Demo</span>
          <br />
          <span className="text-3xl sm:text-4xl font-semibold text-gray-400 mt-2 block">
            Intelligent Auto Scaling
          </span>
        </h1>

        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          A real Next.js application deployed on{" "}
          <span className="text-orange-400 font-semibold">AWS EC2</span> behind an{" "}
          <span className="text-blue-400 font-semibold">Application Load Balancer</span> with
          horizontal auto-scaling based on CPU utilisation.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href="/api/health"
            target="_blank"
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5"
          >
            Health Check ↗
          </a>
          <a
            href="/api/info"
            target="_blank"
            className="px-6 py-3 rounded-xl border border-white/10 hover:border-white/30 text-gray-300 hover:text-white font-semibold transition-all hover:-translate-y-0.5"
          >
            Instance Info ↗
          </a>
        </div>

        {/* Architecture diagram */}
        <div className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto text-center text-sm">
          {[
            { icon: "🌐", label: "Internet", sub: "HTTP :80" },
            { icon: "⚖️", label: "ALB", sub: "Load Balancer" },
            { icon: "🖥️", label: "EC2 × 1–3", sub: "Auto Scaling" },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
                {item.icon}
              </div>
              <div className="font-semibold text-gray-200">{item.label}</div>
              <div className="text-gray-500 text-xs">{item.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatusCard({ info }: { info: InstanceInfo | null }) {
  return (
    <div
      id="status"
      className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Application Status</h2>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-sm font-medium">Healthy</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Environment" value={info?.isEc2 ? "AWS EC2" : "Local Dev"} />
        <Stat label="Version" value={info?.appVersion || "local"} />
        <Stat label="Uptime" value={info ? formatUptime(info.uptimeSeconds) : "—"} />
        <Stat label="Runtime" value="Node.js 20" />
      </div>
    </div>
  );
}

function ServerInfoCard({ info }: { info: InstanceInfo | null }) {
  return (
    <div
      id="info"
      className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm"
    >
      <h2 className="text-lg font-semibold text-gray-200 mb-4">Server Information</h2>
      {info ? (
        <div className="space-y-3 text-sm">
          <Stat label="Instance ID" value={info.instanceId} mono />
          <Stat label="Region" value={info.region} />
          <Stat label="Availability Zone" value={info.availabilityZone} />
          <Stat label="Hostname" value={info.hostname} mono />
          <Stat label="Last Updated" value={new Date(info.timestamp).toLocaleTimeString()} />
        </div>
      ) : (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 rounded bg-white/5 animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricsCard({ metrics }: { metrics: AppMetrics | null }) {
  return (
    <div
      id="metrics"
      className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm"
    >
      <h2 className="text-lg font-semibold text-gray-200 mb-4">Instance Metrics</h2>
      {metrics ? (
        <div className="space-y-3 text-sm">
          <Stat label="Total Requests" value={metrics.requestsTotal.toString()} />
          <Stat
            label="Heap Used"
            value={`${metrics.memoryUsageMb.heapUsed} / ${metrics.memoryUsageMb.heapTotal} MB`}
          />
          <Stat label="RSS" value={`${metrics.memoryUsageMb.rss} MB`} />
          <div>
            <div className="text-gray-500 mb-2">Requests by endpoint:</div>
            {Object.entries(metrics.requestsPerEndpoint).map(([ep, count]) => (
              <div key={ep} className="flex justify-between text-xs text-gray-400 py-0.5">
                <span className="font-mono">{ep}</span>
                <span className="text-gray-300">{count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-4 rounded bg-white/5 animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}

function FeatureCards() {
  const features = [
    {
      icon: "⚖️",
      title: "Application Load Balancer",
      desc: "Internet-facing ALB distributes HTTP traffic across healthy EC2 instances, with health checks at /api/health.",
      color: "blue",
    },
    {
      icon: "📈",
      title: "CPU-based Auto Scaling",
      desc: "Target-tracking scaling policy maintains 50% average CPU. New instances launch automatically under load.",
      color: "cyan",
    },
    {
      icon: "🚀",
      title: "Zero-downtime Deploy",
      desc: "ASG instance refresh with rolling strategy replaces instances one-by-one, maintaining 50% min-healthy.",
      color: "purple",
    },
    {
      icon: "🔒",
      title: "Security Hardened",
      desc: "IMDSv2 enforced, EBS encrypted, EC2 port 3000 accessible only from ALB SG. No public SSH access.",
      color: "emerald",
    },
    {
      icon: "📦",
      title: "S3 Artifact Delivery",
      desc: "Versioned tarballs uploaded to a private S3 bucket. EC2 user data downloads the exact SHA pinned in the Launch Template.",
      color: "orange",
    },
    {
      icon: "🔄",
      title: "GitHub Actions CI/CD",
      desc: "OIDC-authenticated workflows for lint, test, Terraform plan/apply, artifact upload, and instance refresh.",
      color: "pink",
    },
  ];

  const colorMap: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20",
    cyan: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/20",
    purple: "from-purple-500/20 to-purple-600/5 border-purple-500/20",
    emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20",
    orange: "from-orange-500/20 to-orange-600/5 border-orange-500/20",
    pink: "from-pink-500/20 to-pink-600/5 border-pink-500/20",
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      <h2 className="text-2xl font-bold text-center text-gray-200 mb-10">
        Infrastructure Features
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f) => (
          <div
            key={f.title}
            className={`rounded-2xl bg-gradient-to-br ${colorMap[f.color]} border p-5 hover:scale-[1.02] transition-transform duration-200`}
          >
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-gray-200 mb-2">{f.title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer({ appVersion }: { appVersion: string }) {
  return (
    <footer className="border-t border-white/10 py-8 text-center text-sm text-gray-500">
      <div className="max-w-7xl mx-auto px-4">
        <p className="mb-1">
          <span className="font-semibold text-gray-400">ScaleOps Demo</span> — AWS Cloud Club MUET HacktoberFest 3.0
        </p>
        <p>
          Version{" "}
          <code className="font-mono text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
            {appVersion}
          </code>{" "}
          · Next.js Standalone · EC2 + ALB + ASG · Terraform
        </p>
      </div>
    </footer>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span
        className={`text-gray-300 truncate text-right ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [info, setInfo] = useState<InstanceInfo | null>(null);
  const [metrics, setMetrics] = useState<AppMetrics | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [infoRes, metricsRes] = await Promise.all([
        fetch("/api/info"),
        fetch("/api/metrics"),
      ]);
      if (infoRes.ok) setInfo(await infoRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
    } catch {
      // Network error — silently retry
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => { void fetchData(); }, 0);
    const interval = setInterval(() => { void fetchData(); }, 10_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [fetchData]);

  const appVersion = info?.appVersion || process.env.NEXT_PUBLIC_APP_VERSION || "local";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />

        {/* Info cards row */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid md:grid-cols-3 gap-5">
            <StatusCard info={info} />
            <ServerInfoCard info={info} />
            <MetricsCard metrics={metrics} />
          </div>
        </section>

        <FeatureCards />
      </main>
      <Footer appVersion={appVersion} />
    </div>
  );
}
