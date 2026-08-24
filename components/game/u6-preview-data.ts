import { PROMOTION_GOLD, PROMOTION_REPUTATION } from "@/lib/domain";
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
import { recordSettlementStatistics } from "@/lib/rules/campaign-statistics";
import { settleExpedition } from "@/lib/rules/settlement";
import type { TopStatusView } from "./TopStatusBar";
import type { U6EndingView } from "./u6-ending-model";
import { createU6EndingView } from "./u6-ending-adapter";
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

/**
 * 피해 줄은 그 판의 최종 파티에서 만든다.
 *
 * 한 번 만들어 모든 변형에 돌려 쓰고 있었다. 그러면 전멸 정산에도 "피해 없이
 * 지나갔다" 가 실린다 - 셋이 다 죽었는데. 프리뷰가 거짓을 말하면 프리뷰를 보고
 * 고친 화면도 거짓을 담는다.
 */
function damageLineFor(finalMembers: readonly Character[]): string {
  const before = new Map(party.map((member) => [String(member.id), member]));
  const hurt = finalMembers.flatMap((after) => {
    const start = before.get(String(after.id));
    if (start === undefined || start.hp === after.hp) return [];
    return [`${after.name} HP ${start.hp} → ${after.hp}`];
  });
  return hurt.length === 0 ? "피해 없이 지나갔다" : hurt.join(" · ");
}

/**
 * 원정을 실제로 여러 번 정산해 캠페인 이력을 쌓는다.
 *
 * 엔딩 화면은 누적 통계를 보여준다. 그런데 `initializeCampaign` 만으로는
 * 정산이 한 번도 없어 모두 0 이다. 명성이나 골드를 손으로 채워 넣으면 그 숫자가
 * 어디서 왔는지 설명할 수 없다. 그래서 `C4` 로 정산하고 `C8-A` 로 누적한다.
 *
 * 던전마다 셋 중 하나를 결정적으로 고른다. 전원 생환, 한 명 사망, 전멸이다.
 * 그러면 생존·사망·전멸 횟수·누적 골드가 전부 그 이력의 결과가 된다.
 */
function playedThrough(
  campaign: CampaignState,
  dungeonCount: number,
  /** 결말마다 필요한 이력이 다르다. 완주는 전멸이 하나도 없어야 성립한다. */
  outcomeFor: (index: number) => number = (index) => index % 3,
): CampaignState {
  let current = campaign;
  for (let index = 0; index < dungeonCount; index += 1) {
    const target = current.dungeons[index];
    if (target === undefined) break;

    const alive = current.pool.order
      .map((id) => current.pool.byId[id])
      .filter((member): member is Character => member !== undefined && member.alive);
    const trio: Character[] = [];
    const classes = new Set<string>();
    for (const member of alive) {
      if (classes.has(member.classId)) continue;
      classes.add(member.classId);
      trio.push(member);
      if (trio.length === 3) break;
    }
    if (trio.length !== 3) break;

    /* 셋 중 하나를 순서대로 고른다. 시드가 같으면 이력도 같다. */
    const outcome = outcomeFor(index);
    const wiped = outcome === 2;
    const finalMembers = trio.map((member, position) => {
      if (wiped) return { ...member, hp: 0, alive: false };
      if (outcome === 1 && position === 1) return { ...member, hp: 0, alive: false };
      return { ...member, hp: Math.max(1, member.hp - 5), trust: Math.max(0, member.trust - 3) };
    });

    const execution = settleExpedition(current, {
      expeditionId: `${PREVIEW_SEED}/${target.id}/${index}`,
      dungeonId: target.id,
      contractRisk: target.riskLevel,
      party: { memberIds: trio.map((member) => member.id) },
      finalMembers,
      status: wiped ? "wiped" : "cleared",
      causeInputs: { ...causeInputs, damage: damageLineFor(finalMembers) },
    });
    current = {
      ...execution.campaign,
      statistics: recordSettlementStatistics(execution.campaign.statistics, execution.result, target),
    };
  }
  return current;
}

/** 열두 번의 원정을 치른 캠페인. 엔딩들이 이 위에서 판정된다. */
const playedCampaign = playedThrough(baseCampaign, 12);

/** 정산 상황마다 최종 파티 상태를 만든다. `C4` 가 그것을 읽고 계산한다. */
function settlementFor(input: {
  readonly campaign: CampaignState;
  readonly finalMembers: readonly Character[];
  readonly status: "cleared" | "wiped";
}): { readonly view: U6SettlementView; readonly campaign: CampaignState } {
  const snapshot: SettlementSnapshot = {
    expeditionId: `${PREVIEW_SEED}/${dungeon.id}/${input.status}`,
    dungeonId: dungeon.id,
    contractRisk: input.campaign.dungeons.find((candidate) => candidate.id === dungeon.id)!.riskLevel,
    party: { memberIds: party.map((member) => member.id) },
    finalMembers: input.finalMembers,
    status: input.status,
    causeInputs: { ...causeInputs, damage: damageLineFor(input.finalMembers) },
  };
  const execution = settleExpedition(input.campaign, snapshot);
  return {
    view: createU6SettlementView(execution.result, dungeon.name, dungeon.theme satisfies ThemeId),
    /* 상태 바는 정산 뒤의 캠페인을 보여준다. 명성과 골드가 이미 반영된 값이다. */
    campaign: execution.campaign,
  };
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

/**
 * 상태 바는 그 화면이 보여주는 캠페인에서 온다.
 *
 * 전에는 화면마다 명성·골드·남은 던전을 손으로 적었다. 그래서 엔딩 화면의
 * 상태 바가 "등급 A · 명성 205" 라고 하는데 같은 화면의 엔딩 패널은 "등급 S ·
 * 명성 1000" 이라고 하는 일이 있었다. 한 화면이 자기 자신과 어긋났다.
 */
function statusOf(campaign: CampaignState): TopStatusView {
  const eligibility = getGuidePromotionEligibility(campaign);
  return {
    rank: campaign.rank,
    reputation: campaign.reputation,
    gold: campaign.gold,
    canPromote: eligibility !== null && (eligibility.canPromoteByReputation || eligibility.canPromoteByGold),
    remainingDungeons: campaign.dungeons.filter((candidate) => candidate.status !== "cleared").length,
    ...(eligibility === null ? {} : {
      nextPromotion: { rank: eligibility.toRank, reputationRequired: eligibility.reputationRequired },
    }),
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
  /* 열다섯 던전을 다 돌면 명성이 요구치를 넘는다. 모자라면 승급이 멈출 뿐이다. */
  let current: CampaignState = campaign;
  for (;;) {
    const eligibility = getGuidePromotionEligibility(current);
    if (eligibility === null) break;
    /* 자격이 있다는 것과 지금 올릴 수 있다는 것은 다르다. 명성이나 골드가
     * 요구치에 닿아야 실제로 오른다. 닿지 못하면 거기서 멈춘다. */
    if (!eligibility.canPromoteByReputation && !eligibility.canPromoteByGold) break;
    current = executeGuidePromotion(current, eligibility.canPromoteByReputation ? "reputation" : "gold").campaign;
  }
  return current;
}

/*
 * 던전 열다섯 곳을 실제로 다 돌았다. 상태를 손으로 덮어쓰지 않는다.
 *
 * 전에는 12회 이력 위에 던전 상태만 `cleared` 로 바꿔 놓았다. 그러면 "던전 15곳
 * 정복" 과 "원정 12회" 가 한 화면에 같이 서고, 어느 쪽도 참이 아니게 된다.
 * 하드코딩된 "열다섯 번" 이 그 모순을 가리고 있었다. 전멸 없이 열다섯 번을
 * 치르면 두 숫자가 저절로 맞는다 — 대가는 한 번 걸러 한 명씩 치른다.
 */
const completedCampaign = judged(
  "completed",
  promotedToTop(playedThrough(baseCampaign, 15, (index) => index % 2)),
);

/*
 * 살아 있는 신뢰 0 이 고발 문턱을 딱 넘었다.
 *
 * 풀 전체를 0 으로 만들면 서른 명이 한꺼번에 고발하는 그림이 된다. 문턱은
 * 다섯이므로 다섯만 0 으로 두고 나머지는 그대로 둔다.
 */
let denouncedRemaining = 5;
const denouncedCampaign = judged("denounced", withPool(playedCampaign, (member) => {
  /* 살아 있는 사람만 증언할 수 있다. 이력에 이미 사망자가 있으므로 순번이
   * 아니라 생존 여부로 센다. */
  if (!member.alive || denouncedRemaining === 0) return member;
  denouncedRemaining -= 1;
  return { ...member, trust: 0 };
}));

/*
 * 서로 다른 직업 셋을 채울 수 없다.
 *
 * 전원을 죽이면 "사망 30명" 이 된다. 살아 있는 사람이 두 직업뿐이면 편성이
 * 막히므로, 그 조건까지만 만든다.
 */
const survivingClasses = new Set<string>();
const exhaustedCampaign = judged("exhausted", withPool(playedCampaign, (member) => {
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
const boardedCampaign: CampaignState = { ...playedCampaign, offers: createBoardOffers(playedCampaign) };
/*
 * 올라갈 수도 없어야 실직이다.
 *
 * 공고가 전부 잠긴 것만으로는 부족하다 — 지금 승급할 수 있으면 그 공고들이
 * 열리므로 `C6` 는 실직으로 보지 않는다. 전에는 이 픽스처가 명성과 골드를 넉넉히
 * 들고 있었고, 그런데도 실직으로 판정되던 것이 규칙 쪽 결함이었다.
 *
 * 승급 문턱(명성 60 · 골드 150)에 못 미치게 낮춘다. 손으로 정한 값이 아니라
 * 문턱에서 끌어온다.
 */
const unemployedCampaign = judged("unemployed", {
  ...boardedCampaign,
  reputation: PROMOTION_REPUTATION.B - 1,
  gold: PROMOTION_GOLD.B - 1,
  offers: boardedCampaign.offers.map((offer) => ({ ...offer, lockReason: "rankTooLow" as const })),
});

/** 원정 생존자 전원의 신뢰가 0 이다. 즉시 불신으로 끝난다. */
const distrustParty = party.map((member) => ({ ...member, trust: 0 }));
const distrustCampaign = judged("distrust", playedCampaign, distrustParty);

/*
 * 프리뷰도 실제 화면과 같은 어댑터를 쓴다.
 *
 * 전에는 다섯 결말의 산문과 숫자가 이 파일에 따로 적혀 있었다. 캠페인 통합이
 * 같은 것을 한 벌 더 만들면 프리뷰에서 본 결말과 실제로 보는 결말이 갈라진다.
 * 산문은 어댑터로 옮겼고, 여기 남은 것은 어떤 캠페인을 보여 줄지의 선택뿐이다.
 */
const ENDINGS: Readonly<Record<EndingKind, U6EndingView>> = {
  completed: createU6EndingView(completedCampaign.campaign, completedCampaign.verdict),
  distrust: createU6EndingView(distrustCampaign.campaign, distrustCampaign.verdict),
  denounced: createU6EndingView(denouncedCampaign.campaign, denouncedCampaign.verdict),
  exhausted: createU6EndingView(exhaustedCampaign.campaign, exhaustedCampaign.verdict),
  unemployed: createU6EndingView(unemployedCampaign.campaign, unemployedCampaign.verdict),
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
    status: statusOf(settlementPartial.campaign),
    settlement: settlementPartial.view,
  },
  {
    id: "settlement-wipe",
    label: "정산 · 전멸",
    status: statusOf(settlementWipe.campaign),
    settlement: settlementWipe.view,
  },
  {
    id: "settlement-promotion",
    label: "정산 · 캠페인 변화",
    status: statusOf(settlementCapped.campaign),
    settlement: settlementCapped.view,
  },
  {
    id: "ending-completed",
    label: `엔딩 · ${ENDING_TITLE.completed}`,
    status: statusOf(completedCampaign.campaign),
    ending: ENDINGS.completed,
  },
  {
    id: "ending-distrust",
    label: `엔딩 · ${ENDING_TITLE.distrust}`,
    status: statusOf(distrustCampaign.campaign),
    ending: ENDINGS.distrust,
  },
  {
    id: "ending-denounced",
    label: `엔딩 · ${ENDING_TITLE.denounced}`,
    status: statusOf(denouncedCampaign.campaign),
    ending: ENDINGS.denounced,
  },
  {
    id: "ending-exhausted",
    label: `엔딩 · ${ENDING_TITLE.exhausted}`,
    status: statusOf(exhaustedCampaign.campaign),
    ending: ENDINGS.exhausted,
  },
  {
    id: "ending-unemployed",
    label: `엔딩 · ${ENDING_TITLE.unemployed}`,
    status: statusOf(unemployedCampaign.campaign),
    ending: ENDINGS.unemployed,
  },
];

export const U6_PREVIEW_IDS = U6_PREVIEW_ENTRIES.map((entry) => entry.id);
