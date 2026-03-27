"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ShieldAlert, TrendingUp, Eye, AlertTriangle, type LucideProps } from "lucide-react";
import {
  fetchDashboardStats,
  fetchTrend,
  type DashboardStats,
  type TrendPoint,
} from "@/lib/threats-api";

function RiskGauge({ score }: { score: number }) {
  const radius = 52;
  const circumference = Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 80) return "#ff3b5c";
    if (s >= 60) return "#f97316";
    if (s >= 40) return "#f59e0b";
    return "#22c55e";
  };

  const color = getColor(score);

  return (
    <div className="relative flex items-center justify-center w-32 h-20">
      <svg width="130" height="80" viewBox="0 0 130 80" className="overflow-visible">
        <path
          d="M 10 75 A 55 55 0 0 1 120 75"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <motion.path
          d="M 10 75 A 55 55 0 0 1 120 75"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div className="absolute bottom-0 text-center">
        <motion.span
          className="text-2xl font-bold font-[family-name:var(--font-display)]"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          {score}
        </motion.span>
        <span className="text-[9px] text-text-tertiary block -mt-1">/100</span>
      </div>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  trend,
  color,
}: {
  icon: React.ComponentType<LucideProps>;
  label: string;
  value: string;
  trend: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center justify-center w-9 h-9 rounded-lg"
        style={{ background: `${color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-lg font-bold font-[family-name:var(--font-display)]">{value}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-tertiary">{label}</span>
          <span className="text-[9px] text-red-glow">{trend}</span>
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-2.5 !rounded-lg text-[10px]">
        <p className="text-text-secondary mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: <span className="font-bold">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ThreatOverview() {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [hours, setHours] = useState(24);

  useEffect(() => {
    setMounted(true);
    fetchDashboardStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    fetchTrend(hours).then(setTrend).catch(() => {});
  }, [hours]);

  const totalThreats = stats?.total_records ?? 0;
  const criticalCount = stats?.critical_count ?? 0;
  const leakCount = stats?.by_type?.leak ?? 0;
  const recentCount = stats?.recent_count_24h ?? 0;

  // Risk score: scale based on recent + critical
  const riskScore = Math.min(100, Math.round(
    (criticalCount * 5) + (recentCount * 0.5) + (leakCount * 2)
  ));

  // Format trend data for chart
  const chartData = trend.map((t) => {
    const d = new Date(t.timestamp);
    return {
      hour: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      threats: t.count,
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-card p-5 col-span-2"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold tracking-[0.15em] text-text-secondary uppercase font-[family-name:var(--font-display)]">
          Threat Overview
        </h2>
        <div className="flex gap-1">
          {[{ label: "24h", value: 24 }, { label: "7d", value: 168 }, { label: "30d", value: 720 }].map((opt) => (
            <button
              key={opt.label}
              onClick={() => setHours(opt.value)}
              className={`px-2.5 py-1 text-[10px] rounded border transition-all ${
                hours === opt.value
                  ? "bg-cyan-glow/10 text-cyan-glow border-cyan-glow/20"
                  : "text-text-tertiary border-transparent hover:bg-white/[0.03]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-6 mb-5">
        <RiskGauge score={riskScore} />
        <div className="flex flex-wrap gap-5 flex-1">
          <StatBox
            icon={ShieldAlert}
            label="Total Threats"
            value={totalThreats.toLocaleString()}
            trend={recentCount > 0 ? `+${recentCount} 24h` : "—"}
            color="#ff3b5c"
          />
          <StatBox
            icon={AlertTriangle}
            label="Critical Alerts"
            value={String(criticalCount)}
            trend=""
            color="#f97316"
          />
          <StatBox
            icon={Eye}
            label="Vulns Tracked"
            value={String(stats?.by_type?.vuln ?? 0)}
            trend=""
            color="#00f0ff"
          />
          <StatBox
            icon={TrendingUp}
            label="Leaks Detected"
            value={String(leakCount)}
            trend=""
            color="#a855f7"
          />
        </div>
      </div>

      <div className="h-36">
        {mounted && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradThreats" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff3b5c" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ff3b5c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="hour"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#475569", fontSize: 9 }}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="threats"
                name="Threats"
                stroke="#ff3b5c"
                strokeWidth={1.5}
                fill="url(#gradThreats)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {mounted && chartData.length === 0 && (
          <div className="h-full flex items-center justify-center text-[10px] text-text-tertiary">
            No trend data — run collectors to populate
          </div>
        )}
      </div>
    </motion.div>
  );
}
