import { GameShell } from "./GameShell";
import type { TopStatusView } from "./TopStatusBar";
import type { U6SettlementView } from "./u6-settlement-model";

export interface U6SettlementScreenProps {
  status: TopStatusView;
  settlement: U6SettlementView;
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

export function U6SettlementScreen({ status, settlement }: U6SettlementScreenProps) {
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
          </div>
        }
        rightPanelLabel="캠페인 변화"
      />
    </div>
  );
}
