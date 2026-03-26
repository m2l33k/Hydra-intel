import type { CollectorStatus, ToolDefinition } from "@/lib/collectors-api";

const toolStatusColor: Record<string, string> = {
  available: "#22c55e",
  degraded: "#f59e0b",
  error: "#ff3b5c",
  unavailable: "#64748b",
  auth_required: "#a855f7",
  unknown: "#64748b",
  rate_limited: "#f97316",
};

function getInstallCommands(tool: ToolDefinition): string[] {
  const commands = (tool.install_commands || []).map((cmd) => cmd.trim()).filter(Boolean);
  if (commands.length > 0) {
    return commands;
  }
  if (tool.python_package) {
    return [`pip install ${tool.python_package}`];
  }
  if (tool.cli_command) {
    return [`Install ${tool.cli_command} and ensure it is in PATH`];
  }
  return ["No install command metadata available"];
}

function getEnvVars(tool: ToolDefinition): string[] {
  return Array.from(new Set((tool.auth_env_vars || []).map((name) => name.trim()).filter(Boolean)));
}

export default function ToolInstallChecklistSidebar({
  collectors,
  toolsBySource,
}: {
  collectors: CollectorStatus[];
  toolsBySource: Record<string, ToolDefinition[]>;
}) {
  const sourceEntries = collectors
    .map((collector) => ({
      source: collector.source,
      name: collector.name,
      tools: toolsBySource[collector.source] || [],
    }))
    .filter((entry) => entry.tools.length > 0);

  const totalTools = sourceEntries.reduce((sum, entry) => sum + entry.tools.length, 0);
  const totalAuthRequired = sourceEntries.reduce(
    (sum, entry) => sum + entry.tools.filter((tool) => tool.requires_auth || (tool.auth_env_vars || []).length > 0).length,
    0,
  );

  return (
    <aside className="xl:sticky xl:top-6 space-y-4">
      <div className="glass-card p-4">
        <p className="text-xs text-text-primary">Tool Install Checklist</p>
        <p className="text-[10px] text-text-tertiary mt-0.5">
          {totalTools} tools total, {totalAuthRequired} requiring environment configuration
        </p>
      </div>

      <div className="glass-card p-4 max-h-[calc(100vh-11rem)] overflow-y-auto custom-scroll space-y-4">
        {sourceEntries.length === 0 ? (
          <p className="text-[10px] text-text-tertiary">No tool metadata loaded yet.</p>
        ) : (
          sourceEntries.map((entry) => (
            <div key={entry.source} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-text-primary">{entry.name}</p>
                <span className="text-[9px] text-text-tertiary">{entry.tools.length} tools</span>
              </div>

              {entry.tools.map((tool) => {
                const installCommands = getInstallCommands(tool);
                const envVars = getEnvVars(tool);

                return (
                  <div key={`${entry.source}-${tool.name}`} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-text-primary break-all">{tool.name}</p>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded border"
                        style={{
                          color: toolStatusColor[tool.status] || "#64748b",
                          borderColor: `${toolStatusColor[tool.status] || "#64748b"}55`,
                        }}
                      >
                        {tool.status}
                      </span>
                    </div>

                    <div>
                      <p className="text-[10px] text-text-secondary">Install</p>
                      <div className="space-y-1 mt-1">
                        {installCommands.map((command, idx) => (
                          <code key={`${tool.name}-install-${idx}`} className="block text-[10px] text-amber-glow break-all">
                            {idx + 1}. {command}
                          </code>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-text-secondary">Environment</p>
                      <div className="space-y-1 mt-1">
                        {envVars.length === 0 ? (
                          <p className="text-[10px] text-text-tertiary">No env vars required</p>
                        ) : (
                          envVars.map((envVar) => (
                            <code key={`${tool.name}-${envVar}`} className="block text-[10px] text-cyan-glow break-all">
                              {envVar}=your_value
                            </code>
                          ))
                        )}
                        {tool.auth_description && <p className="text-[10px] text-text-tertiary break-words">{tool.auth_description}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}