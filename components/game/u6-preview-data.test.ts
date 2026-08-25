import { describe, expect, it } from "vitest";
import { ENDING_ORDER } from "@/lib/domain";
import { U6_PREVIEW_ENTRIES, U6_PREVIEW_IDS } from "./u6-preview-data";

const FUTURE_REWARD_PROPERTY = "next" + "Reward";

describe("U6 프리뷰 데이터", () => {
  it("정산 3종과 엔딩 5종을 모두 담는다", () => {
    expect(U6_PREVIEW_IDS).toHaveLength(8);
    expect(U6_PREVIEW_ENTRIES.filter((entry) => entry.settlement)).toHaveLength(3);
    expect(U6_PREVIEW_ENTRIES.filter((entry) => entry.ending)).toHaveLength(5);
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

    expect(wipe?.survivors).toBe(0);
    expect(wipe?.goldDelta).toBe(0);
    expect(wipe?.relicGold).toBeGreaterThan(0);
    expect(wipe?.reputationDelta).toBeLessThan(0);
    expect(wipe?.riskAfter).toBe((wipe?.riskBefore ?? 0) + 1);
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

    expect(capped?.riskBefore).toBe(5);
    expect(capped?.riskAfter).toBe(5);
    expect(capped?.riskCapped).toBe(false);
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

describe("프리뷰의 피해 줄", () => {
  /*
   * 한 번 만들어 모든 변형에 돌려 쓰고 있었다.
   *
   * 그러면 전멸 정산에도 "피해 없이 지나갔다" 가 실린다 - 셋이 다 죽었는데.
   * 프리뷰가 거짓을 말하면 프리뷰를 보고 고친 화면도 거짓을 담는다.
   */
  it("전멸 정산이 피해 없다고 말하지 않는다", () => {
    const wiped = U6_PREVIEW_ENTRIES.find((entry) => entry.settlement?.survivors === 0);
    if (wiped?.settlement === undefined) throw new Error("전멸 정산 프리뷰가 없다");

    const damage = wiped.settlement.causeChain.find((step) => step.label === "피해")?.detail ?? "";

    expect(damage).not.toBe("피해 없이 지나갔다");
    expect(damage).toContain("→ 0");
  });

  it("생존 정산과 전멸 정산의 피해 줄이 다르다", () => {
    const lines = U6_PREVIEW_ENTRIES
      .filter((entry) => entry.settlement !== undefined)
      .map((entry) => entry.settlement!.causeChain.find((step) => step.label === "피해")?.detail);

    expect(new Set(lines).size).toBeGreaterThan(1);
  });
});
