import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface ParsedWav {
  readonly audioFormat: number;
  readonly channels: number;
  readonly sampleRate: number;
  readonly bitsPerSample: number;
  readonly duration: number;
  readonly peak: number;
  readonly mean: number;
  readonly frames: readonly number[][];
}

function readWav(path: string): ParsedWav {
  const buffer = readFileSync(path);
  expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
  expect(buffer.toString("ascii", 8, 12)).toBe("WAVE");
  expect(buffer.toString("ascii", 12, 16)).toBe("fmt ");
  expect(buffer.toString("ascii", 36, 40)).toBe("data");

  const audioFormat = buffer.readUInt16LE(20);
  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataBytes = buffer.readUInt32LE(40);
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = dataBytes / bytesPerSample / channels;
  const frames = Array.from({ length: channels }, () => new Array<number>(frameCount));
  let peak = 0;
  let total = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const offset = 44 + (frame * channels + channel) * bytesPerSample;
      const sample = buffer.readInt16LE(offset);
      frames[channel][frame] = sample;
      peak = Math.max(peak, Math.abs(sample));
      total += sample;
    }
  }

  return {
    audioFormat,
    channels,
    sampleRate,
    bitsPerSample,
    duration: frameCount / sampleRate,
    peak,
    mean: total / frameCount / channels,
    frames,
  };
}

const assetPath = (name: string) => join(process.cwd(), "public", "assets", "audio", name);

describe("로컬 오디오 자산", () => {
  it.each([
    ["dungeon-schemer-guild-loop.wav", 2, 64, 0.02],
    ["ui-select.wav", 1, 0.15, 0.04],
    ["ui-menu.wav", 1, 0.23, 0.04],
  ] as const)("%s은 브라우저용 PCM WAV 계약을 지킨다", (name, channels, seconds, tolerance) => {
    const wav = readWav(assetPath(name));

    expect(wav.audioFormat).toBe(1);
    expect(wav.channels).toBe(channels);
    expect(wav.sampleRate).toBe(22_050);
    expect(wav.bitsPerSample).toBe(16);
    expect(Math.abs(wav.duration - seconds)).toBeLessThanOrEqual(tolerance);
    expect(wav.peak).toBeGreaterThan(Math.round(32_767 * 0.25));
    expect(wav.peak).toBeLessThanOrEqual(Math.round(32_767 * 10 ** (-1 / 20)));
    expect(Math.abs(wav.mean)).toBeLessThan(80);
  });

  it("BGM의 첫 frame과 마지막 frame이 loop seam에서 튀지 않는다", () => {
    const wav = readWav(assetPath("dungeon-schemer-guild-loop.wav"));

    for (const channel of wav.frames) {
      expect(Math.abs(channel[0] - channel.at(-1)!)).toBeLessThan(1_200);
    }
  });

  it.each(["ui-select.wav", "ui-menu.wav"])("%s은 끝에서 무음으로 감쇠한다", (name) => {
    const wav = readWav(assetPath(name));
    const tail = wav.frames[0].slice(-128);

    expect(Math.max(...tail.map(Math.abs))).toBeLessThanOrEqual(240);
  });
});
