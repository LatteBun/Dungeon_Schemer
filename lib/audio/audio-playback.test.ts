import { describe, expect, it } from "vitest";
import { createAudioPlaybackController } from "./audio-playback";
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

describe("오디오 재생 controller", () => {
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
});
