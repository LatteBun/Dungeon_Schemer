import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 22_050;
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

function addPluck(left, right, startSeconds, frequency, pan) {
  const frameCount = Math.round(1.25 * SAMPLE_RATE);
  const startFrame = Math.round(startSeconds * SAMPLE_RATE);
  const leftGain = 0.105 * (1 - pan * 0.45);
  const rightGain = 0.105 * (1 + pan * 0.45);

  for (let frame = 0; frame < frameCount && startFrame + frame < left.length; frame += 1) {
    const age = frame / SAMPLE_RATE;
    const envelope = Math.exp(-4.8 * age);
    const sample = envelope * (
      Math.sin(2 * Math.PI * frequency * age)
      + 0.32 * Math.sin(4 * Math.PI * frequency * age)
    );
    left[startFrame + frame] += sample * leftGain;
    right[startFrame + frame] += sample * rightGain;
  }
}

function addFrameDrum(left, right, startSeconds, random) {
  const frameCount = Math.round(0.22 * SAMPLE_RATE);
  const startFrame = Math.round(startSeconds * SAMPLE_RATE);

  for (let frame = 0; frame < frameCount && startFrame + frame < left.length; frame += 1) {
    const age = frame / SAMPLE_RATE;
    const envelope = Math.exp(-18 * age);
    const noise = random() * 2 - 1;
    const body = Math.sin(2 * Math.PI * 58 * age);
    const sample = envelope * (noise * 0.09 + body * 0.11);
    left[startFrame + frame] += sample * 0.92;
    right[startFrame + frame] += sample;
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
  const pulseFrequency = quantizedHz(55, BGM_SECONDS);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / SAMPLE_RATE;
    const seam = Math.sin(Math.PI * time / BGM_SECONDS) ** 2;
    const airPulse = 0.65 + 0.35 * Math.sin(2 * Math.PI * time / 16);
    const leftAir = (random() * 2 - 1) * 0.018 * airPulse * seam;
    const rightAir = (random() * 2 - 1) * 0.018 * airPulse * seam;
    const pulse = 0.025 * Math.sin(2 * Math.PI * pulseFrequency * time)
      * (0.5 - 0.5 * Math.cos(2 * Math.PI * time / 4));

    left[frame] = 0.20 * Math.sin(2 * Math.PI * lowDrone * time)
      + 0.10 * Math.sin(2 * Math.PI * highDrone * time + 0.35)
      + leftAir
      + pulse;
    right[frame] = 0.20 * Math.sin(2 * Math.PI * lowDrone * time + 0.05)
      + 0.10 * Math.sin(2 * Math.PI * highDrone * time - 0.35)
      + rightAir
      + pulse * 0.93;
  }

  const notes = [146.83, 174.61, 220, 261.63, 220, 174.61, 196, 146.83];
  for (let bar = 0; bar < 16; bar += 1) {
    const barStart = bar * 4;
    const note = notes[bar % notes.length];
    const pan = ((bar % 5) - 2) / 2;
    addPluck(left, right, barStart + 2, note, pan);
    if (bar !== 15) addPluck(left, right, barStart + 3.5, note * 1.5, -pan);

    if (bar !== 0) addFrameDrum(left, right, barStart, random);
    if (bar !== 15) addFrameDrum(left, right, barStart + 2.75, random);
  }

  const delays = [[0.19, 0.13], [0.31, 0.09], [0.47, 0.06]];
  return normalizeChannels([
    circularDelay(left, delays),
    circularDelay(right, delays),
  ]);
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
