import { Panel } from "@/components/ui/Panel";
import type { EndingView } from "./settlement-view-model";

interface EndingPanelProps {
  view: EndingView;
  onRestart: () => void;
}

export function EndingPanel({ view, onRestart }: EndingPanelProps) {
  const summary = view.summary;

  return (
    <div className="flex flex-col gap-3">
      <header className="text-center">
        <p className="text-xs text-muted">시드 {summary.seed}</p>
        <h2 className="mt-1 text-4xl font-semibold text-parchment">
          {view.endingLabel}
        </h2>
        <p className="mt-2 text-sm text-muted">{view.reason}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <Panel title="최종 영구 길잡이 등급">
          <p className="text-center text-6xl font-semibold text-trust-up">
            {view.finalRank}
          </p>
          <p className="mt-2 text-center text-xs text-muted">
            승급 점수 {view.promotionScore}
            {view.nextGrade === null
              ? " · 최고 등급"
              : ` · 다음 ${view.nextGrade.grade} ${view.nextGrade.threshold}`}
          </p>
        </Panel>

        <Panel title="캠페인 요약">
          <ul className="grid gap-1 text-xs text-muted sm:grid-cols-2">
            <li>클리어 던전 {summary.clearedDungeons} / {summary.totalDungeons}</li>
            <li>완성 파티 {summary.completeParties}팀</li>
            <li>생존 용사 {summary.aliveMembers}명 · 생존률 {summary.survivalRate}%</li>
            <li>사망 용사 {summary.deadMembers}명</li>
            <li>최종 명성 {summary.finalReputation}</li>
            <li>골드 {summary.currentGold} / 누적 {summary.cumulativeGold}</li>
          </ul>
        </Panel>
      </div>

      <Panel title="캠페인 회고">
        <p className="text-center text-sm text-parchment">{view.retrospective}</p>
      </Panel>

      <button
        type="button"
        onClick={onRestart}
        className="rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge"
      >
        새 캠페인 시작 →
      </button>
    </div>
  );
}
