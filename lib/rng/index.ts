/**
 * 난수 스트림 이름. 시스템마다 독립된 스트림을 쓴다.
 * 문자열을 그대로 받으면 derive("prty") 같은 오타가 오류 없이 다른
 * 스트림을 만들어 발견하기 가장 어려운 버그가 된다. 유니온으로 두어
 * 컴파일 시점에 잡는다.
 *
 * pool      캐릭터 풀 생성 규칙
 * board     공고 생성 규칙
 * party     임시 파티 편성 규칙
 * map       지도 생성 규칙
 * ecology   테마 생태 규칙 선택
 * card      정보 카드 판정의 확률
 * event     사건 판정의 확률
 * boss      보스전 판정의 확률
 * trust     개인 신뢰 판정의 확률
 * worldturn 월드턴 활동과 상태 변화
 */
export const RNG_STREAMS = [
  "pool",
  "party",
  "board",
  "map",
  "ecology",
  "card",
  "event",
  "boss",
  "trust",
  "worldturn",
] as const;

export type RngStream = (typeof RNG_STREAMS)[number];

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

  // 파생은 부모의 현재 상태가 아니라 부모의 시드 문자열에서 한다.
  // 부모 상태를 쓰면 호출 순서가 다시 결과에 영향을 주어
  // 파생의 의미가 사라진다.
  const derive = (stream: RngStream): Rng => createRng(`${seed}/${stream}`);

  return { seed, float: nextFloat, int, pick, shuffle, derive };
}

/**
 * 새 판에 쓸 무작위 시드.
 * Math.random을 쓰지 않는다. 재현성 규약이 예외를 두지 않기 때문이다.
 */
export function createSeed(): string {
  return crypto.randomUUID();
}
