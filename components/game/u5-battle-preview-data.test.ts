import { describe, expect, it } from "vitest";
import { enemyBattleAssetSrc } from "./u5-battle-assets";
import {
  createU5BattlePreviewEntries,
  U5_BATTLE_PREVIEW_ENTRIES,
} from "./u5-battle-preview-data";

describe("U5 battle preview data", () => {
  it("실제 E3 일반전과 E4 미연결 boss fixture 두 상태만 제공한다", () => {
    expect(U5_BATTLE_PREVIEW_ENTRIES.map((entry) => entry.id)).toEqual([
      "e3-monster",
      "boss-fixture",
    ]);
  });

  it("E3 일반전은 action 기록이 있고 같은 seed에서 같은 결과를 만든다", () => {
    const first = createU5BattlePreviewEntries().find((entry) => entry.id === "e3-monster");
    const second = createU5BattlePreviewEntries().find((entry) => entry.id === "e3-monster");

    expect(first?.resolution.actions.length).toBeGreaterThan(0);
    expect(first?.resolution).toEqual(second?.resolution);
  });

  it("E3 action 하나를 attack, impact, settle 세 frame으로 확장한다", () => {
    const entry = U5_BATTLE_PREVIEW_ENTRIES.find((candidate) => candidate.id === "e3-monster")!;

    expect(entry.replay.frames).toHaveLength(1 + entry.resolution.actions.length * 3 + 1);
  });

  it("boss는 E4 미연결 fixture임을 밝히고 공식 manifest 이미지를 사용한다", () => {
    const entry = U5_BATTLE_PREVIEW_ENTRIES.find((candidate) => candidate.id === "boss-fixture")!;
    const enemy = entry.resolution.enemies[0]!;
    const replayEnemy = entry.replay.participants.find((participant) => participant.id === enemy.id);

    expect(entry.sourceLabel).toContain("E4 미연결 fixture");
    expect(replayEnemy?.imageSrc).toBe(enemyBattleAssetSrc(enemy.monsterId));
  });

  it("두 상태 모두 party presentation에 기존 live portrait 경로를 명시한다", () => {
    for (const entry of U5_BATTLE_PREVIEW_ENTRIES) {
      const party = entry.replay.participants.filter((participant) => participant.side === "party");
      expect(party).toHaveLength(3);
      for (const participant of party) {
        expect(participant.imageSrc).toMatch(/^\/assets\/characters\/live\/(warrior|archer|cleric|mage|rogue)\/\1_[ab]\.png$/);
      }
    }
  });
});
