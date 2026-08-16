"use client";

import { useState } from "react";
import { Board } from "@/components/game/Board";
import { CampaignHeader } from "@/components/game/CampaignHeader";
import { ContractPanel } from "@/components/game/ContractPanel";
import {
  toBoardView,
  toCampaignHeaderView,
  toContractView,
} from "@/components/game/campaign-view-model";
import type { BoardOfferId } from "@/lib/domain";
import { initialBoardState, midCampaignState } from "./u1-fixtures";

const FIXTURES = {
  initial: { label: "초기(등급 C · 전부 지원 가능)", state: initialBoardState() },
  mid: { label: "중반(등급 B · 다양한 상태)", state: midCampaignState() },
} as const;

type FixtureKey = keyof typeof FIXTURES;

export default function U1TestPage() {
  const [fixtureKey, setFixtureKey] = useState<FixtureKey>("mid");
  const [selectedOfferId, setSelectedOfferId] = useState<BoardOfferId | null>(null);
  const [accepted, setAccepted] = useState<string | null>(null);

  const state = FIXTURES[fixtureKey].state;
  const contract =
    selectedOfferId === null ? null : toContractView(state, selectedOfferId, null);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-3 p-4 text-parchment">
      <div className="flex gap-2">
        {(Object.keys(FIXTURES) as FixtureKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFixtureKey(key);
              setSelectedOfferId(null);
              setAccepted(null);
            }}
            className={`rounded border px-3 py-1 text-xs ${
              key === fixtureKey ? "border-trust-up bg-edge" : "border-edge"
            }`}
          >
            {FIXTURES[key].label}
          </button>
        ))}
      </div>

      <CampaignHeader title="캠페인 게시판" view={toCampaignHeaderView(state)} />

      <div className="grid gap-3 md:grid-cols-2">
        <Board
          offers={toBoardView(state, new Map())}
          selectedOfferId={selectedOfferId}
          onSelectOffer={setSelectedOfferId}
          onAcceptContract={(offerId) =>
            setAccepted(`수락됨: ${offerId} (실 전이는 I1에서 연결)`)
          }
        />
        <ContractPanel contract={contract} />
      </div>

      {accepted === null ? null : (
        <p className="text-xs text-trust-up">{accepted}</p>
      )}
    </main>
  );
}
