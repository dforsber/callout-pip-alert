import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { incidentsApi } from "../lib/api";

type IncidentState = "triggered" | "acked" | "resolved";
type Severity = "critical" | "warning" | "info";

interface Incident {
  incident_id: string;
  alarm_name: string;
  state: IncidentState;
  severity: Severity;
  triggered_at: number;
  team_id: string;
  aws_account_id?: string;
}

const severityOrder: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const severityConfig: Record<Severity, { dot: string; text: string; bg: string; border: string }> = {
  critical: {
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-l-red-500",
  },
  warning: {
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-l-amber-500",
  },
  info: {
    dot: "bg-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-l-blue-500",
  },
};

const stateConfig: Record<IncidentState, { label: string; bg: string }> = {
  triggered: { label: "Triggered", bg: "bg-red-100 text-red-800" },
  acked: { label: "Acknowledged", bg: "bg-amber-100 text-amber-800" },
  resolved: { label: "Resolved", bg: "bg-green-100 text-green-800" },
};

function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function IncidentsPage() {
  const [filter, setFilter] = useState<IncidentState | "all">("all");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["incidents", filter],
    queryFn: () => incidentsApi.list(filter !== "all" ? { state: filter } : undefined),
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => incidentsApi.ack(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["incidents"] }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => incidentsApi.resolve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["incidents"] }),
  });

  // Sort: severity first (critical > warning > info), then by time (newest first)
  const incidents = useMemo(() => {
    const items: Incident[] = data?.incidents || [];
    return [...items].sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.triggered_at - a.triggered_at;
    });
  }, [data?.incidents]);

  const triggeredCount = incidents.filter((i) => i.state === "triggered").length;

  return (
    <div className="min-h-full bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold text-gray-900">Incidents</h1>
          {triggeredCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {triggeredCount} active
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["all", "triggered", "acked", "resolved"] as const).map((state) => (
            <button
              key={state}
              onClick={() => setFilter(state)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === state
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {state === "all" ? "All" : stateConfig[state].label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center text-gray-500 py-8">Loading...</div>
      )}

      {/* Incident list */}
      <div className="p-3 space-y-2">
        <AnimatePresence>
          {incidents.map((incident) => {
            const config = severityConfig[incident.severity];
            const state = stateConfig[incident.state];

            return (
              <motion.div
                key={incident.incident_id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                drag="x"
                dragConstraints={{ left: -100, right: 100 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -50 && incident.state === "triggered") {
                    ackMutation.mutate(incident.incident_id);
                  } else if (info.offset.x > 50 && incident.state !== "resolved") {
                    resolveMutation.mutate(incident.incident_id);
                  }
                }}
                onClick={() => navigate(`/incidents/${incident.incident_id}`)}
                className={`bg-white rounded-lg shadow-sm border-l-4 ${config.border} cursor-pointer active:bg-gray-50`}
              >
                <div className="p-3">
                  {/* Top row: severity indicator + time */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                      <span className={`text-xs font-medium uppercase tracking-wide ${config.text}`}>
                        {incident.severity}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {relativeTime(incident.triggered_at)}
                    </span>
                  </div>

                  {/* Alarm name */}
                  <h3 className="font-medium text-gray-900 mb-2 leading-snug">
                    {incident.alarm_name}
                  </h3>

                  {/* Bottom row: state badge */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${state.bg}`}>
                      {state.label}
                    </span>
                    {incident.aws_account_id && (
                      <span className="text-xs text-gray-400">
                        {incident.aws_account_id}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {incidents.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-4xl mb-2">✓</div>
          <p className="text-gray-500">No incidents</p>
        </div>
      )}

      {/* Swipe hint */}
      {incidents.length > 0 && (
        <p className="text-xs text-gray-400 text-center py-4">
          ← Acknowledge · Resolve →
        </p>
      )}
    </div>
  );
}
