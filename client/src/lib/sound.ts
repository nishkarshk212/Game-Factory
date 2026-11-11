class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;
  public volume = 0.7;

  private getCtx(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(freq: number, duration: number, type: OscillatorType = 'sine', delay = 0, gainPeak = 0.18) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.01, gainPeak * this.volume), now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  play(cue: 'click' | 'move' | 'capture' | 'dice' | 'strike' | 'win' | 'lose' | 'notify' | 'error') {
    if (!this.enabled) return;
    switch (cue) {
      case 'click':
        this.tone(540, 0.06, 'triangle', 0, 0.1);
        break;
      case 'move':
        this.tone(420, 0.09, 'sine', 0, 0.14);
        this.tone(620, 0.08, 'sine', 0.04, 0.1);
        break;
      case 'capture':
        this.tone(300, 0.08, 'square', 0, 0.12);
        this.tone(720, 0.14, 'triangle', 0.05, 0.16);
        break;
      case 'dice':
        this.tone(380, 0.05, 'triangle', 0, 0.12);
        this.tone(490, 0.05, 'triangle', 0.06, 0.12);
        this.tone(660, 0.07, 'sine', 0.12, 0.14);
        break;
      case 'strike':
        this.tone(240, 0.1, 'sawtooth', 0, 0.15);
        this.tone(160, 0.12, 'triangle', 0.05, 0.14);
        break;
      case 'win':
        this.tone(523.25, 0.14, 'triangle', 0, 0.18);
        this.tone(659.25, 0.14, 'triangle', 0.1, 0.18);
        this.tone(783.99, 0.18, 'triangle', 0.2, 0.2);
        this.tone(1046.5, 0.35, 'sine', 0.32, 0.22);
        break;
      case 'lose':
        this.tone(392, 0.16, 'sine', 0, 0.14);
        this.tone(311, 0.18, 'sine', 0.14, 0.14);
        this.tone(246, 0.32, 'triangle', 0.28, 0.15);
        break;
      case 'notify':
        this.tone(680, 0.1, 'sine', 0, 0.13);
        this.tone(880, 0.14, 'sine', 0.09, 0.13);
        break;
      case 'error':
        this.tone(190, 0.16, 'sawtooth', 0, 0.14);
        break;
    }
  }
}

export const soundFX = new SoundEngine();

