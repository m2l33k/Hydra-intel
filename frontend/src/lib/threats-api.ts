import { apiRequest } from "@/lib/api";

// ── Types matching backend responses ──

export type Severity = "critical" | "high" | "medium" | "low";

export interface ThreatItem {
  id: number;
  title: string;
  source: string;
  sourceIcon: string;
  severity: Severity;
  type: string;
  timestamp: string;
  description: string;
  url?: string;
  ioc?: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardStats {
  total_records: number;
  by_source: Record<string, number>;
  by_type: Record<string, number>;
  recent_count_24h: number;
  critical_count: number;
  sources_active: number;
  sources_total: number;
  collectors: unknown[];
}

export interface TrendPoint {
  timestamp: string;
  count: number;
}

export interface SourceSummary {
  source: string;
  count: number;
  last_collected: string | null;
}

export interface PaginatedThreats {
  items: RawThreatRecord[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface RawThreatRecord {
  id: number;
  source: string;
  type: string;
  title: string;
  content: string;
  url: string;
  collected_at: string;
  metadata: string | Record<string, unknown> | null;
  fingerprint: string;
  created_at: string;
}

// ── Source icon mapping ──
const sourceIconMap: Record<string, string> = {
  github: "github",
  cve: "shield-alert",
  nvd: "shield-alert",
  reddit: "message-square",
  pastebin: "file-text",
  telegram: "send",
  tor: "globe",
  ahmia: "globe",
  onionsearch: "globe",
  shodan: "search",
  censys: "search",
  virustotal: "search",
  malwarebazaar: "search",
};

// ── Severity from metadata or type ──
function inferSeverity(record: RawThreatRecord): Severity {
  const meta = parseMetadata(record.metadata);

  // Check signature scan
  const scan = meta?.signature_scan as Record<string, unknown> | undefined;
  if (scan) {
    const risk = Number(scan.risk_score) || 0;
    if (risk >= 7) return "critical";
    if (risk >= 4) return "high";
    if (risk >= 2) return "medium";
    return "low";
  }

  // Check CVSS
  const cvss = Number(meta?.cvss_score) || 0;
  if (cvss >= 9) return "critical";
  if (cvss >= 7) return "high";
  if (cvss >= 4) return "medium";

  // Fallback by type
  if (record.type === "leak" || record.type === "alert") return "high";
  if (record.type === "vuln") return "medium";
  return "low";
}

function parseMetadata(raw: string | Record<string, unknown> | null): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function extractIOC(record: RawThreatRecord): string | undefined {
  const meta = parseMetadata(record.metadata);
  return (meta?.cve_id as string) || (meta?.ip as string) || (meta?.sha256 as string) || undefined;
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d ago`;
  } catch {
    return iso;
  }
}

function toThreatItem(record: RawThreatRecord): ThreatItem {
  return {
    id: record.id,
    title: record.title,
    source: record.source,
    sourceIcon: sourceIconMap[record.source] || "shield-alert",
    severity: inferSeverity(record),
    type: record.type,
    timestamp: formatTimestamp(record.collected_at || record.created_at),
    description: record.content || "",
    url: record.url,
    ioc: extractIOC(record),
    metadata: parseMetadata(record.metadata),
  };
}

// ── API Calls ──

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>("/api/dashboard/stats");
}

export async function fetchTrend(hours = 24): Promise<TrendPoint[]> {
  const data = await apiRequest<{ period: string; trend: TrendPoint[] }>(
    `/api/dashboard/trend?hours=${hours}`
  );
  return data.trend || [];
}

export async function fetchSourcesSummary(): Promise<SourceSummary[]> {
  const data = await apiRequest<{ sources: SourceSummary[] }>("/api/dashboard/sources-summary");
  return data.sources || [];
}

export async function fetchThreats(params?: {
  source?: string;
  type?: string;
  keyword?: string;
  page?: number;
  per_page?: number;
}): Promise<{ items: ThreatItem[]; total: number; pages: number }> {
  const qs = new URLSearchParams();
  if (params?.source) qs.set("source", params.source);
  if (params?.type) qs.set("type", params.type);
  if (params?.keyword) qs.set("keyword", params.keyword);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.per_page) qs.set("per_page", String(params.per_page));

  const data = await apiRequest<PaginatedThreats>(`/api/threats?${qs.toString()}`);
  return {
    items: (data.items || []).map(toThreatItem),
    total: data.total || 0,
    pages: data.pages || 1,
  };
}

export async function fetchThreatById(id: number): Promise<ThreatItem | null> {
  try {
    const record = await apiRequest<RawThreatRecord>(`/api/threats/${id}`);
    return toThreatItem(record);
  } catch {
    return null;
  }
}

export async function fetchLeaks(params?: {
  keyword?: string;
  page?: number;
  per_page?: number;
}): Promise<{ items: ThreatItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.keyword) qs.set("keyword", params.keyword);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.per_page) qs.set("per_page", String(params.per_page));

  const data = await apiRequest<PaginatedThreats>(`/api/threats/type/leaks?${qs.toString()}`);
  return {
    items: (data.items || []).map(toThreatItem),
    total: data.total || 0,
  };
}

export async function fetchVulns(params?: {
  keyword?: string;
  page?: number;
  per_page?: number;
}): Promise<{ items: ThreatItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.keyword) qs.set("keyword", params.keyword);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.per_page) qs.set("per_page", String(params.per_page));

  const data = await apiRequest<PaginatedThreats>(`/api/threats/type/vulns?${qs.toString()}`);
  return {
    items: (data.items || []).map(toThreatItem),
    total: data.total || 0,
  };
}

export async function searchThreats(
  query: string,
  types?: string[],
  limit = 50
): Promise<ThreatItem[]> {
  const qs = new URLSearchParams({ q: query, limit: String(limit) });
  if (types && types.length) qs.set("types", types.join(","));

  const data = await apiRequest<{ results: RawThreatRecord[]; count: number }>(
    `/api/search?${qs.toString()}`
  );
  return (data.results || []).map(toThreatItem);
}

export async function fetchSettings(): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>("/api/settings");
}
