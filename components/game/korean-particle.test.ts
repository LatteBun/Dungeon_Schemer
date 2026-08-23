import { describe, expect, it } from "vitest";
import { hasFinalConsonant, withObjectParticle, withSubjectParticle } from "./korean-particle";

describe("조사", () => {
  it("받침을 판별한다", () => {
    expect(hasFinalConsonant("새끼거미")).toBe(false);
    /* 끝 글자만 본다. "로자린드"는 '린'이 아니라 받침 없는 '드'로 끝난다. */
    expect(hasFinalConsonant("로자린드")).toBe(false);
    expect(hasFinalConsonant("오린")).toBe(true);
    expect(hasFinalConsonant("하르멜")).toBe(true);
  });

  it("한글이 아닌 끝글자는 받침 없는 쪽으로 둔다", () => {
    expect(hasFinalConsonant("")).toBe(false);
    expect(hasFinalConsonant("boss")).toBe(false);
    expect(hasFinalConsonant("거미 3")).toBe(false);
  });

  it("이 / 가 를 고른다", () => {
    expect(withSubjectParticle("새끼거미")).toBe("새끼거미가");
    expect(withSubjectParticle("로자린드")).toBe("로자린드가");
    expect(withSubjectParticle("오린")).toBe("오린이");
  });

  it("을 / 를 을 고른다", () => {
    expect(withObjectParticle("새끼거미")).toBe("새끼거미를");
    expect(withObjectParticle("오린")).toBe("오린을");
  });
});
