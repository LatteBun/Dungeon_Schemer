import { GameShell } from "./GameShell";
import type { TopStatusView } from "./TopStatusBar";
import type {
  U6DungeonOutcome,
  U6SettlementMember,
  U6SettlementView,
  U6TrustPressureView,
} from "./u6-settlement-model";

export interface U6SettlementScreenProps {
  status: TopStatusView;
  settlement: U6SettlementView;
  onContinue?: () => void;
}

const ASSET = "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL";
const SCENE = "/assets/u5/dungeon-progress-scenes";

const CAUSE_ICON = {
  choice: `${ASSET}/stats/icon_advice.png`,
  reactions: `${ASSET}/stats/icon_trust.png`,
} as const;

function riskStars(level: number): string {
  return `★${level}`;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function outcomeTone(settlement: U6SettlementView): "whole" | "costly" | "lost" {
  if (settlement.outcome.kind === "wiped") return "lost";
  return settlement.members.some((member) => member.diedThisExpedition) ? "costly" : "whole";
}

function Outcome({ settlement }: { settlement: U6SettlementView }) {
  return (
    <header className="u6-outcome" data-testid="u6-outcome">
      <strong>{settlement.outcome.title}</strong>
      <small>{settlement.outcome.summary}</small>
    </header>
  );
}

function CauseSummary({ settlement }: { settlement: U6SettlementView }) {
  return (
    <section className="u6-cause-summary" aria-labelledby="u6-cause-summary-title">
      <h3 id="u6-cause-summary-title">선택과 판단</h3>
      <ul>
        {settlement.causes.map((cause) => (
          <li key={cause.kind}>
            <img src={CAUSE_ICON[cause.kind]} alt="" aria-hidden="true" />
            <span>
              <strong>{cause.label}</strong>
              <small>{cause.detail}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MemberResult({ member }: { member: U6SettlementMember }) {
  const className = [
    "u6-party-result",
    member.diedThisExpedition ? "is-dead" : null,
    member.trust.countsTowardCampaign ? "is-exposed" : null,
    member.gravelyWounded ? "is-gravely-wounded" : null,
  ].filter(Boolean).join(" ");

  return (
    <li className={className}>
      <img src={member.portraitSrc} alt="" aria-hidden="true" />
      <span className="u6-party-result__who">
        <strong>{member.name}</strong>
        <small>{member.classLabel}</small>
      </span>
      <span className="u6-party-result__state">
        {member.diedThisExpedition ? (
          <strong>사망 · HP {member.hp.before} → {member.hp.after}</strong>
        ) : (
          <strong>
            {member.hp.before === member.hp.after
              ? `HP ${member.hp.after} / ${member.hp.max}`
              : `HP ${member.hp.before} → ${member.hp.after} / ${member.hp.max}`}
          </strong>
        )}
        {member.diedThisExpedition && member.trust.changed ? (
          <strong className="u6-party-result__trust">마지막 신뢰 {member.trust.before} → {member.trust.after}</strong>
        ) : !member.diedThisExpedition && member.trust.isZero ? (
          <strong className="u6-party-result__trust">{member.trust.changed ? `신뢰 ${member.trust.before} → 0` : "신뢰 0"}</strong>
        ) : !member.diedThisExpedition && member.trust.changed ? (
          <strong className="u6-party-result__trust">신뢰 {member.trust.before} → {member.trust.after}</strong>
        ) : null}
      </span>
      <span className="u6-party-result__badges">
        {member.diedThisExpedition ? <em>사망</em> : null}
        {member.gravelyWounded ? <em>중상</em> : null}
        {member.trust.countsTowardCampaign ? <em>정체 발각 · 원정 출전 불가</em> : null}
      </span>
    </li>
  );
}

function PartyResults({ settlement }: { settlement: U6SettlementView }) {
  if (settlement.members.length === 0) return null;

  return (
    <section className="panel-section u6-party-results" aria-labelledby="u6-party-results-title">
      <h3 id="u6-party-results-title">원정대 결과</h3>
      <ul className="u6-party-results__list">
        {settlement.members.map((member) => <MemberResult key={member.id} member={member} />)}
      </ul>
    </section>
  );
}

function DungeonChange({ outcome }: { outcome: U6DungeonOutcome }) {
  if (outcome.kind === "cleared") {
    return <div className="u6-dungeon-change"><span>이 던전</span><strong>정복</strong><small>게시판에서 제거됨</small></div>;
  }
  if (outcome.kind === "riskCapped") {
    return <div className="u6-dungeon-change"><span>던전 위험도</span><strong>{riskStars(outcome.level)}</strong><small>최대 위험도라 더 오르지 않는다</small></div>;
  }
  return (
    <div className="u6-dungeon-change">
      <span>던전 위험도</span>
      <strong>{riskStars(outcome.before)} <span aria-hidden="true">→</span> {riskStars(outcome.after)}</strong>
      <small>실패로 위험도가 올랐다</small>
    </div>
  );
}

function trustPressureDetail(pressure: U6TrustPressureView): string {
  if (pressure.reachedThreshold) return `누적 고발 기준 ${pressure.threshold}명에 도달했다`;
  if (pressure.afterCount === 0) return "살아 있는 신뢰 0 인물이 없어 누적 불이익이 해제됐다";
  if (pressure.acceptModifier !== 0 || pressure.exposeModifier !== 0) {
    const accept = `조언 수용 ${signed(pressure.acceptModifier)}`;
    const expose = pressure.exposeModifier === 0 ? null : `거짓 적발 ${signed(pressure.exposeModifier)}`;
    return [accept, expose].filter(Boolean).join(" · ");
  }
  return "신뢰 0 인물은 플레이어 원정에 출전할 수 없다";
}

function trustPressureCount(pressure: U6TrustPressureView): string {
  const current = `${pressure.afterCount} / ${pressure.threshold}`;
  return pressure.beforeCount === pressure.afterCount
    ? current
    : `${pressure.beforeCount} → ${current}`;
}

function Changes({ settlement }: { settlement: U6SettlementView }) {
  const contractReward = settlement.outcome.kind === "cleared";

  return (
    <section className="panel-section u6-changes" aria-labelledby="u6-changes-title">
      <h3 id="u6-changes-title">캠페인 변화</h3>
      <img className="u6-changes__divider" src={`${ASSET}/decorations/divider_small.png`} alt="" aria-hidden="true" />
      <DungeonChange outcome={settlement.dungeonOutcome} />
      <dl className="u6-deltas">
        <div>
          <dt><img src={`${ASSET}/stats/icon_reputation.png`} alt="" aria-hidden="true" />명성</dt>
          <dd>{signed(settlement.reputationDelta)}</dd>
        </div>
        <div>
          <dt><img src={`${ASSET}/stats/icon_gold.png`} alt="" aria-hidden="true" />{contractReward ? "계약 골드" : "계약 보상"}</dt>
          <dd>{contractReward ? signed(settlement.goldDelta) : "없음"}</dd>
        </div>
        {settlement.relicGold > 0 ? (
          <div>
            <dt><img src={`${ASSET}/stats/icon_gold.png`} alt="" aria-hidden="true" />유품 골드</dt>
            <dd>{signed(settlement.relicGold)}</dd>
          </div>
        ) : null}
      </dl>
      {settlement.trustPressure === null ? null : (
        <div className="u6-trust-pressure">
          <span>신뢰 0 누적</span>
          <strong>{trustPressureCount(settlement.trustPressure)}</strong>
          <small>{trustPressureDetail(settlement.trustPressure)}</small>
        </div>
      )}
      {settlement.nextReward === null ? null : (
        <p className="u6-next-reward">
          <span>이 던전을 다시 맡으면 · 3명 생환 기준</span>
          <strong>명성 {settlement.nextReward.reputation}</strong>
          <strong>골드 {settlement.nextReward.gold}</strong>
        </p>
      )}
      <img
        className={`u6-changes__seal is-${outcomeTone(settlement)}`}
        src={`${ASSET}/emblems/wax_seal.png`}
        alt=""
        aria-hidden="true"
      />
    </section>
  );
}

export function U6SettlementScreen({ status, settlement, onContinue }: U6SettlementScreenProps) {
  return (
    <div
      className="u6-result-screen u6-result-screen--settlement"
      data-testid="u6-settlement"
      style={{ ["--u6-settlement-scene" as string]: `url("${SCENE}/${settlement.themeId}/entry.png")` }}
    >
      <GameShell
        status={status}
        screenTitle={`정산 · ${settlement.dungeonName}`}
        main={(
          <div className="u6-settlement-main">
            <Outcome settlement={settlement} />
            <CauseSummary settlement={settlement} />
            <PartyResults settlement={settlement} />
          </div>
        )}
        rightPanel={(
          <div className="u6-settlement-side">
            <Changes settlement={settlement} />
            {onContinue === undefined ? null : (
              <button type="button" className="u6-settlement-continue" onClick={onContinue}>
                길드로 돌아간다
              </button>
            )}
          </div>
        )}
        rightPanelLabel="캠페인 변화"
      />
    </div>
  );
}
