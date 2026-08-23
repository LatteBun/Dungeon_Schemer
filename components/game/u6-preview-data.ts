import { CLASSES } from "@/lib/content/classes";
import { SPIDER_THEME } from "@/lib/content/themes";
import type {
  CampaignDungeon,
  CampaignEnding,
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
import type { U6EndingNote, U6EndingView } from "./u6-ending-model";
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
function withPool(campaign: CampaignState, change: (member: Character, index: number) => Character): CampaignState {
  const byId: Record<string, Character> = {};
  campaign.pool.order.forEach((id, index) => {
    const member = campaign.pool.byId[id];
    if (member !== undefined) byId[id] = change(member, index);
  });
  return { ...campaign, pool: { ...campaign.pool, byId } };
}

interface Judged {
  readonly campaign: CampaignState;
  readonly verdict: CampaignEnding;
}

function judged(kind: EndingKind, campaign: CampaignState, party?: readonly Character[]): Judged {
  const verdict = party === undefined
    ? evaluateCampaignEnding(campaign)
    : evaluateImmediateDistrustEnding(campaign, party);
  if (verdict === null || verdict.kind !== kind) {
    throw new Error(`프리뷰가 만든 캠페인이 ${kind} 로 판정되지 않는다: ${verdict?.kind ?? "판정 없음"}`);
  }
  /* 화면의 표제와 C6 의 표제가 갈라지면 여기서 드러난다. */
  if (ENDING_TITLE[kind] !== verdict.title) {
    throw new Error(`엔딩 표제가 C6 와 다르다: 화면 "${ENDING_TITLE[kind]}" · 규칙 "${verdict.title}"`);
  }
  return { campaign, verdict };
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

const completedCampaign = judged("completed", promotedToTop(withPool({
  ...baseCampaign,
  dungeons: baseCampaign.dungeons.map((candidate) => ({ ...candidate, status: "cleared" as const })),
  /* 열다섯 번의 원정에 대가가 없을 수 없다. 여섯을 묻고 왔다. */
}, (member, index) => index < 6 ? { ...member, alive: false, hp: 0 } : member)));

/*
 * 살아 있는 신뢰 0 이 고발 문턱을 딱 넘었다.
 *
 * 풀 전체를 0 으로 만들면 서른 명이 한꺼번에 고발하는 그림이 된다. 문턱은
 * 다섯이므로 다섯만 0 으로 두고 나머지는 그대로 둔다.
 */
const denouncedCampaign = judged("denounced", withPool(baseCampaign, (member, index) => {
  if (index < 4) return { ...member, alive: false, hp: 0 };
  if (index < 9) return { ...member, trust: 0 };
  return member;
}));

/*
 * 서로 다른 직업 셋을 채울 수 없다.
 *
 * 전원을 죽이면 "사망 30명" 이 된다. 살아 있는 사람이 두 직업뿐이면 편성이
 * 막히므로, 그 조건까지만 만든다.
 */
const survivingClasses = new Set<string>();
const exhaustedCampaign = judged("exhausted", withPool(baseCampaign, (member) => {
  if (survivingClasses.size < 2 || survivingClasses.has(member.classId)) {
    survivingClasses.add(member.classId);
    return member;
  }
  return { ...member, alive: false, hp: 0 };
}));

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
  judgement: Judged,
  over: {
    readonly subtitle: string;
    /** 판정 근거 뒤에 오는 두 줄. 이야기를 짓는 자리다. */
    readonly narrative: readonly [string, string];
    readonly report: readonly string[];
    readonly consequences: readonly U6EndingNote[];
    readonly chronicleSummary: string;
  },
): U6EndingView {
  const { campaign, verdict } = judgement;
  const stats = endingStatistics(campaign);
  return {
    kind: verdict.kind,
    subtitle: over.subtitle,
    /*
     * 첫 줄은 `C6` 가 쓴 판정 근거다. 화면이 다시 쓰지 않는다.
     *
     * 전에는 "총 15곳의 던전을 정복하며, 캠페인의 모든 임무를 완수했습니다"
     * 처럼 손으로 옮겨 적었다. 규칙이 문턱을 바꾸면 화면만 옛 문장을 들고 있게
     * 된다. 나머지 두 줄은 그 사실 위에 얹는 이야기다.
     */
    reasons: [verdict.reason, ...over.narrative],
    report: over.report,
    consequences: over.consequences,
    chronicleSummary: over.chronicleSummary,
    ...stats,
    zeroTrustPartySize: stats.zeroTrustCount,
    adviceTotal: campaign.history.events.length,
    turningPoint: null,
  };
}

/** 그 결말을 부른 사람들의 이름이다. `C6` 가 결정적 순서로 넘겨준다. */
function triggerNames(judgement: Judged): string {
  const names = judgement.verdict.triggerCharacterIds
    .map((id) => judgement.campaign.pool.byId[id]?.name)
    .filter((name): name is string => name !== undefined);
  return names.length === 0 ? "" : names.join(" · ");
}

/*
 * 산문은 화면이 쓴다.
 *
 * `C6` 가 주는 것은 판정 근거 한 줄이다. 결말을 어떤 목소리로 전할지는 규칙의
 * 일이 아니므로 여기서 쓴다. 다만 **사실을 다시 쓰지는 않는다.** 숫자와 이름은
 * 전부 캠페인에서 끌어온다. 전에는 "파티원 생존 1명 유지", "최종 등급 S 달성"
 * 처럼 손으로 적혀 있었고 어느 것도 이 캠페인의 값이 아니었다.
 */
const completedStats = endingStatistics(completedCampaign.campaign);
const denouncedStats = endingStatistics(denouncedCampaign.campaign);
const exhaustedStats = endingStatistics(exhaustedCampaign.campaign);
const unemployedStats = endingStatistics(unemployedCampaign.campaign);
const distrustStats = endingStatistics(distrustCampaign.campaign);

const ENDINGS: Readonly<Record<EndingKind, U6EndingView>> = {
  completed: ending(completedCampaign, {
    subtitle: "당신은 길을 안내했을 뿐이다. 걸어간 것은 그들이었다.",
    narrative: [
      `열다섯 번의 원정에서 ${completedStats.diedCount}명을 묻고 ${completedStats.survivedCount}명과 함께 돌아왔습니다.`,
      "길드는 당신의 이름을 기록에 남겼고, 아무도 그 대가를 세지 않았습니다.",
    ],
    report: [
      "던전 15곳 정복",
      `최종 등급 ${completedStats.finalRank}`,
      `전멸한 원정 ${completedStats.wipedExpeditions}회`,
      `누적 골드 ${completedStats.cumulativeGold}`,
    ],
    consequences: [
      { label: "완주", detail: "던전 15곳을 남김없이 지나왔다." },
      { label: "생환", detail: `${completedStats.survivedCount}명이 마지막까지 살아남았다.` },
      { label: "대가", detail: `${completedStats.diedCount}명이 돌아오지 못했다.` },
      { label: "등급", detail: `길잡이 등급 ${completedStats.finalRank} 에 이르렀다.` },
    ],
    chronicleSummary:
      "처음에는 아무도 당신의 말을 믿지 않았고, 나중에는 아무도 묻지 않고 따랐습니다. 그 변화가 무엇을 뜻하는지는 마지막 던전을 나선 뒤에야 알게 됩니다.",
  }),
  distrust: ending(distrustCampaign, {
    subtitle: "믿음은 한 번에 무너지지 않는다. 조금씩, 조언 하나마다 깎여 나간다.",
    narrative: [
      "돌아온 이들은 당신의 말을 더 듣지 않기로 했습니다.",
      "다음 원정에 그들을 다시 부를 수 없습니다.",
    ],
    report: [
      "원정 생존자 전원 신뢰 0",
      `신뢰 0 인 생존자 ${distrustStats.zeroTrustCount}명`,
      `최종 명성 ${distrustStats.finalReputation}`,
      `전멸한 원정 ${distrustStats.wipedExpeditions}회`,
    ],
    consequences: [
      { label: "불신", detail: "살아 돌아온 이들이 모두 등을 돌렸다." },
      { label: "고립", detail: "조언을 받아들일 사람이 남지 않았다." },
      { label: "명성", detail: `명성은 ${distrustStats.finalReputation} 에서 멈췄다.` },
      { label: "기록", detail: "길드는 원인을 묻지 않고 계약을 정리했다." },
    ],
    chronicleSummary:
      "당신의 조언은 매번 맞았을 수도 있고, 한 번도 맞지 않았을 수도 있습니다. 그들이 아는 것은 몇 명이 돌아오지 못했다는 사실뿐이었습니다.",
  }),
  denounced: ending(denouncedCampaign, {
    subtitle: "한 사람의 침묵은 견딜 수 있다. 다섯 사람의 증언은 그렇지 않다.",
    narrative: [
      `${triggerNames(denouncedCampaign)} 가 길드에 같은 말을 했습니다.`,
      "길드는 그 말을 기록으로 남겼고, 당신의 이름을 명부에서 지웠습니다.",
    ],
    report: [
      `불신을 증언한 용사 ${denouncedStats.zeroTrustCount}명`,
      `살아 있는 용사 ${denouncedStats.survivedCount}명`,
      `사망한 용사 ${denouncedStats.diedCount}명`,
      `최종 명성 ${denouncedStats.finalReputation}`,
    ],
    consequences: [
      { label: "고발", detail: `${denouncedStats.zeroTrustCount}명이 같은 증언을 남겼다.` },
      { label: "박탈", detail: "길잡이 자격이 회수되었다." },
      { label: "명성", detail: `쌓아 둔 명성 ${denouncedStats.finalReputation} 은 소용이 없었다.` },
      { label: "이후", detail: "그들은 다른 길잡이와 다시 원정을 나선다." },
    ],
    chronicleSummary:
      "고발은 한 번에 오지 않았습니다. 돌아온 이들이 하나씩 말을 옮겼고, 다섯 번째 증언에서 길드가 움직였습니다.",
  }),
  exhausted: ending(exhaustedCampaign, {
    subtitle: "던전은 그대로 있다. 들어갈 사람이 없을 뿐이다.",
    narrative: [
      `${exhaustedStats.diedCount}명을 잃고 나니 서로 다른 직업 셋을 채울 수 없습니다.`,
      "공고는 그대로 걸려 있지만 계약할 수 없습니다.",
    ],
    report: [
      "서로 다른 직업 3명을 편성할 수 없음",
      `사망한 용사 ${exhaustedStats.diedCount}명`,
      `남은 용사 ${exhaustedStats.survivedCount}명`,
      `전멸한 원정 ${exhaustedStats.wipedExpeditions}회`,
    ],
    consequences: [
      { label: "소진", detail: `${exhaustedStats.diedCount}명이 돌아오지 못했다.` },
      { label: "정지", detail: "편성할 파티가 없어 원정이 멈췄다." },
      { label: "잔고", detail: `골드 ${exhaustedStats.cumulativeGold} 은 쓸 곳이 없다.` },
      { label: "이후", detail: "길드는 다른 길잡이에게 남은 던전을 넘긴다." },
    ],
    chronicleSummary:
      "전멸은 매번 다른 이유로 일어났지만 결과는 같았습니다. 마지막에 남은 것은 채울 수 없는 세 자리였습니다.",
  }),
  unemployed: ending(unemployedCampaign, {
    subtitle: "게시판은 매일 채워진다. 당신이 읽을 수 있는 줄이 없을 뿐이다.",
    narrative: [
      `등급 ${unemployedStats.finalRank} 로는 남은 공고를 하나도 계약할 수 없습니다.`,
      "명성을 더 쌓을 원정이 없으므로 등급도 오르지 않습니다.",
    ],
    report: [
      "남은 공고가 전부 등급 미달",
      `길잡이 등급 ${unemployedStats.finalRank}`,
      `최종 명성 ${unemployedStats.finalReputation}`,
      `누적 골드 ${unemployedStats.cumulativeGold}`,
    ],
    consequences: [
      { label: "정체", detail: `등급 ${unemployedStats.finalRank} 에서 더 나아가지 못했다.` },
      { label: "봉쇄", detail: "계약할 수 있는 공고가 남지 않았다." },
      { label: "명성", detail: `명성 ${unemployedStats.finalReputation} 은 승급에 모자랐다.` },
      { label: "이후", detail: "길드는 조용히 당신의 자리를 비웠다." },
    ],
    chronicleSummary:
      "실패한 원정마다 던전의 위험도가 올랐습니다. 어느 날 게시판을 보니 읽을 수 있는 공고가 한 줄도 남아 있지 않았습니다.",
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
