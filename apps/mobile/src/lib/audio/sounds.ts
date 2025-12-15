// Pip-Boy themed sound definitions

import { AudioEngine } from "./audioEngine";
import {
  PIPBOY_FREQUENCIES,
  ENVELOPES,
  playTone,
  playFrequencySweep,
  createOscillator,
  createGain,
  createNoiseBuffer,
  createBandpassFilter,
} from "./synthesizer";

// ============================================================
// UI SOUNDS
// ============================================================

export function playTabClick(engine: AudioEngine, volume: number = 0.6): void {
  const ctx = engine.getContext();
  const master = engine.getMasterGain();
  if (!ctx || !master) return;

  playTone(ctx, master, PIPBOY_FREQUENCIES.terminalClick, 0.03, "square", ENVELOPES.sharpClick, volume);
}

export function playButtonClick(engine: AudioEngine, volume: number = 0.5): void {
  const ctx = engine.getContext();
  const master = engine.getMasterGain();
  if (!ctx || !master) return;

  playTone(ctx, master, PIPBOY_FREQUENCIES.buttonClick, 0.02, "square", ENVELOPES.sharpClick, volume);
}

export function playToggleOn(engine: AudioEngine, volume: number = 0.5): void {
  const ctx = engine.getContext();
  const master = engine.getMasterGain();
  if (!ctx || !master) return;

  // Rising sweep indicates activation
  playFrequencySweep(ctx, master, 800, 1200, 0.08, "square", volume);
}

export function playToggleOff(engine: AudioEngine, volume: number = 0.5): void {
  const ctx = engine.getContext();
  const master = engine.getMasterGain();
  if (!ctx || !master) return;

  // Falling sweep indicates deactivation
  playFrequencySweep(ctx, master, 1200, 600, 0.08, "square", volume);
}

export function playSuccess(engine: AudioEngine, volume: number = 0.5): void {
  const ctx = engine.getContext();
  const master = engine.getMasterGain();
  if (!ctx || !master) return;

  // Two-tone ascending (musical fifth)
  // First tone
  playTone(ctx, master, PIPBOY_FREQUENCIES.noteA5, 0.08, "triangle", ENVELOPES.softChime, volume);

  // Second tone (delayed)
  setTimeout(() => {
    playTone(ctx, master, PIPBOY_FREQUENCIES.noteE6, 0.1, "triangle", ENVELOPES.softChime, volume);
  }, 70);
}

export function playError(engine: AudioEngine, volume: number = 0.6): void {
  const ctx = engine.getContext();
  const master = engine.getMasterGain();
  if (!ctx || !master) return;

  // Low buzzer
  playTone(ctx, master, 220, 0.2, "square", ENVELOPES.alarmSustain, volume);
}

// ============================================================
// BOOT SEQUENCE SOUNDS
// ============================================================

export function playTerminalBeep(engine: AudioEngine, volume: number = 0.3): void {
  const ctx = engine.getContext();
  const master = engine.getMasterGain();
  if (!ctx || !master) return;

  // Random duration for organic feel
  const duration = 0.008 + Math.random() * 0.007;
  playTone(ctx, master, PIPBOY_FREQUENCIES.terminalBeep, duration, "square", ENVELOPES.terminalBeep, volume);
}

export function playLineComplete(engine: AudioEngine, volume: number = 0.35): void {
  const ctx = engine.getContext();
  const master = engine.getMasterGain();
  if (!ctx || !master) return;

  playTone(ctx, master, PIPBOY_FREQUENCIES.lineComplete, 0.025, "square", ENVELOPES.terminalBeep, volume);
}

export function playSystemReady(engine: AudioEngine, volume: number = 0.5): void {
  const ctx = engine.getContext();
  const master = engine.getMasterGain();
  if (!ctx || !master) return;

  // Ascending three-tone fanfare
  const tones = [
    { freq: PIPBOY_FREQUENCIES.noteA4, delay: 0 },
    { freq: PIPBOY_FREQUENCIES.noteC5, delay: 100 },
    { freq: PIPBOY_FREQUENCIES.noteA5, delay: 200 },
  ];

  tones.forEach(({ freq, delay }) => {
    setTimeout(() => {
      playTone(ctx, master, freq, 0.15, "triangle", ENVELOPES.softChime, volume);
    }, delay);
  });
}

// ============================================================
// ALERT SOUNDS
// ============================================================

export interface AlertController {
  stop: () => void;
}

export function playRadiationAlarm(engine: AudioEngine, volume: number = 0.8): AlertController {
  const ctx = engine.getContext();
  const master = engine.getMasterGain();

  if (!ctx || !master) {
    return { stop: () => {} };
  }

  const now = ctx.currentTime;

  // Main oscillator (carrier) - warbling alarm
  const carrier = createOscillator(ctx, "square", PIPBOY_FREQUENCIES.alarmBase);

  // Modulator for AM (amplitude modulation) - creates warble at 8Hz
  const modulator = createOscillator(ctx, "sine", 8);
  const modGain = createGain(ctx, 0.3); // 30% modulation depth

  // Output gain with volume
  const outputGain = createGain(ctx, volume * 0.7);

  // Slight frequency wobble for more organic feel
  carrier.frequency.setValueAtTime(PIPBOY_FREQUENCIES.alarmBase, now);
  carrier.frequency.linearRampToValueAtTime(PIPBOY_FREQUENCIES.alarmBase * 1.02, now + 0.5);
  carrier.frequency.linearRampToValueAtTime(PIPBOY_FREQUENCIES.alarmBase * 0.98, now + 1);
  carrier.frequency.linearRampToValueAtTime(PIPBOY_FREQUENCIES.alarmBase, now + 1.5);

  // Connect modulation
  modulator.connect(modGain);
  modGain.connect(outputGain.gain);

  // Connect carrier through output to master
  carrier.connect(outputGain);
  outputGain.connect(master);

  // Start
  carrier.start(now);
  modulator.start(now);

  // Auto-stop after 2 seconds
  const stopTime = now + 2;
  carrier.stop(stopTime);
  modulator.stop(stopTime);

  let stopped = false;

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;

      const currentTime = ctx.currentTime;
      outputGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.1);

      setTimeout(() => {
        try {
          carrier.stop();
          modulator.stop();
        } catch {
          // Already stopped
        }
      }, 150);
    },
  };
}

export function playWarningTone(engine: AudioEngine, volume: number = 0.6): void {
  const ctx = engine.getContext();
  const master = engine.getMasterGain();
  if (!ctx || !master) return;

  // Two short pulses
  playTone(ctx, master, PIPBOY_FREQUENCIES.warningTone, 0.15, "square", ENVELOPES.alarmSustain, volume);

  setTimeout(() => {
    playTone(ctx, master, PIPBOY_FREQUENCIES.warningTone, 0.15, "square", ENVELOPES.alarmSustain, volume);
  }, 250);
}

export function playInfoChime(engine: AudioEngine, volume: number = 0.4): void {
  const ctx = engine.getContext();
  const master = engine.getMasterGain();
  if (!ctx || !master) return;

  // Soft single chime
  playTone(ctx, master, PIPBOY_FREQUENCIES.infoChime, 0.2, "triangle", ENVELOPES.softChime, volume);
}

// ============================================================
// AMBIENT SOUNDS
// ============================================================

export interface AmbientController {
  start: () => void;
  stop: () => void;
  setIntensity: (level: number) => void;
}

export function createGeigerAmbient(engine: AudioEngine, baseVolume: number = 0.15): AmbientController {
  let running = false;
  let intensity = 0.5;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const scheduleClick = () => {
    if (!running) return;

    const ctx = engine.getContext();
    const master = engine.getMasterGain();
    if (!ctx || !master) return;

    // Random Geiger click
    const buffer = createNoiseBuffer(ctx, 0.005);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = createBandpassFilter(ctx, PIPBOY_FREQUENCIES.geigerClick, 10);
    const gain = createGain(ctx, baseVolume * intensity);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    source.start();

    // Schedule next click (random interval based on intensity)
    const minInterval = 2000 * (1 - intensity * 0.5);
    const maxInterval = 8000 * (1 - intensity * 0.5);
    const nextInterval = minInterval + Math.random() * (maxInterval - minInterval);
    timeoutId = setTimeout(scheduleClick, nextInterval);
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      scheduleClick();
    },
    stop: () => {
      running = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    setIntensity: (level: number) => {
      intensity = Math.max(0, Math.min(1, level));
    },
  };
}

export function createElectricalHum(engine: AudioEngine, baseVolume: number = 0.05): AmbientController {
  let running = false;
  let oscillator: OscillatorNode | null = null;
  let gainNode: GainNode | null = null;

  return {
    start: () => {
      if (running) return;

      const ctx = engine.getContext();
      const master = engine.getMasterGain();
      if (!ctx || !master) return;

      running = true;

      // 60Hz power hum with harmonics
      oscillator = createOscillator(ctx, "sawtooth", PIPBOY_FREQUENCIES.powerHum);
      gainNode = createGain(ctx, baseVolume);

      // Heavy lowpass filter to make it subtle
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(120, ctx.currentTime);

      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);

      oscillator.start();
    },
    stop: () => {
      if (!running) return;
      running = false;

      const ctx = engine.getContext();
      if (gainNode && ctx) {
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      }

      setTimeout(() => {
        try {
          oscillator?.stop();
        } catch {
          // Already stopped
        }
        oscillator = null;
        gainNode = null;
      }, 150);
    },
    setIntensity: (level: number) => {
      if (gainNode) {
        const ctx = engine.getContext();
        if (ctx) {
          gainNode.gain.setValueAtTime(baseVolume * level, ctx.currentTime);
        }
      }
    },
  };
}
