import type { CharacterId, ClassId } from "./ids";

/**
 * 성격은 닫힌 목록이다. 신뢰 판정이 성격마다 다르게 분기하므로
 * 성격 추가는 콘텐츠 추가가 아니라 규칙 변경이다.
 * docs/systems/CHARACTERS_AND_TRUST.md
 */
export type Personality =
  | "suspicious"
  | "righteous"
  | "greedy"
  | "prudent"
  | "impulsive";

export const PERSONALITIES = [
  "suspicious",
  "righteous",
  "greedy",
  "prudent",
  "impulsive",
] as const satisfies readonly Personality[];

/** 신뢰 0은 플레이어 원정 후보에서 빠지는 상태다. 사망이 아니다. */
export const TRUST_MIN = 0;
export const TRUST_MAX = 100;

/**
 * 직업은 열린 목록이다. 콘텐츠 데이터로 관리하며
 * 새 직업을 추가할 때 규칙을 고치지 않는다.
 */
export interface ClassDef {
  id: ClassId;
  name: string;
  description: string;
  /** 직업별 최대 HP. 회복량이 이 값에 비례한다. */
  maxHp: number;
  /** 보스전에서 한 턴에 보스에게 주는 피해. */
  attack: number;
  /** 보스가 대상을 고를 때의 상대 가중치. 클수록 자주 맞는다. */
  hitWeight: number;
}

/**
 * 캠페인 내내 이어지는 한 사람의 상태다.
 *
 * 원정이 끝나도 초기화되지 않는다. 같은 인물이 다시 편성되면 지난 원정의
 * HP와 신뢰를 그대로 들고 온다.
 * docs/systems/CHARACTERS_AND_TRUST.md
 */
export interface Character {
  id: CharacterId;
  name: string;
  classId: ClassId;
  personality: Personality;
  /** 직업별 최대 HP. 회복과 중상 판정의 기준이다. */
  maxHp: number;
  /** 1 이상 maxHp 이하. 백그라운드 원정에서도 0이 되지 않는다. */
  hp: number;
  /** TRUST_MIN 이상 TRUST_MAX 이하. 범위 보장은 신뢰 판정의 책임이다. */
  trust: number;
  /** 시드로 20~45. 전멸 유품으로만 회수된다. */
  gold: number;
  alive: boolean;
  /** 처리 후 HP가 최대의 20% 미만이면 참이 되고, 다음 1턴 출전할 수 없다. */
  gravelyWounded: boolean;
}

/** 신뢰 변화 한 건. reason은 화면이 지어내지 않도록 규칙이 문장으로 남긴다. */
export interface TrustChange {
  characterId: CharacterId;
  delta: number;
  /** "정의로운 성격: 거짓 정보가 발각됨"처럼 사람이 읽는 문장이다. */
  reason: string;
}

/**
 * 플레이어 원정에 나갈 수 있는 조건이다.
 *
 * 세 조건을 한곳에 둔다. 화면과 편성 규칙이 각자 판단하면 한쪽만 고쳐졌을 때
 * 게시판에는 보이는데 편성은 안 되는 상태가 된다.
 * docs/systems/CHARACTER_POOL_AND_WORLDTURN.md
 */
export function canDeploy(character: Character): boolean {
  return character.alive && character.trust > TRUST_MIN && !character.gravelyWounded;
}

/** 응급 편성 후보다. 중상은 허용하지만 사망과 신뢰 0은 영구 제외한다. */
export function canDeployEmergency(character: Character): boolean {
  return character.alive && character.trust > TRUST_MIN;
}
