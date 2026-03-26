"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  ShieldAlert,
  Globe,
  Activity,
  MessageSquare,
  FileText,
  Send,
  Search,
  X,
  type LucideProps,
} from "lucide-react";
import { threats, type ThreatItem, type Severity } from "@/lib/mock-data";

const sourceIcons: Record<string, React.ComponentType<LucideProps>> = {
  github: GitBranch,
  "shield-alert": ShieldAlert,
  globe: Globe,
  activity: Activity,
  "message-square": MessageSquare,
  "file-text": FileText,
  send: Send,
  search: Search,
};

const severityConfig: Record<Severity, { class: string; label: string }> = {
  critical: { class: "severity-critical", label: "CRIT" },
  high: { class: "severity-high", label: "HIGH" },
  medium: { class: "severity-medium", label: "MED" },
  low: { class: "severity-low", label: "LOW" },
};

function ThreatModal({ threat, onClose }: { threat: ThreatItem; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="glass-card p-6 w-full max-w-lg box-glow-cyan"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider ${severityConfig[threat.severity].class}`}>
              {severityConfig[threat.severity].label}
            </span>
            <span className="text-[10px] text-text-tertiary">{threat.source}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/[0.05] text-text-tertiary hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-sm font-medium text-text-primary mb-3">{threat.title}</h3>
        <p className="text-xs text-text-secondary leading-relaxed mb-4">{threat.description}</p>

        {threat.ioc && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-glow/[0.06] border border-red-glow/20 mb-4">
            <ShieldAlert className="w-3.5 h-3.5 text-red-glow" strokeWidth={1.5} />
            <span className="text-[10px] text-text-tertiary">IOC:</span>
            <code className="text-[11px] text-red-glow font-mono">{threat.ioc}</code>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <span className="text-[10px] text-text-tertiary">{threat.timestamp}</span>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-[10px] text-text-secondary border border-white/10 rounded-lg hover:bg-white/[0.03]">
              Copy IOCs
            </button>
            <button className="px-3 py-1.5 text-[10px] text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 rounded-lg hover:bg-cyan-glow/15">
              Investigate
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ThreatFeed() {
  const [selectedThreat, setSelectedThreat] = useState<ThreatItem | null>(null);
  const [filter, setFilter] = useState<Severity | "all">("all");

  const filtered = filter === "all" ? threats : threats.filter((t) => t.severity === filter);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="glass-card p-5 row-span-2 flex flex-col"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-red-glow rounded-full pulse-critical" />
            <h2 className="text-xs font-semibold tracking-[0.15em] text-text-secondary uppercase font-[family-name:var(--font-display)]">
              Live Threat Feed
            </h2>
          </div>
          <span className="text-[10px] text-text-tertiary">{filtered.length} items</span>
        </div>

        {/* Severity Filters */}
        <div className="flex gap-1 mb-3">
          {(["all", "critical", "high", "medium", "low"] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`px-2 py-1 text-[9px] rounded tracking-wider uppercase transition-all ${
                filter === sev
                  ? sev === "all"
                    ? "bg-white/10 text-text-primary"
                    : severityConfig[sev as Severity].class
                  : "text-text-tertiary hover:text-text-secondary hover:bg-white/[0.03]"
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        {/* Feed List */}
        <div className="flex-1 overflow-y-auto custom-scroll space-y-1.5 min-h-0">
          <AnimatePresence mode="popLayout">
            {filtered.map((threat, i) => {
              const Icon = sourceIcons[threat.sourceIcon] || ShieldAlert;
              const sev = severityConfig[threat.severity];

              return (
                <motion.button
                  key={threat.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedThreat(threat)}
                  className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06] transition-all text-left group"
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-md bg-white/[0.03] shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-text-tertiary group-hover:text-text-secondary" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider ${sev.class}`}>
                        {sev.label}
                      </span>
                      <span className="text-[9px] text-text-tertiary">{threat.source}</span>
                      <span className="text-[9px] text-text-tertiary ml-auto">{threat.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-text-primary truncate group-hover:text-cyan-glow/80 transition-colors">
                      {threat.title}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Threat Detail Modal */}
      <AnimatePresence>
        {selectedThreat && (
          <ThreatModal
            threat={selectedThreat}
            onClose={() => setSelectedThreat(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
