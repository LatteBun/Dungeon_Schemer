import type { EndingKind, RiskLevel, ThemeId } from "@/lib/domain";
import type { TopStatusView } from "./TopStatusBar";
import type { U6EndingView } from "./u6-ending-model";
import { ENDING_TITLE } from "./u6-ending-model";
import { CAUSE_ORDER, type U6SettlementView } from "./u6-settlement-model";

/**
 * `/u6-test` 프리뷰 고정 데이터.
 *
 * 실제 캠페인 전이와 화면 연결 전에도 화면을 검증할 수 있도록 결정적 상수로
 * 같은 모양을 만든다. 실제 정산은 C4의 SettlementResult를 U6 어댑터에 넣고,
 * 이 파일은 프리뷰 전용으로 남긴다.
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
  nextReward: null,
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
  riskCapped: false,
  reputationDelta: 28,
  goldDelta: 60,
  relicGold: 0,
  nextReward: null,
};

function ending(
  kind: EndingKind,
  over: Partial<U6EndingView> & Pick<U6EndingView, "subtitle" | "reasons" | "report" | "consequences" | "chronicleSummary" | "finalRank">,
): U6EndingView {
  return {
    kind,
    survivedCount: 9,
    diedCount: 6,
    zeroTrustCount: 0,
    zeroTrustPartySize: 1,
    finalReputation: 148,
    cumulativeGold: 382,
    adviceTotal: 106,
    wipedExpeditions: 3,
    turningPoint: { label: "잊힌 묘지 회랑", detail: "아델 전사 합류" },
    ...over,
  };
}

const ENDINGS: Readonly<Record<EndingKind, U6EndingView>> = {
  completed: ending("completed", {
    subtitle: "당신은 길을 안내했지만, 결국 선택한 것은 당신 자신의 길이었다.",
    finalRank: "S",
    reasons: [
      "총 15곳의 던전을 정복하며, 캠페인의 모든 임무를 완수했습니다.",
      "전우들과 함께 위기를 극복하고, 길드의 목표를 달성했습니다.",
      "마지막 선택에서 당신의 신념을 지키며, 올바른 길을 선택했습니다.",
    ],
    report: ["던전 15곳 정복", "캠페인 임무 완료", "마지막 선택을 마주함", "길드의 명예를 드높임"],
    consequences: [
      { label: "완벽한 정복", detail: "모든 던전 정복" },
      { label: "명예로운 귀환", detail: "캠페인 임무 완료" },
      { label: "전우와 함께", detail: "파티원 생존 1명 유지" },
      { label: "길드의 영광", detail: "최종 등급 S 달성" },
    ],
    chronicleSummary:
      "위기의 순간마다 당신의 조언은 길잡이가 되었고, 전우들은 그 신뢰에 응답했습니다. 당신의 전략과 선택은 길드의 승리를 이끌었습니다.",
  }),
  distrust: ending("distrust", {
    subtitle: "모든 선택에는 길이 있었고, 모든 길에는 대가가 있었다.",
    finalRank: "B",
    survivedCount: 3,
    diedCount: 8,
    zeroTrustCount: 3,
    zeroTrustPartySize: 3,
    finalReputation: 72,
    cumulativeGold: 144,
    adviceTotal: 91,
    wipedExpeditions: 2,
    turningPoint: { label: "붉은 종루", detail: "신뢰 붕괴 사건" },
    reasons: [
      "생존한 파티원 전원이 신뢰 0에 도달했습니다.",
      "의심이 협력을 삼켜, 모든 유대가 무너졌습니다.",
      "불신은 원정을 붕괴시키고, 모두를 파멸로 이끌었습니다.",
    ],
    report: ["생존 파티원 전원 신뢰 0", "원정 내 갈등 극대화", "마지막 선택 이후 관계 파탄", "길드의 평판 하락"],
    consequences: [
      { label: "끝없는 의심", detail: "모든 파티원의 신뢰가 0이 되었다." },
      { label: "깨진 동맹", detail: "동료 간의 유대가 완전히 붕괴되었다." },
      { label: "거짓된 조언", detail: "잘못된 선택이 비극적 결과를 낳았다." },
      { label: "되돌릴 수 없는 결과", detail: "불신의 대가는 모든 것을 앗아갔다." },
    ],
    chronicleSummary:
      "신뢰는 아끼지 않고 소모되었고, 의심은 끝없이 쌓여갔다. 결국 동료들은 서로에게 등을 돌렸고, 원정은 끝내 무너졌다.",
  }),
  denounced: ending("denounced", {
    subtitle: "모든 선택에는 길이 있었고, 모든 길에는 대가가 있었다.",
    finalRank: "B",
    survivedCount: 5,
    diedCount: 7,
    zeroTrustCount: 5,
    zeroTrustPartySize: 5,
    finalReputation: 58,
    cumulativeGold: 121,
    adviceTotal: 98,
    wipedExpeditions: 1,
    turningPoint: { label: "잿빛 기록보관소", detail: "고발 기록 확정" },
    reasons: [
      "캠페인 중 5명의 캐릭터 신뢰가 0에 도달했습니다.",
      "반복된 선택과 조언이 고발로 누적되었습니다.",
      "길드는 당신이 더 이상 적합하지 않다고 판단했습니다.",
    ],
    report: ["신뢰 0 캐릭터 5명 도달", "누적 고발 기록 확정", "길드 조사 종료", "자격 정지"],
    consequences: [
      { label: "조사 완료", detail: "길드 조사단이 모든 행적을 검토했습니다." },
      { label: "고발 확정", detail: "누적된 고발 기록이 공식적으로 확정되었습니다." },
      { label: "신뢰 붕괴", detail: "5명의 동료와의 신뢰가 완전히 붕괴했습니다." },
      { label: "길드 판결", detail: "길드는 당신의 자격을 정지하고 추방을 결정했습니다." },
    ],
    chronicleSummary:
      "당신의 조언은 때로 길을 열었다. 그러나 반복된 편의의 선택은 결국 당신을 향한 증거가 되었다.",
  }),
  exhausted: ending("exhausted", {
    subtitle: "모든 길의 끝에는, 당신의 선택이 남았다.",
    finalRank: "C",
    survivedCount: 2,
    diedCount: 11,
    zeroTrustCount: 0,
    zeroTrustPartySize: 1,
    finalReputation: 64,
    cumulativeGold: 150,
    adviceTotal: 87,
    wipedExpeditions: 4,
    turningPoint: { label: "유리 광산", detail: "전력 붕괴" },
    reasons: [
      "세 가지 서로 다른 직업을 더 이상 구성할 수 없었습니다.",
      "반복된 손실로 길드의 기반은 텅 비어버렸습니다.",
      "더는 원정을 이어갈 인력이 없어, 캠페인은 여기서 끝납니다.",
    ],
    report: ["서로 다른 직업 3인 편성 불가", "생존 인력 급감", "원정 지속 불가", "캠페인 종료"],
    consequences: [
      { label: "공석 확대", detail: "전원 전투 불가" },
      { label: "전력 붕괴", detail: "전투력 심각한 악화" },
      { label: "길드 고갈", detail: "운영 기반 붕괴" },
      { label: "마지막 원정 종단", detail: "원정 활동 종단" },
    ],
    chronicleSummary:
      "모든 손실은 길을 좁혀 갔고, 서로를 잃을 때마다 동료는 줄어들었습니다. 결국 길은 닫혔고, 더는 원정을 떠날 자가 남지 않았습니다.",
  }),
  unemployed: ending("unemployed", {
    subtitle: "모든 길의 끝에는, 당신의 선택이 남았다.",
    finalRank: "C",
    survivedCount: 4,
    diedCount: 9,
    zeroTrustCount: 0,
    zeroTrustPartySize: 2,
    finalReputation: 39,
    cumulativeGold: 96,
    adviceTotal: 74,
    wipedExpeditions: 3,
    turningPoint: { label: "검은 성가대", detail: "마지막 진입 가능 공고 소멸" },
    reasons: [
      "모든 게시된 계약이 진입 불가능 상태가 되었습니다.",
      "캠페인 진행이 완전히 멈추었습니다.",
      "길드 가이드의 생계가 끊어졌습니다.",
    ],
    report: ["모든 공고 진입 불가", "남은 선택지 없음", "길드 활동 정지", "실직 확정"],
    consequences: [
      { label: "진입 불가", detail: "더 이상 들어갈 수 없습니다." },
      { label: "공고 소멸", detail: "더 이상 확인할 수 없습니다." },
      { label: "길드 정지", detail: "길드 활동이 중단되었습니다." },
      { label: "마지막 기회 상실", detail: "되돌릴 수 없는 선택이었습니다." },
    ],
    chronicleSummary:
      "모든 진입 불가 계약은, 미래를 닫아갔습니다. 선택 따라 하나씩 사라진 길 위에, 남은 것은 아무것도 없었습니다.",
  }),
};

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
    ending: ENDINGS.completed,
  },
  {
    id: "ending-distrust",
    label: `엔딩 · ${ENDING_TITLE.distrust}`,
    status: status({ rank: "B", reputation: 96, gold: 402, canPromote: false, remainingDungeons: 7 }),
    ending: ENDINGS.distrust,
  },
  {
    id: "ending-denounced",
    label: `엔딩 · ${ENDING_TITLE.denounced}`,
    status: status({ rank: "B", reputation: 54, gold: 516, canPromote: false, remainingDungeons: 6 }),
    ending: ENDINGS.denounced,
  },
  {
    id: "ending-exhausted",
    label: `엔딩 · ${ENDING_TITLE.exhausted}`,
    status: status({ rank: "C", reputation: 41, gold: 188, canPromote: false, remainingDungeons: 9 }),
    ending: ENDINGS.exhausted,
  },
  {
    id: "ending-unemployed",
    label: `엔딩 · ${ENDING_TITLE.unemployed}`,
    status: status({ rank: "C", reputation: 38, gold: 92, canPromote: false, remainingDungeons: 12 }),
    ending: ENDINGS.unemployed,
  },
];

export const U6_PREVIEW_IDS = U6_PREVIEW_ENTRIES.map((entry) => entry.id);
