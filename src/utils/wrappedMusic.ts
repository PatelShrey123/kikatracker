/**
 * The Wrapped video's soundtrack, written here and played by Web Audio, so it belongs to Kirka Hub and
 * no platform mutes it. An upbeat A-minor loop (Am F C G) at 96 BPM: one bar is 2.5 s, one slide, so
 * every slide lands on a downbeat. A quiet intro bar, then the drums drop, and the last chord rings out.
 */

export const BPM = 96;
export const BAR = (60 / BPM) * 4;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// Am F C G, voiced close together, and the bass root of each
const CHORDS = [
  [57, 60, 64],
  [57, 60, 65],
  [55, 60, 64],
  [55, 59, 62],
];
const ROOTS = [45, 41, 48, 43];

export interface MusicOptions {
  /** Start with the quiet intro bar (only when the song starts at bar 0). */
  intro?: boolean;
  /** End on the held final chord. */
  outro?: boolean;
  /** Where in the song this stretch starts, so a loop keeps the chords and the build in order. */
  barOffset?: number;
}

export function scheduleMusic(ac: BaseAudioContext, out: AudioNode, t0: number, bars: number, opts: MusicOptions = {}) {
  const { intro: withIntro = true, outro = true, barOffset = 0 } = opts;
  const master = ac.createGain();
  // leaves headroom: at 0.8 the loudest hits reached full scale and clipped
  master.gain.value = 0.55;
  const glue = ac.createDynamicsCompressor();
  glue.threshold.value = -14;
  glue.ratio.value = 4;
  master.connect(glue).connect(out);

  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const env = (g: GainNode, t: number, peak: number, attack: number, decay: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };

  const kick = (t: number) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    env(g, t, 1, 0.003, 0.32);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.4);
  };

  const hiss = (t: number, type: BiquadFilterType, freq: number, peak: number, decay: number) => {
    const s = ac.createBufferSource();
    s.buffer = noise;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ac.createGain();
    env(g, t, peak, 0.002, decay);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + decay + 0.05);
  };
  const clap = (t: number) => {
    hiss(t, 'bandpass', 1600, 0.55, 0.16);
    hiss(t + 0.012, 'bandpass', 1300, 0.35, 0.12);
  };
  const hat = (t: number, open: boolean) => hiss(t, 'highpass', 7500, open ? 0.14 : 0.09, open ? 0.16 : 0.04);

  const bass = (t: number, midi: number, len: number) => {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz(midi);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(220, t + len);
    const g = ac.createGain();
    env(g, t, 0.32, 0.005, len);
    o.connect(f).connect(g).connect(master);
    o.start(t);
    o.stop(t + len + 0.05);
  };

  const pad = (t: number, notes: number[], len: number, level: number) => {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + 0.25);
    g.gain.setValueAtTime(level, t + len - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.3);
    f.connect(g).connect(master);
    for (const m of notes) {
      for (const cents of [-8, 8]) {
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(m);
        o.detune.value = cents;
        o.connect(f);
        o.start(t);
        o.stop(t + len + 0.4);
      }
    }
  };

  const pluck = (t: number, midi: number, level: number) => {
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.value = hz(midi);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.14);
    const g = ac.createGain();
    env(g, t, level, 0.003, 0.15);
    o.connect(f).connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.2);
  };

  const riser = (t: number, len: number) => {
    const s = ac.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(5000, t + len);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + len);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.02);
    s.connect(f).connect(g).connect(master);
    s.start(t);
    s.stop(t + len + 0.05);
  };

  const beat = BAR / 4;
  const step = beat / 4;
  for (let b = 0; b < bars; b++) {
    const t = t0 + b * BAR;
    const bar = b + barOffset;
    const chord = CHORDS[bar % 4];
    const root = ROOTS[bar % 4];
    const last = outro && b === bars - 1;
    const intro = withIntro && bar === 0;

    if (last) {
      // the final chord, held and left to ring
      pad(t, [...chord, chord[0] + 12], BAR * 1.2, 0.07);
      bass(t, root, BAR * 0.9);
      kick(t);
      hiss(t, 'highpass', 5000, 0.2, 1.2);
      continue;
    }
    pad(t, chord, BAR, intro ? 0.05 : 0.06);

    if (intro) {
      // just chords and a slow arpeggio, then a riser into the drop
      for (let i = 0; i < 8; i++) pluck(t + i * step * 2, chord[i % 3] + 12, 0.035);
      riser(t + BAR / 2, BAR / 2);
      continue;
    }

    for (let i = 0; i < 4; i++) {
      kick(t + i * beat);
      if (i % 2 === 1) clap(t + i * beat);
    }
    for (let i = 0; i < 8; i++) {
      hat(t + i * (beat / 2), i % 2 === 1);
      bass(t + i * (beat / 2), root + (i % 4 === 3 ? 12 : 0), beat / 2 - 0.02);
    }
    // the arpeggio comes in after a couple of bars, and the line climbs in the second half of each loop
    if (bar >= 3) {
      const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
      for (let i = 0; i < 16; i++) pluck(t + i * step, chord[pattern[i % 8]] + 12 + (bar % 8 >= 4 && i >= 8 ? 12 : 0), 0.045);
    }
  }
}

/**
 * The same song, looping for as long as the story is open: it's scheduled a few bars ahead at a time.
 * Returns a stop function that fades it out and closes the audio.
 */
export function playMusicLoop(ac: AudioContext, volume = 0.7): () => void {
  const out = ac.createGain();
  out.gain.value = volume;
  out.connect(ac.destination);
  const start = ac.currentTime + 0.1;
  const CHUNK = 4;
  let next = 0;
  const pump = () => {
    while (start + next * BAR < ac.currentTime + BAR * 2) {
      scheduleMusic(ac, out, start + next * BAR, CHUNK, { intro: next === 0, outro: false, barOffset: next });
      next += CHUNK;
    }
  };
  pump();
  const timer = window.setInterval(pump, 400);
  return () => {
    window.clearInterval(timer);
    out.gain.setTargetAtTime(0, ac.currentTime, 0.12);
    window.setTimeout(() => void ac.close(), 700);
  };
}
