# F3 랜덤 시드와 재현성 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 시드가 같은 결과를 만드는 난수 생성기를 `lib/rng/`에 만들고 `Math.random` 직접 호출을 eslint 오류로 차단한다.

**Architecture:** mulberry32 생성기와 문자열 해시를 직접 구현한다. 의존성을 추가하지 않는다. `createRng(seed)`가 클로저로 상태를 감춘 `Rng`를 반환하고, `derive(스트림 이름)`이 부모의 **시드 문자열**에서 독립 스트림을 파생시켜 한 시스템의 난수 호출 횟수가 다른 시스템의 결과를 바꾸지 않게 한다.

**Tech Stack:** TypeScript 5.9.3, Vitest 4.1.10, Node 24.19.0, pnpm 11.21.0

## Global Constraints

- 커밋 메시지는 제목과 본문을 포함해 항상 한글로 작성한다. (`AGENTS.md`)
- 작업 브랜치는 `feature/random-seed`이며 `main`에 직접 push하지 않는다. (`docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md`)
- **의존성을 추가하지 않는다.** `package.json`과 `pnpm-lock.yaml`을 변경하지 않는다.
- `Math.random`을 어디에서도 쓰지 않는다. `lib/rng/` 자신도 예외가 아니다.
- 테스트 파일 이름은 `<대상>.test.ts`이며 대상 소스와 같은 디렉터리에 둔다.
- 테스트에서 다른 모듈은 `@/`로 가져온다.
- `describe`, `it`, `expect`를 `vitest`에서 명시적으로 가져온다.
- `describe`와 `it`의 설명은 한국어로 쓴다.
- 테스트는 고정 시드를 써서 결정적이어야 한다. 확률적으로 통과하는 검사를 쓰지 않는다.
- `lib/domain/`의 타입과 상수를 변경하지 않는다.
- `app/page.tsx`와 `tsconfig.json`을 변경하지 않는다.

### 환경 확인 결과

계획 작성 시점에 확인한 사실이다. 다시 조사할 필요 없다.

- 이 브랜치는 `feature/test-tooling` 위에, 그 위는 `feature/domain-types`에 쌓여 있다(3단 스택).
- `pnpm test`가 이미 동작한다. `vitest@4.1.10`이 설치돼 있고 `vitest.config.mts`에 `@` 별칭이 설정돼 있다.
- `tsconfig.json`의 `lib`에 `"dom"`이 있어 전역 `crypto.randomUUID()`의 타입이 잡힌다. **타입 선언을 추가하지 않는다.**
- `tsconfig.json`에 `noUncheckedIndexedAccess`가 없다. 따라서 `items[i]`의 타입은 `T`이며 `as T` 단정이나 `undefined` 검사가 필요하지 않다.
- `eslint.config.mjs`는 18줄이며 `defineConfig([...nextVitals, ...nextTs, globalIgnores([...])])` 구조다. 아직 `rules` 블록이 없다.
- `lib/rng/` 디렉터리는 아직 없다. Task 1에서 처음 생긴다.

### 검증 명령

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

---

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `lib/rng/index.ts` | 해시, mulberry32, `Rng` API, `createSeed` | 신규 (Task 1~3에 걸쳐 성장) |
| `lib/rng/index.test.ts` | 재현성과 파생 성질 검증 | 신규 (Task 1~3에 걸쳐 성장) |
| `eslint.config.mjs` | `Math.random` 차단 규칙 | 수정 (Task 4) |
| `docs/technical/DEVELOPMENT_ENVIRONMENT.md` | 난수와 재현성 규약 | 수정 (Task 5) |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | `F3` 완료 기준, 담당, 상태 | 수정 (Task 6) |

전체가 60줄 미만이므로 파일을 더 쪼개지 않는다. `lib/domain`과 같은 방식으로 `@/lib/rng`에서 가져온다.

---

## Task 1: 시드 해시와 기본 생성기

**Files:**
- Create: `lib/rng/index.ts`
- Create: `lib/rng/index.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `Rng` 인터페이스(`seed`, `float`), `createRng(seed: string): Rng`, `createSeed(): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/rng/index.test.ts`를 만든다.

```ts
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pnpm test`
Expected: FAIL. `Cannot find module '@/lib/rng'` 오류가 난다.

- [ ] **Step 3: `lib/rng/index.ts`를 만든다**

```ts
export interface Rng {
  /** 이 생성기를 만든 시드 문자열. 파생의 기준이 된다. */
  readonly seed: string;
  /** 0 이상 1 미만 */
  float(): number;
}

/**
 * 문자열 시드를 32비트 정수로 바꾼다.
 * FNV-1a로 누적한 뒤 murmur3 최종 혼합을 적용한다.
 */
function hashSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // 이 혼합 단계가 없으면 "seed-1"과 "seed-2"처럼 비슷한 문자열이
  // 비슷한 시드가 되어 초기 수열이 닮는다.
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * mulberry32 생성기. 32비트 상태를 쓰며 게임용으로 널리 쓰인다.
 * 암호용이 아니다.
 */
function mulberry32(state: number): () => number {
  let a = state >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  const nextFloat = mulberry32(hashSeed(seed));
  return { seed, float: nextFloat };
}

/**
 * 새 판에 쓸 무작위 시드.
 * Math.random을 쓰지 않는다. 재현성 규약이 예외를 두지 않기 때문이다.
 */
export function createSeed(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `pnpm test`
Expected: PASS. 테스트 파일 2개(`lib/domain/constants.test.ts`와 `lib/rng/index.test.ts`), 테스트 11개가 통과한다.

`비슷한 시드도 다른 수열을 만든다`가 실패하면 `hashSeed`의 murmur3 혼합 단계가 빠진 것이다. 코드를 다시 확인한다.

`createSeed`에서 `crypto is not defined`가 나오면 Node 버전이 19 미만이다. `node --version`으로 확인한다. 이 저장소는 24.19.0을 쓴다.

- [ ] **Step 5: lint와 타입 검사를 확인한다**

```bash
pnpm lint
pnpm typecheck
```

Expected: 둘 다 통과.

- [ ] **Step 6: 커밋**

```bash
git add lib/rng/index.ts lib/rng/index.test.ts
git commit -m "기능: 시드 기반 난수 생성기 추가

같은 시드가 같은 수열을 만드는 mulberry32 생성기를 직접 구현한다.
의존성을 늘리지 않고 30줄 미만으로 읽고 테스트할 수 있다.

문자열 시드를 정수로 바꿀 때 murmur3 최종 혼합을 적용한다. 이
단계가 없으면 seed-1과 seed-2처럼 비슷한 문자열이 비슷한 시드가
되어 초기 수열이 닮는다.

새 판의 시드는 crypto.randomUUID로 만든다. Math.random을 쓰지
않으므로 재현성 규약에 예외를 두지 않아도 된다."
```

---

## Task 2: 정수, 선택, 섞기

**Files:**
- Modify: `lib/rng/index.ts`
- Modify: `lib/rng/index.test.ts`

**Interfaces:**
- Consumes: Task 1의 `Rng`, `createRng`
- Produces: `Rng`에 `int(min: number, max: number): number`, `pick<T>(items: readonly T[]): T`, `shuffle<T>(items: readonly T[]): T[]` 추가. `int`는 양끝을 포함하고 범위가 잘못되면 예외를 던진다. `pick`은 빈 배열에 예외를 던진다. `shuffle`은 새 배열을 반환하고 원본을 바꾸지 않는다.

- [ ] **Step 1: 실패하는 테스트를 덧붙인다**

`lib/rng/index.test.ts` 맨 아래에 추가한다. import 줄은 그대로 둔다.

```ts
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pnpm test`
Expected: FAIL. `rng.int is not a function` 계열 오류와 타입 오류가 난다.

- [ ] **Step 3: `Rng` 인터페이스를 넓힌다**

`lib/rng/index.ts`의 `Rng` 인터페이스를 다음으로 바꾼다.

```ts
export interface Rng {
  /** 이 생성기를 만든 시드 문자열. 파생의 기준이 된다. */
  readonly seed: string;
  /** 0 이상 1 미만 */
  float(): number;
  /** min 이상 max 이하 정수. 양끝을 포함한다. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** 새 배열을 반환한다. 원본을 바꾸지 않는다. */
  shuffle<T>(items: readonly T[]): T[];
}
```

- [ ] **Step 4: `createRng`를 구현한다**

`lib/rng/index.ts`의 `createRng` 함수를 다음으로 바꾼다.

```ts
export function createRng(seed: string): Rng {
  const nextFloat = mulberry32(hashSeed(seed));

  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error(`int의 범위는 정수여야 한다: ${min}, ${max}`);
    }
    if (min > max) {
      throw new Error(`int의 최솟값이 최댓값보다 크다: ${min} > ${max}`);
    }
    return min + Math.floor(nextFloat() * (max - min + 1));
  };

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new Error("pick에 빈 배열을 넘길 수 없다.");
    }
    return items[int(0, items.length - 1)];
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const result = [...items];
    // Fisher-Yates. 뒤에서 앞으로 훑으며 자기 이하 위치와 교환한다.
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      const swap = result[i];
      result[i] = result[j];
      result[j] = swap;
    }
    return result;
  };

  return { seed, float: nextFloat, int, pick, shuffle };
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `pnpm test`
Expected: PASS. 테스트 23개가 통과한다.

`최솟값과 최댓값을 모두 만들 수 있다`가 실패하면 `int`의 계산식을 확인한다. `max - min + 1`의 `+ 1`이 빠지면 최댓값이 나오지 않는다.

- [ ] **Step 6: lint와 타입 검사를 확인한다**

```bash
pnpm lint
pnpm typecheck
```

Expected: 둘 다 통과.

- [ ] **Step 7: 커밋**

```bash
git add lib/rng/index.ts lib/rng/index.test.ts
git commit -m "기능: 난수 생성기에 정수, 선택, 섞기 추가

int는 양끝을 포함하고 범위가 잘못되면 예외를 던진다. 조용히
넘기면 pick과 shuffle이 배열 범위를 벗어난 값을 만든다.

shuffle은 새 배열을 반환한다. 런 상태를 다루는 코드가 실수로
상태를 제자리에서 바꾸는 것을 막는다."
```

---

## Task 3: 파생 스트림

**Files:**
- Modify: `lib/rng/index.ts`
- Modify: `lib/rng/index.test.ts`

**Interfaces:**
- Consumes: Task 1~2의 `Rng`, `createRng`
- Produces: `RngStream` 타입(`"party" | "dungeon" | "card" | "trust"`)과 `Rng`의 `derive(stream: RngStream): Rng`. 파생은 부모의 시드 문자열에서 하므로 부모의 호출 횟수와 무관하다. 파생된 생성기의 `seed`는 `` `${부모시드}/${스트림}` `` 형태다.

- [ ] **Step 1: 실패하는 테스트를 덧붙인다**

`lib/rng/index.test.ts` 맨 아래에 추가한다.

```ts
describe("derive", () => {
  it("스트림 이름이 다르면 다른 수열을 만든다", () => {
    const root = createRng("derive-names");
    const party = root.derive("party");
    const dungeon = root.derive("dungeon");
    expect([party.float(), party.float()]).not.toEqual([
      dungeon.float(),
      dungeon.float(),
    ]);
  });

  it("같은 시드와 같은 스트림은 같은 수열을 만든다", () => {
    const a = createRng("derive-same").derive("party");
    const b = createRng("derive-same").derive("party");
    expect([a.float(), a.float(), a.float()]).toEqual([
      b.float(),
      b.float(),
      b.float(),
    ]);
  });

  it("부모에서 난수를 여러 번 뽑은 뒤 파생해도 결과가 같다", () => {
    const untouched = createRng("derive-order").derive("dungeon");

    const used = createRng("derive-order");
    for (let i = 0; i < 100; i += 1) {
      used.float();
    }
    const afterUse = used.derive("dungeon");

    expect([afterUse.float(), afterUse.float()]).toEqual([
      untouched.float(),
      untouched.float(),
    ]);
  });

  it("파생한 생성기의 seed가 부모 시드와 스트림 이름을 담는다", () => {
    expect(createRng("root").derive("card").seed).toBe("root/card");
  });

  it("파생을 두 번 거쳐도 결정적이다", () => {
    const a = createRng("nested").derive("party").derive("trust");
    const b = createRng("nested").derive("party").derive("trust");
    expect([a.int(1, 100), a.int(1, 100)]).toEqual([
      b.int(1, 100),
      b.int(1, 100),
    ]);
  });
});
```

세 번째 테스트가 이 설계의 핵심이다. `derive`를 부모의 현재 상태에서 파생하도록 바꾸면 이 테스트만 실패한다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pnpm test`
Expected: FAIL. `root.derive is not a function` 계열 오류와 타입 오류가 난다.

- [ ] **Step 3: `RngStream`을 추가하고 `Rng`를 넓힌다**

`lib/rng/index.ts`의 맨 위, `Rng` 인터페이스 앞에 추가한다.

```ts
/**
 * 난수 스트림 이름. 시스템마다 독립된 스트림을 쓴다.
 * 문자열을 그대로 받으면 derive("prty") 같은 오타가 오류 없이 다른
 * 스트림을 만들어 발견하기 가장 어려운 버그가 된다. 유니온으로 두어
 * 컴파일 시점에 잡는다.
 *
 * party   R1 파티 생성 규칙
 * dungeon R4 이벤트·경로 생성
 * card    R3 정보 카드 판정의 확률
 * trust   R2 개인 신뢰 판정의 확률
 */
export type RngStream = "party" | "dungeon" | "card" | "trust";
```

`Rng` 인터페이스에 멤버를 하나 더한다. 인터페이스 전체가 다음이 된다.

```ts
export interface Rng {
  /** 이 생성기를 만든 시드 문자열. 파생의 기준이 된다. */
  readonly seed: string;
  /** 0 이상 1 미만 */
  float(): number;
  /** min 이상 max 이하 정수. 양끝을 포함한다. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** 새 배열을 반환한다. 원본을 바꾸지 않는다. */
  shuffle<T>(items: readonly T[]): T[];
  /** 이름마다 독립된 스트림. 부모의 호출 횟수와 무관하다. */
  derive(stream: RngStream): Rng;
}
```

- [ ] **Step 4: `createRng`의 반환문에 `derive`를 더한다**

`lib/rng/index.ts`의 `createRng` 마지막 반환문을 찾는다.

```ts
  return { seed, float: nextFloat, int, pick, shuffle };
```

다음으로 바꾼다.

```ts
  // 파생은 부모의 현재 상태가 아니라 부모의 시드 문자열에서 한다.
  // 부모 상태를 쓰면 호출 순서가 다시 결과에 영향을 주어
  // 파생의 의미가 사라진다.
  const derive = (stream: RngStream): Rng => createRng(`${seed}/${stream}`);

  return { seed, float: nextFloat, int, pick, shuffle, derive };
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `pnpm test`
Expected: PASS. 테스트 28개가 통과한다.

`부모에서 난수를 여러 번 뽑은 뒤 파생해도 결과가 같다`가 실패하면 `derive`가 부모 상태를 참조하고 있다는 뜻이다. `nextFloat()`이나 부모의 다른 상태를 쓰지 않고 `seed` 문자열만 쓰는지 확인한다.

- [ ] **Step 6: 오타가 컴파일 오류가 되는지 확인한다**

`RngStream` 유니온이 실제로 오타를 막는지 확인한다. 임시 파일을 만들어 타입 검사를 돌린 뒤 지운다.

```bash
cat > lib/rng/__typo-check.ts <<'EOF'
import { createRng } from "@/lib/rng";
export const typo = createRng("x").derive("prty");
EOF
pnpm typecheck
```

Expected: FAIL. `Argument of type '"prty"' is not assignable to parameter of type 'RngStream'` 오류가 난다.

확인했으면 임시 파일을 지우고 타입 검사를 다시 돌린다.

```bash
rm lib/rng/__typo-check.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: lint를 확인한다**

Run: `pnpm lint`
Expected: 통과. `lib/rng/__typo-check.ts`가 남아 있지 않은지 `ls lib/rng/`로 함께 확인한다.

- [ ] **Step 8: 커밋**

```bash
git add lib/rng/index.ts lib/rng/index.test.ts
git commit -m "기능: 이름으로 파생하는 독립 난수 스트림 추가

시스템마다 독립 스트림을 주어 한 시스템의 난수 호출 횟수가 바뀌어도
다른 시스템의 결과가 변하지 않게 한다. 단일 스트림을 공유하면 파티
생성에 난수 하나를 더 쓰는 순간 같은 시드인데 던전 배치가 완전히
달라진다.

파생은 부모의 현재 상태가 아니라 부모의 시드 문자열에서 한다.
부모 상태를 쓰면 호출 순서가 다시 결과에 영향을 주어 파생의 의미가
사라진다.

스트림 이름을 닫힌 유니온으로 둔다. 문자열을 그대로 받으면 오타가
오류 없이 다른 스트림을 만들어 발견하기 가장 어려운 버그가 된다."
```

---

## Task 4: Math.random 차단

**Files:**
- Modify: `eslint.config.mjs`
- Create: `lib/rng/__rule-check.ts` (임시, 검증 후 삭제)

**Interfaces:**
- Consumes: 없음
- Produces: `pnpm lint`이 `Math.random` 사용을 오류로 막는다. 이후 모든 작업이 난수를 `@/lib/rng`로만 얻는다.

- [ ] **Step 1: 규칙이 아직 없다는 것을 확인한다**

임시 파일을 만들어 `Math.random`이 지금은 통과하는지 확인한다.

```bash
cat > lib/rng/__rule-check.ts <<'EOF'
export const sample = Math.random();
EOF
pnpm lint
```

Expected: PASS. 규칙이 없으므로 아무 오류도 나지 않는다. 이것이 이 태스크의 빨강 신호다.

- [ ] **Step 2: eslint 규칙을 추가한다**

`eslint.config.mjs`에서 찾을 문자열:

```js
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
```

바꿀 문자열:

```js
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 재현성 규약. 시드로 같은 판을 다시 만들 수 없게 되므로
      // Math.random 은 예외 없이 금지한다. lib/rng 자신도 쓰지 않는다.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='Math'][property.name='random']",
          message:
            "Math.random 대신 @/lib/rng 의 createRng 를 쓴다. 같은 시드로 같은 판을 재현할 수 없게 된다.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
```

- [ ] **Step 3: 규칙이 실제로 막는지 확인한다**

Run: `pnpm lint`
Expected: FAIL. `lib/rng/__rule-check.ts`에서 다음 오류가 난다.

```text
error  Math.random 대신 @/lib/rng 의 createRng 를 쓴다. 같은 시드로 같은 판을 재현할 수 없게 된다.  no-restricted-syntax
```

오류가 나지 않으면 selector가 잘못된 것이다. `MemberExpression[object.name='Math'][property.name='random']`을 그대로 썼는지 확인한다.

- [ ] **Step 4: 임시 파일을 지우고 전체 검증을 돌린다**

```bash
rm lib/rng/__rule-check.ts
ls lib/rng/
pnpm lint
pnpm typecheck
pnpm test
```

Expected: `ls` 결과가 `index.test.ts`와 `index.ts` 둘뿐이다. 세 명령 모두 통과한다.

기존 코드에서 `Math.random` 오류가 나면 그 파일을 `@/lib/rng`로 바꿔야 한다. 계획 작성 시점에는 저장소에 `Math.random` 사용처가 없었다.

- [ ] **Step 5: 커밋**

```bash
git add eslint.config.mjs
git commit -m "작업: Math.random 직접 호출을 eslint 오류로 차단

문서 규약만으로는 검사할 수단이 없다. pnpm lint가 이미 병합 전
검증 기준이므로 규칙을 추가하면 사람이 깜박해도 리뷰 전에 잡힌다.

경고가 아니라 오류로 둔다. 재현성이 깨진 버그는 나중에 재현 불가
버그로 남고, 경고는 시간이 지나면 배경이 된다.

시드 기반 생성기는 Math.random을 쓰지 않고 새 판의 시드도
crypto.randomUUID로 만들기 때문에 예외가 필요하지 않다."
```

---

## Task 5: 난수 규약 문서화

**Files:**
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`

**Interfaces:**
- Consumes: Task 1~4가 만든 API와 eslint 규칙
- Produces: 없음.

- [ ] **Step 1: 난수와 재현성 절을 추가한다**

`DEVELOPMENT_ENVIRONMENT.md`에서 찾을 문자열:

```markdown
가장 가까운 예시는 `lib/domain/constants.test.ts`다.
```

바꿀 문자열 (아래 네 겹 울타리 **안쪽 내용만** 넣는다. 안쪽에 `ts` 코드 블록이 있으므로 울타리가 네 겹이다):

````markdown
가장 가까운 예시는 `lib/domain/constants.test.ts`다.

## 난수와 재현성

같은 시드로 같은 판을 다시 만들 수 있어야 한다. 버그를 재현하고 밸런스를 비교하려면 이 성질이 필요하다.

- `Math.random`을 직접 호출하지 않는다. eslint가 오류로 막으며 예외는 없다.
- 난수는 `@/lib/rng`의 `createRng(seed)`로 만든다.
- 시스템마다 `derive(스트림 이름)`으로 독립 스트림을 받는다. 한 시스템의 난수 호출 횟수가 바뀌어도 다른 시스템의 결과가 변하지 않는다.
- 새 스트림이 필요하면 `RngStream` 유니온에 이름을 추가한다. 문자열을 그대로 넘기면 오타가 오류 없이 다른 스트림을 만든다.
- 새 판의 시드는 `createSeed()`로 만든다. 이 함수도 `Math.random`을 쓰지 않는다.

난수를 쓰는 함수는 `Rng`를 인자로 받는다. 함수 안에서 `createRng`를 직접 부르지 않는다. 그래야 테스트가 고정 시드를 주입할 수 있다.

```ts
// 이렇게 쓴다
export function generateParty(rng: Rng): PartyMember[] { ... }

const party = generateParty(createRng(seed).derive("party"));
```

가장 가까운 예시는 `lib/rng/index.test.ts`다.
````

- [ ] **Step 2: 반영됐는지 확인한다**

```bash
grep -n '## 난수와 재현성\|Math.random\|createRng\|RngStream' docs/technical/DEVELOPMENT_ENVIRONMENT.md
```

기대 결과: `## 난수와 재현성` 절이 있고 `Math.random`, `createRng`, `RngStream`이 각각 나온다.

- [ ] **Step 3: 커밋**

```bash
git add docs/technical/DEVELOPMENT_ENVIRONMENT.md
git commit -m "문서: 난수와 재현성 규약 추가

Math.random 금지와 그 이유, 파생 스트림을 쓰는 이유, 새 스트림
추가 방법을 기록한다.

난수를 쓰는 함수가 Rng를 인자로 받아야 한다는 규약도 함께 적는다.
함수 안에서 createRng를 부르면 테스트가 고정 시드를 주입할 수 없다."
```

---

## Task 6: 배정표 갱신과 Pull Request

**Files:**
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` (`F3` 행)

**Interfaces:**
- Consumes: Task 1~5의 커밋
- Produces: `main`을 대상으로 하는 Pull Request

- [ ] **Step 1: `F3` 행의 완료 기준과 상태를 바꾼다**

찾을 문자열:

```markdown
| F3 | 랜덤 시드·재현성 | 같은 시드가 같은 파티·경로·이벤트를 만드는 테스트 통과. `Math.random` 직접 호출 금지 | F1 F4 | **R1 R4** | | ⬜ |
```

바꿀 문자열:

```markdown
| F3 | 랜덤 시드·재현성 | 같은 시드와 스트림 이름이 같은 수열을 만드는 테스트 통과. 파생 스트림이 호출 순서와 무관함을 검증. `Math.random` 직접 호출을 eslint로 차단 | F1 F4 | **R1 R4** | LatteBun | ✅ |
```

완료 기준을 바꾸는 근거는 spec의 「완료 기준 수정」 절에 있다. 파티와 경로를 만드는 것은 `R1`과 `R4`이므로 F3는 그 재현성을 직접 검증할 수 없다.

- [ ] **Step 2: 표의 상태와 의존성을 확인한다**

```bash
grep -o '| [✅🟡⬜] |$' docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md | sort | uniq -c
python3 - <<'PY'
import re
ID = re.compile(r"^[FRPUQ]\d$")
rows = {}
for line in open("docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md", encoding="utf-8"):
    if not line.startswith("|"):
        continue
    c = [x.strip() for x in line.strip().strip("|").split("|")]
    if len(c) != 7 or not ID.match(c[0]):
        continue
    rows[c[0]] = {
        "needs": re.findall(r"[FRPUQ]\d", c[3]),
        "unlocks": re.findall(r"[FRPUQ]\d", c[4]),
        "status": c[6],
    }
exp = {r: set() for r in rows}
for r, v in rows.items():
    for n in v["needs"]:
        if n in exp:
            exp[n].add(r)
bad = [r for r, v in rows.items() if set(v["unlocks"]) != exp[r]]
print(f"행 {len(rows)}개, 간선 {sum(len(v['needs']) for v in rows.values())}개")
print("역방향 불일치:", bad or "없음")
ready = sorted(
    r for r, v in rows.items()
    if v["status"] == "⬜" and all(rows[n]["status"] == "✅" for n in v["needs"])
)
print("지금 시작 가능:", ready)
PY
```

기대 결과: `✅` 3개, `⬜` 17개. 행 20개, 간선 45개, 역방향 불일치 없음. 시작 가능 목록은 정확히 `['F2', 'F5', 'Q3', 'R1', 'R2', 'R4']`다.

`R1`과 `R4`가 새로 풀린 것이 이 작업의 성과다.

- [ ] **Step 3: 커밋**

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "문서: 배정표의 F3 완료 기준 수정과 상태 갱신

파티와 경로를 만드는 것은 R1과 R4이므로 F3는 그 재현성을 직접
검증할 수 없다. 같은 시드와 스트림이 같은 수열을 만든다는 성질과
파생이 호출 순서와 무관하다는 성질로 기준을 바꾼다. 이 둘이
성립하면 R1과 R4의 재현성은 자동으로 따라온다.

담당자와 상태도 함께 기록한다."
```

- [ ] **Step 4: 검증 명령 넷을 한 번에 돌린다**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: 넷 다 통과. 하나라도 실패하면 원인을 고쳐 커밋한 뒤 이 단계를 다시 실행한다.

- [ ] **Step 5: 변경 파일과 브랜치를 확인한다**

```bash
git branch --show-current
git status --short
git diff --stat feature/test-tooling..HEAD
```

기대 결과: 브랜치가 `feature/random-seed`, 작업 트리가 깨끗하다. `feature/test-tooling` 대비 변경은 `lib/rng/index.ts`, `lib/rng/index.test.ts`, `eslint.config.mjs`, `docs/` 아래 문서 넷이다.

`package.json`이나 `pnpm-lock.yaml`이 나오면 의존성을 건드린 것이므로 되돌린다. `lib/domain/`이 나오면 F1의 결과물을 건드린 것이므로 되돌린다.

- [ ] **Step 6: push한다**

```bash
git push -u origin feature/random-seed
```

- [ ] **Step 7: Pull Request를 만든다**

```bash
gh pr create --base main --title "기능: F3 랜덤 시드와 재현성" --body "$(cat <<'PRBODY'
## 배경

프로토타입 배정표의 `F3`이다. 선행인 `F1`과 `F4`가 완료됐다. 이 작업이 끝나면 `R1`(파티 생성)과 `R4`(이벤트·경로 생성)가 풀린다.

> **먼저 병합할 것:** 이 브랜치는 3단 스택이다. `feature/domain-types`(PR #2) → `feature/test-tooling`(PR #3) → 이 브랜치. #2와 #3을 순서대로 병합하면 이 PR에는 F3 커밋만 남는다.

## 변경

- `lib/rng/index.ts`에 mulberry32 생성기와 문자열 해시를 직접 구현했다. **의존성을 추가하지 않았다.**
- `createRng(seed)`가 `float` `int` `pick` `shuffle` `derive`를 가진 `Rng`를 반환한다.
- `derive(스트림)`이 시스템마다 독립 스트림을 준다. 스트림 이름은 닫힌 유니온 `RngStream`이다.
- `createSeed()`가 새 판의 시드를 만든다. `crypto.randomUUID()`를 쓴다.
- `eslint.config.mjs`에 `Math.random`을 오류로 막는 규칙을 추가했다. 예외는 없다.
- `DEVELOPMENT_ENVIRONMENT.md`에 난수와 재현성 규약 절을 추가했다.
- 배정표의 `F3` 완료 기준을 수정하고 상태를 갱신했다.

## 완료 기준을 수정한 이유

기존 기준은 "같은 시드가 같은 파티·경로·이벤트를 만드는 테스트 통과"였다. 파티를 만드는 것은 `R1`, 경로와 이벤트를 만드는 것은 `R4`이며 둘 다 아직 없다. F3가 만드는 것은 그 둘이 올라탈 토대다.

기준을 "같은 시드와 스트림 이름이 같은 수열을 만드는 테스트 통과. 파생 스트림이 호출 순서와 무관함을 검증"으로 바꿨다. 이 두 성질이 성립하면 `R1`·`R4`의 재현성은 자동으로 따라온다. 파티와 경로의 실제 재현성은 `R1`과 `R4`의 완료 기준에 이미 들어 있다.

## 파생 스트림이 필요한 이유

단일 스트림을 공유하면 한 곳의 수정이 나머지 전부를 바꾼다. 파티 생성이 난수를 7번 뽑고 던전 생성이 그다음을 이어받는 구조라면, 나중에 파티 생성에 난수 하나를 더 쓰는 순간 같은 시드인데 던전 배치가 완전히 달라진다. `R4`의 테스트가 `R1`의 수정 때문에 깨지고, 밸런스 조정마다 다른 시스템이 흔들린다.

파생은 부모의 **현재 상태**가 아니라 부모의 **시드 문자열**에서 한다. 부모 상태를 쓰면 호출 순서가 다시 결과에 영향을 주어 파생의 의미가 사라진다. `부모에서 난수를 여러 번 뽑은 뒤 파생해도 결과가 같다` 테스트가 이 성질을 고정한다.

## 확인 방법

- `pnpm test`가 28개 테스트를 통과한다.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` 통과.
- `Math.random`을 쓴 임시 파일로 eslint 규칙이 실제로 오류를 내는지 확인했다.
- `derive("prty")` 같은 오타가 타입 오류가 되는지 임시 파일로 확인했다.
- 배정표: `✅` 3개, 20행 45간선, 역방향 불일치 없음. 이제 시작 가능한 작업은 `F2` `F5` `Q3` `R1` `R2` `R4`다.

## 리뷰 요청 사항

- mulberry32를 직접 구현한 판단. `pure-rand` 같은 라이브러리를 쓰는 편이 나은지. 암호용이 아니며 파티 구성과 던전 배치에 쓸 목적이다.
- `RngStream`의 네 이름(`party` `dungeon` `card` `trust`)이 적절한지. `trust`는 `R2`에 확률이 필요할 것이라는 추측이다.
- `int`와 `pick`이 잘못된 입력에 예외를 던지는 방식. 조용히 넘기면 배열 범위를 벗어난 값이 나온다.

## 관련 문서

- spec: `docs/superpowers/specs/2026-08-12-random-seed-lattebun-design.md`
- plan: `docs/superpowers/plans/2026-08-12-random-seed-lattebun.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
)"
```

- [ ] **Step 8: PR URL을 사용자에게 전달한다**

```bash
gh pr view --json url,number,title
```

출력된 URL을 사용자에게 알린다. 작업자가 아닌 팀원 한 명의 확인이 필요하다는 점과, PR #2와 #3을 순서대로 병합해야 이 PR이 깔끔해진다는 점을 함께 전달한다.

---

## 완료 조건

- `pnpm test`가 28개 테스트를 통과한다. 테스트 파일은 2개다.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`가 모두 통과한다.
- `Math.random`을 쓰는 코드가 `pnpm lint`에서 오류로 막힌다.
- `derive`에 유니온에 없는 문자열을 넘기면 타입 오류가 난다.
- `lib/rng/`에 `index.ts`와 `index.test.ts` 둘만 있다. 임시 검증 파일이 남아 있지 않다.
- `package.json`과 `pnpm-lock.yaml`이 변경되지 않았다.
- `lib/domain/`의 파일과 `app/page.tsx`, `tsconfig.json`이 변경되지 않았다.
- 배정표의 `F3`이 `✅`이고 완료 기준이 수정됐으며 표의 의존성 일관성이 유지된다.
- `main`을 대상으로 하는 Pull Request가 열려 있고 URL을 사용자가 받았다.

## 이 계획에서 하지 않는 것

- `R1` 파티 생성, `R4` 이벤트·경로 생성 구현
- `RunState`에 시드를 넣고 관리하는 로직 (`F2` 스토어의 몫)
- 암호학적으로 안전한 난수
- 난수 품질 통계 검정
- 시드를 URL이나 화면에 노출하는 기능
- 의존성 추가
- `lib/domain/` 변경
