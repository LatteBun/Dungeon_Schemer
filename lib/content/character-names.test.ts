import { describe, expect, it } from "vitest";
import { CHARACTER_NAMES } from "@/lib/content/character-names";

describe("CHARACTER_NAMES", () => {
  it("이름이 30개 이상이다", () => {
    expect(CHARACTER_NAMES.length).toBeGreaterThanOrEqual(30);
  });

  it("이름이 서로 중복되지 않는다", () => {
    expect(new Set(CHARACTER_NAMES).size).toBe(CHARACTER_NAMES.length);
  });

  it("빈 이름이 없다", () => {
    for (const name of CHARACTER_NAMES) {
      expect(name.trim()).not.toBe("");
    }
  });
});
