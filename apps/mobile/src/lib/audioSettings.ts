// Audio Settings persistence - follows backends.ts localStorage pattern

const AUDIO_SETTINGS_KEY = "pipalert-audio-settings";

export interface AudioSettings {
  enabled: boolean;
  masterVolume: number; // 0-1
  categories: {
    ui: boolean;
    boot: boolean;
    alerts: boolean;
    ambient: boolean;
  };
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  enabled: true,
  masterVolume: 0.7,
  categories: {
    ui: true,
    boot: true,
    alerts: true,
    ambient: true,
  },
};

export function getAudioSettings(): AudioSettings {
  try {
    const stored = localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle missing fields from older versions
      return {
        ...DEFAULT_AUDIO_SETTINGS,
        ...parsed,
        categories: {
          ...DEFAULT_AUDIO_SETTINGS.categories,
          ...parsed.categories,
        },
      };
    }
    return DEFAULT_AUDIO_SETTINGS;
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export function saveAudioSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save audio settings:", e);
  }
}

export function updateAudioSettings(updates: Partial<AudioSettings>): AudioSettings {
  const current = getAudioSettings();
  const updated = {
    ...current,
    ...updates,
    categories: {
      ...current.categories,
      ...(updates.categories || {}),
    },
  };
  saveAudioSettings(updated);
  return updated;
}

export function toggleAudioCategory(category: keyof AudioSettings["categories"]): AudioSettings {
  const current = getAudioSettings();
  const updated = {
    ...current,
    categories: {
      ...current.categories,
      [category]: !current.categories[category],
    },
  };
  saveAudioSettings(updated);
  return updated;
}
