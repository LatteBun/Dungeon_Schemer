import { describe, expect, it } from "vitest";
import { ENDING_ORDER } from "@/lib/domain";
import { U6_PREVIEW_ENTRIES, U6_PREVIEW_IDS } from "./u6-preview-data";

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
  });

  it("★5 정산은 위험도가 오르지 않는다", () => {
    const capped = U6_PREVIEW_ENTRIES.find((entry) => entry.id === "settlement-promotion")?.settlement;

    expect(capped?.riskBefore).toBe(5);
    expect(capped?.riskAfter).toBe(5);
    expect(capped?.riskCapped).toBe(true);
  });

  it("승급 가능 정산은 두 경로가 함께 열린다", () => {
    const promotion = U6_PREVIEW_ENTRIES.find((entry) => entry.id === "settlement-promotion")
      ?.settlement?.promotion;

    expect(promotion).toMatchObject({ byReputation: true, byGold: true });
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
