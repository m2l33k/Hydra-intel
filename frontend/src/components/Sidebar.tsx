"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Rss,
  Globe,
  Search,
  ShieldAlert,
  Share2,
  FileBarChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Hexagon,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Rss, label: "Threat Feed", href: "/threat-feed" },
  { icon: Globe, label: "Dark Web Monitor", href: "/dark-web" },
  { icon: Search, label: "OSINT Sources", href: "/osint-sources" },
  { icon: KeyRound, label: "Leaks & Credentials", href: "/leaks" },
  { icon: ShieldAlert, label: "IOC Explorer", href: "/ioc-explorer" },
  { icon: Share2, label: "Graph Intelligence", href: "/graph" },
  { icon: FileBarChart, label: "Reports", href: "/reports" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`relative flex flex-col h-full border-r border-white/[0.06] bg-[#050a18]/80 backdrop-blur-xl transition-all duration-300 shrink-0 ${
        collapsed ? "w-[68px]" : "w-[240px]"
      }`}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors">
        <div className="relative flex items-center justify-center w-9 h-9 shrink-0">
          <Hexagon className="w-9 h-9 text-cyan-glow" strokeWidth={1.5} />
          <span className="absolute text-[10px] font-bold text-cyan-glow font-[family-name:var(--font-display)]">
            H
          </span>
        </div>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
            <h1 className="text-sm font-bold tracking-[0.2em] text-cyan-glow glow-cyan font-[family-name:var(--font-display)]">
              HYDRA
            </h1>
            <p className="text-[9px] tracking-[0.35em] text-text-secondary font-[family-name:var(--font-display)]">
              INTEL
            </p>
          </motion.div>
        )}
      </Link>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scroll">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                isActive
                  ? "bg-cyan-glow/[0.08] text-cyan-glow"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 bg-cyan-glow rounded-r shadow-[0_0_8px_rgba(0,240,255,0.5)]"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <item.icon
                className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                  isActive ? "text-cyan-glow" : "text-text-tertiary group-hover:text-text-secondary"
                }`}
                strokeWidth={1.5}
              />
              {!collapsed && (
                <span className="text-xs tracking-wide truncate">{item.label}</span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-surface-overlay border border-white/10 rounded text-xs text-text-primary whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-white/[0.06] text-text-tertiary hover:text-text-secondary transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {!collapsed && (
        <div className="px-4 py-2 text-[9px] text-text-tertiary tracking-widest font-[family-name:var(--font-display)]">
          v2.4.1 // CLASSIFIED
        </div>
      )}
    </motion.aside>
  );
}
