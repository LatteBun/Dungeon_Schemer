import { describe, expect, it } from "vitest";
import { DENOUNCE_THRESHOLD, ENDING_ORDER } from "@/lib/domain";
import { U6_PREVIEW_ENTRIES, U6_PREVIEW_IDS, U6_PREVIEW_SOURCE } from "./u6-preview-data";

const FUTURE_REWARD_PROPERTY = "next" + "Reward";

describe("U6 프리뷰 데이터", () => {
  it("실제 정산 근거 원정은 능력 보유자만 유효한 잔여 횟수 맵에 담는다", () => {
    const clerics = U6_PREVIEW_SOURCE.party.filter((member) => member.classId === "cleric");

    expect(clerics).toHaveLength(1);
    expect(U6_PREVIEW_SOURCE.battleAbilityUsesRemainingByCharacterId).toEqual({
      [clerics[0]!.id]: 2,
    });
  });

  it("모든 상태가 도메인의 누적 고발 기준과 유효한 현재 인원을 가진다", () => {
    for (const entry of U6_PREVIEW_ENTRIES) {
      expect(entry.status.zeroTrust.threshold).toBe(DENOUNCE_THRESHOLD);
      expect(Number.isInteger(entry.status.zeroTrust.livingCount)).toBe(true);
      expect(entry.status.zeroTrust.livingCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("정산 3종과 엔딩 5종을 모두 담는다", () => {
    expect(U6_PREVIEW_IDS).toHaveLength(8);
    expect(U6_PREVIEW_ENTRIES.filter((entry) => entry.settlement)).toHaveLength(3);
    expect(U6_PREVIEW_ENTRIES.filter((entry) => entry.ending)).toHaveLength(5);
  });

  it("정산 멤버에는 원정 중 능력 잔여 횟수를 보존하지 않는다", () => {
    for (const entry of U6_PREVIEW_ENTRIES) {
      if (entry.settlement === undefined) continue;
      for (const member of entry.settlement.members) {
        expect(member).not.toHaveProperty("battleAbilityStatus");
      }
    }
  });

  it("엔딩 5종을 하나도 빠뜨리지 않는다", () => {
    const kinds = U6_PREVIEW_ENTRIES.flatMap((entry) => (entry.ending ? [entry.ending.kind] : []));

    expect([...kinds].sort()).toEqual([...ENDING_ORDER].sort());
  });

  it("항목마다 정산이나 엔딩 하나만 가진다", () => {
    for (const entry of U6_PREVIEW_ENTRIES) {
      expect(Boolean(entry.settlement) !== Boolean(entry.ending)).toBe(true);
    }
  });

  /* 전멸 정산은 규칙 문서가 말하는 세 가지를 함께 보여줘야 한다. */
  it("전멸 정산이 계약 보상 없음·유품·위험도 상승을 함께 담는다", () => {
    const wipe = U6_PREVIEW_ENTRIES.find((entry) => entry.id === "settlement-wipe")?.settlement;

    expect(wipe?.outcome.kind).toBe("wiped");
    expect(wipe?.goldDelta).toBe(0);
    expect(wipe?.relicGold).toBeGreaterThan(0);
    expect(wipe?.reputationDelta).toBeLessThan(0);
    expect(wipe?.dungeonOutcome.kind).toBe("riskIncreased");
    expect(wipe).not.toHaveProperty(FUTURE_REWARD_PROPERTY);
  });

  it("클리어 정산도 미래 보상 계약을 갖지 않는다", () => {
    const partial = U6_PREVIEW_ENTRIES.find((entry) => entry.id === "settlement-partial")?.settlement;
    const promotion = U6_PREVIEW_ENTRIES.find((entry) => entry.id === "settlement-promotion")?.settlement;

    expect(partial).not.toHaveProperty(FUTURE_REWARD_PROPERTY);
    expect(promotion).not.toHaveProperty(FUTURE_REWARD_PROPERTY);
  });

  it("★5 전멸이 아니면 위험도 상한 표시를 하지 않는다", () => {
    const capped = U6_PREVIEW_ENTRIES.find((entry) => entry.id === "settlement-promotion")?.settlement;

    expect(capped?.outcome.kind).toBe("cleared");
    expect(capped?.dungeonOutcome).toEqual({ kind: "cleared" });
  });

  it("부분 생존 정산은 정복·사망·생존자 신뢰 0을 함께 담는다", () => {
    const partial = U6_PREVIEW_ENTRIES.find((entry) => entry.id === "settlement-partial")?.settlement;
    if (partial === undefined) throw new Error("부분 생존 프리뷰가 없다");

    expect(partial.outcome.kind).toBe("cleared");
    expect(partial.dungeonOutcome).toEqual({ kind: "cleared" });
    expect(partial.members.some((member) => member.diedThisExpedition)).toBe(true);
    expect(partial.members.some((member) => member.trust.countsTowardCampaign)).toBe(true);
    expect(partial.trustPressure?.afterCount).toBeGreaterThan(0);
  });

  it("전멸 정산은 사망자 셋과 위험도 상승을 담는다", () => {
    const wiped = U6_PREVIEW_ENTRIES.find((entry) => entry.id === "settlement-wipe")?.settlement;
    if (wiped === undefined) throw new Error("전멸 프리뷰가 없다");

    expect(wiped.outcome.kind).toBe("wiped");
    expect(wiped.members.every((member) => member.diedThisExpedition)).toBe(true);
    expect(wiped.dungeonOutcome.kind).toBe("riskIncreased");
    expect(wiped.members.some((member) => member.trust.countsTowardCampaign)).toBe(false);
  });

  it("엔딩마다 이유 세 줄과 보고서·결말 항목 넷을 갖춘다", () => {
    for (const entry of U6_PREVIEW_ENTRIES) {
      if (!entry.ending) continue;
      expect(entry.ending.reasons).toHaveLength(3);
      expect(entry.ending.report).toHaveLength(4);
      expect(entry.ending.consequences).toHaveLength(4);
      expect(entry.ending.chronicleSummary.length).toBeGreaterThan(20);
    }
  });

  it("같은 모듈을 두 번 읽어도 같은 값이다", async () => {
    const again = await import("./u6-preview-data");

    expect(again.U6_PREVIEW_ENTRIES).toEqual(U6_PREVIEW_ENTRIES);
  });
});
