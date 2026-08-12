import type { EventKind, Personality, RunPhase, TruthType } from "@/lib/domain";

export const PHASE_LABELS: Record<RunPhase, string> = { partyIntro: "파티 소개", pathChoice: "경로 선택", event: "이벤트", bossFight: "보스전", settlement: "정산", ended: "종료" };
export const PERSONALITY_LABELS: Record<Personality, string> = { suspicious: "의심 많음", righteous: "정의로움", greedy: "탐욕스러움", prudent: "신중함", impulsive: "충동적" };
export const EVENT_KIND_LABELS: Record<EventKind, string> = { monster: "몬스터", rest: "휴식", merchant: "상인", special: "특수 사건" };
/** 색 외에도 서로 다른 기호로 이벤트 분류를 구분한다. */
export const EVENT_KIND_MARKS: Record<EventKind, string> = { monster: "◆", rest: "○", merchant: "◇", special: "★" };
export const TRUTH_TYPE_LABELS: Record<TruthType, string> = { truth: "진실", lie: "거짓", neutral: "중립" };
export const TRUST_UNIT = "신뢰";
