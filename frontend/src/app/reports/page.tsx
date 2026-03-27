"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileBarChart,
  Download,
  Plus,
  Calendar,
  FileText,
  AlertTriangle,
  Shield,
  BarChart3,
  Clock,
  Eye,
  Loader,
  type LucideProps,
} from "lucide-react";
import PageShell, { StatCard, FilterButton } from "@/components/PageShell";
import { fetchDashboardStats, type DashboardStats, type Severity } from "@/lib/threats-api";

type ReportType = "weekly" | "incident" | "threat-brief" | "executive";
type ReportStatus = "generated" | "draft" | "scheduled";

interface Report {
  id: string;
  title: string;
  type: ReportType;
  status: ReportStatus;
  date: string;
  pages: number;
  findings: number;
  severity: Severity;
}

const typeIcons: Record<ReportType, React.ComponentType<LucideProps>> = {
  weekly: Calendar, incident: AlertTriangle, "threat-brief": Shield, executive: BarChart3,
};

const typeLabels: Record<ReportType, string> = {
  weekly: "Weekly Summary", incident: "Incident Report", "threat-brief": "Threat Brief", executive: "Executive Summary",
};

const typeColors: Record<ReportType, string> = {
  weekly: "#00f0ff", incident: "#ff3b5c", "threat-brief": "#f97316", executive: "#a855f7",
};

const statusStyles: Record<ReportStatus, { bg: string; text: string }> = {
  generated: { bg: "bg-green-glow/10", text: "text-green-glow" },
  draft: { bg: "bg-amber-glow/10", text: "text-amber-glow" },
  scheduled: { bg: "bg-purple-glow/10", text: "text-purple-glow" },
};

const severityColors: Record<Severity, string> = {
  critical: "#ff3b5c", high: "#f97316", medium: "#f59e0b", low: "#22c55e",
};

function generateReports(stats: DashboardStats): Report[] {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const reports: Report[] = [];
  let id = 1;

  // Weekly threat intel summary
  reports.push({
    id: `rpt-${id++}`,
    title: "Weekly Threat Intelligence Summary",
    type: "weekly",
    status: "generated",
    date: fmt(now),
    pages: Math.max(4, Math.round(stats.total_records / 50)),
    findings: stats.total_records,
    severity: stats.critical_count > 0 ? "high" : "medium",
  });

  // Incident reports for critical threats
  if (stats.critical_count > 0) {
    reports.push({
      id: `rpt-${id++}`,
      title: `Critical Alert Report: ${stats.critical_count} Active Threats`,
      type: "incident",
      status: "generated",
      date: fmt(now),
      pages: Math.max(3, stats.critical_count * 2),
      findings: stats.critical_count,
      severity: "critical",
    });
  }

  // Leak report if leaks exist
  const leakCount = stats.by_type?.leak ?? 0;
  if (leakCount > 0) {
    reports.push({
      id: `rpt-${id++}`,
      title: `Credential Leak Analysis: ${leakCount} Records`,
      type: "threat-brief",
      status: "generated",
      date: fmt(now),
      pages: Math.max(3, Math.round(leakCount / 10)),
      findings: leakCount,
      severity: "high",
    });
  }

  // Vulnerability report
  const vulnCount = stats.by_type?.vuln ?? 0;
  if (vulnCount > 0) {
    reports.push({
      id: `rpt-${id++}`,
      title: `Vulnerability Assessment: ${vulnCount} CVEs Tracked`,
      type: "threat-brief",
      status: "generated",
      date: fmt(now),
      pages: Math.max(4, Math.round(vulnCount / 5)),
      findings: vulnCount,
      severity: "medium",
    });
  }

  // Executive summary
  reports.push({
    id: `rpt-${id++}`,
    title: "Executive Summary: Threat Landscape Overview",
    type: "executive",
    status: stats.total_records > 0 ? "generated" : "draft",
    date: fmt(now),
    pages: stats.total_records > 0 ? 12 : 0,
    findings: stats.total_records,
    severity: stats.critical_count > 0 ? "high" : "medium",
  });

  // Source coverage report
  reports.push({
    id: `rpt-${id++}`,
    title: `OSINT Source Coverage: ${stats.sources_active}/${stats.sources_total} Active`,
    type: "weekly",
    status: "generated",
    date: fmt(now),
    pages: 6,
    findings: stats.sources_active,
    severity: stats.sources_active < stats.sources_total ? "medium" : "low",
  });

  // Scheduled reports
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  reports.push({
    id: `rpt-${id++}`,
    title: "Weekly Threat Intelligence Summary",
    type: "weekly",
    status: "scheduled",
    date: fmt(nextWeek),
    pages: 0,
    findings: 0,
    severity: "medium",
  });

  return reports;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<ReportType | "all">("all");

  useEffect(() => {
    fetchDashboardStats()
      .then((stats) => setReports(generateReports(stats)))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = typeFilter === "all" ? reports : reports.filter((r) => r.type === typeFilter);

  return (
    <PageShell
      icon={FileBarChart}
      title="REPORTS"
      subtitle="Intelligence reports and analysis documents"
      actions={
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-text-secondary border border-white/10 rounded-lg hover:bg-white/[0.03]">
            <Calendar className="w-3 h-3" /> Schedule
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 rounded-lg hover:bg-cyan-glow/15">
            <Plus className="w-3 h-3" /> Generate Report
          </button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Reports" value={reports.length} color="#00f0ff" />
        <StatCard label="Generated" value={reports.filter((r) => r.status === "generated").length} color="#22c55e" />
        <StatCard label="Drafts" value={reports.filter((r) => r.status === "draft").length} color="#f59e0b" />
        <StatCard label="Total Findings" value={reports.reduce((s, r) => s + r.findings, 0)} color="#a855f7" />
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-4">
        {(["all", "weekly", "incident", "threat-brief", "executive"] as const).map((t) => (
          <FilterButton
            key={t}
            label={t === "all" ? "All" : typeLabels[t as ReportType]}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
            color={t !== "all" ? typeColors[t as ReportType] : undefined}
          />
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-5 h-5 text-cyan-glow animate-spin" />
          <span className="ml-2 text-xs text-text-tertiary">Generating reports...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-xs text-text-tertiary">
          No reports available. Run collectors to generate threat intelligence reports.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((report, i) => {
            const Icon = typeIcons[report.type];
            const color = typeColors[report.type];
            const st = statusStyles[report.status];

            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-5 cursor-pointer hover:border-white/[0.12] transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-11 h-11 rounded-lg shrink-0" style={{ background: `${color}12` }}>
                    <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] px-1.5 py-0.5 rounded border" style={{ color, borderColor: `${color}30`, background: `${color}10` }}>
                        {typeLabels[report.type]}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${st.bg} ${st.text}`}>
                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </span>
                    </div>
                    <h3 className="text-sm text-text-primary font-medium mb-2 group-hover:text-cyan-glow/80 transition-colors">
                      {report.title}
                    </h3>

                    <div className="flex items-center gap-4 text-[10px] text-text-tertiary">
                      <span><Clock className="w-2.5 h-2.5 inline mr-0.5" /> {report.date}</span>
                      {report.pages > 0 && <span><FileText className="w-2.5 h-2.5 inline mr-0.5" /> {report.pages} pages</span>}
                      <span>
                        <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" style={{ color: severityColors[report.severity] }} />
                        {report.findings} findings
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="flex items-center gap-1 px-2.5 py-1 text-[9px] text-text-secondary border border-white/10 rounded hover:bg-white/[0.03]">
                    <Eye className="w-2.5 h-2.5" /> View
                  </button>
                  <button className="flex items-center gap-1 px-2.5 py-1 text-[9px] text-text-secondary border border-white/10 rounded hover:bg-white/[0.03]">
                    <Download className="w-2.5 h-2.5" /> PDF
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
