import type { PartyMemberCardView } from "./PartyMemberCard";
import type { U5BattleReplayFrame } from "./u5-battle-replay";
import type {
  ChoiceId,
  InfoReaction,
  PresentedAdviceOption,
  ThemeId,
} from "@/lib/domain";

/**
 * U5 던전 진행 화면의 모델 경계.
 *
 * 화면은 ExpeditionState 를 직접 읽지 않는다. 사건 물질화(E3)가 아직 없지만
 * 조언 판정(E2)은 이미 있으므로, 이 파일은 화면이 받을 모양만 정하고 값은
 * E2 의 실제 함수와 E3 가 낼 사건에서 온다.
 */

/**
 * 장면 슬롯이 고르는 지점 성격.
 *
 * EventKind 는 monster·rest·merchant·special 넷이지만, entry 와 boss 는 사건
 * 종류가 아니라 지점 성격이다. 그래서 장면 선택은 EventKind 가 아니라 이
 * 타입으로 정한다.
 */
export const U5_SCENE_KINDS = [
  "entry",
  "monster",
  "rest",
  "merchant",
  "special",
  "boss",
] as const;

export type U5SceneKind = (typeof U5_SCENE_KINDS)[number];

/**
 * 자산 폴더 이름을 도메인 ThemeId 와 같게 맞춰 두었으므로 변환 없이 잇는다.
 * 매핑 표를 다시 만들지 않는다. 표가 생기는 순간 도메인과 자산이 또 갈라진다.
 */
export function sceneSrc(theme: ThemeId, kind: U5SceneKind): string {
  return `/assets/u5/dungeon-progress-scenes/${theme}/${kind}.png`;
}

/**
 * 화면이 보여주는 조언 하나.
 *
 * ChoiceId 를 담지 않는다. 콘텐츠의 조언 식별자가 `...-help`·`...-harm`·
 * `...-neutral` 로 끝나기 때문이다. 그 값이 DOM 에 들어가면 개발자 도구로
 * 정답이 그대로 보인다. 감추기로 한 바로 그것이 새어 나간다.
 *
 * 그래서 화면의 신원은 슬롯 번호이고, 슬롯을 실제 ChoiceId 로 되돌리는 일은
 * DOM 이 보지 않는 곳에서 한다.
 */
export interface U5AdviceOptionView {
  slot: 0 | 1 | 2;
  /** 선택지 문구. */
  text: string;
  /** 고블린의 근거 대사. */
  rationale: string;
  /** 상인 사건에서만 온다. 가격은 감출 대상이 아니다. */
  goldCost?: number;
  /*
   * 지금 고를 수 없는 이유. 고를 수 있으면 없다.
   *
   * 값을 보여주면서 살 수 있는지는 안 알려 주면, 길잡이는 눌러 보고서야 안 된다는
   * 것을 안다. 규칙이 판단하고 화면은 옮겨 적는다.
   */
  unavailableReason?: string;
}

export interface U5ReactionView {
  memberName: string;
  reaction: InfoReaction;
  /** 사람이 읽는 이유. 내부 판정값을 쓰지 않는다. */
  note: string;
}

export interface U5ChangeView {
  label: string;
  detail: string;
}

export interface U5OutcomeView {
  reactions: readonly U5ReactionView[];
  /** 무슨 일이 왜 일어났는지. 아무도 수용하지 않으면 기본 결과 문구가 온다. */
  resultText: string;
  changes: readonly U5ChangeView[];
}

/**
 * 파티원 표시는 화면마다 갈리지 않도록 공용 카드 타입을 그대로 쓴다.
 *
 * 횟수는 아직 카드 문구가 아니다. replay frame이 최종 HP·신뢰와 독립적으로
 * 되감아야 하므로 U5 경계에서 숫자만 따로 운반한다.
 */
export interface U5PartyMemberView extends PartyMemberCardView {
  readonly battleAbilityUsesRemaining?: number;
}

/**
 * 우측 파티의 확정 HP·신뢰는 그대로 두고, 원정 자원만 현재 전투 frame으로
 * 되감는다. replay가 끝난 뒤 다시 보기를 눌러도 이미 확정된 결과가 흔들리지
 * 않게 하는 U5 전용 경계다.
 */
export function u5PartyViewsForBattleFrame(
  party: readonly U5PartyMemberView[],
  frame: U5BattleReplayFrame | undefined,
): readonly U5PartyMemberView[] {
  if (frame === undefined) return party;
  return party.map((member) => {
    const settledMember = { ...member };
    delete settledMember.battleAbilityUsesRemaining;
    const frameRemaining = frame.battleAbilityUsesRemainingByParticipantId[member.id];
    return frameRemaining === undefined
      ? settledMember
      : { ...settledMember, battleAbilityUsesRemaining: frameRemaining };
  });
}

export interface U5ProgressView {
  dungeonName: string;
  theme: ThemeId;
  sceneKind: U5SceneKind;
  nodeLabel: string;
  /** 관찰 가능한 사실. 추론의 근거를 실어 나른다. */
  situation: string;
  advice: readonly U5AdviceOptionView[];
  /** 선택 전이면 null. */
  outcome: U5OutcomeView | null;
  party: readonly U5PartyMemberView[];
}

/**
 * E2 가 제시한 조언을 화면 모양으로 옮긴다.
 *
 * 이 함수의 목적은 옮기는 것이 아니라 **버리는 것**이다. ChoiceId 를 떼어내
 * 화면이 정답을 들고 다니지 못하게 한다. 슬롯 순서는 E2 가 정했으므로 여기서
 * 다시 섞지 않는다.
 */
export function toAdviceViews(
  presented: readonly PresentedAdviceOption[],
  /** 슬롯별로 고를 수 없는 이유. 규칙이 판단해 넘긴다. */
  unavailableBySlot: Readonly<Record<number, string>> = {},
): readonly U5AdviceOptionView[] {
  return presented.map((option, index) => ({
    slot: index as 0 | 1 | 2,
    text: option.label,
    rationale: option.line,
    ...(option.goldCost === undefined ? {} : { goldCost: option.goldCost }),
    ...(unavailableBySlot[index] === undefined ? {} : { unavailableReason: unavailableBySlot[index] }),
  }));
}

/** 슬롯을 실제 ChoiceId 로 되돌린다. DOM 이 아니라 처리기가 쓴다. */
export function adviceIdForSlot(
  presented: readonly PresentedAdviceOption[],
  slot: number,
): ChoiceId {
  const option = presented[slot];
  if (option === undefined) {
    throw new Error(`조언 슬롯 ${slot} 이 없다`);
  }
  return option.id;
}
