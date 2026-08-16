import type { ClassId, MemberId } from "./ids";

/**
 * 성격은 닫힌 목록이다. 신뢰 판정이 성격마다 다르게 분기하므로
 * 성격 추가는 콘텐츠 추가가 아니라 규칙 변경이다.
 * docs/systems/PARTY_AND_TRUST.md
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

export const PARTY_SIZE_MIN = 3;
export const PARTY_SIZE_MAX = 5;
export const CAMPAIGN_PARTY_SIZE = 3;

/** 신뢰도 0은 정체가 발각된 상태이며 처형으로 이어진다. */
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
}

export interface PartyMember {
  id: MemberId;
  name: string;
  classId: ClassId;
  personality: Personality;
  /** TRUST_MIN 이상 TRUST_MAX 이하. 범위 보장은 신뢰 판정의 책임이다. */
  trust: number;
  alive: boolean;
}

/** 신뢰 변화 한 건. reason은 화면이 지어내지 않도록 규칙이 문장으로 남긴다. */
export interface TrustChange {
  memberId: MemberId;
  delta: number;
  /** "정의로운 성격: 거짓 정보가 발각됨"처럼 사람이 읽는 문장이다. */
  reason: string;
}
