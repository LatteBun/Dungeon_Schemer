import type { ChoiceId, ClueId, EventId, ItemId, RuleId } from "./ids";
import type { AdviceOutcome, EcologyRelation } from "./info";
import type { ThemeId } from "./dungeon";

/** 사건 분류 넷. 모든 경로에 각각 한 번 이상 나온다. */
export type EventKind = "monster" | "rest" | "merchant" | "special";

export const EVENT_KINDS = [
  "monster",
  "rest",
  "merchant",
  "special",
] as const satisfies readonly EventKind[];

export type EventEffectTag =
  | "support"
  | "sabotage"
  | "rest"
  | "trade"
  | "item"
  | "information"
  | "observe";

export const EVENT_EFFECT_TAGS = [
  "support",
  "sabotage",
  "rest",
  "trade",
  "item",
  "information",
  "observe",
] as const satisfies readonly EventEffectTag[];

export type ItemKind = "remedy" | "poison" | "food" | "scroll" | "bait";

export const ITEM_KINDS = [
  "remedy",
  "poison",
  "food",
  "scroll",
  "bait",
] as const satisfies readonly ItemKind[];

export interface ItemDef {
  id: ItemId;
  kind: ItemKind;
  name: string;
  description: string;
  price: number;
}

/**
 * 조언 하나. 상황 안에서 고블린이 건네는 말이다.
 *
 * outcome은 플레이어의 의도이고 relation은 생태 규칙과의 관계다. 둘을 따로
 * 두는 이유가 있다. 유형 이름만으로는 `왜 이것이 도움인가`를 데이터가 설명하지
 * 못해, 검증기가 규칙마다 도움·방해가 갖춰졌는지 셀 수 없다. 중립은 참조 규칙이
 * 없어 규칙별이 아니라 테마 전체로 센다.
 * docs/systems/INFORMATION_AND_DECEPTION.md
 */
export interface AdviceOption {
  id: ChoiceId;
  /** "횃불을 하나 집어 거미들 사이의 바닥에 던지세요" */
  label: string;
  /** "거미는 불을 싫어한다고 들었어!" — 고블린이 대는 근거 */
  line: string;
  outcome: AdviceOutcome;
  /** relation이 unrelated면 없다. */
  ruleId?: RuleId;
  relation: EcologyRelation;
  effectTags: readonly EventEffectTag[];
  /** 지연형만 갖는다. 수용한 파티원의 보스 피해를 바꾼다. */
  bossDamageModifier?: number;
  /** 수용됐을 때 보여줄 결과 문구. */
  resultText: string;
}

/** 단서를 보유했을 때 조언 한 슬롯을 강화판으로 바꾼다. */
export interface AdviceUpgrade {
  clueId: ClueId;
  /** 교체할 슬롯. 0·1·2 */
  slotIndex: number;
  replacement: AdviceOption;
}

/**
 * 한 지점에서 벌어지는 일 전체다.
 *
 * 옛 DungeonEvent와 InfoCard를 합친 것이다. 카드가 사건과 따로 있으면 카드가
 * 지금 눈앞의 상황과 무관한 문장이 되어, 플레이어가 대조할 재료가 문장 하나뿐이
 * 된다.
 * docs/superpowers/specs/2026-08-20-lattebun-advice-event-merge-design.md
 */
export interface SituationEvent {
  id: EventId;
  kind: EventKind;
  /** 생태 규칙을 참조하면 테마 전용이고, 공용이면 없다. */
  theme?: ThemeId;
  title: string;
  /** 관찰 가능한 사실을 담는다. 단서가 여기 실린다. */
  description: string;
  /** 도움·방해·중립을 한 개씩, 정확히 3개. */
  advice: readonly AdviceOption[];
  /** 아무도 수용하지 않았을 때. 파티가 자기 방식대로 처리한 결과다. */
  defaultResultText: string;
  /** 이 사건을 방문하면 얻는 단서. */
  revealsClue?: ClueId;
  /** 강한 연계. 이 단서가 없으면 배치되지 않는다. */
  requiresClue?: ClueId;
  /** 약한 연계. */
  upgrades?: readonly AdviceUpgrade[];
}
