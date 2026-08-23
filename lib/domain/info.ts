import type { BossRuleId, CharacterId, ChoiceId, EventId } from "./ids";
import type { TrustChange } from "./character";

/**
 * 조언의 유형. 플레이어의 의도를 가리킨다.
 *
 * 진위 축은 여기 있지 않다. 조언이 생태 규칙과 어떤 관계인지는
 * EcologyRelation이 따로 들고 있다.
 * docs/systems/INFORMATION_AND_DECEPTION.md
 */
export type AdviceOutcome = "help" | "harm" | "neutral";

export const ADVICE_OUTCOMES = [
  "help",
  "harm",
  "neutral",
] as const satisfies readonly AdviceOutcome[];

/** 조언이 참조 규칙과 맺는 관계. 중립은 unrelated다. */
export type EcologyRelation = "consistent" | "contradictory" | "unrelated";

export const ECOLOGY_RELATIONS = [
  "consistent",
  "contradictory",
  "unrelated",
] as const satisfies readonly EcologyRelation[];

/** 조언의 수신자는 살아 있는 용사 개인으로 제한한다. */
export type Target = { kind: "member"; id: CharacterId };

/** 사건 행동은 역사적 호환성을 위해 보스를 대상으로 삼을 수 있다. */
export type EventTarget = Target | { kind: "boss" };

/** 조언 하나에 대한 파티원 한 명의 반응. */
export type InfoReaction = "accepted" | "suspected" | "exposed";

export interface PresentedAdviceOption {
  id: ChoiceId;
  label: string;
  line: string;
  goldCost?: number;
}

export interface MemberReaction {
  characterId: CharacterId;
  reaction: InfoReaction;
}

export interface AdviceDecision {
  adviceId: ChoiceId;
  outcome: AdviceOutcome;
  reactions: readonly MemberReaction[];
  executed: boolean;
  delayedRecords: readonly InfoRecord[];
}

export interface AdviceResolution {
  decision: AdviceDecision;
  trustChanges: readonly TrustChange[];
}

export interface AdviceFeedback {
  selectedAdviceId: ChoiceId;
  reactions: readonly MemberReaction[];
  resultText: string;
  trustChanges: readonly TrustChange[];
}

/**
 * 보스전 뒤 검증해야 하는 지연형 조언에 대한 한 파티원의 반응 기록이다.
 *
 * accepted는 전투 modifier와 사후 검증을, suspected는 사후 검증만 남긴다.
 * neutral·exposed는 E2에서 기록하지 않는다. 즉시형 조언은 그 자리에서
 * 끝나므로 이 목록에 들어오지 않는다.
 * docs/systems/INFORMATION_AND_DECEPTION.md
 */
export interface InfoRecord {
  readonly eventId: EventId;
  readonly adviceId: ChoiceId;
  /** 그 조언이 실제로 무엇이었는지. 보스전 뒤 의심을 검증할 때 쓴다. */
  readonly outcome: AdviceOutcome;
  readonly characterId: CharacterId;
  readonly reaction: InfoReaction;
  /** 보스 특성과 전투 축을 연결하는 유일한 콘텐츠 식별자다. */
  readonly bossRuleId: BossRuleId;
  /** accepted 또는 suspected help/harm을 보스전 뒤 검증할 대상인지 나타낸다. */
  readonly pendingVerification: boolean;
}
