"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Share2, Maximize2, Globe, Mail, Hash, Server, UserX, ShieldCheck, Loader, type LucideProps } from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { fetchThreats, type ThreatItem } from "@/lib/threats-api";

const kindConfig: Record<string, { icon: React.ComponentType<LucideProps>; color: string; bg: string }> = {
  ip: { icon: Server, color: "#00f0ff", bg: "rgba(0,240,255,0.1)" },
  domain: { icon: Globe, color: "#a855f7", bg: "rgba(168,85,247,0.1)" },
  email: { icon: Mail, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  hash: { icon: Hash, color: "#64748b", bg: "rgba(100,116,139,0.1)" },
  actor: { icon: UserX, color: "#ff3b5c", bg: "rgba(255,59,92,0.1)" },
  cve: { icon: ShieldCheck, color: "#ff3b5c", bg: "rgba(255,59,92,0.1)" },
};

const severityBorder: Record<string, string> = {
  critical: "border-red-glow/50 shadow-[0_0_10px_rgba(255,59,92,0.2)]",
  high: "border-orange-400/40",
  medium: "border-amber-500/30",
  low: "border-green-500/30",
};

function IntelNode({ data }: NodeProps) {
  const config = kindConfig[data.kind as string] || kindConfig.ip;
  const Icon = config.icon;
  const borderClass = severityBorder[data.severity as string] || "";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-sm transition-all hover:scale-105 ${borderClass}`}
        style={{
          background: config.bg,
          borderColor: `${config.color}40`,
        }}
      >
        <Icon className="w-3 h-3" style={{ color: config.color }} strokeWidth={1.5} />
        <span className="text-[10px] font-mono text-text-primary">{data.label as string}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </>
  );
}

const nodeTypes = { custom: IntelNode };

interface IOCNode {
  id: string;
  value: string;
  kind: string;
  severity: string;
  source: string;
}

function buildGraph(threats: ThreatItem[]): { nodes: Node[]; edges: Edge[] } {
  const iocMap = new Map<string, IOCNode>();
  const connections: { from: string; to: string }[] = [];

  for (const t of threats) {
    const meta = t.metadata || {};
    const nodesInThreat: string[] = [];

    // Extract CVE
    const cveId = meta.cve_id as string | undefined;
    if (cveId && cveId.startsWith("CVE-")) {
      const id = `cve:${cveId}`;
      iocMap.set(id, { id, value: cveId, kind: "cve", severity: t.severity, source: t.source });
      nodesInThreat.push(id);
    }

    // Extract IP
    const ip = meta.ip as string | undefined;
    if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      const id = `ip:${ip}`;
      iocMap.set(id, { id, value: ip, kind: "ip", severity: t.severity, source: t.source });
      nodesInThreat.push(id);
    }

    // Extract from IOC field
    if (t.ioc) {
      let kind = "hash";
      if (t.ioc.startsWith("CVE-")) kind = "cve";
      else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(t.ioc)) kind = "ip";
      else if (t.ioc.includes("@")) kind = "email";
      else if (t.ioc.includes(".") && !t.ioc.match(/^[a-f0-9]+$/i)) kind = "domain";
      const id = `${kind}:${t.ioc}`;
      iocMap.set(id, { id, value: t.ioc, kind, severity: t.severity, source: t.source });
      nodesInThreat.push(id);
    }

    // Extract domain from URL
    if (t.url && t.url.startsWith("http")) {
      try {
        const domain = new URL(t.url).hostname;
        if (domain && !domain.match(/^(\d+\.){3}\d+$/)) {
          const id = `domain:${domain}`;
          iocMap.set(id, { id, value: domain, kind: "domain", severity: t.severity, source: t.source });
          nodesInThreat.push(id);
        }
      } catch { /* skip */ }
    }

    // Look for emails
    const text = t.title + " " + (t.description || "");
    const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (emailMatch) {
      const id = `email:${emailMatch[0]}`;
      iocMap.set(id, { id, value: emailMatch[0], kind: "email", severity: t.severity, source: t.source });
      nodesInThreat.push(id);
    }

    // Look for IPs in content
    const ipMatches = text.matchAll(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g);
    for (const m of ipMatches) {
      if (!m[1].startsWith("0.") && !m[1].startsWith("127.") && !m[1].startsWith("10.")) {
        const id = `ip:${m[1]}`;
        iocMap.set(id, { id, value: m[1], kind: "ip", severity: t.severity, source: t.source });
        nodesInThreat.push(id);
      }
    }

    // Connect all IOCs within the same threat
    for (let a = 0; a < nodesInThreat.length; a++) {
      for (let b = a + 1; b < nodesInThreat.length; b++) {
        connections.push({ from: nodesInThreat[a], to: nodesInThreat[b] });
      }
    }
  }

  // Limit to top 15 nodes (most connected)
  const connectionCount = new Map<string, number>();
  for (const c of connections) {
    connectionCount.set(c.from, (connectionCount.get(c.from) || 0) + 1);
    connectionCount.set(c.to, (connectionCount.get(c.to) || 0) + 1);
  }

  const topNodes = Array.from(iocMap.values())
    .sort((a, b) => (connectionCount.get(b.id) || 0) - (connectionCount.get(a.id) || 0))
    .slice(0, 15);

  const topNodeIds = new Set(topNodes.map((n) => n.id));

  // Layout: arrange in a circle
  const centerX = 400;
  const centerY = 300;
  const radius = 220;

  const nodes: Node[] = topNodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / topNodes.length - Math.PI / 2;
    return {
      id: n.id,
      type: "custom",
      position: {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      },
      data: { label: n.value, kind: n.kind, severity: n.severity },
    };
  });

  const edgeSet = new Set<string>();
  const edges: Edge[] = [];
  for (const c of connections) {
    if (!topNodeIds.has(c.from) || !topNodeIds.has(c.to)) continue;
    const key = [c.from, c.to].sort().join("→");
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);

    const fromNode = iocMap.get(c.from);
    const isCritical = fromNode?.severity === "critical";
    edges.push({
      id: `e-${edges.length}`,
      source: c.from,
      target: c.to,
      animated: isCritical,
      style: {
        stroke: isCritical ? "#ff3b5c" : "#00f0ff",
        strokeWidth: isCritical ? 2 : 1,
      },
    });
  }

  return { nodes, edges };
}

export default function GraphIntel() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const [nodes, , onNodesChange] = useNodesState(graphData.nodes);
  const [edges, , onEdgesChange] = useEdgesState(graphData.edges);

  useEffect(() => {
    setMounted(true);
    fetchThreats({ per_page: 100 })
      .then((data) => {
        const graph = buildGraph(data.items);
        setGraphData(graph);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Update nodes/edges when graphData changes
  const displayNodes = graphData.nodes.length > 0 ? graphData.nodes : nodes;
  const displayEdges = graphData.edges.length > 0 ? graphData.edges : edges;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}
      className="glass-card p-5 flex flex-col"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Share2 className="w-3.5 h-3.5 text-cyan-glow" strokeWidth={1.5} />
          <h2 className="text-xs font-semibold tracking-[0.15em] text-text-secondary uppercase font-[family-name:var(--font-display)]">
            Graph Intelligence
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-text-tertiary">{displayNodes.length} nodes</span>
          <button className="p-1 rounded hover:bg-white/[0.04] text-text-tertiary">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 rounded-lg overflow-hidden border border-white/[0.04] bg-[#030712]/60 min-h-[250px]">
        {loading && (
          <div className="h-full flex items-center justify-center">
            <Loader className="w-4 h-4 text-cyan-glow animate-spin" />
            <span className="ml-2 text-[10px] text-text-tertiary">Building threat graph...</span>
          </div>
        )}

        {!loading && displayNodes.length === 0 && (
          <div className="h-full flex items-center justify-center text-[10px] text-text-tertiary">
            No IOC correlations found. Run collectors to populate.
          </div>
        )}

        {mounted && !loading && displayNodes.length > 0 && (
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            className="!bg-transparent"
            minZoom={0.5}
            maxZoom={1.5}
          >
            <Background color="#1e293b" gap={30} size={1} />
            <Controls
              className="!bg-surface-overlay !border-white/10 !rounded-lg !shadow-none [&>button]:!bg-surface-overlay [&>button]:!border-white/10 [&>button]:!text-text-secondary [&>button:hover]:!bg-white/[0.06]"
              showInteractive={false}
            />
          </ReactFlow>
        )}
      </div>
    </motion.div>
  );
}
