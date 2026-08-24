import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createEmptyPlayerProgress,
  recordCompletedCampaign,
  unlockedAchievementCount,
} from "@/lib/achievements/player-progress";
import type { CompletedCampaignRecord } from "@/lib/achievements/player-progress";
import {
  AchievementScreen,
  achievementCardViewsFor,
  handleResetDialogCancel,
  showResetDialogModal,
} from "./AchievementScreen";

const completed: CompletedCampaignRecord = {
  runId: "achievement-screen-completed",
  ending: "completed",
  finalRank: "S",
  totalExpeditions: 15,
  clearedExpeditions: 15,
  wipedExpeditions: 0,
  deaths: 0,
  advices: 100,
};

function renderEmptyGallery(): string {
  const progress = createEmptyPlayerProgress();
  return renderToStaticMarkup(createElement(AchievementScreen, {
    cards: achievementCardViewsFor(progress),
    unlockedCount: unlockedAchievementCount(progress),
    status: "ready",
    message: null,
    onClear: () => {},
  }));
}

describe("길잡이 업적 기록 화면", () => {
  it("잠금과 해금을 색 이외의 문구로 구분한다", () => {
    const progress = recordCompletedCampaign(createEmptyPlayerProgress(), completed, "2026-08-24T10:00:00.000Z");
    const html = renderToStaticMarkup(createElement(AchievementScreen, {
      cards: achievementCardViewsFor(progress),
      unlockedCount: unlockedAchievementCount(progress),
      status: "ready",
      message: null,
      onClear: () => {},
    }));

    expect(html).toContain("달성 완료");
    expect(html).toContain("미달성");
    expect(html).toContain('href="/"');
    expect(html).toContain('dateTime="2026-08-24T10:00:00.000Z"');
  });

  it("숨은 업적은 잠긴 동안 이름과 진행도를 감춘다", () => {
    const html = renderEmptyGallery();

    expect(html).toContain("알 수 없는 기록");
    expect(html).not.toContain("다섯 갈래의 결말");
    expect(html).not.toContain("0 / 5");
  });

  it("공개 누적 업적은 접근 가능한 진행도를 제공한다", () => {
    const html = renderEmptyGallery();

    expect(html).toMatch(/role="progressbar"[^>]*aria-valuemax="100"[^>]*aria-valuenow="0"/);
    expect(html).toContain("0 / 100");
  });

  it("문턱을 넘긴 누적 기록은 실제 수치를 보이되 접근 가능한 진행도는 목표에서 멈춘다", () => {
    const progress = recordCompletedCampaign(createEmptyPlayerProgress(), {
      ...completed,
      runId: "achievement-screen-over-target",
      advices: 101,
    }, "2026-08-24T10:00:00.000Z");
    const html = renderToStaticMarkup(createElement(AchievementScreen, {
      cards: achievementCardViewsFor(progress),
      unlockedCount: unlockedAchievementCount(progress),
      status: "ready",
      message: null,
      onClear: () => {},
    }));

    expect(html).toContain("101 / 100");
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuemax="100"[^>]*aria-valuenow="100"/);
  });

  it("초기화 확인은 모델리스 open 속성 없이 취소부터 자동 초점을 둔다", () => {
    const progress = createEmptyPlayerProgress();
    const html = renderToStaticMarkup(createElement(AchievementScreen, {
      cards: achievementCardViewsFor(progress),
      unlockedCount: 0,
      status: "ready",
      message: null,
      confirming: true,
      onRequestClear: () => {},
      onCancelClear: () => {},
      onClear: () => {},
    }));

    expect(html).toContain("업적 기록 초기화");
    expect(html).toMatch(/<dialog[^>]*aria-modal="true"/);
    expect(html).not.toMatch(/<dialog[^>]*\sopen=/);
    expect(html.indexOf("취소")).toBeLessThan(html.indexOf("정말 초기화"));
    expect(html).toContain("autofocus");
  });

  it("dialog mount는 native modal을 열고 cleanup은 열린 dialog를 닫는다", () => {
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

    const cleanup = showResetDialogModal(dialog);

    expect(dialog.open).toBe(true);
    expect(calls).toEqual(["showModal"]);

    cleanup();

    expect(dialog.open).toBe(false);
    expect(calls).toEqual(["showModal", "close"]);
  });

  it("native cancel은 기본 닫힘 대신 onCancelClear 상태 경로를 사용한다", () => {
    let prevented = false;
    let cancelled = false;

    handleResetDialogCancel(
      { preventDefault: () => { prevented = true; } },
      () => { cancelled = true; },
    );

    expect(prevented).toBe(true);
    expect(cancelled).toBe(true);
  });
});
