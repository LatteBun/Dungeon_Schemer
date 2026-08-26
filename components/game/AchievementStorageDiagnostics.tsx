"use client";

import { useEffect, useRef } from "react";
import { formatStorageDiagnostics, type StorageDiagnosticSnapshot } from "@/lib/diagnostics/local-storage-diagnostics";

export interface AchievementStorageDiagnosticsProps {
  readonly snapshot: StorageDiagnosticSnapshot;
  readonly copyStatus: "idle" | "copied" | "failed";
  readonly confirmingClear: boolean;
  readonly clearError?: string | null;
  readonly onCopy: () => void;
  readonly onRequestClear: () => void;
  readonly onCancelClear?: () => void;
  readonly onConfirmClear?: () => void;
  readonly onClose: () => void;
}

function copyNotice(status: AchievementStorageDiagnosticsProps["copyStatus"]): string {
  if (status === "copied") return "진단 정보를 복사했습니다.";
  if (status === "failed") return "진단 정보를 복사하지 못했습니다.";
  return "";
}

export function AchievementStorageDiagnostics({
  snapshot,
  copyStatus,
  confirmingClear,
  clearError = null,
  onCopy,
  onRequestClear,
  onCancelClear,
  onConfirmClear,
  onClose,
}: AchievementStorageDiagnosticsProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  const campaign = snapshot.campaign;
  return (
    <dialog
      ref={dialogRef}
      className="achievement-screen__dialog achievement-storage-diagnostics"
      data-testid="achievement-storage-diagnostics"
      aria-modal="true"
      aria-labelledby="achievement-storage-diagnostics-title"
      onCancel={(event) => {
        event.preventDefault();
        if (confirmingClear) onCancelClear?.();
        else onClose();
      }}
    >
      <h2 id="achievement-storage-diagnostics-title">브라우저 저장 진단</h2>
      {confirmingClear ? (
        <>
          <p>진행 중인 캠페인만 초기화합니다. 업적 기록과 오디오 설정은 그대로 유지됩니다.</p>
          <div className="achievement-storage-diagnostics__actions">
            <button type="button" autoFocus onClick={onCancelClear}>취소</button>
            <button type="button" onClick={onConfirmClear}>캠페인 초기화 확인</button>
          </div>
        </>
      ) : (
        <>
          <dl className="achievement-storage-diagnostics__summary">
            <div><dt>캠페인 시드</dt><dd>{campaign?.seed ?? "저장 없음"}</dd></div>
            <div><dt>액션 수</dt><dd>{campaign?.actionCount ?? 0}</dd></div>
            <div><dt>최근 액션</dt><dd>{campaign?.latestActionType ?? "없음"}</dd></div>
          </dl>
          {snapshot.reason === null ? null : <p role="alert">저장소 읽기 실패: {snapshot.reason}</p>}
          <pre>{formatStorageDiagnostics(snapshot)}</pre>
          <p role="status">{clearError ?? copyNotice(copyStatus)}</p>
          <div className="achievement-storage-diagnostics__actions">
            <button type="button" onClick={onCopy}>전체 복사</button>
            <button type="button" onClick={onRequestClear}>캠페인 초기화</button>
            <button type="button" autoFocus onClick={onClose}>닫기</button>
          </div>
        </>
      )}
    </dialog>
  );
}
