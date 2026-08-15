"use client";

import { BossResultPanel } from "@/components/game/BossResultPanel";
import { EndingPanel } from "@/components/game/EndingPanel";
import { SettlementTimeline } from "@/components/game/SettlementTimeline";
import {
  toBossResultView,
  toEndingView,
  toSettlementTimelineView,
} from "@/components/game/settlement-view-model";
import { useCampaignStore } from "@/lib/stores/campaign-store-provider";
import { usePhaseGuard } from "../phase-route";
import { useCampaignDispatch } from "../play-campaign-provider";

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
  const dispatch = useCampaignDispatch();
  const matches = usePhaseGuard(["boss", "settlement", "ended"]);
  if (!matches) return null;

  if (campaign.phase === "boss") {
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

  if (campaign.phase === "settlement") {
    return (
      <>
        {lastBossResolution === null || membersBeforeBoss === null ? null : (
          <BossResultPanel
            view={toBossResultView(lastBossResolution, membersBeforeBoss)}
          />
        )}
        {lastSettlementSteps === null ? null : (
          <SettlementTimeline
            steps={toSettlementTimelineView(lastSettlementSteps)}
          />
        )}
        <button
          type="button"
          onClick={() => dispatch({ type: "applySettlement" })}
          className="rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge"
        >
          정산 적용 · 다음 공고 또는 엔딩 →
        </button>
      </>
    );
  }

  const ending = toEndingView(campaign, campaign.ending);
  if (ending === null) {
    throw new Error("엔딩 단계에 엔딩 결과가 없습니다.");
  }
  return <EndingPanel view={ending} />;
}
