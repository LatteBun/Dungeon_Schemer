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

export function CampaignCompletionRecorder({ campaign }: { readonly campaign: CampaignState }) {
  const [runId] = useState(createCampaignRunId);
  const record = usePlayerProgressStore((state) => state.record);

  useEffect(() => {
    recordCampaignCompletion(campaign, runId, record, new Date().toISOString());
  }, [campaign, record, runId]);

  return null;
}
