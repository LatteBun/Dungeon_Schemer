import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Rng } from "@/lib/rng";
import { runWorldTurn } from "@/lib/domain";
import type { Character, CharacterId, ClassId, ExpeditionParty } from "@/lib/domain";

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: "character-001" as CharacterId,
    name: "테스트",
    classId: "warrior" as ClassId,
    personality: "prudent",
    maxHp: 100,
    hp: 100,
    trust: 50,
    gold: 30,
    alive: true,
    gravelyWounded: false,
    ...overrides,
  };
}

function makePool(members: Character[]) {
  return {
    byId: Object.fromEntries(
      members.map((member) => [member.id, member]),
    ),
    order: members.map((member) => member.id),
  };
}

const emptyParty: ExpeditionParty = { memberIds: [] };
const rng = createRng("worldturn-test").derive("worldturn");
const memberId = "character-001" as CharacterId;
const pool = makePool([character({ id: memberId })]);
const fixedRng: Rng = {
  seed: "worldturn-fixed",
  float: () => 0,
  int: (min) => min,
  pick: <T>(items: readonly T[]) => items[0],
  shuffle: <T>(items: readonly T[]) => [...items],
  derive: () => fixedRng,
};

describe("월드턴 입력 검증", () => {
  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "월드턴 번호가 정수가 아니면 INVALID_STATE: %s",
    (worldTurn) => {
      expect(() => runWorldTurn(pool, emptyParty, worldTurn, rng)).toThrowError(
        expect.objectContaining({ code: "INVALID_STATE" }),
      );
    },
  );

  it("pool.order와 byId의 ID 집합이 다르면 INVALID_STATE다", () => {
    const invalidPool = { ...pool, order: ["missing" as CharacterId] };

    expect(() => runWorldTurn(invalidPool, emptyParty, 0, rng)).toThrowError(
      expect.objectContaining({ code: "INVALID_STATE" }),
    );
  });

  it.each([
    { field: "maxHp", value: 0 },
    { field: "hp", value: 100.5 },
    { field: "gold", value: -1 },
    { field: "trust", value: 101 },
  ])("캐릭터 $field 상태가 잘못되면 INVALID_STATE다", ({ field, value }) => {
    const invalid = character({ [field]: value } as Partial<Character>);

    expect(() => runWorldTurn(makePool([invalid]), emptyParty, 0, rng)).toThrowError(
      expect.objectContaining({ code: "INVALID_STATE" }),
    );
  });

  it("알 수 없는 파티 ID는 UNKNOWN_ID다", () => {
    expect(() => runWorldTurn(pool, { memberIds: ["missing" as CharacterId] }, 0, rng))
      .toThrowError(expect.objectContaining({ code: "UNKNOWN_ID" }));
  });

  it("중복 파티 ID는 DUPLICATE_ID다", () => {
    expect(() => runWorldTurn(pool, { memberIds: [memberId, memberId] }, 0, rng))
      .toThrowError(expect.objectContaining({ code: "DUPLICATE_ID" }));
  });

  it("정상 입력은 다음 월드턴 번호와 빈 결과를 반환한다", () => {
    const execution = runWorldTurn(pool, emptyParty, 0, rng);

    expect(execution.result.worldTurn).toBe(1);
    expect(execution.result.outcomes[0].activity).toBe("rest");
  });
});

describe("월드턴 활동 배정", () => {
  it("원정 파티원과 사망자는 월드턴에서 처리하지 않는다", () => {
    const result = runWorldTurn(
      makePool([
        character({ id: memberId }),
        character({ id: "dead" as CharacterId, alive: false }),
        character({ id: "resting" as CharacterId, hp: 40 }),
      ]),
      { memberIds: [memberId] },
      3,
      createRng("assignment-exclusion").derive("worldturn"),
    );

    expect(result.result.outcomes.map((outcome) => outcome.characterId)).toEqual([
      "resting",
    ]);
  });

  it("HP 50% 미만은 forcedRest이고 중상과 다르다", () => {
    const lowHp = character({ id: "low" as CharacterId, hp: 40 });
    const result = runWorldTurn(
      makePool([lowHp]),
      emptyParty,
      0,
      createRng("assignment-low-hp").derive("worldturn"),
    );

    expect(result.result.outcomes[0].activity).toBe("forcedRest");
    expect(result.pool.byId[lowHp.id].gravelyWounded).toBe(false);
  });

  it("이미 중상인 캐릭터는 HP가 높아도 rest만 받는다", () => {
    const wounded = character({
      id: "wounded" as CharacterId,
      hp: 80,
      gravelyWounded: true,
    });
    const result = runWorldTurn(
      makePool([wounded]),
      emptyParty,
      0,
      createRng("assignment-wounded").derive("worldturn"),
    );

    expect(result.result.outcomes[0].activity).toBe("rest");
  });

  it("일반 후보는 시드로 섞은 뒤 휴식 ceil/2, 백그라운드 floor/2로 나뉜다", () => {
    const members = Array.from({ length: 5 }, (_, index) =>
      character({ id: `candidate-${index}` as CharacterId }),
    );
    const result = runWorldTurn(
      makePool(members),
      emptyParty,
      0,
      createRng("assignment-half").derive("worldturn"),
    );
    const activities = result.result.outcomes.map((outcome) => outcome.activity);

    expect(activities.filter((activity) => activity === "rest")).toHaveLength(3);
    expect(activities.filter((activity) => activity === "background")).toHaveLength(2);
  });
});

describe("월드턴 상태 적용", () => {
  it("휴식은 최대 HP의 15%를 최소 2만큼 회복하고 maxHp를 넘지 않는다", () => {
    const member = character({ id: "rest" as CharacterId, hp: 40, maxHp: 100 });
    const result = runWorldTurn(makePool([member]), emptyParty, 0, fixedRng);

    expect(result.pool.byId[member.id].hp).toBe(55);
    expect(result.result.outcomes[0].hpDelta).toBe(15);
    expect(result.result.outcomes[0].goldDelta).toBe(0);
  });

  it("휴식 회복량은 최소 2이고 HP는 maxHp에서 멈춘다", () => {
    const member = character({ id: "small" as CharacterId, maxHp: 10, hp: 9 });
    const result = runWorldTurn(makePool([member]), emptyParty, 0, fixedRng);

    expect(result.pool.byId[member.id].hp).toBe(10);
    expect(result.result.outcomes[0].hpDelta).toBe(1);
  });

  it("백그라운드는 정수 HP 손실·골드 획득을 적용하고 HP 하한 1을 지킨다", () => {
    const members = [
      character({ id: "rest" as CharacterId }),
      character({ id: "background" as CharacterId, hp: 50 }),
    ];
    const result = runWorldTurn(makePool(members), emptyParty, 0, fixedRng);
    const outcome = result.result.outcomes.find(
      (entry) => entry.characterId === ("background" as CharacterId),
    );

    expect(result.pool.byId["background" as CharacterId].hp).toBe(40);
    expect(result.pool.byId["background" as CharacterId].gold).toBe(35);
    expect(outcome?.hpDelta).toBe(-10);
    expect(outcome?.goldDelta).toBe(5);
  });
});

describe("중상 경계와 해제", () => {
  it("처리 후 HP가 20% 미만이면 새 중상으로 기록한다", () => {
    const member = character({ id: "below" as CharacterId, hp: 1 });
    const result = runWorldTurn(makePool([member]), emptyParty, 0, fixedRng);

    expect(result.pool.byId[member.id].hp).toBe(16);
    expect(result.pool.byId[member.id].gravelyWounded).toBe(true);
    expect(result.result.outcomes[0].becameGravelyWounded).toBe(true);
  });

  it("처리 후 HP가 정확히 20%면 중상이 아니다", () => {
    const member = character({ id: "exact" as CharacterId, hp: 5 });
    const result = runWorldTurn(makePool([member]), emptyParty, 0, fixedRng);

    expect(result.pool.byId[member.id].hp).toBe(20);
    expect(result.pool.byId[member.id].gravelyWounded).toBe(false);
  });

  it("중상 캐릭터가 휴식으로 20% 이상이 되면 중상을 해제한다", () => {
    const member = character({
      id: "wounded" as CharacterId,
      hp: 10,
      gravelyWounded: true,
    });
    const result = runWorldTurn(makePool([member]), emptyParty, 0, fixedRng);

    expect(result.pool.byId[member.id].hp).toBe(25);
    expect(result.pool.byId[member.id].gravelyWounded).toBe(false);
    expect(result.result.outcomes[0].becameGravelyWounded).toBe(false);
  });
});

describe("월드턴 추가 경계", () => {
  it("HP가 정확히 50%면 forcedRest가 아니다", () => {
    const member = character({ id: "half" as CharacterId, hp: 50 });
    const result = runWorldTurn(makePool([member]), emptyParty, 0, fixedRng);

    expect(result.result.outcomes[0].activity).toBe("rest");
  });

  it("백그라운드 HP는 1에서 멈추고 사망시키지 않는다", () => {
    const members = [
      character({ id: "rest" as CharacterId }),
      character({ id: "floor" as CharacterId, maxHp: 2, hp: 1 }),
    ];
    const result = runWorldTurn(makePool(members), emptyParty, 0, fixedRng);
    const member = result.pool.byId["floor" as CharacterId];
    const outcome = result.result.outcomes.find(
      (entry) => entry.characterId === ("floor" as CharacterId),
    );
    expect(member.hp).toBe(1);
    expect(member.alive).toBe(true);
    expect(outcome?.hpDelta).toBe(0);
  });
});

describe("월드턴 재현성과 불변성", () => {
  it("같은 입력과 같은 RNG는 같은 결과를 만들고 입력을 바꾸지 않는다", () => {
    const members = [
      character({ id: "first" as CharacterId, hp: 40 }),
      character({ id: "second" as CharacterId }),
    ];
    const inputPool = makePool(members);
    const inputParty: ExpeditionParty = { memberIds: [] };
    const poolSnapshot = structuredClone(inputPool);
    const partySnapshot = structuredClone(inputParty);

    const first = runWorldTurn(
      inputPool,
      inputParty,
      2,
      createRng("reproducible").derive("worldturn"),
    );
    const second = runWorldTurn(
      inputPool,
      inputParty,
      2,
      createRng("reproducible").derive("worldturn"),
    );

    expect(first).toEqual(second);
    expect(inputPool).toEqual(poolSnapshot);
    expect(inputParty).toEqual(partySnapshot);
  });
});

describe("월드턴 결과 계약", () => {
  it("결과 순서는 RNG 셔플이 아니라 pool.order를 따른다", () => {
    const members = [
      character({ id: "third" as CharacterId }),
      character({ id: "first" as CharacterId }),
      character({ id: "second" as CharacterId }),
    ];
    const result = runWorldTurn(makePool(members), emptyParty, 0, fixedRng);

    expect(result.result.outcomes.map((outcome) => outcome.characterId)).toEqual([
      "third",
      "first",
      "second",
    ]);
  });

  it("모든 생존자가 중상이어도 C3는 엔딩을 만들지 않는다", () => {
    const members = [
      character({ id: "one" as CharacterId, hp: 10, gravelyWounded: true }),
      character({ id: "two" as CharacterId, hp: 10, gravelyWounded: true }),
      character({ id: "three" as CharacterId, hp: 10, gravelyWounded: true }),
    ];
    const result = runWorldTurn(makePool(members), emptyParty, 4, fixedRng);

    expect(result.result.worldTurn).toBe(5);
    expect(result.result.outcomes).toHaveLength(3);
    expect(result).not.toHaveProperty("ending");
  });
});
