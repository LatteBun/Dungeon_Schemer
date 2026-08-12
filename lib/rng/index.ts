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
