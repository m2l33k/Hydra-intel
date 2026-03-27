"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rss,
  Search,
  Download,
  GitBranch,
  ShieldAlert,
  Globe,
  Activity,
  MessageSquare,
  FileText,
  Send,
  X,
  ExternalLink,
  Clock,
  ArrowUpDown,
  Loader,
  type LucideProps,
} from "lucide-react";
import PageShell, { StatCard, FilterButton } from "@/components/PageShell";
import { fetchThreats, type ThreatItem, type Severity } from "@/lib/threats-api";

const sourceIcons: Record<string, React.ComponentType<LucideProps>> = {
  github: GitBranch, "shield-alert": ShieldAlert, globe: Globe,
  activity: Activity, "message-square": MessageSquare, "file-text": FileText,
  send: Send, search: Search,
};

const severityConfig: Record<Severity, { class: string; label: string; color: string }> = {
  critical: { class: "severity-critical", label: "CRITICAL", color: "#ff3b5c" },
  high: { class: "severity-high", label: "HIGH", color: "#f97316" },
  medium: { class: "severity-medium", label: "MEDIUM", color: "#f59e0b" },
  low: { class: "severity-low", label: "LOW", color: "#22c55e" },
};

function ThreatDetailModal({ threat, onClose }: { threat: ThreatItem; onClose: () => void }) {
  const sev = severityConfig[threat.severity];
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 20, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="glass-card p-6 w-full max-w-2xl box-glow-cyan"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wider ${sev.class}`}>
              {sev.label}
            </span>
            <span className="text-[11px] text-text-tertiary px-2 py-0.5 rounded bg-white/[0.04]">{threat.type.toUpperCase()}</span>
            <span className="text-[10px] text-text-tertiary">{threat.source}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/[0.05] text-text-tertiary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-base font-medium text-text-primary mb-4">{threat.title}</h3>

        <div className="space-y-4">
          <div>
            <h4 className="text-[10px] font-semibold tracking-wider text-text-tertiary uppercase mb-1 font-[family-name:var(--font-display)]">Description</h4>
            <p className="text-xs text-text-secondary leading-relaxed">{threat.description || "No description available."}</p>
          </div>

          {threat.ioc && (
            <div className="p-3 rounded-lg bg-red-glow/[0.06] border border-red-glow/20">
              <h4 className="text-[10px] font-semibold tracking-wider text-red-glow uppercase mb-1 font-[family-name:var(--font-display)]">Indicator of Compromise</h4>
              <code className="text-sm text-red-glow font-mono">{threat.ioc}</code>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <p className="text-[9px] text-text-tertiary uppercase tracking-wider">Source</p>
              <p className="text-xs text-text-primary mt-0.5">{threat.source}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <p className="text-[9px] text-text-tertiary uppercase tracking-wider">Type</p>
              <p className="text-xs text-text-primary mt-0.5 capitalize">{threat.type}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <p className="text-[9px] text-text-tertiary uppercase tracking-wider">Detected</p>
              <p className="text-xs text-text-primary mt-0.5">{threat.timestamp}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-white/[0.06]">
          <button
            onClick={() => {
              const text = [threat.title, threat.ioc, threat.url].filter(Boolean).join("\n");
              navigator.clipboard.writeText(text);
            }}
            className="px-4 py-2 text-[11px] text-text-secondary border border-white/10 rounded-lg hover:bg-white/[0.03]"
          >
            Export IOCs
          </button>
          {threat.url && (
            <a
              href={threat.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-[11px] text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 rounded-lg hover:bg-cyan-glow/15"
            >
              Investigate
            </a>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ThreatFeedPage() {
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"time" | "severity">("time");
  const [selected, setSelected] = useState<ThreatItem | null>(null);

  useEffect(() => {
    fetchThreats({ per_page: 100 })
      .then((data) => setThreats(data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = threats
    .filter((t) => filter === "all" || t.severity === filter)
    .filter((t) => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "severity") {
        const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.severity] - order[b.severity];
      }
      return 0;
    });

  const counts = {
    critical: threats.filter((t) => t.severity === "critical").length,
    high: threats.filter((t) => t.severity === "high").length,
    medium: threats.filter((t) => t.severity === "medium").length,
    low: threats.filter((t) => t.severity === "low").length,
  };

  return (
    <PageShell
      icon={Rss}
      title="THREAT FEED"
      subtitle={`${threats.length} threats detected across all sources`}
      actions={
        <button className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-text-secondary border border-white/10 rounded-lg hover:bg-white/[0.03]">
          <Download className="w-3 h-3" /> Export CSV
        </button>
      }
    >
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Critical" value={counts.critical} color="#ff3b5c" />
        <StatCard label="High" value={counts.high} color="#f97316" />
        <StatCard label="Medium" value={counts.medium} color="#f59e0b" />
        <StatCard label="Low" value={counts.low} color="#22c55e" />
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search threats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-4 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-cyan-glow/30"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "critical", "high", "medium", "low"] as const).map((sev) => (
            <FilterButton
              key={sev}
              label={sev}
              active={filter === sev}
              onClick={() => setFilter(sev)}
              color={sev !== "all" ? severityConfig[sev as Severity].color : undefined}
            />
          ))}
        </div>
        <button
          onClick={() => setSortBy(sortBy === "time" ? "severity" : "time")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-text-tertiary border border-white/[0.06] rounded-lg hover:bg-white/[0.03]"
        >
          <ArrowUpDown className="w-3 h-3" />
          {sortBy === "time" ? "By Time" : "By Severity"}
        </button>
      </div>

      {/* Live Indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 bg-red-glow rounded-full pulse-critical" />
        <span className="text-[10px] text-text-tertiary tracking-wider uppercase font-[family-name:var(--font-display)]">
          Live — {filtered.length} results
        </span>
      </div>

      {/* Threat Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-5 h-5 text-cyan-glow animate-spin" />
            <span className="ml-2 text-xs text-text-tertiary">Loading threats...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-xs text-text-tertiary">
            No threats found. Run collectors to populate data.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-tertiary text-[10px] uppercase tracking-wider border-b border-white/[0.06] font-[family-name:var(--font-display)]">
                <th className="px-4 py-3 text-left font-medium">Severity</th>
                <th className="px-4 py-3 text-left font-medium">Threat</th>
                <th className="px-4 py-3 text-left font-medium">Source</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">
                  <Clock className="w-3 h-3 inline mr-1" />Time
                </th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.map((threat, i) => {
                  const sev = severityConfig[threat.severity];
                  const Icon = sourceIcons[threat.sourceIcon] || ShieldAlert;
                  return (
                    <motion.tr
                      key={threat.id}
                      layout
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => setSelected(threat)}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider ${sev.class}`}>
                          {sev.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        <p className="text-text-primary truncate group-hover:text-cyan-glow/80 transition-colors">
                          {threat.title}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3 h-3 text-text-tertiary" strokeWidth={1.5} />
                          <span className="text-text-secondary">{threat.source}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-text-tertiary capitalize px-1.5 py-0.5 rounded bg-white/[0.03]">{threat.type}</span>
                      </td>
                      <td className="px-4 py-3 text-text-tertiary">{threat.timestamp}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-cyan-glow/10 text-cyan-glow transition-all">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {selected && <ThreatDetailModal threat={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </PageShell>
  );
}
