/**
 * 시드 스트림 이름이다.
 *
 * 스트림을 나누는 이유가 있다. 한 규칙을 고쳐 난수 소비량이 달라져도 다른
 * 규칙의 재현성이 흔들리지 않게 하려는 것이다. `ecology`와 `worldturn`이
 * 이번 개편에서 새로 생겼다.
 * docs/technical/DEVELOPMENT_ENVIRONMENT.md
 */
export type SeedStream =
  | "pool"
  | "board"
  | "party"
  | "map"
  | "ecology"
  | "card"
  | "event"
  | "boss"
  | "trust"
  | "worldturn"
  | "battle";

export const SEED_STREAMS = [
  "pool",
  "board",
  "party",
  "map",
  "ecology",
  "card",
  "event",
  "boss",
  "trust",
  "worldturn",
  "battle",
] as const satisfies readonly SeedStream[];
