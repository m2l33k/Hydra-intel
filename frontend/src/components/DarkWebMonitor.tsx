"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe, AlertTriangle, ShoppingCart, MessageCircle, Database, Loader, type LucideProps } from "lucide-react";
import { fetchThreats, type ThreatItem } from "@/lib/threats-api";

type DarkWebType = "leak" | "sale" | "mention" | "forum";

const typeIcons: Record<DarkWebType, React.ComponentType<LucideProps>> = {
  leak: Database,
  sale: ShoppingCart,
  mention: Globe,
  forum: MessageCircle,
};

const typeColors: Record<DarkWebType, string> = {
  leak: "#ff3b5c",
  sale: "#f97316",
  mention: "#f59e0b",
  forum: "#a855f7",
};

function inferDarkWebType(threat: ThreatItem): DarkWebType {
  if (threat.type === "leak") return "leak";
  if (threat.type === "alert") return "mention";
  const content = (threat.title + " " + threat.description).toLowerCase();
  if (content.includes("sell") || content.includes("sale") || content.includes("buy") || content.includes("$")) return "sale";
  if (content.includes("forum") || content.includes("discussion") || content.includes("thread")) return "forum";
  if (content.includes("dump") || content.includes("credential") || content.includes("leak")) return "leak";
  return "mention";
}

function extractOnionUrl(threat: ThreatItem): string {
  if (threat.url && threat.url.includes(".onion")) return threat.url;
  const content = threat.description || "";
  const match = content.match(/https?:\/\/[a-z2-7]{16,56}\.onion[^\s]*/i);
  if (match) return match[0];
  return threat.url || "—";
}

export default function DarkWebMonitor() {
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch threats from dark web sources
    fetchThreats({ source: "tor", per_page: 10 })
      .then((data) => {
        if (data.items.length > 0) {
          setThreats(data.items);
        } else {
          // Fallback: fetch alerts from any source
          return fetchThreats({ type: "alert", per_page: 10 }).then((d) => setThreats(d.items));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="glass-card p-5 flex flex-col"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-purple-glow" strokeWidth={1.5} />
          <h2 className="text-xs font-semibold tracking-[0.15em] text-text-secondary uppercase font-[family-name:var(--font-display)]">
            Dark Web Monitor
          </h2>
        </div>
        <span className="text-[10px] px-2 py-0.5 bg-purple-glow/10 text-purple-glow rounded border border-purple-glow/20">
          {threats.length} hits
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll space-y-2 min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-4 h-4 text-purple-glow animate-spin" />
            <span className="ml-2 text-[10px] text-text-tertiary">Scanning dark web...</span>
          </div>
        )}

        {!loading && threats.length === 0 && (
          <div className="text-center py-8 text-[10px] text-text-tertiary">
            No dark web activity detected. Run dark web collectors.
          </div>
        )}

        {threats.map((threat, i) => {
          const dwType = inferDarkWebType(threat);
          const Icon = typeIcons[dwType];
          const color = typeColors[dwType];
          const isNew = threat.severity === "critical";

          return (
            <motion.div
              key={threat.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.08 }}
              className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-purple-glow/20 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-3 h-3" style={{ color }} strokeWidth={1.5} />
                <span className="text-[9px] font-mono text-text-tertiary truncate flex-1">
                  {extractOnionUrl(threat)}
                </span>
                {isNew && (
                  <span className="px-1.5 py-0.5 text-[8px] font-bold tracking-wider bg-red-glow/15 text-red-glow border border-red-glow/30 rounded pulse-critical">
                    NEW
                  </span>
                )}
              </div>

              <p className="text-[10px] text-text-primary/80 mb-1.5 line-clamp-2 group-hover:text-text-primary transition-colors">
                {threat.title}
              </p>

              <div className="flex items-center gap-3">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-text-tertiary">
                  {threat.source}
                </span>
                <span className="text-[9px] text-text-tertiary ml-auto">
                  {threat.timestamp}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
