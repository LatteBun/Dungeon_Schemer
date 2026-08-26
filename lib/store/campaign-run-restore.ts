import { replayRun, type CampaignRunState } from "./campaign-run";
import {
  loadCampaignRun,
  quarantineCampaignRun,
  type SavedCampaignRun,
  type StringStorage,
} from "./campaign-run-storage";

export type RestoreCampaignRunResult =
  | { readonly status: "empty" }
  | { readonly status: "recovered" }
  | { readonly status: "restored"; readonly run: SavedCampaignRun; readonly state: CampaignRunState };

/**
 * 브라우저 저장의 비신뢰 입력 경계다.
 *
 * 정상 저장만 replay 결과를 돌려주고, 읽을 수 없거나 replay가 막힌 저장은 원문을
 * 격리한 뒤 현재 Provider가 만든 새 캠페인을 그대로 쓰게 한다.
 */
export function restoreCampaignRun(storage: StringStorage): RestoreCampaignRunResult {
  const loaded = loadCampaignRun(storage);
  if (loaded.status === "empty") return { status: "empty" };

  if (loaded.status === "unusable") {
    if (loaded.raw !== undefined) {
      quarantineCampaignRun(storage, {
        raw: loaded.raw,
        reason: loaded.reason,
        failedAt: null,
      });
    }
    return { status: "recovered" };
  }

  const replayed = replayRun(loaded.run.seed, loaded.run.actions);
  if (!replayed.ok) {
    quarantineCampaignRun(storage, {
      raw: loaded.raw,
      reason: replayed.reason,
      failedAt: replayed.failedAt,
    });
    return { status: "recovered" };
  }

  return { status: "restored", run: loaded.run, state: replayed.state };
}
