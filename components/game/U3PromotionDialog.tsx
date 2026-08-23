import type { KeyboardEvent } from "react";
import type { PromotionMethod } from "@/lib/domain";
import type { U3PromotionView } from "./u3-promotion-model";

export interface U3PromotionDialogProps {
  view: U3PromotionView;
  onCancel: () => void;
  onConfirm: (method: PromotionMethod) => void;
  onDismissResult: () => void;
}

function handleEscape(event: KeyboardEvent<HTMLDivElement>, onCancel: () => void): void {
  if (event.key === "Escape") onCancel();
}

function PromotionPath({
  method,
  label,
  required,
  current,
  available,
  autoFocus,
  onConfirm,
}: {
  method: PromotionMethod;
  label: string;
  required: number;
  current: number;
  available: boolean;
  autoFocus: boolean;
  onConfirm: (method: PromotionMethod) => void;
}) {
  return (
    <div className={`u3-promotion-dialog__path${available ? " is-available" : ""}`}>
      <div>
        <strong>{label}</strong>
        <span>{method === "reputation" ? "명성" : "골드"} {required} / 현재 {current}</span>
        <small>{available ? "승급 가능" : `${method === "reputation" ? "명성" : "골드"} 부족`}</small>
      </div>
      <button
        type="button"
        disabled={!available}
        autoFocus={autoFocus}
        onClick={() => onConfirm(method)}
      >
        {label}으로 승급
      </button>
    </div>
  );
}

function SelectionDialog({ view, onCancel, onConfirm }: U3PromotionDialogProps) {
  const eligibility = view.eligibility;
  if (eligibility === null) return null;

  return (
    <div
      className="u3-promotion-dialog__backdrop"
      data-testid="u3-promotion-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="u3-promotion-dialog-title"
      tabIndex={-1}
      onKeyDown={(event) => handleEscape(event, onCancel)}
    >
      <section className="u3-promotion-dialog__panel">
        <header>
          <span>길잡이 등급 승급</span>
          <h2 id="u3-promotion-dialog-title">{eligibility.fromRank}급 → {eligibility.toRank}급</h2>
        </header>
        <p className="u3-promotion-dialog__unlock">★{eligibility.newlyUnlockedRiskLevel} 던전 계약 가능</p>
        <div className="u3-promotion-dialog__paths">
          <PromotionPath
            method="reputation"
            label="명성"
            required={eligibility.reputationRequired}
            current={eligibility.currentReputation}
            available={eligibility.canPromoteByReputation}
            autoFocus={eligibility.canPromoteByReputation || !eligibility.canPromoteByGold}
            onConfirm={onConfirm}
          />
          <PromotionPath
            method="gold"
            label="골드"
            required={eligibility.goldRequired}
            current={eligibility.currentGold}
            available={eligibility.canPromoteByGold}
            autoFocus={!eligibility.canPromoteByReputation && eligibility.canPromoteByGold}
            onConfirm={onConfirm}
          />
        </div>
        <button type="button" className="u3-promotion-dialog__cancel" onClick={onCancel}>
          취소
        </button>
      </section>
    </div>
  );
}

function ResultDialog({ view, onDismissResult }: U3PromotionDialogProps) {
  const result = view.result;
  if (result === null) return null;
  const spentGold = result.goldBefore - result.goldAfter;
  const methodLabel = result.method === "reputation"
    ? "명성으로 승급 · 자원 소비 없음"
    : `골드로 승급 · 골드 ${spentGold}G 소비`;

  return (
    <div
      className="u3-promotion-dialog__backdrop"
      data-testid="u3-promotion-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="u3-promotion-result-title"
      tabIndex={-1}
      onKeyDown={(event) => handleEscape(event, onDismissResult)}
    >
      <section className="u3-promotion-dialog__panel u3-promotion-dialog__panel--result">
        <span>승급 완료!</span>
        <h2 id="u3-promotion-result-title">{result.fromRank}급 → {result.toRank}급</h2>
        <p>{methodLabel}</p>
        <strong>★{result.newlyUnlockedRiskLevel} 던전 계약이 해금되었습니다.</strong>
        <button type="button" autoFocus onClick={onDismissResult}>게시판으로 돌아가기</button>
      </section>
    </div>
  );
}

export function U3PromotionDialog(props: U3PromotionDialogProps) {
  if (props.view.result !== null) return <ResultDialog {...props} />;
  if (props.view.isOpen) return <SelectionDialog {...props} />;
  return null;
}
