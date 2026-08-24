import { GameShell } from "./GameShell";
import { PartyMemberCard } from "./PartyMemberCard";
import type { TopStatusView } from "./TopStatusBar";
import { U3PromotionDialog } from "./U3PromotionDialog";
import type { U3PromotionView } from "./u3-promotion-model";
import type { PromotionMethod } from "@/lib/domain";
import type {
  U3BoardNoticeView,
  U3BoardView,
  U3OfferDetailView,
} from "./u3-board-model";

export interface U3BoardScreenProps {
  status: TopStatusView;
  board: U3BoardView;
  selectedOfferId: string;
  promotion: U3PromotionView;
  onSelectOffer: (offerId: string) => void;
  onContract: (offerId: string) => void;
  onOpenPromotion: () => void;
  onCancelPromotion: () => void;
  onConfirmPromotion: (method: PromotionMethod) => void;
  onDismissPromotionResult: () => void;
}

function ThemeScene({ theme, testId }: { theme: U3BoardNoticeView["theme"]; testId?: string }) {
  return <span className={`u3-theme-scene u3-theme-scene--${theme}`} data-testid={testId} aria-hidden="true" />;
}

function RiskStars({ riskLevel }: { riskLevel: number }) {
  return (
    <span className="u3-risk-stars" aria-label={`위험도 ${riskLevel}`}>
      {Array.from({ length: 5 }, (_, index) => {
        const active = index < riskLevel;
        return (
          <img
            key={index}
            className={active ? "is-active" : ""}
            src={active ? "/assets/u3/risk-star-filled.svg" : "/assets/u3/extracted/risk-star.png"}
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
          />
        );
      })}
    </span>
  );
}

function RewardPair({ reputation, gold, compact = false }: { reputation: number; gold: number; compact?: boolean }) {
  return (
    <span className={compact ? "u3-reward u3-reward--compact" : "u3-reward"}>
      <span title="명성"><img src="/assets/u2/status-reputation.svg" alt="" aria-hidden="true" width={18} height={18} /><span className="u3-reward__label">명성</span>{reputation}</span>
      <span title="골드"><img src="/assets/u2/status-gold.svg" alt="" aria-hidden="true" width={18} height={18} /><span className="u3-reward__label">골드</span>{gold}</span>
    </span>
  );
}

function NoticeCard({ notice, index, selected, onSelect }: { notice: U3BoardNoticeView; index: number; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={`u3-notice u3-notice--${index}${selected ? " is-selected" : ""}${notice.locked ? " is-locked" : ""}`} data-testid="u3-notice" aria-pressed={selected} onClick={onSelect}>
      <img className="u3-notice__pin" data-testid="u3-notice-pin" src="/assets/u3/extracted/board-pin.png" alt="" aria-hidden="true" width={50} height={61} />
      <span className="u3-notice__heading"><strong>{notice.dungeonName}</strong><small>{notice.themeLabel}</small></span>
      <RiskStars riskLevel={notice.riskLevel} />
      <span className="u3-notice__theme-visual"><ThemeScene theme={notice.theme} testId="u3-notice-theme-scene" /></span>
      <span className="u3-notice__label">3명 생존 보상</span>
      <RewardPair reputation={notice.reputationReward} gold={notice.goldReward} compact />
      <span className="u3-notice__state">{notice.locked ? "진입 불가" : selected ? "선택 중" : "진입 가능"}</span>
    </button>
  );
}

function NoticeBoard({ board, selectedOfferId, onSelectOffer }: { board: U3BoardView; selectedOfferId: string; onSelectOffer: (offerId: string) => void }) {
  if (board.notices.length === 0) return <div className="u3-board-empty" role="status">게시할 수 있는 공고가 없습니다.</div>;
  return (
    <div className="u3-guild-board" aria-label="길드 공고">
      <div className="u3-guild-board__wood" aria-hidden="true" />
      <div className="u3-guild-board__notices">
        {board.notices.map((notice, index) => <NoticeCard key={notice.offerId} notice={notice} index={index} selected={notice.offerId === selectedOfferId} onSelect={() => onSelectOffer(notice.offerId)} />)}
      </div>
    </div>
  );
}

function PartyCard({ member, index }: { member: U3OfferDetailView["party"][number]; index: number }) {
  /* 표시는 공용 카드가 맡는다. 게시판은 순번을 함께 보여준다. */
  return (
    <PartyMemberCard
      member={{
        id: String(member.id),
        name: member.name,
        classLabel: member.classLabel,
        personalityLabel: member.personalityLabel,
        hp: member.hp,
        maxHp: member.maxHp,
        trust: member.trust,
        gold: member.gold,
        portraitSrc: member.portraitSrc,
      }}
      index={index}
      testId="u3-party-member"
    />
  );
}

function ContractOutcomes({ detail }: { detail: U3OfferDetailView }) {
  // 계약 조건은 계약 카드의 공통 어두운 바탕 안에서 보상 정보를 우선한다.
  return (
    <section className="u3-contract-outcomes" aria-labelledby="u3-contract-title">
      <h3 id="u3-contract-title">계약 조건</h3>
      <div className="u3-contract-outcomes__rows">
        {detail.contractOutcomes.map((outcome) => <div key={outcome.survivors} className={outcome.survivors === 0 ? "is-death" : ""}>
          <strong>{outcome.label}</strong>
          {outcome.survivors === 0 ? <span>계약 보상 없음 · 명성 -{outcome.reputationLoss}<small>전멸 시 파티원 유품 골드 회수</small></span> : <span className="u3-contract-outcome__reward"><RewardPair reputation={outcome.reputation} gold={outcome.gold} compact /></span>}
        </div>)}
      </div>
    </section>
  );
}

function ContractDetail({ detail, onContract }: { detail: U3OfferDetailView | undefined; onContract: (offerId: string) => void }) {
  if (detail === undefined) return <div className="u3-detail-empty" role="status">공고를 선택하면 계약 상세가 표시됩니다.</div>;
  return (
    <div className="u3-contract-detail">
      {/* 파티를 맨 위에 둔다. U4·U5 도 우측 첫 자리가 파티다. */}
      <section className="panel-section u3-party" aria-labelledby="u3-party-title">
        <h3 id="u3-party-title">파티 상태</h3>
        <ul className="party-list">
          {detail.party.map((member, index) => (
            <li key={member.id}>
              <PartyCard member={member} index={index} />
            </li>
          ))}
        </ul>
      </section>

      <section
        className="u3-detail-section u3-contract-card"
        aria-labelledby="u3-dungeon-title"
      >
        <div className="u3-contract-card__body">
          <header className="u3-contract-card__head">
            <span className="u3-contract-card__theme">{detail.themeLabel}</span>
            <h2 id="u3-dungeon-title">{detail.dungeonName}</h2>
            <RiskStars riskLevel={detail.riskLevel} />
            <span className="u3-contract-card__reward">
              3명 생존 보상
              <RewardPair reputation={detail.reputationReward} gold={detail.goldReward} compact />
            </span>
            {detail.lockReasonLabel === null ? null : (
              <p className="u3-dungeon-summary__lock">{detail.lockReasonLabel}</p>
            )}
          </header>
          <ContractOutcomes detail={detail} />
        </div>
      </section>

      <button type="button" className="u3-contract-button" disabled={detail.locked} onClick={() => onContract(detail.offerId)}>
        <img className="u3-contract-button__seal" src="/assets/u3/extracted/contract-emblem.png" alt="" aria-hidden="true" width={40} height={42} />
        <strong>{detail.locked ? "진입 불가" : "이 공고 계약하기"}</strong>
        <img className="u3-contract-button__arrow" src="/assets/u3/extracted/arrow-right.png" alt="" aria-hidden="true" width={70} height={27} />
      </button>
    </div>
  );
}

export function U3BoardScreen({
  status,
  board,
  selectedOfferId,
  promotion,
  onSelectOffer,
  onContract,
  onOpenPromotion,
  onCancelPromotion,
  onConfirmPromotion,
  onDismissPromotionResult,
}: U3BoardScreenProps) {
  const detail = board.detailsByOfferId[selectedOfferId];
  return (
    <div className="expedition-screen u3-board-screen">
      <GameShell
        status={status}
        onOpenPromotion={onOpenPromotion}
        screenTitle="길드 게시판"
        main={<NoticeBoard board={board} selectedOfferId={selectedOfferId} onSelectOffer={onSelectOffer} />}
        rightPanel={<ContractDetail detail={detail} onContract={onContract} />}
        rightPanelLabel="계약 상세"
      />
      <U3PromotionDialog
        view={promotion}
        onCancel={onCancelPromotion}
        onConfirm={onConfirmPromotion}
        onDismissResult={onDismissPromotionResult}
      />
    </div>
  );
}
