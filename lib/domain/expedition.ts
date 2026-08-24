import type { GeneratedMap, RiskLevel } from "./dungeon";
import type { ExpeditionParty } from "./pool";
import type { InfoRecord } from "./info";
import type { ChoiceId, CharacterId, ClueId, DungeonId, EventId, NodeId, RuleId } from "./ids";
import type { EventKind, SituationEvent } from "./content";
import type { BattleResolution } from "./battle";
import type { AdvicePressure } from "../balance/campaign-balance";

export type ExpeditionStatus = "cleared" | "wiped";

export type BossInfoAxis = "targetWeight" | "incomingDamage" | "outgoingDamage";
export type BossInfoDirection = "beneficial" | "harmful";
export type BossInfoTiming = "battleStart" | "beforeTarget" | "beforeDamage" | "afterDamage";

export interface BossInfoApplication {
  readonly eventId: EventId;
  readonly adviceId: ChoiceId;
  readonly characterId: CharacterId;
  readonly bossRuleId: import("./ids").BossRuleId;
  readonly axis: BossInfoAxis;
  readonly direction: BossInfoDirection;
}

export type BossInfoVerificationAction =
  | "adviceHelped"
  | "adviceHarmed"
  | "suspicionWasCostly"
  | "suspicionWasCorrect";

export interface BossInfoVerification {
  readonly eventId: EventId;
  readonly adviceId: ChoiceId;
  readonly characterId: CharacterId;
  readonly bossRuleId: import("./ids").BossRuleId;
  readonly action: BossInfoVerificationAction;
  readonly applied: boolean;
}

export interface BossInfoPresentationCue {
  readonly actionIndex: number;
  readonly bossRuleId: import("./ids").BossRuleId;
  readonly characterId: CharacterId;
  readonly timing: BossInfoTiming;
  readonly axis: BossInfoAxis;
  readonly direction: BossInfoDirection;
  readonly presentationKey: string;
}

export interface BossResult {
  battle: BattleResolution;
  survivorIds: readonly CharacterId[];
  status: ExpeditionStatus;
  applications: readonly BossInfoApplication[];
  verifications: readonly BossInfoVerification[];
  cues: readonly BossInfoPresentationCue[];
}

export interface ExpeditionResult {
  status: ExpeditionStatus;
  survivorIds: readonly CharacterId[];
}

export interface PendingMerchantEffect {
  adviceId: ChoiceId;
  nextBattle: import("./content").NextBattleMerchantEffect;
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
  /** 현재 원정에서 실행한 조언이 누적한 전투 압력. */
  readonly advicePressure: AdvicePressure;
  /** 보스전 뒤 검증할 지연형 조언의 개인별 반응이다. accepted와 suspected를 보존한다. */
  infoRecords: readonly InfoRecord[];
  pendingMerchantEffect: PendingMerchantEffect | null;
  bossResult: BossResult | null;
  result: ExpeditionResult | null;
}

export type HiddenNodeRole = "normal" | "bossInfo" | "strongPredecessor" | "strongFollower";

export interface PreparedNodePlan {
  readonly nodeId: NodeId;
  readonly category: EventKind;
  readonly hiddenRole: HiddenNodeRole;
  readonly plannedClueId?: ClueId;
}

export interface BossInfoCut {
  readonly nodeIds: readonly NodeId[];
}

export interface StrongLinkPlan {
  readonly clueId: ClueId;
  readonly predecessorNodeId: NodeId;
  readonly followerNodeId: NodeId;
}

export interface PreparedExpeditionEvents {
  readonly nodePlans: ReadonlyMap<NodeId, PreparedNodePlan>;
  readonly bossInfoCuts: readonly BossInfoCut[];
  readonly strongLinks: readonly StrongLinkPlan[];
  readonly usedEventIds: ReadonlySet<EventId>;
  readonly heldClueIds: ReadonlySet<ClueId>;
  readonly materializedEvents: ReadonlyMap<NodeId, SituationEvent>;
  readonly pendingNextBattleEffect?: PendingMerchantEffect;
}

export interface MaterializedNodeEvent {
  readonly event: SituationEvent;
  readonly state: PreparedExpeditionEvents;
  readonly revealedClueId?: ClueId;
}
