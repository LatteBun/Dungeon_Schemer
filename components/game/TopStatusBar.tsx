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
  const canOpenPromotion = onOpenPromotion !== undefined && status.nextPromotion !== undefined;
  /*
   * 얼마나 남았는지를 적는다.
   *
   * 전에는 "30 / B 60" 이었다. 앞의 30 은 옆 칸의 현재 명성을 되풀이한 것이고,
   * 두 숫자의 관계도 슬래시로는 읽히지 않았다. 알고 싶은 것은 "올릴 수 있는가,
   * 아니면 얼마나 더 필요한가" 하나다.
   */
  const promotionLabel = status.canPromote
    ? `${status.nextPromotion?.rank ?? ""} 승급 가능`.trim()
    : status.nextPromotion
      ? `${status.nextPromotion.rank}까지 명성 ${Math.max(0, status.nextPromotion.reputationRequired - status.reputation)} 더`
      : "최고 등급";

  return (
    <header
      className="game-shell__status-bar"
      data-testid="game-shell-status-bar"
      aria-label="캠페인 상태"
    >
      <h2 className="sr-only">캠페인 상태</h2>
      <dl className="game-shell__status-list">
        <StatusItem
          label="길잡이 등급"
          value={status.rank}
          iconSrc="/assets/u2/status-rank.svg"
          onClick={canOpenPromotion ? onOpenPromotion : undefined}
          testId={canOpenPromotion ? "u3-promotion-trigger" : undefined}
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
