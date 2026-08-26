import { DENOUNCE_THRESHOLD } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { countEmergencyEligibleAdventurers, countLivingZeroTrust } from "@/lib/rules/ending";
import { executeGuidePromotion, getGuidePromotionEligibility } from "@/lib/rules/promotion";
import { createBoardOffers } from "@/lib/rules/board";
import { createBattleAbilityUsesForParty } from "@/lib/rules/battle-ability-state";
import { CLASSES } from "@/lib/content/classes";
import { generateDungeonMap } from "@/lib/rules/dungeon-map";
import type {
  BattleAbilityUsesRemaining,
  CampaignState,
  Character,
  EventKind,
  GeneratedMap,
  NodeId,
} from "@/lib/domain";
import type { TopStatusView } from "./TopStatusBar";
import { createU4DungeonMapLayout, type U4MapLayout } from "./u4-dungeon-map-layout";
import {
  createU4MapNodeViews,
  createU4PartyMemberViews,
  type U4MapNodeView,
  type U4PartyMemberView,
} from "./u4-dungeon-map-model";

const PREVIEW_SEED = "u4-dungeon-map-preview";
const TARGET_WIDTHS = [2, 3, 5, 4, 3, 2, 2] as const;
const PUBLIC_KIND_CYCLE: readonly EventKind[] = [
  "monster",
  "rest",
  "merchant",
  "special",
];

export interface U4PreviewData {
  status: TopStatusView;
  dungeonName: string;
  riskLevel: 3;
  map: GeneratedMap;
  nodes: readonly U4MapNodeView[];
  layout: U4MapLayout;
  party: readonly U4PartyMemberView[];
  battleAbilityUsesRemainingByCharacterId: BattleAbilityUsesRemaining;
  currentNodeId: NodeId;
  visitedNodeIds: readonly NodeId[];
  publicKindByNodeId: Readonly<Partial<Record<NodeId, EventKind>>>;
  selectedNextNodeId: NodeId | null;
}

function riskThreePreviewCampaign(): CampaignState {
  const campaign = initializeCampaign(PREVIEW_SEED);
  /*
   * 등급을 손으로 적지 않는다.
   *
   * ★3 공고를 보려면 C 등급으로는 안 된다. 전에는 `rank: "B"` 와 `reputation: 75`
   * 를 그냥 써넣었다. 대신 `C5` 가 정한 요구 명성을 채우고 실제로 승급시킨다.
   * 요구치가 바뀌면 여기가 따라간다.
   */
  const eligibility = getGuidePromotionEligibility(campaign);
  if (eligibility === null) return { ...campaign, phase: "board" };
  const funded: CampaignState = { ...campaign, phase: "board", reputation: eligibility.reputationRequired };
  return executeGuidePromotion(funded, "reputation").campaign;
}

function findRiskThreeMap(
  campaign: CampaignState,
  dungeonId: CampaignState["dungeons"][number]["id"],
): GeneratedMap {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const map = generateDungeonMap({
      campaignSeed: campaign.seed,
      dungeonId,
      initialRiskLevel: 3,
      attempt,
    });
    const widths = map.layers.map((layer) => layer.nodeIds.length);
    if (
      widths.length === TARGET_WIDTHS.length &&
      widths.every((width, index) => width === TARGET_WIDTHS[index])
    ) {
      return map;
    }
  }
  throw new Error("U4 preview에서 risk3-c E1 지도를 찾지 못했습니다.");
}

function publicKindsForMap(
  map: GeneratedMap,
): Readonly<Partial<Record<NodeId, EventKind>>> {
  const result: Partial<Record<NodeId, EventKind>> = {};
  let index = 0;
  for (const layer of map.layers) {
    for (const nodeId of layer.nodeIds) {
      result[nodeId] = PUBLIC_KIND_CYCLE[index % PUBLIC_KIND_CYCLE.length];
      index += 1;
    }
  }
  return result;
}

function partyCharacters(
  campaign: CampaignState,
  memberIds: readonly Character["id"][],
  deadPreview: boolean,
): readonly Character[] {
  return memberIds.map((memberId, index) => {
    const character = campaign.pool.byId[memberId];
    if (character === undefined) {
      throw new Error(`U4 preview 파티원을 찾지 못했습니다: ${memberId}`);
    }
    if (!deadPreview || index !== 1) return character;
    return {
      ...character,
      alive: false,
      hp: 0,
      gravelyWounded: true,
    };
  });
}

export function createU4PreviewData(input: {
  deadPreview: boolean;
}): U4PreviewData {
  const campaign = riskThreePreviewCampaign();
  const offers = createBoardOffers(campaign);
  const offer = offers.find(
    (candidate) => candidate.riskLevel === 3 && candidate.lockReason === null,
  );
  if (offer === undefined) {
    throw new Error("U4 preview용 ★3 실제 게시판 공고를 찾지 못했습니다.");
  }

  const dungeon = campaign.dungeons.find(
    (candidate) => candidate.id === offer.dungeonId,
  );
  if (dungeon === undefined) {
    throw new Error(`U4 preview 던전을 찾지 못했습니다: ${offer.dungeonId}`);
  }

  const map = findRiskThreeMap(campaign, dungeon.id);
  const publicKindByNodeId = publicKindsForMap(map);
  const currentNodeId = map.entryNodeId;
  const visitedNodeIds: readonly NodeId[] = [];
  const nodes = createU4MapNodeViews({
    map,
    currentNodeId,
    visitedNodeIds,
    publicKindByNodeId,
  });
  const layout = createU4DungeonMapLayout(map);
  const partyMembers = partyCharacters(campaign, offer.party.memberIds, input.deadPreview);
  const battleAbilityUsesRemainingByCharacterId = createBattleAbilityUsesForParty({
    members: partyMembers,
    classDefs: CLASSES,
  });
  const party = createU4PartyMemberViews(
    partyMembers,
    battleAbilityUsesRemainingByCharacterId,
  );
  const selectedNextNodeId =
    nodes.find((node) => node.state === "selectable")?.id ?? null;

  const eligibility = getGuidePromotionEligibility(campaign);
  const status: TopStatusView = {
    rank: campaign.rank,
    reputation: campaign.reputation,
    gold: campaign.gold,
    canPromote: eligibility !== null && (eligibility.canPromoteByReputation || eligibility.canPromoteByGold),
    remainingAdventurers: countEmergencyEligibleAdventurers(campaign),
    remainingDungeons: campaign.dungeons.filter(
      (candidate) => candidate.status !== "cleared",
    ).length,
    zeroTrust: {
      livingCount: countLivingZeroTrust(campaign),
      threshold: DENOUNCE_THRESHOLD,
    },
    /* 요구 명성은 `C5` 가 안다. 전에는 120 이 화면에 복사돼 있었다. */
    ...(eligibility === null ? {} : {
      nextPromotion: { rank: eligibility.toRank, reputationRequired: eligibility.reputationRequired },
    }),
    currentDungeon: {
      name: dungeon.name,
      riskLevel: dungeon.riskLevel,
    },
  };

  return {
    status,
    dungeonName: dungeon.name,
    riskLevel: 3,
    map,
    nodes,
    layout,
    party,
    battleAbilityUsesRemainingByCharacterId,
    currentNodeId,
    visitedNodeIds,
    publicKindByNodeId,
    selectedNextNodeId,
  };
}
