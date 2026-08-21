import { GameShell } from "./GameShell";
import type { TopStatusView } from "./TopStatusBar";
import type {
  U3BoardNoticeView,
  U3BoardView,
  U3OfferDetailView,
} from "./u3-board-model";

export interface U3BoardScreenProps {
  status: TopStatusView;
  board: U3BoardView;
  selectedOfferId: string;
  onSelectOffer: (offerId: string) => void;
  onContract: (offerId: string) => void;
}

const THEME_ICON = {
  spider: "/assets/u3/theme-spider.svg",
  desert: "/assets/u3/theme-desert.svg",
  graveyard: "/assets/u3/theme-graveyard.svg",
} as const;

function RiskStars({ riskLevel }: { riskLevel: number }) {
  return (
    <span className="u3-risk-stars" aria-label={`위험도 ${riskLevel}`}>
      {Array.from({ length: 5 }, (_, index) => (
        <img
          key={index}
          className={index < riskLevel ? "is-active" : ""}
          src="/assets/u3/risk-star.svg"
          alt=""
          aria-hidden="true"
          width={16}
          height={16}
        />
      ))}
    </span>
  );
}

function RewardPair({
  reputation,
  gold,
  compact = false,
}: {
  reputation: number;
  gold: number;
  compact?: boolean;
}) {
  return (
    <span className={compact ? "u3-reward u3-reward--compact" : "u3-reward"}>
      <span>
        <img
          src="/assets/u2/status-reputation.svg"
          alt=""
          aria-hidden="true"
          width={18}
          height={18}
        />
        {reputation}
      </span>
      <span>
        <img
          src="/assets/u2/status-gold.svg"
          alt=""
          aria-hidden="true"
          width={18}
          height={18}
        />
        {gold}
      </span>
    </span>
  );
}

function NoticeCard({
  notice,
  index,
  selected,
  onSelect,
}: {
  notice: U3BoardNoticeView;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`u3-notice u3-notice--${index}${selected ? " is-selected" : ""}${notice.locked ? " is-locked" : ""}`}
      data-testid="u3-notice"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <img
        className="u3-notice__pin"
        src="/assets/u3/board-pin.svg"
        alt=""
        aria-hidden="true"
        width={24}
        height={24}
      />
      <img
        className="u3-notice__theme-mark"
        src={THEME_ICON[notice.theme]}
        alt=""
        aria-hidden="true"
        width={74}
        height={74}
      />

      <span className="u3-notice__heading">
        <strong>{notice.dungeonName}</strong>
        <small>{notice.themeLabel}</small>
      </span>

      <RiskStars riskLevel={notice.riskLevel} />

      <span className="u3-notice__label">3명 생존 보상</span>
      <RewardPair
        reputation={notice.reputationReward}
        gold={notice.goldReward}
        compact
      />

      <span className="u3-notice__environment" data-testid="u3-notice-environment">
        <img
          src="/assets/u3/environment.svg"
          alt=""
          aria-hidden="true"
          width={18}
          height={18}
        />
        <span>
          <small>환경 특성</small>
          <strong>{notice.environmentLabel}</strong>
        </span>
      </span>

      <span className="u3-notice__state">
        {notice.locked ? (
          <>
            <img
              src="/assets/u3/notice-lock.svg"
              alt=""
              aria-hidden="true"
              width={18}
              height={18}
            />
            진입 불가
          </>
        ) : selected ? (
          "선택 중"
        ) : (
          "진입 가능"
        )}
      </span>
    </button>
  );
}

function NoticeBoard({
  board,
  selectedOfferId,
  onSelectOffer,
}: {
  board: U3BoardView;
  selectedOfferId: string;
  onSelectOffer: (offerId: string) => void;
}) {
  if (board.notices.length === 0) {
    return (
      <div className="u3-board-empty" role="status">
        게시할 수 있는 공고가 없습니다.
      </div>
    );
  }

  return (
    <div className="u3-guild-board" aria-label="길드 공고">
      <div className="u3-guild-board__wood" aria-hidden="true" />
      <div className="u3-guild-board__notices">
        {board.notices.map((notice, index) => (
          <NoticeCard
            key={notice.offerId}
            notice={notice}
            index={index}
            selected={notice.offerId === selectedOfferId}
            onSelect={() => onSelectOffer(notice.offerId)}
          />
        ))}
      </div>
    </div>
  );
}

function PartyCard({ member, index }: { member: U3OfferDetailView["party"][number]; index: number }) {
  return (
    <article className="u3-party-card" data-testid="u3-party-member">
      <span className="u3-party-card__number" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="u3-party-card__portrait" aria-hidden="true">
        <span />
      </div>
      <div className="u3-party-card__identity">
        <strong>{member.name}</strong>
        <span>{member.classLabel}</span>
        <small>{member.personalityLabel}</small>
      </div>
      <dl className="u3-party-card__stats">
        <div>
          <dt>HP</dt>
          <dd>{member.hp} / {member.maxHp}</dd>
        </div>
        <div>
          <dt>신뢰</dt>
          <dd>신뢰 {member.trust}</dd>
        </div>
        <div>
          <dt>소지 골드</dt>
          <dd>소지 골드 {member.gold}</dd>
        </div>
      </dl>
    </article>
  );
}

function ContractOutcomes({ detail }: { detail: U3OfferDetailView }) {
  return (
    <section className="u3-detail-section u3-contract-outcomes" aria-labelledby="u3-contract-title">
      <h3 id="u3-contract-title">계약 조건</h3>
      <div className="u3-contract-outcomes__rows">
        {detail.contractOutcomes.map((outcome) => (
          <div key={outcome.survivors} className={outcome.survivors === 0 ? "is-death" : ""}>
            <strong>{outcome.label}</strong>
            {outcome.survivors === 0 ? (
              <span>
                계약 보상 없음 · 명성 -{outcome.reputationLoss}
                <small>전멸 시 파티원 유품 골드 회수</small>
              </span>
            ) : (
              <RewardPair reputation={outcome.reputation} gold={outcome.gold} compact />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ContractDetail({
  detail,
  onContract,
}: {
  detail: U3OfferDetailView | undefined;
  onContract: (offerId: string) => void;
}) {
  if (detail === undefined) {
    return (
      <div className="u3-detail-empty" role="status">
        공고를 선택하면 계약 상세가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="u3-contract-detail">
      <section className="u3-detail-section u3-dungeon-summary" aria-labelledby="u3-dungeon-title">
        <div className="u3-dungeon-summary__motif">
          <img
            src={THEME_ICON[detail.theme]}
            alt=""
            aria-hidden="true"
            width={78}
            height={78}
          />
        </div>
        <div className="u3-dungeon-summary__copy">
          <span>{detail.themeLabel}</span>
          <h2 id="u3-dungeon-title">{detail.dungeonName}</h2>
          <RiskStars riskLevel={detail.riskLevel} />
        </div>
        <div className="u3-dungeon-summary__facts">
          <span>
            <img src="/assets/u3/environment.svg" alt="" aria-hidden="true" width={18} height={18} />
            환경 특성 <strong>{detail.environmentLabel}</strong>
          </span>
          <span>
            3명 생존 보상
            <RewardPair reputation={detail.reputationReward} gold={detail.goldReward} compact />
          </span>
        </div>
        {detail.lockReasonLabel === null ? null : (
          <p className="u3-dungeon-summary__lock">
            <img src="/assets/u3/notice-lock.svg" alt="" aria-hidden="true" width={18} height={18} />
            {detail.lockReasonLabel}
          </p>
        )}
      </section>

      <section className="u3-detail-section u3-party" aria-labelledby="u3-party-title">
        <h3 id="u3-party-title">탐험대 구성</h3>
        <div className="u3-party__grid">
          {detail.party.map((member, index) => (
            <PartyCard key={member.id} member={member} index={index} />
          ))}
        </div>
      </section>

      <ContractOutcomes detail={detail} />

      <button
        type="button"
        className="u3-contract-button"
        disabled={detail.locked}
        onClick={() => onContract(detail.offerId)}
      >
        <img
          src="/assets/u2/intro-contract.svg"
          alt=""
          aria-hidden="true"
          width={38}
          height={38}
        />
        <strong>{detail.locked ? "진입 불가" : "이 공고 계약하기"}</strong>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

export function U3BoardScreen({
  status,
  board,
  selectedOfferId,
  onSelectOffer,
  onContract,
}: U3BoardScreenProps) {
  const detail = board.detailsByOfferId[selectedOfferId];

  return (
    <div className="u3-board-screen">
      <GameShell
        status={status}
        screenTitle="길드 게시판"
        main={
          <NoticeBoard
            board={board}
            selectedOfferId={selectedOfferId}
            onSelectOffer={onSelectOffer}
          />
        }
        rightPanel={<ContractDetail detail={detail} onContract={onContract} />}
        rightPanelLabel="계약 상세"
      />
    </div>
  );
}
