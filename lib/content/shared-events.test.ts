import { describe, expect, it } from "vitest";
import { EVENT_EFFECT_TAGS } from "@/lib/domain";
import type { BaseAdviceOption } from "@/lib/domain";
import { SHARED_EVENTS } from "@/lib/content/shared-events";
import { validateSituationEvents } from "@/lib/content/situation-validation";

describe("SHARED_EVENTS", () => {
  it("휴식 사건이 30개다", () => {
    expect(SHARED_EVENTS.filter((event) => event.kind === "rest")).toHaveLength(30);
  });

  it("전부 공용이라 테마가 없다", () => {
    for (const event of SHARED_EVENTS) {
      expect(event.theme).toBeUndefined();
    }
  });

  it("묘사가 관찰할 사실을 담을 만큼 길다", () => {
    // 묘사가 짧으면 관찰할 사실을 담지 못한다. 추론의 근거가 여기에만 있다.
    for (const event of SHARED_EVENTS) {
      expect(event.description.length).toBeGreaterThanOrEqual(20);
    }
  });

  it("상인 사건이 30개다", () => {
    expect(SHARED_EVENTS.filter((event) => event.kind === "merchant")).toHaveLength(30);
  });

  it("특수 사건이 30개다", () => {
    expect(SHARED_EVENTS.filter((event) => event.kind === "special")).toHaveLength(30);
  });

  it("모두 90개다", () => {
    expect(SHARED_EVENTS).toHaveLength(90);
  });

  it("공용 사건과 조언 ID가 전체 풀에서 중복되지 않는다", () => {
    const eventIds = SHARED_EVENTS.map((event) => event.id);
    const adviceIds = SHARED_EVENTS
      .flatMap((event): readonly BaseAdviceOption[] => event.advice)
      .map((option) => option.id);

    expect(new Set(eventIds).size).toBe(eventIds.length);
    expect(new Set(adviceIds).size).toBe(adviceIds.length);
  });

  it("merchant 사건이 M01부터 M30까지 5계열 서비스 순서를 따른다", () => {
    const merchants = SHARED_EVENTS.filter((event) => event.kind === "merchant");
    expect(merchants.map((event) => event.id)).toEqual([
      "shared-merchant-emergency-medicine",
      "shared-merchant-wandering-healer",
      "shared-merchant-detox-specialist",
      "shared-merchant-bandage-vendor",
      "shared-merchant-painkiller",
      "shared-merchant-professional-clinic",
      "shared-merchant-water-vendor",
      "shared-merchant-dried-meat",
      "shared-merchant-warm-meal",
      "shared-merchant-stimulant",
      "shared-merchant-calming-drink",
      "shared-merchant-concentrated-nutrition",
      "shared-merchant-whetstone",
      "shared-merchant-armor-repair",
      "shared-merchant-smoke-tools",
      "shared-merchant-throwables",
      "shared-merchant-toxic-materials",
      "shared-merchant-equipment-rental",
      "shared-merchant-rope-installer",
      "shared-merchant-bridge-repair",
      "shared-merchant-trap-disarmer",
      "shared-merchant-lighting-installer",
      "shared-merchant-passage-maintainer",
      "shared-merchant-hazard-guide",
      "shared-merchant-secret-healer",
      "shared-merchant-hired-brawler",
      "shared-merchant-trap-operative",
      "shared-merchant-dangerous-enhancement",
      "shared-merchant-equipment-modifier",
      "shared-merchant-black-apothecary",
    ]);
    const titleGroups = [
      ["응급 약장수", "떠돌이 치료사", "해독 전문상", "붕대 장수", "진통제 상인", "전문 치료소"],
      ["물장수", "건조육 장수", "따뜻한 식사", "각성제 노점", "진정 음료", "농축 영양식"],
      ["숫돌 장수", "방어구 수선공", "연막 도구상", "투척물 상인", "독성 물질 장수", "장비 대여상"],
      ["밧줄 설치꾼", "다리 보수공", "함정 해체꾼", "조명 설치상", "길 정비꾼", "위험 구간 안내인"],
      ["비밀 치료사", "싸움꾼 고용", "함정 공작꾼", "위험한 강화 시술", "장비 개조공", "검은 약제사"],
    ];
    for (const [groupIndex, expectedTitles] of titleGroups.entries()) {
      const firstEventIndex = groupIndex * 6;
      expect(
        merchants
          .slice(firstEventIndex, firstEventIndex + 6)
          .map((event) => event.title),
      ).toEqual(expectedTitles);
    }
  });

  it("merchant H/X가 확정 가격과 즉시·다음 전투 효과를 정확히 제공한다", () => {
    const merchants = SHARED_EVENTS.filter((event) => event.kind === "merchant");
    const paidTerms = merchants.map((event) =>
      event.advice
        .filter((choice) => choice.outcome !== "neutral")
        .map((choice) => [choice.goldCost, choice.merchantEffect]),
    );

    expect(paidTerms).toEqual([
      [[5, { immediateHpDeltaPerMember: 8 }], [4, { immediateHpDeltaPerMember: -3 }]],
      [[7, { immediateHpDeltaPerMember: 8 }], [8, { immediateHpDeltaPerMember: -6 }]],
      [[6, { immediateHpDeltaPerMember: 4 }], [5, { immediateHpDeltaPerMember: -6 }]],
      [[3, { immediateHpDeltaPerMember: 4 }], [4, { immediateHpDeltaPerMember: -3 }]],
      [[4, { nextBattle: { incomingDamageMultiplier: 0.9 } }], [6, { nextBattle: { partyDamageMultiplier: 0.7 } }]],
      [[11, { immediateHpDeltaPerMember: 14 }], [9, { immediateHpDeltaPerMember: -10 }]],
      [[3, { immediateHpDeltaPerMember: 4 }], [2, { immediateHpDeltaPerMember: -3 }]],
      [[4, { immediateHpDeltaPerMember: 4 }], [5, { immediateHpDeltaPerMember: -3 }]],
      [[6, { immediateHpDeltaPerMember: 8 }], [4, { nextBattle: { partyDamageMultiplier: 0.85 } }]],
      [[5, { nextBattle: { partyDamageMultiplier: 1.3 } }], [7, { nextBattle: { incomingDamageMultiplier: 1.25 } }]],
      [[4, { nextBattle: { incomingDamageMultiplier: 0.9 } }], [5, { nextBattle: { partyDamageMultiplier: 0.85 } }]],
      [[8, { immediateHpDeltaPerMember: 8, nextBattle: { incomingDamageMultiplier: 0.9 } }], [9, { immediateHpDeltaPerMember: -3, nextBattle: { partyDamageMultiplier: 0.85 } }]],
      [[5, { nextBattle: { partyDamageMultiplier: 1.3 } }], [3, { nextBattle: { partyDamageMultiplier: 0.85 } }]],
      [[6, { nextBattle: { incomingDamageMultiplier: 0.75 } }], [7, { nextBattle: { partyDamageMultiplier: 0.85 } }]],
      [[5, { nextBattle: { incomingDamageMultiplier: 0.75 } }], [5, { nextBattle: { incomingDamageMultiplier: 1.25 } }]],
      [[6, { nextBattle: { partyDamageMultiplier: 1.3 } }], [4, { nextBattle: { partyDamageMultiplier: 0.85 } }]],
      [[8, { nextBattle: { partyDamageMultiplier: 1.5 } }], [9, { nextBattle: { partyDamageMultiplier: 0.6 } }]],
      [[7, { nextBattle: { incomingDamageMultiplier: 0.75 } }], [5, { nextBattle: { incomingDamageMultiplier: 1.1 } }]],
      [[4, { immediateHpDeltaPerMember: 4 }], [3, { immediateHpDeltaPerMember: -3 }]],
      [[6, { immediateHpDeltaPerMember: 8 }], [7, { immediateHpDeltaPerMember: -3 }]],
      [[7, { immediateHpDeltaPerMember: 8 }], [8, { immediateHpDeltaPerMember: -6 }]],
      [[3, { immediateHpDeltaPerMember: 4 }], [2, { immediateHpDeltaPerMember: -3 }]],
      [[5, { immediateHpDeltaPerMember: 4 }], [6, { immediateHpDeltaPerMember: -3 }]],
      [[6, { immediateHpDeltaPerMember: 8 }], [5, { immediateHpDeltaPerMember: -3 }]],
      [[12, { immediateHpDeltaPerMember: 14 }], [10, { immediateHpDeltaPerMember: -10 }]],
      [[10, { nextBattle: { partyDamageMultiplier: 1.5 } }], [11, { nextBattle: { partyDamageMultiplier: 0.6 } }]],
      [[9, { nextBattle: { partyDamageMultiplier: 1.3 } }], [11, { nextBattle: { incomingDamageMultiplier: 1.4 } }]],
      [[13, { nextBattle: { partyDamageMultiplier: 1.5 } }], [9, { nextBattle: { partyDamageMultiplier: 0.6 } }]],
      [[10, { nextBattle: { incomingDamageMultiplier: 0.6 } }], [11, { nextBattle: { partyDamageMultiplier: 0.7 } }]],
      [[14, { nextBattle: { partyDamageMultiplier: 1.7 } }], [14, { nextBattle: { incomingDamageMultiplier: 1.5 } }]],
    ]);
  });

  it("merchant neutral은 비구매이고 H/X 가격 분포는 의도를 드러내지 않는다", () => {
    const merchants = SHARED_EVENTS.filter((event) => event.kind === "merchant");
    const neutral = merchants.flatMap((event) =>
      event.advice.filter((choice) => choice.outcome === "neutral"),
    );
    const paid = merchants.flatMap((event) =>
      event.advice.filter((choice) => choice.outcome !== "neutral"),
    );
    expect(neutral.every((choice) =>
      choice.goldCost === 0 &&
      choice.merchantEffect === undefined &&
      choice.label.includes("거래하지 않")
    )).toBe(true);
    expect(paid.every((choice) => choice.goldCost > 0 && choice.merchantEffect !== undefined)).toBe(true);

    const prices = merchants.map((event) => ({
      help: event.advice.find((choice) => choice.outcome === "help")!.goldCost,
      harm: event.advice.find((choice) => choice.outcome === "harm")!.goldCost,
    }));
    const helpCheaper = prices.filter(({ help, harm }) => help < harm).length;
    const harmCheaper = prices.filter(({ help, harm }) => harm < help).length;
    const helpAverage = prices.reduce((sum, price) => sum + price.help, 0) / prices.length;
    const harmAverage = prices.reduce((sum, price) => sum + price.harm, 0) / prices.length;
    expect(Math.abs(helpCheaper - harmCheaper)).toBeLessThanOrEqual(4);
    expect(Math.abs(helpAverage - harmAverage)).toBeLessThanOrEqual(1);
  });

  it("merchant는 정보·지도·인벤토리·보관 서비스를 팔지 않는다", () => {
    const merchants = SHARED_EVENTS.filter((event) => event.kind === "merchant");
    const forbiddenWording = /정보|지도|보관|소지품|인벤토리|information|map|inventory|storage/i;
    for (const event of merchants) {
      expect(`${event.title} ${event.description} ${event.defaultResultText}`).not.toMatch(forbiddenWording);
      for (const choice of event.advice) {
        expect(choice.effectTags).not.toContain("information");
        expect(`${choice.label} ${choice.line} ${choice.resultText}`).not.toMatch(forbiddenWording);
      }
    }
  });

  it("M19부터 M24까지는 구매한 서비스가 그 자리에서 HP 변화를 만든다", () => {
    const merchants = SHARED_EVENTS.filter((event) => event.kind === "merchant");
    for (const event of merchants.slice(18, 24)) {
      for (const choice of event.advice.filter((option) => option.outcome !== "neutral")) {
        expect(choice.merchantEffect).toHaveProperty("immediateHpDeltaPerMember");
        expect(choice.resultText).toContain("그 자리에서");
        expect(`${choice.line} ${choice.resultText}`).not.toMatch(/다음|지점|경로|지도/);
      }
    }
  });

  it("제목·묘사·조언 문구가 전체 풀에서 중복되지 않는다", () => {
    const titles = SHARED_EVENTS.map((event) => event.title);
    const descriptions = SHARED_EVENTS.map((event) => event.description);
    const labels = SHARED_EVENTS
      .flatMap((event): readonly BaseAdviceOption[] => event.advice)
      .map((option) => option.label);

    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("모든 공용 조언과 기본 결과가 런타임 필드를 채운다", () => {
    for (const event of SHARED_EVENTS) {
      expect(event.defaultResultText.trim()).not.toBe("");
      for (const option of event.advice) {
        expect(option.line.trim()).not.toBe("");
        expect(option.resultText.trim()).not.toBe("");
        expect(option.effectTags.length).toBeGreaterThan(0);
        expect(option.effectTags.every((tag) => EVENT_EFFECT_TAGS.includes(tag))).toBe(true);
        expect(option.relation).toBe("unrelated");
        expect(option.source).toBeUndefined();
      }
    }
  });

  it("조언 근거 대사가 선택 문구를 그대로 반복하지 않는다", () => {
    for (const event of SHARED_EVENTS) {
      for (const option of event.advice) {
        expect(option.line.trim()).not.toBe(option.label.trim());
      }
    }
  });

  it("검증기를 통과한다", () => {
    expect(() => validateSituationEvents(SHARED_EVENTS)).not.toThrow();
  });
});
