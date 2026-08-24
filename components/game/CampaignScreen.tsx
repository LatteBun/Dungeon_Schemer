"use client";

import { useState } from "react";
import type { NodeId, PromotionMethod } from "@/lib/domain";
import { createExpeditionForOffer, createSettlementSnapshotFor } from "@/lib/rules/campaign-transition";
import { screenForPhase } from "@/lib/store/campaign-store";
import { useCampaignStore } from "./CampaignStoreProvider";
import { IntroScreen } from "./IntroScreen";
import { U3BoardScreen } from "./U3BoardScreen";
import { U4DungeonMapScreen } from "./U4DungeonMapScreen";
import { U5BattleScene } from "./U5BattleScene";
import { U5ProgressScreen } from "./U5ProgressScreen";
import { U6EndingScreen } from "./U6EndingScreen";
import { U6SettlementScreen } from "./U6SettlementScreen";
import {
  adviceIdForSlotIn,
  bossReplayFor,
  ecologyViewFor,
  eventReplayFor,
  logFor,
  progressViewFor,
  publicKindByNodeId,
  statusFor,
} from "./campaign-adapters";
import { createU3BoardView } from "./u3-board-model";
import { createU3PromotionView } from "./u3-promotion-model";
import { createU4MapNodeViews, createU4PartyMemberViews } from "./u4-dungeon-map-model";
import { createU4DungeonMapLayout } from "./u4-dungeon-map-layout";
import { createU6SettlementView } from "./u6-settlement-model";
import { createU6EndingView } from "./u6-ending-adapter";
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
        onSelectOffer={(offerId) => {
          /*
           * 이미 고른 것이 있으면 물러선 뒤에 고른다.
           *
           * 규칙은 `contract` 에서 `SELECT_CONTRACT` 를 받지 않는다 - 계약을
           * 검토하던 중에 대상이 소리 없이 바뀌면 무엇에 서명하는지 알 수 없기
           * 때문이다. 물러서는 것은 길잡이의 몫이고, 공고를 다시 누르는 것이
           * 곧 그 뜻이다. 화면이 그 두 걸음을 대신 밟는다.
           *
           * 이것이 없어서 게시판에서 두 번째 공고가 눌리지 않았다.
           */
          if (context.selectedOffer !== null) {
            if (String(context.selectedOffer.id) === offerId) return;
            dispatch({ type: "CANCEL_CONTRACT" });
          }
          dispatch({ type: "SELECT_CONTRACT", offerId: offerId as never });
        }}
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

  /*
   * 월드턴 동안에도 방금 본 정산이 그대로 서 있어야 한다.
   *
   * `worldTurn` 단계도 정산 화면으로 온다. 그런데 그때는 `last` 가 월드턴 결과로
   * 바뀐 뒤라 `last.settlement` 가 비어 있고, 그러면 「이 단계를 그릴 수 없다」가
   * 뜬다. 지금은 두 액션을 한 핸들러에서 연달아 보내 그 사이에 렌더가 없어
   * 드러나지 않지만, 월드턴이 한 번이라도 거부되면 길잡이가 오류 화면에 갇힌다.
   *
   * `C8-A` 가 정산을 누적하므로 마지막 정산은 통계에 남아 있다. 거기서 읽는다.
   */
  const shownSettlement = last?.settlement ?? campaign.statistics.settlements.at(-1) ?? null;
  if (screen === "settlement" && shownSettlement !== null) {
    const dungeon = campaign.dungeons.find((one) => one.id === shownSettlement.dungeonId);
    return (
      <U6SettlementScreen
        status={status}
        settlement={createU6SettlementView(shownSettlement, dungeon?.name ?? "", dungeon?.theme ?? "spider")}
        onContinue={() => {
          /*
           * 정산을 확인하면 세상이 한 턴 돈다.
           *
           * 월드턴은 두 걸음이다 - 시작하고, 끝낸다. 그 사이에 규칙이 던전 위험도와
           * 인력 보충을 처리한다. 화면은 한 번의 확인으로 둘 다 보낸다.
           */
          dispatch({ type: "START_WORLD_TURN" });
          dispatch({ type: "COMPLETE_WORLD_TURN" });
        }}
      />
    );
  }

  if (screen === "ending" && campaign.ending !== null) {
    return <U6EndingScreen ending={createU6EndingView(campaign, campaign.ending)} />;
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

  /*
   * 원정이 끝났다. 정산으로 넘긴다.
   *
   * 보스전을 치렀거나 도중에 전멸했으면 더 걸을 곳이 없다. 정산 입력은 규칙이
   * 만든다 - 화면이 무엇이 최종 파티인지 판단하지 않는다.
   */
  const finished = active.pendingOutcome === null
    && (active.expedition.bossResult !== null || active.expedition.result !== null);
  if (finished) {
    const replay = bossReplayFor(campaign, active);
    return (
      <ExpeditionEnd
        replay={replay}
        onSettle={() => dispatch({ type: "COMPLETE_EXPEDITION", snapshot: createSettlementSnapshotFor(campaign, active) })}
      />
    );
  }

  /*
   * 고르는 중이거나 결과를 보는 중이다.
   *
   * 둘은 같은 화면의 두 상태다 — 상황도 파티도 그대로 있고, 조언 자리에 결과가
   * 들어선다. 결과를 보는 동안 전투가 있었으면 그것도 함께 재생한다.
   */
  if (active.pendingEvent !== null || active.pendingOutcome !== null) {
    const seeing = active.pendingOutcome !== null;
    return (
      <U5ProgressScreen
        status={status}
        progress={progressViewFor(campaign, active)!}
        log={logFor(campaign, active)}
        ecology={ecologyViewFor(campaign, active)}
        battleReplay={eventReplayFor(campaign, active) ?? undefined}
        onSelectAdvice={seeing ? undefined : (slot) => {
          dispatch({ type: "CHOOSE_ADVICE", adviceId: adviceIdForSlotIn(campaign, active, slot) });
        }}
        onAcknowledge={seeing ? () => dispatch({ type: "ACKNOWLEDGE_OUTCOME" }) : undefined}
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

/**
 * 보스전을 보여 주고 정산으로 넘긴다.
 *
 * 전멸로 끝난 원정에는 보스전이 없다. 그때는 재생할 것이 없으므로 넘어가는 길만
 * 남는다.
 */
function ExpeditionEnd({
  replay,
  onSettle,
}: {
  readonly replay: ReturnType<typeof bossReplayFor>;
  readonly onSettle: () => void;
}) {
  return (
    <div className="u5-battle-host">
      {replay !== null && <U5BattleScene replay={replay} />}
      <button type="button" className="u5-battle-settle" onClick={onSettle}>
        정산으로
      </button>
    </div>
  );
}

function EndingUnavailable({ reason }: { readonly reason: string }) {
  return <p role="status">{reason}</p>;
}
