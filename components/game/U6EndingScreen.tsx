import {
  ENDING_CONSEQUENCE_TITLE,
  ENDING_REPORT_TITLE,
  ENDING_TITLE,
  endingCrestSrc,
  isNormalCompletion,
  type U6EndingView,
} from "./u6-ending-model";
import { rankCrestSrc } from "./u6-settlement-model";

export interface U6EndingScreenProps {
  ending: U6EndingView;
  onReturnToBoard?: () => void;
}

const ASSET = "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL";

/** 결말 항목 넷은 서로 다른 문양을 쓴다. 같은 그림이면 항목이 구분되지 않는다. */
const CONSEQUENCE_ICONS = [
  "achievement_conquest",
  "achievement_guild",
  "achievement_return",
  "achievement_together",
] as const;

/*
 * 셸의 3:2 열을 쓰지 않는다. 캠페인이 끝난 화면이라 전체를 하나의 그림으로
 * 쓴다. 인트로가 같은 이유로 전체 폭을 쓰는 것과 같다. 상단 상태 바도 두지
 * 않는다. 더 볼 자원이 없기 때문이다.
 * 시안: docs/experience/reference/u6-ending/README.md
 */

function ResultRow({ icon, label, value, tone }: {
  icon: string;
  label: string;
  value: string;
  tone?: "loss" | "gain";
}) {
  return (
    <div className={`u6-result-row${tone ? ` is-${tone}` : ""}`}>
      <img src={`${ASSET}/stats/${icon}.png`} alt="" aria-hidden="true" width={120} height={120} />
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function U6EndingScreen({ ending, onReturnToBoard }: U6EndingScreenProps) {
  const completed = isNormalCompletion(ending.kind);

  return (
    <div
      className={`u6-ending-shell u6-ending-shell--${ending.kind}`}
      data-testid="u6-ending"
      data-ending={ending.kind}
    >
      <div className="u6-ending-backdrop" aria-hidden="true" />

      <header className="u6-ending-head">
        <p className="u6-ending-head__eyebrow">캠페인 종료</p>
        <h1>{ENDING_TITLE[ending.kind]}</h1>
        <p className="u6-ending-head__subtitle">{ending.subtitle}</p>
      </header>

      <div className="u6-ending-stage">
        <section className="u6-ending-card u6-reasons" data-testid="u6-ending-verdict" aria-labelledby="u6-reasons-title">
          <h2 id="u6-reasons-title">결말의 이유</h2>
          <ul>
            {ending.reasons.map((reason) => (
              <li key={reason}>
                <img src={`${ASSET}/decorations/ornament_diamond.png`} alt="" aria-hidden="true" width={57} height={58} />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="u6-ending-emblem">
          <p className="u6-ending-emblem__label">{completed ? "최종 등급" : "결말의 문양"}</p>
          <img
            className="u6-ending-emblem__crest"
            src={completed ? rankCrestSrc(ending.finalRank) : endingCrestSrc(ending.kind)}
            alt=""
            aria-hidden="true"
            width={246}
            height={295}
          />
          <p className="u6-ending-emblem__rank">
            <span>{ending.finalRank}</span>
            <small>{completed ? "정상 완주" : "조기 종료"}</small>
          </p>
        </div>

        <section className="u6-ending-card u6-report" aria-labelledby="u6-report-title">
          <h2 id="u6-report-title">{ENDING_REPORT_TITLE[ending.kind]}</h2>
          <ul>
            {ending.report.map((item) => (
              <li key={item}>
                <img src={`${ASSET}/controls/icon_check_on.png`} alt="" aria-hidden="true" width={95} height={81} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <img className="u6-report__seal" src={`${ASSET}/emblems/wax_seal.png`} alt="" aria-hidden="true" width={173} height={185} />
        </section>
      </div>

      <div className="u6-ending-panels">
        <section className="u6-ending-card" aria-labelledby="u6-final-result-title">
          <h2 id="u6-final-result-title">최종 결과</h2>
          <dl className="u6-result-list" data-testid="u6-stats">
            <ResultRow icon="icon_survived" label="생존" value={`${ending.survivedCount}`} tone="gain" />
            <ResultRow icon="icon_dead" label="사망" value={`${ending.diedCount}`} tone="loss" />
            <ResultRow icon="icon_reputation" label="명성" value={`${ending.finalReputation}`} />
            <ResultRow icon="icon_gold" label="획득 골드" value={`${ending.cumulativeGold}`} />
            <ResultRow
              icon="icon_trust"
              label="신뢰 0"
              value={`파티원 ${ending.zeroTrustPartySize}`}
            />
          </dl>
        </section>

        <section className="u6-ending-card" aria-labelledby="u6-campaign-title">
          <h2 id="u6-campaign-title">당신의 캠페인</h2>
          <dl className="u6-result-list">
            <ResultRow icon="icon_advice" label="누적 조언" value={`${ending.adviceTotal}회`} />
            <ResultRow icon="icon_expeditions" label="전멸 원정" value={`${ending.wipedExpeditions}회`} />
          </dl>
          <div className="u6-turning" data-testid="u6-turning-point">
            <img src={`${ASSET}/stats/icon_turning_point.png`} alt="" aria-hidden="true" width={142} height={115} />
            <span>가장 큰 전환점</span>
            {ending.turningPoint === null ? (
              <strong>전환점이라 부를 만한 원정이 없었다</strong>
            ) : (
              <strong>
                {ending.turningPoint.label}
                <small>{ending.turningPoint.detail}</small>
              </strong>
            )}
          </div>
          <p className="u6-chronicle-summary" data-testid="u6-chronicle">
            <span>원정 연대기 요약</span>
            {ending.chronicleSummary}
          </p>
        </section>

        <section className="u6-ending-card" aria-labelledby="u6-consequence-title">
          <h2 id="u6-consequence-title">{ENDING_CONSEQUENCE_TITLE[ending.kind]}</h2>
          <ul className="u6-consequences" data-testid="u6-consequences">
            {ending.consequences.map((note, index) => (
              <li key={note.label}>
                <img src={`${ASSET}/achievements/${CONSEQUENCE_ICONS[index % CONSEQUENCE_ICONS.length]}.png`} alt="" aria-hidden="true" width={144} height={165} />
                <div>
                  <strong>{note.label}</strong>
                  {note.detail ? <small>{note.detail}</small> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="u6-ending-quote">
        <img src={`${ASSET}/controls/quote_left.png`} alt="" aria-hidden="true" width={86} height={71} />
        {ending.subtitle}
        <img src={`${ASSET}/controls/quote_right.png`} alt="" aria-hidden="true" width={86} height={72} />
      </p>

      <button type="button" className="u6-ending-cta" onClick={onReturnToBoard}>
        <img src={`${ASSET}/controls/icon_button_handshake.png`} alt="" aria-hidden="true" width={140} height={91} />
        <strong>길드 게시판으로 돌아가기</strong>
        <img className="u6-ending-cta__arrow" src={`${ASSET}/controls/icon_arrow.png`} alt="" aria-hidden="true" width={96} height={59} />
      </button>
    </div>
  );
}
