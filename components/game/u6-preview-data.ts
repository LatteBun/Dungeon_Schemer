import { CLASSES } from "@/lib/content/classes";
import { SPIDER_THEME } from "@/lib/content/themes";
import type {
  CampaignDungeon,
  CampaignState,
  Character,
  EndingKind,
  SettlementSnapshot,
  ThemeId,
} from "@/lib/domain";
import {
  decideImmediateAdvice,
  finalizeImmediateAdviceTrust,
  presentShuffledAdvice,
} from "@/lib/rules/advice-evaluation";
import { createBoardOffers } from "@/lib/rules/board";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { generateDungeonMap } from "@/lib/rules/dungeon-map";
import {
  applyEventChoice,
  materializeNodeEvent,
  prepareExpeditionEvents,
  resolveMonsterEventBattle,
} from "@/lib/rules/expedition-events";
import {
  evaluateCampaignEnding,
  evaluateImmediateDistrustEnding,
} from "@/lib/rules/ending";
import { executeGuidePromotion, getGuidePromotionEligibility } from "@/lib/rules/promotion";
import { settleExpedition } from "@/lib/rules/settlement";
import type { TopStatusView } from "./TopStatusBar";
import type { U6EndingView } from "./u6-ending-model";
import { ENDING_TITLE } from "./u6-ending-model";
import { createU6SettlementView, type U6SettlementView } from "./u6-settlement-model";

/**
 * `/u6-test` 프리뷰 데이터.
 *
 * 정산은 `C4`, 승급 가능 판정은 `C5`, 엔딩 판정은 `C6`, 누적 통계는 `C8` 이
 * 한다. 이 파일은 그 결과를 화면 View 로 옮기고 여덟 상태를 고르기만 한다.
 *
 * 한때 세 정산과 다섯 엔딩을 손으로 적었다. 규칙이 없던 동안의 임시였고, 거기
 * 적힌 파티원은 이 캠페인에 있지도 않았다.
 */

const PREVIEW_SEED = "u6-settlement-preview";
const PREVIEW_DUNGEON_ID = "dungeon-spider-03";
const PREVIEW_ATTEMPT = 1;

export type U6PreviewId =
  | "settlement-partial"
  | "settlement-wipe"
  | "settlement-promotion"
  | "ending-completed"
  | "ending-distrust"
  | "ending-denounced"
  | "ending-exhausted"
  | "ending-unemployed";

const baseCampaign = initializeCampaign(PREVIEW_SEED);

function previewDungeon(): CampaignDungeon {
  const found = baseCampaign.dungeons.find((candidate) => candidate.id === PREVIEW_DUNGEON_ID);
  if (found === undefined) throw new Error(`프리뷰 던전이 캠페인에 없다: ${PREVIEW_DUNGEON_ID}`);
  return found;
}

const dungeon = previewDungeon();

/**
 * 직업이 서로 다른 살아 있는 셋을 고른다.
 *
 * `C4` 가 정산 파티를 서로 다른 3개 클래스로 요구한다. 풀 앞에서 셋을 그냥
 * 자르면 같은 직업이 겹쳐 정산이 거부된다.
 */
function previewParty(): readonly Character[] {
  const picked: Character[] = [];
  const usedClasses = new Set<string>();
  for (const id of baseCampaign.pool.order) {
    const member = baseCampaign.pool.byId[id];
    if (member === undefined || !member.alive) continue;
    if (usedClasses.has(member.classId)) continue;
    usedClasses.add(member.classId);
    picked.push(member);
    if (picked.length === 3) break;
  }
  if (picked.length !== 3) throw new Error("프리뷰에 쓸 서로 다른 직업 셋이 없다");
  return picked;
}

const party = previewParty();

/**
 * 원인 사슬의 앞 세 칸을 실제 원정에서 얻는다.
 *
 * `선택`·`개인 반응`·`피해` 는 규칙이 만든 사실이다. 뒤 두 칸(`보상·손실`,
 * `캠페인 변화`)은 `C4` 가 정산하면서 직접 쓴다.
 */
function causeInputsFromExpedition(): { choice: string; reactions: string; damage: string } {
  const map = generateDungeonMap({
    campaignSeed: PREVIEW_SEED, dungeonId: dungeon.id,
    initialRiskLevel: dungeon.initialRiskLevel, attempt: PREVIEW_ATTEMPT,
  });
  const prepared = prepareExpeditionEvents({
    campaignSeed: PREVIEW_SEED, dungeonId: dungeon.id,
    initialRiskLevel: dungeon.initialRiskLevel, riskLevel: dungeon.riskLevel,
    attempt: PREVIEW_ATTEMPT, map, theme: SPIDER_THEME,
    activeRuleIds: dungeon.activeRuleIds, activeMonsterIds: dungeon.activeMonsterIds,
  });
  const layerByNode = new Map(map.layers.flatMap((layer, index) => layer.nodeIds.map((nodeId) => [nodeId, index] as const)));

  let state = prepared;
  for (const node of map.nodes) {
    if (node.kind !== "normal") continue;
    let materialized;
    try {
      materialized = materializeNodeEvent({
        prepared: state, nodeId: node.id, campaignSeed: PREVIEW_SEED,
        dungeonId: dungeon.id, attempt: PREVIEW_ATTEMPT, theme: SPIDER_THEME,
        activeRuleIds: dungeon.activeRuleIds, activeMonsterIds: dungeon.activeMonsterIds,
      });
    } catch { continue; }
    state = materialized.state;
    const isMonster = (candidate: typeof materialized.event): candidate is typeof materialized.event & { readonly kind: "monster" } =>
      candidate.kind === "monster";
    if (!isMonster(materialized.event)) continue;
    const event = materialized.event;

    const depth = layerByNode.get(node.id) ?? 1;
    const presented = presentShuffledAdvice({
      campaignSeed: PREVIEW_SEED, dungeonId: dungeon.id,
      attempt: PREVIEW_ATTEMPT, depth, event,
    });
    const first = presented[0];
    if (first === undefined) continue;
    const decision = decideImmediateAdvice({
      campaignSeed: PREVIEW_SEED, dungeonId: dungeon.id,
      attempt: PREVIEW_ATTEMPT, depth, event, adviceId: first.id, members: party,
    });
    const byId = new Map(party.map((member) => [member.id, member]));
    const applied = applyEventChoice({ event, decision, members: party });
    const battle = resolveMonsterEventBattle({
      event, modifier: applied.encounterModifier ?? {},
      activeMonsterIds: dungeon.activeMonsterIds, monsterDefs: SPIDER_THEME.monsters,
      members: applied.members, classDefs: CLASSES,
      seed: `${PREVIEW_SEED}/${dungeon.id}/settlement`, pendingMerchantEffect: null, retrySteps: 0,
    }).battle;

    const word = (reaction: string) => reaction === "accepted" ? "수용" : reaction === "suspected" ? "의심" : "적발";
    const hurt = (battle?.party ?? []).flatMap((after) => {
      const before = party.find((candidate) => String(candidate.id) === String(after.id));
      if (before === undefined || before.hp === after.hp) return [];
      return [`${before.name} HP ${before.hp} → ${after.hp}`];
    });

    return {
      choice: first.label,
      reactions: decision.reactions
        .map((one) => `${byId.get(one.characterId)?.name ?? String(one.characterId)} ${word(one.reaction)}`)
        .join(" · "),
      damage: hurt.length > 0 ? hurt.join(" · ") : "피해 없이 지나갔다",
    };
  }
  throw new Error("프리뷰 원정에서 monster 사건을 물질화하지 못했다");
}

const causeInputs = causeInputsFromExpedition();

/** 정산 상황마다 최종 파티 상태를 만든다. `C4` 가 그것을 읽고 계산한다. */
function settlementFor(input: {
  readonly campaign: CampaignState;
  readonly finalMembers: readonly Character[];
  readonly status: "cleared" | "wiped";
}): U6SettlementView {
  const snapshot: SettlementSnapshot = {
    expeditionId: `${PREVIEW_SEED}/${dungeon.id}/${input.status}`,
    dungeonId: dungeon.id,
    contractRisk: input.campaign.dungeons.find((candidate) => candidate.id === dungeon.id)!.riskLevel,
    party: { memberIds: party.map((member) => member.id) },
    finalMembers: input.finalMembers,
    status: input.status,
    causeInputs,
  };
  return createU6SettlementView(
    settleExpedition(input.campaign, snapshot).result,
    dungeon.name,
    dungeon.theme satisfies ThemeId,
  );
}

const [first, second, third] = party;

/** ★2 · 2명 생존. 한 명이 죽고 남은 둘이 상처를 안고 돌아온다. */
const settlementPartial = settlementFor({
  campaign: baseCampaign,
  status: "cleared",
  finalMembers: [
    { ...first, hp: Math.max(1, Math.floor(first.hp / 2)), trust: Math.max(0, first.trust - 18) },
    { ...second, hp: 0, alive: false },
    { ...third, hp: Math.max(1, third.hp - 6), trust: Math.max(0, third.trust - 6) },
  ],
});

/** 전멸. 명성 손실은 상승 전 위험도로 계산하고 유품 골드를 회수한다. */
const settlementWipe = settlementFor({
  campaign: baseCampaign,
  status: "wiped",
  finalMembers: party.map((member) => ({ ...member, hp: 0, alive: false })),
});

/** ★5 던전을 전원 생존으로 클리어했다. 전멸이 아니므로 위험도가 오르지 않는다. */
const cappedCampaign: CampaignState = {
  ...baseCampaign,
  dungeons: baseCampaign.dungeons.map((candidate) =>
    candidate.id === dungeon.id ? { ...candidate, riskLevel: 5 as const } : candidate),
};
const settlementCapped = settlementFor({
  campaign: cappedCampaign,
  status: "cleared",
  finalMembers: party.map((member) => ({ ...member, hp: Math.max(1, member.hp - 4) })),
});

function status(over: Partial<TopStatusView> = {}): TopStatusView {
  const eligibility = getGuidePromotionEligibility(baseCampaign);
  return {
    rank: baseCampaign.rank,
    reputation: baseCampaign.reputation,
    gold: baseCampaign.gold,
    canPromote: eligibility !== null && (eligibility.canPromoteByReputation || eligibility.canPromoteByGold),
    remainingDungeons: baseCampaign.dungeons.filter((candidate) => candidate.status !== "cleared").length,
    ...over,
  };
}

/*
 * 엔딩 판정은 `C6` 가, 누적 통계는 `C8` 이 낸다.
 *
 * 산문(부제·이유·보고서·결과)은 화면의 몫이라 여기서 쓴다. 다만 숫자는 하나도
 * 지어내지 않는다. 전에는 생존 9 · 사망 6 · 명성 148 같은 값이 박혀 있었다.
 */
/**
 * 엔딩마다 그 결말이 실제로 성립하는 캠페인을 만든다.
 *
 * 결과를 지어내지 않는다. 입력을 진짜로 만들고 `C6` 가 판정한다. 판정이 기대와
 * 다르면 던진다. 그러면 규칙이 바뀌었는데 화면만 옛 그림을 들고 있는 일이 없다.
 */
function withPool(campaign: CampaignState, change: (member: Character) => Character): CampaignState {
  const byId: Record<string, Character> = {};
  for (const id of campaign.pool.order) {
    const member = campaign.pool.byId[id];
    if (member !== undefined) byId[id] = change(member);
  }
  return { ...campaign, pool: { ...campaign.pool, byId } };
}

function judged(kind: EndingKind, campaign: CampaignState, party?: readonly Character[]): CampaignState {
  const verdict = party === undefined
    ? evaluateCampaignEnding(campaign)
    : evaluateImmediateDistrustEnding(campaign, party);
  if (verdict === null || verdict.kind !== kind) {
    throw new Error(`프리뷰가 만든 캠페인이 ${kind} 로 판정되지 않는다: ${verdict?.kind ?? "판정 없음"}`);
  }
  return campaign;
}

/*
 * 던전 15곳을 모두 클리어하고 S 까지 올라섰다.
 *
 * 등급을 손으로 적지 않는다. 명성을 채워 두고 `C5` 의 승급을 세 번 실행한다.
 * 요구치가 바뀌면 여기서 드러난다.
 */
function promotedToTop(campaign: CampaignState): CampaignState {
  let current: CampaignState = { ...campaign, reputation: 1000, gold: 1000 };
  while (getGuidePromotionEligibility(current) !== null) {
    current = executeGuidePromotion(current, "reputation").campaign;
  }
  return current;
}

const completedCampaign = judged("completed", promotedToTop({
  ...baseCampaign,
  dungeons: baseCampaign.dungeons.map((candidate) => ({ ...candidate, status: "cleared" as const })),
}));

/** 살아 있는 신뢰 0 이 고발 문턱을 넘었다. */
const denouncedCampaign = judged("denounced", withPool(baseCampaign, (member) => ({ ...member, trust: 0 })));

/** 출전 가능한 인원이 남지 않았다. */
const exhaustedCampaign = judged("exhausted", withPool(baseCampaign, (member) => ({ ...member, alive: false, hp: 0 })));

/*
 * 게시판의 공고가 전부 등급 미달로 잠겼다.
 *
 * `initializeCampaign` 은 공고를 만들지 않는다. 게시판을 채우는 것은 `C2` 다.
 * 공고가 0 개면 이 판정 자체가 성립하지 않으므로 먼저 게시판을 만든다.
 */
const boardedCampaign: CampaignState = { ...baseCampaign, offers: createBoardOffers(baseCampaign) };
const unemployedCampaign = judged("unemployed", {
  ...boardedCampaign,
  offers: boardedCampaign.offers.map((offer) => ({ ...offer, lockReason: "rankTooLow" as const })),
});

/** 원정 생존자 전원의 신뢰가 0 이다. 즉시 불신으로 끝난다. */
const distrustParty = party.map((member) => ({ ...member, trust: 0 }));
const distrustCampaign = judged("distrust", baseCampaign, distrustParty);

function endingStatistics(campaign: CampaignState) {
  const pool = campaign.pool.order.map((id) => campaign.pool.byId[id]).filter((member): member is Character => member !== undefined);
  return {
    finalRank: campaign.rank,
    survivedCount: pool.filter((member) => member.alive).length,
    diedCount: pool.filter((member) => !member.alive).length,
    zeroTrustCount: pool.filter((member) => member.alive && member.trust === 0).length,
    finalReputation: campaign.reputation,
    cumulativeGold: campaign.cumulativeGold,
    wipedExpeditions: campaign.statistics.wipedExpeditions,
  };
}

function ending(
  kind: EndingKind,
  campaign: CampaignState,
  over: Pick<U6EndingView, "subtitle" | "reasons" | "report" | "consequences" | "chronicleSummary">,
): U6EndingView {
  const stats = endingStatistics(campaign);
  return {
    kind,
    ...stats,
    zeroTrustPartySize: stats.zeroTrustCount,
    adviceTotal: campaign.history.events.length,
    turningPoint: null,
    ...over,
  };
}

const ENDINGS: Readonly<Record<EndingKind, U6EndingView>> = {
  completed: ending("completed", completedCampaign, {
    subtitle: "당신은 길을 안내했지만, 결국 선택한 것은 당신 자신의 길이었다.",
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
  distrust: ending("distrust", distrustCampaign, {
    subtitle: "모든 선택에는 길이 있었고, 모든 길에는 대가가 있었다.",
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
  denounced: ending("denounced", denouncedCampaign, {
    subtitle: "모든 선택에는 길이 있었고, 모든 길에는 대가가 있었다.",
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
  exhausted: ending("exhausted", exhaustedCampaign, {
    subtitle: "모든 길의 끝에는, 당신의 선택이 남았다.",
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
  unemployed: ending("unemployed", unemployedCampaign, {
    subtitle: "모든 길의 끝에는, 당신의 선택이 남았다.",
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
    label: "정산 · 캠페인 변화",
    status: status({ reputation: 88, gold: 214 }),
    settlement: settlementCapped,
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
