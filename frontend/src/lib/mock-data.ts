// ═══════════════════════════════════════════════════════════
// HYDRA INTEL — Mock Intelligence Data
// ═══════════════════════════════════════════════════════════

export type Severity = "critical" | "high" | "medium" | "low";

export interface ThreatItem {
  id: string;
  title: string;
  source: string;
  sourceIcon: string;
  severity: Severity;
  type: string;
  timestamp: string;
  description: string;
  url?: string;
  ioc?: string;
}

export interface LeakItem {
  id: string;
  email: string;
  passwordHash: string;
  source: string;
  date: string;
  severity: Severity;
}

export interface DarkWebMention {
  id: string;
  keyword: string;
  onionUrl: string;
  snippet: string;
  detectedAt: string;
  isNew: boolean;
  type: "leak" | "mention" | "sale" | "forum";
}

export interface SourceStatus {
  name: string;
  status: "active" | "error" | "pending";
  lastRun: string;
  itemsCollected: number;
}

// ── Threat Feed Data ──
export const threats: ThreatItem[] = [
  {
    id: "t-001",
    title: "AWS Access Keys Exposed in Public Repository",
    source: "GitHub",
    sourceIcon: "github",
    severity: "critical",
    type: "leak",
    timestamp: "2 min ago",
    description:
      "AWS IAM access keys found in .env file committed to public repo user/infra-deploy. Keys have admin permissions on production AWS account.",
    ioc: "AKIA3EXAMPLE7XYZ",
  },
  {
    id: "t-002",
    title: "CVE-2024-38094 — SharePoint RCE (CVSS 9.8)",
    source: "NVD",
    sourceIcon: "shield-alert",
    severity: "critical",
    type: "vuln",
    timestamp: "15 min ago",
    description:
      "Remote code execution vulnerability in Microsoft SharePoint Server allows unauthenticated attackers to execute arbitrary code via crafted API requests.",
  },
  {
    id: "t-003",
    title: "Employee Credentials Dumped on Dark Web Forum",
    source: "Dark Web",
    sourceIcon: "globe",
    severity: "critical",
    type: "leak",
    timestamp: "32 min ago",
    description:
      'Database dump containing 12,847 email/password combinations from corp domain detected on "BreachForums" mirror.',
  },
  {
    id: "t-004",
    title: "Suspicious C2 Communication Pattern Detected",
    source: "Network",
    sourceIcon: "activity",
    severity: "high",
    type: "alert",
    timestamp: "1h ago",
    description:
      "Outbound beaconing pattern (60s interval) to IP 185.220.101.x detected from internal host 10.0.5.23. Matches known Cobalt Strike C2 profile.",
    ioc: "185.220.101.34",
  },
  {
    id: "t-005",
    title: "Ransomware Group Claims New Victim in Healthcare",
    source: "Reddit",
    sourceIcon: "message-square",
    severity: "high",
    type: "mention",
    timestamp: "1.5h ago",
    description:
      "LockBit 3.0 affiliate posted new victim on leak site — healthcare provider with 2M patient records. Timer set for 72h.",
  },
  {
    id: "t-006",
    title: "CVE-2024-21762 — FortiOS SSL VPN Out-of-Bounds Write",
    source: "NVD",
    sourceIcon: "shield-alert",
    severity: "high",
    type: "vuln",
    timestamp: "2h ago",
    description:
      "FortiOS SSL VPN out-of-bound write vulnerability (CVSS 9.6). Actively exploited in the wild. Patch immediately.",
  },
  {
    id: "t-007",
    title: "API Key for Stripe Found in Pastebin",
    source: "Pastebin",
    sourceIcon: "file-text",
    severity: "medium",
    type: "leak",
    timestamp: "3h ago",
    description:
      'Stripe live API key (sk_live_) found in Pastebin paste titled "my configs". Key appears to be from a e-commerce platform.',
    ioc: "sk_live_51Example...",
  },
  {
    id: "t-008",
    title: "New Phishing Kit Targeting Microsoft 365",
    source: "Telegram",
    sourceIcon: "send",
    severity: "medium",
    type: "alert",
    timestamp: "4h ago",
    description:
      "Phishing-as-a-service kit 'NakedPages' updated with MFA bypass capabilities. Being sold for $200/month on Telegram channel.",
  },
  {
    id: "t-009",
    title: "DNS Tunneling Activity Detected",
    source: "Network",
    sourceIcon: "activity",
    severity: "medium",
    type: "alert",
    timestamp: "5h ago",
    description:
      "High-entropy DNS TXT queries to suspicious domain data-sync.xyz detected. Consistent with DNS tunneling exfiltration technique.",
    ioc: "data-sync.xyz",
  },
  {
    id: "t-010",
    title: "Open Elasticsearch Instance With PII Data",
    source: "Shodan",
    sourceIcon: "search",
    severity: "low",
    type: "mention",
    timestamp: "6h ago",
    description:
      "Publicly accessible Elasticsearch cluster found exposing 500K user records including names, emails, and phone numbers.",
  },
];

// ── Leak Data ──
export const leaks: LeakItem[] = [
  {
    id: "l-001",
    email: "admin@corp-systems.io",
    passwordHash: "5f4dcc3b5aa765d61d83••••••",
    source: "BreachForums",
    date: "2024-03-25",
    severity: "critical",
  },
  {
    id: "l-002",
    email: "j.smith@enterprise.com",
    passwordHash: "e99a18c428cb38d5f260••••••",
    source: "RaidForums Archive",
    date: "2024-03-24",
    severity: "high",
  },
  {
    id: "l-003",
    email: "dev-ops@startup.io",
    passwordHash: "d8578edf8458ce06fbc5••••••",
    source: "Pastebin",
    date: "2024-03-24",
    severity: "high",
  },
  {
    id: "l-004",
    email: "support@retailco.com",
    passwordHash: "482c811da5d5b4bc6d49••••••",
    source: "Dark Web Paste",
    date: "2024-03-23",
    severity: "medium",
  },
  {
    id: "l-005",
    email: "marketing@agency.co",
    passwordHash: "b1b3773a05c0ed0176787a••••",
    source: "Telegram Dump",
    date: "2024-03-22",
    severity: "low",
  },
];

// ── Dark Web Mentions ──
export const darkWebMentions: DarkWebMention[] = [
  {
    id: "dw-001",
    keyword: "corp-systems.io",
    onionUrl: "http://breach••••.onion/dump/12847",
    snippet:
      "Full database dump - 12,847 credentials with plaintext passwords. Admin access included.",
    detectedAt: "32 min ago",
    isNew: true,
    type: "leak",
  },
  {
    id: "dw-002",
    keyword: "enterprise VPN",
    onionUrl: "http://market••••.onion/listing/vpn-access",
    snippet:
      "Selling VPN access to Fortune 500 company. FortiGate credentials. $500 per access.",
    detectedAt: "1.5h ago",
    isNew: true,
    type: "sale",
  },
  {
    id: "dw-003",
    keyword: "ransomware",
    onionUrl: "http://lockbit••••.onion/blog",
    snippet:
      "New victim posted: healthcare provider, 2M records. Countdown: 71h remaining.",
    detectedAt: "2h ago",
    isNew: false,
    type: "mention",
  },
  {
    id: "dw-004",
    keyword: "credit cards",
    onionUrl: "http://cards••••.onion/fresh",
    snippet:
      "Fresh batch - 5,000 CC with CVV. US banks. 85% valid rate. Price: $15/card.",
    detectedAt: "4h ago",
    isNew: false,
    type: "sale",
  },
  {
    id: "dw-005",
    keyword: "zero-day",
    onionUrl: "http://forum••••.onion/thread/9821",
    snippet:
      "Discussion: Unpatched RCE in popular CMS. PoC being shared privately. Affects 100K+ sites.",
    detectedAt: "6h ago",
    isNew: false,
    type: "forum",
  },
];

// ── Source Status ──
export const sourceStatuses: SourceStatus[] = [
  { name: "GitHub Crawler", status: "active", lastRun: "30s ago", itemsCollected: 1247 },
  { name: "Reddit Monitor", status: "active", lastRun: "2m ago", itemsCollected: 892 },
  { name: "CVE Feed (NVD)", status: "active", lastRun: "5m ago", itemsCollected: 3421 },
  { name: "Dark Web Scanner", status: "active", lastRun: "15m ago", itemsCollected: 567 },
  { name: "Pastebin Scraper", status: "active", lastRun: "1m ago", itemsCollected: 2103 },
  { name: "Telegram Monitor", status: "pending", lastRun: "—", itemsCollected: 0 },
  { name: "Shodan Scanner", status: "error", lastRun: "1h ago", itemsCollected: 145 },
];

// ── Trend Data (last 24h) ──
export const trendData24h = [
  { hour: "00:00", threats: 12, leaks: 3, vulns: 5 },
  { hour: "02:00", threats: 8, leaks: 1, vulns: 3 },
  { hour: "04:00", threats: 5, leaks: 0, vulns: 2 },
  { hour: "06:00", threats: 15, leaks: 4, vulns: 6 },
  { hour: "08:00", threats: 28, leaks: 7, vulns: 12 },
  { hour: "10:00", threats: 42, leaks: 11, vulns: 18 },
  { hour: "12:00", threats: 38, leaks: 9, vulns: 15 },
  { hour: "14:00", threats: 55, leaks: 14, vulns: 22 },
  { hour: "16:00", threats: 67, leaks: 18, vulns: 28 },
  { hour: "18:00", threats: 51, leaks: 12, vulns: 20 },
  { hour: "20:00", threats: 43, leaks: 8, vulns: 17 },
  { hour: "22:00", threats: 31, leaks: 5, vulns: 11 },
];

// ── Graph Nodes ──
export const graphNodes = [
  { id: "ip-1", type: "custom", position: { x: 400, y: 50 }, data: { label: "185.220.101.34", kind: "ip", severity: "critical" } },
  { id: "ip-2", type: "custom", position: { x: 100, y: 200 }, data: { label: "45.33.32.156", kind: "ip", severity: "high" } },
  { id: "domain-1", type: "custom", position: { x: 650, y: 200 }, data: { label: "data-sync.xyz", kind: "domain", severity: "high" } },
  { id: "domain-2", type: "custom", position: { x: 250, y: 350 }, data: { label: "evil-cdn.net", kind: "domain", severity: "medium" } },
  { id: "email-1", type: "custom", position: { x: 500, y: 350 }, data: { label: "admin@corp.io", kind: "email", severity: "critical" } },
  { id: "hash-1", type: "custom", position: { x: 150, y: 50 }, data: { label: "5f4dcc3b...765d", kind: "hash", severity: "medium" } },
  { id: "actor-1", type: "custom", position: { x: 400, y: 500 }, data: { label: "APT-HYDRA", kind: "actor", severity: "critical" } },
];

export const graphEdges = [
  { id: "e1", source: "ip-1", target: "domain-1", animated: true, style: { stroke: "#00f0ff", strokeWidth: 1.5 } },
  { id: "e2", source: "ip-1", target: "email-1", animated: true, style: { stroke: "#ff3b5c", strokeWidth: 1.5 } },
  { id: "e3", source: "ip-2", target: "domain-2", style: { stroke: "#a855f7", strokeWidth: 1 } },
  { id: "e4", source: "domain-1", target: "email-1", style: { stroke: "#f59e0b", strokeWidth: 1 } },
  { id: "e5", source: "domain-2", target: "hash-1", style: { stroke: "#475569", strokeWidth: 1 } },
  { id: "e6", source: "email-1", target: "actor-1", animated: true, style: { stroke: "#ff3b5c", strokeWidth: 2 } },
  { id: "e7", source: "ip-1", target: "actor-1", animated: true, style: { stroke: "#ff3b5c", strokeWidth: 1.5 } },
  { id: "e8", source: "domain-1", target: "actor-1", style: { stroke: "#a855f7", strokeWidth: 1 } },
];

// ── AI Analysis ──
export const aiAnalysis = {
  summary:
    "Correlated intelligence indicates a coordinated campaign targeting corporate infrastructure. The leaked credentials from BreachForums (12,847 records) are linked to the C2 IP address 185.220.101.34, which has been associated with Cobalt Strike beacon activity. The threat actor APT-HYDRA appears to be leveraging the FortiOS vulnerability (CVE-2024-21762) for initial access.",
  confidence: 87,
  recommendations: [
    { action: "Force password reset for all compromised accounts", priority: "critical" },
    { action: "Block IP 185.220.101.34 at perimeter firewall", priority: "critical" },
    { action: "Patch FortiOS to version 7.4.3 or later immediately", priority: "critical" },
    { action: "Investigate host 10.0.5.23 for signs of compromise", priority: "high" },
    { action: "Enable MFA on all VPN endpoints", priority: "high" },
    { action: "Monitor DNS queries to data-sync.xyz domain", priority: "medium" },
  ],
};
