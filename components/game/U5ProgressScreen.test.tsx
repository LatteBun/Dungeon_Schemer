import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U5ProgressScreen } from "./U5ProgressScreen";
import type { U5EcologyView, U5LogEntry } from "./u5-log";
import type { U5ProgressView } from "./u5-progress-model";
import type { TopStatusView } from "./TopStatusBar";

const status: TopStatusView = {
  rank: "C",
  reputation: 74,
  gold: 186,
  canPromote: false,
  remainingDungeons: 11,
};

const log: readonly U5LogEntry[] = [
  { order: 1, tags: ["ecology"], label: "생태 공개", detail: "거미는 불을 피한다" },
  { order: 2, tags: ["clue"], label: "관찰", detail: "바닥에 그을린 자국" },
  { order: 3, tags: ["battle"], label: "전투", detail: "거미 두 마리" },
];

const ecology: U5EcologyView = {
  disclosedRules: ["거미는 불을 피한다"],
  observedClues: ["바닥에 그을린 자국"],
};

const base: U5ProgressView = {
  dungeonName: "거미굴 3",
  theme: "spider",
  sceneKind: "monster",
  nodeLabel: "좁은 갈림길",
  situation: "천장 거미줄이 한쪽만 성기다.",
  advice: [
    { slot: 0, text: "왼쪽 통로로 간다", rationale: "성긴 쪽이 지나기 쉽다" },
    { slot: 1, text: "횃불을 벽에 문지른다", rationale: "불빛이 길을 넓힌다" },
    { slot: 2, text: "잠시 서서 소리를 듣는다", rationale: "서두를 이유가 없다" },
  ],
  outcome: null,
  party: [
    { id: "a", name: "코르빈", job: "도적", personality: "신중한", hp: 32, maxHp: 32, trust: 40 },
  ],
};

const render = (over: Partial<U5ProgressView> = {}, props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(U5ProgressScreen, {
      status,
      progress: { ...base, ...over },
      log,
      ecology,
      ...props,
    }),
  );

describe("U5ProgressScreen", () => {
  it("장면 슬롯과 콘솔을 함께 둔다", () => {
    const html = render();

    expect(html).toContain('data-testid="u5-scene"');
    expect(html).toContain('data-testid="u5-console"');
    expect(html).toContain("/assets/u5/dungeon-progress-scenes/spider/monster.png");
  });

  it("상황 묘사가 조언보다 먼저 온다", () => {
    const html = render();

    expect(html.indexOf('data-testid="u5-situation"'))
      .toBeLessThan(html.indexOf('data-testid="u5-advice-list"'));
  });

  /* 이 화면의 가장 중요한 계약이다. 슬롯 말고는 서로 다른 표시가 없어야 한다. */
  it("조언 3개가 같은 클래스와 같은 구조로 렌더된다", () => {
    const html = render();
    const items = html.match(/<li class="u5-advice">[\s\S]*?<\/li>/g) ?? [];

    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item).toContain('class="u5-advice__button"');
      expect(item).toContain('class="u5-advice__text"');
      expect(item).toContain('class="u5-advice__rationale"');
    }
  });

  it("조언 마크업에 판정 어휘가 새지 않는다", () => {
    const html = render();
    const adviceHtml = (html.match(/<ul class="u5-advice-list"[\s\S]*?<\/ul>/) ?? [""])[0];

    for (const word of ["help", "harm", "neutral", "consistent", "contradictory"]) {
      expect(adviceHtml).not.toContain(word);
    }
  });

  it("선택 전에는 결과 영역을 두지 않는다", () => {
    expect(render()).not.toContain('data-testid="u5-outcome"');
  });

  it("선택 뒤 반응 → 결과 → 변화 순서로 보여준다", () => {
    const html = render({
      outcome: {
        reactions: [{ memberName: "코르빈", reaction: "suspected", note: "눈을 가늘게 뜬다" }],
        resultText: "벽을 두드리자 진동이 굴을 타고 퍼진다.",
        changes: [{ label: "신뢰", detail: "코르빈 40 → 34" }],
      },
    });

    expect(html.indexOf("파티원별 반응")).toBeLessThan(html.indexOf("사건 결과"));
    expect(html.indexOf("사건 결과")).toBeLessThan(html.indexOf("수치·신뢰 변화"));
  });

  it("반응을 색이 아니라 문구로도 구분한다", () => {
    const html = render({
      outcome: {
        reactions: [
          { memberName: "코르빈", reaction: "accepted", note: "고개를 끄덕인다" },
          { memberName: "이반드로", reaction: "suspected", note: "눈을 가늘게 뜬다" },
          { memberName: "브릭스턴", reaction: "exposed", note: "손을 멈춘다" },
        ],
        resultText: "결과",
        changes: [],
      },
    });

    for (const word of ["수용", "의심", "적발"]) {
      expect(html).toContain(word);
    }
  });

  it("진행 기록 모드에서 네 필터를 제공한다", () => {
    const html = render({}, { initialMode: "log" });

    for (const label of ["전체", "단서", "전투", "생태"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('data-testid="u5-log"');
  });

  it("생태 탭은 확인된 생태와 관찰 단서를 구역으로 나눈다", () => {
    const html = render({}, { initialMode: "log", initialFilter: "ecology" });

    expect(html).toContain('data-testid="u5-ecology"');
    expect(html).toContain("확인된 생태");
    expect(html).toContain("관찰 단서");
  });

  /* 결과가 행동 / 조언 모드에 있으므로 자동으로 넘기면 플레이어가 놓친다. */
  it("선택 뒤에도 행동 / 조언을 전면에 두고 진행 기록으로 자동 전환하지 않는다", () => {
    const html = render({
      outcome: { reactions: [], resultText: "결과", changes: [] },
    });

    expect(html).toContain('data-testid="u5-outcome"');
    expect(html).not.toContain('data-testid="u5-log"');
  });
});
