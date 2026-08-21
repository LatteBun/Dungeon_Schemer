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

function ThemeScene({
  theme,
  testId,
}: {
  theme: U3BoardNoticeView["theme"];
  testId?: string;
}) {
  return (
    <span
      className={`u3-theme-scene u3-theme-scene--${theme}`}
      data-testid={testId}
      aria-hidden="true"
    />
  );
}

function RiskStars({ riskLevel }: { riskLevel: number }) {
  return (
    <span className="u3-risk-stars" aria-label={`위험도 ${riskLevel}`}>
      {Array.from({ length: 5 }, (_, index) => (
        <img
          key={index}
          className={index < riskLevel ? "is-active" : ""}
          src="/assets/u3/extracted/risk-star.png"
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
      <span title="명성">
        <img
          src="/assets/u2/status-reputation.svg"
          alt=""
          aria-hidden="true"
          width={18}
          height={18}
        />
        <span className="u3-reward__label">명성</span>
        {reputation}
      </span>
      <span title="골드">
        <img
          src="/assets/u2/status-gold.svg"
          alt=""
          aria-hidden="true"
          width={18}
          height={18}
        />
        <span className="u3-reward__label">골드</span>
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
        data-testid="u3-notice-pin"
        src="/assets/u3/extracted/board-pin.png"
        alt=""
        aria-hidden="true"
        width={30}
        height={36}
      />

      <span className="u3-notice__heading">
        <strong>{notice.dungeonName}</strong>
        <small>{notice.themeLabel}</small>
      </span>

      <RiskStars riskLevel={notice.riskLevel} />

      <span className="u3-notice__theme-visual">
        <ThemeScene theme={notice.theme} testId="u3-notice-theme-scene" />
      </span>

      <span className="u3-notice__label">3명 생존 보상</span>
      <RewardPair
        reputation={notice.reputationReward}
        gold={notice.goldReward}
        compact
      />

      <span className="u3-notice__environment" data-testid="u3-notice-environment">
        <span>
          <small>환경 특성</small>
          <strong>{notice.environmentLabel}</strong>
        </span>
      </span>

      <span className="u3-notice__state">
        {notice.locked ? "진입 불가" : selected ? "선택 중" : "진입 가능"}
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

function PartyCard({
  member,
  index,
}: {
  member: U3OfferDetailView["party"][number];
  index: number;
}) {
  return (
    <article className="u3-party-card" data-testid="u3-party-member">
      <span className="u3-party-card__number" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="u3-party-card__portrait" aria-hidden="true">
        {member.portraitSrc === undefined ? (
          <span />
        ) : (
          <img
            className="u3-party-card__portrait-image"
            src={member.portraitSrc}
            alt=""
            width={64}
            height={64}
          />
        )}
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
          <dd className="u3-party-card__gold">
            <img
              data-testid="u3-party-gold-icon"
              src="/assets/u2/status-gold.svg"
              alt=""
              aria-hidden="true"
              width={14}
              height={14}
            />
            소지 골드 {member.gold}
          </dd>
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
          <ThemeScene theme={detail.theme} />
        </div>
        <div className="u3-dungeon-summary__copy">
          <span>{detail.themeLabel}</span>
          <h2 id="u3-dungeon-title">{detail.dungeonName}</h2>
          <RiskStars riskLevel={detail.riskLevel} />
        </div>
        <div className="u3-dungeon-summary__facts">
          <span>
            환경 특성 <strong>{detail.environmentLabel}</strong>
          </span>
          <span>
            3명 생존 보상
            <RewardPair reputation={detail.reputationReward} gold={detail.goldReward} compact />
          </span>
        </div>
        {detail.lockReasonLabel === null ? null : (
          <p className="u3-dungeon-summary__lock">{detail.lockReasonLabel}</p>
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
          className="u3-contract-button__emblem"
          src="/assets/u3/extracted/contract-emblem.png"
          alt=""
          aria-hidden="true"
          width={64}
          height={64}
        />
        <strong>{detail.locked ? "진입 불가" : "이 공고 계약하기"}</strong>
        <img
          className="u3-contract-button__arrow"
          src="/assets/u3/extracted/arrow-right.png"
          alt=""
          aria-hidden="true"
          width={48}
          height={32}
        />
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
