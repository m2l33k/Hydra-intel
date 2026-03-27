"use client";

import { useEffect, useState } from "react";
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
  Loader,
  type LucideProps,
} from "lucide-react";
import PageShell, { StatCard, FilterButton } from "@/components/PageShell";
import { fetchThreats, type ThreatItem, type Severity } from "@/lib/threats-api";

type DarkWebCategory = "credentials" | "data-sale" | "exploit" | "discussion" | "service";

const categoryIcons: Record<DarkWebCategory, React.ComponentType<LucideProps>> = {
  credentials: Database, "data-sale": ShoppingCart, exploit: AlertTriangle,
  discussion: MessageCircle, service: Shield,
};

const categoryLabels: Record<DarkWebCategory, string> = {
  credentials: "Credentials", "data-sale": "Data Sale", exploit: "Exploit",
  discussion: "Discussion", service: "Service",
};

const severityColors: Record<string, string> = {
  critical: "#ff3b5c", high: "#f97316", medium: "#f59e0b", low: "#22c55e",
};

interface DarkWebItem extends ThreatItem {
  category: DarkWebCategory;
  onionUrl: string;
  isNew: boolean;
}

function toDarkWebItem(t: ThreatItem): DarkWebItem {
  const content = (t.title + " " + t.description).toLowerCase();
  let category: DarkWebCategory = "discussion";
  if (content.includes("credential") || content.includes("password") || content.includes("dump") || t.type === "leak") category = "credentials";
  else if (content.includes("sell") || content.includes("sale") || content.includes("buy") || content.includes("$")) category = "data-sale";
  else if (content.includes("exploit") || content.includes("rce") || content.includes("cve") || content.includes("zero-day")) category = "exploit";
  else if (content.includes("service") || content.includes("kit") || content.includes("subscription")) category = "service";

  let onionUrl = "—";
  if (t.url && t.url.includes(".onion")) onionUrl = t.url;
  else if (t.url) onionUrl = t.url;
  else {
    const match = t.description?.match(/https?:\/\/[a-z2-7]{16,56}\.onion[^\s]*/i);
    if (match) onionUrl = match[0];
  }

  return { ...t, category, onionUrl, isNew: t.severity === "critical" };
}

export default function DarkWebPage() {
  const [items, setItems] = useState<DarkWebItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<DarkWebCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<DarkWebItem | null>(null);

  useEffect(() => {
    // Try tor source first, then ahmia, then onionsearch, then fall back to all alerts
    fetchThreats({ source: "tor", per_page: 50 })
      .then((data) => {
        if (data.items.length > 0) return data.items;
        return fetchThreats({ source: "ahmia", per_page: 50 }).then((d) => d.items);
      })
      .then((items) => {
        if (items.length > 0) return items;
        return fetchThreats({ type: "alert", per_page: 50 }).then((d) => d.items);
      })
      .then((raw) => setItems(raw.map(toDarkWebItem)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = items
    .filter((a) => catFilter === "all" || a.category === catFilter)
    .filter((a) => !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.description.toLowerCase().includes(searchQuery.toLowerCase()) || a.source.toLowerCase().includes(searchQuery.toLowerCase()));

  const newCount = items.filter((a) => a.isNew).length;
  const sources = [...new Set(items.map((a) => a.source))];

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
        <StatCard label="Active Alerts" value={items.length} change={newCount > 0 ? `${newCount} new` : undefined} changeType="up" color="#a855f7" />
        <StatCard label="Sources" value={sources.length} color="#00f0ff" />
        <StatCard label="Critical" value={items.filter((i) => i.severity === "critical").length} color="#ff3b5c" />
        <StatCard label="Categories" value={[...new Set(items.map((i) => i.category))].length} color="#22c55e" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-5 h-5 text-purple-glow animate-spin" />
          <span className="ml-2 text-xs text-text-tertiary">Scanning dark web sources...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-xs text-text-tertiary">
          No dark web data found. Run dark web collectors (tor, ahmia, onionsearch) to populate.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Alerts Feed */}
          <div className="col-span-2 space-y-4">
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
                    label={cat === "all" ? "All" : categoryLabels[cat as DarkWebCategory]}
                    active={catFilter === cat}
                    onClick={() => setCatFilter(cat)}
                    color={cat !== "all" ? "#a855f7" : undefined}
                  />
                ))}
              </div>
            </div>

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
                            {alert.title}
                          </p>
                          <div className="flex items-center gap-3 text-[9px] text-text-tertiary">
                            <span className="px-1.5 py-0.5 rounded bg-white/[0.04]">{alert.source}</span>
                            <span>{alert.type}</span>
                            <span className="ml-auto">{alert.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: Sources + Detail */}
          <div className="space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-semibold tracking-[0.15em] text-text-secondary uppercase font-[family-name:var(--font-display)]">
                  <Eye className="w-3 h-3 inline mr-1.5" />Active Sources
                </h3>
              </div>
              <div className="space-y-1.5">
                {sources.map((src) => {
                  const count = items.filter((a) => a.source === src).length;
                  const hasCritical = items.some((a) => a.source === src && a.severity === "critical");
                  return (
                    <div key={src} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        {hasCritical && <div className="w-1.5 h-1.5 bg-red-glow rounded-full pulse-critical" />}
                        <span className="text-[11px] text-text-primary">{src}</span>
                      </div>
                      <span className="text-[9px] text-text-tertiary">{count} hits</span>
                    </div>
                  );
                })}
              </div>
            </div>

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
                      <p className="text-text-secondary leading-relaxed">{selectedAlert.description || selectedAlert.title}</p>
                    </div>
                    {selectedAlert.ioc && (
                      <div className="p-2 rounded bg-red-glow/[0.06] border border-red-glow/20">
                        <p className="text-[9px] text-red-glow uppercase tracking-wider mb-0.5">IOC</p>
                        <code className="text-[10px] text-red-glow font-mono">{selectedAlert.ioc}</code>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded bg-white/[0.02]">
                        <p className="text-[9px] text-text-tertiary">Category</p>
                        <p className="text-text-primary capitalize">{selectedAlert.category.replace("-", " ")}</p>
                      </div>
                      <div className="p-2 rounded bg-white/[0.02]">
                        <p className="text-[9px] text-text-tertiary">Severity</p>
                        <p style={{ color: severityColors[selectedAlert.severity] }}>{selectedAlert.severity.toUpperCase()}</p>
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
      )}
    </PageShell>
  );
}
