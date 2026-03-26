"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Activity,
  Zap,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader,
} from "lucide-react";
import PageShell, { StatCard } from "@/components/PageShell";
import { osintSources, type OsintSource } from "@/lib/mock-data-extended";

const statusConfig: Record<OsintSource["status"], { color: string; icon: React.ReactNode; label: string }> = {
  active: { color: "#22c55e", icon: <CheckCircle className="w-3.5 h-3.5 text-green-glow" />, label: "Active" },
  error: { color: "#ff3b5c", icon: <AlertCircle className="w-3.5 h-3.5 text-red-glow" />, label: "Error" },
  paused: { color: "#f59e0b", icon: <Pause className="w-3.5 h-3.5 text-amber-glow" />, label: "Paused" },
  pending: { color: "#64748b", icon: <Loader className="w-3.5 h-3.5 text-text-tertiary" />, label: "Pending" },
};

const typeColors: Record<OsintSource["type"], string> = {
  crawler: "#a855f7", api: "#00f0ff", feed: "#22c55e", manual: "#f59e0b",
};

export default function OsintSourcesPage() {
  const [sources, setSources] = useState(osintSources);

  const activeCount = sources.filter((s) => s.status === "active").length;
  const totalItems = sources.reduce((s, src) => s + src.itemsCollected, 0);
  const todayItems = sources.reduce((s, src) => s + src.itemsToday, 0);

  const toggleSource = (id: string) => {
    setSources((prev) =>
      prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled, status: s.enabled ? "paused" as const : "active" as const } : s)
    );
  };

  return (
    <PageShell
      icon={Search}
      title="OSINT SOURCES"
      subtitle="Intelligence collection source management"
      actions={
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-text-secondary border border-white/10 rounded-lg hover:bg-white/[0.03]">
            <RotateCcw className="w-3 h-3" /> Refresh All
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 rounded-lg hover:bg-cyan-glow/15">
            <Zap className="w-3 h-3" /> Add Source
          </button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Sources" value={`${activeCount}/${sources.length}`} color="#22c55e" />
        <StatCard label="Total Collected" value={totalItems.toLocaleString()} color="#00f0ff" />
        <StatCard label="Collected Today" value={todayItems.toLocaleString()} change="+12% vs yesterday" changeType="up" color="#a855f7" />
        <StatCard label="Avg Error Rate" value={`${(sources.filter((s) => s.status === "active").reduce((s, src) => s + src.errorRate, 0) / activeCount).toFixed(1)}%`} color="#f59e0b" />
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-2 gap-4">
        {sources.map((source, i) => {
          const status = statusConfig[source.status];
          const typeColor = typeColors[source.type];

          return (
            <motion.div
              key={source.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`glass-card p-5 transition-all ${source.status === "error" ? "border-red-glow/20 box-glow-red" : ""}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg" style={{ background: `${typeColor}12` }}>
                    <Activity className="w-5 h-5" style={{ color: typeColor }} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-sm text-text-primary font-medium">{source.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded border" style={{ color: typeColor, borderColor: `${typeColor}30`, background: `${typeColor}10` }}>
                        {source.type.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-1">
                        {status.icon}
                        <span className="text-[10px]" style={{ color: status.color }}>{status.label}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => toggleSource(source.id)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${source.enabled ? "bg-cyan-glow/30" : "bg-white/10"}`}
                >
                  <motion.div
                    animate={{ x: source.enabled ? 20 : 2 }}
                    className={`absolute top-0.5 w-4 h-4 rounded-full ${source.enabled ? "bg-cyan-glow" : "bg-text-tertiary"}`}
                  />
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <p className="text-[9px] text-text-tertiary">Total</p>
                  <p className="text-xs text-text-primary font-medium">{source.itemsCollected.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-tertiary">Today</p>
                  <p className="text-xs text-text-primary font-medium">{source.itemsToday.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-tertiary">Errors</p>
                  <p className="text-xs font-medium" style={{ color: source.errorRate > 5 ? "#ff3b5c" : source.errorRate > 1 ? "#f59e0b" : "#22c55e" }}>
                    {source.errorRate}%
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-text-tertiary">Latency</p>
                  <p className="text-xs text-text-primary font-medium">{source.avgResponseTime}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                <div className="flex items-center gap-3 text-[9px] text-text-tertiary">
                  <span><Clock className="w-2.5 h-2.5 inline mr-0.5" /> Last: {source.lastRun}</span>
                  <span>Next: {source.nextRun}</span>
                </div>
                <div className="flex gap-1">
                  <button className="p-1.5 rounded hover:bg-white/[0.04] text-text-tertiary hover:text-text-secondary" title="Run Now">
                    <Play className="w-3 h-3" />
                  </button>
                  <button className="p-1.5 rounded hover:bg-white/[0.04] text-text-tertiary hover:text-text-secondary" title="Settings">
                    <Settings className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </PageShell>
  );
}
