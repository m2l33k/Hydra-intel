"use client";

import { motion } from "framer-motion";
import { KeyRound, ExternalLink } from "lucide-react";
import { leaks, type Severity } from "@/lib/mock-data";

const severityDot: Record<Severity, string> = {
  critical: "bg-red-glow shadow-[0_0_6px_rgba(255,59,92,0.5)]",
  high: "bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]",
  medium: "bg-amber-glow shadow-[0_0_6px_rgba(245,158,11,0.5)]",
  low: "bg-green-glow shadow-[0_0_6px_rgba(34,197,94,0.5)]",
};

export default function LeakDetector() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="glass-card p-5 flex flex-col"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-red-glow" strokeWidth={1.5} />
          <h2 className="text-xs font-semibold tracking-[0.15em] text-text-secondary uppercase font-[family-name:var(--font-display)]">
            Leak Detector
          </h2>
        </div>
        <span className="text-[10px] text-red-glow font-semibold">
          {leaks.length} exposed
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto custom-scroll min-h-0">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-text-tertiary text-left border-b border-white/[0.06]">
              <th className="pb-2 font-medium"></th>
              <th className="pb-2 font-medium">Email</th>
              <th className="pb-2 font-medium">Hash</th>
              <th className="pb-2 font-medium">Source</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {leaks.map((leak, i) => (
              <motion.tr
                key={leak.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.08 }}
                className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group"
              >
                <td className="py-2.5 pr-2">
                  <div className={`w-2 h-2 rounded-full ${severityDot[leak.severity]}`} />
                </td>
                <td className="py-2.5 text-text-primary font-mono">
                  {leak.email}
                </td>
                <td className="py-2.5 text-text-tertiary font-mono">
                  {leak.passwordHash}
                </td>
                <td className="py-2.5 text-text-tertiary">
                  {leak.source}
                </td>
                <td className="py-2.5">
                  <button className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-[9px] text-cyan-glow bg-cyan-glow/10 rounded border border-cyan-glow/20 hover:bg-cyan-glow/20 transition-all">
                    Investigate
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
