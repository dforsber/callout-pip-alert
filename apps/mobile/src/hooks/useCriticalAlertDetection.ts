// Hook for detecting new critical incidents and triggering alerts

import { useEffect, useRef, useCallback } from "react";

// Minimal incident interface for detection - compatible with full Incident types
interface DetectableIncident {
  incident_id: string;
  severity: "critical" | "warning" | "info";
  state: "triggered" | "acked" | "resolved";
}

interface UseCriticalAlertDetectionOptions<T extends DetectableIncident> {
  onNewCritical: (incident: T) => void;
  enabled?: boolean;
}

export function useCriticalAlertDetection<T extends DetectableIncident>(
  incidents: T[] | undefined,
  options: UseCriticalAlertDetectionOptions<T>
): void {
  const { onNewCritical, enabled = true } = options;

  // Track seen critical incident IDs
  const seenCriticalIdsRef = useRef<Set<string>>(new Set());
  // Track if this is the initial load (don't alert on first load)
  const isInitialLoadRef = useRef(true);

  const stableOnNewCritical = useCallback(onNewCritical, [onNewCritical]);

  useEffect(() => {
    if (!enabled || !incidents) return;

    // Get current critical triggered incidents
    const currentCritical = incidents.filter(
      (i) => i.severity === "critical" && i.state === "triggered"
    );

    // On initial load, just populate the seen set without alerting
    if (isInitialLoadRef.current) {
      currentCritical.forEach((incident) => {
        seenCriticalIdsRef.current.add(incident.incident_id);
      });
      isInitialLoadRef.current = false;
      return;
    }

    // Check for NEW critical incidents
    currentCritical.forEach((incident) => {
      if (!seenCriticalIdsRef.current.has(incident.incident_id)) {
        seenCriticalIdsRef.current.add(incident.incident_id);
        stableOnNewCritical(incident);
      }
    });

    // Clean up resolved/acked incidents from seen set to prevent memory growth
    // (but keep them if they're still in the list, even if acked)
    const currentIds = new Set(incidents.map((i) => i.incident_id));
    seenCriticalIdsRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        seenCriticalIdsRef.current.delete(id);
      }
    });
  }, [incidents, enabled, stableOnNewCritical]);
}

// Reset the detection state (useful when changing backends or logging out)
export function resetCriticalAlertDetection(): void {
  // This would need to be called from outside the hook
  // For now, the hook handles cleanup internally
}
