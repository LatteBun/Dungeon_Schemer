import { StatValue } from "@/components/ui/StatValue";
import type { CampaignHeaderView } from "./campaign-view-model";

interface CampaignHeaderProps {
  view: CampaignHeaderView;
}

/**
 * 캠페인 공통 HUD. 영구 등급과 현재 명성을 다른 그룹으로 나눠
 * 명성이 내려가도 등급이 유지된다는 원칙을 시각적으로 구분한다.
 */
export function CampaignHeader({ view }: CampaignHeaderProps) {
  const promotionText =
    view.nextGrade === null
      ? "최고 등급"
      : `${view.promotionScore} / ${view.nextGrade.grade} ${view.nextGrade.threshold}`;

  return (
    <header className="flex flex-wrap items-stretch gap-2">
      <div className="rounded border border-edge bg-panel px-3 py-2">
        <StatValue label="영구 등급" value={view.rank} />
      </div>
      <div className="rounded border border-edge bg-panel px-3 py-2">
        <StatValue label="현재 명성" value={view.currentReputation} />
      </div>
      <div className="rounded border border-edge bg-panel px-3 py-2">
        <StatValue
          label="골드"
          value={`${view.currentGold} / ${view.cumulativeGold}`}
        />
      </div>
      <div className="rounded border border-edge bg-panel px-3 py-2">
        <StatValue label="승급" value={promotionText} />
      </div>
      <div className="rounded border border-edge bg-panel px-3 py-2">
        <StatValue
          label="남은 던전"
          value={`${view.remainingDungeons} / ${view.totalDungeons}`}
        />
      </div>
    </header>
  );
}
