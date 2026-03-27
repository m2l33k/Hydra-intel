"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  Search,
  Download,
  Shield,
  ExternalLink,
  Loader,
  Mail,
} from "lucide-react";
import PageShell, { StatCard, FilterButton } from "@/components/PageShell";
import { fetchLeaks, type ThreatItem, type Severity } from "@/lib/threats-api";

const severityColors: Record<Severity, string> = {
  critical: "#ff3b5c", high: "#f97316", medium: "#f59e0b", low: "#22c55e",
};

function extractEmail(threat: ThreatItem): string {
  const meta = threat.metadata || {};
  if (typeof meta.email === "string") return meta.email;
  const text = threat.title + " " + threat.description;
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  return match ? match[0] : "—";
}

function extractDomain(threat: ThreatItem): string {
  const email = extractEmail(threat);
  if (email.includes("@")) return email.split("@")[1];
  return threat.source;
}

function extractHash(threat: ThreatItem): string {
  const meta = threat.metadata || {};
  if (typeof meta.password_hash === "string") return meta.password_hash;
  if (typeof meta.sha256 === "string") return meta.sha256.slice(0, 24) + "••••";
  if (threat.ioc && threat.ioc.length > 10) return threat.ioc.slice(0, 24) + "••••";
  return "—";
}

function extractHashType(threat: ThreatItem): string {
  const meta = threat.metadata || {};
  if (typeof meta.hash_type === "string") return meta.hash_type;
  const hash = extractHash(threat);
  if (hash === "—") return "—";
  if (hash.length > 60) return "SHA-256";
  if (hash.length > 36) return "SHA-1";
  return "MD5";
}

export default function LeaksPage() {
  const [leaks, setLeaks] = useState<ThreatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchLeaks({ per_page: 100 })
      .then((data) => setLeaks(data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = leaks
    .filter((l) => sevFilter === "all" || l.severity === sevFilter)
    .filter((l) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        extractEmail(l).toLowerCase().includes(q) ||
        extractDomain(l).toLowerCase().includes(q) ||
        l.title.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q)
      );
    });

  const domains = [...new Set(leaks.map((l) => extractDomain(l)).filter((d) => d !== "—"))];
  const criticalCount = leaks.filter((l) => l.severity === "critical").length;

  return (
    <PageShell
      icon={KeyRound}
      title="LEAKS & CREDENTIALS"
      subtitle={`${leaks.length} compromised credentials detected`}
      actions={
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-text-secondary border border-white/10 rounded-lg hover:bg-white/[0.03]">
            <Download className="w-3 h-3" /> Export
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-red-glow bg-red-glow/10 border border-red-glow/20 rounded-lg hover:bg-red-glow/15">
            <Shield className="w-3 h-3" /> Force Reset All
          </button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Exposed" value={leaks.length} color="#ff3b5c" />
        <StatCard label="Affected Domains" value={domains.length} color="#f97316" />
        <StatCard label="Critical" value={criticalCount} color="#f59e0b" />
        <StatCard label="Sources" value={[...new Set(leaks.map((l) => l.source))].length} color="#22c55e" />
      </div>

      {/* Domain Overview */}
      {domains.length > 0 && (
        <div className="glass-card p-4 mb-6">
          <h3 className="text-[10px] font-semibold tracking-[0.15em] text-text-secondary uppercase font-[family-name:var(--font-display)] mb-3">
            Affected Domains
          </h3>
          <div className="flex flex-wrap gap-2">
            {domains.map((domain) => {
              const count = leaks.filter((l) => extractDomain(l) === domain).length;
              const hasCritical = leaks.some((l) => extractDomain(l) === domain && l.severity === "critical");
              return (
                <button
                  key={domain}
                  onClick={() => setSearchQuery(domain)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] transition-all hover:bg-white/[0.03] ${
                    hasCritical ? "border-red-glow/30 text-red-glow" : "border-white/[0.08] text-text-secondary"
                  }`}
                >
                  <Mail className="w-3 h-3" />
                  {domain}
                  <span className="text-[9px] px-1 rounded bg-white/[0.06]">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search email, domain, source..."
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
              active={sevFilter === sev}
              onClick={() => setSevFilter(sev)}
              color={sev !== "all" ? severityColors[sev as Severity] : undefined}
            />
          ))}
        </div>
      </div>

      {/* Credentials Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-5 h-5 text-red-glow animate-spin" />
            <span className="ml-2 text-xs text-text-tertiary">Loading leaked credentials...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-xs text-text-tertiary">
            No leaked credentials found. Run leak collectors to populate data.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-tertiary text-[10px] uppercase tracking-wider border-b border-white/[0.06] font-[family-name:var(--font-display)]">
                <th className="px-4 py-3 text-left font-medium w-8"></th>
                <th className="px-4 py-3 text-left font-medium">Email / Identifier</th>
                <th className="px-4 py-3 text-left font-medium">Hash / IOC</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Source</th>
                <th className="px-4 py-3 text-left font-medium">Detected</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.map((leak, i) => (
                  <motion.tr
                    key={leak.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: severityColors[leak.severity], boxShadow: `0 0 6px ${severityColors[leak.severity]}60` }} />
                    </td>
                    <td className="px-4 py-3 font-mono text-text-primary">{extractEmail(leak)}</td>
                    <td className="px-4 py-3 font-mono text-text-tertiary text-[10px]">{extractHash(leak)}</td>
                    <td className="px-4 py-3 text-text-tertiary">{extractHashType(leak)}</td>
                    <td className="px-4 py-3 text-text-secondary">{leak.source}</td>
                    <td className="px-4 py-3 text-text-tertiary">{leak.timestamp}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-[9px] text-cyan-glow bg-cyan-glow/10 rounded border border-cyan-glow/20 hover:bg-cyan-glow/20 transition-all ml-auto">
                        Investigate <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </PageShell>
  );
}
