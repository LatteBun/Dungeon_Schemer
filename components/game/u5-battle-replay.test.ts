import { describe, expect, it } from "vitest";
import type { BattleActionRecord, BattleResolution } from "@/lib/rules/battle-engine";
import {
  createU5BattleReplay,
  type U5BattleReplayInput,
} from "./u5-battle-replay";

const resolution: BattleResolution = {
  status: "victory",
  termination: "defeatedEnemies",
  rounds: 2,
  actions: [
    { kind: "attack", round: 1, actorSide: "party", actorId: "party-1", targetId: "enemy-1", damage: 5, targetHpBefore: 9, targetHpAfter: 4, defeated: false },
    { kind: "attack", round: 1, actorSide: "enemy", actorId: "enemy-1", targetId: "party-1", damage: 3, targetHpBefore: 10, targetHpAfter: 7, defeated: false },
    { kind: "attack", round: 2, actorSide: "party", actorId: "party-1", targetId: "enemy-1", damage: 5, targetHpBefore: 4, targetHpAfter: 0, defeated: true },
  ],
  party: [{ id: "party-1", classId: "warrior", hp: 7, maxHp: 10, attack: 5, hitWeight: 3 }],
  enemies: [{ id: "enemy-1", monsterId: "spider-hatchling", hp: 0, maxHp: 9, baseDamage: 3 }],
};

const presentations = [
  { id: "party-1", name: "코르빈", imageSrc: "/assets/characters/live/warrior/warrior_a.png" },
  { id: "enemy-1", name: "새끼 거미", imageSrc: "/assets/monsters/spider/monster-spider-hatchling.png" },
] as const;

const emergencyHeal = {
  kind: "emergencyHeal",
  name: "치유 기도",
  healTargetMaxHpPercent: 25,
  usesPerExpedition: 2,
  triggerAtOrBelowHpPercent: 50,
} as const;

const healingResolution: BattleResolution = {
  status: "victory",
  termination: "defeatedEnemies",
  rounds: 2,
  actions: [
    { kind: "heal", round: 1, actorSide: "party", actorId: "cleric", targetId: "ally", abilityKind: "emergencyHeal", healing: 11, targetHpBefore: 2, targetHpAfter: 13 },
    { kind: "attack", round: 1, actorSide: "enemy", actorId: "enemy-1", targetId: "ally", damage: 3, targetHpBefore: 13, targetHpAfter: 10, defeated: false },
    { kind: "attack", round: 2, actorSide: "party", actorId: "cleric", targetId: "enemy-1", damage: 10, targetHpBefore: 10, targetHpAfter: 0, defeated: true },
  ],
  party: [
    { id: "cleric", classId: "cleric", hp: 5, maxHp: 10, attack: 3, hitWeight: 1, battleAbility: { ...emergencyHeal, remainingUses: 0 } },
    { id: "ally", classId: "warrior", hp: 10, maxHp: 45, attack: 5, hitWeight: 3 },
  ],
  enemies: [{ id: "enemy-1", monsterId: "spider-hatchling", hp: 0, maxHp: 10, baseDamage: 3 }],
};

const healingPresentations = [
  { id: "cleric", name: "세라핀", imageSrc: "/assets/characters/live/cleric/cleric_a.png" },
  { id: "ally", name: "코르빈", imageSrc: "/assets/characters/live/warrior/warrior_a.png" },
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

  it("공격 프레임은 공격 종류와 피해를 보존하고 settle에서 HP를 감소시킨다", () => {
    const [attack, impact, settle] = createU5BattleReplay(input()).frames.slice(1, 4);

    expect([attack?.actionKind, impact?.actionKind, settle?.actionKind]).toEqual(["attack", "attack", "attack"]);
    expect([attack?.damage, impact?.damage, settle?.damage]).toEqual([null, 5, null]);
    expect([attack?.healing, impact?.healing, settle?.healing]).toEqual([null, null, null]);
    expect([attack?.hpByParticipantId["enemy-1"], impact?.hpByParticipantId["enemy-1"], settle?.hpByParticipantId["enemy-1"]]).toEqual([9, 9, 4]);
  });

  it("치유 프레임은 실제 회복량을 보존하고 settle에서 HP와 잔여 횟수를 함께 바꾼다", () => {
    const replay = createU5BattleReplay({ resolution: healingResolution, presentations: healingPresentations });
    const [attack, impact, settle] = replay.frames.slice(1, 4);

    expect([attack?.actionKind, impact?.actionKind, settle?.actionKind]).toEqual(["heal", "heal", "heal"]);
    expect([attack?.healing, impact?.healing, settle?.healing]).toEqual([null, 11, null]);
    expect([attack?.damage, impact?.damage, settle?.damage]).toEqual([null, null, null]);
    expect([attack?.hpByParticipantId.ally, impact?.hpByParticipantId.ally, settle?.hpByParticipantId.ally]).toEqual([2, 2, 13]);
    expect([
      attack?.battleAbilityUsesRemainingByParticipantId.cleric,
      impact?.battleAbilityUsesRemainingByParticipantId.cleric,
      settle?.battleAbilityUsesRemainingByParticipantId.cleric,
    ]).toEqual([1, 1, 0]);
  });

  it.each([
    [45, 11, false],
    [45, 12, true],
    [30, 8, false],
    [30, 9, true],
  ] as const)("target 최대 HP %i와 치유 %i의 상한을 검증한다", (targetMaxHp, healing, shouldReject) => {
    const resolution = {
      ...healingResolution,
      actions: [
        { ...healingResolution.actions[0]!, healing, targetHpAfter: 2 + healing },
        { ...healingResolution.actions[1]!, targetHpBefore: 2 + healing, targetHpAfter: healing - 1 },
        healingResolution.actions[2]!,
      ],
      party: [
        healingResolution.party[0]!,
        { ...healingResolution.party[1]!, hp: healing - 1, maxHp: targetMaxHp },
      ],
    };

    const replay = () => createU5BattleReplay({ resolution, presentations: healingPresentations });
    if (shouldReject) {
      expect(replay).toThrowError(/치유량이 능력 범위를 벗어난다/);
    } else {
      expect(replay).not.toThrow();
    }
  });

  it("같은 actor의 두 치유도 시작 횟수를 복원하고 heal settle마다 한 번 감소시킨다", () => {
    const replay = createU5BattleReplay({
      resolution: {
        ...healingResolution,
        actions: [
          healingResolution.actions[0]!,
          { kind: "attack", round: 1, actorSide: "enemy", actorId: "enemy-1", targetId: "ally", damage: 11, targetHpBefore: 13, targetHpAfter: 2, defeated: false },
          { ...healingResolution.actions[0]!, round: 2, targetHpBefore: 2, targetHpAfter: 13 },
          { kind: "attack", round: 2, actorSide: "party", actorId: "ally", targetId: "enemy-1", damage: 10, targetHpBefore: 10, targetHpAfter: 0, defeated: true },
        ],
        party: [
          healingResolution.party[0]!,
          { ...healingResolution.party[1]!, hp: 13 },
        ],
      },
      presentations: healingPresentations,
    });

    expect(replay.frames[0]?.battleAbilityUsesRemainingByParticipantId).toEqual({ cleric: 2 });
    expect(replay.frames[3]?.battleAbilityUsesRemainingByParticipantId).toEqual({ cleric: 1 });
    expect(replay.frames[9]?.battleAbilityUsesRemainingByParticipantId).toEqual({ cleric: 0 });
    expect(replay.frames.at(-1)?.battleAbilityUsesRemainingByParticipantId).toEqual({ cleric: 0 });
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
    ["쓰러진 참가자의 후속 행동", input({ resolution: { ...resolution, actions: [...resolution.actions, { ...(resolution.actions[2] as Extract<BattleActionRecord, { kind: "attack" }>), actorId: "enemy-1", targetId: "party-1", actorSide: "enemy", defeated: false, targetHpBefore: 7, targetHpAfter: 2 }] } })],
    /* actor 만 보고 target 을 보지 않으면 시체를 다시 때리는 action 이 HP 0 → 0 으로 통과한다. */
    ["쓰러진 참가자를 다시 노리는 행동", input({ resolution: { ...resolution, actions: [...resolution.actions, { ...(resolution.actions[2] as Extract<BattleActionRecord, { kind: "attack" }>), actorId: "party-1", targetId: "enemy-1", actorSide: "party", damage: 0, targetHpBefore: 0, targetHpAfter: 0, defeated: true }] } })],
    ["final HP 불일치", input({ resolution: { ...resolution, party: [{ ...resolution.party[0], hp: 8 }] } })],
  ] as const)("%s은 설명 가능한 오류로 거부한다", (_case, invalidInput) => {
    expect(() => createU5BattleReplay(invalidInput)).toThrowError(/U5 전투 replay/);
  });

  it.each([
    ["공격 피해 사슬 불일치", { ...healingResolution, actions: [{ ...healingResolution.actions[1], targetHpAfter: 5 }, ...healingResolution.actions.slice(2)] }],
    ["공격 defeated 불일치", { ...healingResolution, actions: [{ ...healingResolution.actions[2], defeated: false }] }],
    ["치유량 사슬 불일치", { ...healingResolution, actions: [{ ...healingResolution.actions[0], healing: 4 }, ...healingResolution.actions.slice(1)] }],
    ["치유 max HP 초과", { ...healingResolution, actions: [{ ...healingResolution.actions[0], targetHpBefore: 8, targetHpAfter: 13 }, ...healingResolution.actions.slice(1)] }],
    ["쓰러진 치유 actor", { ...healingResolution, actions: [{ ...healingResolution.actions[0], actorId: "ally", targetId: "cleric", targetHpBefore: 0, targetHpAfter: 5 }], party: [{ ...healingResolution.party[0], hp: 5 }, { ...healingResolution.party[1], hp: 0 }] }],
    ["쓰러진 치유 target", { ...healingResolution, actions: [{ ...healingResolution.actions[0], targetHpBefore: 0, targetHpAfter: 5 }] }],
    ["파티가 아닌 치유 actor", { ...healingResolution, actions: [{ ...healingResolution.actions[0], actorId: "enemy-1", actorSide: "enemy" }] }],
    ["파티가 아닌 치유 target", { ...healingResolution, actions: [{ ...healingResolution.actions[0], targetId: "enemy-1", targetHpBefore: 5, targetHpAfter: 10 }] }],
    ["승리 뒤 치유", { ...healingResolution, actions: [healingResolution.actions[2]!, healingResolution.actions[0]!] }],
    ["최종 HP 불일치", { ...healingResolution, party: [healingResolution.party[0]!, { ...healingResolution.party[1], hp: 5 }] }],
    ["시작 잔여 횟수 초과", { ...healingResolution, party: [{ ...healingResolution.party[0], battleAbility: { ...emergencyHeal, remainingUses: 2 } }, healingResolution.party[1]!] }],
    ["heal actor의 프레임 잔여 상태 누락", { ...healingResolution, party: [{ ...healingResolution.party[0], battleAbility: undefined }, healingResolution.party[1]!] }],
    ["최종 잔여 횟수 범위 이탈", { ...healingResolution, party: [{ ...healingResolution.party[0], battleAbility: { ...emergencyHeal, remainingUses: -1 } }, healingResolution.party[1]!] }],
    ["최종 능력 종류 불일치", { ...healingResolution, party: [{ ...healingResolution.party[0], battleAbility: { ...emergencyHeal, kind: "unknown", remainingUses: 0 } }, healingResolution.party[1]!] }],
    ["치유 action 능력 종류 불일치", { ...healingResolution, actions: [{ ...healingResolution.actions[0], abilityKind: "unknown" }, ...healingResolution.actions.slice(1)] }],
    ["알 수 없는 action 종류", { ...healingResolution, actions: [{ ...healingResolution.actions[0], kind: "unknown" }, ...healingResolution.actions.slice(1)] }],
  ] as const)("%s을 거부한다", (_case, invalidResolution) => {
    expect(() => createU5BattleReplay({ resolution: invalidResolution as BattleResolution, presentations: healingPresentations }))
      .toThrowError(/U5 전투 replay/);
  });
});

/*
 * 다시 보기는 처음부터 다시 산다.
 *
 * 재생은 이미 끝난 전투를 되짚는 것이라, 마지막 결과를 알고 있다. 그 앎이
 * 앞쪽 프레임으로 새면 죽을 사람이 처음부터 죽은 채로 서 있게 된다. 어느
 * 프레임에서든 쓰러진 표시는 그 프레임의 HP가 0일 때만 붙어야 한다.
 */
describe("재생 프레임의 생사 표시", () => {
  it("HP가 0이 되기 전에는 어느 프레임도 쓰러졌다고 하지 않는다", () => {
    const replay = createU5BattleReplay(input());

    const early: string[] = [];
    for (const [index, frame] of replay.frames.entries()) {
      for (const id of frame.defeatedParticipantIds) {
        const hp = frame.hpByParticipantId[id];
        if (hp !== 0) early.push(`frame ${index}(${frame.phase}) ${id} HP ${hp}`);
      }
    }
    expect(early).toEqual([]);
  });

  it("HP가 0인 프레임은 반드시 쓰러졌다고 한다", () => {
    const replay = createU5BattleReplay(input());

    const missed: string[] = [];
    for (const [index, frame] of replay.frames.entries()) {
      for (const [id, hp] of Object.entries(frame.hpByParticipantId)) {
        if (hp === 0 && !frame.defeatedParticipantIds.includes(id)) {
          missed.push(`frame ${index}(${frame.phase}) ${id}`);
        }
      }
    }
    expect(missed).toEqual([]);
  });

  it("첫 프레임에서는 아무도 쓰러져 있지 않고 HP가 온전하다", () => {
    const replay = createU5BattleReplay(input());
    const first = replay.frames[0]!;

    expect(first.defeatedParticipantIds).toEqual([]);
    for (const participant of replay.participants) {
      expect(first.hpByParticipantId[participant.id], participant.id).toBe(participant.initialHp);
    }
  });
});
