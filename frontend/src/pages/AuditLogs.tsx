import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import {
  Loader2, ScrollText, Search, Filter, Clock,
  User, Activity, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Action color map ────────────────────────────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
  CREATE: "text-emerald-400 bg-emerald-400/10",
  UPDATE: "text-blue-400 bg-blue-400/10",
  DELETE: "text-destructive bg-destructive/10",
  CONFIRM: "text-purple-400 bg-purple-400/10",
  GENERATE: "text-amber-400 bg-amber-400/10",
  APPROVE: "text-cyan-400 bg-cyan-400/10",
  DEFAULT: "text-muted-foreground bg-muted",
};

function getActionStyle(action: string) {
  for (const [key, style] of Object.entries(ACTION_COLORS)) {
    if (action.toUpperCase().includes(key)) return style;
  }
  return ACTION_COLORS.DEFAULT;
}

const AuditLogs = () => {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page, search, entityFilter],
    queryFn: () =>
      auditApi.list({
        page,
        limit,
        search: search || undefined,
        status: entityFilter || undefined, // reusing the status field for entityType filter
      }),
  });

  const logs = (data?.data ?? []) as Array<Record<string, unknown>>;
  const totalPages = data?.meta?.totalPages ?? 1;

  // Extract unique entity types for filter
  const entityTypes = [...new Set(logs.map(l => l.entityType as string).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ScrollText className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Audit Logs</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          {data?.meta?.total ?? 0} total entries
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by action name..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="pl-9 pr-8 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors appearance-none min-w-[180px]"
          >
            <option value="">All Entities</option>
            {entityTypes.map(et => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs list */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No audit logs found
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => {
              const isExpanded = expandedId === (log.id as string);
              const actor = log.actor as Record<string, unknown> | undefined;
              const metadata = log.metadata as Record<string, unknown> | null;
              const actionStyle = getActionStyle(log.action as string);
              return (
                <div
                  key={log.id as string}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : (log.id as string))}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    {/* Action badge */}
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-medium ${actionStyle}`}>
                      {(log.action as string)}
                    </span>

                    {/* Entity */}
                    <span className="text-sm text-foreground min-w-0 truncate">
                      <span className="text-muted-foreground">{(log.entityType as string)}:</span>{" "}
                      <span className="font-mono text-xs">{((log.entityId as string) ?? "").slice(0, 12)}…</span>
                    </span>

                    {/* Actor */}
                    <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <User className="w-3 h-3" />
                      {actor?.fullName as string ?? "System"}
                    </span>

                    {/* Time */}
                    <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="w-3 h-3" />
                      {log.createdAt ? new Date(log.createdAt as string).toLocaleString() : "—"}
                    </span>

                    {/* Expand icon */}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {/* Expanded metadata */}
                  {isExpanded && metadata && (
                    <div className="px-4 pb-3">
                      <div className="bg-muted/30 rounded-lg p-3 ml-6">
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <Activity className="w-3 h-3" /> Metadata
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                          {Object.entries(metadata).map(([key, val]) => (
                            <div key={key} className="flex items-baseline gap-2 text-xs">
                              <span className="text-muted-foreground font-medium">{key}:</span>
                              <span className="text-foreground truncate">{String(val ?? "—")}</span>
                            </div>
                          ))}
                        </div>
                        {actor?.role && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Role: <span className="text-foreground">{actor.role as string}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted/30 disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted/30 disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
