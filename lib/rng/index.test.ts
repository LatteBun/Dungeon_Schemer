import { describe, expect, it } from "vitest";
import { createRng, createSeed } from "@/lib/rng";

describe("createRng 기본", () => {
  it("같은 시드는 같은 수열을 만든다", () => {
    const a = createRng("seed-0001");
    const b = createRng("seed-0001");
    expect([a.float(), a.float(), a.float()]).toEqual([
      b.float(),
      b.float(),
      b.float(),
    ]);
  });

  it("다른 시드는 다른 수열을 만든다", () => {
    const a = createRng("seed-0001");
    const b = createRng("other-seed");
    expect([a.float(), a.float(), a.float()]).not.toEqual([
      b.float(),
      b.float(),
      b.float(),
    ]);
  });

  it("비슷한 시드도 다른 수열을 만든다", () => {
    const a = createRng("seed-1");
    const b = createRng("seed-2");
    expect([a.float(), a.float(), a.float()]).not.toEqual([
      b.float(),
      b.float(),
      b.float(),
    ]);
  });

  it("float은 0 이상 1 미만이다", () => {
    const rng = createRng("range-check");
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.float();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("seed는 생성에 쓴 문자열을 그대로 담는다", () => {
    expect(createRng("seed-0001").seed).toBe("seed-0001");
  });
});

describe("createSeed", () => {
  it("호출마다 다른 값을 만든다", () => {
    const seeds = new Set([createSeed(), createSeed(), createSeed()]);
    expect(seeds.size).toBe(3);
  });
});
