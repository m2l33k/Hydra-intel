"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Bell,
  Wifi,
  Shield,
  Cpu,
  AlertTriangle,
  type LucideProps,
} from "lucide-react";

export default function TopBar() {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="flex items-center justify-between h-14 px-5 border-b border-white/[0.06] bg-[#050a18]/60 backdrop-blur-xl"
    >
      {/* Search */}
      <div className="relative flex-1 max-w-xl">
        <Search
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
            searchFocused ? "text-cyan-glow" : "text-text-tertiary"
          }`}
          strokeWidth={1.5}
        />
        <input
          type="text"
          placeholder="Search IP, domain, email, hash, CVE..."
          className={`w-full h-9 pl-10 pr-4 bg-white/[0.03] border rounded-lg text-xs text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-300 ${
            searchFocused
              ? "border-cyan-glow/40 shadow-[0_0_15px_rgba(0,240,255,0.1)]"
              : "border-white/[0.06]"
          }`}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] text-text-tertiary bg-white/[0.05] border border-white/[0.08] rounded">
          /
        </kbd>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-5 ml-6">
        {/* Threat Level */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-glow/[0.08] border border-red-glow/20">
          <AlertTriangle className="w-3.5 h-3.5 text-red-glow pulse-critical" strokeWidth={2} />
          <span className="text-[10px] font-semibold tracking-wider text-red-glow font-[family-name:var(--font-display)]">
            THREAT LEVEL: CRITICAL
          </span>
        </div>

        {/* System Status */}
        <div className="flex items-center gap-4">
          <StatusPill
            icon={Wifi}
            label="Crawlers"
            value="6/7"
            color="green"
          />
          <StatusPill
            icon={Shield}
            label="Tor"
            value="Connected"
            color="cyan"
          />
          <StatusPill
            icon={Cpu}
            label="AI Engine"
            value="Active"
            color="purple"
          />
        </div>

        {/* Notification Bell */}
        <button className="relative p-2 rounded-lg hover:bg-white/[0.04] transition-colors">
          <Bell className="w-4 h-4 text-text-secondary" strokeWidth={1.5} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-glow rounded-full">
            <span className="absolute inset-0 bg-red-glow rounded-full animate-ping opacity-75" />
          </span>
        </button>
      </div>
    </motion.header>
  );
}

function StatusPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<LucideProps>;
  label: string;
  value: string;
  color: "green" | "cyan" | "purple";
}) {
  const colors = {
    green: "text-green-glow",
    cyan: "text-cyan-glow",
    purple: "text-purple-glow",
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`status-dot ${color === "green" ? "active" : color === "cyan" ? "active" : "active"}`}
           style={{ background: color === "green" ? "#22c55e" : color === "cyan" ? "#00f0ff" : "#a855f7" }} />
      <div className="text-[10px] leading-tight">
        <span className="text-text-tertiary">{label}</span>
        <br />
        <span className={`font-medium ${colors[color]}`}>{value}</span>
      </div>
    </div>
  );
}
