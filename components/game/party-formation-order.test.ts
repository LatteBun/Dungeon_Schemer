import { describe, expect, it } from "vitest";
import { CLASSES } from "@/lib/content/classes";
import { inFormationOrder, inFormationOrderByClassId } from "./party-formation-order";

const order = (classIds: readonly string[]): readonly string[] =>
  inFormationOrder(classIds, (id) => id);

describe("파티가 서는 차례", () => {
  /*
   * 사용자가 말한 그 차례다. 전투 무대는 파티가 왼쪽 적이 오른쪽이라 배열의
   * 마지막이 적에게 가장 가까운 자리이고, 거기 전사가 서야 한다.
   */
  it("성직자 · 도적 · 전사 순으로 선다", () => {
    expect(order(["warrior", "cleric", "rogue"])).toEqual(["cleric", "rogue", "warrior"]);
  });

  it("넣은 차례가 달라도 같은 답을 낸다", () => {
    const answer = ["cleric", "rogue", "warrior"];
    expect(order(["rogue", "warrior", "cleric"])).toEqual(answer);
    expect(order(["cleric", "warrior", "rogue"])).toEqual(answer);
    expect(order(["warrior", "rogue", "cleric"])).toEqual(answer);
  });

  /*
   * 새 기준을 지어내지 않았다는 확인이다. `hitWeight` 가 커질수록 적에게 가까운
   * 자리에 서야 한다 — 그 값이 곧 「적이 누구를 노리는가」이기 때문이다.
   */
  it("hitWeight 가 큰 사람이 뒤쪽 자리(적에게 가까운 쪽)에 선다", () => {
    const weight = new Map(CLASSES.map((one) => [String(one.id), one.hitWeight]));
    const sorted = order(CLASSES.map((one) => String(one.id)));

    for (let i = 1; i < sorted.length; i += 1) {
      expect(weight.get(sorted[i])!).toBeGreaterThanOrEqual(weight.get(sorted[i - 1])!);
    }
    expect(sorted.at(-1)).toBe("warrior");
  });

  /*
   * hitWeight 1 이 셋(궁수·성직자·마법사)이라 그것만으로는 차례가 안 정해진다.
   * 못 버티는 사람이 더 뒤에 선다.
   */
  it("hitWeight 가 같으면 잘 못 버티는 사람이 더 뒤에 선다", () => {
    expect(order(["archer", "cleric", "mage"])).toEqual(["mage", "cleric", "archer"]);
  });

  it("모르는 직업이 있어도 빠뜨리지 않는다", () => {
    const sorted = order(["warrior", "없는직업", "cleric"]);
    expect(sorted).toHaveLength(3);
    expect(sorted.at(-1)).toBe("warrior");
    expect(sorted).toContain("없는직업");
  });

  it("넣은 배열을 건드리지 않는다", () => {
    const input = ["warrior", "cleric"];
    inFormationOrder(input, (id) => id);
    expect(input).toEqual(["warrior", "cleric"]);
  });

  it("classId 를 들고 있는 객체도 같은 차례로 세운다", () => {
    const members = [
      { id: "1", classId: "warrior" },
      { id: "2", classId: "cleric" },
      { id: "3", classId: "rogue" },
    ];
    expect(inFormationOrderByClassId(members).map((one) => one.classId))
      .toEqual(["cleric", "rogue", "warrior"]);
  });
});
