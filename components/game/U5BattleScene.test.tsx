import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U5BattleScene } from "./U5BattleScene";
import { U5_TEST_BATTLE_REPLAY as replay } from "./u5-battle-test-fixture";
import { createU5BattleReplay } from "./u5-battle-replay";
import type { U5BattleReplay, U5BattleReplayFrame } from "./u5-battle-replay";

const battleCss = readFileSync(join(process.cwd(), "app", "u5-battle.css"), "utf8");

function render(frame: U5BattleReplayFrame, value: U5BattleReplay = replay): string {
  return renderToStaticMarkup(createElement(U5BattleScene, { replay: value, frame, onReplayFromStart: () => {} }));
}

function participantMarkup(html: string, participantId: string): string {
  const markup = html.match(new RegExp(`<article[^>]*data-participant-id="${participantId}"[\\s\\S]*?</article>`))?.[0];
  expect(markup).toBeDefined();
  return markup!;
}

describe("U5BattleScene", () => {
  it("initial frame에서 양 진영과 모든 참가자의 이름, 이미지, 숫자 HP를 제공한다", () => {
    const html = render(replay.frames[0]!);

    expect(html).toContain('data-testid="u5-battle-scene"');
    expect(html).toContain('data-side="party"');
    expect(html).toContain('aria-label="파티"');
    expect(html).toContain('data-side="enemy"');
    expect(html).toContain('aria-label="적"');
    for (const [name, hp] of [["코르빈", "10 / 10"], ["새끼거미", "7 / 7"]]) {
      expect(html).toContain(`alt="${name}"`);
      expect(html).toContain(`>${name}<`);
      expect(html).toContain(`>${hp}<`);
      expect(html).toContain(`aria-label="${name} HP ${hp}"`);
    }
  });

  it("서로 다른 공식 PNG 비율을 고정 width/height 속성 없이 contain으로 보존한다", () => {
    const nonUniformAssetReplay: U5BattleReplay = {
      ...replay,
      participants: replay.participants.map((participant) => participant.side === "party"
        ? { ...participant, imageSrc: "/assets/characters/live/warrior/warrior_a.png" }
        : { ...participant, name: "세리나", imageSrc: "/assets/monsters/spider/boss-spider-03-serina.png" }),
    };
    const html = render(replay.frames[0]!, nonUniformAssetReplay);

    for (const name of ["코르빈", "세리나"]) {
      const image = html.match(new RegExp(`<img alt="${name}"[^>]*>`))?.[0];
      expect(image).toBeDefined();
      expect(image).toContain('data-nimg="fill"');
      expect(image).not.toMatch(/\s(?:width|height)="\d+"/);
    }
    expect(battleCss).toMatch(/\.u5-battle-sprite-frame\s*\{[^}]*position:\s*relative/);
    expect(battleCss).toMatch(/\.u5-battle-sprite\s*\{[^}]*object-fit:\s*contain/);
  });

  it("screen-space lunge를 orientation 바깥에 두고 파티는 오른쪽, 적은 왼쪽으로 이동시킨다", () => {
    const html = render(replay.frames[1]!);
    const party = participantMarkup(html, "party-1");
    const enemy = participantMarkup(html, "enemy-1");

    for (const participant of [party, enemy]) {
      expect(participant.indexOf('class="u5-battle-motion"')).toBeLessThan(
        participant.indexOf('class="u5-battle-orientation'),
      );
    }
    expect(party).toContain("--u5-battle-lunge-x:16%");
    expect(enemy).toContain("--u5-battle-lunge-x:-16%");
  });

  it("피해 숫자의 가로 중앙 정렬과 세로 motion을 서로 다른 요소에 둔다", () => {
    const enemy = participantMarkup(render(replay.frames[2]!), "enemy-1");

    expect(enemy).toMatch(/<span class="u5-battle-damage-anchor"><span class="u5-battle-damage"/);
    expect(battleCss).toMatch(/\.u5-battle-damage-anchor\s*\{[^}]*transform:\s*translateX\(-50%\)/);
    expect(battleCss).not.toMatch(/\.u5-battle-damage\s*\{[^}]*transform:/);
  });

  /*
   * 화면 문장은 프레임마다 바뀌지만, 읽어 주는 것은 행동이 끝난 settle 과
   * complete 뿐이다. 네 프레임을 모두 알리면 행동 하나에 네 번 읽는데,
   * 프레임 간격이 0.36~0.52초라 합성음이 화면을 따라오지 못한다.
   */
  it("화면 문장과 읽어 주는 문장을 나눈다", () => {
    const html = render(replay.frames[0]!);

    expect(html.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(html).toContain("전투가 시작됩니다.");
    /* idle 은 행동이 아니다. 읽어 주는 자리는 비어 있어야 한다. */
    expect(html).toMatch(/<p class="u5-battle-announcement" aria-live="polite"><\/p>/);
  });

  it("행동이 끝난 frame 만 읽어 준다", () => {
    const settle = replay.frames.find((frame) => frame.phase === "settle");
    const attack = replay.frames.find((frame) => frame.phase === "attack");
    if (settle === undefined || attack === undefined) throw new Error("fixture에 settle/attack frame이 없다.");

    const settleHtml = render(settle);
    const attackHtml = render(attack);

    expect(settleHtml).toMatch(/<p class="u5-battle-announcement" aria-live="polite">.+<\/p>/);
    expect(attackHtml).toMatch(/<p class="u5-battle-announcement" aria-live="polite"><\/p>/);
  });

  /* "새끼거미이(가)" 처럼 두 형태를 나란히 적지 않는다. */
  it("받침에 맞는 조사를 골라 쓴다", () => {
    const html = render(replay.frames[0]!);

    expect(html).not.toContain("이(가)");
    expect(html).not.toContain("을(를)");
  });

  it("complete frame으로 시작하면 승리, 쓰러짐, 다시 보기 조작을 함께 보여준다", () => {
    const html = render(replay.frames.at(-1)!);

    expect(html).toContain("파티가 전투에서 승리했습니다.");
    expect(html).toContain("쓰러짐");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>다시 보기<\/button>/);
  });

  it("재생 중 장면 안에는 건너뛰기 버튼을 두지 않는다", () => {
    const html = render(replay.frames[0]!);
    expect(html).not.toContain("전투 건너뛰기");
    expect(html).not.toContain("다시 보기");
  });

  it("complete frame에서만 다시 보기 버튼을 제공한다", () => {
    const html = render(replay.frames.at(-1)!);
    expect(html).toMatch(/<button[^>]*>다시 보기<\/button>/);
  });
});

/*
 * 화면 문장은 사건만 남긴다.
 *
 * 프레임마다 "공격합니다 / 피해를 받습니다 / HP가 N까지 떨어졌습니다" 를 갈아
 * 끼우면 스무 행동 전투에서 예순 줄이 지나간다. 셋 다 화면이 이미 보여 주는
 * 것이라, 글이 시선을 가져가 정작 피해 숫자를 놓치게 만든다.
 */
describe("U5BattleScene 화면 자막", () => {
  const frameOf = (phase: string) => {
    const frame = replay.frames.find((one) => one.phase === phase);
    if (frame === undefined) throw new Error(`fixture에 ${phase} frame이 없다.`);
    return frame;
  };
  const liveText = (html: string): string =>
    html.match(/<p class="u5-battle-live"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "__없음__";

  it("공격과 피해 프레임에는 문장을 남기지 않는다", () => {
    for (const phase of ["attack", "impact"]) {
      const html = render(frameOf(phase));
      expect(liveText(html), phase).toBe("");
      expect(html, phase).toContain('data-empty="true"');
    }
  });

  it("쓰러지지 않은 settle 도 문장을 남기지 않는다", () => {
    /* 공용 fixture는 한 방에 끝나 생존 settle이 없다. 두 방짜리를 따로 만든다. */
    const twoHits = createU5BattleReplay({
      resolution: {
        status: "victory",
        termination: "defeatedEnemies",
        rounds: 1,
        party: [{ id: "party-1", classId: "warrior", hp: 10, maxHp: 10, attack: 7, hitWeight: 3 }],
        enemies: [{ id: "enemy-1", monsterId: "spider-hatchling", hp: 0, maxHp: 7, baseDamage: 3 }],
        actions: [
          { round: 1, actorSide: "party", actorId: "party-1", targetId: "enemy-1", damage: 3, targetHpBefore: 7, targetHpAfter: 4, defeated: false },
          { round: 1, actorSide: "party", actorId: "party-1", targetId: "enemy-1", damage: 4, targetHpBefore: 4, targetHpAfter: 0, defeated: true },
        ],
      },
      presentations: [
        { id: "party-1", name: "코르빈", imageSrc: "/assets/characters/live/warrior/warrior_a.png" },
        { id: "enemy-1", name: "새끼거미", imageSrc: "/assets/monsters/spider/monster-spider-hatchling.png" },
      ],
    });
    const settle = twoHits.frames.find(
      (one: U5BattleReplayFrame) => one.phase === "settle" && one.defeatedParticipantIds.length === 0,
    );
    if (settle === undefined) throw new Error("생존 settle frame을 만들지 못했다.");

    expect(liveText(render(settle, twoHits))).toBe("");
  });

  it("시작·쓰러짐·승패는 남긴다", () => {
    expect(liveText(render(frameOf("idle")))).toContain("전투가 시작됩니다");
    expect(liveText(render(frameOf("complete")))).toMatch(/승리|패배/);

    const defeat = replay.frames.find(
      (one) => one.phase === "settle" && one.defeatedParticipantIds.length > 0,
    );
    if (defeat === undefined) throw new Error("fixture에 쓰러짐 settle frame이 없다.");
    expect(liveText(render(defeat))).toContain("쓰러뜨렸습니다");
  });

  it("읽어 주는 자리는 그대로 다 말한다", () => {
    // 눈으로 못 보는 사람이 잃는 것이 없어야 자막을 덜어낼 수 있다.
    const settle = frameOf("settle");
    const html = render(settle);
    expect(html).toMatch(/<p class="u5-battle-announcement" aria-live="polite">.+<\/p>/);
  });
});

/* 쓰러진 사람은 흐려지기만 하면 화면 결함처럼 보인다. 상태를 표식으로 남긴다. */
describe("U5BattleScene 쓰러짐 표시", () => {
  it("쓰러진 참가자만 data-defeated 를 달고 색이 빠진다", () => {
    const defeat = replay.frames.find(
      (one) => one.phase === "settle" && one.defeatedParticipantIds.length > 0,
    );
    if (defeat === undefined) throw new Error("fixture에 쓰러짐 frame이 없다.");
    const html = render(defeat);

    expect(participantMarkup(html, defeat.defeatedParticipantIds[0]!)).toContain('data-defeated="true"');
    const alive = replay.participants.find((one) => !defeat.defeatedParticipantIds.includes(one.id));
    expect(participantMarkup(html, alive!.id)).toContain('data-defeated="false"');

    expect(battleCss).toMatch(/\[data-defeated="true"\][^{]*\{[^}]*filter:\s*grayscale\(1\)/);
  });

  /*
   * 살아 있는 사람이 흐려지는 일은 없어야 한다.
   *
   * 재생 중 아군이 잠깐 반투명해진다는 제보를 재현하지 못했다. 원인을 못 찾은
   * 결함은 다시 돌아오므로, 일어날 수 없게 못을 박은 것을 여기서 지킨다.
   */
  it("살아 있는 참가자의 투명도를 못 박는다", () => {
    const rule = battleCss.match(
      /\.u5-battle-participant\[data-defeated="false"\]\s+\.u5-battle-motion\s*\{([^}]*)\}/,
    )?.[1];
    expect(rule, "살아 있는 참가자 규칙").toBeDefined();
    expect(rule).toMatch(/opacity:\s*1\s*!important/);
  });
});

/* 자막에서 피해를 걷어낸 만큼, 숫자가 그 몫을 해야 한다. */
describe("U5BattleScene 피해 숫자", () => {
  it("피해 숫자가 자막 글자보다 확실히 크다", () => {
    const sizeOf = (selector: string): number => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rule = battleCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
      const max = rule.match(/font-size:\s*clamp\([^,]+,[^,]+,\s*([\d.]+)rem\)/)?.[1];
      if (max === undefined) throw new Error(`${selector}의 font-size를 찾을 수 없다.`);
      return Number(max);
    };
    expect(sizeOf(".u5-battle-damage")).toBeGreaterThan(sizeOf(".u5-battle-live") * 2);
  });
});

/*
 * 숨쉬기가 투명도를 붙잡고 있었다.
 *
 * 대기 상태의 transition 을 통째로 주면 `repeat: Infinity` 가 opacity 에도
 * 걸린다. 쓰러져 0.38 이 된 사람을 두고 다시 보기를 누르면 0.38 → 1 이 끝나기
 * 전에 처음으로 되돌아가기를 무한히 반복해, 멀쩡한 사람이 흐린 채로 서 있었다.
 * 실측으로 HP 가 남았는데 흐려진 프레임이 3,597 장이었다.
 */
describe("U5BattleScene 대기 애니메이션", () => {
  const source = readFileSync(join(process.cwd(), "components", "game", "U5BattleScene.tsx"), "utf8");

  it("되풀이를 숨쉬기(y)에만 걸고 투명도에는 걸지 않는다", () => {
    const idle = source.match(/animate: \{ x: 0, y: reducedMotion[\s\S]*?\n  \};/)?.[0];
    expect(idle, "대기 분기").toBeDefined();

    /* repeat 은 y 안에서만 나온다. */
    const repeats = [...idle!.matchAll(/repeat:\s*Infinity/g)];
    expect(repeats).toHaveLength(1);
    expect(idle).toMatch(/y:\s*\{[^}]*repeat:\s*Infinity/);
    expect(idle).not.toMatch(/opacity:\s*\{[^}]*repeat/);
  });

  it("살아 있는 사람의 투명도는 애니메이션하지 않고 곧바로 1이 된다", () => {
    const idle = source.match(/animate: \{ x: 0, y: reducedMotion[\s\S]*?\n  \};/)?.[0];
    expect(idle).toMatch(/opacity:\s*\{\s*duration:\s*0\s*\}/);
  });
});
