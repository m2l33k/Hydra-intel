"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Search,
  AlertTriangle,
  ShoppingCart,
  MessageCircle,
  Database,
  Shield,
  Eye,
  Plus,
  X,
  type LucideProps,
} from "lucide-react";
import PageShell, { StatCard, FilterButton } from "@/components/PageShell";
import { darkWebAlerts, type DarkWebAlert } from "@/lib/mock-data-extended";

const categoryIcons: Record<DarkWebAlert["category"], React.ComponentType<LucideProps>> = {
  credentials: Database, "data-sale": ShoppingCart, exploit: AlertTriangle,
  discussion: MessageCircle, service: Shield,
};

const categoryLabels: Record<DarkWebAlert["category"], string> = {
  credentials: "Credentials", "data-sale": "Data Sale", exploit: "Exploit",
  discussion: "Discussion", service: "Service",
};

const severityColors: Record<string, string> = {
  critical: "#ff3b5c", high: "#f97316", medium: "#f59e0b", low: "#22c55e",
};

export default function DarkWebPage() {
  const [catFilter, setCatFilter] = useState<DarkWebAlert["category"] | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<DarkWebAlert | null>(null);
  const [watchedKeywords] = useState(["corp-systems.io", "enterprise VPN", "credit cards", "zero-day", "LockBit", "SSH keys", "phishing kit"]);

  const filtered = darkWebAlerts
    .filter((a) => catFilter === "all" || a.category === catFilter)
    .filter((a) => !searchQuery || a.keyword.toLowerCase().includes(searchQuery.toLowerCase()) || a.snippet.toLowerCase().includes(searchQuery.toLowerCase()));

  const newCount = darkWebAlerts.filter((a) => a.isNew).length;
  const totalMentions = darkWebAlerts.reduce((s, a) => s + a.mentions, 0);

  return (
    <PageShell
      icon={Globe}
      title="DARK WEB MONITOR"
      subtitle="Monitoring .onion sites, forums, and marketplaces"
      actions={
        <button className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 rounded-lg hover:bg-cyan-glow/15">
          <Plus className="w-3 h-3" /> Add Keyword
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Alerts" value={darkWebAlerts.length} change={`${newCount} new`} changeType="up" color="#a855f7" />
        <StatCard label="Monitored Keywords" value={watchedKeywords.length} color="#00f0ff" />
        <StatCard label="Total Mentions" value={totalMentions.toLocaleString()} change="+127 today" changeType="up" color="#f59e0b" />
        <StatCard label=".onion Sources" value="42" change="3 new" changeType="neutral" color="#22c55e" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Alerts Feed */}
        <div className="col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search dark web alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-4 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-purple-glow/30"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "credentials", "data-sale", "exploit", "discussion", "service"] as const).map((cat) => (
                <FilterButton
                  key={cat}
                  label={cat === "all" ? "All" : categoryLabels[cat as DarkWebAlert["category"]]}
                  active={catFilter === cat}
                  onClick={() => setCatFilter(cat)}
                  color={cat !== "all" ? "#a855f7" : undefined}
                />
              ))}
            </div>
          </div>

          {/* Alerts List */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((alert, i) => {
                const CatIcon = categoryIcons[alert.category];
                const sevColor = severityColors[alert.severity];
                return (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelectedAlert(alert)}
                    className="glass-card p-4 cursor-pointer hover:border-purple-glow/20 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{ background: `${sevColor}15` }}>
                        <CatIcon className="w-4 h-4" style={{ color: sevColor }} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-text-tertiary truncate">{alert.onionUrl}</span>
                          {alert.isNew && (
                            <span className="px-1.5 py-0.5 text-[8px] font-bold tracking-wider bg-red-glow/15 text-red-glow border border-red-glow/30 rounded pulse-critical shrink-0">
                              NEW
                            </span>
                          )}
                          <span className="text-[9px] px-1.5 py-0.5 rounded border ml-auto shrink-0"
                            style={{ color: sevColor, borderColor: `${sevColor}40`, background: `${sevColor}10` }}>
                            {alert.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-text-primary/80 mb-2 line-clamp-2 group-hover:text-text-primary">
                          {alert.snippet}
                        </p>
                        <div className="flex items-center gap-3 text-[9px] text-text-tertiary">
                          <span className="px-1.5 py-0.5 rounded bg-white/[0.04]">{alert.keyword}</span>
                          <span>{alert.source}</span>
                          <span>{alert.mentions} mentions</span>
                          <span className="ml-auto">{alert.detectedAt}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Keyword Watchlist + Detail */}
        <div className="space-y-4">
          {/* Watched Keywords */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-semibold tracking-[0.15em] text-text-secondary uppercase font-[family-name:var(--font-display)]">
                <Eye className="w-3 h-3 inline mr-1.5" />Keyword Watchlist
              </h3>
            </div>
            <div className="space-y-1.5">
              {watchedKeywords.map((kw) => {
                const alertCount = darkWebAlerts.filter((a) => a.keyword === kw).length;
                const hasNew = darkWebAlerts.some((a) => a.keyword === kw && a.isNew);
                return (
                  <div key={kw} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                      {hasNew && <div className="w-1.5 h-1.5 bg-red-glow rounded-full pulse-critical" />}
                      <span className="text-[11px] text-text-primary font-mono">{kw}</span>
                    </div>
                    <span className="text-[9px] text-text-tertiary">{alertCount} hits</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Alert Detail */}
          <AnimatePresence mode="wait">
            {selectedAlert && (
              <motion.div
                key={selectedAlert.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass-card p-4 box-glow-purple"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-semibold tracking-wider text-purple-glow uppercase font-[family-name:var(--font-display)]">
                    Alert Detail
                  </h3>
                  <button onClick={() => setSelectedAlert(null)} className="text-text-tertiary hover:text-text-secondary">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <p className="text-[9px] text-text-tertiary uppercase tracking-wider mb-0.5">Source</p>
                    <p className="text-text-primary">{selectedAlert.source}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-text-tertiary uppercase tracking-wider mb-0.5">URL</p>
                    <p className="text-text-secondary font-mono text-[10px] break-all">{selectedAlert.onionUrl}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-text-tertiary uppercase tracking-wider mb-0.5">Content</p>
                    <p className="text-text-secondary leading-relaxed">{selectedAlert.snippet}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-white/[0.02]">
                      <p className="text-[9px] text-text-tertiary">Category</p>
                      <p className="text-text-primary capitalize">{selectedAlert.category.replace("-", " ")}</p>
                    </div>
                    <div className="p-2 rounded bg-white/[0.02]">
                      <p className="text-[9px] text-text-tertiary">Mentions</p>
                      <p className="text-text-primary">{selectedAlert.mentions}</p>
                    </div>
                  </div>
                  <button className="w-full py-2 text-[10px] text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 rounded-lg hover:bg-cyan-glow/15">
                    Full Investigation
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageShell>
  );
}
