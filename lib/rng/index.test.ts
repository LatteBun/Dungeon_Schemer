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

describe("int", () => {
  it("최솟값과 최댓값을 모두 만들 수 있다", () => {
    const rng = createRng("int-bounds");
    const seen = new Set<number>();
    for (let i = 0; i < 200; i += 1) {
      seen.add(rng.int(1, 3));
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("범위를 벗어나지 않는다", () => {
    const rng = createRng("int-range");
    for (let i = 0; i < 500; i += 1) {
      const value = rng.int(-2, 5);
      expect(value).toBeGreaterThanOrEqual(-2);
      expect(value).toBeLessThanOrEqual(5);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("min과 max가 같으면 그 값을 반환한다", () => {
    expect(createRng("int-same").int(7, 7)).toBe(7);
  });

  it("min이 max보다 크면 예외를 던진다", () => {
    expect(() => createRng("int-bad").int(5, 1)).toThrow();
  });

  it("정수가 아닌 범위는 예외를 던진다", () => {
    expect(() => createRng("int-float").int(0, 1.5)).toThrow();
  });
});

describe("pick", () => {
  it("배열의 원소 중 하나를 반환한다", () => {
    const items = ["가", "나", "다"] as const;
    const rng = createRng("pick-member");
    for (let i = 0; i < 50; i += 1) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it("같은 시드로 같은 선택을 한다", () => {
    const items = ["가", "나", "다", "라"] as const;
    const a = createRng("pick-same");
    const b = createRng("pick-same");
    expect([a.pick(items), a.pick(items)]).toEqual([
      b.pick(items),
      b.pick(items),
    ]);
  });

  it("빈 배열은 예외를 던진다", () => {
    expect(() => createRng("pick-empty").pick([])).toThrow();
  });
});

describe("shuffle", () => {
  it("원본 배열을 변경하지 않는다", () => {
    const items = [1, 2, 3, 4, 5];
    createRng("shuffle-pure").shuffle(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it("같은 원소를 모두 유지한다", () => {
    const items = [1, 2, 3, 4, 5];
    const result = createRng("shuffle-keep").shuffle(items);
    expect([...result].sort((x, y) => x - y)).toEqual(items);
  });

  it("같은 시드로 같은 순서를 만든다", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(createRng("shuffle-same").shuffle(items)).toEqual(
      createRng("shuffle-same").shuffle(items),
    );
  });

  it("다른 시드로 다른 순서를 만든다", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(createRng("shuffle-a").shuffle(items)).not.toEqual(
      createRng("shuffle-b").shuffle(items),
    );
  });
});
