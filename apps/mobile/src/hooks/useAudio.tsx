// Audio Context Provider and Hook - follows auth.tsx pattern

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  audioEngine,
  playTabClick,
  playButtonClick,
  playToggleOn,
  playToggleOff,
  playSuccess,
  playError,
  playTerminalBeep,
  playLineComplete,
  playSystemReady,
  playRadiationAlarm,
  playWarningTone,
  playInfoChime,
  createGeigerAmbient,
  createElectricalHum,
  type AlertController,
  type AmbientController,
} from "../lib/audio";
import {
  type AudioSettings,
  getAudioSettings,
  saveAudioSettings,
  DEFAULT_AUDIO_SETTINGS,
} from "../lib/audioSettings";

type UISound = "click" | "tab" | "toggle_on" | "toggle_off" | "success" | "error";
type BootSound = "beep" | "line_complete" | "system_ready";
type AlertSeverity = "critical" | "warning" | "info";

interface AudioContextType {
  isInitialized: boolean;
  settings: AudioSettings;

  // Initialization (must be called from user gesture)
  initialize: () => Promise<void>;

  // Settings
  updateSettings: (updates: Partial<AudioSettings>) => void;
  toggleCategory: (category: keyof AudioSettings["categories"]) => void;
  setMasterVolume: (volume: number) => void;

  // Sound playback (no-op if disabled or not initialized)
  playUISound: (sound: UISound) => void;
  playBootSound: (sound: BootSound) => void;
  playAlert: (severity: AlertSeverity) => AlertController | null;

  // Alert control
  stopCurrentAlert: () => void;

  // Ambient control
  startAmbient: () => void;
  stopAmbient: () => void;
  setAmbientIntensity: (intensity: number) => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

interface AudioProviderProps {
  children: ReactNode;
}

export function AudioProvider({ children }: AudioProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);

  // Refs for ambient and alert controllers
  const currentAlertRef = useRef<AlertController | null>(null);
  const geigerAmbientRef = useRef<AmbientController | null>(null);
  const humAmbientRef = useRef<AmbientController | null>(null);

  // Load settings on mount
  useEffect(() => {
    setSettings(getAudioSettings());
  }, []);

  // Update master volume when settings change
  useEffect(() => {
    if (isInitialized && settings.enabled) {
      audioEngine.setMasterVolume(settings.masterVolume);
    }
  }, [isInitialized, settings.enabled, settings.masterVolume]);

  const initialize = useCallback(async () => {
    if (isInitialized) return;

    await audioEngine.initialize();
    if (audioEngine.isInitialized()) {
      audioEngine.setMasterVolume(settings.masterVolume);
      setIsInitialized(true);
    }
  }, [isInitialized, settings.masterVolume]);

  const updateSettings = useCallback((updates: Partial<AudioSettings>) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        ...updates,
        categories: {
          ...prev.categories,
          ...(updates.categories || {}),
        },
      };
      saveAudioSettings(updated);
      return updated;
    });
  }, []);

  const toggleCategory = useCallback((category: keyof AudioSettings["categories"]) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        categories: {
          ...prev.categories,
          [category]: !prev.categories[category],
        },
      };
      saveAudioSettings(updated);
      return updated;
    });
  }, []);

  const setMasterVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    updateSettings({ masterVolume: clampedVolume });
    audioEngine.setMasterVolume(clampedVolume);
  }, [updateSettings]);

  const playUISound = useCallback((sound: UISound) => {
    console.log(`[Audio] playUISound(${sound}): initialized=${isInitialized}, enabled=${settings.enabled}, ui=${settings.categories.ui}`);
    if (!isInitialized || !settings.enabled || !settings.categories.ui) return;

    switch (sound) {
      case "click":
        playButtonClick(audioEngine);
        break;
      case "tab":
        playTabClick(audioEngine);
        break;
      case "toggle_on":
        playToggleOn(audioEngine);
        break;
      case "toggle_off":
        playToggleOff(audioEngine);
        break;
      case "success":
        playSuccess(audioEngine);
        break;
      case "error":
        playError(audioEngine);
        break;
    }
  }, [isInitialized, settings.enabled, settings.categories.ui]);

  const playBootSound = useCallback((sound: BootSound) => {
    if (!isInitialized || !settings.enabled || !settings.categories.boot) return;

    switch (sound) {
      case "beep":
        playTerminalBeep(audioEngine);
        break;
      case "line_complete":
        playLineComplete(audioEngine);
        break;
      case "system_ready":
        playSystemReady(audioEngine);
        break;
    }
  }, [isInitialized, settings.enabled, settings.categories.boot]);

  const playAlertSound = useCallback((severity: AlertSeverity): AlertController | null => {
    if (!isInitialized || !settings.enabled || !settings.categories.alerts) return null;

    // Stop any current alert
    if (currentAlertRef.current) {
      currentAlertRef.current.stop();
      currentAlertRef.current = null;
    }

    switch (severity) {
      case "critical": {
        const controller = playRadiationAlarm(audioEngine);
        currentAlertRef.current = controller;
        return controller;
      }
      case "warning":
        playWarningTone(audioEngine);
        return null;
      case "info":
        playInfoChime(audioEngine);
        return null;
    }
  }, [isInitialized, settings.enabled, settings.categories.alerts]);

  const stopCurrentAlert = useCallback(() => {
    if (currentAlertRef.current) {
      currentAlertRef.current.stop();
      currentAlertRef.current = null;
    }
  }, []);

  const startAmbient = useCallback(() => {
    if (!isInitialized || !settings.enabled || !settings.categories.ambient) return;

    // Start Geiger ambient
    if (!geigerAmbientRef.current) {
      geigerAmbientRef.current = createGeigerAmbient(audioEngine);
    }
    geigerAmbientRef.current.start();

    // Start electrical hum
    if (!humAmbientRef.current) {
      humAmbientRef.current = createElectricalHum(audioEngine);
    }
    humAmbientRef.current.start();
  }, [isInitialized, settings.enabled, settings.categories.ambient]);

  const stopAmbient = useCallback(() => {
    geigerAmbientRef.current?.stop();
    humAmbientRef.current?.stop();
  }, []);

  const setAmbientIntensity = useCallback((intensity: number) => {
    geigerAmbientRef.current?.setIntensity(intensity);
    humAmbientRef.current?.setIntensity(intensity);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAmbient();
      stopCurrentAlert();
    };
  }, [stopAmbient, stopCurrentAlert]);

  const value: AudioContextType = {
    isInitialized,
    settings,
    initialize,
    updateSettings,
    toggleCategory,
    setMasterVolume,
    playUISound,
    playBootSound,
    playAlert: playAlertSound,
    stopCurrentAlert,
    startAmbient,
    stopAmbient,
    setAmbientIntensity,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio(): AudioContextType {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
}
