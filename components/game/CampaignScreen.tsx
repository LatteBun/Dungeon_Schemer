"use client";

import { useState } from "react";
import type { NodeId, PromotionMethod } from "@/lib/domain";
import { createExpeditionForOffer } from "@/lib/rules/campaign-transition";
import { screenForPhase } from "@/lib/store/campaign-store";
import { useCampaignStore } from "./CampaignStoreProvider";
import { IntroScreen } from "./IntroScreen";
import { U3BoardScreen } from "./U3BoardScreen";
import { U4DungeonMapScreen } from "./U4DungeonMapScreen";
import { U5ProgressScreen } from "./U5ProgressScreen";
import { U6EndingScreen } from "./U6EndingScreen";
import { U6SettlementScreen } from "./U6SettlementScreen";
import {
  adviceIdForSlotIn,
  ecologyViewFor,
  progressViewFor,
  publicKindByNodeId,
  statusFor,
} from "./campaign-adapters";
import { createU3BoardView } from "./u3-board-model";
import { createU3PromotionView } from "./u3-promotion-model";
import { createU4MapNodeViews, createU4PartyMemberViews } from "./u4-dungeon-map-model";
import { createU4DungeonMapLayout } from "./u4-dungeon-map-layout";
import { createU6SettlementView } from "./u6-settlement-model";
import { getGuidePromotionEligibility } from "@/lib/rules/promotion";

/**
 * `phase` 가 화면을 정한다.
 *
 * 화면은 자기가 무엇인지 모른다. props 를 받고 콜백으로 알릴 뿐이다. 뒤로가기로
 * 되살아난 문서도 다시 그릴 때 현재 `phase` 를 보므로, 계약을 맺은 뒤 게시판이
 * `계약 전` 모습으로 되살아나는 일이 없다.
 */
export function CampaignScreen() {
  const campaign = useCampaignStore((state) => state.campaign);
  const context = useCampaignStore((state) => state.context);
  const last = useCampaignStore((state) => state.last);
  const dispatch = useCampaignStore((state) => state.dispatch);

  const screen = screenForPhase(campaign.phase);
  const active = context.activeExpedition;
  const status = statusFor(campaign, active);

  if (screen === "intro") {
    return <IntroScreen status={status} boardHref="#" onEnterBoard={() => dispatch({ type: "OPEN_BOARD" })} />;
  }

  if (screen === "board") {
    return (
      <U3BoardScreen
        status={status}
        board={createU3BoardView(campaign, campaign.offers)}
        selectedOfferId={context.selectedOffer?.id ?? ""}
        promotion={createU3PromotionView(getGuidePromotionEligibility(campaign), campaign.phase, last?.promotion ?? null)}
        onSelectOffer={(offerId) => dispatch({ type: "SELECT_CONTRACT", offerId: offerId as never })}
        onContract={(offerId) => {
          const offer = campaign.offers.find((one) => String(one.id) === offerId);
          if (offer === undefined) return;
          /* 원정 상태는 규칙이 만든다. 화면이 지도를 생성하지 않는다. */
          const built = createExpeditionForOffer(campaign, offer);
          dispatch({ type: "START_EXPEDITION", expeditionId: `${offer.id}:${campaign.worldTurn}`, ...built });
        }}
        onOpenPromotion={() => dispatch({ type: "OPEN_PROMOTION" })}
        onCancelPromotion={() => dispatch({ type: "CANCEL_PROMOTION" })}
        onConfirmPromotion={(method: PromotionMethod) => dispatch({ type: "PROMOTE_GUIDE", method })}
        onDismissPromotionResult={() => dispatch({ type: "CANCEL_PROMOTION" })}
      />
    );
  }

  if (screen === "expedition" && active !== null) {
    return <ExpeditionScreens />;
  }

  if (screen === "settlement" && last?.settlement != null) {
    const dungeon = campaign.dungeons.find((one) => one.id === last.settlement!.dungeonId);
    return (
      <U6SettlementScreen
        status={status}
        settlement={createU6SettlementView(last.settlement, dungeon?.name ?? "", dungeon?.theme ?? "spider")}
      />
    );
  }

  if (screen === "ending" && campaign.ending !== null) {
    return <EndingUnavailable reason="엔딩 View 어댑터가 아직 없다" />;
  }

  return <EndingUnavailable reason={`이 단계를 그릴 수 없다: ${campaign.phase}`} />;
}

/**
 * 원정 안쪽은 `phase` 로 가를 수 없다.
 *
 * 지도와 진행과 전투가 `expedition` 하나 안에서 왕복한다. 무엇을 보여줄지는
 * 사건이 확정됐는지와 보스전을 치렀는지가 정한다.
 */
function ExpeditionScreens() {
  const campaign = useCampaignStore((state) => state.campaign);
  const context = useCampaignStore((state) => state.context);
  const dispatch = useCampaignStore((state) => state.dispatch);
  const [selected, setSelected] = useState<NodeId | null>(null);

  const active = context.activeExpedition!;
  const status = statusFor(campaign, active);
  const dungeon = campaign.dungeons.find((one) => one.id === active.expedition.dungeonId);

  if (active.pendingEvent !== null) {
    return (
      <U5ProgressScreen
        status={status}
        progress={progressViewFor(campaign, active)!}
        log={[]}
        ecology={ecologyViewFor(campaign, active)}
        onSelectAdvice={(slot) => {
          dispatch({ type: "CHOOSE_ADVICE", adviceId: adviceIdForSlotIn(campaign, active, slot) });
        }}
      />
    );
  }

  return (
    <U4DungeonMapScreen
      status={status}
      dungeonName={dungeon?.name ?? ""}
      riskLevel={active.expedition.riskLevel}
      nodes={createU4MapNodeViews({
        map: active.expedition.map,
        currentNodeId: active.expedition.currentNodeId,
        visitedNodeIds: active.expedition.visitedNodeIds,
        publicKindByNodeId: publicKindByNodeId(active),
      })}
      layout={createU4DungeonMapLayout(active.expedition.map)}
      party={createU4PartyMemberViews(active.partyMembers)}
      selectedNextNodeId={selected}
      onSelectNextNode={setSelected}
      onMove={(nodeId) => {
        /*
         * 보스방도 먼저 밟는다. 서 있는 자리에서 바로 들어갈 수 없다.
         *
         * 규칙이 `currentNodeId === bossNodeId` 를 요구한다. 밟는 것과 드는 것을
         * 한 번에 하려다 거부됐고, 재현 검사가 그것을 잡았다.
         */
        dispatch({ type: "VISIT_NODE", nodeId });
        if (nodeId === active.expedition.map.bossNodeId) dispatch({ type: "ENTER_BOSS" });
        setSelected(null);
      }}
    />
  );
}

function EndingUnavailable({ reason }: { readonly reason: string }) {
  return <p role="status">{reason}</p>;
}
