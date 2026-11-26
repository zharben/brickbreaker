const STORAGE_KEY_MUTE = 'brickbreaker_muted_v1';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted: boolean;

  constructor() {
    this.muted = this.loadMutePref();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    this.saveMutePref(this.muted);
    if (!this.muted) {
      this.unlock();
      this.playPickup();
    }
    return this.muted;
  }

  public unlock(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = ctx.sampleRate * 0.8;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  public playPickup(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.055);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playPlace(blockCount: number): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const baseFreq = Math.max(150, 250 - blockCount * 10);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq * 1.35, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + 0.085);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playInvalid(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  /**
   * Plays an explosion sound + electric lightning crackle whose volume,
   * bass punch, filter width, and decay scale directly with `clearedBlockCount`.
   */
  public playExplosion(
    clearedBlockCount: number,
    linesCount: number,
    comboStreak: number
  ): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Normalized intensity: 8 blocks -> ~0.18, 15 blocks -> ~0.50, 24+ blocks -> 1.0
    const intensity = Math.min(
      1,
      Math.max(0.15, (clearedBlockCount - 4) / 22)
    );

    // Master limiter/compressor feel via modest master gain
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.45 + intensity * 0.5, now);
    master.connect(ctx.destination);

    // 1. Sub-bass boom punch
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    const bassDuration = 0.2 + intensity * 0.32;
    bassOsc.type = 'triangle';
    bassOsc.frequency.setValueAtTime(125 + intensity * 55, now);
    bassOsc.frequency.exponentialRampToValueAtTime(
      Math.max(26, 46 - intensity * 16),
      now + bassDuration
    );

    bassGain.gain.setValueAtTime(0.001, now);
    bassGain.gain.linearRampToValueAtTime(0.32 + intensity * 0.42, now + 0.01);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + bassDuration);

    bassOsc.connect(bassGain).connect(master);
    bassOsc.start(now);
    bassOsc.stop(now + bassDuration + 0.02);

    // 2. Filtered noise explosion blast
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const noiseFilter = ctx.createBiquadFilter();
    const noiseDuration = 0.18 + intensity * 0.34;
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(900 + intensity * 2600, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(
      160 + intensity * 180,
      now + noiseDuration
    );
    noiseFilter.Q.setValueAtTime(1.2 + intensity * 1.4, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.24 + intensity * 0.4, now + 0.008);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDuration);

    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start(now);
    noise.stop(now + noiseDuration + 0.02);

    // 3. Brief electric lightning crackle when full line(s) clear
    if (linesCount > 0) {
      const zapNoise = ctx.createBufferSource();
      zapNoise.buffer = this.getNoiseBuffer(ctx);
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(3200 + Math.min(linesCount, 4) * 450, now);
      hp.Q.setValueAtTime(2.6, now);

      const zapGain = ctx.createGain();
      zapGain.gain.setValueAtTime(0.001, now);
      zapGain.gain.linearRampToValueAtTime(0.16 + intensity * 0.16, now + 0.004);
      zapGain.gain.exponentialRampToValueAtTime(0.02, now + 0.06);
      zapGain.gain.linearRampToValueAtTime(0.12 + intensity * 0.1, now + 0.085);
      zapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

      zapNoise.connect(hp).connect(zapGain).connect(master);
      zapNoise.start(now);
      zapNoise.stop(now + 0.19);
    }

    // 4. Crisp rising reward chime scaled by combo streak
    const pitchBoost = Math.pow(1.06, Math.min(comboStreak, 10));
    const notes = linesCount >= 2 ? [523.25, 659.25, 783.99] : [523.25, 659.25];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + 0.02 + idx * 0.045;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * pitchBoost, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.09 + intensity * 0.06, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playBatchDeal(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [330, 392, 493.88];
    freqs.forEach((freq, i) => {
      const start = now + i * 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.055, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.11);
    });
  }

  public playLevelUp(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  }

  public playGameOver(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [392, 349.23, 293.66, 220];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.13, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  }

  private loadMutePref(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_KEY_MUTE) === '1';
    } catch {
      return false;
    }
  }

  private saveMutePref(muted: boolean): void {
    try {
      window.localStorage.setItem(STORAGE_KEY_MUTE, muted ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  }
}
