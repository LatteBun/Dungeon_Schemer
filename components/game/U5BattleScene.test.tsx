import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U5BattleScene } from "./U5BattleScene";
import { U5_TEST_BATTLE_REPLAY } from "./u5-battle-test-fixture";
import type { U5BattleReplay, U5BattleReplayFrame } from "./u5-battle-replay";

const replay = U5_TEST_BATTLE_REPLAY;

const battleCss = readFileSync(join(process.cwd(), "app", "u5-battle.css"), "utf8");

function render(frame: U5BattleReplayFrame = replay.frames[0]!, value: U5BattleReplay = replay): string {
  return renderToStaticMarkup(createElement(U5BattleScene, {
    replay: value,
    frame,
    onReplayFromStart: () => undefined,
  }));
}

function participantMarkup(html: string, participantId: string): string {
  const markup = html.match(new RegExp(`<article[^>]*data-participant-id="${participantId}"[\\s\\S]*?</article>`))?.[0];
  expect(markup).toBeDefined();
  return markup!;
}

describe("U5BattleScene", () => {
  it("initial frame에서 양 진영과 모든 참가자의 이름, 이미지, 숫자 HP를 제공한다", () => {
    const html = render();

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
    const html = render(nonUniformAssetReplay.frames[0]!, nonUniformAssetReplay);

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
  it("화면 문장과 읽어 주는 문장을 나누고 재생 중 장면 안에 skip을 두지 않는다", () => {
    const html = render();

    expect(html.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(html).toContain("전투가 시작됩니다.");
    /* idle 은 행동이 아니다. 읽어 주는 자리는 비어 있어야 한다. */
    expect(html).toMatch(/<p class="u5-battle-announcement" aria-live="polite"><\/p>/);
    expect(html).not.toContain("전투 건너뛰기");
    expect(html).not.toContain("다시 보기");
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
    const html = render();

    expect(html).not.toContain("이(가)");
    expect(html).not.toContain("을(를)");
  });

  it("complete frame으로 시작하면 승리, 쓰러짐, 다시 보기 조작을 함께 보여준다", () => {
    const html = render(replay.frames.at(-1)!);

    expect(html).toContain("파티가 전투에서 승리했습니다.");
    expect(html).toContain("쓰러짐");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>다시 보기<\/button>/);
  });
});
