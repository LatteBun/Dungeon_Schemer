import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
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
