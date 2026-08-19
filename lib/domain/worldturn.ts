import type { CharacterId } from "./ids";

/** 원정에 나가지 않은 캐릭터가 한 턴 동안 하는 일. */
export type WorldTurnActivity = "forcedRest" | "rest" | "background";

export const WORLD_TURN_ACTIVITIES = [
  "forcedRest",
  "rest",
  "background",
] as const satisfies readonly WorldTurnActivity[];

/** HP가 최대의 이 비율 미만이면 강제 휴식이다. */
export const FORCED_REST_HP_RATIO = 0.5;
/** 처리 후 HP가 최대의 이 비율 미만이면 중상이다. */
export const GRAVELY_WOUNDED_HP_RATIO = 0.2;
/** 휴식 회복량은 최대 HP 비례다. 현재 HP 비례는 크게 다칠수록 덜 회복한다. */
export const REST_RECOVERY_RATIO = 0.15;
export const REST_RECOVERY_MIN = 2;
/** 백그라운드 원정에서는 사망하지 않는다. */
export const BACKGROUND_HP_FLOOR = 1;

export interface WorldTurnAssignment {
  characterId: CharacterId;
  activity: WorldTurnActivity;
}

/** 한 캐릭터의 월드턴 처리 결과. 화면이 사유를 지어내지 않도록 규칙이 남긴다. */
export interface WorldTurnOutcome {
  characterId: CharacterId;
  activity: WorldTurnActivity;
  hpDelta: number;
  goldDelta: number;
  /** 이 턴에 중상이 되었는지. 이미 중상이었다가 풀린 경우는 false다. */
  becameGravelyWounded: boolean;
  reason: string;
}

export interface WorldTurnResult {
  worldTurn: number;
  outcomes: readonly WorldTurnOutcome[];
}
