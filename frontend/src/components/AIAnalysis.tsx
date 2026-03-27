"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Sparkles, ChevronRight, Loader } from "lucide-react";
import { fetchDashboardStats, type DashboardStats } from "@/lib/threats-api";

const priorityColors: Record<string, string> = {
  critical: "text-red-glow bg-red-glow/10 border-red-glow/20",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  medium: "text-amber-glow bg-amber-glow/10 border-amber-glow/20",
};

interface AnalysisResult {
  summary: string;
  confidence: number;
  recommendations: { action: string; priority: string }[];
}

function generateAnalysis(stats: DashboardStats): AnalysisResult {
  const total = stats.total_records;
  const critical = stats.critical_count;
  const recent = stats.recent_count_24h;
  const leaks = stats.by_type?.leak ?? 0;
  const vulns = stats.by_type?.vuln ?? 0;
  const sources = stats.sources_active;

  if (total === 0) {
    return {
      summary: "No threat data available yet. Run collectors to begin populating the threat intelligence database. Once data flows in, AI analysis will correlate indicators and generate actionable insights.",
      confidence: 0,
      recommendations: [
        { action: "Configure API keys in .env for OSINT sources", priority: "high" },
        { action: "Run initial collection sweep across all enabled sources", priority: "high" },
        { action: "Set up scheduled collection for continuous monitoring", priority: "medium" },
      ],
    };
  }

  const parts: string[] = [];
  if (critical > 0) {
    parts.push(`${critical} critical threat${critical > 1 ? "s" : ""} detected requiring immediate attention.`);
  }
  if (recent > 0) {
    parts.push(`${recent} new indicator${recent > 1 ? "s" : ""} collected in the last 24 hours across ${sources} active source${sources > 1 ? "s" : ""}.`);
  }
  if (leaks > 0) {
    parts.push(`${leaks} credential leak${leaks > 1 ? "s" : ""} identified — compromised accounts should be prioritized for password resets.`);
  }
  if (vulns > 0) {
    parts.push(`${vulns} vulnerability record${vulns > 1 ? "s" : ""} tracked. Review critical CVEs and prioritize patching for exposed systems.`);
  }
  if (parts.length === 0) {
    parts.push(`Monitoring ${total} threat records across ${sources} active sources. Threat landscape appears stable.`);
  }

  const confidence = Math.min(95, Math.round(30 + (sources * 5) + Math.min(total, 100) * 0.3 + (recent > 0 ? 15 : 0)));

  const recommendations: { action: string; priority: string }[] = [];
  if (critical > 0) {
    recommendations.push({ action: `Investigate and triage ${critical} critical alerts immediately`, priority: "critical" });
  }
  if (leaks > 0) {
    recommendations.push({ action: `Force password reset for ${leaks} compromised credentials`, priority: "critical" });
  }
  if (vulns > 0) {
    recommendations.push({ action: `Review and patch ${vulns} tracked vulnerabilities`, priority: "high" });
  }
  if (recent > 10) {
    recommendations.push({ action: "Increase monitoring frequency — elevated activity detected", priority: "high" });
  }
  if (sources < 3) {
    recommendations.push({ action: "Enable additional OSINT sources for broader coverage", priority: "medium" });
  }
  recommendations.push({ action: "Review threat feed for emerging patterns and correlations", priority: "medium" });

  return {
    summary: parts.join(" "),
    confidence,
    recommendations: recommendations.slice(0, 6),
  };
}

export default function AIAnalysis() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [displayText, setDisplayText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats()
      .then((stats) => setAnalysis(generateAnalysis(stats)))
      .catch(() =>
        setAnalysis({
          summary: "Unable to connect to the threat intelligence backend. Ensure the API server is running and accessible.",
          confidence: 0,
          recommendations: [
            { action: "Verify backend API is running on the configured port", priority: "critical" },
            { action: "Check network connectivity and CORS settings", priority: "high" },
          ],
        })
      )
      .finally(() => setLoading(false));
  }, []);

  // Typewriter effect
  useEffect(() => {
    if (!analysis) return;
    const fullText = analysis.summary;
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
  }, [analysis]);

  const confidence = analysis?.confidence ?? 0;

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
              animate={{ width: `${confidence}%` }}
              transition={{ duration: 1.5, delay: 1 }}
            />
          </div>
          <span className="text-[10px] text-purple-glow font-bold font-[family-name:var(--font-display)]">
            {confidence}%
          </span>
        </div>
      </div>

      {/* AI Summary — Typewriter */}
      <div className="p-3 mb-4 rounded-lg bg-purple-glow/[0.04] border border-purple-glow/10">
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader className="w-3.5 h-3.5 text-purple-glow animate-spin" />
            <span className="text-[11px] text-text-tertiary">Analyzing threat landscape...</span>
          </div>
        ) : (
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {displayText}
            <span className="inline-block w-1.5 h-3.5 bg-purple-glow/70 ml-0.5 animate-pulse" />
          </p>
        )}
      </div>

      {/* Recommendations */}
      <h3 className="text-[10px] font-semibold tracking-wider text-text-tertiary uppercase mb-2 font-[family-name:var(--font-display)]">
        Recommended Actions
      </h3>
      <div className="space-y-1.5">
        {(analysis?.recommendations ?? []).map((rec, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.2 + i * 0.1 }}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.02] transition-colors group cursor-pointer"
          >
            <span
              className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border ${
                priorityColors[rec.priority] || priorityColors.medium
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
