import { apiRequest } from "@/lib/api";

export interface ToolDefinition {
  name: string;
  target_type: string;
  tool_type: string;
  description: string;
  effectiveness: number;
  priority: number;
  status: string;
  health_score: number;
  success_rate: number;
  total_runs: number;
  consecutive_errors: number;
  last_error: string | null;
  python_package?: string | null;
  cli_command?: string | null;
  install_commands?: string[];
  requires_auth: boolean;
  auth_env_vars: string[];
  auth_description?: string;
  capabilities: string[];
  rate_limit: number | null;
}

export interface CollectorStatus {
  name: string;
  source: string;
  target_type: string;
  status: "active" | "error" | "paused" | "pending" | "running";
  enabled: boolean;
  last_run: string | null;
  last_query: string | null;
  items_collected: number;
  items_total: number;
  errors: string[];
  running: boolean;
  last_tool: string | null;
  last_fallback_used: boolean;
  last_tools_tried: string[];
  last_warnings: string[];
}

export interface ToolHealthReport {
  total_tools: number;
  available: number;
  unavailable: number;
  degraded: number;
  error: number;
  auth_required: number;
}

export interface ToolManagerStatus {
  initialized: boolean;
  health_report: ToolHealthReport;
  registered_executors: string[];
  circuit_breakers_open: string[];
}

export interface CollectorRunResult {
  source: string;
  query: string;
  collected: number;
  inserted: number;
  duplicates: number;
  errors: string[];
  elapsed: number;
  tool_name: string | null;
  tools_tried: string[];
  fallback_used: boolean;
  warnings: string[];
}

export interface CollectorRunRequest {
  query?: string;
  max_results?: number;
  preferred_tool?: string;
  use_tool_registry?: boolean;
  scan_signatures?: boolean;
}

const TARGET_BY_SOURCE: Record<string, string> = {
  github: "github_intel",
  cve: "vulnerability_intel",
  reddit: "reddit_intel",
  pastebin: "paste_leaks",
  telegram: "telegram_intel",
  whatsapp: "whatsapp_intel",
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeStatus(raw: unknown): CollectorStatus["status"] {
  const value = typeof raw === "string" ? raw : "pending";
  if (value === "active" || value === "error" || value === "paused" || value === "pending" || value === "running") {
    return value;
  }
  return "pending";
}

function normalizeCollectorStatus(raw: unknown): CollectorStatus {
  const row = (raw || {}) as Record<string, unknown>;
  const source = typeof row.source === "string" ? row.source : "unknown";

  return {
    name: typeof row.name === "string" ? row.name : source,
    source,
    target_type:
      typeof row.target_type === "string"
        ? row.target_type
        : TARGET_BY_SOURCE[source] || "osint_surface",
    status: normalizeStatus(row.status),
    enabled: typeof row.enabled === "boolean" ? row.enabled : true,
    last_run: typeof row.last_run === "string" ? row.last_run : null,
    last_query: typeof row.last_query === "string" ? row.last_query : null,
    items_collected: asNumber(row.items_collected),
    items_total: asNumber(row.items_total),
    errors: asStringArray(row.errors),
    running: typeof row.running === "boolean" ? row.running : false,
    last_tool: typeof row.last_tool === "string" ? row.last_tool : null,
    last_fallback_used: typeof row.last_fallback_used === "boolean" ? row.last_fallback_used : false,
    last_tools_tried: asStringArray(row.last_tools_tried),
    last_warnings: asStringArray(row.last_warnings),
  };
}

function normalizeCollectorRunResult(raw: unknown): CollectorRunResult {
  const row = (raw || {}) as Record<string, unknown>;

  return {
    source: typeof row.source === "string" ? row.source : "unknown",
    query: typeof row.query === "string" ? row.query : "",
    collected: asNumber(row.collected),
    inserted: asNumber(row.inserted),
    duplicates: asNumber(row.duplicates),
    errors: asStringArray(row.errors),
    elapsed: asNumber(row.elapsed),
    tool_name: typeof row.tool_name === "string" ? row.tool_name : null,
    tools_tried: asStringArray(row.tools_tried),
    fallback_used: typeof row.fallback_used === "boolean" ? row.fallback_used : false,
    warnings: asStringArray(row.warnings),
  };
}

export async function fetchCollectors(): Promise<CollectorStatus[]> {
  const payload = await apiRequest<unknown>("/api/collectors");
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map((row) => normalizeCollectorStatus(row));
}

export async function fetchToolsForSource(source: string): Promise<ToolDefinition[]> {
  return apiRequest<ToolDefinition[]>(`/api/collectors/tools?source=${encodeURIComponent(source)}`);
}

export async function fetchToolManagerStatus(): Promise<ToolManagerStatus> {
  return apiRequest<ToolManagerStatus>("/api/collectors/tools/status");
}

export async function runCollector(source: string, payload: CollectorRunRequest): Promise<CollectorRunResult> {
  const result = await apiRequest<unknown>(`/api/collectors/${encodeURIComponent(source)}/run`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeCollectorRunResult(result);
}

export async function runAllCollectors(maxResults = 50): Promise<{ success: boolean; message: string; sources: string[] }> {
  return apiRequest<{ success: boolean; message: string; sources: string[] }>(
    `/api/collectors/run-all?max_results=${maxResults}&use_tool_registry=true&scan_signatures=true`,
    { method: "POST" },
  );
}

export async function toggleCollector(source: string, enabled: boolean): Promise<CollectorStatus> {
  const result = await apiRequest<unknown>(
    `/api/collectors/${encodeURIComponent(source)}/toggle?enabled=${enabled ? "true" : "false"}`,
    { method: "PATCH" },
  );
  return normalizeCollectorStatus(result);
}


