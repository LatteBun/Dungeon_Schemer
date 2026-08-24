"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePlayerProgressStore } from "@/components/game/PlayerProgressProvider";
import {
  ACHIEVEMENT_CATALOG,
  achievementProgressFor,
  unlockedAchievementCount,
} from "@/lib/achievements/player-progress";
import type { AchievementId, PlayerProgressV1 } from "@/lib/achievements/player-progress";

export interface AchievementCardView {
  readonly id: AchievementId;
  readonly title: string;
  readonly description: string;
  readonly categoryLabel: "결과 기록" | "누적 기록";
  readonly imageSrc: string;
  readonly unlocked: boolean;
  readonly unlockedAt: string | null;
  readonly progress: { readonly current: number; readonly target: number } | null;
}

export type AchievementScreenStatus = "loading" | "ready" | "recovered" | "unavailable";

const HIDDEN_TITLE = "알 수 없는 기록";
const HIDDEN_DESCRIPTION = "아직 드러나지 않은 길드 기록입니다.";

export function achievementCardViewsFor(progress: PlayerProgressV1): readonly AchievementCardView[] {
  return ACHIEVEMENT_CATALOG.map((achievement) => {
    const unlock = progress.unlocked[achievement.id];
    const unlocked = unlock !== undefined;
    const hidden = !unlocked && achievement.hiddenWhenLocked;

    return {
      id: achievement.id,
      title: hidden ? HIDDEN_TITLE : achievement.title,
      description: hidden ? HIDDEN_DESCRIPTION : achievement.description,
      categoryLabel: achievement.category === "result" ? "결과 기록" : "누적 기록",
      imageSrc: achievement.imageSrc,
      unlocked,
      unlockedAt: unlock?.unlockedAt ?? null,
      progress: hidden ? null : achievementProgressFor(progress, achievement.id),
    };
  });
}

export function formatAchievementDate(iso: string): string {
  const date = new Date(iso);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}. ${month}. ${day}.`;
}

function statusNotice(status: AchievementScreenStatus, message: string | null): string {
  if (message !== null) return message;
  if (status === "loading") return "업적 기록을 불러오는 중입니다.";
  if (status === "recovered") return "업적 기록을 복구했습니다.";
  if (status === "unavailable") return "이 브라우저에서는 업적 기록을 저장할 수 없습니다.";
  return "길드 기록은 이 브라우저에 보관됩니다.";
}

export interface AchievementScreenProps {
  readonly cards: readonly AchievementCardView[];
  readonly unlockedCount: number;
  readonly status: AchievementScreenStatus;
  readonly message: string | null;
  readonly confirming?: boolean;
  readonly onRequestClear?: () => void;
  readonly onCancelClear?: () => void;
  readonly onClear: () => void;
}

interface ResetDialogElement {
  readonly open: boolean;
  showModal(): void;
  close(): void;
}

interface CancelEvent {
  preventDefault(): void;
}

export function showResetDialogModal(dialog: ResetDialogElement): () => void {
  if (!dialog.open) dialog.showModal();
  return () => {
    if (dialog.open) dialog.close();
  };
}

export function handleResetDialogCancel(event: CancelEvent, onCancelClear?: () => void): void {
  event.preventDefault();
  onCancelClear?.();
}

function AchievementCard({ card }: { readonly card: AchievementCardView }) {
  const stateLabel = card.unlocked ? "달성 완료" : "미달성";
  const imageAlt = card.title === HIDDEN_TITLE ? "숨겨진 업적 문양" : `${card.title} 업적 문양`;

  return (
    <article className={`achievement-card ${card.unlocked ? "is-unlocked" : "is-locked"}`}>
      <div className="achievement-card__image">
        <Image src={card.imageSrc} alt={imageAlt} width={1024} height={1024} style={{ objectFit: "contain" }} />
      </div>
      <div className="achievement-card__copy">
        <p className="achievement-card__category">{card.categoryLabel}</p>
        <h2>{card.title}</h2>
        <p className="achievement-card__description">{card.description}</p>
      </div>
      <footer className="achievement-card__footer">
        <p className="achievement-card__state">{stateLabel}</p>
        {card.unlockedAt !== null ? (
          <time dateTime={card.unlockedAt}>달성일 {formatAchievementDate(card.unlockedAt)}</time>
        ) : null}
        {card.progress !== null ? (
          <div className="achievement-card__progress">
            <div
              role="progressbar"
              aria-label={`${card.title} 진행도`}
              aria-valuemin={0}
              aria-valuemax={card.progress.target}
              aria-valuenow={Math.min(card.progress.current, card.progress.target)}
              className="achievement-card__progress-track"
            >
              <span style={{ width: `${Math.min(100, (card.progress.current / card.progress.target) * 100)}%` }} />
            </div>
            <span>{card.progress.current} / {card.progress.target}</span>
          </div>
        ) : null}
      </footer>
    </article>
  );
}

function ResetConfirmationDialog({
  onCancelClear,
  onClear,
}: {
  readonly onCancelClear?: () => void;
  readonly onClear: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    return showResetDialogModal(dialog);
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="achievement-screen__dialog"
      aria-modal="true"
      aria-labelledby="achievement-clear-title"
      onCancel={(event) => handleResetDialogCancel(event, onCancelClear)}
    >
      <h2 id="achievement-clear-title">업적 기록 초기화</h2>
      <p>이 브라우저에 보관한 업적 기록을 모두 지웁니다. 이 작업은 되돌릴 수 없습니다.</p>
      <div>
        <button type="button" autoFocus onClick={onCancelClear}>취소</button>
        <button type="button" onClick={onClear}>정말 초기화</button>
      </div>
    </dialog>
  );
}

export function AchievementScreen({
  cards,
  unlockedCount,
  status,
  message,
  confirming = false,
  onRequestClear,
  onCancelClear,
  onClear,
}: AchievementScreenProps) {
  return (
    <main className="achievement-screen">
      <header className="achievement-screen__header">
        <div>
          <p>길드 기록 보관소</p>
          <h1>길잡이 업적 기록</h1>
          <span role="status">{statusNotice(status, message)}</span>
        </div>
        <p className="achievement-screen__count">달성 <strong>{unlockedCount}</strong> / {cards.length}</p>
      </header>

      <section className="achievement-screen__gallery" aria-label="업적 카드 목록">
        {cards.map((card) => <AchievementCard key={card.id} card={card} />)}
      </section>

      <footer className="achievement-screen__actions">
        <Link href="/">메인 메뉴로</Link>
        <button type="button" onClick={onRequestClear}>업적 기록 초기화</button>
      </footer>

      {confirming ? <ResetConfirmationDialog onCancelClear={onCancelClear} onClear={onClear} /> : null}
    </main>
  );
}

export function Achievements() {
  const progress = usePlayerProgressStore((state) => state.progress);
  const status = usePlayerProgressStore((state) => state.status);
  const message = usePlayerProgressStore((state) => state.message);
  const clear = usePlayerProgressStore((state) => state.clear);
  const [confirming, setConfirming] = useState(false);

  return (
    <AchievementScreen
      cards={achievementCardViewsFor(progress)}
      unlockedCount={unlockedAchievementCount(progress)}
      status={status}
      message={message}
      confirming={confirming}
      onRequestClear={() => setConfirming(true)}
      onCancelClear={() => setConfirming(false)}
      onClear={() => {
        clear();
        setConfirming(false);
      }}
    />
  );
}
