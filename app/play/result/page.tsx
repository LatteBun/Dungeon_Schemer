"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BossResultPanel } from "@/components/game/BossResultPanel";
import { CauseChainBand } from "@/components/game/CauseChainBand";
import { EndingPanel } from "@/components/game/EndingPanel";
import { SettlementTimeline } from "@/components/game/SettlementTimeline";
import {
  toBossResultView,
  toEndingView,
  toSettlementTimelineView,
  toCauseChainView,
} from "@/components/game/settlement-view-model";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";
import { ROUTE_BY_PHASE, usePhaseGuard } from "../phase-route";
import { useCampaignDispatch } from "../play-campaign-provider";
import { deriveResultStage } from "./result-stage";

const RESULT_PHASES = ["boss", "settlement", "ended"] as const;
const SETTLEMENT_SUMMARY_PHASES = [
  "boss",
  "settlement",
  "ended",
  "board",
] as const;

export default function ResultPage() {
  const campaign = useCampaignStore((store) => store.campaign);
  const lastBossResolution = useCampaignStore(
    (store) => store.lastBossResolution,
  );
  const lastSettlementSteps = useCampaignStore(
    (store) => store.lastSettlementSteps,
  );
  const membersBeforeBoss = useCampaignStore(
    (store) => store.membersBeforeBoss,
  );
  const startCampaign = useCampaignStore((store) => store.startCampaign);
  const [holdsSettlementSummary, setHoldsSettlementSummary] = useState(false);
  const dispatch = useCampaignDispatch();
  const router = useRouter();
  const stage = deriveResultStage(
    campaign.phase,
    holdsSettlementSummary,
    lastSettlementSteps !== null,
  );
  const matches = usePhaseGuard(
    stage === "settlementSummary"
      ? SETTLEMENT_SUMMARY_PHASES
      : RESULT_PHASES,
  );
  if (!matches) return null;

  if (stage === "bossAction") {
    return (
      <button
        type="button"
        onClick={() => dispatch({ type: "resolveBoss" })}
        className="rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge"
      >
        자동 보스전 해결 →
      </button>
    );
  }

  if (stage === "settlementAction") {
    return (
      <>
        {lastBossResolution === null || membersBeforeBoss === null ? null : (
          <BossResultPanel
            view={toBossResultView(lastBossResolution, membersBeforeBoss)}
          />
        )}
        <button
          type="button"
          onClick={() => {
            setHoldsSettlementSummary(true);
            dispatch({ type: "applySettlement" });
          }}
          className="rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge"
        >
          정산 적용 · 결과 확인 →
        </button>
      </>
    );
  }

  if (stage === "settlementSummary") {
    if (lastSettlementSteps === null) {
      throw new Error("정산 결과 확인 단계에 정산 원인 사슬이 없습니다.");
    }
    return (
      <>
        {lastBossResolution === null || membersBeforeBoss === null ? null : (
          <BossResultPanel
            view={toBossResultView(lastBossResolution, membersBeforeBoss)}
          />
        )}
        <SettlementTimeline
          steps={toSettlementTimelineView(lastSettlementSteps)}
        />
        {(() => {
          const record = campaign.statistics.expeditions.at(-1);
          return record === undefined ? null : (
            <CauseChainBand links={toCauseChainView(record)} />
          );
        })()}
        <button
          type="button"
          onClick={() => {
            setHoldsSettlementSummary(false);
            if (campaign.phase === "board") {
              router.replace(ROUTE_BY_PHASE.board);
            }
          }}
          className="rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge"
        >
          {campaign.phase === "ended"
            ? "캠페인 엔딩 보기 →"
            : "다음 공고 보기 →"}
        </button>
      </>
    );
  }

  if (stage === "redirect") return null;

  const ending = toEndingView(campaign, campaign.ending);
  if (ending === null) {
    throw new Error("엔딩 단계에 엔딩 결과가 없습니다.");
  }
  return (
    <EndingPanel
      view={ending}
      onRestart={() => {
        startCampaign(`${campaign.seed}-next`);
        router.replace(ROUTE_BY_PHASE.board);
      }}
    />
  );
}
