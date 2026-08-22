import { describe, expect, it } from "vitest";
import type { BattleResolution } from "@/lib/rules/battle-engine";
import {
  createU5BattleReplay,
  type U5BattleReplayInput,
} from "./u5-battle-replay";

const resolution: BattleResolution = {
  status: "victory",
  termination: "defeatedEnemies",
  rounds: 2,
  actions: [
    { round: 1, actorSide: "party", actorId: "party-1", targetId: "enemy-1", damage: 5, targetHpBefore: 9, targetHpAfter: 4, defeated: false },
    { round: 1, actorSide: "enemy", actorId: "enemy-1", targetId: "party-1", damage: 3, targetHpBefore: 10, targetHpAfter: 7, defeated: false },
    { round: 2, actorSide: "party", actorId: "party-1", targetId: "enemy-1", damage: 5, targetHpBefore: 4, targetHpAfter: 0, defeated: true },
  ],
  party: [{ id: "party-1", classId: "warrior", hp: 7, maxHp: 10, attack: 5, hitWeight: 3 }],
  enemies: [{ id: "enemy-1", monsterId: "spider-hatchling", hp: 0, maxHp: 9, baseDamage: 3 }],
};

const presentations = [
  { id: "party-1", name: "코르빈", imageSrc: "/assets/characters/live/warrior/warrior_a.png" },
  { id: "enemy-1", name: "새끼 거미", imageSrc: "/assets/monsters/spider/monster-spider-hatchling.png" },
] as const;

function input(overrides: Partial<U5BattleReplayInput> = {}): U5BattleReplayInput {
  return { resolution, presentations, ...overrides };
}

describe("createU5BattleReplay", () => {
  it("같은 입력은 구조적으로 같은 replay를 만든다", () => {
    expect(createU5BattleReplay(input())).toEqual(createU5BattleReplay(input()));
  });

  it("idle 뒤 각 action을 attack, impact, settle로 재생하고 complete로 끝낸다", () => {
    expect(createU5BattleReplay(input()).frames.map((frame) => frame.phase)).toEqual([
      "idle", "attack", "impact", "settle", "attack", "impact", "settle", "attack", "impact", "settle", "complete",
    ]);
  });

  it("세 action resolution은 열한 frame을 만든다", () => {
    expect(createU5BattleReplay(input()).frames).toHaveLength(11);
  });

  it("attack과 impact는 대상의 action 전 HP를, settle은 action 후 HP를 보인다", () => {
    const frames = createU5BattleReplay(input()).frames;
    expect([frames[1].hpByParticipantId["enemy-1"], frames[2].hpByParticipantId["enemy-1"], frames[3].hpByParticipantId["enemy-1"]]).toEqual([9, 9, 4]);
    expect([frames[4].hpByParticipantId["party-1"], frames[5].hpByParticipantId["party-1"], frames[6].hpByParticipantId["party-1"]]).toEqual([10, 10, 7]);
    expect([frames[7].hpByParticipantId["enemy-1"], frames[8].hpByParticipantId["enemy-1"], frames[9].hpByParticipantId["enemy-1"]]).toEqual([4, 4, 0]);
  });

  it("impact damage는 action damage를 보존한다", () => {
    expect(createU5BattleReplay(input()).frames.filter((frame) => frame.phase === "impact").map((frame) => frame.damage)).toEqual([5, 3, 5]);
  });

  it("complete는 resolution의 최종 HP를 보인다", () => {
    expect(createU5BattleReplay(input()).frames.at(-1)?.hpByParticipantId).toEqual({ "party-1": 7, "enemy-1": 0 });
  });

  it("첫 targetHpBefore를 initial HP로 쓰고 target이 아닌 참가자는 final HP를 쓴다", () => {
    const replay = createU5BattleReplay(input({
      resolution: {
        ...resolution,
        party: [...resolution.party, { id: "party-2", classId: "mage", hp: 6, maxHp: 6, attack: 4, hitWeight: 1 }],
      },
      presentations: [...presentations, { id: "party-2", name: "리에", imageSrc: "/assets/characters/live/mage/mage_a.png" }],
    }));
    expect(replay.participants.map(({ id, initialHp }) => ({ id, initialHp }))).toEqual([
      { id: "party-1", initialHp: 10 },
      { id: "party-2", initialHp: 6 },
      { id: "enemy-1", initialHp: 9 },
    ]);
  });

  it("participants는 party 뒤 enemies 순서를 유지한다", () => {
    expect(createU5BattleReplay(input()).participants.map((participant) => participant.id)).toEqual(["party-1", "enemy-1"]);
  });

  it("presentation의 이름과 portrait 경로를 그대로 보존한다", () => {
    expect(createU5BattleReplay(input()).participants.map(({ id, name, imageSrc }) => ({ id, name, imageSrc }))).toEqual([
      { id: "party-1", name: "코르빈", imageSrc: "/assets/characters/live/warrior/warrior_a.png" },
      { id: "enemy-1", name: "새끼 거미", imageSrc: "/assets/monsters/spider/monster-spider-hatchling.png" },
    ]);
  });

  it.each([
    ["presentation 누락", input({ presentations: [presentations[0]] })],
    ["presentation 중복", input({ presentations: [...presentations, presentations[1]] })],
    ["resolution 참가자 ID 중복", input({ resolution: { ...resolution, enemies: [{ ...resolution.enemies[0], id: "party-1" }] } })],
    ["알 수 없는 actor", input({ resolution: { ...resolution, actions: [{ ...resolution.actions[0], actorId: "missing" }] } })],
    ["알 수 없는 target", input({ resolution: { ...resolution, actions: [{ ...resolution.actions[0], targetId: "missing" }] } })],
    ["HP chain 불일치", input({ resolution: { ...resolution, actions: [{ ...resolution.actions[0], targetHpBefore: 8 }] } })],
    ["쓰러진 참가자의 후속 행동", input({ resolution: { ...resolution, actions: [...resolution.actions, { ...resolution.actions[2], actorId: "enemy-1", targetId: "party-1", actorSide: "enemy", defeated: false, targetHpBefore: 7, targetHpAfter: 2 }] } })],
    ["final HP 불일치", input({ resolution: { ...resolution, party: [{ ...resolution.party[0], hp: 8 }] } })],
  ] as const)("%s은 설명 가능한 오류로 거부한다", (_case, invalidInput) => {
    expect(() => createU5BattleReplay(invalidInput)).toThrowError(/U5 전투 replay/);
  });
});
