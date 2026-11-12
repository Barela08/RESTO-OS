// ====================================================================
// RESTO OS - Web Audio Synthetic Alert Service
// Generates crystal-clear audio notifications without external files
// ====================================================================

class AudioAlertService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.85;

  constructor() {
    // AudioContext is initialized on first user interaction
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const storedMute = localStorage.getItem('resto_audio_muted');
      if (storedMute !== null) {
        this.isMuted = storedMute === 'true';
      }
      const storedVolume = localStorage.getItem('resto_audio_volume');
      if (storedVolume !== null) {
        const parsed = parseFloat(storedVolume);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.volume = parsed;
        }
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('resto_audio_muted', String(muted));
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1.0, volume));
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('resto_audio_volume', String(this.volume));
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  // Soft pleasant chime for new kitchen orders
  public playNewOrderChime(customVolume?: number): boolean {
    if (this.isMuted) return false;
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    const vol = typeof customVolume === 'number' ? customVolume : this.volume;
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.3); // G5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659.25, now + 0.15); // E5

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3 * vol, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.15);
      osc1.stop(now + 0.8);
      osc2.stop(now + 0.8);
      return true;
    } catch {
      return false;
    }
  }

  // Attention alert for repeat scan requests or urgent kitchen alerts
  public playRepeatScanAlert(customVolume?: number): boolean {
    if (this.isMuted) return false;
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    const vol = typeof customVolume === 'number' ? customVolume : this.volume;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(880, now + 0.15); // A5
      osc.frequency.setValueAtTime(440, now + 0.3); // A4

      gainNode.gain.setValueAtTime(0.35 * vol, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
      return true;
    } catch {
      return false;
    }
  }

  // High distinct double-bell tone for Call Waiter and Request Bill
  public playWaiterCallBell(customVolume?: number): boolean {
    if (this.isMuted) return false;
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    const vol = typeof customVolume === 'number' ? customVolume : this.volume;
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Dual harmonic bell strike: C6 (1046.5Hz) & E6 (1318.5Hz)
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1046.5, now);
      osc1.frequency.exponentialRampToValueAtTime(1048, now + 0.4);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1318.5, now + 0.08);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.4 * vol, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.08);
      osc1.stop(now + 0.95);
      osc2.stop(now + 0.95);
      return true;
    } catch {
      return false;
    }
  }

  public playOrderReadyChime(customVolume?: number): boolean {
    return this.playWaiterCallBell(customVolume);
  }

  public playNewOrderBeep(customVolume?: number): boolean {
    return this.playNewOrderChime(customVolume);
  }
}

export const audioService = new AudioAlertService();
