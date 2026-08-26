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
import { collectStorageDiagnostics, type StorageDiagnosticSnapshot } from "@/lib/diagnostics/local-storage-diagnostics";
import { AchievementStorageDiagnostics } from "./AchievementStorageDiagnostics";
import { advanceDiagnosticTrigger, initialDiagnosticTriggerState } from "./achievement-storage-trigger";

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

export type AchievementBackAction =
  | { readonly kind: "link"; readonly href: string }
  | { readonly kind: "button"; readonly onActivate: () => void };

const HIDDEN_TITLE = "???";
const HIDDEN_DESCRIPTION = "조건을 달성하면 기록이 공개됩니다.";

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
  /*
   * 잘 되고 있을 때는 아무 말도 하지 않는다.
   *
   * 「길드 기록은 이 브라우저에 보관됩니다」 는 늘 떠 있어 제목 아래 한 줄을
   * 차지했는데, 길잡이가 할 일도 알 일도 아니다. 불러오지 못했거나 저장할 수
   * 없을 때만 말한다.
   */
  return "";
}

export interface AchievementScreenProps {
  readonly cards: readonly AchievementCardView[];
  readonly unlockedCount: number;
  readonly status: AchievementScreenStatus;
  readonly message: string | null;
  readonly backAction: AchievementBackAction;
  readonly confirming?: boolean;
  readonly onRequestClear?: () => void;
  readonly onCancelClear?: () => void;
  readonly onClear: () => void;
  readonly onActivateDiagnostics?: () => void;
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
      <div className={`achievement-card__image${card.unlocked ? "" : " is-obscured"}`}>
        <Image src={card.imageSrc} alt={imageAlt} fill sizes="25rem" style={{ objectFit: "contain" }} />
        {!card.unlocked ? (
          <span className="achievement-card__lock" aria-hidden="true">
            <svg viewBox="0 0 64 72" focusable="false">
              <path d="M18 30v-9a14 14 0 0 1 28 0v9h-7v-9a7 7 0 0 0-14 0v9Z" />
              <rect x="9" y="28" width="46" height="36" rx="6" />
              <circle cx="32" cy="45" r="5" />
              <path d="m29 49-2 9h10l-2-9Z" />
            </svg>
          </span>
        ) : null}
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
  backAction,
  confirming = false,
  onRequestClear,
  onCancelClear,
  onClear,
  onActivateDiagnostics,
}: AchievementScreenProps) {
  return (
    /*
      * 캠페인 화면과 같은 뼈대를 쓴다.
      *
      * 이 화면은 캠페인 바깥이라 상단 상태 바가 없다. 그래서 셸을 통째로 쓸 수는
      * 없지만, 바탕과 제목과 덩어리는 같은 어휘를 쓴다 — 그러지 않으면 게임에서
      * 나갔다가 다른 앱에 들어온 것처럼 보인다.
      */
    <main className="game-shell achievement-screen">
      <header className="achievement-screen__header">
        <div>
          <p>길드 기록 보관소</p>
          <h1>길잡이 업적 기록</h1>
          <span role="status">{statusNotice(status, message)}</span>
        </div>
        <button type="button" className="game-shell__status-chip achievement-screen__count" onClick={onActivateDiagnostics}>
          달성 <strong>{unlockedCount}</strong> / {cards.length}
        </button>
      </header>

      <section
        className="panel-section game-shell__surface achievement-screen__gallery"
        aria-label="업적 카드 목록"
      >
        {cards.map((card) => <AchievementCard key={card.id} card={card} />)}
      </section>

      <footer className="achievement-screen__actions">
        {backAction.kind === "link" ? (
          <Link className="shell-cta" href={backAction.href}>이전 화면으로</Link>
        ) : (
          <button className="shell-cta" type="button" onClick={backAction.onActivate}>
            이전 화면으로
          </button>
        )}
        <button className="shell-cta" type="button" onClick={onRequestClear}>업적 기록 초기화</button>
      </footer>

      {confirming ? <ResetConfirmationDialog onCancelClear={onCancelClear} onClear={onClear} /> : null}
    </main>
  );
}

export function Achievements({ backAction }: { readonly backAction: AchievementBackAction }) {
  const progress = usePlayerProgressStore((state) => state.progress);
  const status = usePlayerProgressStore((state) => state.status);
  const message = usePlayerProgressStore((state) => state.message);
  const clear = usePlayerProgressStore((state) => state.clear);
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef(initialDiagnosticTriggerState());
  const [diagnostics, setDiagnostics] = useState<StorageDiagnosticSnapshot | null>(null);
  const [confirmingCampaignClear, setConfirmingCampaignClear] = useState(false);

  return (
    <>
      <AchievementScreen
        cards={achievementCardViewsFor(progress)}
        unlockedCount={unlockedAchievementCount(progress)}
        status={status}
        message={message}
        backAction={backAction}
        confirming={confirming}
        onRequestClear={() => setConfirming(true)}
        onCancelClear={() => setConfirming(false)}
        onActivateDiagnostics={() => {
          const advanced = advanceDiagnosticTrigger(trigger.current, performance.now());
          trigger.current = advanced.state;
          if (!advanced.open) return;
          setDiagnostics(collectStorageDiagnostics(window.localStorage, {
            collectedAt: new Date().toISOString(),
            userAgent: window.navigator.userAgent,
          }));
        }}
        onClear={() => {
          clear();
          setConfirming(false);
        }}
      />
      {diagnostics === null ? null : (
        <AchievementStorageDiagnostics
          snapshot={diagnostics}
          copyStatus="idle"
          confirmingClear={confirmingCampaignClear}
          onCopy={() => {}}
          onRequestClear={() => setConfirmingCampaignClear(true)}
          onCancelClear={() => setConfirmingCampaignClear(false)}
          onConfirmClear={() => {}}
          onClose={() => {
            setConfirmingCampaignClear(false);
            setDiagnostics(null);
          }}
        />
      )}
    </>
  );
}
