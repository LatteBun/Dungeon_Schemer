import { afterEach, describe, expect, it, vi } from "vitest";
import { createAudioPlaybackController, createBrowserAudioPlayback } from "./audio-playback";
import type { AudioElementPort } from "./audio-playback";

interface FakeAudioElement extends AudioElementPort {
  playCalls: number;
  pauseCalls: number;
}

function fakeAudioElement(playError?: Error): FakeAudioElement {
  return {
    currentTime: 0,
    loop: false,
    volume: 1,
    playCalls: 0,
    pauseCalls: 0,
    play() {
      this.playCalls += 1;
      return playError === undefined ? Promise.resolve() : Promise.reject(playError);
    },
    pause() {
      this.pauseCalls += 1;
    },
  };
}

function installWebAudioHarness() {
  const sources: Array<{
    buffer: { duration: number } | null;
    loop: boolean;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];
  const gain = {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const context = {
    currentTime: 0,
    destination: {},
    state: "running",
    close: vi.fn().mockResolvedValue(undefined),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null,
        loop: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      sources.push(source);
      return source;
    }),
    createGain: vi.fn(() => gain),
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 64 }),
    resume: vi.fn().mockResolvedValue(undefined),
  };

  class FakeAudio {
    currentTime = 0;
    loop = false;
    volume = 1;
    play() {
      return Promise.resolve();
    }
    pause() {}
  }

  function FakeAudioContext() {
    return context;
  }

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  });
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("fetch", fetchMock);
  return { context, fetchMock, gain, sources };
}

describe("오디오 재생 controller", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("BGM loop와 고정 음량을 적용하고 UI 효과음을 처음부터 다시 튼다", async () => {
    const bgm = fakeAudioElement();
    const select = fakeAudioElement();
    const menu = fakeAudioElement();
    const controller = createAudioPlaybackController({ bgm, select, menu });

    expect(bgm.loop).toBe(true);
    expect(bgm.volume).toBe(0.25);
    expect(select.volume).toBe(0.28);
    expect(menu.volume).toBe(0.28);

    await controller.playBgm();
    expect(bgm.playCalls).toBe(1);
    controller.pauseBgm();
    expect(bgm.pauseCalls).toBe(1);

    select.currentTime = 0.1;
    await controller.playUiSound("select");
    expect(select.currentTime).toBe(0);
    expect(select.playCalls).toBe(1);

    menu.currentTime = 0.2;
    await controller.playUiSound("menu");
    expect(menu.currentTime).toBe(0);
    expect(menu.playCalls).toBe(1);
  });

  it("재생 거부를 caller에 전달하고 dispose에서 세 element를 멈춘다", async () => {
    const error = new Error("autoplay blocked");
    const bgm = fakeAudioElement(error);
    const select = fakeAudioElement(error);
    const menu = fakeAudioElement();
    const controller = createAudioPlaybackController({ bgm, select, menu });

    await expect(controller.playBgm()).rejects.toBe(error);
    await expect(controller.playUiSound("select")).rejects.toBe(error);

    controller.dispose();
    expect(bgm.pauseCalls).toBe(1);
    expect(select.pauseCalls).toBe(1);
    expect(menu.pauseCalls).toBe(1);
  });

  it("브라우저 BGM은 Audio element 재시작 대신 sample-accurate buffer loop를 사용한다", async () => {
    const audioSources: string[] = [];
    const createSource = () => ({
      buffer: null as { duration: number } | null,
      loop: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    });
    const source = createSource();
    const resumedSource = createSource();
    const sources = [source, resumedSource];
    const gain = {
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const context = {
      currentTime: 3,
      destination: {},
      state: "running",
      close: vi.fn().mockResolvedValue(undefined),
      createBufferSource: vi.fn(() => sources.shift()!),
      createGain: vi.fn(() => gain),
      decodeAudioData: vi.fn().mockResolvedValue({ duration: 64 }),
      resume: vi.fn().mockResolvedValue(undefined),
    };

    class FakeAudio {
      currentTime = 0;
      loop = false;
      volume = 1;

      constructor(src: string) {
        audioSources.push(src);
      }

      play() {
        return Promise.resolve();
      }

      pause() {}
    }

    function FakeAudioContext() {
      return context;
    }

    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }));

    const controller = createBrowserAudioPlayback();
    await controller.playBgm();

    expect(audioSources).toEqual([
      "/assets/audio/ui-select.wav",
      "/assets/audio/ui-menu.wav",
    ]);
    expect(context.decodeAudioData).toHaveBeenCalledOnce();
    expect(source.buffer).toEqual({ duration: 64 });
    expect(source.loop).toBe(true);
    expect(source.start).toHaveBeenCalledWith(0, 0);
    expect(gain.gain.value).toBe(0.25);

    context.currentTime = 11;
    controller.pauseBgm();
    await controller.playBgm();

    expect(source.stop).toHaveBeenCalledOnce();
    expect(context.createBufferSource).toHaveBeenCalledTimes(2);
    expect(context.decodeAudioData).toHaveBeenCalledOnce();
    expect(gain.connect).toHaveBeenCalledOnce();
    expect(resumedSource.loop).toBe(true);
    expect(resumedSource.start).toHaveBeenCalledWith(0, 8);

    controller.dispose();
    expect(resumedSource.stop).toHaveBeenCalledOnce();
    expect(gain.disconnect).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("활성 BGM의 AudioContext가 suspend되면 기존 source를 유지한 채 resume한다", async () => {
    const { context, sources } = installWebAudioHarness();
    const controller = createBrowserAudioPlayback();
    await controller.playBgm();
    expect(sources).toHaveLength(1);

    context.state = "suspended";
    await controller.playBgm();

    expect(context.resume).toHaveBeenCalledOnce();
    expect(sources).toHaveLength(1);
  });

  it("BGM decode를 기다리는 동안 pause하면 완료 뒤 source를 시작하지 않는다", async () => {
    let finishDecode!: (buffer: { duration: number }) => void;
    const decode = new Promise<{ duration: number }>((resolve) => {
      finishDecode = resolve;
    });
    const { context, sources } = installWebAudioHarness();
    context.decodeAudioData.mockReturnValueOnce(decode);
    const controller = createBrowserAudioPlayback();

    const pendingPlay = controller.playBgm();
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce());
    controller.pauseBgm();
    finishDecode({ duration: 64 });
    await pendingPlay;

    expect(sources).toHaveLength(0);
  });

  it("일시적인 BGM load 실패 뒤 다음 play에서 다시 decode한다", async () => {
    const { context, sources } = installWebAudioHarness();
    const loadError = new Error("temporary decode failure");
    context.decodeAudioData
      .mockRejectedValueOnce(loadError)
      .mockResolvedValueOnce({ duration: 64 });
    const controller = createBrowserAudioPlayback();

    await expect(controller.playBgm()).rejects.toBe(loadError);
    await controller.playBgm();

    expect(context.decodeAudioData).toHaveBeenCalledTimes(2);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.start).toHaveBeenCalledOnce();
  });
});
