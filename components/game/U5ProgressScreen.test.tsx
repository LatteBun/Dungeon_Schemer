import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { allSituationEvents } from "@/lib/content/event-registry";
import { U5ProgressScreen, u5SettledPartyResult } from "./U5ProgressScreen";
import { createU5BattleReplay } from "./u5-battle-replay";
import type { U5EcologyView, U5LogEntry } from "./u5-log";
import type { U5ProgressView } from "./u5-progress-model";
import type { TopStatusView } from "./TopStatusBar";

const longestSituation = allSituationEvents().reduce(
  (longest, event) => event.description.length > longest.length ? event.description : longest,
  "",
);

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
      playbackRate: 1,
      onTogglePlaybackRate: () => undefined,
      ...props,
    }),
  );

const cssRule = (sheet: string, selector: string) =>
  sheet.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*\\}`))?.[0] ?? "";

describe("U5ProgressScreen", () => {
  it("반응 확인 전에는 완료 변화량을 숨기고 확인 뒤에는 0이 아닌 값만 남긴다", () => {
    const feedback = {
      signature: "result-1",
      kind: "event" as const,
      consequenceText: null,
      preBattleReaction: null,
      immediateTrustChanges: [],
      postBattleReaction: { memberId: "party-1", memberName: "코르빈", text: "확인했다." },
      postBattleTrustChanges: [{ memberId: "party-1", before: 42, after: 40 }],
    };
    const found = battleReplay.participants.find((one) => one.id === "party-1");
    const participant = found === undefined ? undefined : { ...found, initialHp: 32, finalHp: 29 };

    expect(u5SettledPartyResult(feedback, "postBattleDialogue", participant, "party-1")).toBeUndefined();
    expect(u5SettledPartyResult(feedback, "postBattleTrust", participant, "party-1"))
      .toEqual({ hpDelta: -3, trustDelta: -2 });
    expect(u5SettledPartyResult(feedback, "complete", participant, "party-1"))
      .toEqual({ hpDelta: -3, trustDelta: -2 });
  });

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

  it("일반전 replay는 장면 속도 control과 기존 건너뛰기 CTA를 함께 렌더링한다", () => {
    const html = render({}, { battleReplay, battleExitPolicy: "after-playback" });

    expect(html).toContain('aria-label="전투 재생 속도"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('data-playback-rate="1"');
    expect(html).toContain("전투 건너뛰기");
  });

  it("보스전 replay도 같은 ×1 speed control을 받는다", () => {
    const html = render({ sceneKind: "boss" }, { battleReplay });

    expect(html).toContain('aria-label="전투 재생 속도"');
    expect(html).toContain('data-playback-rate="1"');
  });

  it("부모가 준 ×2를 전투 장면에 그대로 전달한다", () => {
    const html = render({}, {
      battleReplay,
      playbackRate: 2,
      onTogglePlaybackRate: () => undefined,
    });

    expect(html).toContain('data-playback-rate="2"');
    expect(html).toContain('aria-pressed="true"');
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

  it("현재 상황 제목과 본문을 같은 패널에 둔다", () => {
    const html = render();
    const panel = html.match(/<section class="u5-situation-panel"[\s\S]*?<\/section>/)?.[0] ?? "";

    expect(panel).toContain('aria-labelledby="u5-situation-title"');
    expect(panel).toContain('<h3 id="u5-situation-title" class="u5-situation-panel__title">현재 상황</h3>');
    expect(panel).toContain('data-testid="u5-situation"');
  });

  it("초기 행동 / 조언 모드만 활성화한다", () => {
    const html = render();

    expect(html).toMatch(/<button[^>]*class="is-active"[^>]*aria-pressed="true"[^>]*>행동 \/ 조언<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>진행 기록<\/button>/);
  });

  it("초기 진행 기록 모드만 활성화한다", () => {
    const html = render({}, { initialMode: "log" });

    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>행동 \/ 조언<\/button>/);
    expect(html).toMatch(/<button[^>]*class="is-active"[^>]*aria-pressed="true"[^>]*>진행 기록<\/button>/);
  });

  it("최장 공식 상황 문구를 선택 전과 선택 후에 그대로 둔다", () => {
    const before = render({ situation: longestSituation });
    const after = render({
      situation: longestSituation,
      outcome: { reactions: [], resultText: "결과", changes: [{ label: "변화", detail: "그대로다." }] },
    });

    expect(before).toContain(`data-testid="u5-situation">${longestSituation}</p>`);
    expect(after).toContain(`data-testid="u5-situation">${longestSituation}</p>`);
    expect(after.indexOf('class="u5-situation-panel"')).toBeLessThan(after.indexOf('data-testid="u5-outcome"'));
  });

  it("상황 패널은 경계와 여백을 가지되 내용을 자르지 않는다", () => {
    const sheet = readFileSync("app/u5-progress.css", "utf8");
    const panel = cssRule(sheet, ".u5-situation-panel");
    const situation = cssRule(sheet, ".u5-situation");
    const title = sheet.match(/\.u5-situation-panel__title\s*\{[^}]*\}/)?.[0] ?? "";

    expect(panel).toMatch(/box-sizing:\s*border-box/);
    expect(panel).toMatch(/min-width:\s*0/);
    expect(panel).toMatch(/padding:/);
    expect(panel).toMatch(/border:/);
    expect(panel).toMatch(/background:/);
    for (const rule of [panel, situation]) {
      expect(rule).not.toMatch(/(?:^|\s)(?:max-)?height\s*:/);
      expect(rule).not.toMatch(/overflow(?:-x|-y)?\s*:/);
    }
    expect(title).toMatch(/margin:\s*0/);
  });

  it("진행 기록 필터는 분리 뒤에도 기존 버튼 표면을 유지한다", () => {
    const sheet = readFileSync("app/u5-progress.css", "utf8");
    const filters = sheet.match(/\.u5-log__filters button\s*\{[^}]*\}/)?.[0] ?? "";

    expect(filters).toMatch(/border:\s*1px solid var\(--color-edge\)/);
    expect(filters).toMatch(/background:\s*rgb\(12 9 6 \/ 80%\)/);
    expect(filters).toMatch(/color:\s*var\(--color-muted\)/);
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

  it("조언 카드에 숫자 슬롯 배지를 표시하지 않는다", () => {
    const html = render();
    const adviceHtml = (html.match(/<ul class="u5-advice-list"[\s\S]*?<\/ul>/) ?? [""])[0];

    expect(adviceHtml).not.toContain("u5-advice__slot");
    expect(adviceHtml).not.toMatch(/>1<|>2<|>3</);
  });

  it("조언 카드는 콘솔 아래쪽에 정렬하고 별도 하단 여백을 만들지 않는다", () => {
    const sheet = readFileSync("app/u5-progress.css", "utf8");
    const list = cssRule(sheet, ".u5-advice-list");

    expect(list).toMatch(/align-content:\s*end/);
    expect(list).toMatch(/padding:\s*0/);
    expect(list).not.toMatch(/padding-bottom\s*:/);
    expect(list).not.toMatch(/position:\s*(?:absolute|fixed)/);
    expect(list).not.toMatch(/transform\s*:/);
  });

  it("모드 탭과 현재 상황 패널은 리벳 없는 금속 명패 표면을 쓴다", () => {
    const sheet = readFileSync("app/u5-progress.css", "utf8");
    const tabs = cssRule(sheet, ".u5-console__tabs button");
    const panel = cssRule(sheet, ".u5-situation-panel");

    for (const rule of [tabs, panel]) {
      expect(rule).toMatch(/clip-path:\s*polygon\(/);
      expect(rule).toMatch(/border:\s*0\.125rem solid/);
      expect(rule).toMatch(/background:\s*linear-gradient\(/);
      expect(rule.match(/\binset\b/g)).toHaveLength(2);
      expect(rule).not.toMatch(/\burl\(/);
    }
    const html = render();
    const tabsMarkup = html.match(/<nav class="u5-console__tabs"[\s\S]*?<\/nav>/)?.[0] ?? "";
    const panelMarkup = html.match(/<section class="u5-situation-panel"[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(tabsMarkup).not.toContain("u5-advice__rivet");
    expect(panelMarkup).not.toContain("u5-advice__rivet");
    for (const markup of [tabsMarkup, panelMarkup]) {
      expect(markup).not.toMatch(/<(?:img|svg)\b/);
    }
  });

  it("현재 상황 패널은 남는 높이를 채우고 카드나 결과는 내용 높이를 유지한다", () => {
    const sheet = readFileSync("app/u5-progress.css", "utf8");
    const mode = cssRule(sheet, ".u5-advice-mode");

    expect(mode).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto/);
    expect(mode).toMatch(/gap:/);
    expect(mode).not.toMatch(/place-(?:content|items)\s*:/);
    expect(mode).not.toMatch(/align-(?:content|items)\s*:\s*(?:center|end)/);
  });

  it("상황 모드는 선택 전후 결과 상태를 호환 가능한 data attribute로 표시한다", () => {
    const before = render();
    const after = render({
      outcome: {
        reactions: [{ memberName: "코르빈", reaction: "suspected", note: "눈을 가늘게 뜬다" }],
        resultText: "벽을 두드리자 진동이 굴을 타고 퍼진다.",
        changes: [{ label: "신뢰", detail: "코르빈 40 → 34" }],
      },
    });

    expect(before).toContain('class="u5-advice-mode" data-has-outcome="false"');
    expect(after).toContain('class="u5-advice-mode" data-has-outcome="true"');
  });

  it("선택 뒤에는 호환 가능한 상태 선택자로 긴 현재 상황의 최소 높이를 확보한다", () => {
    const sheet = readFileSync("app/u5-progress.css", "utf8");
    const selectedMode = cssRule(sheet, '.u5-advice-mode[data-has-outcome="true"]');

    expect(sheet).not.toContain(":has(");
    expect(selectedMode).toMatch(/grid-template-rows:\s*minmax\(min-content,\s*1fr\)\s+auto/);
  });

  it("모드 탭과 현재 상황 글자를 2차 승인 크기로 키운다", () => {
    const sheet = readFileSync("app/u5-progress.css", "utf8");
    const tabs = cssRule(sheet, ".u5-console__tabs button");
    const title = cssRule(sheet, ".u5-situation-panel__title");
    const body = cssRule(sheet, ".u5-situation");

    expect(tabs).toMatch(/padding:\s*clamp\(0\.16rem,\s*0\.15cqw,\s*0\.3rem\)\s+clamp\(0\.5rem,\s*0\.7cqw,\s*1rem\)/);
    expect(tabs).toMatch(/font-size:\s*clamp\(0\.88rem,\s*0\.96cqw,\s*1\.3(?:0)?rem\)/);
    expect(title).toMatch(/font-size:\s*clamp\(0\.9(?:0)?rem,\s*1(?:\.00)?cqw,\s*1\.25rem\)/);
    expect(body).toMatch(/font-size:\s*clamp\(1(?:\.00)?rem,\s*1\.12cqw,\s*1\.5(?:0)?rem\)/);
    expect(body).toMatch(/line-height:\s*1\.45/);
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

  it.each([
    ["일반전", "지도로 돌아간다"],
    ["보스전", "정산으로"],
  ])("%s 재생 중 우측 하단에는 건너뛰기 하나만 둔다", (_name, nextLabel) => {
    const html = render(
      { outcome },
      {
        battleReplay,
        battleExitPolicy: "after-playback",
        onAcknowledge: () => undefined,
        acknowledgeLabel: nextLabel,
      },
    );

    expect(html.split("u5-outcome-continue").length - 1).toBe(1);
    expect(html).toContain("전투 건너뛰기");
    expect(html).not.toContain(nextLabel);
  });

  it("frame이 빈 gated replay에는 건너뛰기와 다음 CTA를 모두 만들지 않는다", () => {
    const html = render(
      { outcome },
      {
        battleReplay: { ...battleReplay, frames: [] },
        battleExitPolicy: "after-playback",
        onAcknowledge: () => undefined,
        acknowledgeLabel: "정산으로",
      },
    );

    expect(html).not.toContain("전투 건너뛰기");
    expect(html).not.toContain("정산으로");
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
    expect(html).not.toContain("u5-advice__slot");
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
