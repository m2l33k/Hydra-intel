"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Share2, Maximize2, Globe, Mail, Hash, Server, UserX, type LucideProps } from "lucide-react";
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
import { graphNodes, graphEdges } from "@/lib/mock-data";

const kindConfig: Record<string, { icon: React.ComponentType<LucideProps>; color: string; bg: string }> = {
  ip: { icon: Server, color: "#00f0ff", bg: "rgba(0,240,255,0.1)" },
  domain: { icon: Globe, color: "#a855f7", bg: "rgba(168,85,247,0.1)" },
  email: { icon: Mail, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  hash: { icon: Hash, color: "#64748b", bg: "rgba(100,116,139,0.1)" },
  actor: { icon: UserX, color: "#ff3b5c", bg: "rgba(255,59,92,0.1)" },
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

export default function GraphIntel() {
  const [mounted, setMounted] = useState(false);
  const [nodes, , onNodesChange] = useNodesState(graphNodes as Node[]);
  const [edges, , onEdgesChange] = useEdgesState(graphEdges as Edge[]);

  useEffect(() => setMounted(true), []);

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
        <button className="p-1 rounded hover:bg-white/[0.04] text-text-tertiary">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 rounded-lg overflow-hidden border border-white/[0.04] bg-[#030712]/60 min-h-[250px]">
        {mounted && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
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
