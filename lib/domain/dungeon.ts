import type { BossId, DungeonId, MonsterId, NodeId, RuleId } from "./ids";

/**
 * 던전의 위험도다. 지도 크기·보상·정보 기회를 모두 이 축이 정한다.
 * docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
 */
export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export const RISK_LEVELS = [1, 2, 3, 4, 5] as const satisfies readonly RiskLevel[];

/** 실패로 위험도가 올라도 여기서 멈춘다. */
export const RISK_LEVEL_MAX: RiskLevel = 5;

/** 테마는 닫힌 목록이다. 생태 규칙과 몬스터가 테마 단위로 묶인다. */
export type ThemeId = "spider" | "desert" | "graveyard";

export const THEME_IDS = ["spider", "desert", "graveyard"] as const satisfies readonly ThemeId[];

/** 테마마다 규칙 6개를 두고 던전마다 3개를 활성으로 뽑는다. */
export const ECOLOGY_RULES_PER_THEME = 6;
export const ACTIVE_ECOLOGY_RULES = 3;

/**
 * 그 던전에서 참인 명제 한 줄이다.
 *
 * 카드의 진위는 카드 자체가 아니라 활성 규칙에 대해 판정된다.
 * docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md
 */
export interface EcologyRule {
  id: RuleId;
  theme: ThemeId;
  /** 플레이어가 읽을 한 문장. */
  text: string;
  /** 대상에 따라 결론이 갈리는 규칙. 테마마다 1개 이상 있어야 한다. */
  conditional: boolean;
}

export interface MonsterDef {
  id: MonsterId;
  theme: ThemeId;
  name: string;
  /** 생태 규칙이 가리킬 수 있는 특성. 규칙이 검증 가능해지는 근거다. */
  traits: readonly string[];
}

/**
 * 위험도 구간 하나를 담당하는 보스다. 재도전해도 같은 구간이면 유지된다.
 *
 * 한 보스가 테마 전체(던전 5개)를 대표하면 위험도가 올라도 상대가 그대로라
 * 체감이 약하다. `minRiskLevel`로 구간을 나눈다.
 * docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md
 */
export interface BossDef {
  id: BossId;
  theme: ThemeId;
  name: string;
  description: string;
  /** 이 값 이상인 초기 위험도의 던전이 이 보스를 만난다. 1·2·3·4 중 하나. */
  minRiskLevel: RiskLevel;
  /** 한 턴에 주는 피해. 양의 정수다. */
  baseDamage: number;
  /** 파티가 깎아야 하는 양. baseDamage와 함께 전투 길이를 정한다. */
  maxHp: number;
}

/** 한 테마의 콘텐츠 묶음. 수량 계약은 F2의 검증기가 지킨다. */
export interface ThemeContent {
  id: ThemeId;
  name: string;
  rules: readonly EcologyRule[];
  monsters: readonly MonsterDef[];
  /** minRiskLevel 1·2·3·4 오름차순 4개. */
  bosses: readonly BossDef[];
}

export type DungeonStatus = "unexplored" | "failed" | "cleared";

/**
 * 캠페인이 들고 있는 던전 하나다.
 *
 * `initialRiskLevel`과 `riskLevel`을 따로 둔다. 지점 수는 초기 위험도로
 * 고정되고 보상·정보 기회는 현재 위험도를 따른다. 한 필드로 두면 실패가
 * 던전을 길게 만드는 잘못된 규칙이 된다.
 * docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
 */
export interface CampaignDungeon {
  id: DungeonId;
  name: string;
  theme: ThemeId;
  /** 지점 수를 정한다. 캠페인 동안 바뀌지 않는다. */
  initialRiskLevel: RiskLevel;
  /** 보상·정보 기회·규칙 공개 수를 정한다. 실패마다 1 오른다. */
  riskLevel: RiskLevel;
  /** 그 던전에서 참인 규칙 3개. 재도전해도 유지된다. */
  activeRuleIds: readonly RuleId[];
  bossId: BossId;
  status: DungeonStatus;
  /** 실패 횟수. 위험도 상승 이력을 설명할 때 쓴다. */
  attempts: number;
}

export type NodeKind = "entry" | "normal" | "boss";

export interface DungeonNode {
  id: NodeId;
  kind: NodeKind;
  /** 한 지점의 선택지는 최대 2개다. */
  nextNodeIds: readonly NodeId[];
}

export interface GeneratedMap {
  entryNodeId: NodeId;
  bossNodeId: NodeId;
  nodes: readonly DungeonNode[];
}
