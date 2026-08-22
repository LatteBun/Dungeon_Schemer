import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BattleResolution } from "@/lib/rules/battle-engine";
import { U5BattleScene } from "./U5BattleScene";
import { createU5BattleReplay, type U5BattleReplay } from "./u5-battle-replay";

const resolution: BattleResolution = {
  status: "victory",
  termination: "defeatedEnemies",
  rounds: 1,
  actions: [
    { round: 1, actorSide: "party", actorId: "party-1", targetId: "enemy-1", damage: 7, targetHpBefore: 7, targetHpAfter: 0, defeated: true },
  ],
  party: [{ id: "party-1", classId: "warrior", hp: 10, maxHp: 10, attack: 7, hitWeight: 3 }],
  enemies: [{ id: "enemy-1", monsterId: "spider-hatchling", hp: 0, maxHp: 7, baseDamage: 3 }],
};

const replay = createU5BattleReplay({
  resolution,
  presentations: [
    { id: "party-1", name: "코르빈", imageSrc: "/assets/characters/live/warrior/warrior_a.png" },
    { id: "enemy-1", name: "새끼거미", imageSrc: "/assets/monsters/spider/monster-spider-hatchling.png" },
  ],
});

const battleCss = readFileSync(join(process.cwd(), "app", "u5-battle.css"), "utf8");

function render(value: U5BattleReplay = replay): string {
  return renderToStaticMarkup(createElement(U5BattleScene, { replay: value }));
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
    const html = render(nonUniformAssetReplay);

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
    const attackReplay: U5BattleReplay = { ...replay, frames: [replay.frames[1]!] };
    const html = render(attackReplay);
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
    const impactReplay: U5BattleReplay = { ...replay, frames: [replay.frames[2]!] };
    const enemy = participantMarkup(render(impactReplay), "enemy-1");

    expect(enemy).toMatch(/<span class="u5-battle-damage-anchor"><span class="u5-battle-damage"/);
    expect(battleCss).toMatch(/\.u5-battle-damage-anchor\s*\{[^}]*transform:\s*translateX\(-50%\)/);
    expect(battleCss).not.toMatch(/\.u5-battle-damage\s*\{[^}]*transform:/);
  });

  it("현재 행동 한 문장만 polite live region으로 알리고 skip을 실제 button으로 제공한다", () => {
    const html = render();

    expect(html.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(html).toContain("전투가 시작됩니다.");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>전투 건너뛰기<\/button>/);
  });

  it("complete frame으로 시작하면 승리, 쓰러짐, 다시 보기 조작을 함께 보여준다", () => {
    const completeReplay: U5BattleReplay = { ...replay, frames: [replay.frames.at(-1)!] };
    const html = render(completeReplay);

    expect(html).toContain("파티가 전투에서 승리했습니다.");
    expect(html).toContain("쓰러짐");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>다시 보기<\/button>/);
  });
});
