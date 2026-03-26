"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Sparkles, ChevronRight } from "lucide-react";
import { aiAnalysis } from "@/lib/mock-data";

const priorityColors: Record<string, string> = {
  critical: "text-red-glow bg-red-glow/10 border-red-glow/20",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  medium: "text-amber-glow bg-amber-glow/10 border-amber-glow/20",
};

export default function AIAnalysis() {
  const [displayText, setDisplayText] = useState("");
  const fullText = aiAnalysis.summary;

  useEffect(() => {
    let idx = 0;
    const timer = setInterval(() => {
      if (idx <= fullText.length) {
        setDisplayText(fullText.slice(0, idx));
        idx++;
      } else {
        clearInterval(timer);
      }
    }, 12);
    return () => clearInterval(timer);
  }, [fullText]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.7 }}
      className="glass-card p-5 col-span-2 box-glow-purple"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Brain className="w-4 h-4 text-purple-glow" strokeWidth={1.5} />
            <Sparkles className="w-2.5 h-2.5 text-purple-glow absolute -top-1 -right-1 pulse-critical" />
          </div>
          <h2 className="text-xs font-semibold tracking-[0.15em] text-text-secondary uppercase font-[family-name:var(--font-display)]">
            AI Threat Analysis
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-text-tertiary">Confidence:</span>
          <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-purple-glow rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${aiAnalysis.confidence}%` }}
              transition={{ duration: 1.5, delay: 1 }}
            />
          </div>
          <span className="text-[10px] text-purple-glow font-bold font-[family-name:var(--font-display)]">
            {aiAnalysis.confidence}%
          </span>
        </div>
      </div>

      {/* AI Summary — Typewriter */}
      <div className="p-3 mb-4 rounded-lg bg-purple-glow/[0.04] border border-purple-glow/10">
        <p className="text-[11px] text-text-secondary leading-relaxed">
          {displayText}
          <span className="inline-block w-1.5 h-3.5 bg-purple-glow/70 ml-0.5 animate-pulse" />
        </p>
      </div>

      {/* Recommendations */}
      <h3 className="text-[10px] font-semibold tracking-wider text-text-tertiary uppercase mb-2 font-[family-name:var(--font-display)]">
        Recommended Actions
      </h3>
      <div className="space-y-1.5">
        {aiAnalysis.recommendations.map((rec, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.2 + i * 0.1 }}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.02] transition-colors group cursor-pointer"
          >
            <span
              className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border ${
                priorityColors[rec.priority]
              }`}
            >
              {rec.priority.toUpperCase()}
            </span>
            <span className="text-[11px] text-text-secondary group-hover:text-text-primary flex-1 transition-colors">
              {rec.action}
            </span>
            <ChevronRight className="w-3 h-3 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
