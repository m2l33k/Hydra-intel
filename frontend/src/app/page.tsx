"use client";

import ThreatOverview from "@/components/ThreatOverview";
import ThreatFeed from "@/components/ThreatFeed";
import DarkWebMonitor from "@/components/DarkWebMonitor";
import LeakDetector from "@/components/LeakDetector";
import SourceStatus from "@/components/SourceStatus";
import AIAnalysis from "@/components/AIAnalysis";
import GraphIntel from "@/components/GraphIntel";

export default function Dashboard() {
  return (
    <div className="p-5">
      <div className="grid grid-cols-3 gap-4 auto-rows-min">
        {/* Row 1: Threat Overview (2 cols) + Threat Feed (1 col, spans 2 rows) */}
        <ThreatOverview />
        <ThreatFeed />

        {/* Row 2: Dark Web Monitor + Leak Detector */}
        <DarkWebMonitor />
        <LeakDetector />

        {/* Row 3: Graph Intel + Source Status */}
        <GraphIntel />
        <SourceStatus />

        {/* Row 4: AI Analysis (2 cols) */}
        <AIAnalysis />
      </div>
    </div>
  );
}
