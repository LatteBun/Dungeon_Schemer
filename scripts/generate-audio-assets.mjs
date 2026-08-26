import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44_100;
const PCM_MAX = 32_767;
const PEAK = 10 ** (-1 / 20);
const BGM_SECONDS = 64;
const SEED = 0x44534348;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(SCRIPT_DIR, "..", "public", "assets", "audio");

function quantizedHz(hz, seconds) {
  return Math.round(hz * seconds) / seconds;
}

function xorshift32(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
}

function softClip(sample) {
  return Math.tanh(sample * 1.15) / Math.tanh(1.15);
}

function removeMean(samples) {
  let total = 0;
  for (const sample of samples) total += sample;
  const mean = total / samples.length;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] -= mean;
  }
}

function normalizeChannels(channels) {
  for (const channel of channels) removeMean(channel);

  let peak = 0;
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = softClip(channel[index]);
    }
    removeMean(channel);
    for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  }

  const gain = peak === 0 ? 1 : (PEAK * 0.98) / peak;
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] *= gain;
    }
  }
  return channels;
}

function writePcm16Wav(path, channels) {
  const frameCount = channels[0].length;
  if (channels.some((channel) => channel.length !== frameCount)) {
    throw new Error("All WAV channels must have the same frame count");
  }

  const channelCount = channels.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataBytes = frameCount * blockAlign;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (const channel of channels) {
      const pcm = Math.max(-PCM_MAX, Math.min(PCM_MAX, Math.round(channel[frame] * PCM_MAX)));
      buffer.writeInt16LE(pcm, offset);
      offset += bytesPerSample;
    }
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
}

function panGains(pan) {
  const angle = (pan + 1) * Math.PI / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

function triangle(phase) {
  return 2 * Math.asin(Math.sin(phase)) / Math.PI;
}

function addWrapped(left, right, startFrame, frame, sample, leftGain, rightGain) {
  const target = (startFrame + frame) % left.length;
  left[target] += sample * leftGain;
  right[target] += sample * rightGain;
}

function addLute(left, right, startSeconds, frequency, amplitude, pan, seed) {
  const frameCount = Math.round(2.45 * SAMPLE_RATE);
  const startFrame = Math.round(startSeconds * SAMPLE_RATE);
  const delayLength = Math.max(2, Math.round(SAMPLE_RATE / frequency));
  const string = new Float64Array(delayLength);
  const random = xorshift32(seed);
  const [leftGain, rightGain] = panGains(pan);
  let body = 0;
  let cursor = 0;

  for (let index = 0; index < string.length; index += 1) {
    string[index] = (random() * 2 - 1) * Math.sin(Math.PI * index / string.length);
  }

  for (let frame = 0; frame < frameCount; frame += 1) {
    const age = frame / SAMPLE_RATE;
    const nextIndex = (cursor + 1) % delayLength;
    const next = 0.9962 * (0.505 * string[cursor] + 0.495 * string[nextIndex]);
    string[cursor] = next;
    body = body * 0.91 + next * 0.09;
    const finger = frame < SAMPLE_RATE * 0.012
      ? (random() * 2 - 1) * Math.exp(-180 * age) * 0.13
      : 0;
    const envelope = Math.min(1, age / 0.008) * Math.exp(-0.2 * age);
    const sample = (next * 0.76 + body * 0.34 + finger) * amplitude * envelope;
    addWrapped(left, right, startFrame, frame, sample, leftGain, rightGain);
    cursor = nextIndex;
  }
}

function addDulcimer(left, right, startSeconds, frequency, amplitude, pan, seed) {
  const frameCount = Math.round(3 * SAMPLE_RATE);
  const startFrame = Math.round(startSeconds * SAMPLE_RATE);
  const [leftGain, rightGain] = panGains(pan);
  const random = xorshift32(seed);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const age = frame / SAMPLE_RATE;
    const strike = Math.exp(-95 * age);
    const decay = Math.exp(-1.45 * age);
    const shimmer = Math.sin(2 * Math.PI * frequency * age)
      + 0.54 * Math.sin(2 * Math.PI * frequency * 2.006 * age + 0.2)
      + 0.24 * Math.sin(2 * Math.PI * frequency * 3.998 * age + 0.7)
      + 0.1 * Math.sin(2 * Math.PI * frequency * 6.03 * age + 1.1);
    const hammer = (random() * 2 - 1) * strike * 0.22;
    addWrapped(left, right, startFrame, frame, (shimmer * decay + hammer) * amplitude, leftGain, rightGain);
  }
}

function addFrameDrum(left, right, startSeconds, amplitude, seed) {
  const frameCount = Math.round(0.75 * SAMPLE_RATE);
  const startFrame = Math.round(startSeconds * SAMPLE_RATE);
  const random = xorshift32(seed);
  let noiseBody = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const age = frame / SAMPLE_RATE;
    noiseBody = noiseBody * 0.86 + (random() * 2 - 1) * 0.14;
    const pitch = 62 - 24 * Math.min(1, age / 0.28);
    const skin = Math.sin(2 * Math.PI * pitch * age) * Math.exp(-7.6 * age);
    const brush = noiseBody * Math.exp(-16 * age) * 0.22;
    addWrapped(left, right, startFrame, frame, (skin + brush) * amplitude, 0.94, 1);
  }
}

function addBreathyPipe(left, right, startSeconds, duration, frequency, amplitude, pan, seed) {
  const frameCount = Math.round(duration * SAMPLE_RATE);
  const startFrame = Math.round(startSeconds * SAMPLE_RATE);
  const [leftGain, rightGain] = panGains(pan);
  const random = xorshift32(seed);
  let air = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const age = frame / SAMPLE_RATE;
    const release = Math.max(0, duration - age);
    const envelope = Math.min(1, age / 0.35, release / 0.55);
    air = air * 0.975 + (random() * 2 - 1) * 0.025;
    const vibrato = 1 + 0.0026 * Math.sin(2 * Math.PI * 4.7 * age);
    const phase = 2 * Math.PI * frequency * vibrato * age;
    const sample = (
      0.72 * Math.sin(phase)
      + 0.17 * Math.sin(phase * 2)
      + 0.07 * Math.sin(phase * 3)
      + 0.055 * air
    ) * amplitude * envelope;
    addWrapped(left, right, startFrame, frame, sample, leftGain, rightGain);
  }
}

function circularDelay(source, delays) {
  const output = new Float64Array(source.length);
  const delayFrames = delays.map(([seconds, gain]) => [Math.round(seconds * SAMPLE_RATE), gain]);

  for (let frame = 0; frame < source.length; frame += 1) {
    let sample = source[frame];
    for (const [delay, gain] of delayFrames) {
      const delayedFrame = (frame - delay + source.length) % source.length;
      sample += source[delayedFrame] * gain;
    }
    output[frame] = sample;
  }
  return output;
}

function createGuildLoop() {
  const frameCount = BGM_SECONDS * SAMPLE_RATE;
  const left = new Float64Array(frameCount);
  const right = new Float64Array(frameCount);
  const random = xorshift32(SEED);
  const lowDrone = quantizedHz(73.42, BGM_SECONDS);
  const highDrone = quantizedHz(110, BGM_SECONDS);
  const upperDrone = quantizedHz(146.83, BGM_SECONDS);
  const lowHarmonic = quantizedHz(73.42 * 2.002, BGM_SECONDS);
  const highHarmonic = quantizedHz(110 * 2.003, BGM_SECONDS);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / SAMPLE_RATE;
    const seam = Math.sin(Math.PI * time / BGM_SECONDS) ** 2;
    const slowPhase = 0.012 * Math.sin(2 * Math.PI * time / 16);
    const lowPhase = 2 * Math.PI * lowDrone * time + slowPhase;
    const highPhase = 2 * Math.PI * highDrone * time - slowPhase * 0.7;
    const upperPhase = 2 * Math.PI * upperDrone * time + slowPhase * 0.4;
    const lowHarmonicPhase = 2 * Math.PI * lowHarmonic * time + slowPhase * 1.3;
    const highHarmonicPhase = 2 * Math.PI * highHarmonic * time - slowPhase * 1.1;
    const swell = 0.7 + 0.18 * Math.sin(2 * Math.PI * time / 32 + 0.3);
    const air = (random() * 2 - 1) * 0.0065 * seam;
    const lowBow = 0.11 * triangle(lowPhase) + 0.032 * Math.sin(lowHarmonicPhase);
    const highBow = 0.042 * triangle(highPhase) + 0.016 * Math.sin(highHarmonicPhase);
    const upperBow = 0.013 * triangle(upperPhase);

    left[frame] = (lowBow + highBow + upperBow) * swell + air;
    right[frame] = (lowBow * 0.93 + highBow * 1.04 + upperBow * 0.88) * swell - air * 0.7;
  }

  const notes = [
    146.83, 174.61, 220, 196,
    233.08, 220, 196, 174.61,
    146.83, 174.61, 233.08, 220,
    196, 174.61, 164.81, 146.83,
  ];
  const chordRoots = [73.42, 58.27, 65.41, 73.42];
  for (let bar = 0; bar < 16; bar += 1) {
    const barStart = bar * 4;
    const note = notes[bar];
    const pan = bar % 2 === 0 ? -0.34 : 0.34;
    const chordRoot = chordRoots[Math.floor(bar / 4)];

    addLute(left, right, barStart + 0.28, chordRoot, 0.085, -0.3, SEED ^ (0x1100 + bar));
    addLute(left, right, barStart + 0.33, chordRoot * 1.5, 0.05, 0.28, SEED ^ (0x2100 + bar));
    addDulcimer(left, right, barStart + 1.25, note, bar % 4 === 0 ? 0.03 : 0.024, pan, SEED ^ (0x3100 + bar));
    if (bar % 4 === 2) {
      addLute(left, right, barStart + 2.72, note / 2, 0.041, 0.1, SEED ^ (0x4100 + bar));
    }

    addFrameDrum(left, right, barStart + 0.12, bar % 4 === 0 ? 0.035 : 0.024, SEED ^ (0x5100 + bar));
    if (bar % 2 === 0) {
      addFrameDrum(left, right, barStart + 2.88, 0.018, SEED ^ (0x6100 + bar));
    }
  }

  addBreathyPipe(left, right, 8.2, 2.65, 293.66, 0.0115, 0.46, SEED ^ 0x7101);
  addBreathyPipe(left, right, 24.35, 2.75, 261.63, 0.011, -0.42, SEED ^ 0x7102);
  addBreathyPipe(left, right, 40.4, 2.5, 220, 0.0105, 0.36, SEED ^ 0x7103);
  addBreathyPipe(left, right, 53.1, 2.25, 196, 0.01, -0.32, SEED ^ 0x7104);

  const delays = [[0.071, 0.1], [0.127, 0.078], [0.211, 0.058], [0.347, 0.041], [0.563, 0.027]];
  const delayedLeft = circularDelay(left, delays);
  const delayedRight = circularDelay(right, delays);
  return normalizeChannels([delayedLeft, delayedRight]);
}

function applyFadeOut(samples, frameCount = 1_024) {
  const fadeFrames = Math.min(frameCount, samples.length);
  const start = samples.length - fadeFrames;
  for (let frame = start; frame < samples.length; frame += 1) {
    const remaining = samples.length - 1 - frame;
    samples[frame] *= remaining / Math.max(1, fadeFrames - 1);
  }
}

function createSelectSound() {
  const frameCount = Math.round(0.15 * SAMPLE_RATE);
  const samples = new Float64Array(frameCount);
  const random = xorshift32(SEED ^ 0x53454c45);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / SAMPLE_RATE;
    const envelope = Math.exp(-30 * time);
    samples[frame] = envelope * (
      0.08 * (random() * 2 - 1)
      + 0.52 * Math.sin(2 * Math.PI * 145 * time)
      + 0.30 * Math.sin(2 * Math.PI * 230 * time)
    );
  }
  applyFadeOut(samples);
  return normalizeChannels([samples]);
}

function createMenuSound() {
  const frameCount = Math.round(0.23 * SAMPLE_RATE);
  const samples = new Float64Array(frameCount);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / SAMPLE_RATE;
    const strike = Math.exp(-18 * time) * (
      0.55 * Math.sin(2 * Math.PI * 620 * time)
      + 0.32 * Math.sin(2 * Math.PI * 930 * time)
    );
    const echoAge = time - 0.045;
    const echo = echoAge < 0
      ? 0
      : 0.25 * Math.exp(-22 * echoAge) * Math.sin(2 * Math.PI * 470 * echoAge);
    samples[frame] = strike + echo;
  }
  applyFadeOut(samples);
  return normalizeChannels([samples]);
}

const assets = [
  ["dungeon-schemer-guild-loop.wav", createGuildLoop()],
  ["ui-select.wav", createSelectSound()],
  ["ui-menu.wav", createMenuSound()],
];

for (const [name, channels] of assets) {
  const path = join(OUTPUT_DIR, name);
  writePcm16Wav(path, channels);
  process.stdout.write(`generated ${name}\n`);
}
