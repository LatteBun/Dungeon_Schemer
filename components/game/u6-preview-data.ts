import type { EndingKind, GuideRank, RiskLevel, ThemeId } from "@/lib/domain";
import type { TopStatusView } from "./TopStatusBar";
import type { U6EndingView } from "./u6-ending-model";
import { ENDING_TITLE } from "./u6-ending-model";
import { CAUSE_ORDER, createU6PromotionView, type U6SettlementView } from "./u6-settlement-model";

/**
 * `/u6-test` 프리뷰 고정 데이터.
 *
 * 정산 계산(C4), 승급 실행(C5), 엔딩 판정(C6), 통계 누적(C8) 이 아직 없다.
 * 화면을 지금 검증할 수 있도록 결정적 상수로 같은 모양을 만든다. 규칙이
 * 들어오면 이 파일 대신 실제 CampaignState 를 읽는 함수가 들어오고 화면
 * 코드는 그대로다.
 *
 * 값은 docs/systems/PROGRESSION_AND_ENDINGS.md 의 보상표를 손으로 따랐다.
 * 규칙이 검증한 값이 아니므로 여기의 숫자로 밸런스를 논하지 않는다.
 */

export type U6PreviewId =
  | "settlement-partial"
  | "settlement-wipe"
  | "settlement-promotion"
  | "ending-completed"
  | "ending-distrust"
  | "ending-denounced"
  | "ending-exhausted"
  | "ending-unemployed";

const CAUSE_LABELS = ["선택", "개인 반응", "피해", "보상·손실", "캠페인 변화"] as const;

function causeChain(details: readonly [string, string, string, string, string]) {
  return CAUSE_ORDER.map((order, index) => ({
    order,
    label: CAUSE_LABELS[index],
    detail: details[index],
  }));
}

function status(over: Partial<TopStatusView> = {}): TopStatusView {
  return {
    rank: "C",
    reputation: 74,
    gold: 186,
    canPromote: true,
    remainingDungeons: 11,
    ...over,
  };
}

/** ★3 · 2명 생존. 보상은 60% 로 깎이고 위험도는 그대로다. */
const settlementPartial: U6SettlementView = {
  dungeonName: "거미굴 3",
  themeId: "spider" satisfies ThemeId,
  survivors: 2,
  causeChain: causeChain([
    "갈림길에서 왼쪽 통로를 권했다. 거미줄 흔적을 말하지 않았다.",
    "코르빈 수용 · 이반드로 의심 · 브릭스턴 수용",
    "브릭스턴 사망. 이반드로 HP 9 남음, 신뢰 60 → 42",
    "2명 생존이라 계약 보상의 60% 를 받는다. 명성 9 · 골드 19",
    "클리어라 위험도는 ★3 그대로다",
  ]),
  riskBefore: 3 satisfies RiskLevel,
  riskAfter: 3 satisfies RiskLevel,
  riskCapped: false,
  reputationDelta: 9,
  goldDelta: 19,
  relicGold: 0,
  nextReward: { reputation: 15, gold: 32 },
  promotion: createU6PromotionView("C", 74, 186),
};

/** ★2 에서 전멸. 명성 손실은 상승 전 ★2 의 10 이고 위험도가 ★3 으로 오른다. */
const settlementWipe: U6SettlementView = {
  dungeonName: "묘지 1",
  themeId: "graveyard" satisfies ThemeId,
  survivors: 0,
  causeChain: causeChain([
    "보스방 직전에 휴식 대신 전진을 권했다.",
    "에다 적발 · 니오 의심 · 라샤 수용",
    "세 명 모두 사망",
    "계약 보상 없음. 유품으로 소지 골드 84 회수",
    "던전은 남고 위험도가 ★2 에서 ★3 으로 오른다",
  ]),
  riskBefore: 2 satisfies RiskLevel,
  riskAfter: 3 satisfies RiskLevel,
  riskCapped: false,
  reputationDelta: -10,
  goldDelta: 0,
  relicGold: 84,
  nextReward: { reputation: 15, gold: 32 },
  promotion: createU6PromotionView("C", 30, 270),
};

/** ★5 에서 전멸이라 위험도가 더 오르지 않는다. 두 승급 경로가 함께 열렸다. */
const settlementPromotion: U6SettlementView = {
  dungeonName: "사막 5",
  themeId: "desert" satisfies ThemeId,
  survivors: 3,
  causeChain: causeChain([
    "모래폭풍 징후를 그대로 알렸다. 감춘 것이 없다.",
    "세 명 모두 수용",
    "전원 생존. 신뢰가 각각 올랐다",
    "3명 생존이라 계약 보상 전액. 명성 28 · 골드 60",
    "클리어라 위험도는 ★5 그대로다",
  ]),
  riskBefore: 5 satisfies RiskLevel,
  riskAfter: 5 satisfies RiskLevel,
  riskCapped: true,
  reputationDelta: 28,
  goldDelta: 60,
  relicGold: 0,
  nextReward: { reputation: 28, gold: 60 },
  promotion: createU6PromotionView("C", 88, 214),
};

const CHRONICLE_OUTCOMES = ["3명 생존", "2명 생존", "전멸", "3명 생존", "1명 생존"] as const;
const CHRONICLE_DUNGEONS = ["거미굴", "묘지", "사막"] as const;

function chronicle(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    worldTurn: index + 1,
    dungeonName: `${CHRONICLE_DUNGEONS[index % 3]} ${(index % 5) + 1}`,
    outcome: CHRONICLE_OUTCOMES[index % 5],
  }));
}

function ending(
  kind: EndingKind,
  reason: string,
  finalRank: GuideRank,
  over: Partial<U6EndingView> = {},
): U6EndingView {
  return {
    kind,
    reason,
    finalRank,
    survivedCount: 9,
    diedCount: 6,
    zeroTrustCount: 2,
    finalReputation: 205,
    cumulativeGold: 449,
    expeditionCount: 15,
    adviceStats: [
      { label: "그대로 알린 조언", given: 21, caught: 0 },
      { label: "감춘 조언", given: 14, caught: 3 },
    ],
    turningPoint: {
      label: "묘지 1 전멸",
      detail: "위험도가 ★3 으로 오르며 이후 보상이 함께 올랐다",
    },
    chronicle: chronicle(15),
    ...over,
  };
}

export interface U6PreviewEntry {
  id: U6PreviewId;
  label: string;
  status: TopStatusView;
  settlement?: U6SettlementView;
  ending?: U6EndingView;
}

export const U6_PREVIEW_ENTRIES: readonly U6PreviewEntry[] = [
  {
    id: "settlement-partial",
    label: "정산 · 부분 생존",
    status: status(),
    settlement: settlementPartial,
  },
  {
    id: "settlement-wipe",
    label: "정산 · 전멸",
    status: status({ reputation: 30, gold: 270, canPromote: false }),
    settlement: settlementWipe,
  },
  {
    id: "settlement-promotion",
    label: "정산 · 승급 가능",
    status: status({ reputation: 88, gold: 214 }),
    settlement: settlementPromotion,
  },
  {
    id: "ending-completed",
    label: `엔딩 · ${ENDING_TITLE.completed}`,
    status: status({ rank: "A", reputation: 205, gold: 331, canPromote: false, remainingDungeons: 0 }),
    ending: ending("completed", "던전 15개를 모두 클리어했다", "A"),
  },
  {
    id: "ending-distrust",
    label: `엔딩 · ${ENDING_TITLE.distrust}`,
    status: status({ rank: "B", reputation: 96, gold: 402, canPromote: false, remainingDungeons: 7 }),
    ending: ending("distrust", "생존 파티원 전원의 신뢰가 0 이다", "B", {
      survivedCount: 5,
      diedCount: 10,
      zeroTrustCount: 5,
      finalReputation: 96,
      cumulativeGold: 402,
      expeditionCount: 8,
      chronicle: chronicle(8),
    }),
  },
  {
    id: "ending-denounced",
    label: `엔딩 · ${ENDING_TITLE.denounced}`,
    status: status({ rank: "B", reputation: 54, gold: 516, canPromote: false, remainingDungeons: 6 }),
    ending: ending("denounced", "신뢰 0 인 캐릭터가 5명이 되었다", "B", {
      survivedCount: 6,
      diedCount: 12,
      zeroTrustCount: 5,
      finalReputation: 54,
      cumulativeGold: 516,
      expeditionCount: 9,
      chronicle: chronicle(9),
    }),
  },
  {
    id: "ending-exhausted",
    label: `엔딩 · ${ENDING_TITLE.exhausted}`,
    status: status({ rank: "C", reputation: 41, gold: 188, canPromote: false, remainingDungeons: 9 }),
    ending: ending("exhausted", "서로 다른 직업 3명을 편성할 수 없다", "C", {
      survivedCount: 2,
      diedCount: 16,
      zeroTrustCount: 1,
      finalReputation: 41,
      cumulativeGold: 188,
      expeditionCount: 6,
      turningPoint: null,
      chronicle: chronicle(6),
    }),
  },
  {
    id: "ending-unemployed",
    label: `엔딩 · ${ENDING_TITLE.unemployed}`,
    status: status({ rank: "C", reputation: 38, gold: 92, canPromote: false, remainingDungeons: 12 }),
    ending: ending("unemployed", "게시판의 모든 공고가 진입 불가다", "C", {
      survivedCount: 6,
      diedCount: 3,
      zeroTrustCount: 0,
      finalReputation: 38,
      cumulativeGold: 92,
      expeditionCount: 3,
      chronicle: chronicle(3),
    }),
  },
];

export const U6_PREVIEW_IDS = U6_PREVIEW_ENTRIES.map((entry) => entry.id);
