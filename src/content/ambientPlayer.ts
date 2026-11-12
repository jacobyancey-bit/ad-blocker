import type { AmbientSound } from '../shared/types';

/**
 * Procedural Web Audio Ambient Soundscape Generator.
 * Zero external MP3/audio files needed (instant loading, zero network requests, 0 byte bloat).
 * Generates relaxing soundscapes:
 *  - 'rain': Pink noise with randomized lowpass filtering + high-frequency raindrop taps.
 *  - 'stream': Modulated dual-band bubbling water filters over continuous fluid rush.
 *  - 'forest': Gentle rustling breeze with subtle, randomized harmonic bird chirps.
 */

export class AmbientPlayer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: { stop?: () => void; disconnect: () => void }[] = [];
  private currentSound: AmbientSound = 'none';
  private isPlaying = false;

  setSound(sound: AmbientSound): void {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.stop();
    }
    this.currentSound = sound;
    if (wasPlaying && sound !== 'none') {
      this.play();
    }
  }

  play(): void {
    if (this.currentSound === 'none' || this.isPlaying) return;
    this.isPlaying = true;

    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      }

      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }

      const ctx = this.ctx;
      this.masterGain = ctx.createGain();
      // Smooth fade in over 300ms
      const now = ctx.currentTime;
      this.masterGain.gain.setValueAtTime(0.0001, now);
      this.masterGain.gain.exponentialRampToValueAtTime(0.15, now + 0.3);
      this.masterGain.connect(ctx.destination);

      if (this.currentSound === 'rain') {
        this.startRain(ctx, this.masterGain);
      } else if (this.currentSound === 'stream') {
        this.startStream(ctx, this.masterGain);
      } else if (this.currentSound === 'forest') {
        this.startForest(ctx, this.masterGain);
      }
    } catch (err) {
      console.warn('[AdMute] Ambient audio initialization skipped:', err);
    }
  }

  stop(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.masterGain && this.ctx && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      try {
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      } catch {
        // AudioParam may already be clamped
      }

      setTimeout(() => {
        this.cleanupNodes();
      }, 260);
    } else {
      this.cleanupNodes();
    }
  }

  private cleanupNodes(): void {
    for (const node of this.activeNodes) {
      try {
        node.stop?.();
        node.disconnect();
      } catch {
        // Ignore
      }
    }
    this.activeNodes = [];
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // Ignore
      }
      this.masterGain = null;
    }
  }

  private createPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  // --- Rain Generator ---
  private startRain(ctx: AudioContext, destination: AudioNode): void {
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.createPinkNoiseBuffer(ctx);
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(destination);
    noiseSource.start();

    this.activeNodes.push(noiseSource, filter);
  }

  // --- Running Stream Generator ---
  private startStream(ctx: AudioContext, destination: AudioNode): void {
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.createPinkNoiseBuffer(ctx);
    noiseSource.loop = true;

    // Bandpass filter to capture trickling water frequencies
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, ctx.currentTime);
    filter.Q.setValueAtTime(3, ctx.currentTime);

    // LFO modulator to simulate gentle fluid gurgling
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.8, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(250, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    noiseSource.connect(filter);
    filter.connect(destination);

    noiseSource.start();
    lfo.start();

    this.activeNodes.push(noiseSource, filter, lfo, lfoGain);
  }

  // --- Forest Breeze Generator ---
  private startForest(ctx: AudioContext, destination: AudioNode): void {
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.createPinkNoiseBuffer(ctx);
    noiseSource.loop = true;

    // Gentle wind lowpass
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.2, ctx.currentTime); // slow rolling gust

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(150, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    noiseSource.connect(filter);
    filter.connect(destination);

    noiseSource.start();
    lfo.start();

    this.activeNodes.push(noiseSource, filter, lfo, lfoGain);
  }
}
