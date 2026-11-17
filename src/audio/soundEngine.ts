import { KickPowerTier, ObstacleKind } from '../game/rules';

export type MicStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unsupported';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private timeData: Float32Array<ArrayBuffer> | null = null;
  private micStatus: MicStatus = 'idle';
  private micError = '';
  private smoothedVolume = 0;

  private muted = false;
  private musicPlaying = false;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.85;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.24;
      this.musicGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private canAutoCreateAudio(): boolean {
    const ua = (navigator as unknown as { userActivation?: { hasBeenActive: boolean } })
      .userActivation;
    return !ua || ua.hasBeenActive;
  }

  public unlock(): void {
    try {
      const ctx = this.ensureContext();
      if (this.musicPlaying && this.musicTimer === null) {
        this.musicStep = 0;
        this.nextNoteTime = ctx.currentTime + 0.05;
        this.scheduleMusicLoop();
      }
    } catch {
      // Ignore audio unlock failures in restricted environments
    }
  }

  public getMicStatus(): { status: MicStatus; error: string } {
    return { status: this.micStatus, error: this.micError };
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : 0.85,
        this.ctx.currentTime,
        0.02,
      );
    }
  }

  /**
   * Requests local-only microphone stream and attaches AnalyserNode.
   * Never connects mic input to speakers, never records or uploads audio.
   */
  public async startMicrophone(): Promise<{
    ok: boolean;
    status: MicStatus;
    error: string;
  }> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      this.micStatus = 'unsupported';
      this.micError = 'Microphone capture is not supported in this browser.';
      return { ok: false, status: this.micStatus, error: this.micError };
    }

    if (this.micStatus === 'active' && this.analyser) {
      return { ok: true, status: 'active', error: '' };
    }

    this.micStatus = 'requesting';
    this.micError = '';

    try {
      const ctx = this.ensureContext();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
        video: false,
      });

      this.stopMicrophoneStreamOnly();

      this.micStream = stream;
      this.micSource = ctx.createMediaStreamSource(stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.2;
      this.timeData = new Float32Array(
        new ArrayBuffer(this.analyser.fftSize * 4),
      );
      this.micSource.connect(this.analyser);

      this.micStatus = 'active';
      this.micError = '';
      return { ok: true, status: 'active', error: '' };
    } catch (err) {
      this.micStatus = 'denied';
      const msg =
        err instanceof Error ? err.message : 'Microphone permission denied.';
      this.micError = msg;
      return { ok: false, status: 'denied', error: msg };
    }
  }

  private stopMicrophoneStreamOnly(): void {
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        // ignore
      }
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.analyser = null;
    this.timeData = null;
  }

  public stopMicrophone(): void {
    this.stopMicrophoneStreamOnly();
    this.micStatus = 'idle';
    this.smoothedVolume = 0;
  }

  /**
   * Computes normalized real-time voice loudness (0..1) from local AnalyserNode.
   */
  public sampleMicVolume(gainBoost = 1.8): number {
    if (this.micStatus !== 'active' || !this.analyser || !this.timeData) {
      this.smoothedVolume *= 0.85;
      return this.smoothedVolume;
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    this.analyser.getFloatTimeDomainData(this.timeData);
    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const s = this.timeData[i];
      sumSq += s * s;
      const a = Math.abs(s);
      if (a > peak) peak = a;
    }
    const rms = Math.sqrt(sumSq / this.timeData.length);
    // Blend RMS and peak for snappy scream onset with smooth decay
    const raw = Math.min(1, (rms * 2.4 + peak * 0.45) * gainBoost);
    if (raw > this.smoothedVolume) {
      this.smoothedVolume = raw * 0.72 + this.smoothedVolume * 0.28;
    } else {
      this.smoothedVolume = raw * 0.25 + this.smoothedVolume * 0.75;
    }
    return this.smoothedVolume;
  }

  // ---- Procedural Arcade SFX ----

  public playFootstep(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const pitchVar = 0.92 + Math.random() * 0.16;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(115 * pitchVar, now);
    osc.frequency.exponentialRampToValueAtTime(48 * pitchVar, now + 0.055);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playKick(tier: KickPowerTier): void {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const now = ctx.currentTime;
      const pitchVar = 0.94 + Math.random() * 0.12;

      // Whoosh sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tier === 'super' ? 'sawtooth' : 'triangle';
      const startFreq =
        tier === 'super' ? 480 : tier === 'normal' ? 340 : 250;
      const endFreq = tier === 'super' ? 68 : 95;
      const dur = tier === 'super' ? 0.26 : tier === 'normal' ? 0.18 : 0.13;

      osc.frequency.setValueAtTime(startFreq * pitchVar, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

      gain.gain.setValueAtTime(
        tier === 'super' ? 0.32 : tier === 'normal' ? 0.22 : 0.15,
        now,
      );
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + dur + 0.02);

      if (tier === 'super') {
        // Extra sonic boom sub punch
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(160, now);
        sub.frequency.exponentialRampToValueAtTime(36, now + 0.32);
        subGain.gain.setValueAtTime(0.4, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
        sub.connect(subGain);
        subGain.connect(this.sfxGain);
        sub.start(now);
        sub.stop(now + 0.35);
      }
    } catch {
      // ignore
    }
  }

  public playSmash(kind: ObstacleKind, tier: KickPowerTier): void {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const now = ctx.currentTime;

      // Filtered noise burst for crunch / splinter / shatter
      const bufferSize = Math.floor(ctx.sampleRate * 0.24);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = kind === 'moving_gate' ? 'bandpass' : 'lowpass';
      filter.frequency.setValueAtTime(
        kind === 'boulder' || kind === 'brick_wall'
          ? 750
          : kind === 'moving_gate'
            ? 1450
            : 1200,
        now,
      );
      filter.Q.value = kind === 'moving_gate' ? 3.5 : 1.1;

      const gain = ctx.createGain();
      const vol = tier === 'super' ? 0.55 : tier === 'normal' ? 0.38 : 0.26;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(now);

      // Punchy impact thud + arcade reward blip
      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.type = 'square';
      thud.frequency.setValueAtTime(tier === 'super' ? 210 : 155, now);
      thud.frequency.exponentialRampToValueAtTime(42, now + 0.14);
      thudGain.gain.setValueAtTime(0.22, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      thud.connect(thudGain);
      thudGain.connect(this.sfxGain);
      thud.start(now);
      thud.stop(now + 0.16);

      // Crisp ascending smash coin chime
      const ding = ctx.createOscillator();
      const dingGain = ctx.createGain();
      ding.type = 'triangle';
      const baseNote = tier === 'super' ? 784 : 587;
      ding.frequency.setValueAtTime(baseNote, now + 0.03);
      ding.frequency.setValueAtTime(baseNote * 1.25, now + 0.08);
      dingGain.gain.setValueAtTime(0.16, now + 0.03);
      dingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      ding.connect(dingGain);
      dingGain.connect(this.sfxGain);
      ding.start(now + 0.03);
      ding.stop(now + 0.21);
    } catch {
      // ignore
    }
  }

  public playPowerup(): void {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        if (!this.sfxGain) return;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        const t = now + idx * 0.055;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.17);
      });
    } catch {
      // ignore
    }
  }

  public playHurt(): void {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(95, now + 0.12);
      osc.frequency.linearRampToValueAtTime(140, now + 0.2);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);
      g.gain.setValueAtTime(0.28, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.38);
    } catch {
      // ignore
    }
  }

  public playGameOver(): void {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!this.sfxGain) return;
      const now = ctx.currentTime;
      const notes = [392, 349.23, 311.13, 261.63];
      notes.forEach((freq, idx) => {
        if (!this.sfxGain) return;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        const t = now + idx * 0.14;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    } catch {
      // ignore
    }
  }

  // ---- Procedural Upbeat Arcade Sequencer ----

  public startMusic(): void {
    if (this.musicPlaying) return;
    if (!this.ctx && !this.canAutoCreateAudio()) {
      this.musicPlaying = true;
      return;
    }
    try {
      const ctx = this.ensureContext();
      this.musicPlaying = true;
      this.musicStep = 0;
      this.nextNoteTime = ctx.currentTime + 0.05;
      this.scheduleMusicLoop();
    } catch {
      // ignore
    }
  }

  public stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusicLoop = (): void => {
    if (!this.musicPlaying || !this.ctx || !this.musicGain) return;
    const stepDuration = 0.135; // ~111 BPM 16th-note feel

    while (this.nextNoteTime < this.ctx.currentTime + 0.18) {
      this.triggerMusicStep(this.musicStep, this.nextNoteTime);
      this.nextNoteTime += stepDuration;
      this.musicStep = (this.musicStep + 1) % 16;
    }

    this.musicTimer = window.setTimeout(this.scheduleMusicLoop, 45);
  };

  private triggerMusicStep(step: number, time: number): void {
    if (!this.ctx || !this.musicGain || this.muted) return;

    // Punchy arcade bassline (C minor / Mixolydian groove)
    const bassPattern = [
      130.81, 0, 130.81, 155.56, 174.61, 0, 155.56, 130.81,
      196.0, 0, 174.61, 155.56, 130.81, 0, 116.54, 130.81,
    ];
    const bassFreq = bassPattern[step];
    if (bassFreq > 0) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(bassFreq * 0.5, time);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, time);

      g.gain.setValueAtTime(0.24, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.12);
    }

    // Crisp offbeat hi-hat tick
    if (step % 2 === 1) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(step % 4 === 2 ? 2800 : 4200, time);
      g.gain.setValueAtTime(0.035, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.035);
    }

    // Playful arcade lead stab on accents
    const leadPattern = [
      523.25, 0, 0, 622.25, 0, 0, 783.99, 0,
      698.46, 0, 622.25, 0, 587.33, 0, 523.25, 0,
    ];
    const leadFreq = leadPattern[step];
    if (leadFreq > 0) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(leadFreq, time);
      g.gain.setValueAtTime(0.11, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.13);
    }
  }

  public dispose(): void {
    this.stopMusic();
    this.stopMicrophone();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
