// Procedural WebAudio sound engine — zero assets, all synthesized.

type SfxName =
  | "shoot_ar" | "shoot_sg" | "shoot_smg" | "shoot_sr"
  | "dryfire" | "reload" | "hit" | "kill" | "hurt"
  | "explosion" | "pickup" | "jump" | "land" | "boost"
  | "capture" | "pointTaken" | "ui" | "uiBack" | "countdown" | "roundWin"
  | "streak" | "deploy" | "throw" | "nadeTick";

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  private lastPlay: Partial<Record<SfxName, number>> = {};

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      // white noise buffer
      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  private gate(name: SfxName, minGap: number): boolean {
    const now = performance.now();
    const last = this.lastPlay[name] ?? -9999;
    if (now - last < minGap) return false;
    this.lastPlay[name] = now;
    return true;
  }

  private noise(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = "lowpass", when = 0) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  private tone(freq: number, endFreq: number, dur: number, gain: number, type: OscillatorType = "sine", when = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  play(name: SfxName, vol = 1) {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    switch (name) {
      case "shoot_ar":
        if (!this.gate(name, 25)) break;
        this.noise(0.09, 900, 0.8, 0.5 * vol, "bandpass");
        this.tone(160, 60, 0.08, 0.35 * vol, "square");
        break;
      case "shoot_sg":
        this.noise(0.22, 500, 0.7, 0.8 * vol, "lowpass");
        this.tone(120, 45, 0.16, 0.6 * vol, "sawtooth");
        break;
      case "shoot_smg":
        if (!this.gate(name, 22)) break;
        this.noise(0.06, 1400, 1, 0.36 * vol, "bandpass");
        this.tone(210, 90, 0.05, 0.26 * vol, "square");
        break;
      case "shoot_sr":
        this.noise(0.35, 300, 0.6, 1 * vol, "lowpass");
        this.tone(90, 30, 0.4, 0.8 * vol, "sawtooth");
        this.tone(1800, 500, 0.18, 0.12 * vol, "sine");
        break;
      case "dryfire":
        this.tone(1200, 800, 0.04, 0.2 * vol, "square");
        break;
      case "reload":
        this.noise(0.06, 2500, 3, 0.25 * vol, "bandpass");
        this.noise(0.08, 1800, 3, 0.3 * vol, "bandpass", 0.28);
        break;
      case "hit":
        if (!this.gate(name, 30)) break;
        this.tone(700, 420, 0.06, 0.3 * vol, "triangle");
        break;
      case "kill":
        this.tone(520, 780, 0.09, 0.4 * vol, "triangle");
        this.tone(780, 1170, 0.12, 0.35 * vol, "triangle", 0.08);
        break;
      case "hurt":
        if (!this.gate(name, 90)) break;
        this.tone(220, 120, 0.14, 0.4 * vol, "sawtooth");
        break;
      case "explosion":
        this.noise(0.7, 150, 0.5, 1.2 * vol, "lowpass");
        this.tone(70, 24, 0.7, 1 * vol, "sine");
        this.noise(0.25, 900, 0.7, 0.5 * vol, "bandpass");
        break;
      case "pickup":
        this.tone(660, 990, 0.1, 0.3 * vol, "sine");
        this.tone(990, 1320, 0.12, 0.25 * vol, "sine", 0.08);
        break;
      case "jump":
        this.tone(240, 420, 0.12, 0.2 * vol, "sine");
        break;
      case "land":
        this.noise(0.08, 400, 1, 0.3 * vol, "lowpass");
        break;
      case "boost":
        this.tone(300, 700, 0.2, 0.35 * vol, "sine");
        this.noise(0.18, 1200, 1, 0.25 * vol, "bandpass");
        break;
      case "capture":
        if (!this.gate(name, 300)) break;
        this.tone(880, 880, 0.06, 0.18 * vol, "square");
        break;
      case "pointTaken":
        this.tone(523, 784, 0.3, 0.3 * vol, "triangle");
        break;
      case "ui":
        this.tone(600, 900, 0.06, 0.2 * vol, "sine");
        break;
      case "uiBack":
        this.tone(500, 350, 0.08, 0.18 * vol, "sine");
        break;
      case "countdown":
        this.tone(880, 880, 0.09, 0.3 * vol, "square");
        break;
      case "roundWin":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.22, 0.3 * vol, "triangle", i * 0.11));
        break;
      case "streak":
        [660, 880, 1100].forEach((f, i) => this.tone(f, f, 0.14, 0.3 * vol, "square", i * 0.07));
        break;
      case "deploy":
        this.tone(392, 523, 0.16, 0.3 * vol, "triangle");
        this.tone(523, 659, 0.2, 0.3 * vol, "triangle", 0.14);
        break;
      case "throw":
        this.noise(0.18, 750, 1.2, 0.4 * vol, "bandpass");
        this.tone(480, 880, 0.1, 0.15 * vol, "sine");
        break;
      case "nadeTick":
        if (!this.gate(name, 90)) break;
        this.tone(1450, 1450, 0.05, 0.3 * vol, "square");
        break;
    }
  }
}

export const sound = new SoundEngine();
