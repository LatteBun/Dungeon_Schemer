import { describe, expect, it } from "vitest";
import {
  handleAchievementOverlayCancel,
  showAchievementOverlayModal,
} from "./AchievementOverlay";

describe("업적 기록 overlay", () => {
  it("mount에서 native modal을 열고 cleanup에서 열린 dialog를 닫는다", () => {
    const calls: string[] = [];
    const dialog = {
      open: false,
      showModal() {
        calls.push("showModal");
        this.open = true;
      },
      close() {
        calls.push("close");
        this.open = false;
      },
    };

    const cleanup = showAchievementOverlayModal(dialog);
    expect(dialog.open).toBe(true);
    expect(calls).toEqual(["showModal"]);

    cleanup();
    expect(dialog.open).toBe(false);
    expect(calls).toEqual(["showModal", "close"]);
  });

  it("Escape cancel은 native 기본 닫힘 대신 React close 경로를 사용한다", () => {
    let prevented = false;
    let closed = false;

    handleAchievementOverlayCancel(
      { preventDefault: () => { prevented = true; } },
      () => { closed = true; },
    );

    expect({ prevented, closed }).toEqual({ prevented: true, closed: true });
  });
});
