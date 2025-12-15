// Audio Engine - Core Web Audio API management with mobile gesture handling

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log("[Audio] Already initialized");
      return;
    }

    console.log("[Audio] Initializing audio engine...");
    try {
      // Create AudioContext (must be from user gesture on mobile)
      this.context = new AudioContext();
      console.log("[Audio] AudioContext created, state:", this.context.state);

      // Create compressor for consistent output levels
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-24, this.context.currentTime);
      this.compressor.knee.setValueAtTime(30, this.context.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.context.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.context.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.context.currentTime);

      // Create master gain node
      this.masterGain = this.context.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.context.currentTime);

      // Connect: masterGain -> compressor -> destination
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.context.destination);

      // Resume context if suspended (mobile browsers often start suspended)
      if (this.context.state === "suspended") {
        await this.context.resume();
      }

      this.initialized = true;
      console.log("[Audio] Audio engine initialized successfully");
    } catch (error) {
      console.warn("[Audio] Failed to initialize audio engine:", error);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getContext(): AudioContext | null {
    return this.context;
  }

  getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain && this.context) {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      this.masterGain.gain.setValueAtTime(clampedVolume, this.context.currentTime);
    }
  }

  async suspend(): Promise<void> {
    if (this.context && this.context.state === "running") {
      await this.context.suspend();
    }
  }

  async resume(): Promise<void> {
    if (this.context && this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  dispose(): void {
    if (this.context) {
      this.context.close();
      this.context = null;
      this.masterGain = null;
      this.compressor = null;
      this.initialized = false;
    }
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();
