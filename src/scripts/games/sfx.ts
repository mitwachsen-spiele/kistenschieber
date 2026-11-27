// Töne des Spiels per WebAudio: keine Audiodateien, keine externen Ressourcen. Welche Töne wann erklingen und wie sie
// klingen, steht rein und getestet in ks-sound.ts; diese Klasse spielt sie nur. Vorbild: sfx.ts im Weltenbummler.
// Der Browser erlaubt Ton erst nach einer Geste: `unlock()` aus einem Tasten- oder Zeiger-Handler aufrufen; vorher
// entsteht kein AudioContext und nichts erklingt. Höchstens MAX_VOICES Töne gleichzeitig.
import { type Cue, type Note, MAX_VOICES, SOUNDS } from './ks-sound';

/** So lange klingt ein Ton nach dem Ausblenden nach (s) */
const TAIL = 0.03;

export class Sfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private hiss: AudioBuffer | null = null;
  private voices = 0;
  /** „Ton: Aus“: kein AudioContext, keine Töne */
  muted = false;

  /** Im Handler einer Nutzergeste aufrufen: legt den AudioContext an bzw. weckt ihn */
  unlock() {
    if (this.muted) return;
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        const comp = this.ctx.createDynamicsCompressor();
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.6;
        this.out.connect(comp).connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null; // ohne Ton weiterspielen
    }
  }

  /** Seite verborgen oder Ton aus: schlafen legen, die nächste Geste weckt ihn */
  suspend() {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  close() {
    void this.ctx?.close();
    this.ctx = null;
    this.out = null;
    this.hiss = null;
  }

  /** Töne aus ks-sound.ts spielen */
  play(cues: readonly Cue[]) {
    for (const c of cues) for (const n of SOUNDS[c.sound]) this.note(n, c.at);
  }

  private note([freq, len, wave, gain, slide, at]: Note, delay: number) {
    const ctx = this.ctx;
    const start = delay + at;
    // Die Grenze gilt für sofort erklingende Töne; eingeplante dürfen zu Ende spielen
    if (this.muted || !ctx || !this.out || ctx.state === 'closed' || (start === 0 && this.voices >= MAX_VOICES)) return;
    const t = ctx.currentTime + start;
    let src: AudioScheduledSourceNode;
    let head: AudioNode;
    if (wave === 'noise') {
      const noise = ctx.createBufferSource();
      noise.buffer = this.hiss ??= hiss(ctx);
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = freq;
      band.Q.value = 1.2;
      noise.connect(band);
      src = noise;
      head = band;
    } else {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, t);
      if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + len);
      src = head = osc;
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, len / 3));
    env.gain.exponentialRampToValueAtTime(0.0001, t + len);
    head.connect(env).connect(this.out);
    this.voices++;
    src.onended = () => this.voices--;
    src.start(t);
    src.stop(t + len + TAIL);
  }
}

/** Weißes Rauschen für das Schaben einer Kiste (0,2 s, länger braucht kein Ton) */
function hiss(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.2), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}
