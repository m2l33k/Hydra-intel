"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Key,
  Bell,
  Shield,
  Database,
  Palette,
  Globe,
  Save,
  Eye,
  EyeOff,
  RefreshCcw,
  Cpu,
  type LucideProps,
} from "lucide-react";
import PageShell from "@/components/PageShell";

interface SettingSection {
  id: string;
  icon: React.ComponentType<LucideProps>;
  label: string;
  color: string;
}

const sections: SettingSection[] = [
  { id: "api-keys", icon: Key, label: "API Keys", color: "#f59e0b" },
  { id: "notifications", icon: Bell, label: "Notifications", color: "#a855f7" },
  { id: "collectors", icon: Globe, label: "Collectors", color: "#00f0ff" },
  { id: "ai-engine", icon: Cpu, label: "AI Engine", color: "#ff3b5c" },
  { id: "database", icon: Database, label: "Database", color: "#22c55e" },
  { id: "security", icon: Shield, label: "Security", color: "#f97316" },
  { id: "appearance", icon: Palette, label: "Appearance", color: "#a855f7" },
];

function SettingToggle({ label, description, enabled, onChange }: { label: string; description: string; enabled: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
      <div>
        <p className="text-xs text-text-primary">{label}</p>
        <p className="text-[10px] text-text-tertiary mt-0.5">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? "bg-cyan-glow/30" : "bg-white/10"}`}
      >
        <motion.div
          animate={{ x: enabled ? 20 : 2 }}
          className={`absolute top-0.5 w-4 h-4 rounded-full ${enabled ? "bg-cyan-glow" : "bg-text-tertiary"}`}
        />
      </button>
    </div>
  );
}

function ApiKeyInput({ label, value, placeholder }: { label: string; value: string; placeholder: string }) {
  const [visible, setVisible] = useState(false);
  const [val, setVal] = useState(value);

  return (
    <div className="py-3 border-b border-white/[0.04] last:border-0">
      <label className="text-xs text-text-primary block mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          className="w-full h-9 px-3 pr-10 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-cyan-glow/30 font-mono"
        />
        <button onClick={() => setVisible(!visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary">
          {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("api-keys");
  const [settings, setSettings] = useState({
    emailAlerts: true,
    slackAlerts: false,
    criticalOnly: false,
    autoEnrich: true,
    torEnabled: true,
    proxyRotation: true,
    rateLimit: true,
    aiAnalysis: true,
    autoReport: false,
    darkTheme: true,
    compactMode: false,
    animations: true,
  });

  const toggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <PageShell
      icon={Settings}
      title="SETTINGS"
      subtitle="Platform configuration and preferences"
      actions={
        <button className="flex items-center gap-2 px-4 py-2 text-[10px] text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 rounded-lg hover:bg-cyan-glow/15">
          <Save className="w-3 h-3" /> Save Changes
        </button>
      }
    >
      <div className="grid grid-cols-4 gap-6">
        {/* Left Nav */}
        <div className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-all ${
                  isActive ? "bg-white/[0.04] border border-white/[0.08]" : "hover:bg-white/[0.02] border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4" style={{ color: isActive ? section.color : "#475569" }} strokeWidth={1.5} />
                <span className={`text-xs ${isActive ? "text-text-primary" : "text-text-secondary"}`}>{section.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Content */}
        <div className="col-span-3">
          <motion.div key={activeSection} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
            {activeSection === "api-keys" && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1 font-[family-name:var(--font-display)]">API Keys</h3>
                <p className="text-[10px] text-text-tertiary mb-4">Configure authentication for external data sources</p>
                <ApiKeyInput label="GitHub Token" value="ghp_xxxx••••••••xxxx" placeholder="ghp_..." />
                <ApiKeyInput label="Shodan API Key" value="" placeholder="Enter Shodan API key" />
                <ApiKeyInput label="VirusTotal API Key" value="vt_xxxx••••••••xxxx" placeholder="Enter VT API key" />
                <ApiKeyInput label="Reddit Client ID" value="" placeholder="Enter Reddit client ID" />
                <ApiKeyInput label="Reddit Client Secret" value="" placeholder="Enter Reddit client secret" />
                <ApiKeyInput label="OpenAI API Key (AI Engine)" value="sk-xxxx••••••••xxxx" placeholder="sk-..." />
              </div>
            )}

            {activeSection === "notifications" && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1 font-[family-name:var(--font-display)]">Notifications</h3>
                <p className="text-[10px] text-text-tertiary mb-4">Alert delivery configuration</p>
                <SettingToggle label="Email Alerts" description="Send critical alerts to admin@hydra-intel.io" enabled={settings.emailAlerts} onChange={() => toggle("emailAlerts")} />
                <SettingToggle label="Slack Integration" description="Post alerts to #threat-intel channel" enabled={settings.slackAlerts} onChange={() => toggle("slackAlerts")} />
                <SettingToggle label="Critical Only" description="Only send notifications for critical severity" enabled={settings.criticalOnly} onChange={() => toggle("criticalOnly")} />
                <SettingToggle label="Auto-Generated Reports" description="Generate weekly reports automatically" enabled={settings.autoReport} onChange={() => toggle("autoReport")} />
              </div>
            )}

            {activeSection === "collectors" && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1 font-[family-name:var(--font-display)]">Collector Settings</h3>
                <p className="text-[10px] text-text-tertiary mb-4">Configure intelligence collection behavior</p>
                <SettingToggle label="Tor Network" description="Route dark web requests through Tor" enabled={settings.torEnabled} onChange={() => toggle("torEnabled")} />
                <SettingToggle label="Proxy Rotation" description="Rotate IP addresses for web crawling" enabled={settings.proxyRotation} onChange={() => toggle("proxyRotation")} />
                <SettingToggle label="Rate Limiting" description="Respect API rate limits (recommended)" enabled={settings.rateLimit} onChange={() => toggle("rateLimit")} />
                <SettingToggle label="Auto-Enrich IOCs" description="Automatically enrich new IOCs with external data" enabled={settings.autoEnrich} onChange={() => toggle("autoEnrich")} />

                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <label className="text-xs text-text-primary block mb-2">Collection Interval</label>
                  <div className="flex gap-2">
                    {["1m", "5m", "15m", "30m", "1h"].map((interval) => (
                      <button
                        key={interval}
                        className={`px-3 py-1.5 text-[10px] rounded border transition-all ${
                          interval === "5m"
                            ? "bg-cyan-glow/10 text-cyan-glow border-cyan-glow/20"
                            : "text-text-tertiary border-white/[0.06] hover:bg-white/[0.03]"
                        }`}
                      >
                        {interval}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <label className="text-xs text-text-primary block mb-2">Max Results Per Collector</label>
                  <input
                    type="number"
                    defaultValue={50}
                    className="w-32 h-9 px-3 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-text-primary outline-none focus:border-cyan-glow/30"
                  />
                </div>
              </div>
            )}

            {activeSection === "ai-engine" && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1 font-[family-name:var(--font-display)]">AI Engine</h3>
                <p className="text-[10px] text-text-tertiary mb-4">Configure AI-powered threat analysis</p>
                <SettingToggle label="AI Analysis" description="Enable automatic threat correlation and analysis" enabled={settings.aiAnalysis} onChange={() => toggle("aiAnalysis")} />

                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <label className="text-xs text-text-primary block mb-2">Model</label>
                  <div className="flex gap-2">
                    {["Claude Opus", "Claude Sonnet", "GPT-4o"].map((model) => (
                      <button
                        key={model}
                        className={`px-3 py-1.5 text-[10px] rounded border transition-all ${
                          model === "Claude Opus"
                            ? "bg-purple-glow/10 text-purple-glow border-purple-glow/20"
                            : "text-text-tertiary border-white/[0.06] hover:bg-white/[0.03]"
                        }`}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <label className="text-xs text-text-primary block mb-2">Analysis Threshold</label>
                  <p className="text-[10px] text-text-tertiary mb-2">Only analyze threats above this severity</p>
                  <div className="flex gap-2">
                    {["Low", "Medium", "High", "Critical"].map((level) => (
                      <button
                        key={level}
                        className={`px-3 py-1.5 text-[10px] rounded border transition-all ${
                          level === "Medium"
                            ? "bg-amber-glow/10 text-amber-glow border-amber-glow/20"
                            : "text-text-tertiary border-white/[0.06] hover:bg-white/[0.03]"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === "database" && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1 font-[family-name:var(--font-display)]">Database</h3>
                <p className="text-[10px] text-text-tertiary mb-4">Storage configuration and maintenance</p>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-[9px] text-text-tertiary uppercase">Engine</p>
                    <p className="text-sm text-text-primary mt-0.5">SQLite</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-[9px] text-text-tertiary uppercase">Records</p>
                    <p className="text-sm text-cyan-glow mt-0.5 font-[family-name:var(--font-display)]">84,291</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-[9px] text-text-tertiary uppercase">Size</p>
                    <p className="text-sm text-text-primary mt-0.5">142 MB</p>
                  </div>
                </div>
                <button className="flex items-center gap-2 px-3 py-2 text-[10px] text-amber-glow bg-amber-glow/10 border border-amber-glow/20 rounded-lg hover:bg-amber-glow/15">
                  <RefreshCcw className="w-3 h-3" /> Run Deduplication
                </button>
              </div>
            )}

            {activeSection === "security" && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1 font-[family-name:var(--font-display)]">Security</h3>
                <p className="text-[10px] text-text-tertiary mb-4">Access control and session management</p>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] mb-4">
                  <p className="text-[9px] text-text-tertiary uppercase mb-1">Current Session</p>
                  <p className="text-xs text-text-primary">admin@hydra-intel.io</p>
                  <p className="text-[10px] text-text-tertiary mt-0.5">Last login: 2024-03-25 08:14 UTC</p>
                </div>
                <button className="px-3 py-2 text-[10px] text-red-glow bg-red-glow/10 border border-red-glow/20 rounded-lg hover:bg-red-glow/15">
                  Invalidate All Sessions
                </button>
              </div>
            )}

            {activeSection === "appearance" && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1 font-[family-name:var(--font-display)]">Appearance</h3>
                <p className="text-[10px] text-text-tertiary mb-4">Visual preferences</p>
                <SettingToggle label="Dark Theme" description="Use dark color scheme (recommended for SOC)" enabled={settings.darkTheme} onChange={() => toggle("darkTheme")} />
                <SettingToggle label="Compact Mode" description="Reduce spacing for more data density" enabled={settings.compactMode} onChange={() => toggle("compactMode")} />
                <SettingToggle label="Animations" description="Enable UI animations and transitions" enabled={settings.animations} onChange={() => toggle("animations")} />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </PageShell>
  );
}
