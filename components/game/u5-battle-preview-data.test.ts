import { describe, expect, it } from "vitest";
import { DENOUNCE_THRESHOLD } from "@/lib/domain";
import { enemyBattleAssetSrc } from "./u5-battle-assets";
import {
  createU5BattlePreviewEntries,
  U5_BATTLE_PREVIEW_ENTRIES,
} from "./u5-battle-preview-data";

describe("U5 battle preview data", () => {
  it("실제 E3 일반전과 실제 E4 보스전 두 상태만 제공한다", () => {
    expect(U5_BATTLE_PREVIEW_ENTRIES.map((entry) => entry.id)).toEqual([
      "e3-monster",
      "e4-boss",
    ]);
  });

  it("두 상태 모두 상단 상태 바의 누적 고발 기준을 제공한다", () => {
    for (const entry of U5_BATTLE_PREVIEW_ENTRIES) {
      expect(entry.status.zeroTrust.threshold).toBe(DENOUNCE_THRESHOLD);
      expect(entry.status.zeroTrust.livingCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("E3 일반전은 action 기록이 있고 같은 seed에서 같은 결과를 만든다", () => {
    const first = createU5BattlePreviewEntries().find((entry) => entry.id === "e3-monster");
    const second = createU5BattlePreviewEntries().find((entry) => entry.id === "e3-monster");

    expect(first?.resolution.actions.length).toBeGreaterThan(0);
    expect(first?.resolution).toEqual(second?.resolution);
  });

  it("결정적 E3 fixture는 실제 치유를 정확히 한 번 포함한다", () => {
    const entry = U5_BATTLE_PREVIEW_ENTRIES.find((candidate) => candidate.id === "e3-monster")!;
    const heals = entry.resolution.actions.filter((action) => action.kind === "heal");

    expect(heals).toHaveLength(1);
    expect(heals[0]).toMatchObject({ abilityKind: "emergencyHeal", healing: 5 });
    expect(entry.replay.frames.filter(
      (frame) => frame.phase === "impact" && frame.actionKind === "heal",
    )).toHaveLength(1);
  });

  it("E3 action 하나를 attack, impact, settle 세 frame으로 확장한다", () => {
    const entry = U5_BATTLE_PREVIEW_ENTRIES.find((candidate) => candidate.id === "e3-monster")!;

    expect(entry.replay.frames).toHaveLength(1 + entry.resolution.actions.length * 3 + 1);
  });

  /*
   * 보스전은 E4 가 계산한다. 한때 이 자리에 resolveBossBattle 을 부르지 않는
   * 시각 fixture 가 있었고 화면에도 그렇게 표시했다. 이제 규칙이 낸 턴 기록을
   * 그대로 쓰므로, 화면이 지어낸 적 ID 가 아니라 규칙이 정한 ID 로 이어진다.
   */
  it("보스전은 실제 규칙 결과를 쓰고 공식 manifest 이미지를 붙인다", () => {
    const entry = U5_BATTLE_PREVIEW_ENTRIES.find((candidate) => candidate.id === "e4-boss")!;
    const enemy = entry.resolution.enemies[0]!;
    const replayEnemy = entry.replay.participants.find((participant) => participant.id === enemy.id);

    expect(entry.sourceLabel).toContain("resolveBossBattle");
    expect(entry.resolution.actions.length).toBeGreaterThan(0);
    expect(replayEnemy?.imageSrc).toBe(enemyBattleAssetSrc(enemy.monsterId));
  });

  it("보스전도 같은 seed 에서 같은 결과를 만든다", () => {
    const first = createU5BattlePreviewEntries().find((entry) => entry.id === "e4-boss");
    const second = createU5BattlePreviewEntries().find((entry) => entry.id === "e4-boss");

    expect(first?.resolution).toEqual(second?.resolution);
  });

  it("두 상태 모두 party presentation에 기존 live portrait 경로를 명시한다", () => {
    for (const entry of U5_BATTLE_PREVIEW_ENTRIES) {
      const party = entry.replay.participants.filter((participant) => participant.side === "party");
      expect(party).toHaveLength(3);
      for (const participant of party) {
        expect(participant.imageSrc).toMatch(/^\/assets\/characters\/live\/(warrior|archer|cleric|mage|rogue)\/\1_[a-f]\.png$/);
      }
    }
  });

  it("두 상태 모두 반응 확인 뒤 지속 신뢰 변화량을 검증할 수 있다", () => {
    for (const entry of U5_BATTLE_PREVIEW_ENTRIES) {
      expect(entry.feedback.postBattleReaction).not.toBeNull();
      expect(entry.feedback.postBattleTrustChanges).toHaveLength(1);
      const change = entry.feedback.postBattleTrustChanges[0]!;
      expect(change.after).not.toBe(change.before);
      expect(entry.progress.party.some((member) => member.id === change.memberId)).toBe(true);
      const participant = entry.replay.participants.find((candidate) => candidate.id === change.memberId);
      if (entry.id === "e4-boss") expect(participant?.finalHp).not.toBe(participant?.initialHp);
    }
  });
});
