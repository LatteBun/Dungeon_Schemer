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

function render(value: U5BattleReplay = replay): string {
  return renderToStaticMarkup(createElement(U5BattleScene, { replay: value }));
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
    expect(html).toMatch(/<img alt="코르빈" width="1024" height="1536"/);
    expect(html).toMatch(/<img alt="새끼거미" width="1254" height="1254"/);
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
