"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  Search,
  Download,
  Server,
  Globe,
  Hash,
  Mail,
  Link2,
  ShieldCheck,
  X,
  Tag,
  type LucideProps,
} from "lucide-react";
import PageShell, { StatCard, FilterButton } from "@/components/PageShell";
import { iocs, type IOC } from "@/lib/mock-data-extended";

const typeIcons: Record<IOC["type"], React.ComponentType<LucideProps>> = {
  ip: Server, domain: Globe, hash: Hash, email: Mail, url: Link2, cve: ShieldCheck,
};

const typeColors: Record<IOC["type"], string> = {
  ip: "#00f0ff", domain: "#a855f7", hash: "#64748b", email: "#f59e0b", url: "#f97316", cve: "#ff3b5c",
};

const statusColors: Record<IOC["status"], { bg: string; text: string; label: string }> = {
  active: { bg: "bg-red-glow/10", text: "text-red-glow", label: "Active" },
  investigating: { bg: "bg-amber-glow/10", text: "text-amber-glow", label: "Investigating" },
  resolved: { bg: "bg-green-glow/10", text: "text-green-glow", label: "Resolved" },
};

function ThreatScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "#ff3b5c" : score >= 60 ? "#f97316" : score >= 40 ? "#f59e0b" : "#22c55e";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
      </div>
      <span className="text-[10px] font-bold font-[family-name:var(--font-display)]" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

export default function IOCExplorerPage() {
  const [typeFilter, setTypeFilter] = useState<IOC["type"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<IOC["status"] | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIOC, setSelectedIOC] = useState<IOC | null>(null);

  const filtered = iocs
    .filter((i) => typeFilter === "all" || i.type === typeFilter)
    .filter((i) => statusFilter === "all" || i.status === statusFilter)
    .filter((i) => !searchQuery || i.value.toLowerCase().includes(searchQuery.toLowerCase()) || i.tags.some((t) => t.includes(searchQuery.toLowerCase())))
    .sort((a, b) => b.threatScore - a.threatScore);

  return (
    <PageShell
      icon={ShieldAlert}
      title="IOC EXPLORER"
      subtitle="Indicators of Compromise management and enrichment"
      actions={
        <button className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-text-secondary border border-white/10 rounded-lg hover:bg-white/[0.03]">
          <Download className="w-3 h-3" /> Export STIX
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total IOCs" value={iocs.length} color="#00f0ff" />
        <StatCard label="Active Threats" value={iocs.filter((i) => i.status === "active").length} change="+4 today" changeType="up" color="#ff3b5c" />
        <StatCard label="Avg Threat Score" value={Math.round(iocs.reduce((s, i) => s + i.threatScore, 0) / iocs.length)} color="#f97316" />
        <StatCard label="Resolved" value={iocs.filter((i) => i.status === "resolved").length} color="#22c55e" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: IOC List */}
        <div className="col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search IOC value, tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-4 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-cyan-glow/30"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "ip", "domain", "hash", "email", "url", "cve"] as const).map((t) => (
                <FilterButton
                  key={t}
                  label={t}
                  active={typeFilter === t}
                  onClick={() => setTypeFilter(t)}
                  color={t !== "all" ? typeColors[t as IOC["type"]] : undefined}
                />
              ))}
            </div>
            <div className="flex gap-1">
              {(["all", "active", "investigating", "resolved"] as const).map((s) => (
                <FilterButton key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
              ))}
            </div>
          </div>

          {/* IOC Table */}
          <div className="glass-card overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-tertiary text-[10px] uppercase tracking-wider border-b border-white/[0.06] font-[family-name:var(--font-display)]">
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Value</th>
                  <th className="px-4 py-3 text-left font-medium">Score</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Tags</th>
                  <th className="px-4 py-3 text-left font-medium">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ioc, i) => {
                  const Icon = typeIcons[ioc.type];
                  const color = typeColors[ioc.type];
                  const st = statusColors[ioc.status];
                  return (
                    <motion.tr
                      key={ioc.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setSelectedIOC(ioc)}
                      className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer group ${
                        selectedIOC?.id === ioc.id ? "bg-cyan-glow/[0.04]" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center w-7 h-7 rounded" style={{ background: `${color}15` }}>
                          <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={1.5} />
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-text-primary group-hover:text-cyan-glow/80 transition-colors">
                        {ioc.value}
                      </td>
                      <td className="px-4 py-3"><ThreatScoreBar score={ioc.threatScore} /></td>
                      <td className="px-4 py-3">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${st.bg} ${st.text}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {ioc.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 text-[9px] rounded bg-white/[0.04] text-text-tertiary">{tag}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-tertiary">{ioc.lastSeen}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div>
          <AnimatePresence mode="wait">
            {selectedIOC ? (
              <motion.div
                key={selectedIOC.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="glass-card p-5 box-glow-cyan sticky top-0"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-semibold tracking-wider text-cyan-glow uppercase font-[family-name:var(--font-display)]">IOC Details</h3>
                  <button onClick={() => setSelectedIOC(null)} className="text-text-tertiary hover:text-text-secondary"><X className="w-3.5 h-3.5" /></button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                    {(() => { const Icon = typeIcons[selectedIOC.type]; return <Icon className="w-5 h-5" style={{ color: typeColors[selectedIOC.type] }} />; })()}
                    <div>
                      <p className="text-[9px] text-text-tertiary uppercase">{selectedIOC.type}</p>
                      <p className="text-sm text-text-primary font-mono break-all">{selectedIOC.value}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] text-text-tertiary uppercase tracking-wider mb-1">Threat Score</p>
                    <ThreatScoreBar score={selectedIOC.threatScore} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded bg-white/[0.02]">
                      <p className="text-[9px] text-text-tertiary">First Seen</p>
                      <p className="text-xs text-text-primary">{selectedIOC.firstSeen}</p>
                    </div>
                    <div className="p-2.5 rounded bg-white/[0.02]">
                      <p className="text-[9px] text-text-tertiary">Last Seen</p>
                      <p className="text-xs text-text-primary">{selectedIOC.lastSeen}</p>
                    </div>
                    <div className="p-2.5 rounded bg-white/[0.02]">
                      <p className="text-[9px] text-text-tertiary">Status</p>
                      <p className={`text-xs ${statusColors[selectedIOC.status].text}`}>{statusColors[selectedIOC.status].label}</p>
                    </div>
                    <div className="p-2.5 rounded bg-white/[0.02]">
                      <p className="text-[9px] text-text-tertiary">Related</p>
                      <p className="text-xs text-text-primary">{selectedIOC.relatedCount} IOCs</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] text-text-tertiary uppercase tracking-wider mb-1.5">Sources</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedIOC.sources.map((s) => (
                        <span key={s} className="px-2 py-0.5 text-[10px] rounded bg-cyan-glow/[0.08] text-cyan-glow border border-cyan-glow/20">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] text-text-tertiary uppercase tracking-wider mb-1.5">
                      <Tag className="w-2.5 h-2.5 inline mr-1" />Tags
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedIOC.tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 text-[10px] rounded bg-white/[0.04] text-text-secondary">{t}</span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button className="flex-1 py-2 text-[10px] text-text-secondary border border-white/10 rounded-lg hover:bg-white/[0.03]">Block</button>
                    <button className="flex-1 py-2 text-[10px] text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 rounded-lg hover:bg-cyan-glow/15">Enrich</button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-8 flex flex-col items-center justify-center text-center"
              >
                <ShieldAlert className="w-8 h-8 text-text-tertiary mb-3" strokeWidth={1} />
                <p className="text-xs text-text-tertiary">Select an IOC to view details</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageShell>
  );
}
