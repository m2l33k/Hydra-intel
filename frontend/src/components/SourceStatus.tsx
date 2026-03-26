"use client";

import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import { sourceStatuses } from "@/lib/mock-data";

export default function SourceStatus() {
  const activeCount = sourceStatuses.filter((s) => s.status === "active").length;

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
          {activeCount}/{sourceStatuses.length} active
        </span>
      </div>

      <div className="space-y-2">
        {sourceStatuses.map((source, i) => (
          <motion.div
            key={source.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + i * 0.06 }}
            className="flex items-center justify-between py-1.5"
          >
            <div className="flex items-center gap-2.5">
              <div className={`status-dot ${source.status}`} />
              <span className="text-[11px] text-text-primary">{source.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-text-tertiary font-mono">
                {source.itemsCollected.toLocaleString()}
              </span>
              <span className="text-[9px] text-text-tertiary w-14 text-right">
                {source.lastRun}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
