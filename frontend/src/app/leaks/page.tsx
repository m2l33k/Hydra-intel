"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  Search,
  Download,
  Filter,
  AlertTriangle,
  CheckCircle,
  Bell,
  Mail,
  Shield,
  ExternalLink,
} from "lucide-react";
import PageShell, { StatCard, FilterButton } from "@/components/PageShell";
import { leakRecords, type LeakRecord } from "@/lib/mock-data-extended";
import type { Severity } from "@/lib/mock-data";

const severityColors: Record<Severity, string> = {
  critical: "#ff3b5c", high: "#f97316", medium: "#f59e0b", low: "#22c55e",
};

const statusIcons: Record<LeakRecord["status"], React.ReactNode> = {
  new: <AlertTriangle className="w-3 h-3 text-red-glow" />,
  notified: <Bell className="w-3 h-3 text-amber-glow" />,
  resolved: <CheckCircle className="w-3 h-3 text-green-glow" />,
};

const statusLabels: Record<LeakRecord["status"], string> = {
  new: "New", notified: "Notified", resolved: "Resolved",
};

export default function LeaksPage() {
  const [statusFilter, setStatusFilter] = useState<LeakRecord["status"] | "all">("all");
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = leakRecords
    .filter((l) => statusFilter === "all" || l.status === statusFilter)
    .filter((l) => sevFilter === "all" || l.severity === sevFilter)
    .filter((l) => !searchQuery || l.email.toLowerCase().includes(searchQuery.toLowerCase()) || l.domain.toLowerCase().includes(searchQuery.toLowerCase()) || l.breachName.toLowerCase().includes(searchQuery.toLowerCase()));

  const domains = [...new Set(leakRecords.map((l) => l.domain))];
  const newCount = leakRecords.filter((l) => l.status === "new").length;

  return (
    <PageShell
      icon={KeyRound}
      title="LEAKS & CREDENTIALS"
      subtitle={`${leakRecords.length} compromised credentials detected`}
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
        <StatCard label="Total Exposed" value={leakRecords.length} change={`${newCount} new`} changeType="up" color="#ff3b5c" />
        <StatCard label="Affected Domains" value={domains.length} color="#f97316" />
        <StatCard label="Pending Action" value={newCount} color="#f59e0b" />
        <StatCard label="Resolved" value={leakRecords.filter((l) => l.status === "resolved").length} color="#22c55e" />
      </div>

      {/* Domain Overview */}
      <div className="glass-card p-4 mb-6">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-text-secondary uppercase font-[family-name:var(--font-display)] mb-3">
          Affected Domains
        </h3>
        <div className="flex flex-wrap gap-2">
          {domains.map((domain) => {
            const count = leakRecords.filter((l) => l.domain === domain).length;
            const hasCritical = leakRecords.some((l) => l.domain === domain && l.severity === "critical");
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

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search email, domain, breach..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-4 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-cyan-glow/30"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "new", "notified", "resolved"] as const).map((st) => (
            <FilterButton key={st} label={st} active={statusFilter === st} onClick={() => setStatusFilter(st)} />
          ))}
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
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-tertiary text-[10px] uppercase tracking-wider border-b border-white/[0.06] font-[family-name:var(--font-display)]">
              <th className="px-4 py-3 text-left font-medium w-8"></th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Password Hash</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Breach</th>
              <th className="px-4 py-3 text-left font-medium">Source</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
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
                  <td className="px-4 py-3 font-mono text-text-primary">{leak.email}</td>
                  <td className="px-4 py-3 font-mono text-text-tertiary text-[10px]">{leak.passwordHash}</td>
                  <td className="px-4 py-3 text-text-tertiary">{leak.hashType}</td>
                  <td className="px-4 py-3 text-text-secondary">{leak.breachName}</td>
                  <td className="px-4 py-3 text-text-tertiary">{leak.source}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {statusIcons[leak.status]}
                      <span className="text-[10px] text-text-secondary">{statusLabels[leak.status]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-tertiary">{leak.date}</td>
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
      </div>
    </PageShell>
  );
}
