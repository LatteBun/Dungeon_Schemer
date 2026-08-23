import { GameShell } from "./GameShell";
import type { TopStatusView } from "./TopStatusBar";
import { rankCrestSrc, type U6PromotionView, type U6SettlementView } from "./u6-settlement-model";

export interface U6SettlementScreenProps {
  status: TopStatusView;
  settlement: U6SettlementView;
  onPromote: (path: "reputation" | "gold") => void;
}

function riskStars(level: number): string {
  return `★${level}`;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

/** 원인 순서. 숫자를 나열하지 않고 왜 그렇게 됐는지를 따라간다. */
function CauseChain({ settlement }: { settlement: U6SettlementView }) {
  const wiped = settlement.survivors === 0;

  return (
    <ol className="u6-cause-chain" data-testid="u6-cause-chain">
      {settlement.causeChain.map((step) => (
        <li className="u6-cause" key={step.order}>
          <span className="u6-cause__order" aria-hidden="true">{step.order}</span>
          <div className="u6-cause__body">
            <strong>{step.label}</strong>
            <p>{step.detail}</p>
            {step.order === 4 && wiped ? (
              <p className="u6-cause__note">
                계약 보상 없음 · 유품으로 소지 골드 {settlement.relicGold} 회수
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Promotion({ promotion, onPromote }: {
  promotion: U6PromotionView;
  onPromote: U6SettlementScreenProps["onPromote"];
}) {
  const reputationShort = promotion.reputationRequired - promotion.currentReputation;
  const goldShort = promotion.goldRequired - promotion.currentGold;
  const open = promotion.byReputation || promotion.byGold;

  return (
    <section className="panel-section u6-promotion" data-testid="u6-promotion" aria-labelledby="u6-promotion-title">
      <h3 id="u6-promotion-title">
        승급 {promotion.from} → {promotion.to}
      </h3>
      <img className="u6-promotion__crest" src={rankCrestSrc(promotion.to)} alt="" aria-hidden="true" width={246} height={295} />

      <dl className="u6-promotion__paths">
        <div className={promotion.byReputation ? "is-open" : ""}>
          <dt>명성 승급</dt>
          <dd>
            명성 {promotion.reputationRequired} / 현재 {promotion.currentReputation}
            <small>{promotion.byReputation ? "가능 · 명성을 소비하지 않는다" : `명성 ${reputationShort} 부족`}</small>
          </dd>
        </div>
        <div className={promotion.byGold ? "is-open" : ""}>
          <dt>골드 승급</dt>
          <dd>
            골드 {promotion.goldRequired} 소비 / 현재 {promotion.currentGold}
            <small>{promotion.byGold ? "가능 · 명성을 보지 않는다" : `골드 ${goldShort} 부족`}</small>
          </dd>
        </div>
      </dl>

      <div className="u6-promotion__actions">
        <button type="button" disabled={!promotion.byReputation} onClick={() => onPromote("reputation")}>
          명성으로 승급하기
        </button>
        <button type="button" disabled={!promotion.byGold} onClick={() => onPromote("gold")}>
          골드로 승급하기
        </button>
      </div>
      {open ? null : <p className="u6-promotion__locked">아직 두 경로 모두 요건에 닿지 않았다.</p>}
    </section>
  );
}

function Changes({ settlement }: { settlement: U6SettlementView }) {
  return (
    <section className="panel-section u6-changes" aria-labelledby="u6-changes-title">
      <h3 id="u6-changes-title">캠페인 변화</h3>

      <div className="u6-risk-change" data-testid="u6-risk-change">
        <span>던전 위험도</span>
        <strong>
          {riskStars(settlement.riskBefore)}
          <span aria-hidden="true"> → </span>
          {riskStars(settlement.riskAfter)}
        </strong>
        <small>
          {settlement.riskCapped
            ? "★5 가 상한이라 더 오르지 않는다"
            : settlement.riskAfter > settlement.riskBefore
              ? "실패로 위험도가 올랐다"
              : "위험도가 그대로다"}
        </small>
      </div>

      <dl className="u6-deltas">
        <div>
          <dt>명성</dt>
          <dd>{signed(settlement.reputationDelta)}</dd>
        </div>
        <div>
          <dt>골드</dt>
          <dd>{signed(settlement.goldDelta + settlement.relicGold)}</dd>
        </div>
      </dl>

      {settlement.nextReward === null ? null : (
        <p className="u6-next-reward">
          다음 계약 보상 <strong>명성 {settlement.nextReward.reputation}</strong>
          <strong>골드 {settlement.nextReward.gold}</strong>
        </p>
      )}
    </section>
  );
}

export function U6SettlementScreen({ status, settlement, onPromote }: U6SettlementScreenProps) {
  const wiped = settlement.survivors === 0;

  return (
    <div className="u6-result-screen u6-result-screen--settlement" data-testid="u6-settlement">
      <GameShell
        status={status}
        screenTitle={`정산 · ${settlement.dungeonName}`}
        main={
          <div className="u6-settlement-main">
            <p className="u6-outcome" data-testid="u6-outcome">
              <strong>{wiped ? "전멸" : `${settlement.survivors}명 생존`}</strong>
              <small>
                {wiped
                  ? "명성 손실은 계약 시점 위험도로 계산한다"
                  : "생존 인원 비율만큼 계약 보상을 받는다"}
              </small>
            </p>
            <CauseChain settlement={settlement} />
          </div>
        }
        rightPanel={
          <div className="u6-settlement-side">
            <Changes settlement={settlement} />
            {settlement.promotion === null ? (
              <p className="u6-promotion__max">최고 등급이라 더 승급하지 않는다.</p>
            ) : (
              <Promotion promotion={settlement.promotion} onPromote={onPromote} />
            )}
          </div>
        }
        rightPanelLabel="캠페인 변화와 승급"
      />
    </div>
  );
}
