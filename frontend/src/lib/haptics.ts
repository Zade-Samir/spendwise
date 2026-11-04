/**
 * SpendWise iOS-Grade Haptic Engine
 * Combines navigator.vibrate with Web Audio synthesized micro-clicks
 * for crisp Taptic Engine feedback on iOS Safari and Android devices.
 */
class HapticEngine {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Synthesizes an ultra-short (3-8ms) high-frequency acoustic impulse
   * that mimics the physical sensation of an Apple Taptic Engine click.
   */
  private playMicroClick(freq: number, duration: number, gainValue: number): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy or background tab restriction
    }
  }

  public trigger(
    type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' = 'light'
  ): void {
    if (typeof window === 'undefined') return;

    // 1. Native vibration API (Android & supported webviews)
    if ('vibrate' in navigator) {
      try {
        switch (type) {
          case 'light':
          case 'selection':
            navigator.vibrate(8);
            break;
          case 'medium':
            navigator.vibrate(18);
            break;
          case 'heavy':
            navigator.vibrate(28);
            break;
          case 'success':
            navigator.vibrate([10, 30, 15]);
            break;
          case 'warning':
            navigator.vibrate([20, 40, 20]);
            break;
        }
      } catch {
        // Ignore vibration restrictions
      }
    }

    // 2. Synthesized acoustic Taptic pulse (iOS Safari & Desktop)
    switch (type) {
      case 'light':
      case 'selection':
        this.playMicroClick(360, 0.007, 0.035);
        break;
      case 'medium':
        this.playMicroClick(260, 0.012, 0.06);
        break;
      case 'heavy':
        this.playMicroClick(190, 0.016, 0.09);
        break;
      case 'success':
        this.playMicroClick(520, 0.01, 0.04);
        setTimeout(() => this.playMicroClick(680, 0.014, 0.05), 45);
        break;
      case 'warning':
        this.playMicroClick(150, 0.02, 0.08);
        break;
    }
  }
}

export const haptic = new HapticEngine();

