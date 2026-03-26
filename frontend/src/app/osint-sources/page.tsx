"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  Loader,
  Pause,
  Play,
  RefreshCcw,
  Search,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  Wrench,
  Zap,
} from "lucide-react";
import PageShell, { StatCard } from "@/components/PageShell";
import {
  type CollectorRunResult,
  type CollectorStatus,
  type ToolDefinition,
  type ToolManagerStatus,
  fetchCollectors,
  fetchToolManagerStatus,
  fetchToolsForSource,
  runAllCollectors,
  runCollector,
  toggleCollector,
} from "@/lib/collectors-api";

const statusConfig: Record<CollectorStatus["status"], { color: string; icon: ReactNode; label: string }> = {
  active: { color: "#22c55e", icon: <CheckCircle className="w-3.5 h-3.5 text-green-glow" />, label: "Active" },
  error: { color: "#ff3b5c", icon: <AlertCircle className="w-3.5 h-3.5 text-red-glow" />, label: "Error" },
  paused: { color: "#f59e0b", icon: <Pause className="w-3.5 h-3.5 text-amber-glow" />, label: "Paused" },
  pending: { color: "#64748b", icon: <Loader className="w-3.5 h-3.5 text-text-tertiary" />, label: "Pending" },
  running: { color: "#00f0ff", icon: <Loader className="w-3.5 h-3.5 text-cyan-glow animate-spin" />, label: "Running" },
};

const sourceTypeColor: Record<string, string> = {
  github_intel: "#00f0ff",
  vulnerability_intel: "#22c55e",
  reddit_intel: "#a855f7",
  paste_leaks: "#f59e0b",
};

const toolStatusColor: Record<string, string> = {
  available: "#22c55e",
  degraded: "#f59e0b",
  error: "#ff3b5c",
  unavailable: "#64748b",
  auth_required: "#a855f7",
  unknown: "#64748b",
  rate_limited: "#f97316",
};

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

function getTraceFromCollectorStatus(collector: CollectorStatus): CollectorRunResult | null {
  const tried = collector.last_tools_tried || [];
  if (!collector.last_tool && tried.length === 0) {
    return null;
  }

  return {
    source: collector.source,
    query: collector.last_query || "",
    collected: 0,
    inserted: 0,
    duplicates: 0,
    errors: collector.errors,
    elapsed: 0,
    tool_name: collector.last_tool,
    tools_tried: tried,
    fallback_used: collector.last_fallback_used,
    warnings: collector.last_warnings || [],
  };
}

export default function OsintSourcesPage() {
  const [collectors, setCollectors] = useState<CollectorStatus[]>([]);
  const [toolManagerStatus, setToolManagerStatus] = useState<ToolManagerStatus | null>(null);
  const [toolsBySource, setToolsBySource] = useState<Record<string, ToolDefinition[]>>({});
  const [selectedToolBySource, setSelectedToolBySource] = useState<Record<string, string>>({});
  const [runResultsBySource, setRunResultsBySource] = useState<Record<string, CollectorRunResult>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunAllBusy, setIsRunAllBusy] = useState(false);
  const [busySources, setBusySources] = useState<Record<string, boolean>>({});
  const [loadingToolsBySource, setLoadingToolsBySource] = useState<Record<string, boolean>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const setSourceBusy = useCallback((source: string, busy: boolean) => {
    setBusySources((prev) => ({ ...prev, [source]: busy }));
  }, []);

  const setSourceToolsLoading = useCallback((source: string, busy: boolean) => {
    setLoadingToolsBySource((prev) => ({ ...prev, [source]: busy }));
  }, []);

  const loadCollectorData = useCallback(
    async (withInitialLoader: boolean) => {
      if (withInitialLoader) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setGlobalError(null);

      try {
        const collectorRows = await fetchCollectors();

        let managerStatus: ToolManagerStatus | null = null;
        try {
          managerStatus = await fetchToolManagerStatus();
        } catch {
          setActionMessage("Tool health endpoint unavailable on current backend instance; collector list loaded.");
        }

        setCollectors(collectorRows);
        setToolManagerStatus(managerStatus);

        const toolsBySourceEntries = await Promise.all(
          collectorRows.map(async (collector) => {
            try {
              const tools = await fetchToolsForSource(collector.source);
              return [collector.source, tools] as const;
            } catch {
              return [collector.source, [] as ToolDefinition[]] as const;
            }
          }),
        );

        const nextToolsBySource = Object.fromEntries(toolsBySourceEntries) as Record<string, ToolDefinition[]>;
        setToolsBySource(nextToolsBySource);

        setSelectedToolBySource((prev) => {
          const next = { ...prev };

          for (const collector of collectorRows) {
            const options = nextToolsBySource[collector.source] || [];
            if (options.length === 0) {
              delete next[collector.source];
              continue;
            }

            if (next[collector.source] && options.some((tool) => tool.name === next[collector.source])) {
              continue;
            }

            const preferred = collector.last_tool && options.some((tool) => tool.name === collector.last_tool)
              ? collector.last_tool
              : options[0].name;
            next[collector.source] = preferred;
          }

          return next;
        });
      } catch (error) {
        setGlobalError(`Failed to load collector data: ${getErrorMessage(error)}`);
      } finally {
        if (withInitialLoader) {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadCollectorData(true);
  }, [loadCollectorData]);

  const handleRefreshAll = useCallback(async () => {
    setActionMessage(null);
    await loadCollectorData(false);
  }, [loadCollectorData]);

  const handleRefreshSourceTools = useCallback(
    async (source: string) => {
      setSourceToolsLoading(source, true);
      setActionMessage(null);

      try {
        const tools = await fetchToolsForSource(source);
        setToolsBySource((prev) => ({ ...prev, [source]: tools }));
        setSelectedToolBySource((prev) => {
          const existing = prev[source];
          const selected = existing && tools.some((tool) => tool.name === existing)
            ? existing
            : tools[0]?.name;
          return selected ? { ...prev, [source]: selected } : prev;
        });
      } catch (error) {
        setGlobalError(`Failed to refresh tools for ${source}: ${getErrorMessage(error)}`);
      } finally {
        setSourceToolsLoading(source, false);
      }
    },
    [setSourceToolsLoading],
  );

  const handleRunCollector = useCallback(
    async (source: string) => {
      setSourceBusy(source, true);
      setActionMessage(null);
      setGlobalError(null);

      try {
        const preferredTool = selectedToolBySource[source];
        const result = await runCollector(source, {
          max_results: 50,
          preferred_tool: preferredTool,
          use_tool_registry: true,
          scan_signatures: true,
        });

        setRunResultsBySource((prev) => ({ ...prev, [source]: result }));
        setActionMessage(
          `${source} collected ${result.collected} records, inserted ${result.inserted}. ` +
            `Tool: ${result.tool_name || "n/a"}${result.fallback_used ? " (fallback used)" : ""}`,
        );

        await loadCollectorData(false);
      } catch (error) {
        setGlobalError(`Failed to run ${source}: ${getErrorMessage(error)}`);
      } finally {
        setSourceBusy(source, false);
      }
    },
    [loadCollectorData, selectedToolBySource, setSourceBusy],
  );

  const handleToggleCollector = useCallback(
    async (collector: CollectorStatus) => {
      setSourceBusy(collector.source, true);
      setActionMessage(null);
      setGlobalError(null);

      try {
        const nextEnabled = !collector.enabled;
        await toggleCollector(collector.source, nextEnabled);
        setCollectors((prev) =>
          prev.map((row) =>
            row.source === collector.source
              ? {
                  ...row,
                  enabled: nextEnabled,
                  status: nextEnabled ? "active" : "paused",
                }
              : row,
          ),
        );
      } catch (error) {
        setGlobalError(`Failed to toggle ${collector.source}: ${getErrorMessage(error)}`);
      } finally {
        setSourceBusy(collector.source, false);
      }
    },
    [setSourceBusy],
  );

  const handleRunAll = useCallback(async () => {
    setIsRunAllBusy(true);
    setActionMessage(null);
    setGlobalError(null);

    try {
      const result = await runAllCollectors(50);
      setActionMessage(result.message);
      await loadCollectorData(false);
    } catch (error) {
      setGlobalError(`Failed to run all collectors: ${getErrorMessage(error)}`);
    } finally {
      setIsRunAllBusy(false);
    }
  }, [loadCollectorData]);

  const activeCount = useMemo(
    () => collectors.filter((collector) => collector.enabled && (collector.status === "active" || collector.status === "running")).length,
    [collectors],
  );

  const totalRecords = useMemo(
    () => collectors.reduce((sum, collector) => sum + collector.items_total, 0),
    [collectors],
  );

  const totalInserted = useMemo(
    () => collectors.reduce((sum, collector) => sum + collector.items_collected, 0),
    [collectors],
  );

  const sourceErrors = useMemo(
    () => collectors.filter((collector) => collector.status === "error" || collector.errors.length > 0).length,
    [collectors],
  );

  if (isLoading) {
    return (
      <PageShell icon={Search} title="OSINT SOURCES" subtitle="Loading collector and tool manager state...">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="glass-card p-5 space-y-3">
              <div className="h-4 skeleton" />
              <div className="h-3 w-2/3 skeleton" />
              <div className="h-20 skeleton" />
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      icon={Search}
      title="OSINT SOURCES"
      subtitle="Per-source tool choice, health scoring, and fallback trace control"
      actions={
        <div className="flex gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-text-secondary border border-white/10 rounded-lg hover:bg-white/[0.03] disabled:opacity-50"
          >
            <RefreshCcw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={handleRunAll}
            disabled={isRunAllBusy}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 rounded-lg hover:bg-cyan-glow/15 disabled:opacity-50"
          >
            <Zap className="w-3 h-3" /> {isRunAllBusy ? "Running..." : "Run All"}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Active Sources" value={`${activeCount}/${collectors.length}`} color="#22c55e" />
        <StatCard label="Stored Records" value={totalRecords.toLocaleString()} color="#00f0ff" />
        <StatCard label="Session Inserts" value={totalInserted.toLocaleString()} color="#a855f7" />
        <StatCard label="Sources In Error" value={sourceErrors} color="#ff3b5c" />
        <StatCard
          label="Open Circuits"
          value={toolManagerStatus?.circuit_breakers_open.length ?? 0}
          color="#f59e0b"
        />
      </div>

      {toolManagerStatus && (
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-primary">Tool Health Overview</p>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                {toolManagerStatus.health_report.available} available, {toolManagerStatus.health_report.degraded} degraded,
                {" "}{toolManagerStatus.health_report.auth_required} auth-required
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
              <ShieldAlert className="w-3.5 h-3.5" />
              {toolManagerStatus.health_report.total_tools} tools registered
            </div>
          </div>
        </div>
      )}

      {(globalError || actionMessage) && (
        <div className="space-y-2 mb-4">
          {globalError && (
            <div className="glass-card p-3 border border-red-glow/25 bg-red-glow/5 text-[11px] text-red-glow">
              {globalError}
            </div>
          )}
          {actionMessage && (
            <div className="glass-card p-3 border border-cyan-glow/20 bg-cyan-glow/5 text-[11px] text-cyan-glow">
              {actionMessage}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {collectors.map((collector, index) => {
          const status = statusConfig[collector.status];
          const typeColor = sourceTypeColor[collector.target_type] || "#475569";
          const tools = toolsBySource[collector.source] || [];
          const selectedToolName = selectedToolBySource[collector.source] || "";
          const selectedTool = tools.find((tool) => tool.name === selectedToolName);
          const trace = runResultsBySource[collector.source] || getTraceFromCollectorStatus(collector);
          const sourceBusy = Boolean(busySources[collector.source]);
          const toolsLoading = Boolean(loadingToolsBySource[collector.source]);

          return (
            <motion.div
              key={collector.source}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`glass-card p-5 transition-all ${collector.status === "error" ? "border-red-glow/20 box-glow-red" : ""}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm text-text-primary font-medium">{collector.name}</h3>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded border"
                      style={{ color: typeColor, borderColor: `${typeColor}35`, background: `${typeColor}12` }}
                    >
                      {collector.target_type.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {status.icon}
                      <span className="text-[10px]" style={{ color: status.color }}>
                        {status.label}
                      </span>
                    </div>
                    {collector.running && <span className="text-[10px] text-cyan-glow">in progress</span>}
                  </div>
                </div>

                <button
                  onClick={() => void handleToggleCollector(collector)}
                  disabled={sourceBusy}
                  className="text-text-secondary hover:text-text-primary disabled:opacity-50"
                  title={collector.enabled ? "Disable collector" : "Enable collector"}
                >
                  {collector.enabled ? <ToggleRight className="w-5 h-5 text-cyan-glow" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <p className="text-[9px] text-text-tertiary">Total Records</p>
                  <p className="text-xs text-text-primary font-medium">{collector.items_total.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-tertiary">Inserted</p>
                  <p className="text-xs text-text-primary font-medium">{collector.items_collected.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-tertiary">Errors</p>
                  <p className={`text-xs font-medium ${collector.errors.length > 0 ? "text-red-glow" : "text-green-glow"}`}>
                    {collector.errors.length}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-text-tertiary">Last Run</p>
                  <p className="text-[10px] text-text-secondary truncate">{formatTimestamp(collector.last_run)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] text-text-tertiary uppercase tracking-wide">Preferred Tool</label>
                  <button
                    onClick={() => void handleRefreshSourceTools(collector.source)}
                    disabled={toolsLoading || sourceBusy}
                    className="text-[10px] text-text-tertiary hover:text-cyan-glow disabled:opacity-50"
                  >
                    <RefreshCcw className={`w-3 h-3 inline ${toolsLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>

                <select
                  value={selectedToolName}
                  onChange={(event) =>
                    setSelectedToolBySource((prev) => ({
                      ...prev,
                      [collector.source]: event.target.value,
                    }))
                  }
                  disabled={tools.length === 0 || sourceBusy}
                  className="w-full h-8 px-2.5 text-[11px] rounded bg-white/[0.03] border border-white/[0.08] text-text-primary outline-none focus:border-cyan-glow/35 disabled:opacity-60"
                >
                  {tools.length === 0 && <option value="">No tools available</option>}
                  {tools.map((tool) => (
                    <option key={tool.name} value={tool.name}>
                      {tool.name} ({tool.status})
                    </option>
                  ))}
                </select>

                {selectedTool && (
                  <div className="mt-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-text-tertiary">Health Score</span>
                      <span className="text-text-primary">{Math.round(selectedTool.health_score * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.max(3, Math.round(selectedTool.health_score * 100))}%`,
                          background: toolStatusColor[selectedTool.status] || "#64748b",
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-text-tertiary">
                      <span>
                        status: <span style={{ color: toolStatusColor[selectedTool.status] || "#64748b" }}>{selectedTool.status}</span>
                      </span>
                      <span>success: {Math.round(selectedTool.success_rate * 100)}%</span>
                      <span>errors: {selectedTool.consecutive_errors}</span>
                    </div>
                  </div>
                )}

                {tools.length > 1 && (
                  <div className="mt-3 pt-2 border-t border-white/[0.06]">
                    <p className="text-[10px] text-text-tertiary mb-1.5">Fallback candidates</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tools.slice(0, 4).map((tool) => (
                        <span
                          key={`${collector.source}-${tool.name}`}
                          className="px-2 py-0.5 rounded text-[10px] border"
                          style={{
                            borderColor: `${toolStatusColor[tool.status] || "#64748b"}55`,
                            color: toolStatusColor[tool.status] || "#64748b",
                          }}
                        >
                          {tool.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                <div className="flex items-center gap-3 text-[9px] text-text-tertiary">
                  <span>
                    <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                    Query: {collector.last_query || "default"}
                  </span>
                  {collector.last_tool && <span>Last tool: {collector.last_tool}</span>}
                </div>

                <button
                  onClick={() => void handleRunCollector(collector.source)}
                  disabled={sourceBusy || !collector.enabled}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 rounded hover:bg-cyan-glow/15 disabled:opacity-50"
                >
                  {sourceBusy ? <Loader className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Run Now
                </button>
              </div>

              {trace && (
                <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-text-tertiary uppercase tracking-wide">Fallback Trace</p>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className={trace.fallback_used ? "text-amber-glow" : "text-text-secondary"}>
                        {trace.fallback_used ? "fallback used" : "primary hit"}
                      </span>
                      {trace.elapsed > 0 && <span className="text-text-tertiary">{trace.elapsed.toFixed(2)}s</span>}
                    </div>
                  </div>

                  {trace.tools_tried.length > 0 && (
                    <div className="flex items-center flex-wrap gap-1.5 mb-2">
                      {trace.tools_tried.map((toolName, idx) => {
                        const isWinner = trace.tool_name === toolName;
                        const toolColor = isWinner
                          ? trace.errors.length === 0
                            ? "#22c55e"
                            : "#ff3b5c"
                          : "#f59e0b";

                        return (
                          <div key={`${collector.source}-trace-${toolName}-${idx}`} className="flex items-center gap-1.5">
                            <span
                              className="px-2 py-0.5 rounded border text-[10px]"
                              style={{ borderColor: `${toolColor}66`, color: toolColor }}
                            >
                              {toolName}
                            </span>
                            {idx < trace.tools_tried.length - 1 && <ChevronRight className="w-3 h-3 text-text-tertiary" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {trace.tool_name && (
                    <p className="text-[10px] text-text-secondary mb-1">
                      Selected: <span className="text-text-primary">{trace.tool_name}</span>
                    </p>
                  )}

                  {trace.warnings.length > 0 && (
                    <div className="mb-1.5">
                      {trace.warnings.slice(0, 3).map((warning, idx) => (
                        <p key={`${collector.source}-warning-${idx}`} className="text-[10px] text-amber-glow">
                          - {warning}
                        </p>
                      ))}
                    </div>
                  )}

                  {trace.errors.length > 0 && (
                    <div>
                      {trace.errors.slice(0, 2).map((error, idx) => (
                        <p key={`${collector.source}-error-${idx}`} className="text-[10px] text-red-glow">
                          - {error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {collectors.length === 0 && (
        <div className="glass-card p-6 text-center text-text-tertiary text-sm">No collectors returned from backend.</div>
      )}

      <div className="mt-4 text-[10px] text-text-tertiary flex items-center gap-1.5">
        <Wrench className="w-3 h-3" />
        API base: {process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}
      </div>
    </PageShell>
  );
}





