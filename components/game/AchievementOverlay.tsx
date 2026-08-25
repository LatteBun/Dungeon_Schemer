"use client";

import { useEffect, useRef } from "react";
import { Achievements } from "./AchievementScreen";

interface OverlayDialogElement {
  readonly open: boolean;
  showModal(): void;
  close(): void;
}

interface CancelEvent {
  preventDefault(): void;
}

export function showAchievementOverlayModal(dialog: OverlayDialogElement): () => void {
  if (!dialog.open) dialog.showModal();
  return () => {
    if (dialog.open) dialog.close();
  };
}

export function handleAchievementOverlayCancel(event: CancelEvent, onClose: () => void): void {
  event.preventDefault();
  onClose();
}

export function AchievementOverlay({ onClose }: { readonly onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    return showAchievementOverlayModal(dialog);
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="app-frame__achievement-dialog"
      aria-label="길잡이 업적 기록"
      aria-modal="true"
      onCancel={(event) => handleAchievementOverlayCancel(event, onClose)}
    >
      <Achievements backAction={{ kind: "button", onActivate: onClose }} />
    </dialog>
  );
}
