import { describe, expect, it } from "vitest";
import { TRUTH_TYPES } from "@/lib/domain";
import type {
  BossResult,
  ExpeditionState,
  InfoRecord,
  CardId,
  MemberId,
} from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { createFixtureExpeditionState } from "@/lib/rules/fixtures";
import { createFixtureExpeditionRecord } from "@/lib/rules/fixtures";
import { emptyStatistics, summarizeExpeditionCards, findTurningPoint, recordExpedition } from "./statistics";

describe("emptyStatistics", () => {
  it("진위 세 종류를 모두 0으로 채운다", () => {
    const statistics = emptyStatistics();

    for (const truthType of TRUTH_TYPES) {
      expect(statistics.cards[truthType]).toEqual({
        delivered: 0,
        accepted: 0,
        suspected: 0,
        exposed: 0,
        lateExposed: 0,
      });
    }
    expect(statistics.clearedExpeditions).toBe(0);
    expect(statistics.wipedExpeditions).toBe(0);
    expect(statistics.expeditions).toEqual([]);
    expect(statistics.turningPoint).toBeNull();
  });

  // 상수 하나를 공유하면 한 캠페인의 집계가 다음 캠페인에 새어 든다.
  it("호출마다 새 객체를 준다", () => {
    const first = emptyStatistics();
    first.cards.lie.delivered = 5;

    expect(emptyStatistics().cards.lie.delivered).toBe(0);
  });

  it("새 캠페인은 빈 통계로 시작한다", () => {
    expect(initializeCampaign("씨앗").statistics).toEqual(emptyStatistics());
  });
});

function infoRecord(overrides: Partial<InfoRecord> = {}): InfoRecord {
  return {
    cardId: "card-001" as CardId,
    truthType: "truth",
    subject: "boss",
    memberId: "member-001" as MemberId,
    reaction: "accepted",
    modifier: 0,
    pendingVerification: false,
    ...overrides,
  };
}

function expeditionWith(
  infoRecords: InfoRecord[],
  bossResult: BossResult | null,
): ExpeditionState {
  return { ...createFixtureExpeditionState(), infoRecords, bossResult };
}

function bossResult(survivorIds: string[]): BossResult {
  return {
    survivorIds: survivorIds as MemberId[],
    casualtyIds: [],
    damageByMember: {},
  };
}

describe("summarizeExpeditionCards", () => {
  it("한 번의 전달을 세 명이 판정하면 전달 1장에 반응 3건이다", () => {
    const cards = summarizeExpeditionCards(expeditionWith([
      infoRecord({ memberId: "member-001" as MemberId, reaction: "accepted" }),
      infoRecord({ memberId: "member-002" as MemberId, reaction: "suspected" }),
      infoRecord({ memberId: "member-003" as MemberId, reaction: "accepted" }),
    ], null));

    expect(cards.truth.delivered).toBe(1);
    expect(cards.truth.accepted).toBe(2);
    expect(cards.truth.suspected).toBe(1);
  });

  // id 를 집합으로 세면 두 번째 거짓말이 사라진다.
  it("같은 카드를 두 지점에서 전달하면 전달 2장이다", () => {
    const cards = summarizeExpeditionCards(expeditionWith([
      infoRecord({ cardId: "card-001" as CardId }),
      infoRecord({ cardId: "card-001" as CardId, memberId: "member-002" as MemberId }),
      infoRecord({ cardId: "card-002" as CardId }),
      infoRecord({ cardId: "card-001" as CardId }),
    ], null));

    expect(cards.truth.delivered).toBe(3);
  });

  it("반응 건수의 합이 기록 수와 같다", () => {
    const records = [
      infoRecord({ truthType: "lie", reaction: "accepted", pendingVerification: true }),
      infoRecord({ truthType: "lie", reaction: "exposed", memberId: "member-002" as MemberId }),
      infoRecord({ truthType: "neutral", reaction: "suspected" }),
    ];
    const cards = summarizeExpeditionCards(expeditionWith(records, null));
    const total = Object.values(cards).reduce(
      (sum, stat) => sum + stat.accepted + stat.suspected + stat.exposed,
      0,
    );

    expect(total).toBe(records.length);
  });

  it("수용된 거짓은 보스전에서 살아남은 사람만 사후 발각으로 센다", () => {
    const cards = summarizeExpeditionCards(expeditionWith([
      infoRecord({
        truthType: "lie",
        memberId: "member-001" as MemberId,
        pendingVerification: true,
      }),
      infoRecord({
        truthType: "lie",
        memberId: "member-002" as MemberId,
        pendingVerification: true,
      }),
    ], bossResult(["member-001"])));

    expect(cards.lie.lateExposed).toBe(1);
  });

  // 사건 도중 전멸하면 보스전 자체가 없어 아무도 검증되지 않는다.
  it("보스전을 치르지 않은 원정은 사후 발각이 0이다", () => {
    const cards = summarizeExpeditionCards(expeditionWith([
      infoRecord({ truthType: "lie", pendingVerification: true }),
    ], null));

    expect(cards.lie.lateExposed).toBe(0);
  });

  it("진실과 중립은 사후 발각이 없다", () => {
    const cards = summarizeExpeditionCards(expeditionWith([
      infoRecord({ truthType: "truth" }),
      infoRecord({ truthType: "neutral", memberId: "member-002" as MemberId }),
    ], bossResult(["member-001", "member-002"])));

    expect(cards.truth.lateExposed).toBe(0);
    expect(cards.neutral.lateExposed).toBe(0);
  });

  it("사후 발각은 수용된 거짓을 넘을 수 없다", () => {
    const cards = summarizeExpeditionCards(expeditionWith([
      infoRecord({
        truthType: "lie",
        reaction: "accepted",
        memberId: "member-001" as MemberId,
        pendingVerification: true,
      }),
      infoRecord({
        truthType: "lie",
        reaction: "exposed",
        memberId: "member-002" as MemberId,
      }),
    ], bossResult(["member-001", "member-002"])));

    expect(cards.lie.lateExposed).toBeLessThanOrEqual(cards.lie.accepted);
  });

  it("기록이 없으면 빈 집계다", () => {
    expect(summarizeExpeditionCards(expeditionWith([], null)))
      .toEqual(emptyStatistics().cards);
  });
});

describe("findTurningPoint", () => {
  it("기록이 없으면 전환점이 없다", () => {
    expect(findTurningPoint([])).toBeNull();
  });

  // wipeGoldFirst 의 77.4%가 첫 전멸 뒤 지원 불가로 끝났다.
  it("전멸이 승급보다 앞선다", () => {
    const point = findTurningPoint([
      createFixtureExpeditionRecord({
        order: 1,
        rankBefore: "C",
        rankAfter: "B",
        scoreBefore: 0,
        scoreAfter: 500,
      }),
      createFixtureExpeditionRecord({
        order: 2,
        status: "failed",
        survivorCount: 0,
        casualtyCount: 3,
      }),
    ]);

    expect(point?.kind).toBe("firstWipe");
    expect(point?.expeditionOrder).toBe(2);
  });

  it("전멸이 여럿이면 첫 전멸을 고른다", () => {
    const point = findTurningPoint([
      createFixtureExpeditionRecord({ order: 1, status: "failed" }),
      createFixtureExpeditionRecord({ order: 2, status: "failed" }),
    ]);

    expect(point?.expeditionOrder).toBe(1);
  });

  it("전멸이 없으면 가장 높은 등급에 도달한 원정을 고른다", () => {
    const point = findTurningPoint([
      createFixtureExpeditionRecord({ order: 1, rankBefore: "C", rankAfter: "B" }),
      createFixtureExpeditionRecord({ order: 2, rankBefore: "B", rankAfter: "S" }),
      createFixtureExpeditionRecord({ order: 3 }),
    ]);

    expect(point?.kind).toBe("promotion");
    expect(point?.expeditionOrder).toBe(2);
    expect(point?.summary).toContain("B에서 S로");
  });

  it("전멸도 승급도 없으면 점수 변화폭이 가장 큰 원정을 고른다", () => {
    const point = findTurningPoint([
      createFixtureExpeditionRecord({ order: 1, scoreBefore: 100, scoreAfter: 120 }),
      createFixtureExpeditionRecord({ order: 2, scoreBefore: 120, scoreAfter: 40 }),
    ]);

    expect(point?.kind).toBe("scoreSwing");
    expect(point?.expeditionOrder).toBe(2);
    expect(point?.summary).toContain("80");
  });

  it("점수 변화폭이 같으면 이른 원정을 고른다", () => {
    const point = findTurningPoint([
      createFixtureExpeditionRecord({ order: 1, scoreBefore: 0, scoreAfter: 30 }),
      createFixtureExpeditionRecord({ order: 2, scoreBefore: 30, scoreAfter: 60 }),
    ]);

    expect(point?.expeditionOrder).toBe(1);
  });

  it("승급이 여럿이고 등급이 같으면 이른 원정을 고른다", () => {
    const point = findTurningPoint([
      createFixtureExpeditionRecord({ order: 1, rankBefore: "C", rankAfter: "B" }),
      createFixtureExpeditionRecord({ order: 2, rankBefore: "C", rankAfter: "B" }),
    ]);

    expect(point?.expeditionOrder).toBe(1);
  });
});

describe("recordExpedition", () => {
  function statWith(lieDelivered: number, lieExposed: number) {
    const cards = emptyStatistics().cards;
    cards.lie.delivered = lieDelivered;
    cards.lie.exposed = lieExposed;
    return cards;
  }

  it("누적 카드 통계가 각 원정의 합과 같다", () => {
    const first = recordExpedition(
      emptyStatistics(),
      createFixtureExpeditionRecord({ order: 1, cards: statWith(2, 1) }),
    );
    const second = recordExpedition(
      first,
      createFixtureExpeditionRecord({ order: 2, cards: statWith(3, 2) }),
    );

    expect(second.cards.lie.delivered).toBe(5);
    expect(second.cards.lie.exposed).toBe(3);
  });

  it("생환과 전멸의 합이 원정 수와 같다", () => {
    const statistics = [
      createFixtureExpeditionRecord({ order: 1 }),
      createFixtureExpeditionRecord({ order: 2, status: "failed" }),
      createFixtureExpeditionRecord({ order: 3 }),
    ].reduce(recordExpedition, emptyStatistics());

    expect(statistics.clearedExpeditions).toBe(2);
    expect(statistics.wipedExpeditions).toBe(1);
    expect(statistics.clearedExpeditions + statistics.wipedExpeditions)
      .toBe(statistics.expeditions.length);
  });

  it("입력 통계를 고치지 않는다", () => {
    const before = emptyStatistics();
    recordExpedition(before, createFixtureExpeditionRecord({ cards: statWith(9, 9) }));

    expect(before.cards.lie.delivered).toBe(0);
    expect(before.expeditions).toEqual([]);
  });

  // 3번째에 전멸하면 1·2번째에서 고른 승급 전환점을 물러야 한다.
  it("나중 원정이 전환점을 뒤집는다", () => {
    const promoted = recordExpedition(
      emptyStatistics(),
      createFixtureExpeditionRecord({ order: 1, rankBefore: "C", rankAfter: "B" }),
    );
    expect(promoted.turningPoint?.kind).toBe("promotion");

    const wiped = recordExpedition(
      promoted,
      createFixtureExpeditionRecord({ order: 2, status: "failed" }),
    );
    expect(wiped.turningPoint?.kind).toBe("firstWipe");
  });
});
