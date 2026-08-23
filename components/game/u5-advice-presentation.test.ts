import { describe, expect, it } from "vitest";
import { presentShuffledAdvice } from "@/lib/rules/advice-evaluation";
import { allSituationEvents, eventsForTheme } from "@/lib/content/event-registry";
import { adviceIdForSlot, toAdviceViews } from "./u5-progress-model";

/**
 * 조언 불투명성.
 *
 * 감추는 것은 결론이지 근거가 아니다. 콘텐츠의 조언 식별자가 `...-help`·
 * `...-harm`·`...-neutral` 로 끝나므로, 그 값이 화면 모델에 남으면 개발자
 * 도구로 정답이 그대로 보인다. 화면이 정답을 아예 들고 다니지 못하게 한다.
 */

const event = eventsForTheme("desert")[0];

const presented = presentShuffledAdvice({
  campaignSeed: "u5-advice-opacity",
  dungeonId: "desert-1" as never,
  attempt: 1,
  depth: 2,
  event,
});

describe("U5 조언 제시", () => {
  it("조언 View 는 슬롯·문구·근거만 담는다", () => {
    for (const view of toAdviceViews(presented)) {
      const keys = Object.keys(view).filter((key) => key !== "goldCost").sort();

      expect(keys).toEqual(["rationale", "slot", "text"]);
    }
  });

  /*
   * 이 게임에서 가장 새기 쉬운 값이다. 콘텐츠 조언 540개 중 절반이 유형을
   * 이름에 담고 있다. 한 사건만 보면 안전해 보이는 것(shared-rest-wound-a/b/c)
   * 도 있으므로 전체를 확인한다.
   */
  it("콘텐츠 식별자 절반이 유형을 드러낸다", () => {
    const ids = allSituationEvents().flatMap((one) => one.advice.map((option) => option.id));
    const leaky = ids.filter((id) => /(help|harm|neutral)/.test(id));

    expect(ids.length).toBeGreaterThan(0);
    expect(leaky.length).toBeGreaterThan(0);
  });

  it("어느 사건이든 조언 식별자가 View 에 남지 않는다", () => {
    for (const one of allSituationEvents()) {
      const views = toAdviceViews(
        presentShuffledAdvice({
          campaignSeed: "u5-advice-opacity",
          dungeonId: "desert-1" as never,
          attempt: 1,
          depth: 2,
          event: one,
        }),
      );
      const serialized = JSON.stringify(views);

      for (const option of one.advice) {
        expect(serialized).not.toContain(option.id);
      }
    }
  });

  it("직렬화한 View 에 판정 어휘가 없다", () => {
    const serialized = JSON.stringify(toAdviceViews(presented));

    for (const word of ["help", "harm", "neutral", "consistent", "contradictory"]) {
      expect(serialized).not.toContain(word);
    }
  });

  it("슬롯 순서는 E2 가 정하고 화면이 다시 섞지 않는다", () => {
    const views = toAdviceViews(presented);

    expect(views.map((view) => view.text)).toEqual(presented.map((option) => option.label));
    expect(views.map((view) => view.slot)).toEqual([0, 1, 2]);
  });

  it("슬롯을 실제 조언 식별자로 되돌릴 수 있다", () => {
    for (const [index, option] of presented.entries()) {
      expect(adviceIdForSlot(presented, index)).toBe(option.id);
    }
    expect(() => adviceIdForSlot(presented, 9)).toThrow();
  });
});
