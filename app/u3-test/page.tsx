"use client";

import { useMemo, useState } from "react";
import { BossResultPanel } from "@/components/game/BossResultPanel";
import { CampaignHeader } from "@/components/game/CampaignHeader";
import { EndingPanel } from "@/components/game/EndingPanel";
import { SettlementTimeline } from "@/components/game/SettlementTimeline";
import {
  toBossResultView,
  toEndingView,
  toSettlementTimelineView,
} from "@/components/game/settlement-view-model";
import { completedCampaignOutcome, runOneExpedition } from "./u3-fixtures";

type Tab = "settlement" | "ending";

const SEED = "u3-demo";

export default function U3TestPage() {
  const settlement = useMemo(() => runOneExpedition(SEED), []);
  const completed = useMemo(() => completedCampaignOutcome(SEED), []);
  const [tab, setTab] = useState<Tab>("settlement");

  const outcome = tab === "settlement" ? settlement : completed;
  const endingView = toEndingView(outcome.stateAfter, outcome.ending);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-3 p-4 text-parchment">
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={tab === "settlement"}
          onClick={() => setTab("settlement")}
          className={`rounded border px-3 py-1 text-xs ${
            tab === "settlement" ? "border-trust-up bg-edge" : "border-edge"
          }`}
        >
          정산(보스전 결과 · 원인 사슬)
        </button>
        <button
          type="button"
          aria-pressed={tab === "ending"}
          onClick={() => setTab("ending")}
          className={`rounded border px-3 py-1 text-xs ${
            tab === "ending" ? "border-trust-up bg-edge" : "border-edge"
          }`}
        >
          엔딩(원정 종료)
        </button>
      </div>

      <CampaignHeader title="U3 하네스 · 정산·엔딩" view={outcome.headerView} />

      {tab === "settlement" ? (
        <>
          <BossResultPanel
            view={toBossResultView(outcome.bossResolution, outcome.membersBefore)}
          />
          <SettlementTimeline steps={toSettlementTimelineView(outcome.steps)} />
          {endingView === null ? (
            <p className="text-xs text-muted">
              엔딩이 판정되지 않았다. 캠페인은 다음 게시판으로 이어진다.
            </p>
          ) : null}
        </>
      ) : endingView === null ? (
        <p className="text-sm text-muted">엔딩을 만들지 못했다.</p>
      ) : (
        <EndingPanel view={endingView} onRestart={() => {}} />
      )}
    </main>
  );
}
