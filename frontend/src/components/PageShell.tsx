"use client";

import { motion } from "framer-motion";
import { type LucideProps } from "lucide-react";

export default function PageShell({
  icon: Icon,
  title,
  subtitle,
  children,
  actions,
}: {
  icon: React.ComponentType<LucideProps>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-glow/[0.08] border border-cyan-glow/20">
            <Icon className="w-4 h-4 text-cyan-glow" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.1em] text-text-primary font-[family-name:var(--font-display)]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[10px] text-text-tertiary mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Page Content */}
      <div className="flex-1 overflow-y-auto custom-scroll p-6">
        {children}
      </div>
    </motion.div>
  );
}

/* Reusable stat card */
export function StatCard({
  label,
  value,
  change,
  changeType = "up",
  color = "#00f0ff",
}: {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "up" | "down" | "neutral";
  color?: string;
}) {
  const changeColor =
    changeType === "up" ? "text-red-glow" : changeType === "down" ? "text-green-glow" : "text-text-tertiary";

  return (
    <div className="glass-card p-4">
      <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold font-[family-name:var(--font-display)]" style={{ color }}>
        {value}
      </p>
      {change && (
        <p className={`text-[10px] mt-1 ${changeColor}`}>{change}</p>
      )}
    </div>
  );
}

/* Reusable filter button */
export function FilterButton({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[10px] rounded-lg tracking-wider uppercase transition-all border ${
        active
          ? "bg-cyan-glow/10 text-cyan-glow border-cyan-glow/20"
          : "text-text-tertiary border-transparent hover:bg-white/[0.03] hover:text-text-secondary"
      }`}
      style={active && color ? { background: `${color}15`, color, borderColor: `${color}30` } : undefined}
    >
      {label}
    </button>
  );
}
