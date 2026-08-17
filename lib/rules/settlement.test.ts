import { describe, expect, it } from "vitest";
import { CAMPAIGN_GRADE_CONFIG } from "@/lib/content/dungeons";
import { RuleError } from "@/lib/domain";
import type {
  CampaignDungeon,
  CampaignMember,
  CampaignState,
  ClassId,
  DungeonId,
  ExpeditionResult,
  ExpeditionState,
  Grade,
  MemberId,
  PartyId,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import {
  createFixtureCampaignState,
  createFixtureExpeditionRecord,
  createFixtureExpeditionState,
} from "@/lib/rules/fixtures";
import { SETTLEMENT_STEP_ORDER, settleExpedition } from "@/lib/rules/settlement";
import { recordExpedition } from "@/lib/rules/statistics";

const CLASSES = ["warrior", "scout", "cleric"] as const;

function member(index: number, carriedGold = 20, trust = 50): CampaignMember {
  return {
    id: `member-00${index}` as MemberId,
    name: `용사${index}`,
    classId: CLASSES[index - 1] as ClassId,
    personality: "prudent",
    currentHp: 60,
    maxHp: 100,
    trust,
    carriedGold,
    alive: true,
    memory: [],
  };
}

function dungeon(grade: Grade): CampaignDungeon {
  return {
    id: "dungeon-001" as DungeonId,
    initialGrade: grade,
    grade,
    sortOrder: 0,
    status: "remaining",
    failureCount: 0,
  };
}

/**
 * 정산 직전 상태를 만든다. E3이 끝난 시점이므로 사망자는 이미 `alive: false`다.
 * 정산은 HP를 다시 계산하지 않는다.
 */
function stateBeforeSettlement(options: {
  grade?: Grade;
  survivors: number[];
  casualties: number[];
  carriedGold?: number;
  currentReputation?: number;
  currentGold?: number;
  cumulativeGold?: number;
  spare?: CampaignDungeon[];
  /** 충원에 쓸 예비 인원. 없으면 손상된 파티를 완성할 수 없다. */
  reserves?: boolean;
}): { state: CampaignState; expedition: ExpeditionState; result: ExpeditionResult } {
  const gold = options.carriedGold ?? 20;
  const party = [1, 2, 3].map((index) => ({
    ...member(index, gold),
    alive: options.survivors.includes(index),
    currentHp: options.survivors.includes(index) ? 60 : 0,
  }));
  const reserves = options.reserves === true
    ? CLASSES.map((classId, index) => ({
      ...member(1, gold),
      id: `member-reserve-${index + 1}` as MemberId,
      name: `예비${index + 1}`,
      classId: classId as ClassId,
    }))
    : [];
  const members = [...party, ...reserves];
  const result: ExpeditionResult = {
    status: options.survivors.length > 0 ? "cleared" : "failed",
    survivorIds: options.survivors.map((index) => `member-00${index}` as MemberId),
    casualtyIds: options.casualties.map((index) => `member-00${index}` as MemberId),
    reason: "테스트",
  };

  return {
    state: {
      ...createFixtureCampaignState("정산"),
      currentReputation: options.currentReputation ?? 100,
      currentGold: options.currentGold ?? 50,
      cumulativeGold: options.cumulativeGold ?? 200,
      dungeons: [dungeon(options.grade ?? "C"), ...(options.spare ?? [])],
      members,
      parties: [{
        id: "party-001" as PartyId,
        memberIds: party.map((entry) => entry.id),
        complete: true,
      }],
      reserveMemberIds: reserves.map((entry) => entry.id),
      waitingMemberIds: [],
      board: [],
    },
    expedition: {
      ...createFixtureExpeditionState(),
      dungeonId: "dungeon-001" as DungeonId,
      partyId: "party-001" as PartyId,
      result,
    },
    result,
  };
}

function settle(options: Parameters<typeof stateBeforeSettlement>[0] & { seed?: string }) {
  const { state, expedition } = stateBeforeSettlement(options);
  return settleExpedition({
    state,
    expedition,
    rng: createRng(options.seed ?? "정산").derive("regroup"),
  });
}

function ruleErrorOf(call: () => unknown): RuleError {
  let caught: unknown;
  try {
    call();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RuleError);
  return caught as RuleError;
}

describe("클리어 보상", () => {
  it.each([
    [3, [1, 2, 3], [], 1],
    [2, [1, 2], [3], 0.6],
    [1, [1], [2, 3], 0.3],
  ] as const)("생존 %i명은 보상의 %i번째 비율을 받고 버림한다", (_count, survivors, casualties, ratio) => {
    const config = CAMPAIGN_GRADE_CONFIG.A;
    const { state } = settle({ grade: "A", survivors: [...survivors], casualties: [...casualties] });

    expect(state.currentReputation).toBe(100 + Math.floor(config.baseReputationReward * ratio));
    expect(state.currentGold).toBe(50 + Math.floor(config.baseGoldReward * ratio));
    expect(state.cumulativeGold).toBe(200 + Math.floor(config.baseGoldReward * ratio));
  });

  it("A급 1명 생존은 소수점을 버려 명성 4와 골드 9를 준다", () => {
    const { state } = settle({ grade: "A", survivors: [1], casualties: [2, 3] });

    // 15 × 0.3 = 4.5 → 4, 33 × 0.3 = 9.9 → 9
    expect(state.currentReputation).toBe(104);
    expect(state.currentGold).toBe(59);
  });

  it("클리어한 던전은 cleared가 되고 등급이 오르지 않는다", () => {
    const { state } = settle({ grade: "B", survivors: [1, 2, 3], casualties: [] });

    expect(state.dungeons[0].status).toBe("cleared");
    expect(state.dungeons[0].grade).toBe("B");
    expect(state.dungeons[0].failureCount).toBe(0);
  });

  it("부분 생존은 사망자의 소지 골드를 얻지 않는다", () => {
    const { state } = settle({
      survivors: [1, 2],
      casualties: [3],
      carriedGold: 30,
      currentGold: 50,
    });

    // C급 2명 생존 골드는 floor(12 × 0.6) = 7. 유품 30은 더하지 않는다.
    expect(state.currentGold).toBe(57);
    expect(state.members.find((entry) => entry.id === "member-003")?.carriedGold).toBe(30);
  });
});

describe("전멸 정산", () => {
  it("보상 없이 기본 명성만큼 잃는다", () => {
    const { state } = settle({ grade: "A", survivors: [], casualties: [1, 2, 3] });

    // 생존 비율을 적용하지 않고 3명 생존 기본 명성을 그대로 뺀다.
    expect(state.currentReputation).toBe(100 - CAMPAIGN_GRADE_CONFIG.A.baseReputationReward);
  });

  it("사망자 전원의 소지 골드를 현재와 누적 골드에 더하고 회수한다", () => {
    const { state } = settle({
      survivors: [],
      casualties: [1, 2, 3],
      carriedGold: 25,
      currentGold: 50,
      cumulativeGold: 200,
    });

    expect(state.currentGold).toBe(50 + 75);
    expect(state.cumulativeGold).toBe(200 + 75);
    expect(state.members.every((entry) => entry.carriedGold === 0)).toBe(true);
  });

  it("전멸한 던전은 남고 한 단계 오르며 실패 횟수가 는다", () => {
    const { state } = settle({ grade: "B", survivors: [], casualties: [1, 2, 3] });

    expect(state.dungeons[0].status).toBe("remaining");
    expect(state.dungeons[0].grade).toBe("A");
    expect(state.dungeons[0].initialGrade).toBe("B");
    expect(state.dungeons[0].failureCount).toBe(1);
  });

  it("S급 전멸은 등급을 유지한다", () => {
    const { state } = settle({ grade: "S", survivors: [], casualties: [1, 2, 3] });

    expect(state.dungeons[0].grade).toBe("S");
    expect(state.dungeons[0].failureCount).toBe(1);
  });

  it("명성은 음수가 될 수 있고 요구치 아래로 내려가면 공고가 잠긴다", () => {
    const { state } = settle({
      survivors: [],
      casualties: [1, 2, 3],
      currentReputation: 0,
    });

    // 문서가 현재 명성의 최솟값을 제한하지 않는다. 다만 요구 명성이 음수
    // 구간까지 내려가므로 음수가 되는 것 자체는 잠금을 뜻하지 않는다.
    // 이 fixture는 출전 파티가 전멸해 완성 파티가 남지 않은 경우다.
    expect(state.currentReputation).toBe(-6);
    expect(state.ending?.id).toBe("partyExhausted");
  });
});

describe("승급", () => {
  it("정산 뒤 점수가 기준을 넘으면 즉시 승급한다", () => {
    const { state } = settle({
      survivors: [1, 2, 3],
      casualties: [],
      currentReputation: 30,
      cumulativeGold: 50,
    });

    // 명성 36 × 2 + 누적 62 = 134 ≥ 120
    expect(state.currentReputation).toBe(36);
    expect(state.cumulativeGold).toBe(62);
    expect(state.rank).toBe("B");
  });

  it("점수가 모자라면 등급을 올리지 않는다", () => {
    const { state } = settle({
      survivors: [1],
      casualties: [2, 3],
      currentReputation: 0,
      cumulativeGold: 0,
    });

    expect(state.rank).toBe("C");
  });
});

describe("파티와 게시판", () => {
  it("사망자를 예비로 충원하고 다음 게시판을 만든다", () => {
    const { state } = settle({
      survivors: [1, 2],
      casualties: [3],
      reserves: true,
      spare: [{ ...dungeon("C"), id: "dungeon-002" as DungeonId, sortOrder: 1 }],
    });
    const party = state.parties.find((entry) => entry.id === "party-001");

    expect(state.members.find((entry) => entry.id === "member-003")?.alive).toBe(false);
    expect(party?.memberIds).not.toContain("member-003");
    expect(party?.memberIds).toHaveLength(3);
    expect(party?.complete).toBe(true);
    expect(state.board.length).toBeGreaterThan(0);
    expect(state.expedition).toBeNull();
  });

  it("예비가 없어 파티를 완성할 수 없으면 공고가 생기지 않는다", () => {
    const { state } = settle({
      survivors: [1, 2],
      casualties: [3],
      spare: [{ ...dungeon("C"), id: "dungeon-002" as DungeonId, sortOrder: 1 }],
    });

    expect(state.parties.every((party) => !party.complete)).toBe(true);
    expect(state.board).toEqual([]);
    expect(state.ending?.id).toBe("partyExhausted");
  });

  it("엔딩이 없으면 게시판 단계로, 있으면 종료 단계로 간다", () => {
    const ongoing = settle({
      survivors: [1, 2, 3],
      casualties: [],
      spare: [{ ...dungeon("C"), id: "dungeon-002" as DungeonId, sortOrder: 1 }],
    });
    const finished = settle({ survivors: [1, 2, 3], casualties: [] });

    expect(ongoing.state.phase).toBe("board");
    expect(ongoing.state.ending).toBeNull();
    expect(finished.state.phase).toBe("ended");
    expect(finished.state.ending?.id).toBe("expeditionComplete");
  });
});

describe("정산 단계 기록", () => {
  it("정해진 순서로 원인 사슬을 남긴다", () => {
    const { steps } = settle({ survivors: [1, 2], casualties: [3] });

    expect(steps.map((step) => step.kind)).toEqual([...SETTLEMENT_STEP_ORDER]);
    expect(steps.every((step) => step.summary.trim() !== "")).toBe(true);
  });
});

describe("원정 기록", () => {
  it("정산 한 번이 기록 하나를 남긴다", () => {
    const settled = settle({ survivors: [1, 2, 3], casualties: [] });
    const statistics = settled.state.statistics;

    expect(statistics.expeditions).toHaveLength(1);
    expect(statistics.expeditions[0].order).toBe(1);
    expect(statistics.clearedExpeditions).toBe(1);
    expect(statistics.wipedExpeditions).toBe(0);
  });

  // settledDungeon 을 읽으면 실패로 오른 등급이 기록에 새어 든다.
  it("실패해도 기록의 등급은 출전 당시 등급이다", () => {
    const settled = settle({ grade: "C", survivors: [], casualties: [1, 2, 3] });
    const record = settled.state.statistics.expeditions[0];

    expect(record.grade).toBe("C");
    expect(settled.state.dungeons[0].grade).toBe("B");
    expect(record.status).toBe("failed");
  });

  it("승급하면 기록의 등급 전후가 갈린다", () => {
    const settled = settle({
      grade: "S",
      survivors: [1, 2, 3],
      casualties: [],
      currentReputation: 200,
      cumulativeGold: 300,
    });
    const record = settled.state.statistics.expeditions[0];

    expect(record.rankBefore).toBe("C");
    expect(record.rankAfter).toBe(settled.state.rank);
    expect(record.scoreAfter).toBeGreaterThan(record.scoreBefore);
  });

  it("기록이 정산 원인 사슬을 그대로 품는다", () => {
    const settled = settle({ survivors: [1, 2], casualties: [3] });

    expect(settled.state.statistics.expeditions[0].steps).toEqual(settled.steps);
  });

  // 앞선 원정을 다시 돌리지 않고 통계만 미리 채운다. 두 번째 정산이
  // 파티 재편을 다시 거치면 이 테스트가 순번이 아닌 것을 재게 된다.
  it("이미 기록이 있으면 다음 순번을 붙인다", () => {
    const { state, expedition } = stateBeforeSettlement({
      survivors: [1, 2, 3],
      casualties: [],
    });
    const settled = settleExpedition({
      state: {
        ...state,
        statistics: recordExpedition(
          state.statistics,
          createFixtureExpeditionRecord({ order: 1 }),
        ),
      },
      expedition,
      rng: createRng("순번"),
    });

    expect(settled.state.statistics.expeditions.map((record) => record.order))
      .toEqual([1, 2]);
  });

  it("같은 입력은 같은 통계를 낸다", () => {
    const first = settle({ survivors: [1, 2], casualties: [3], seed: "재현" });
    const second = settle({ survivors: [1, 2], casualties: [3], seed: "재현" });

    expect(first.state.statistics).toEqual(second.state.statistics);
  });
});

describe("입력 검증과 재현성", () => {
  it("결과가 없는 원정은 거부한다", () => {
    const { state, expedition } = stateBeforeSettlement({ survivors: [1, 2, 3], casualties: [] });
    const error = ruleErrorOf(() => settleExpedition({
      state,
      expedition: { ...expedition, result: null },
      rng: createRng("결과없음").derive("regroup"),
    }));

    expect(error.code).toBe("INVALID_SETTLEMENT");
  });

  it("캠페인에 없는 던전을 가리키면 거부한다", () => {
    const { state, expedition } = stateBeforeSettlement({ survivors: [1, 2, 3], casualties: [] });
    const error = ruleErrorOf(() => settleExpedition({
      state,
      expedition: { ...expedition, dungeonId: "dungeon-999" as DungeonId },
      rng: createRng("없는던전").derive("regroup"),
    }));

    expect(error.code).toBe("UNKNOWN_ID");
  });

  it("같은 입력과 시드는 같은 결과를 낸다", () => {
    const run = () => settle({ survivors: [1, 2], casualties: [3], seed: "재현" });

    expect(run()).toEqual(run());
  });

  it("입력 상태를 바꾸지 않는다", () => {
    const { state, expedition } = stateBeforeSettlement({ survivors: [], casualties: [1, 2, 3] });
    const snapshot = structuredClone(state);
    settleExpedition({ state, expedition, rng: createRng("불변").derive("regroup") });

    expect(state).toEqual(snapshot);
  });
});
