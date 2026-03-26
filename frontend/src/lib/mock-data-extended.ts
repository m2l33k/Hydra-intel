// ═══════════════════════════════════════════════════════════
// HYDRA INTEL — Extended Mock Data for All Pages
// ═══════════════════════════════════════════════════════════

import type { Severity } from "./mock-data";

// ── IOC (Indicators of Compromise) ──
export interface IOC {
  id: string;
  type: "ip" | "domain" | "hash" | "email" | "url" | "cve";
  value: string;
  threatScore: number;
  firstSeen: string;
  lastSeen: string;
  sources: string[];
  tags: string[];
  status: "active" | "resolved" | "investigating";
  relatedCount: number;
}

export const iocs: IOC[] = [
  { id: "ioc-001", type: "ip", value: "185.220.101.34", threatScore: 95, firstSeen: "2024-03-20", lastSeen: "2024-03-25", sources: ["Network", "VirusTotal"], tags: ["c2", "cobalt-strike", "apt"], status: "active", relatedCount: 12 },
  { id: "ioc-002", type: "domain", value: "data-sync.xyz", threatScore: 88, firstSeen: "2024-03-18", lastSeen: "2024-03-25", sources: ["DNS Logs", "URLHaus"], tags: ["dns-tunnel", "exfiltration"], status: "active", relatedCount: 7 },
  { id: "ioc-003", type: "hash", value: "e99a18c428cb38d5f260853678922e03", threatScore: 82, firstSeen: "2024-03-22", lastSeen: "2024-03-24", sources: ["MalwareBazaar"], tags: ["ransomware", "lockbit"], status: "investigating", relatedCount: 4 },
  { id: "ioc-004", type: "email", value: "admin@corp-systems.io", threatScore: 78, firstSeen: "2024-03-25", lastSeen: "2024-03-25", sources: ["BreachForums", "Dark Web"], tags: ["credential-leak", "compromised"], status: "active", relatedCount: 15 },
  { id: "ioc-005", type: "ip", value: "45.33.32.156", threatScore: 72, firstSeen: "2024-03-15", lastSeen: "2024-03-23", sources: ["Shodan", "AbuseIPDB"], tags: ["scanner", "bruteforce"], status: "active", relatedCount: 3 },
  { id: "ioc-006", type: "cve", value: "CVE-2024-38094", threatScore: 98, firstSeen: "2024-03-10", lastSeen: "2024-03-25", sources: ["NVD", "CISA KEV"], tags: ["rce", "sharepoint", "critical"], status: "active", relatedCount: 22 },
  { id: "ioc-007", type: "domain", value: "evil-cdn.net", threatScore: 65, firstSeen: "2024-03-19", lastSeen: "2024-03-22", sources: ["URLHaus"], tags: ["malware-delivery"], status: "resolved", relatedCount: 2 },
  { id: "ioc-008", type: "hash", value: "5f4dcc3b5aa765d61d8327deb882cf99", threatScore: 91, firstSeen: "2024-03-24", lastSeen: "2024-03-25", sources: ["VirusTotal", "Hybrid Analysis"], tags: ["trojan", "stealer"], status: "active", relatedCount: 8 },
  { id: "ioc-009", type: "url", value: "https://login-verify.evil-cdn.net/o365", threatScore: 85, firstSeen: "2024-03-23", lastSeen: "2024-03-25", sources: ["PhishTank", "OpenPhish"], tags: ["phishing", "credential-harvesting"], status: "active", relatedCount: 5 },
  { id: "ioc-010", type: "ip", value: "91.215.85.209", threatScore: 70, firstSeen: "2024-03-21", lastSeen: "2024-03-24", sources: ["ThreatFox"], tags: ["botnet", "mirai"], status: "investigating", relatedCount: 6 },
  { id: "ioc-011", type: "email", value: "phish@login-verify.net", threatScore: 80, firstSeen: "2024-03-24", lastSeen: "2024-03-25", sources: ["Internal"], tags: ["phishing-sender"], status: "active", relatedCount: 3 },
  { id: "ioc-012", type: "domain", value: "update-service.top", threatScore: 55, firstSeen: "2024-03-12", lastSeen: "2024-03-20", sources: ["DNS Logs"], tags: ["suspicious", "dga"], status: "resolved", relatedCount: 1 },
];

// ── Extended Leaks ──
export interface LeakRecord {
  id: string;
  email: string;
  domain: string;
  passwordHash: string;
  hashType: string;
  source: string;
  breachName: string;
  date: string;
  severity: Severity;
  status: "new" | "notified" | "resolved";
}

export const leakRecords: LeakRecord[] = [
  { id: "lr-001", email: "admin@corp-systems.io", domain: "corp-systems.io", passwordHash: "5f4dcc3b5aa765d61d83••••", hashType: "MD5", source: "BreachForums", breachName: "CorpSystems DB Dump", date: "2024-03-25", severity: "critical", status: "new" },
  { id: "lr-002", email: "ceo@corp-systems.io", domain: "corp-systems.io", passwordHash: "e99a18c428cb38d5f260••••", hashType: "MD5", source: "BreachForums", breachName: "CorpSystems DB Dump", date: "2024-03-25", severity: "critical", status: "new" },
  { id: "lr-003", email: "j.smith@enterprise.com", domain: "enterprise.com", passwordHash: "482c811da5d5b4bc6d49••••", hashType: "SHA-256", source: "RaidForums Archive", breachName: "Enterprise 2024 Leak", date: "2024-03-24", severity: "high", status: "notified" },
  { id: "lr-004", email: "dev-ops@startup.io", domain: "startup.io", passwordHash: "d8578edf8458ce06fbc5••••", hashType: "bcrypt", source: "Pastebin", breachName: "Startup Configs Dump", date: "2024-03-24", severity: "high", status: "new" },
  { id: "lr-005", email: "admin@startup.io", domain: "startup.io", passwordHash: "a1b2c3d4e5f6a7b8c9d0••••", hashType: "bcrypt", source: "Pastebin", breachName: "Startup Configs Dump", date: "2024-03-24", severity: "high", status: "new" },
  { id: "lr-006", email: "support@retailco.com", domain: "retailco.com", passwordHash: "b1b3773a05c0ed017678••••", hashType: "SHA-1", source: "Dark Web Paste", breachName: "RetailCo Customer DB", date: "2024-03-23", severity: "medium", status: "resolved" },
  { id: "lr-007", email: "marketing@agency.co", domain: "agency.co", passwordHash: "7c6a180b36896a65c4c5••••", hashType: "MD5", source: "Telegram Dump", breachName: "Agency Combo List", date: "2024-03-22", severity: "low", status: "resolved" },
  { id: "lr-008", email: "finance@enterprise.com", domain: "enterprise.com", passwordHash: "6cb75f652a9b52798eb6••••", hashType: "SHA-256", source: "Dark Web Forum", breachName: "Enterprise 2024 Leak", date: "2024-03-24", severity: "high", status: "notified" },
  { id: "lr-009", email: "hr@bigcorp.org", domain: "bigcorp.org", passwordHash: "e10adc3949ba59abbe56••••", hashType: "MD5", source: "BreachForums", breachName: "BigCorp HR System", date: "2024-03-21", severity: "medium", status: "new" },
  { id: "lr-010", email: "sysadmin@techfirm.dev", domain: "techfirm.dev", passwordHash: "d033e22ae348aeb5660f••••", hashType: "SHA-1", source: "GitHub Gist", breachName: "TechFirm .env Leak", date: "2024-03-20", severity: "critical", status: "notified" },
];

// ── Reports ──
export interface Report {
  id: string;
  title: string;
  type: "weekly" | "incident" | "threat-brief" | "executive";
  status: "generated" | "draft" | "scheduled";
  date: string;
  pages: number;
  findings: number;
  severity: Severity;
}

export const reports: Report[] = [
  { id: "rpt-001", title: "Weekly Threat Intelligence Summary", type: "weekly", status: "generated", date: "2024-03-25", pages: 12, findings: 47, severity: "high" },
  { id: "rpt-002", title: "Incident Report: CorpSystems Credential Breach", type: "incident", status: "generated", date: "2024-03-25", pages: 8, findings: 23, severity: "critical" },
  { id: "rpt-003", title: "CVE-2024-38094 Threat Brief", type: "threat-brief", status: "generated", date: "2024-03-24", pages: 5, findings: 12, severity: "critical" },
  { id: "rpt-004", title: "Executive Summary: Q1 Threat Landscape", type: "executive", status: "draft", date: "2024-03-23", pages: 18, findings: 156, severity: "high" },
  { id: "rpt-005", title: "Weekly Threat Intelligence Summary", type: "weekly", status: "generated", date: "2024-03-18", pages: 10, findings: 38, severity: "medium" },
  { id: "rpt-006", title: "Ransomware Campaign Analysis: LockBit 3.0", type: "threat-brief", status: "generated", date: "2024-03-17", pages: 7, findings: 19, severity: "high" },
  { id: "rpt-007", title: "Dark Web Monitoring Monthly Report", type: "weekly", status: "scheduled", date: "2024-03-31", pages: 0, findings: 0, severity: "medium" },
  { id: "rpt-008", title: "Incident Report: DNS Tunneling Detection", type: "incident", status: "draft", date: "2024-03-22", pages: 4, findings: 8, severity: "medium" },
];

// ── Dark Web Extended ──
export interface DarkWebAlert {
  id: string;
  keyword: string;
  category: "credentials" | "data-sale" | "exploit" | "discussion" | "service";
  source: string;
  onionUrl: string;
  snippet: string;
  detectedAt: string;
  isNew: boolean;
  severity: Severity;
  mentions: number;
}

export const darkWebAlerts: DarkWebAlert[] = [
  { id: "dwa-001", keyword: "corp-systems.io", category: "credentials", source: "BreachForums Mirror", onionUrl: "http://breach••••.onion/dump/12847", snippet: "Full database dump - 12,847 credentials with plaintext passwords. Admin access included. Corporate VPN access for sale.", detectedAt: "32 min ago", isNew: true, severity: "critical", mentions: 45 },
  { id: "dwa-002", keyword: "enterprise VPN", category: "data-sale", source: "Dark Market", onionUrl: "http://market••••.onion/listing/vpn-access", snippet: "Selling VPN access to Fortune 500 company. FortiGate credentials. $500 per access. Bulk discount available.", detectedAt: "1.5h ago", isNew: true, severity: "critical", mentions: 12 },
  { id: "dwa-003", keyword: "LockBit", category: "discussion", source: "LockBit Blog", onionUrl: "http://lockbit••••.onion/blog", snippet: "New victim posted: healthcare provider, 2M records. Countdown: 71h remaining. Negotiation link available.", detectedAt: "2h ago", isNew: false, severity: "high", mentions: 89 },
  { id: "dwa-004", keyword: "credit cards", category: "data-sale", source: "Card Shop", onionUrl: "http://cards••••.onion/fresh", snippet: "Fresh batch - 5,000 CC with CVV. US banks only. 85% valid rate guaranteed. $15/card, bulk $10.", detectedAt: "4h ago", isNew: false, severity: "high", mentions: 230 },
  { id: "dwa-005", keyword: "zero-day RCE", category: "exploit", source: "Exploit Forum", onionUrl: "http://forum••••.onion/thread/9821", snippet: "Unpatched RCE in popular CMS. PoC shared privately. Affects 100K+ sites. Asking $50K for full exploit chain.", detectedAt: "6h ago", isNew: false, severity: "critical", mentions: 67 },
  { id: "dwa-006", keyword: "phishing kit", category: "service", source: "Telegram Mirror", onionUrl: "http://phish••••.onion/kits", snippet: "NakedPages v3.0 released - MFA bypass for O365/Google. Anti-detection included. $200/month subscription.", detectedAt: "8h ago", isNew: false, severity: "medium", mentions: 156 },
  { id: "dwa-007", keyword: "SSH keys", category: "credentials", source: "Paste Site", onionUrl: "http://paste••••.onion/raw/a8f2e", snippet: "Collection of 2,300 SSH private keys extracted from exposed GitHub repos. Includes AWS and Azure instances.", detectedAt: "12h ago", isNew: false, severity: "high", mentions: 34 },
  { id: "dwa-008", keyword: "database dump", category: "data-sale", source: "BreachForums Mirror", onionUrl: "http://breach••••.onion/dump/13102", snippet: "E-commerce platform DB - 800K users. Emails, bcrypt hashes, addresses, order history. $300 for full dump.", detectedAt: "18h ago", isNew: false, severity: "medium", mentions: 78 },
];

// ── OSINT Sources Extended ──
export interface OsintSource {
  id: string;
  name: string;
  type: "crawler" | "api" | "feed" | "manual";
  status: "active" | "error" | "paused" | "pending";
  lastRun: string;
  nextRun: string;
  itemsCollected: number;
  itemsToday: number;
  errorRate: number;
  avgResponseTime: string;
  enabled: boolean;
}

export const osintSources: OsintSource[] = [
  { id: "src-001", name: "GitHub Code Search", type: "api", status: "active", lastRun: "30s ago", nextRun: "in 5m", itemsCollected: 12470, itemsToday: 247, errorRate: 0.2, avgResponseTime: "1.2s", enabled: true },
  { id: "src-002", name: "Reddit Security Feeds", type: "crawler", status: "active", lastRun: "2m ago", nextRun: "in 8m", itemsCollected: 8920, itemsToday: 156, errorRate: 1.5, avgResponseTime: "2.8s", enabled: true },
  { id: "src-003", name: "NVD CVE Feed", type: "feed", status: "active", lastRun: "5m ago", nextRun: "in 10m", itemsCollected: 34210, itemsToday: 89, errorRate: 0.0, avgResponseTime: "0.8s", enabled: true },
  { id: "src-004", name: "Dark Web Scanner", type: "crawler", status: "active", lastRun: "15m ago", nextRun: "in 45m", itemsCollected: 5670, itemsToday: 34, errorRate: 5.2, avgResponseTime: "8.5s", enabled: true },
  { id: "src-005", name: "Pastebin Monitor", type: "crawler", status: "active", lastRun: "1m ago", nextRun: "in 3m", itemsCollected: 21030, itemsToday: 312, errorRate: 0.8, avgResponseTime: "1.5s", enabled: true },
  { id: "src-006", name: "Telegram Channels", type: "crawler", status: "pending", lastRun: "Never", nextRun: "—", itemsCollected: 0, itemsToday: 0, errorRate: 0, avgResponseTime: "—", enabled: false },
  { id: "src-007", name: "Shodan Search", type: "api", status: "error", lastRun: "1h ago", nextRun: "Paused", itemsCollected: 1450, itemsToday: 0, errorRate: 100, avgResponseTime: "—", enabled: true },
  { id: "src-008", name: "VirusTotal Feed", type: "api", status: "active", lastRun: "10m ago", nextRun: "in 5m", itemsCollected: 7890, itemsToday: 78, errorRate: 0.1, avgResponseTime: "0.5s", enabled: true },
  { id: "src-009", name: "URLHaus Feed", type: "feed", status: "active", lastRun: "3m ago", nextRun: "in 7m", itemsCollected: 15670, itemsToday: 201, errorRate: 0.0, avgResponseTime: "0.3s", enabled: true },
  { id: "src-010", name: "AbuseIPDB", type: "api", status: "paused", lastRun: "2d ago", nextRun: "—", itemsCollected: 4560, itemsToday: 0, errorRate: 0, avgResponseTime: "1.1s", enabled: false },
];

// ── Graph Extended Nodes ──
export const graphNodesExtended = [
  { id: "ip-1", type: "custom", position: { x: 500, y: 50 }, data: { label: "185.220.101.34", kind: "ip", severity: "critical" } },
  { id: "ip-2", type: "custom", position: { x: 100, y: 200 }, data: { label: "45.33.32.156", kind: "ip", severity: "high" } },
  { id: "ip-3", type: "custom", position: { x: 850, y: 350 }, data: { label: "91.215.85.209", kind: "ip", severity: "medium" } },
  { id: "domain-1", type: "custom", position: { x: 750, y: 200 }, data: { label: "data-sync.xyz", kind: "domain", severity: "high" } },
  { id: "domain-2", type: "custom", position: { x: 250, y: 400 }, data: { label: "evil-cdn.net", kind: "domain", severity: "medium" } },
  { id: "domain-3", type: "custom", position: { x: 600, y: 500 }, data: { label: "login-verify.net", kind: "domain", severity: "high" } },
  { id: "domain-4", type: "custom", position: { x: 100, y: 550 }, data: { label: "update-service.top", kind: "domain", severity: "low" } },
  { id: "email-1", type: "custom", position: { x: 500, y: 300 }, data: { label: "admin@corp-systems.io", kind: "email", severity: "critical" } },
  { id: "email-2", type: "custom", position: { x: 300, y: 150 }, data: { label: "ceo@corp-systems.io", kind: "email", severity: "critical" } },
  { id: "email-3", type: "custom", position: { x: 850, y: 500 }, data: { label: "phish@login-verify.net", kind: "email", severity: "high" } },
  { id: "hash-1", type: "custom", position: { x: 50, y: 50 }, data: { label: "5f4dcc3b...765d", kind: "hash", severity: "high" } },
  { id: "hash-2", type: "custom", position: { x: 900, y: 100 }, data: { label: "e99a18c4...2e03", kind: "hash", severity: "high" } },
  { id: "actor-1", type: "custom", position: { x: 450, y: 650 }, data: { label: "APT-HYDRA", kind: "actor", severity: "critical" } },
  { id: "cve-1", type: "custom", position: { x: 700, y: 650 }, data: { label: "CVE-2024-38094", kind: "cve", severity: "critical" } },
];

export const graphEdgesExtended = [
  { id: "e1", source: "ip-1", target: "domain-1", animated: true, style: { stroke: "#00f0ff", strokeWidth: 1.5 } },
  { id: "e2", source: "ip-1", target: "email-1", animated: true, style: { stroke: "#ff3b5c", strokeWidth: 2 } },
  { id: "e3", source: "ip-2", target: "domain-2", style: { stroke: "#a855f7", strokeWidth: 1 } },
  { id: "e4", source: "domain-1", target: "email-1", style: { stroke: "#f59e0b", strokeWidth: 1 } },
  { id: "e5", source: "domain-2", target: "hash-1", style: { stroke: "#475569", strokeWidth: 1 } },
  { id: "e6", source: "email-1", target: "actor-1", animated: true, style: { stroke: "#ff3b5c", strokeWidth: 2 } },
  { id: "e7", source: "ip-1", target: "actor-1", animated: true, style: { stroke: "#ff3b5c", strokeWidth: 1.5 } },
  { id: "e8", source: "domain-1", target: "actor-1", style: { stroke: "#a855f7", strokeWidth: 1 } },
  { id: "e9", source: "email-2", target: "email-1", style: { stroke: "#f59e0b", strokeWidth: 1 } },
  { id: "e10", source: "ip-2", target: "hash-1", style: { stroke: "#475569", strokeWidth: 1 } },
  { id: "e11", source: "domain-3", target: "email-3", animated: true, style: { stroke: "#a855f7", strokeWidth: 1.5 } },
  { id: "e12", source: "ip-3", target: "domain-3", style: { stroke: "#00f0ff", strokeWidth: 1 } },
  { id: "e13", source: "hash-2", target: "ip-1", style: { stroke: "#ff3b5c", strokeWidth: 1 } },
  { id: "e14", source: "actor-1", target: "cve-1", animated: true, style: { stroke: "#ff3b5c", strokeWidth: 2 } },
  { id: "e15", source: "domain-3", target: "actor-1", style: { stroke: "#a855f7", strokeWidth: 1 } },
  { id: "e16", source: "domain-4", target: "ip-3", style: { stroke: "#475569", strokeWidth: 1 } },
];
