import { THEMES } from "@/lib/content/themes";
import type {
  ActiveExpeditionContext,
  CampaignState,
  Character,
  EventKind,
  NodeId,
  SituationEvent,
  ThemeContent,
} from "@/lib/domain";
import { getGuidePromotionEligibility } from "@/lib/rules/promotion";
import { presentShuffledAdvice } from "@/lib/rules/advice-evaluation";
import { PERSONALITY_LABEL, classLabel, portraitSrcForCharacter } from "./character-labels";
import type { TopStatusView } from "./TopStatusBar";
import type { U5EcologyView } from "./u5-log";
import { toAdviceViews, type U5ProgressView, type U5SceneKind } from "./u5-progress-model";

/**
 * 스토어 상태에서 화면 View 를 만든다.
 *
 * 화면은 View 만 안다. 규칙 타입도 스토어도 모른다. 그 경계를 여기서 지킨다.
 * 규칙 계산은 하지 않는다 — 이미 계산된 것을 옮기기만 한다.
 */

export function statusFor(campaign: CampaignState, active: ActiveExpeditionContext | null): TopStatusView {
  const eligibility = getGuidePromotionEligibility(campaign);
  const dungeon = active === null
    ? undefined
    : campaign.dungeons.find((candidate) => candidate.id === active.expedition.dungeonId);
  return {
    rank: campaign.rank,
    reputation: campaign.reputation,
    gold: campaign.gold,
    canPromote: eligibility !== null && (eligibility.canPromoteByReputation || eligibility.canPromoteByGold),
    remainingDungeons: campaign.dungeons.filter((candidate) => candidate.status !== "cleared").length,
    ...(eligibility === null ? {} : {
      nextPromotion: { rank: eligibility.toRank, reputationRequired: eligibility.reputationRequired },
    }),
    ...(dungeon === undefined ? {} : {
      currentDungeon: { name: dungeon.name, riskLevel: active!.expedition.riskLevel },
    }),
  };
}

/**
 * 지도에 내보낼 노드별 공개 분류다.
 *
 * `E3` 의 계획에서 `category` 만 꺼낸다. **숨은 `hiddenRole` 은 내보내지 않는다.**
 * 보스 정보 지점도 강한 연계 후속도 지도에서는 평범한 같은 분류로 보여야 한다.
 */
export function publicKindByNodeId(active: ActiveExpeditionContext): Readonly<Partial<Record<NodeId, EventKind>>> {
  const plans = active.preparedEvents?.nodePlans;
  if (plans === undefined) return {};
  const out: Partial<Record<NodeId, EventKind>> = {};
  for (const [nodeId, plan] of plans) out[nodeId] = plan.category;
  return out;
}

function themeOf(campaign: CampaignState, active: ActiveExpeditionContext): ThemeContent {
  const dungeon = campaign.dungeons.find((candidate) => candidate.id === active.expedition.dungeonId);
  const theme = dungeon === undefined ? undefined : THEMES.find((candidate) => candidate.id === dungeon.theme);
  if (theme === undefined) throw new Error(`원정 테마를 찾을 수 없다: ${active.expedition.dungeonId}`);
  return theme;
}

export function partyViewsFor(members: readonly Character[]) {
  return members.map((member) => ({
    id: String(member.id),
    name: member.name,
    classLabel: classLabel(member.classId),
    personalityLabel: PERSONALITY_LABEL[member.personality],
    hp: member.hp,
    maxHp: member.maxHp,
    trust: member.trust,
    gold: member.gold,
    alive: member.alive,
    portraitSrc: portraitSrcForCharacter({ id: member.id, classId: member.classId, alive: member.alive }),
  }));
}

/** 사건 분류를 장면 종류로 옮긴다. 지도의 공개 분류와 같은 낱말이다. */
function sceneKindOf(kind: SituationEvent["kind"]): U5SceneKind {
  return kind === "merchant" ? "merchant" : kind === "rest" ? "rest" : kind === "special" ? "special" : "monster";
}

/**
 * 진행 화면 View 를 만든다.
 *
 * 조언 순서는 `E2` 가 정한다. 화면이 다시 섞지 않는다. `ChoiceId` 도 넘기지
 * 않는다 — ID 가 `-help`·`-harm` 으로 끝나 정답이 새기 때문이다.
 */
export function progressViewFor(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
): U5ProgressView | null {
  const event = active.pendingEvent;
  if (event === null) return null;

  const dungeon = campaign.dungeons.find((candidate) => candidate.id === active.expedition.dungeonId);
  if (dungeon === undefined) throw new Error(`원정 던전을 찾을 수 없다: ${active.expedition.dungeonId}`);

  const depth = active.expedition.map.layers
    .findIndex((layer) => layer.nodeIds.includes(active.expedition.currentNodeId));
  const presented = presentShuffledAdvice({
    campaignSeed: campaign.seed,
    dungeonId: dungeon.id,
    attempt: dungeon.attempts,
    depth: depth < 0 ? 0 : depth,
    event,
  });

  return {
    dungeonName: dungeon.name,
    theme: dungeon.theme,
    sceneKind: sceneKindOf(event.kind),
    nodeLabel: event.title,
    situation: event.description,
    advice: toAdviceViews(presented),
    outcome: null,
    party: partyViewsFor(active.partyMembers),
  };
}

/**
 * 화면이 고른 슬롯을 조언 ID 로 옮긴다.
 *
 * 화면은 슬롯 번호만 안다. 이 함수가 유일한 통로다.
 */
export function adviceIdForSlotIn(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
  slot: number,
): SituationEvent["advice"][number]["id"] {
  const event = active.pendingEvent;
  if (event === null) throw new Error("조언을 고를 사건이 없다");
  const dungeon = campaign.dungeons.find((candidate) => candidate.id === active.expedition.dungeonId);
  if (dungeon === undefined) throw new Error(`원정 던전을 찾을 수 없다: ${active.expedition.dungeonId}`);
  const depth = active.expedition.map.layers
    .findIndex((layer) => layer.nodeIds.includes(active.expedition.currentNodeId));
  const presented = presentShuffledAdvice({
    campaignSeed: campaign.seed,
    dungeonId: dungeon.id,
    attempt: dungeon.attempts,
    depth: depth < 0 ? 0 : depth,
    event,
  });
  const chosen = presented[slot];
  if (chosen === undefined) throw new Error(`조언 슬롯이 없다: ${slot}`);
  return chosen.id;
}

/** 공개된 생태 규칙과 관찰 단서. 숨은 규칙을 자동으로 정답 처리하지 않는다. */
export function ecologyViewFor(campaign: CampaignState, active: ActiveExpeditionContext): U5EcologyView {
  const theme = themeOf(campaign, active);
  const text = new Map(theme.rules.map((rule) => [rule.id, rule.text]));
  return {
    disclosedRules: active.expedition.disclosedRuleIds.map((id) => text.get(id) ?? String(id)),
    observedClues: [],
  };
}

