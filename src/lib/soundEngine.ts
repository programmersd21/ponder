export type SoundEventName =
  | 'ui.press'
  | 'ui.toggle'
  | 'ui.open'
  | 'ui.close'
  | 'feedback.success'
  | 'feedback.error'
  | 'learning.response'
  | 'learning.visualization-ready'
  | 'learning.discovery'
  | 'learning.complete';

export type SoundIntensity = 'subtle' | 'balanced';

export type SoundPreferences = {
  enabled: boolean;
  volume: number; // 0..1
  intensity: SoundIntensity;
};

const SOUND_PREFS_KEY = 'ponder_sound_prefs_v1';

export const DEFAULT_SOUND_PREFS: SoundPreferences = {
  enabled: false, // Strictly OFF by default until explicit user opt-in
  volume: 0.35,
  intensity: 'subtle',
};

export function loadSoundPreferences(): SoundPreferences {
  try {
    const raw = localStorage.getItem(SOUND_PREFS_KEY);
    if (!raw) return DEFAULT_SOUND_PREFS;
    const parsed = JSON.parse(raw) as Partial<SoundPreferences>;
    return {
      enabled: parsed.enabled === true,
      volume:
        typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)
          ? Math.min(1, Math.max(0, parsed.volume))
          : DEFAULT_SOUND_PREFS.volume,
      intensity: parsed.intensity === 'balanced' ? 'balanced' : 'subtle',
    };
  } catch {
    return DEFAULT_SOUND_PREFS;
  }
}

export function saveSoundPreferences(prefs: SoundPreferences): void {
  try {
    localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or private mode errors
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

class PonderSoundEngine {
  private ctx: AudioContext | null = null;
  private prefs: SoundPreferences = DEFAULT_SOUND_PREFS;
  private initialized = false;
  private lastPlayedAt = new Map<string, number>();
  private activeVoices = 0;
  private readonly maxVoices = 4;

  constructor() {
    if (typeof window !== 'undefined') {
      this.prefs = loadSoundPreferences();
    }
  }

  public getPreferences(): SoundPreferences {
    return { ...this.prefs };
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    );
  }

  public updatePreferences(next: Partial<SoundPreferences>, userGesture = false): SoundPreferences {
    const updated: SoundPreferences = {
      enabled: next.enabled ?? this.prefs.enabled,
      volume:
        typeof next.volume === 'number' && Number.isFinite(next.volume)
          ? Math.min(1, Math.max(0, next.volume))
          : this.prefs.volume,
      intensity: next.intensity === 'balanced' ? 'balanced' : next.intensity === 'subtle' ? 'subtle' : this.prefs.intensity,
    };
    this.prefs = updated;
    saveSoundPreferences(updated);

    if (userGesture && updated.enabled) {
      this.ensureContext();
    } else if (!updated.enabled && this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend().catch(() => {});
    }

    return { ...updated };
  }

  /**
   * Must only be called inside a direct user-initiated interaction when sound is enabled.
   */
  public ensureContext(): AudioContext | null {
    if (!this.prefs.enabled || !this.isSupported()) return null;

    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.initialized = true;
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public play(event: SoundEventName, fromUserGesture = false): void {
    if (!this.prefs.enabled || this.prefs.volume <= 0.01) return;

    // Respect reduced motion accessibility preference by suppressing non-essential ambient swells
    const reducedMotion = prefersReducedMotion();
    if (reducedMotion && (event === 'learning.response' || event === 'learning.complete')) {
      return;
    }

    const nowMs = performance.now();
    const cooldownMs = event.startsWith('learning.') ? 350 : 65;
    const prev = this.lastPlayedAt.get(event) ?? 0;
    if (nowMs - prev < cooldownMs) return;
    if (this.activeVoices >= this.maxVoices) return;

    const ctx = fromUserGesture ? this.ensureContext() : this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    this.lastPlayedAt.set(event, nowMs);

    const intensityScale = this.prefs.intensity === 'balanced' ? 1 : 0.62;
    const masterGainValue = Math.min(0.32, this.prefs.volume * 0.24 * intensityScale);

    switch (event) {
      case 'ui.press':
        this.playTone(ctx, { freq: 520, freqEnd: 380, type: 'triangle', duration: 0.028, gain: masterGainValue * 0.45, lowpass: 1400 });
        break;
      case 'ui.toggle':
        this.playTone(ctx, { freq: 440, freqEnd: 620, type: 'sine', duration: 0.045, gain: masterGainValue * 0.5, lowpass: 1800 });
        break;
      case 'ui.open':
        this.playTone(ctx, { freq: 330, freqEnd: 495, type: 'sine', duration: 0.11, gain: masterGainValue * 0.42, attack: 0.018, lowpass: 1600 });
        break;
      case 'ui.close':
        this.playTone(ctx, { freq: 460, freqEnd: 310, type: 'sine', duration: 0.095, gain: masterGainValue * 0.36, attack: 0.01, lowpass: 1300 });
        break;
      case 'feedback.success':
        this.playInterval(ctx, [523.25, 783.99], 0.07, 0.26, masterGainValue * 0.65); // C5 -> G5 soft crystal fifth
        break;
      case 'feedback.error':
        this.playTone(ctx, { freq: 196, freqEnd: 164.8, type: 'sine', duration: 0.19, gain: masterGainValue * 0.55, attack: 0.015, lowpass: 620 });
        break;
      case 'learning.response':
        // Quiet observatory harmonic chord: warm fifth + high shimmer
        this.playObservatoryChord(ctx, [130.81, 196.0, 587.33], 0.85, masterGainValue * 0.52);
        break;
      case 'learning.visualization-ready':
        this.playInterval(ctx, [440, 659.25], 0.055, 0.24, masterGainValue * 0.52); // A4 -> E5
        break;
      case 'learning.discovery':
        this.playInterval(ctx, [587.33, 880], 0.06, 0.26, masterGainValue * 0.55); // D5 -> A5
        break;
      case 'learning.complete':
        this.playObservatoryChord(ctx, [261.63, 392.0, 523.25], 0.65, masterGainValue * 0.55);
        break;
    }
  }

  private playTone(
    ctx: AudioContext,
    opts: {
      freq: number;
      freqEnd?: number;
      type: OscillatorType;
      duration: number;
      gain: number;
      attack?: number;
      lowpass?: number;
      delay?: number;
    }
  ): void {
    const startTime = ctx.currentTime + (opts.delay ?? 0);
    const attack = opts.attack ?? 0.006;
    const stopTime = startTime + opts.duration;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, startTime);
    if (opts.freqEnd && opts.freqEnd !== opts.freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), stopTime);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(opts.lowpass ?? 2000, startTime);

    amp.gain.setValueAtTime(0.0001, startTime);
    amp.gain.linearRampToValueAtTime(Math.max(0.0002, opts.gain), startTime + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);

    this.activeVoices++;
    osc.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      osc.disconnect();
      filter.disconnect();
      amp.disconnect();
    };

    osc.start(startTime);
    osc.stop(stopTime + 0.02);
  }

  private playInterval(
    ctx: AudioContext,
    freqs: [number, number],
    stepDelay: number,
    duration: number,
    gain: number
  ): void {
    this.playTone(ctx, {
      freq: freqs[0],
      type: 'sine',
      duration,
      gain: gain * 0.85,
      attack: 0.012,
      lowpass: 2400,
    });
    this.playTone(ctx, {
      freq: freqs[1],
      type: 'sine',
      duration: duration * 1.15,
      gain: gain * 0.72,
      attack: 0.016,
      lowpass: 2800,
      delay: stepDelay,
    });
  }

  private playObservatoryChord(
    ctx: AudioContext,
    freqs: number[],
    duration: number,
    gain: number
  ): void {
    freqs.forEach((f, idx) => {
      this.playTone(ctx, {
        freq: f,
        type: 'sine',
        duration,
        gain: gain * (idx === 0 ? 0.65 : idx === 1 ? 0.55 : 0.3),
        attack: 0.14 + idx * 0.03,
        lowpass: idx === 0 ? 520 : 1800,
        delay: idx * 0.04,
      });
    });
  }

  public dispose(): void {
    if (this.initialized && this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
      this.initialized = false;
    }
  }
}

export const soundEngine = new PonderSoundEngine();
