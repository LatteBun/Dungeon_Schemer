import type { ReactNode } from "react";

export interface TopStatusView {
  rank: string;
  reputation: number;
  gold: number;
  canPromote: boolean;
  remainingDungeons: number;
  zeroTrust: {
    livingCount: number;
    threshold: number;
  };
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
  /*
   * 짧게 적는다.
   *
   * "B까지 명성 30 더" 는 한 칸에 담기에 길어 상태 바가 문장처럼 읽혔다. 옆 칸이
   * 이미 현재 명성을 말하고 있으므로 여기서는 목표 등급과 남은 수만 있으면 된다.
   */
  const promotionLabel = status.canPromote
    ? `${status.nextPromotion?.rank ?? ""} 가능`.trim()
    : status.nextPromotion
      ? `${status.nextPromotion.rank} · ${Math.max(0, status.nextPromotion.reputationRequired - status.reputation)} 남음`
      : "최고";

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
        {/*
          * 올리는 일은 「승급」 칸이 맡는다.
          *
          * 전에는 「길잡이 등급」 칸을 누르면 승급 창이 열렸다. 그 칸은 지금 등급이
          * 무엇인지 말하는 자리이지 무엇을 하는 자리가 아니라, 누를 수 있다는 것을
          * 알아채기 어려웠다. 바로 옆에 「승급」 이라고 적힌 칸이 있는데 그쪽은
          * 눌러도 아무 일이 없었다.
          */}
        <StatusItem
          label="승급"
          value={promotionLabel}
          iconSrc="/assets/u2/status-promotion.svg"
          onClick={canOpenPromotion ? onOpenPromotion : undefined}
          testId={canOpenPromotion ? "u3-promotion-trigger" : undefined}
          available={status.canPromote}
        />
        <StatusItem
          label="신뢰 0"
          value={`${status.zeroTrust.livingCount} / ${status.zeroTrust.threshold}`}
          iconSrc="/assets/u2/status-trust.svg"
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
