"use client";

import { useEffect, useState } from "react";
import type { CampaignState } from "@/lib/domain";
import {
  completedCampaignRecordFor,
  createCampaignRunId,
} from "@/lib/achievements/completed-campaign";
import { usePlayerProgressStore } from "./PlayerProgressProvider";

export function CampaignCompletionRecorder({ campaign }: { readonly campaign: CampaignState }) {
  const [runId] = useState(createCampaignRunId);
  const record = usePlayerProgressStore((state) => state.record);

  useEffect(() => {
    const completed = completedCampaignRecordFor(campaign, runId);
    if (completed !== null) record(completed, new Date().toISOString());
  }, [campaign, record, runId]);

  return null;
}
