"use client";

import { useEffect, useState } from "react";
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
  Loader,
  type LucideProps,
} from "lucide-react";
import PageShell, { StatCard, FilterButton } from "@/components/PageShell";
import { fetchThreats, type ThreatItem, type Severity } from "@/lib/threats-api";

type IOCType = "ip" | "domain" | "hash" | "email" | "url" | "cve";
type IOCStatus = "active" | "investigating" | "resolved";

interface IOC {
  id: string;
  type: IOCType;
  value: string;
  threatScore: number;
  firstSeen: string;
  lastSeen: string;
  sources: string[];
  tags: string[];
  status: IOCStatus;
  relatedCount: number;
}

const typeIcons: Record<IOCType, React.ComponentType<LucideProps>> = {
  ip: Server, domain: Globe, hash: Hash, email: Mail, url: Link2, cve: ShieldCheck,
};

const typeColors: Record<IOCType, string> = {
  ip: "#00f0ff", domain: "#a855f7", hash: "#64748b", email: "#f59e0b", url: "#f97316", cve: "#ff3b5c",
};

const statusColors: Record<IOCStatus, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-red-glow/10", text: "text-red-glow", label: "Active" },
  investigating: { bg: "bg-amber-glow/10", text: "text-amber-glow", label: "Investigating" },
  resolved: { bg: "bg-green-glow/10", text: "text-green-glow", label: "Resolved" },
};

const severityScore: Record<Severity, number> = { critical: 90, high: 75, medium: 55, low: 30 };

function extractIOCs(threats: ThreatItem[]): IOC[] {
  const iocMap = new Map<string, IOC>();

  for (const t of threats) {
    const meta = t.metadata || {};

    // Extract CVE IDs
    const cveId = meta.cve_id as string | undefined;
    if (cveId && cveId.startsWith("CVE-")) {
      addIOC(iocMap, cveId, "cve", t);
    }

    // Extract IPs
    const ip = meta.ip as string | undefined;
    if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      addIOC(iocMap, ip, "ip", t);
    }

    // Extract hashes
    const sha256 = meta.sha256 as string | undefined;
    if (sha256 && sha256.length >= 32) {
      addIOC(iocMap, sha256, "hash", t);
    }

    // Extract from IOC field
    if (t.ioc) {
      if (t.ioc.startsWith("CVE-")) addIOC(iocMap, t.ioc, "cve", t);
      else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(t.ioc)) addIOC(iocMap, t.ioc, "ip", t);
      else if (/^[a-f0-9]{32,64}$/i.test(t.ioc)) addIOC(iocMap, t.ioc, "hash", t);
      else if (t.ioc.includes("@")) addIOC(iocMap, t.ioc, "email", t);
      else if (t.ioc.includes(".")) addIOC(iocMap, t.ioc, "domain", t);
    }

    // Extract URLs
    if (t.url && t.url.startsWith("http")) {
      try {
        const domain = new URL(t.url).hostname;
        if (domain && !domain.match(/^(\d+\.){3}\d+$/)) {
          addIOC(iocMap, domain, "domain", t);
        }
      } catch { /* skip invalid URLs */ }
    }

    // Look for emails in content
    const text = t.title + " " + (t.description || "");
    const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (emailMatch) {
      addIOC(iocMap, emailMatch[0], "email", t);
    }

    // Look for IPs in content
    const ipMatches = text.matchAll(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g);
    for (const m of ipMatches) {
      if (!m[1].startsWith("0.") && !m[1].startsWith("127.") && !m[1].startsWith("10.")) {
        addIOC(iocMap, m[1], "ip", t);
      }
    }
  }

  return Array.from(iocMap.values()).sort((a, b) => b.threatScore - a.threatScore);
}

function addIOC(map: Map<string, IOC>, value: string, type: IOCType, threat: ThreatItem) {
  const key = `${type}:${value}`;
  const existing = map.get(key);
  const score = Math.min(100, severityScore[threat.severity] + Math.floor(Math.random() * 10));

  if (existing) {
    if (!existing.sources.includes(threat.source)) existing.sources.push(threat.source);
    existing.relatedCount++;
    existing.threatScore = Math.max(existing.threatScore, score);
    existing.lastSeen = threat.timestamp;
    // Merge tags
    const newTags = [threat.type, threat.severity];
    for (const tag of newTags) {
      if (!existing.tags.includes(tag)) existing.tags.push(tag);
    }
  } else {
    const status: IOCStatus = threat.severity === "critical" || threat.severity === "high" ? "active" : "investigating";
    map.set(key, {
      id: key,
      type,
      value,
      threatScore: score,
      firstSeen: threat.timestamp,
      lastSeen: threat.timestamp,
      sources: [threat.source],
      tags: [threat.type, threat.severity],
      status,
      relatedCount: 1,
    });
  }
}

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
  const [iocs, setIocs] = useState<IOC[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<IOCType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<IOCStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIOC, setSelectedIOC] = useState<IOC | null>(null);

  useEffect(() => {
    fetchThreats({ per_page: 200 })
      .then((data) => setIocs(extractIOCs(data.items)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = iocs
    .filter((i) => typeFilter === "all" || i.type === typeFilter)
    .filter((i) => statusFilter === "all" || i.status === statusFilter)
    .filter((i) => !searchQuery || i.value.toLowerCase().includes(searchQuery.toLowerCase()) || i.tags.some((t) => t.includes(searchQuery.toLowerCase())));

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
        <StatCard label="Active Threats" value={iocs.filter((i) => i.status === "active").length} color="#ff3b5c" />
        <StatCard label="Avg Threat Score" value={iocs.length > 0 ? Math.round(iocs.reduce((s, i) => s + i.threatScore, 0) / iocs.length) : 0} color="#f97316" />
        <StatCard label="Sources" value={[...new Set(iocs.flatMap((i) => i.sources))].length} color="#22c55e" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-5 h-5 text-cyan-glow animate-spin" />
          <span className="ml-2 text-xs text-text-tertiary">Extracting IOCs from threat data...</span>
        </div>
      ) : iocs.length === 0 ? (
        <div className="text-center py-16 text-xs text-text-tertiary">
          No IOCs found. Run collectors to populate threat data first.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: IOC List */}
          <div className="col-span-2 space-y-4">
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
                    color={t !== "all" ? typeColors[t as IOCType] : undefined}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                {(["all", "active", "investigating", "resolved"] as const).map((s) => (
                  <FilterButton key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
                ))}
              </div>
            </div>

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
      )}
    </PageShell>
  );
}
