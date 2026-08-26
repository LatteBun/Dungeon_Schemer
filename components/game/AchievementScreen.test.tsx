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
import { AchievementStorageDiagnostics } from "./AchievementStorageDiagnostics";

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
    backAction: { kind: "link", href: "/" },
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
      backAction: { kind: "link", href: "/" },
      onClear: () => {},
    }));

    expect(html).toContain("달성 완료");
    expect(html).toContain("미달성");
    expect(html).toContain('href="/"');
    expect(html).toContain('dateTime="2026-08-24T10:00:00.000Z"');
  });

  it("모든 미달성 업적은 이름과 조건과 진행도를 감춘다", () => {
    const html = renderEmptyGallery();

    expect(html.match(/>\?\?\?<\/h2>/g)).toHaveLength(12);
    expect(html).toContain("조건을 달성하면 기록이 공개됩니다.");
    expect(html).not.toContain("알 수 없는 기록");
    expect(html).not.toContain("첫 기록</h2>");
    expect(html).not.toContain("다섯 갈래의 결말");
    expect(html).not.toContain("0 / 5");
    expect(html).not.toContain('role="progressbar"');
  });

  it("미달성 문양은 잘리지 않는 이미지 슬롯 안에서 잠금 베일로 가린다", () => {
    const html = renderEmptyGallery();

    expect(html.match(/class="achievement-card__image is-obscured"/g)).toHaveLength(12);
    expect(html.match(/data-nimg="fill"/g)).toHaveLength(12);
    expect(html.match(/class="achievement-card__lock" aria-hidden="true"/g)).toHaveLength(12);
  });

  it("달성한 누적 업적만 접근 가능한 진행도를 제공한다", () => {
    const progress = recordCompletedCampaign(createEmptyPlayerProgress(), completed, "2026-08-24T10:00:00.000Z");
    const html = renderToStaticMarkup(createElement(AchievementScreen, {
      cards: achievementCardViewsFor(progress),
      unlockedCount: unlockedAchievementCount(progress),
      status: "ready",
      message: null,
      backAction: { kind: "link", href: "/" },
      onClear: () => {},
    }));

    expect(html).toMatch(/role="progressbar"[^>]*aria-valuemax="100"[^>]*aria-valuenow="100"/);
    expect(html).toContain("100 / 100");
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
      backAction: { kind: "link", href: "/" },
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
      backAction: { kind: "link", href: "/" },
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

  it("독립 화면은 검증된 링크로 이전 화면 CTA를 렌더한다", () => {
    const html = renderToStaticMarkup(createElement(AchievementScreen, {
      cards: achievementCardViewsFor(createEmptyPlayerProgress()),
      unlockedCount: 0,
      status: "ready",
      message: null,
      backAction: { kind: "link", href: "/campaign?seed=return-test" },
      onClear: () => {},
    }));

    expect(html).toContain('href="/campaign?seed=return-test"');
    expect(html).toContain("이전 화면으로");
    expect(html).not.toContain("메인 메뉴로");
  });

  it("overlay는 route 이동 없는 button 이전 동작을 렌더한다", () => {
    const html = renderToStaticMarkup(createElement(AchievementScreen, {
      cards: achievementCardViewsFor(createEmptyPlayerProgress()),
      unlockedCount: 0,
      status: "ready",
      message: null,
      backAction: { kind: "button", onActivate: () => {} },
      onClear: () => {},
    }));

    expect(html).toMatch(/<button class="shell-cta" type="button">이전 화면으로<\/button>/);
    expect(html).not.toContain('href="/"');
  });

  it("달성 수를 히든 진단 트리거 버튼으로 렌더한다", () => {
    const html = renderEmptyGallery();

    expect(html).toMatch(/<button[^>]*class="game-shell__status-chip achievement-screen__count"/);
    expect(html).toContain("달성 <strong>0</strong> / 12");
  });

  it("진단 open 상태는 저장 원문과 세 동작을 렌더한다", () => {
    const html = renderToStaticMarkup(createElement(AchievementStorageDiagnostics, {
      snapshot: {
        version: 1,
        collectedAt: "2026-08-26T12:00:00.000Z",
        userAgent: "test-agent",
        status: "ready",
        reason: null,
        campaign: { seed: "report-seed", actionCount: 2, latestActionType: "OPEN_BOARD" },
        entries: [{ key: "dungeon-schemer.campaign-run.v1", format: "json", raw: "{}", display: "{}" }],
      },
      copyStatus: "idle",
      confirmingClear: false,
      onCopy: () => {},
      onRequestClear: () => {},
      onClose: () => {},
    }));

    expect(html).toContain("브라우저 저장 진단");
    expect(html).toContain("report-seed");
    expect(html).toContain("dungeon-schemer.campaign-run.v1");
    expect(html).toContain("전체 복사");
    expect(html).toContain("캠페인 초기화");
    expect(html).toContain("닫기");
  });

  it("캠페인 초기화 확인은 보존 범위와 취소·확정 동작을 표시한다", () => {
    const html = renderToStaticMarkup(createElement(AchievementStorageDiagnostics, {
      snapshot: {
        version: 1,
        collectedAt: "2026-08-26T12:00:00.000Z",
        userAgent: "test-agent",
        status: "ready",
        reason: null,
        campaign: null,
        entries: [],
      },
      copyStatus: "idle",
      confirmingClear: true,
      onCopy: () => {},
      onRequestClear: () => {},
      onCancelClear: () => {},
      onConfirmClear: () => {},
      onClose: () => {},
    }));

    expect(html).toContain("진행 중인 캠페인만 초기화합니다.");
    expect(html).toContain("업적 기록과 오디오 설정은 그대로 유지됩니다.");
    expect(html).toContain("취소");
    expect(html).toContain("캠페인 초기화 확인");
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
