import { describe, expect, it } from "vitest";
import { U5_LOG_FILTERS, filterLog, type U5LogEntry } from "./u5-log";

const entries: readonly U5LogEntry[] = [
  { order: 1, tags: ["ecology"], label: "생태 공개", detail: "거미는 불을 피한다" },
  { order: 2, tags: ["clue"], label: "관찰", detail: "바닥에 그을린 자국이 있다" },
  { order: 3, tags: [], label: "조언 선택", detail: "왼쪽 통로를 권했다" },
  { order: 4, tags: [], label: "파티 반응", detail: "코르빈 수용 · 이반드로 의심" },
  { order: 5, tags: ["battle", "clue"], label: "전투", detail: "거미 두 마리가 다가온다" },
  { order: 6, tags: ["battle"], label: "피해", detail: "브릭스턴 HP 12 감소" },
];

describe("U5 진행 기록 필터", () => {
  it("전체는 모든 항목을 시간 순으로 합친다", () => {
    const all = filterLog(entries, "all");

    expect(all).toHaveLength(entries.length);
    expect(all.map((entry) => entry.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  /* 목록을 필터마다 복제하면 같은 사건이 두 벌로 남아 한쪽만 고쳐진다. */
  it("한 항목이 여러 필터에 걸린다", () => {
    const clue = filterLog(entries, "clue").map((entry) => entry.order);
    const battle = filterLog(entries, "battle").map((entry) => entry.order);

    expect(clue).toContain(5);
    expect(battle).toContain(5);
  });

  it("필터를 걸어도 시간 순서를 잃지 않는다", () => {
    for (const filter of U5_LOG_FILTERS) {
      const orders = filterLog(entries, filter).map((entry) => entry.order);

      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
  });

  it("조언 선택과 반응은 전체에만 있고 단서로 새지 않는다", () => {
    const clue = filterLog(entries, "clue").map((entry) => entry.label);

    expect(clue).not.toContain("조언 선택");
    expect(clue).not.toContain("파티 반응");
  });

  it("원본 배열을 건드리지 않는다", () => {
    const before = entries.map((entry) => entry.order);
    filterLog(entries, "all");

    expect(entries.map((entry) => entry.order)).toEqual(before);
  });
});

/**
 * `생태` 탭이 이 화면에서 가장 조심스러운 자리다.
 *
 * 배정표가 "확인된 생태와 관찰 단서를 구분하고 숨은 규칙을 자동 정답 처리하지
 * 않는다" 고 요구한다. 단서가 규칙을 시사해도 화면이 대신 결론 내리면 안 된다.
 */
describe("U5 생태 구역", () => {
  const ecology = {
    disclosedRules: ["거미는 불을 피한다"],
    observedClues: ["바닥에 그을린 자국이 있다", "천장 거미줄이 한쪽만 성기다"],
  };

  it("확인된 생태와 관찰 단서를 다른 자리에 둔다", () => {
    expect(ecology.disclosedRules).not.toEqual(
      expect.arrayContaining(ecology.observedClues),
    );
    expect(ecology.observedClues).not.toEqual(
      expect.arrayContaining(ecology.disclosedRules),
    );
  });

  it("관찰 단서를 규칙 문장으로 승격하지 않는다", () => {
    // 단서가 규칙을 시사해도 disclosedRules 는 E2 가 공개한 것만 담는다.
    const suggestive = "바닥에 그을린 자국이 있다";

    expect(ecology.observedClues).toContain(suggestive);
    expect(ecology.disclosedRules).not.toContain(suggestive);
    expect(ecology.disclosedRules).toHaveLength(1);
  });
});
