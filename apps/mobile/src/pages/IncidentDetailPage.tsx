import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { incidentsApi } from "../lib/api";

interface TimelineEntry {
  timestamp: number;
  event: string;
  actor: string;
  note?: string;
}

interface Incident {
  incident_id: string;
  alarm_name: string;
  alarm_arn: string;
  state: "triggered" | "acked" | "resolved";
  severity: "critical" | "warning" | "info";
  assigned_to: string;
  triggered_at: number;
  acked_at?: number;
  resolved_at?: number;
  timeline: TimelineEntry[];
}

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["incident", id],
    queryFn: () => incidentsApi.get(id!),
    enabled: !!id,
  });

  const ackMutation = useMutation({
    mutationFn: () => incidentsApi.ack(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incident", id] });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () => incidentsApi.resolve(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incident", id] });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
  });

  const incident: Incident | undefined = data?.incident;

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">Loading...</div>
    );
  }

  if (!incident) {
    return (
      <div className="p-4 text-center text-gray-500">Incident not found</div>
    );
  }

  const severityColors = {
    critical: "bg-red-100 text-red-800",
    warning: "bg-yellow-100 text-yellow-800",
    info: "bg-blue-100 text-blue-800",
  };

  return (
    <div className="p-4">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="text-blue-600 mb-4 flex items-center gap-1"
      >
        ← Back
      </button>

      {/* Header */}
      <div className="mb-6">
        <span
          className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${severityColors[incident.severity]}`}
        >
          {incident.severity.toUpperCase()}
        </span>
        <h1 className="text-xl font-bold">{incident.alarm_name}</h1>
        <p className="text-sm text-gray-500 mt-1 break-all">{incident.alarm_arn}</p>
      </div>

      {/* Status and actions */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-600">Status</span>
          <span className="font-medium capitalize">{incident.state}</span>
        </div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-600">Assigned to</span>
          <span className="font-medium">{incident.assigned_to || "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Triggered</span>
          <span className="font-medium">
            {new Date(incident.triggered_at).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        {incident.state === "triggered" && (
          <button
            onClick={() => ackMutation.mutate()}
            disabled={ackMutation.isPending}
            className="flex-1 py-3 bg-yellow-500 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {ackMutation.isPending ? "..." : "Acknowledge"}
          </button>
        )}
        {incident.state !== "resolved" && (
          <button
            onClick={() => resolveMutation.mutate()}
            disabled={resolveMutation.isPending}
            className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {resolveMutation.isPending ? "..." : "Resolve"}
          </button>
        )}
      </div>

      {/* Timeline */}
      <div>
        <h2 className="font-medium mb-3">Timeline</h2>
        <div className="space-y-3">
          {incident.timeline?.map((entry, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5" />
              <div>
                <p className="font-medium capitalize">{entry.event}</p>
                <p className="text-gray-500">
                  {new Date(entry.timestamp).toLocaleString()} · {entry.actor}
                </p>
                {entry.note && (
                  <p className="text-gray-600 mt-1">{entry.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
