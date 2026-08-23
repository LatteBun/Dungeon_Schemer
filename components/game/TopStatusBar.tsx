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
  onClick?: () => void;
  testId?: string;
  available?: boolean;
}

function StatusItem({ label, value, iconSrc, onClick, testId, available = false }: StatusItemProps) {
  const content = (
    <>
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
    </>
  );

  if (onClick === undefined) {
    return <div className="game-shell__status-item game-shell__status-chip">{content}</div>;
  }

  return (
    <button
      type="button"
      className={`game-shell__status-item game-shell__status-chip game-shell__status-chip--action${available ? " is-available" : ""}`}
      data-testid={testId}
      data-promotion-available={available ? "true" : "false"}
      aria-label={`${label}: ${value}`}
      disabled={!available}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

interface TopStatusBarProps {
  status: TopStatusView;
  onOpenPromotion?: () => void;
}

export function TopStatusBar({ status, onOpenPromotion }: TopStatusBarProps) {
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
          onClick={onOpenPromotion}
          testId="u3-promotion-trigger"
          available={status.canPromote}
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
