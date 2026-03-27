"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Share2,
  Download,
  Filter,
  Globe,
  Mail,
  Hash,
  Server,
  UserX,
  ShieldCheck,
  Loader,
  type LucideProps,
} from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import PageShell from "@/components/PageShell";
import { fetchThreats, type ThreatItem } from "@/lib/threats-api";

const kindConfig: Record<string, { icon: React.ComponentType<LucideProps>; color: string; bg: string; label: string }> = {
  ip: { icon: Server, color: "#00f0ff", bg: "rgba(0,240,255,0.1)", label: "IP Address" },
  domain: { icon: Globe, color: "#a855f7", bg: "rgba(168,85,247,0.1)", label: "Domain" },
  email: { icon: Mail, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Email" },
  hash: { icon: Hash, color: "#64748b", bg: "rgba(100,116,139,0.1)", label: "Hash" },
  actor: { icon: UserX, color: "#ff3b5c", bg: "rgba(255,59,92,0.15)", label: "Threat Actor" },
  cve: { icon: ShieldCheck, color: "#ff3b5c", bg: "rgba(255,59,92,0.1)", label: "CVE" },
};

const severityBorder: Record<string, string> = {
  critical: "border-red-glow/50 shadow-[0_0_12px_rgba(255,59,92,0.25)]",
  high: "border-orange-400/40 shadow-[0_0_8px_rgba(249,115,22,0.15)]",
  medium: "border-amber-500/30",
  low: "border-green-500/30",
};

function IntelNode({ data }: NodeProps) {
  const config = kindConfig[data.kind as string] || kindConfig.ip;
  const Icon = config.icon;
  const borderClass = severityBorder[data.severity as string] || "";
  const isActor = data.kind === "actor";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-sm transition-all hover:scale-110 ${borderClass} ${isActor ? "px-4 py-3" : ""}`}
        style={{ background: config.bg, borderColor: `${config.color}40` }}
      >
        <Icon className={`${isActor ? "w-4 h-4" : "w-3 h-3"}`} style={{ color: config.color }} strokeWidth={1.5} />
        <span className={`font-mono text-text-primary ${isActor ? "text-xs font-bold" : "text-[10px]"}`}>
          {data.label as string}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </>
  );
}

const nodeTypes = { custom: IntelNode };

interface IOCEntry {
  id: string;
  value: string;
  kind: string;
  severity: string;
}

function buildExtendedGraph(threats: ThreatItem[]): { nodes: Node[]; edges: Edge[] } {
  const iocMap = new Map<string, IOCEntry>();
  const connections: { from: string; to: string }[] = [];

  for (const t of threats) {
    const meta = t.metadata || {};
    const nodesInThreat: string[] = [];

    const addEntry = (value: string, kind: string) => {
      const id = `${kind}:${value}`;
      if (!iocMap.has(id)) {
        iocMap.set(id, { id, value, kind, severity: t.severity });
      }
      nodesInThreat.push(id);
    };

    // CVE
    const cveId = meta.cve_id as string | undefined;
    if (cveId?.startsWith("CVE-")) addEntry(cveId, "cve");

    // IP from metadata
    const ip = meta.ip as string | undefined;
    if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) addEntry(ip, "ip");

    // Hash
    const sha256 = meta.sha256 as string | undefined;
    if (sha256 && sha256.length >= 32) addEntry(sha256.slice(0, 12) + "..." + sha256.slice(-4), "hash");

    // IOC field
    if (t.ioc) {
      if (t.ioc.startsWith("CVE-")) addEntry(t.ioc, "cve");
      else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(t.ioc)) addEntry(t.ioc, "ip");
      else if (/^[a-f0-9]{32,64}$/i.test(t.ioc)) addEntry(t.ioc.slice(0, 12) + "..." + t.ioc.slice(-4), "hash");
      else if (t.ioc.includes("@")) addEntry(t.ioc, "email");
      else if (t.ioc.includes(".")) addEntry(t.ioc, "domain");
    }

    // Domain from URL
    if (t.url?.startsWith("http")) {
      try {
        const domain = new URL(t.url).hostname;
        if (domain && !domain.match(/^(\d+\.){3}\d+$/)) addEntry(domain, "domain");
      } catch { /* skip */ }
    }

    // Emails in text
    const text = t.title + " " + (t.description || "");
    const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (emailMatch) addEntry(emailMatch[0], "email");

    // IPs in text
    const ipMatches = text.matchAll(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g);
    for (const m of ipMatches) {
      if (!m[1].startsWith("0.") && !m[1].startsWith("127.") && !m[1].startsWith("10.")) {
        addEntry(m[1], "ip");
      }
    }

    // Connect all IOCs within the same threat
    for (let a = 0; a < nodesInThreat.length; a++) {
      for (let b = a + 1; b < nodesInThreat.length; b++) {
        connections.push({ from: nodesInThreat[a], to: nodesInThreat[b] });
      }
    }
  }

  // Rank by connections, take top 20
  const connCount = new Map<string, number>();
  for (const c of connections) {
    connCount.set(c.from, (connCount.get(c.from) || 0) + 1);
    connCount.set(c.to, (connCount.get(c.to) || 0) + 1);
  }

  const topEntries = Array.from(iocMap.values())
    .sort((a, b) => (connCount.get(b.id) || 0) - (connCount.get(a.id) || 0))
    .slice(0, 20);

  const topIds = new Set(topEntries.map((e) => e.id));

  // Layout in a force-like grid
  const centerX = 500;
  const centerY = 350;
  const radius = 280;

  const nodes: Node[] = topEntries.map((entry, i) => {
    const angle = (2 * Math.PI * i) / topEntries.length - Math.PI / 2;
    const r = radius * (0.7 + Math.random() * 0.3);
    return {
      id: entry.id,
      type: "custom",
      position: { x: centerX + r * Math.cos(angle), y: centerY + r * Math.sin(angle) },
      data: { label: entry.value, kind: entry.kind, severity: entry.severity },
    };
  });

  const edgeSet = new Set<string>();
  const edges: Edge[] = [];
  for (const c of connections) {
    if (!topIds.has(c.from) || !topIds.has(c.to)) continue;
    const key = [c.from, c.to].sort().join("→");
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    const fromEntry = iocMap.get(c.from);
    const isCritical = fromEntry?.severity === "critical";
    edges.push({
      id: `e-${edges.length}`,
      source: c.from,
      target: c.to,
      animated: isCritical,
      style: { stroke: isCritical ? "#ff3b5c" : "#00f0ff", strokeWidth: isCritical ? 2 : 1 },
    });
  }

  return { nodes, edges };
}

export default function GraphPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [graphNodes, setGraphNodes] = useState<Node[]>([]);
  const [graphEdges, setGraphEdges] = useState<Edge[]>([]);
  const [nodes, , onNodesChange] = useNodesState([] as Node[]);
  const [edges, , onEdgesChange] = useEdgesState([] as Edge[]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [filters, setFilters] = useState<Set<string>>(new Set(["ip", "domain", "email", "hash", "actor", "cve"]));

  useEffect(() => {
    setMounted(true);
    fetchThreats({ per_page: 200 })
      .then((data) => {
        const graph = buildExtendedGraph(data.items);
        setGraphNodes(graph.nodes);
        setGraphEdges(graph.edges);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleFilter = (kind: string) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const displayNodes = graphNodes.length > 0 ? graphNodes : nodes;
  const displayEdges = graphEdges.length > 0 ? graphEdges : edges;
  const visibleNodes = displayNodes.filter((n) => filters.has(n.data.kind as string));
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = displayEdges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

  return (
    <PageShell
      icon={Share2}
      title="GRAPH INTELLIGENCE"
      subtitle="Interactive threat relationship mapping"
      actions={
        <button className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-text-secondary border border-white/10 rounded-lg hover:bg-white/[0.03]">
          <Download className="w-3 h-3" /> Export Graph
        </button>
      }
    >
      <div className="grid grid-cols-4 gap-6 h-[calc(100vh-180px)]">
        {/* Graph Canvas */}
        <div className="col-span-3 glass-card overflow-hidden rounded-xl">
          {loading && (
            <div className="h-full flex items-center justify-center">
              <Loader className="w-5 h-5 text-cyan-glow animate-spin" />
              <span className="ml-2 text-xs text-text-tertiary">Building threat graph...</span>
            </div>
          )}

          {!loading && displayNodes.length === 0 && (
            <div className="h-full flex items-center justify-center text-xs text-text-tertiary">
              No IOC correlations found. Run collectors to populate data.
            </div>
          )}

          {mounted && !loading && displayNodes.length > 0 && (
            <ReactFlow
              nodes={visibleNodes}
              edges={visibleEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => setSelectedNode(node)}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
              className="!bg-transparent"
              minZoom={0.3}
              maxZoom={2}
            >
              <Background color="#1e293b" gap={30} size={1} />
              <Controls
                className="!bg-surface-overlay/80 !border-white/10 !rounded-lg !shadow-none [&>button]:!bg-surface-overlay [&>button]:!border-white/10 [&>button]:!text-text-secondary [&>button:hover]:!bg-white/[0.06]"
                showInteractive={false}
              />
              <MiniMap
                className="!bg-surface-overlay/80 !border-white/10 !rounded-lg"
                nodeColor={(n) => {
                  const kind = n.data?.kind as string;
                  return kindConfig[kind]?.color || "#475569";
                }}
                maskColor="rgba(0,0,0,0.7)"
              />
              <Panel position="top-left">
                <div className="glass-card p-3 space-y-1.5">
                  <p className="text-[9px] font-semibold tracking-wider text-text-tertiary uppercase font-[family-name:var(--font-display)] mb-2">
                    <Filter className="w-2.5 h-2.5 inline mr-1" />Node Filters
                  </p>
                  {Object.entries(kindConfig).map(([kind, config]) => (
                    <button
                      key={kind}
                      onClick={() => toggleFilter(kind)}
                      className={`flex items-center gap-2 w-full px-2 py-1 rounded text-[10px] transition-all ${
                        filters.has(kind) ? "bg-white/[0.04]" : "opacity-40"
                      }`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: config.color }} />
                      <span className="text-text-secondary">{config.label}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            </ReactFlow>
          )}
        </div>

        {/* Right: Node Detail */}
        <div>
          {selectedNode ? (
            <motion.div
              key={selectedNode.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-5 box-glow-cyan"
            >
              <h3 className="text-[10px] font-semibold tracking-wider text-cyan-glow uppercase font-[family-name:var(--font-display)] mb-4">
                Node Details
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  {(() => {
                    const config = kindConfig[selectedNode.data.kind as string] || kindConfig.ip;
                    const Icon = config.icon;
                    return <Icon className="w-5 h-5" style={{ color: config.color }} />;
                  })()}
                  <div>
                    <p className="text-[9px] text-text-tertiary uppercase">
                      {kindConfig[selectedNode.data.kind as string]?.label || "Unknown"}
                    </p>
                    <p className="text-sm text-text-primary font-mono break-all">
                      {selectedNode.data.label as string}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white/[0.02]">
                  <p className="text-[9px] text-text-tertiary uppercase mb-1">Severity</p>
                  <p className="text-xs font-bold capitalize" style={{
                    color: (selectedNode.data.severity as string) === "critical" ? "#ff3b5c" :
                      (selectedNode.data.severity as string) === "high" ? "#f97316" : "#f59e0b"
                  }}>
                    {selectedNode.data.severity as string}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-white/[0.02]">
                  <p className="text-[9px] text-text-tertiary uppercase mb-1">Connections</p>
                  <div className="space-y-1">
                    {displayEdges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).map((e) => {
                      const otherId = e.source === selectedNode.id ? e.target : e.source;
                      const otherNode = displayNodes.find((n) => n.id === otherId);
                      if (!otherNode) return null;
                      const config = kindConfig[otherNode.data.kind as string] || kindConfig.ip;
                      return (
                        <div key={e.id} className="flex items-center gap-2 py-1">
                          <div className="w-2 h-2 rounded-full" style={{ background: config.color }} />
                          <span className="text-[10px] text-text-secondary font-mono">{otherNode.data.label as string}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button className="w-full py-2 text-[10px] text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 rounded-lg hover:bg-cyan-glow/15">
                  Investigate Node
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="glass-card p-8 flex flex-col items-center justify-center text-center h-64">
              <Share2 className="w-8 h-8 text-text-tertiary mb-3" strokeWidth={1} />
              <p className="text-xs text-text-tertiary">Click a node to view details</p>
              <p className="text-[10px] text-text-tertiary mt-1">Drag to rearrange, scroll to zoom</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
