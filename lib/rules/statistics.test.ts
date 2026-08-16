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
import { emptyStatistics, summarizeExpeditionCards } from "./statistics";

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
