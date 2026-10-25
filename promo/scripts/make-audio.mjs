#!/usr/bin/env node
/**
 * 原创程序化配乐生成器（无第三方依赖）。
 *
 *   node scripts/make-audio.mjs
 *     → public/soundtrack.wav
 *
 * 设计：
 *  - 50 秒、44.1kHz、16bit、立体声；
 *  - 柔和钢琴式分解和弦 + 低音 + 轻 pad，D 大调，速度约 60 BPM；
 *  - 和声走向与画面段落对齐（0/6/15/25/34/43 秒）；
 *  - 轻量 Schroeder 混响 + 左右轻微错位，避免干瘪；
 *  - 首尾各做淡入淡出，峰值归一化到 -4 dBFS 左右，留足动态余量。
 *
 * 全部用固定种子的伪随机数做微小人性化处理，因此每次生成结果一致。
 */

import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SAMPLE_RATE = 44100;
const DURATION = 50;
const CHANNELS = 2;
const TWO_PI = Math.PI * 2;

const here = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(here, '..', 'public', 'soundtrack.wav');
mkdirSync(dirname(outFile), {recursive: true});

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

const midiToHz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/** mulberry32：确定性伪随机。 */
const makeRandom = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const random = makeRandom(20250501);

const totalSamples = SAMPLE_RATE * DURATION;
const left = new Float32Array(totalSamples);
const right = new Float32Array(totalSamples);

const softClip = (x) => {
  // 温和的软限幅，避免个别叠加峰值破音。
  if (x > 0.9) return 0.9 + Math.tanh((x - 0.9) * 3) * 0.1;
  if (x < -0.9) return -0.9 - Math.tanh((-x - 0.9) * 3) * 0.1;
  return x;
};

/**
 * 钢琴式音色：若干泛音 + 轻微失谐 + 指数衰减。
 * 低频泛音更饱满，高音更清亮。
 */
const addPiano = ({start, midi, gain, pan = 0, decay = 2.6, brightness = 1}) => {
  const freq = midiToHz(midi);
  const startSample = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const dur = Math.min(decay * 2.2, DURATION - start) + 0.4;
  const length = Math.floor(dur * SAMPLE_RATE);
  const attack = 0.014 * SAMPLE_RATE;
  const release = 0.18 * SAMPLE_RATE;
  const tau = decay * SAMPLE_RATE;
  const hzLow = freq < 180 ? 0.9 : 1;

  const partials = [
    {mul: 1, amp: 1, detune: 0},
    {mul: 2, amp: 0.34 * brightness * hzLow, detune: 0.3},
    {mul: 3, amp: 0.16 * brightness * hzLow, detune: -0.5},
    {mul: 4, amp: 0.08 * brightness, detune: 0.7},
    {mul: 5.02, amp: 0.035 * brightness, detune: -0.9},
  ];

  const panL = Math.cos(((pan + 1) * Math.PI) / 4);
  const panR = Math.sin(((pan + 1) * Math.PI) / 4);
  const wobble = 0.0009 * (random() - 0.5);

  for (let i = 0; i < length; i++) {
    const idx = startSample + i;
    if (idx >= totalSamples) break;
    const t = i / SAMPLE_RATE;
    const attackEnv = Math.min(1, i / attack);
    const releaseEnv = i > length - release ? Math.max(0, (length - i) / release) : 1;
    const env = attackEnv * releaseEnv * Math.exp(-t / decay);
    if (env < 0.00002) continue;

    let s = 0;
    for (let p = 0; p < partials.length; p++) {
      const part = partials[p];
      const f = freq * (part.mul + wobble * (p + 1));
      s += part.amp * Math.sin(TWO_PI * f * t + part.detune);
    }
    // 轻微立体扩散：左右用不同微延迟，声像更自然。
    const delayL = Math.floor((1 - pan) * 7);
    const delayR = Math.floor((pan + 1) * 7);
    const iL = Math.max(0, i - delayL);
    const iR = Math.max(0, i - delayR);
    left[startSample + iL] = left[startSample + iL] ?? 0;
    right[startSample + iR] = right[startSample + iR] ?? 0;
    if (startSample + iL < totalSamples) left[startSample + iL] += s * gain * env * panL;
    if (startSample + iR < totalSamples) right[startSample + iR] += s * gain * env * panR;
  }
};

/** 长音 pad：慢起慢落的正弦叠加，铺底。 */
const addPad = ({start, duration, midis, gain}) => {
  const startSample = Math.floor(start * SAMPLE_RATE);
  const length = Math.min(Math.floor(duration * SAMPLE_RATE), totalSamples - startSample);
  const attack = Math.min(1.1, duration * 0.28) * SAMPLE_RATE;
  const release = Math.min(1.4, duration * 0.32) * SAMPLE_RATE;

  const voices = midis.map((midi, i) => ({
    freq: midiToHz(midi),
    phase: i * 1.7,
    detune: (i % 2 === 0 ? 1 : -1) * 0.0016,
  }));

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const envIn = Math.min(1, i / attack);
    const envOut = i > length - release ? Math.max(0, (length - i) / release) : 1;
    const env = envIn * envOut;
    if (env < 0.00005) continue;

    let l = 0;
    let r = 0;
    voices.forEach((v, vi) => {
      const f = v.freq * (1 + v.detune + 0.00035 * Math.sin(TWO_PI * 0.12 * t + v.phase));
      const a = Math.sin(TWO_PI * f * t + v.phase) + 0.22 * Math.sin(TWO_PI * f * 2 * t + v.phase * 0.5);
      const spread = vi / Math.max(1, voices.length - 1);
      l += a * (1 - spread * 0.35);
      r += a * (0.65 + spread * 0.35);
    });
    const idx = startSample + i;
    left[idx] += l * gain * env;
    right[idx] += r * gain * env;
  }
};

/** 低音：正弦 + 少量二次谐波。 */
const addBass = ({start, duration, midi, gain}) => {
  const freq = midiToHz(midi);
  const startSample = Math.floor(start * SAMPLE_RATE);
  const length = Math.min(Math.floor(duration * SAMPLE_RATE), totalSamples - startSample);
  const attack = 0.08 * SAMPLE_RATE;
  const release = 0.9 * SAMPLE_RATE;
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const envIn = Math.min(1, i / attack);
    const envOut = i > length - release ? Math.max(0, (length - i) / release) : 1;
    const env = envIn * envOut * Math.exp(-t / 9);
    const s = Math.sin(TWO_PI * freq * t) + 0.14 * Math.sin(TWO_PI * freq * 2 * t);
    const idx = startSample + i;
    left[idx] += s * gain * env * 0.95;
    right[idx] += s * gain * env;
  }
};

/* ------------------------------------------------------------------ */
/* 和声与旋律                                                          */
/* ------------------------------------------------------------------ */

/** 每个和弦：名称、起止、低音 MIDI、pad 音、分解和弦音。 */
const chords = [
  {name: 'Dmaj9', start: 0, end: 6, bass: 38, pad: [50, 57, 61, 64], arp: [62, 66, 69, 73, 76]},
  {name: 'Bm7', start: 6, end: 10.5, bass: 47, pad: [54, 57, 62, 66], arp: [59, 62, 66, 69, 71]},
  {name: 'Gmaj7', start: 10.5, end: 15, bass: 43, pad: [50, 54, 59, 62], arp: [55, 59, 62, 66, 67]},
  {name: 'Dmaj7', start: 15, end: 20, bass: 38, pad: [45, 49, 54, 57], arp: [62, 66, 69, 73, 74]},
  {name: 'A/C#', start: 20, end: 25, bass: 49, pad: [45, 52, 57, 64], arp: [61, 64, 69, 73, 76]},
  {name: 'Gmaj7', start: 25, end: 29.5, bass: 43, pad: [50, 54, 59, 62], arp: [55, 59, 62, 66, 67]},
  {name: 'Bm7', start: 29.5, end: 34, bass: 47, pad: [54, 57, 62, 66], arp: [59, 62, 66, 71, 74]},
  {name: 'Em7', start: 34, end: 38.5, bass: 40, pad: [52, 55, 59, 62], arp: [64, 67, 71, 74, 76]},
  {name: 'A7sus4', start: 38.5, end: 43, bass: 45, pad: [52, 55, 62, 64], arp: [57, 62, 64, 67, 69]},
  {name: 'Dmaj9', start: 43, end: 47, bass: 38, pad: [50, 57, 61, 64, 66], arp: [62, 66, 69, 73, 76]},
  {name: 'Dadd9', start: 47, end: 50, bass: 38, pad: [50, 57, 64, 66], arp: [62, 66, 69, 74, 78]},
];

/** 分解和弦：每 0.5s 一颗，上行下行交替，力度有细微起伏。 */
const ARP_STEP = 0.5;
for (const chord of chords) {
  const span = chord.end - chord.start;
  const steps = Math.max(2, Math.round(span / ARP_STEP));
  for (let s = 0; s < steps; s++) {
    const t = chord.start + s * (span / steps);
    const contour = [0, 1, 2, 1, 3, 2, 4, 3][s % 8];
    const midi = chord.arp[Math.min(chord.arp.length - 1, contour)];
    const velocity = 0.052 + 0.012 * Math.sin(s * 1.7) + random() * 0.008;
    addPiano({
      start: t + random() * 0.012,
      midi,
      gain: velocity,
      pan: Math.sin(s * 0.9) * 0.35,
      decay: midi > 70 ? 1.9 : 2.8,
      brightness: midi > 72 ? 1.1 : 0.9,
    });
  }
}

/** 低音与 pad 跟随和弦。 */
for (const chord of chords) {
  const span = chord.end - chord.start;
  addBass({start: chord.start, duration: Math.min(span, 4.4), midi: chord.bass, gain: 0.075});
  addPad({start: chord.start, duration: span, midis: chord.pad, gain: 0.016});
}

/** 稀疏旋律：只在几个段落出现，留白。 */
const melody = [
  {t: 2.0, midi: 78, gain: 0.05, decay: 2.2},
  {t: 3.5, midi: 76, gain: 0.045, decay: 2.4},
  {t: 5.0, midi: 73, gain: 0.042, decay: 2.6},
  {t: 8.5, midi: 74, gain: 0.05, decay: 2.4},
  {t: 10.0, midi: 71, gain: 0.042, decay: 2.8},
  {t: 12.5, midi: 69, gain: 0.05, decay: 3.0},
  {t: 14.0, midi: 66, gain: 0.04, decay: 3.0},
  {t: 17.5, midi: 73, gain: 0.05, decay: 2.4},
  {t: 19.0, midi: 76, gain: 0.046, decay: 2.2},
  {t: 22.0, midi: 74, gain: 0.045, decay: 2.6},
  {t: 23.6, midi: 69, gain: 0.04, decay: 2.8},
  {t: 27.0, midi: 71, gain: 0.046, decay: 2.4},
  {t: 29.0, midi: 74, gain: 0.045, decay: 2.2},
  {t: 33.0, midi: 71, gain: 0.044, decay: 2.6},
  {t: 35.5, midi: 72, gain: 0.048, decay: 2.4},
  {t: 37.2, midi: 71, gain: 0.04, decay: 2.6},
  {t: 39.6, midi: 69, gain: 0.048, decay: 2.8},
  {t: 41.4, midi: 67, gain: 0.042, decay: 2.8},
  {t: 44.0, midi: 74, gain: 0.05, decay: 2.6},
  {t: 45.5, midi: 76, gain: 0.048, decay: 2.4},
  {t: 47.0, midi: 78, gain: 0.052, decay: 3.2},
  {t: 48.4, midi: 74, gain: 0.045, decay: 3.4},
];

for (const note of melody) {
  addPiano({
    start: note.t,
    midi: note.midi,
    gain: note.gain,
    pan: (note.midi % 5) * 0.06 - 0.12,
    decay: note.decay,
    brightness: 1.05,
  });
}

/* ------------------------------------------------------------------ */
/* 混响与母带                                                          */
/* ------------------------------------------------------------------ */

/** 单声道 Schroeder 混响：4 个梳状 + 2 个全通，返回湿信号。 */
const buildReverb = (input, offsetSamples) => {
  const out = new Float32Array(input.length);
  const combs = [1117, 1279, 1423, 1559].map((d) => ({
    delay: d + offsetSamples,
    buffer: new Float32Array(d + offsetSamples + 1),
    index: 0,
    damp: 0,
  }));
  const allpasses = [225, 341].map((d) => ({
    delay: d + Math.floor(offsetSamples / 2),
    buffer: new Float32Array(d + Math.floor(offsetSamples / 2) + 1),
    index: 0,
  }));

  const feedback = 0.78;
  const dampAmount = 0.28;
  const wet = new Float32Array(input.length);

  for (let i = 0; i < input.length; i++) {
    let sum = 0;
    for (const c of combs) {
      const read = c.buffer[c.index];
      c.damp = read * (1 - dampAmount) + c.damp * dampAmount;
      c.buffer[c.index] = input[i] + c.damp * feedback;
      c.index = (c.index + 1) % c.buffer.length;
      sum += read;
    }
    let s = sum * 0.25;
    for (const a of allpasses) {
      const read = a.buffer[a.index];
      const written = s + read * -0.55;
      a.buffer[a.index] = written;
      a.index = (a.index + 1) % a.buffer.length;
      s = read + written * 0.55;
    }
    wet[i] = s;
  }
  return wet;
};

// 单声道发送信号
const send = new Float32Array(totalSamples);
for (let i = 0; i < totalSamples; i++) send[i] = (left[i] + right[i]) * 0.5;

const reverbL = buildReverb(send, 0);
const reverbR = buildReverb(send, 23);

const WET = 0.22;
for (let i = 0; i < totalSamples; i++) {
  left[i] += reverbL[i] * WET;
  right[i] += reverbR[i] * WET;
}

/* 首尾淡入淡出，避免爆音；与画面淡入淡出配合。 */
const fadeIn = 2.4 * SAMPLE_RATE;
const fadeOut = 4.0 * SAMPLE_RATE;
for (let i = 0; i < totalSamples; i++) {
  let g = 1;
  if (i < fadeIn) g *= Math.min(1, i / fadeIn);
  if (i > totalSamples - fadeOut) {
    g *= Math.max(0, (totalSamples - i) / fadeOut);
  }
  // 用平滑曲线而不是线性，听感更自然。
  g = g * g * (3 - 2 * g) + g * 0.35;
  left[i] *= Math.min(1, g);
  right[i] *= Math.min(1, g);
}

/* 归一化到 -4 dBFS。 */
let peak = 0;
for (let i = 0; i < totalSamples; i++) {
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
const target = 0.63;
const norm = peak > 0 ? target / peak : 1;
for (let i = 0; i < totalSamples; i++) {
  left[i] = softClip(left[i] * norm);
  right[i] = softClip(right[i] * norm);
}

/* ------------------------------------------------------------------ */
/* 写 WAV                                                              */
/* ------------------------------------------------------------------ */

const bytesPerSample = 2;
const blockAlign = CHANNELS * bytesPerSample;
const dataSize = totalSamples * blockAlign;
const buffer = Buffer.alloc(44 + dataSize);

buffer.write('RIFF', 0, 'ascii');
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8, 'ascii');
buffer.write('fmt ', 12, 'ascii');
buffer.writeUInt32LE(16, 16); // PCM chunk size
buffer.writeUInt16LE(1, 20); // PCM format
buffer.writeUInt16LE(CHANNELS, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * blockAlign, 28);
buffer.writeUInt16LE(blockAlign, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36, 'ascii');
buffer.writeUInt32LE(dataSize, 40);

let offset = 44;
for (let i = 0; i < totalSamples; i++) {
  const l = Math.max(-1, Math.min(1, left[i]));
  const r = Math.max(-1, Math.min(1, right[i]));
  buffer.writeInt16LE(Math.round(l * 32767), offset);
  buffer.writeInt16LE(Math.round(r * 32767), offset + 2);
  offset += 4;
}

writeFileSync(outFile, buffer);
console.log(`✓ 已生成 ${outFile}`);
console.log(`  ${DURATION}s / ${SAMPLE_RATE}Hz / ${CHANNELS}ch / 16bit / ${(dataSize / 1024 / 1024).toFixed(2)} MB`);
