"use client";

import { motion } from "framer-motion";
import { Globe, AlertTriangle, ShoppingCart, MessageCircle, Database, type LucideProps } from "lucide-react";
import { darkWebMentions, type DarkWebMention } from "@/lib/mock-data";

const typeIcons: Record<DarkWebMention["type"], React.ComponentType<LucideProps>> = {
  leak: Database,
  sale: ShoppingCart,
  mention: Globe,
  forum: MessageCircle,
};

const typeColors: Record<DarkWebMention["type"], string> = {
  leak: "#ff3b5c",
  sale: "#f97316",
  mention: "#f59e0b",
  forum: "#a855f7",
};

export default function DarkWebMonitor() {
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
          {darkWebMentions.length} .onion hits
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll space-y-2 min-h-0">
        {darkWebMentions.map((mention, i) => {
          const Icon = typeIcons[mention.type];
          const color = typeColors[mention.type];

          return (
            <motion.div
              key={mention.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.08 }}
              className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-purple-glow/20 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-3 h-3" style={{ color }} strokeWidth={1.5} />
                <span className="text-[9px] font-mono text-text-tertiary truncate flex-1">
                  {mention.onionUrl}
                </span>
                {mention.isNew && (
                  <span className="px-1.5 py-0.5 text-[8px] font-bold tracking-wider bg-red-glow/15 text-red-glow border border-red-glow/30 rounded pulse-critical">
                    NEW LEAK
                  </span>
                )}
              </div>

              <p className="text-[10px] text-text-primary/80 mb-1.5 line-clamp-2 group-hover:text-text-primary transition-colors">
                {mention.snippet}
              </p>

              <div className="flex items-center gap-3">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-text-tertiary">
                  {mention.keyword}
                </span>
                <span className="text-[9px] text-text-tertiary ml-auto">
                  {mention.detectedAt}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
