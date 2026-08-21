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

  it("merchant 사건이 Spec의 M01부터 M30 ID 순서를 따른다", () => {
    const merchants = SHARED_EVENTS.filter((event) => event.kind === "merchant");
    expect(merchants.map((event) => event.id)).toEqual([
      "shared-merchant-scale",
      "shared-merchant-barter",
      "shared-merchant-counting-hands",
      "shared-merchant-bundle-discount",
      "shared-merchant-last-one",
      "shared-merchant-potion",
      "shared-merchant-cracked-bottle-cap",
      "shared-merchant-new-blade-scratch",
      "shared-merchant-same-scent-potions",
      "shared-merchant-too-clean-map",
      "shared-merchant-credit",
      "shared-merchant-blank-receipt",
      "shared-merchant-collateral-necklace",
      "shared-merchant-two-dates",
      "shared-merchant-free-repair",
      "shared-merchant-scout",
      "shared-merchant-old-rumor",
      "shared-merchant-two-roads",
      "shared-merchant-too-specific-time",
      "shared-merchant-free-first-sentence",
      "shared-merchant-closing-box",
      "shared-merchant-changing-name",
      "shared-merchant-moving-spot",
      "shared-merchant-avoids-customers",
      "shared-merchant-friendly-prepayment",
      "shared-merchant-leaking-oil-bottle",
      "shared-merchant-cracked-arrowheads",
      "shared-merchant-hot-amulet",
      "shared-merchant-rattling-smoke-bomb",
      "shared-merchant-strong-torch-powder",
    ]);
    expect(merchants.slice(2, 5).map((event) => event.title)).toEqual([
      "동전 세는 손",
      "묶음 할인",
      "마지막 하나",
    ]);
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
        expect(option.bossDamageModifier).toBeUndefined();
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
