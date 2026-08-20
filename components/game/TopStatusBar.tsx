import type { ReactNode } from "react";

export interface TopStatusView {
  rank: string;
  reputation: number;
  gold: number;
  canPromote: boolean;
  remainingDungeons: number;
  currentDungeon?: {
    name: string;
    riskLevel: number;
  };
}

interface StatusItemProps {
  label: string;
  value: ReactNode;
}

function StatusItem({ label, value }: StatusItemProps) {
  return (
    <div className="game-shell__status-item">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-parchment">{value}</dd>
    </div>
  );
}

interface TopStatusBarProps {
  status: TopStatusView;
}

export function TopStatusBar({ status }: TopStatusBarProps) {
  const promotionLabel = status.canPromote
    ? "✓ 승급 가능"
    : "— 승급 조건 미달";

  return (
    <header
      className="game-shell__status-bar"
      data-testid="game-shell-status-bar"
      aria-label="캠페인 상태"
    >
      <h2 className="sr-only">캠페인 상태</h2>
      <dl className="game-shell__status-list">
        <StatusItem label="등급" value={status.rank} />
        <StatusItem label="명성" value={status.reputation} />
        <StatusItem label="골드" value={status.gold} />
        <StatusItem label="승급" value={promotionLabel} />
        <StatusItem label="남은 던전" value={status.remainingDungeons} />
        {status.currentDungeon === undefined ? null : (
          <StatusItem
            label="현재 던전"
            value={`${status.currentDungeon.name} ★${status.currentDungeon.riskLevel}`}
          />
        )}
      </dl>
    </header>
  );
}
