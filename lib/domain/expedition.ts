import type { GeneratedMap, RiskLevel } from "./dungeon";
import type { ExpeditionParty } from "./pool";
import type { InfoRecord } from "./info";
import type { CharacterId, DungeonId, NodeId, RuleId } from "./ids";

export type ExpeditionStatus = "cleared" | "wiped";

/** 보스전 한 턴의 기록. 규칙이 턴 기록을 남기는 데까지가 이번 범위다. */
export interface BossTurnRecord {
  turn: number;
  /** 이 턴에 보스가 때린 대상. 파티 차례면 null이다. */
  targetId: CharacterId | null;
  damage: number;
  /** "마법사가 보스에게 12" 처럼 사람이 읽는 문장이다. */
  description: string;
}

export interface BossResult {
  turns: readonly BossTurnRecord[];
  survivorIds: readonly CharacterId[];
  status: ExpeditionStatus;
}

export interface ExpeditionResult {
  status: ExpeditionStatus;
  survivorIds: readonly CharacterId[];
  /** 전멸했을 때만 채운다. 사망자 전원의 소지 골드 합이다. */
  salvagedGold: number;
}

/**
 * 한 번의 원정 상태다.
 *
 * 계약 시점의 위험도를 들고 있는 것이 중요하다. 정산의 명성 손실은 상승 전
 * 값으로 계산해야 계약 화면에서 본 위험과 어긋나지 않는다.
 * docs/systems/PROGRESSION_AND_ENDINGS.md
 */
export interface ExpeditionState {
  dungeonId: DungeonId;
  /** 계약 시점의 위험도. 던전이 상승해도 이 원정은 이 값으로 정산한다. */
  riskLevel: RiskLevel;
  party: ExpeditionParty;
  /** 그 던전에서 참인 규칙 3개. */
  activeRuleIds: readonly RuleId[];
  /** 계약 화면 답사 기록으로 공개한 규칙. 현재 위험도가 수를 정한다. */
  disclosedRuleIds: readonly RuleId[];
  map: GeneratedMap;
  currentNodeId: NodeId;
  visitedNodeIds: readonly NodeId[];
  /** 전달한 카드와 개인별 반응. 보스전과 사후 검증의 입력이다. */
  infoRecords: readonly InfoRecord[];
  bossResult: BossResult | null;
  result: ExpeditionResult | null;
}
