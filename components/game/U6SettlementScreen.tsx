import { GameShell } from "./GameShell";
import type { TopStatusView } from "./TopStatusBar";
import type { U6SettlementView } from "./u6-settlement-model";

export interface U6SettlementScreenProps {
  status: TopStatusView;
  settlement: U6SettlementView;
  /*
   * 다음으로 넘어가는 길. 프리뷰에는 넘어갈 곳이 없어 주지 않는다.
   *
   * 주면 버튼이 서고, 없으면 서지 않는다. 화면이 그다음에 무슨 일이 일어나는지
   * 아는 대신, 알리기만 한다.
   */
  onContinue?: () => void;
}

const ASSET = "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL";

/** 방금 나온 던전이 뒤에 남아 있다. 정산은 그 문 앞에서 셈하는 자리다. */
const SCENE = "/assets/u5/dungeon-progress-scenes";

function riskStars(level: number): string {
  return `★${level}`;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

/** 원인 순서. 숫자를 나열하지 않고 왜 그렇게 됐는지를 따라간다. */
/*
 * 칸마다 제 문양을 준다.
 *
 * 다섯 칸이 번호만 다른 같은 상자였다. 원인 사슬은 "무엇을 골랐고 → 어떻게
 * 받아들였고 → 얼마나 다쳤고 → 무엇을 얻거나 잃었고 → 캠페인이 어떻게
 * 달라졌는가" 인데, 그 뜻이 문양으로도 읽혀야 한 눈에 따라갈 수 있다.
 */
const CAUSE_ICON: Readonly<Record<number, string>> = {
  1: `${ASSET}/stats/icon_advice.png`,
  2: `${ASSET}/stats/icon_trust.png`,
  3: `${ASSET}/stats/icon_dead.png`,
  4: `${ASSET}/stats/icon_gold.png`,
  5: `${ASSET}/stats/icon_reputation.png`,
};

function CauseChain({ settlement }: { settlement: U6SettlementView }) {
  const wiped = settlement.survivors === 0;

  return (
    <ol className="u6-cause-chain" data-testid="u6-cause-chain">
      {settlement.causeChain.map((step) => (
        <li className="u6-cause" key={step.order}>
          {/*
            * 피해 칸의 문양은 결과 색을 따른다.
            *
            * 인주와 같은 색이라 한 화면 안에서 두 표시가 같은 말을 한다 - 다
            * 돌아왔는지, 누군가를 잃었는지.
            */}
          <span
            className={`u6-cause__order${step.order === 3 ? ` is-${outcomeTone(settlement.survivors)}` : ""}`}
            aria-hidden="true"
          >
            <img src={CAUSE_ICON[step.order] ?? CAUSE_ICON[1]!} alt="" />
            <b>{step.order}</b>
          </span>
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
      <img className="u6-changes__divider" src={`${ASSET}/decorations/divider_small.png`} alt="" aria-hidden="true" />

      {/*
        * 클리어한 던전에는 위험도를 적지 않는다.
        *
        * 그 던전은 끝났고 다시 들어갈 수 없다. 「위험도가 그대로다」는 다시 갈
        * 수 있을 때만 뜻이 있는 말이라, 끝난 던전 옆에 두면 읽는 사람이 무엇을
        * 해야 하는지 헷갈린다.
        */}
      {settlement.survivors === 0 ? (
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
      ) : (
        <div className="u6-risk-change" data-testid="u6-risk-change">
          <span>이 던전</span>
          <strong>정복</strong>
          <small>다시 들어갈 일이 없다</small>
        </div>
      )}

      {/* 문양을 붙인다. 명성과 골드는 캠페인 내내 같은 그림으로 읽힌다. */}
      <dl className="u6-deltas">
        <div>
          <dt><img src={`${ASSET}/stats/icon_reputation.png`} alt="" aria-hidden="true" />명성</dt>
          <dd>{signed(settlement.reputationDelta)}</dd>
        </div>
        <div>
          <dt><img src={`${ASSET}/stats/icon_gold.png`} alt="" aria-hidden="true" />골드</dt>
          <dd>{signed(settlement.goldDelta + settlement.relicGold)}</dd>
        </div>
      </dl>

      {/*
        * 다음 계약이 정해져 있다는 말이 아니다.
        *
        * 이 값은 전멸했을 때만 나온다. 던전은 그대로 남고 위험도만 올랐으므로,
        * 그 던전을 다시 맡으면 얼마를 받는지가 정해진다 - 보상표가 위험도와
        * 생존 인원의 함수이기 때문이다. 「다음 계약 보상」이라고만 적으면
        * 게시판의 다음 공고가 이미 정해진 것처럼 읽힌다.
        */}
      {settlement.nextReward === null ? null : (
        <p className="u6-next-reward">
          <span>이 던전을 다시 맡으면 · 3명 생환 기준</span>
          <strong>명성 {settlement.nextReward.reputation}</strong>
          <strong>골드 {settlement.nextReward.gold}</strong>
        </p>
      )}

      {/*
        * 봉인으로 닫는다.
        *
        * 정산은 길드에 넘기는 문서다. 봉인이 찍혀야 끝난 문서로 읽힌다.
        *
        * 인주는 한 장뿐이라 색을 입힌다. 다 살아 돌아왔으면 초록, 누군가를
        * 잃었으면 호박색, 전멸이면 그대로 붉은색이다 - 문서를 읽기 전에 색으로
        * 먼저 안다.
        */}
      <img
        className={`u6-changes__seal is-${outcomeTone(settlement.survivors)}`}
        src={`${ASSET}/emblems/wax_seal.png`}
        alt=""
        aria-hidden="true"
      />
    </section>
  );
}

function Returned({ settlement }: { settlement: U6SettlementView }) {
  if (settlement.members.length === 0) return null;

  return (
    <section className="panel-section u6-returned" aria-labelledby="u6-returned-title">
      <h3 id="u6-returned-title">다녀온 사람</h3>
      <ul className="u6-returned__list">
        {settlement.members.map((member) => (
          <li key={member.id} className={member.alive ? "" : "is-dead"}>
            <img src={member.portraitSrc} alt="" aria-hidden="true" />
            <span className="u6-returned__who">
              <strong>{member.name}</strong>
              <small>{member.classLabel}</small>
            </span>
            {member.alive ? (
              <span className="u6-returned__state">
                HP {member.hp.after} / {member.hp.max}
                {member.trust.after === member.trust.before ? null : (
                  <em>신뢰 {member.trust.before} → {member.trust.after}</em>
                )}
              </span>
            ) : (
              <span className="u6-returned__state is-dead">돌아오지 못했다</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 다 돌아왔으면 초록, 누군가를 잃었으면 호박색, 전멸이면 붉은색. */
function outcomeTone(survivors: number): "whole" | "costly" | "lost" {
  return survivors === 3 ? "whole" : survivors === 0 ? "lost" : "costly";
}

export function U6SettlementScreen({ status, settlement, onContinue }: U6SettlementScreenProps) {
  const wiped = settlement.survivors === 0;

  return (
    /*
     * 방금 나온 던전을 본문 바탕에 깐다.
     *
     * 맨 바탕 위에서 셈하면 어느 던전에서 돌아온 정산인지가 문장에만 남는다.
     * 셸 뒤에 따로 깔면 셸 안쪽이 덮으므로, 본문 자신의 배경으로 준다.
     */
    <div
      className="u6-result-screen u6-result-screen--settlement"
      data-testid="u6-settlement"
      style={{ ["--u6-settlement-scene" as string]: `url("${SCENE}/${settlement.themeId}/entry.png")` }}
    >
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
            <img className="u6-settlement-rule" src={`${ASSET}/decorations/divider_line.png`} alt="" aria-hidden="true" />
            <CauseChain settlement={settlement} />
          </div>
        }
        rightPanel={
          <div className="u6-settlement-side">
            <Changes settlement={settlement} />
            {/*
              * 누가 돌아왔는지.
              *
              * 정산은 사람에 대한 셈인데 숫자만 있고 사람이 없어, "2명 생존" 이
              * 누구를 말하는지 화면에서 알 수 없었다. 다만 정산 자체가 주인공이라
              * 조촐하게 둔다 - 카드가 아니라 한 줄씩이다.
              */}
            <Returned settlement={settlement} />

            {/*
              * 화면을 넘기는 버튼은 오른쪽 아래에 둔다.
              *
              * 왼쪽 본문 안에 두면 읽는 자리를 좁히고, 오른쪽 아래는 비어 있었다.
              * 다음으로 가는 길은 화면 끝에 있는 편이 찾기 쉽다.
              */}
            {onContinue !== undefined && (
              <button type="button" className="u6-settlement-continue" onClick={onContinue}>
                길드로 돌아간다
              </button>
            )}
          </div>
        }
        rightPanelLabel="캠페인 변화"
      />
    </div>
  );
}
