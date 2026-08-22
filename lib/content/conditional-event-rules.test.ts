import { describe, expect, it } from "vitest";
import { DESERT_EVENTS } from "./events/desert-events";
import { GRAVEYARD_EVENTS } from "./events/graveyard-events";
import { SPIDER_EVENTS } from "./events/spider-events";
import { THEMES } from "./themes";
import { conditionalRuleIdsForEvent } from "./conditional-event-rules";

const ALL_EVENTS = [...SPIDER_EVENTS, ...DESERT_EVENTS, ...GRAVEYARD_EVENTS];

describe("조건부 사건의 독립 성립 선언", () => {
  it("조건부 규칙 참조는 사건 ID별 독립 선언과 정확히 일치한다", () => {
    for (const event of ALL_EVENTS) {
      const theme = event.theme === undefined
        ? undefined
        : THEMES.find((candidate) => candidate.id === event.theme);
      const conditionalRuleIds = new Set(
        theme?.rules.filter((rule) => rule.conditional).map((rule) => rule.id) ?? [],
      );
      const referenced = event.advice.flatMap((option) =>
        option.source?.kind === "ecology" && conditionalRuleIds.has(option.source.ruleId)
          ? [option.source.ruleId]
          : [],
      );
      const declared = conditionalRuleIdsForEvent(event.id);

      expect([...declared].sort(), `독립 선언: ${event.id}`).toEqual([...new Set(referenced)].sort());
      expect(
        [...("satisfiedConditionalRuleIds" in event ? event.satisfiedConditionalRuleIds ?? [] : [])].sort(),
        `사건 필드: ${event.id}`,
      ).toEqual([...declared].sort());
    }
  });
});
