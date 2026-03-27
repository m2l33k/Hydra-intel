"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radio, Loader } from "lucide-react";
import { fetchCollectors, type CollectorStatus } from "@/lib/collectors-api";

function formatLastRun(iso: string | null): string {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d ago`;
  } catch {
    return iso;
  }
}

function mapStatus(s: CollectorStatus["status"]): "active" | "error" | "pending" {
  if (s === "active" || s === "running") return "active";
  if (s === "error") return "error";
  return "pending";
}

export default function SourceStatus() {
  const [collectors, setCollectors] = useState<CollectorStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCollectors()
      .then(setCollectors)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeCount = collectors.filter((s) => s.status === "active" || s.status === "running").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-green-glow" strokeWidth={1.5} />
          <h2 className="text-xs font-semibold tracking-[0.15em] text-text-secondary uppercase font-[family-name:var(--font-display)]">
            OSINT Sources
          </h2>
        </div>
        <span className="text-[10px] text-green-glow">
          {activeCount}/{collectors.length} active
        </span>
      </div>

      <div className="space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader className="w-4 h-4 text-cyan-glow animate-spin" />
            <span className="ml-2 text-[10px] text-text-tertiary">Loading sources...</span>
          </div>
        )}

        {!loading && collectors.length === 0 && (
          <div className="text-center py-6 text-[10px] text-text-tertiary">
            No collectors configured. Set up OSINT sources to begin.
          </div>
        )}

        {collectors.map((source, i) => (
          <motion.div
            key={source.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + i * 0.06 }}
            className="flex items-center justify-between py-1.5"
          >
            <div className="flex items-center gap-2.5">
              <div className={`status-dot ${mapStatus(source.status)}`} />
              <span className="text-[11px] text-text-primary">{source.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-text-tertiary font-mono">
                {source.items_collected.toLocaleString()}
              </span>
              <span className="text-[9px] text-text-tertiary w-14 text-right">
                {formatLastRun(source.last_run)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
