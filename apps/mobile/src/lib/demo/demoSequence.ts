// Demo sequence orchestration - creates an escalating alert game

import type { DemoIncident } from "../../hooks/useDemoMode";
import { generateDemoIncident, getRandomTeammate } from "./demoData";

export interface DemoSequenceCallbacks {
  addIncident: (incident: DemoIncident) => void;
  ackIncident: (id: string, actor: string) => void;
  resolveIncident: (id: string) => void;
  playAlert: (severity: "critical" | "warning" | "info") => void;
  onComplete: () => void;
  getIncidents: () => DemoIncident[];
}

interface SequenceState {
  isRunning: boolean;
  timeouts: ReturnType<typeof setTimeout>[];
  intervals: ReturnType<typeof setInterval>[];
  incidentCount: number;
  teammateAckCount: number;
}

let sequenceState: SequenceState = {
  isRunning: false,
  timeouts: [],
  intervals: [],
  incidentCount: 0,
  teammateAckCount: 0,
};

/**
 * Clear all pending timeouts and intervals
 */
function clearAllTimers(): void {
  sequenceState.timeouts.forEach((t) => clearTimeout(t));
  sequenceState.intervals.forEach((i) => clearInterval(i));
  sequenceState.timeouts = [];
  sequenceState.intervals = [];
}

/**
 * Schedule a function to run after a delay
 */
function scheduleAction(fn: () => void, delayMs: number): void {
  const timeout = setTimeout(fn, delayMs);
  sequenceState.timeouts.push(timeout);
}

/**
 * Start the demo sequence - a game where user must ack all incidents to win
 */
export function startDemoSequence(callbacks: DemoSequenceCallbacks): void {
  if (sequenceState.isRunning) {
    console.log("[Demo] Sequence already running");
    return;
  }

  console.log("[Demo] Starting demo game");
  sequenceState.isRunning = true;
  sequenceState.incidentCount = 0;
  sequenceState.teammateAckCount = 0;

  const { addIncident, ackIncident, resolveIncident, playAlert, onComplete, getIncidents } = callbacks;

  // Track created incidents
  const createdIncidents: DemoIncident[] = [];

  // Helper to add incident - adds FIRST, then plays sound
  const addAndTrack = (severity: "critical" | "warning" | "info"): DemoIncident | null => {
    if (!sequenceState.isRunning) return null;
    if (getIncidents().length >= 10) return null;

    const incident = generateDemoIncident(severity, sequenceState.incidentCount++);
    createdIncidents.push(incident);

    // Add incident FIRST
    addIncident(incident);

    // Play sound AFTER (with tiny delay to ensure UI updates first)
    setTimeout(() => {
      if (sequenceState.isRunning) {
        playAlert(severity);
      }
    }, 50);

    return incident;
  };

  // Helper to have teammate ack a random triggered incident
  const teammateAck = (): boolean => {
    if (!sequenceState.isRunning) return false;

    const incidents = getIncidents();
    const triggered = incidents.filter((i) => i.state === "triggered");

    if (triggered.length === 0) return false;

    // Pick a random triggered incident (prefer older ones)
    const incident = triggered[Math.floor(Math.random() * Math.min(3, triggered.length))];
    const teammate = getRandomTeammate();

    ackIncident(incident.incident_id, teammate);
    sequenceState.teammateAckCount++;

    return true;
  };

  // Helper to auto-resolve an acked incident (simulating CloudWatch returning to OK)
  const autoResolve = (): boolean => {
    if (!sequenceState.isRunning) return false;

    const incidents = getIncidents();
    const acked = incidents.filter((i) => i.state === "acked");

    if (acked.length === 0) return false;

    // Resolve oldest acked incident
    const oldest = acked.reduce((a, b) => (a.acked_at || 0) < (b.acked_at || 0) ? a : b);
    resolveIncident(oldest.incident_id);

    return true;
  };

  // Check for win condition
  const checkWinCondition = (): boolean => {
    const incidents = getIncidents();
    const triggered = incidents.filter((i) => i.state === "triggered");
    const acked = incidents.filter((i) => i.state === "acked");

    // Win when: we've had enough incidents AND none are triggered AND none are acked
    if (sequenceState.incidentCount >= 8 && triggered.length === 0 && acked.length === 0) {
      return true;
    }
    return false;
  };

  // === PHASE 1: Initial wave (0-3s) ===
  // Immediate warning
  addAndTrack("warning");

  // More warnings
  scheduleAction(() => addAndTrack("warning"), 1500);
  scheduleAction(() => addAndTrack("warning"), 2500);

  // === PHASE 2: Critical wave (3-6s) ===
  scheduleAction(() => addAndTrack("critical"), 3500);
  scheduleAction(() => addAndTrack("critical"), 4500);
  scheduleAction(() => addAndTrack("critical"), 5500);

  // === PHASE 3: Teammate helps (6-10s) ===
  scheduleAction(() => teammateAck(), 7000);
  scheduleAction(() => teammateAck(), 9000);

  // === PHASE 4: More chaos + auto-resolve (10s+) ===
  scheduleAction(() => {
    addAndTrack(Math.random() < 0.4 ? "critical" : "warning");
  }, 11000);

  scheduleAction(() => autoResolve(), 12000);

  scheduleAction(() => {
    addAndTrack(Math.random() < 0.3 ? "critical" : "warning");
  }, 14000);

  scheduleAction(() => teammateAck(), 15000);
  scheduleAction(() => autoResolve(), 16000);

  // === CONTINUOUS GAME LOOP ===
  // Every 3-5 seconds: maybe add incident, maybe teammate acks, maybe auto-resolve
  const gameLoopInterval = setInterval(() => {
    if (!sequenceState.isRunning) {
      clearInterval(gameLoopInterval);
      return;
    }

    const incidents = getIncidents();
    const triggered = incidents.filter((i) => i.state === "triggered");
    const acked = incidents.filter((i) => i.state === "acked");

    // Check win condition
    if (checkWinCondition()) {
      console.log("[Demo] Player wins!");
      stopDemoSequence();
      onComplete();
      return;
    }

    // Random actions based on game state
    const roll = Math.random();

    // If not many incidents, add more
    if (incidents.length < 6 && roll < 0.4) {
      const severity = Math.random() < 0.3 ? "critical" : (Math.random() < 0.5 ? "warning" : "info");
      addAndTrack(severity);
    }
    // Teammate helps occasionally (but not too much - player needs to work!)
    else if (triggered.length > 3 && roll < 0.5 && sequenceState.teammateAckCount < 5) {
      teammateAck();
    }
    // Auto-resolve acked incidents
    else if (acked.length > 0 && roll < 0.6) {
      // Only auto-resolve if acked for at least 4 seconds
      const oldestAcked = acked.reduce((a, b) => (a.acked_at || 0) < (b.acked_at || 0) ? a : b);
      if (oldestAcked.acked_at && Date.now() - oldestAcked.acked_at > 4000) {
        autoResolve();
      }
    }
    // Add more chaos if player is doing well
    else if (triggered.length < 2 && incidents.length < 8 && roll < 0.7) {
      addAndTrack(Math.random() < 0.5 ? "critical" : "warning");
    }

  }, 3500);

  sequenceState.intervals.push(gameLoopInterval);

  // Timeout: After 60 seconds, if not won, game over
  scheduleAction(() => {
    if (!sequenceState.isRunning) return;

    const incidents = getIncidents();
    const triggered = incidents.filter((i) => i.state === "triggered");

    console.log("[Demo] Time's up!", triggered.length > 0 ? `${triggered.length} remaining` : "All handled");
    stopDemoSequence();
    onComplete();
  }, 60000);
}

/**
 * Stop the demo sequence (doesn't reset data)
 */
export function stopDemoSequence(): void {
  console.log("[Demo] Stopping demo sequence");
  sequenceState.isRunning = false;
  clearAllTimers();
}

/**
 * Check if demo sequence is currently running
 */
export function isDemoSequenceRunning(): boolean {
  return sequenceState.isRunning;
}
