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
import { trendData24h } from "@/lib/mock-data";

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
        {/* Track */}
        <path
          d="M 10 75 A 55 55 0 0 1 120 75"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Value */}
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
          style={{
            filter: `drop-shadow(0 0 6px ${color}80)`,
          }}
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
  useEffect(() => setMounted(true), []);

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
          <button className="px-2.5 py-1 text-[10px] bg-cyan-glow/10 text-cyan-glow rounded border border-cyan-glow/20">
            24h
          </button>
          <button className="px-2.5 py-1 text-[10px] text-text-tertiary rounded hover:bg-white/[0.03] border border-transparent">
            7d
          </button>
          <button className="px-2.5 py-1 text-[10px] text-text-tertiary rounded hover:bg-white/[0.03] border border-transparent">
            30d
          </button>
        </div>
      </div>

      <div className="flex items-start gap-6 mb-5">
        <RiskGauge score={78} />
        <div className="flex flex-wrap gap-5 flex-1">
          <StatBox
            icon={ShieldAlert}
            label="Total Threats"
            value="1,847"
            trend="+12.4%"
            color="#ff3b5c"
          />
          <StatBox
            icon={AlertTriangle}
            label="Critical Alerts"
            value="23"
            trend="+3"
            color="#f97316"
          />
          <StatBox
            icon={Eye}
            label="IOCs Tracked"
            value="4,291"
            trend="+187"
            color="#00f0ff"
          />
          <StatBox
            icon={TrendingUp}
            label="Leaks Detected"
            value="156"
            trend="+8"
            color="#a855f7"
          />
        </div>
      </div>

      {/* Trend Chart */}
      <div className="h-36">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData24h}>
              <defs>
                <linearGradient id="gradThreats" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff3b5c" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ff3b5c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLeaks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradVulns" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
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
              <Area
                type="monotone"
                dataKey="leaks"
                name="Leaks"
                stroke="#a855f7"
                strokeWidth={1}
                fill="url(#gradLeaks)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="vulns"
                name="Vulns"
                stroke="#00f0ff"
                strokeWidth={1}
                fill="url(#gradVulns)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
