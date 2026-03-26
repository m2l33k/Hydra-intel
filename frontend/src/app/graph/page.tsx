"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Share2,
  Maximize2,
  Download,
  Filter,
  ZoomIn,
  ZoomOut,
  Globe,
  Mail,
  Hash,
  Server,
  UserX,
  ShieldCheck,
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
import { graphNodesExtended, graphEdgesExtended } from "@/lib/mock-data-extended";

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

export default function GraphPage() {
  const [mounted, setMounted] = useState(false);
  const [nodes, , onNodesChange] = useNodesState(graphNodesExtended as Node[]);
  const [edges, , onEdgesChange] = useEdgesState(graphEdgesExtended as Edge[]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [filters, setFilters] = useState<Set<string>>(new Set(["ip", "domain", "email", "hash", "actor", "cve"]));

  useEffect(() => setMounted(true), []);

  const toggleFilter = (kind: string) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const visibleNodes = nodes.filter((n) => filters.has(n.data.kind as string));
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

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
          {mounted && (
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
              {/* Legend */}
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
                    {edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).map((e) => {
                      const otherId = e.source === selectedNode.id ? e.target : e.source;
                      const otherNode = nodes.find((n) => n.id === otherId);
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
