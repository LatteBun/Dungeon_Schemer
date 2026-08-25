import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U5ProgressScreen } from "./U5ProgressScreen";
import { createU5BattleReplay } from "./u5-battle-replay";
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
    { id: "a", name: "코르빈", classLabel: "도적", personalityLabel: "신중한", hp: 32, maxHp: 32, trust: 40, gold: 20 },
  ],
};

const threeMemberProgress: U5ProgressView = {
  ...base,
  party: [
    { id: "warrior", name: "오린", classLabel: "전사", personalityLabel: "용감한", hp: 12, maxHp: 12, trust: 40, gold: 20, portraitSrc: "/assets/characters/live/warrior/warrior_a.png" },
    { id: "rogue", name: "코르빈", classLabel: "도적", personalityLabel: "신중한", hp: 10, maxHp: 10, trust: 42, gold: 16, portraitSrc: "/assets/characters/live/rogue/rogue_a.png" },
    { id: "cleric", name: "에리카", classLabel: "성직자", personalityLabel: "침착한", hp: 14, maxHp: 14, trust: 35, gold: 18, portraitSrc: "/assets/characters/live/cleric/cleric_a.png" },
  ],
};

const battleReplay = createU5BattleReplay({
  resolution: {
    status: "victory",
    termination: "defeatedEnemies",
    rounds: 1,
    actions: [
      { round: 1, actorSide: "party", actorId: "party-1", targetId: "enemy-1", damage: 5, targetHpBefore: 5, targetHpAfter: 0, defeated: true },
    ],
    party: [{ id: "party-1", classId: "rogue", hp: 32, maxHp: 32, attack: 5, hitWeight: 2 }],
    enemies: [{ id: "enemy-1", monsterId: "spider-hatchling", hp: 0, maxHp: 5, baseDamage: 2 }],
  },
  presentations: [
    { id: "party-1", name: "코르빈", imageSrc: "/assets/characters/live/rogue/rogue_a.png" },
    { id: "enemy-1", name: "새끼거미", imageSrc: "/assets/monsters/spider/monster-spider-hatchling.png" },
  ],
});

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
  it("전투 replay가 없으면 기존 장면 슬롯과 배경을 장식 이미지로 유지한다", () => {
    const html = render();

    expect(html).toContain('data-testid="u5-scene"');
    expect(html).toContain('data-testid="u5-console"');
    expect(html).toContain("/assets/u5/dungeon-progress-scenes/spider/monster.png");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('data-testid="u5-battle-scene"');
    expect(html).not.toContain("u5-battle-host");
  });

  it("전투 replay가 있으면 같은 장면 슬롯을 전투 overlay의 host로 만든다", () => {
    const html = render({}, { battleReplay });
    const scene = (html.match(/<div class="[^"]*\bu5-scene\b[^"]*"[\s\S]*?<div class="u5-console"/) ?? [""])[0];
    const sceneOpeningTag = (scene.match(/^<div[^>]+>/) ?? [""])[0];

    expect(scene).toContain('data-testid="u5-battle-scene"');
    expect(sceneOpeningTag).toContain('class="u5-scene u5-battle-host"');
    expect(sceneOpeningTag).not.toContain('aria-hidden="true"');
  });

  it("비전투 장면에는 파티를, 전투 장면에는 battle scene만 둔다", () => {
    const calm = render(threeMemberProgress);
    const battle = render(threeMemberProgress, { battleReplay });

    expect(calm).toContain('data-testid="u5-nonbattle-party"');
    expect(calm).not.toContain('data-testid="u5-battle-scene"');
    expect(battle).not.toContain('data-testid="u5-nonbattle-party"');
    expect(battle).toContain('data-testid="u5-battle-scene"');
  });

  it("전투 replay를 표시해도 오른쪽 파티 ViewModel 마크업을 바꾸지 않는다", () => {
    const partyMarkup = (html: string) =>
      (html.match(/<div class="u5-party" data-testid="u5-party">[\s\S]*?<\/div><\/aside>/) ?? [""])[0];

    expect(partyMarkup(render({}, { battleReplay }))).toBe(partyMarkup(render()));
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
      expect(item.match(/class="u5-advice__rivet(?:\s|")/g)).toHaveLength(4);
    }
  });

  it("조언 카드는 남은 높이를 채우지 않고 A1 금속 명패로 중앙 정렬한다", () => {
    const sheet = readFileSync("app/u5-progress.css", "utf8");

    expect(sheet).toMatch(/\.u5-advice-list\s*\{[^}]*align-content:\s*center/);
    expect(sheet).toMatch(/\.u5-advice\s*\{[^}]*height:\s*clamp\(/);
    expect(sheet).toMatch(/\.u5-advice__button\s*\{[^}]*clip-path:\s*polygon\(/);
    expect(sheet).toMatch(/\.u5-advice__button\s*\{[^}]*box-shadow:[^}]*inset/);
    expect(sheet).toMatch(/\.u5-advice__rivets\s*\{/);
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

describe("반응이 없을 때", () => {
  /* 빈 상자만 남으면 화면이 깨진 것처럼 보인다. */
  it("반응이 없으면 없다고 적는다", () => {
    const html = render({
      outcome: { reactions: [], resultText: "보스방을 넘지 못했다.", changes: [{ label: "HP", detail: "오린 24 → 0" }] },
    });

    expect(html).toContain("확인할 반응이 없다");
    expect(html).toContain("보스방을 넘지 못했다");
  });

  it("반응이 있으면 그 줄은 없다", () => {
    const html = render({
      outcome: {
        reactions: [{ memberName: "오린", reaction: "accepted", note: "고개를 끄덕인다." }],
        resultText: "지나갔다.",
        changes: [{ label: "변화", detail: "그대로다." }],
      },
    });

    expect(html).not.toContain("확인할 반응이 없다");
    expect(html).toContain("오린");
  });
});

describe("넘어가는 버튼", () => {
  const outcome = {
    reactions: [],
    resultText: "지나갔다.",
    changes: [{ label: "변화", detail: "그대로다." }],
  };

  /*
   * 버튼은 하나다.
   *
   * 오른쪽 아래로 옮기면서 왼쪽 콘솔의 것을 지웠는데, 병합 과정에서 되살아나
   * 화면에 둘이 서 있었다. 문구가 서로 달라 어느 쪽이 진짜인지도 갈렸다.
   */
  it("결과 화면에 넘어가는 버튼이 하나만 있다", () => {
    const html = render({ outcome }, { onAcknowledge: () => undefined });
    const count = html.split("u5-outcome-continue").length - 1;

    expect(count).toBe(1);
  });

  it("일반전 재생 중 우측 하단에는 건너뛰기 하나만 둔다", () => {
    const html = render(
      { outcome },
      {
        battleReplay,
        battleExitPolicy: "after-playback",
        onAcknowledge: () => undefined,
      },
    );

    expect(html.split("u5-outcome-continue").length - 1).toBe(1);
    expect(html).toContain("전투 건너뛰기");
    expect(html).not.toContain("지도로 돌아간다");
  });

  it("정산 CTA에는 일반전 게이트를 적용하지 않는다", () => {
    const html = render(
      { outcome },
      { battleReplay, onAcknowledge: () => undefined, acknowledgeLabel: "정산으로" },
    );

    expect(html).toContain("정산으로");
    expect(html).not.toContain("전투 건너뛰기");
  });

  it("frame이 빈 replay에는 전투 장면과 건너뛰기를 만들지 않는다", () => {
    const html = render(
      { outcome },
      {
        battleReplay: { ...battleReplay, frames: [] },
        battleExitPolicy: "after-playback",
        onAcknowledge: () => undefined,
      },
    );

    expect(html).not.toContain('data-testid="u5-battle-scene"');
    expect(html).not.toContain("전투 건너뛰기");
  });

  it("문구를 주면 그대로 쓴다", () => {
    const html = render({ outcome }, { onAcknowledge: () => undefined, acknowledgeLabel: "정산으로" });

    expect(html).toContain("정산으로");
    expect(html).not.toContain("지도로 돌아간다");
  });

  it("주지 않으면 버튼이 없다", () => {
    expect(render({ outcome })).not.toContain("u5-outcome-continue");
  });
});

describe("잠긴 조언", () => {
  const blocked = {
    ...base,
    advice: [
      { slot: 0 as const, text: "값을 치르고 사세요", rationale: "지금은 그럴 값이 없다", goldCost: 40, unavailableReason: "골드가 모자란다" },
      { slot: 1 as const, text: "그냥 지나가세요", rationale: "돈을 쓰지 않는다" },
      { slot: 2 as const, text: "값을 깎아 보라고 하세요", rationale: "해 볼 만하다" },
    ],
  };

  /*
   * 잠긴 조언은 잠긴 것처럼 보여야 한다.
   *
   * 누를 수 있는 것과 똑같이 생기면 눌러도 아무 일이 없으니 "선택이 안 된다" 로
   * 보인다. 실제로 그렇게 보였다.
   */
  it("잠긴 버튼과 이유가 함께 나온다", () => {
    const html = render(blocked);

    expect(html).toContain("disabled");
    expect(html).toContain("골드가 모자란다");
    expect(html).toContain("u5-advice__blocked");
  });

  it("공백 없는 긴 잠금 이유도 잠긴 카드 안에서 줄바꿈할 수 있다", () => {
    const unavailableReason = "잠금사유".repeat(80);
    const html = render({
      ...blocked,
      advice: [
        { ...blocked.advice[0], unavailableReason },
        blocked.advice[1],
        blocked.advice[2],
      ],
    });
    const sheet = readFileSync("app/u5-progress.css", "utf8");

    expect(html).toContain(unavailableReason);
    expect(html).toContain('class="u5-advice__blocked"');
    expect(sheet).toMatch(/\.u5-advice__blocked\s*\{[^}]*min-width:\s*0/);
    expect(sheet).toMatch(/\.u5-advice__blocked\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });

  it("잠기지 않은 조언은 그대로 누를 수 있다", () => {
    const html = render(blocked);
    const buttons = html.split("u5-advice__button").length - 1;

    expect(buttons).toBe(3);
    /* 잠긴 것은 하나뿐이다. */
    expect(html.split('disabled=""').length - 1).toBe(1);
  });
});

describe("잠긴 모양", () => {
  /* 모양이 없으면 잠긴 것과 누를 수 있는 것이 같아 보인다. */
  it("잠긴 버튼에 제 모양이 있다", () => {
    const sheet = readFileSync("app/u5-progress.css", "utf8");

    expect(sheet).toMatch(/\.u5-advice__button:disabled\s*\{/);
    expect(sheet).toMatch(/\.u5-advice__blocked\s*\{/);
    /* 잠긴 버튼에는 hover 가 걸리지 않는다. */
    expect(sheet).toMatch(/\.u5-advice__button:hover:not\(:disabled\)/);
  });

  it("잘린 조언 버튼의 키보드 초점은 안쪽 표시로 읽힌다", () => {
    const sheet = readFileSync("app/u5-progress.css", "utf8");

    expect(sheet).toMatch(/\.u5-advice__button:focus-visible\s*\{[^}]*outline:\s*none[^}]*box-shadow:[^}]*inset/);
  });
});
