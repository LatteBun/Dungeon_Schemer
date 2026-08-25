"use client";

import { useEffect, useState } from "react";
import type { CampaignState } from "@/lib/domain";
import {
  completedCampaignRecordFor,
  createCampaignRunId,
} from "@/lib/achievements/completed-campaign";
import type { CompletedCampaignRecord } from "@/lib/achievements/player-progress";
import { usePlayerProgressStore } from "./PlayerProgressProvider";

type RecordCampaign = (record: CompletedCampaignRecord, unlockedAt: string) => void;

export function recordCampaignCompletion(
  campaign: CampaignState,
  runId: string,
  record: RecordCampaign,
  unlockedAt: string,
): void {
  const completed = completedCampaignRecordFor(campaign, runId);
  if (completed !== null) record(completed, unlockedAt);
}

export function createCampaignCompletionMount(
  randomUUID: () => string = () => crypto.randomUUID(),
) {
  const runId = createCampaignRunId(randomUUID);
  return {
    record(campaign: CampaignState, record: RecordCampaign, unlockedAt: string): void {
      recordCampaignCompletion(campaign, runId, record, unlockedAt);
    },
  };
}

export function CampaignCompletionRecorder({ campaign }: { readonly campaign: CampaignState }) {
  const [completionMount] = useState(createCampaignCompletionMount);
  const record = usePlayerProgressStore((state) => state.record);

  useEffect(() => {
    completionMount.record(campaign, record, new Date().toISOString());
  }, [campaign, completionMount, record]);

  return null;
}
