import type { ReactNode } from "react";

export interface TopStatusView {
  rank: string;
  reputation: number;
  gold: number;
  canPromote: boolean;
  remainingDungeons: number;
  nextPromotion?: {
    rank: string;
    reputationRequired: number;
  };
  currentDungeon?: {
    name: string;
    riskLevel: number;
  };
}

interface StatusItemProps {
  label: string;
  value: ReactNode;
  iconSrc?: string;
}

function StatusItem({ label, value, iconSrc }: StatusItemProps) {
  return (
    <div className="game-shell__status-item game-shell__status-chip">
      {iconSrc === undefined ? null : (
        <img
          className="game-shell__status-icon"
          src={iconSrc}
          alt=""
          aria-hidden="true"
          width={24}
          height={24}
        />
      )}
      <div className="game-shell__status-copy">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="text-sm font-semibold tabular-nums text-parchment">{value}</dd>
      </div>
    </div>
  );
}

interface TopStatusBarProps {
  status: TopStatusView;
}

export function TopStatusBar({ status }: TopStatusBarProps) {
  const promotionLabel = status.nextPromotion
    ? `${status.reputation} / ${status.nextPromotion.rank} ${status.nextPromotion.reputationRequired}`
    : status.canPromote
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
        <StatusItem
          label="영구 등급"
          value={status.rank}
          iconSrc="/assets/u2/status-rank.svg"
        />
        <StatusItem
          label="현재 명성"
          value={status.reputation}
          iconSrc="/assets/u2/status-reputation.svg"
        />
        <StatusItem
          label="골드"
          value={status.gold}
          iconSrc="/assets/u2/status-gold.svg"
        />
        <StatusItem
          label="승급"
          value={promotionLabel}
          iconSrc="/assets/u2/status-promotion.svg"
        />
        <StatusItem
          label="남은 던전"
          value={status.remainingDungeons}
          iconSrc="/assets/u3/extracted/status-dungeon.png"
        />
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
