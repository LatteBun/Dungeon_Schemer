import type {
  CampaignEndingId,
  EventKind,
  Personality,
  TruthType,
} from "@/lib/domain";
import type { SettlementStepKind } from "@/lib/rules/settlement";

export const PERSONALITY_LABELS: Record<Personality, string> = { suspicious: "의심 많음", righteous: "정의로움", greedy: "탐욕스러움", prudent: "신중함", impulsive: "충동적" };
export const EVENT_KIND_LABELS: Record<EventKind, string> = { monster: "몬스터", rest: "휴식", special: "특수 사건" };
/** 색 외에도 서로 다른 기호로 이벤트 분류를 구분한다. */
export const EVENT_KIND_MARKS: Record<EventKind, string> = { monster: "◆", rest: "○", special: "?" };
export const TRUTH_TYPE_LABELS: Record<TruthType, string> = { truth: "진실", lie: "거짓", neutral: "중립" };
export const TRUST_UNIT = "신뢰";

/** 엔딩 화면에 쓰는 이름. 규칙은 id와 reason만 주고 이름은 화면의 몫이다. */
export const ENDING_LABELS: Record<CampaignEndingId, string> = {
  distrust: "불신의 대가",
  expeditionComplete: "원정 종료",
  supportUnavailable: "길잡이 자격 박탈",
  partyExhausted: "용사들의 시대가 끝나다",
};

/** 정산 원인 사슬의 단계 이름. 순서는 SETTLEMENT_STEP_ORDER가 정한다. */
export const SETTLEMENT_STEP_LABELS: Record<SettlementStepKind, string> = {
  survival: "생존·신뢰",
  reward: "계약 보상",
  dungeon: "던전",
  promotion: "승급",
  party: "파티·회복",
  ending: "다음 상태",
};
