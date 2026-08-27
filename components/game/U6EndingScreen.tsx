import type { EndingKind } from "@/lib/domain";
import {
  ENDING_CONSEQUENCE_TITLE,
  ENDING_REPORT_TITLE,
  ENDING_TITLE,
  ENDING_SEAL_TONE,
  endingCrestSrc,
  isNormalCompletion,
  type U6EndingView,
} from "./u6-ending-model";
import { rankCrestSrc } from "./u6-settlement-model";

export interface U6EndingScreenProps {
  ending: U6EndingView;
  /**
   * 새 판으로 갈아 끼운다.
   *
   * 스토어를 쥔 쪽이 넘긴다. 이 화면은 이미 `/campaign` 이라 주소로는 새 판을
   * 세울 수 없다.
   */
  readonly onStartNewCampaign: () => void;
}

const ASSET = "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL";

/*
 * 길잡이의 방을 뒤에 깐다.
 *
 * 엔딩은 길잡이의 결말을 말하는 화면이다. 그 이야기가 어디서 끝나는가 하면
 * 그가 조언을 적던 그 책상이다 — 인트로에서 이미 본 자리다. 처음과 끝이 같은
 * 방이면 한 판이 닫힌다.
 */
const ENDING_BACKDROP = "/assets/u2/intro-background-full.png";

/*
 * 결말마다 다른 색 깃발.
 *
 * 네 색이 만들어져 있는데 하나도 쓰지 않고 있었다. 완주는 초록, 고발은 붉은색,
 * 불신은 검정, 실직과 소진은 푸른 쪽이다 — 문장을 읽기 전에 색으로 먼저 안다.
 */
const ENDING_BANNER: Readonly<Record<EndingKind, string>> = {
  completed: "green",
  denounced: "red",
  distrust: "black",
  exhausted: "black",
  unemployed: "blue",
};

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

export function U6EndingScreen({ ending, onStartNewCampaign }: U6EndingScreenProps) {
  const completed = isNormalCompletion(ending.kind);

  return (
    <div
      className={`u6-ending-shell u6-ending-shell--${ending.kind}`}
      data-testid="u6-ending"
      data-ending={ending.kind}
    >
      <div className="u6-ending-backdrop" aria-hidden="true">
        <img src={ENDING_BACKDROP} alt="" />
      </div>
      {/* 네 모서리를 여민다. 문서로 읽히게 하는 것은 테두리다. */}
      <img className="u6-ending-corner u6-ending-corner--tl" src={`${ASSET}/decorations/corner_deco.png`} alt="" aria-hidden="true" />
      <img className="u6-ending-corner u6-ending-corner--tr" src={`${ASSET}/decorations/corner_deco.png`} alt="" aria-hidden="true" />
      <img className="u6-ending-corner u6-ending-corner--bl" src={`${ASSET}/decorations/corner_deco.png`} alt="" aria-hidden="true" />
      <img className="u6-ending-corner u6-ending-corner--br" src={`${ASSET}/decorations/corner_deco.png`} alt="" aria-hidden="true" />

      <header className="u6-ending-head">
        <p className="u6-ending-head__eyebrow">캠페인 종료</p>
        {/*
          * 표제를 월계관이 감싼다.
          *
          * 문양 아래에 두었을 때는 등급 글자에 붙은 장식이라 군더더기였다.
          * 결말의 이름을 감싸면 그 이름이 이 화면의 중심이라는 말이 된다.
          */}
        <h1 className="u6-ending-head__title">
          <img src={`${ASSET}/emblems/laurel_left.png`} alt="" aria-hidden="true" />
          <span>{ENDING_TITLE[ending.kind]}</span>
          <img src={`${ASSET}/emblems/laurel_right.png`} alt="" aria-hidden="true" />
        </h1>
        <p className="u6-ending-head__subtitle">{ending.subtitle}</p>
        {/* 표제와 본문을 가르는 문양. 여기서부터 읽는 것이 달라진다. */}
        <img className="u6-ending-rule" src={`${ASSET}/decorations/ornament_arrow.png`} alt="" aria-hidden="true" />
        {/* 완주에는 큰 별을, 그 밖에는 작은 별을 얹는다. 무게가 다르다. */}
        <img
          className="u6-ending-star"
          src={`${ASSET}/emblems/star_${completed ? "large" : "small"}.png`}
          alt=""
          aria-hidden="true"
        />
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
          {/* 문양 뒤에 결말의 색을 깐다. */}
          <img
            className="u6-ending-emblem__banner"
            src={`${ASSET}/emblems/emblem_banner_${ENDING_BANNER[ending.kind]}.png`}
            alt=""
            aria-hidden="true"
          />
          <img
            className={completed
              ? "u6-ending-emblem__crest"
              : `u6-ending-emblem__crest is-seal is-${ENDING_SEAL_TONE[ending.kind]}`}
            src={completed ? rankCrestSrc(ending.finalRank) : endingCrestSrc(ending.kind)}
            alt=""
            aria-hidden="true"
            width={246}
            height={295}
          />
          {/*
            * 문양 아래에 이름표를 달지 않는다.
            *
            * 등급은 문양 한가운데에 이미 크게 적혀 있고, 「최종 등급」이나 「정상
            * 완주」 같은 말은 그림이 하는 말을 글로 한 번 더 하는 것이다. 깃발과
            * 문양만으로 충분하다.
            */}
        </div>

        <section className="u6-ending-card u6-report" aria-labelledby="u6-report-title">
          <h2 id="u6-report-title">{ENDING_REPORT_TITLE[ending.kind]}</h2>
          <ul>
            {ending.report.map((item) => (
              <li key={item}>
                {/*
                  * 완주한 판만 체크가 켜진다.
                  *
                  * 실패로 끝난 판의 보고서는 이룬 것의 목록이 아니라 그렇게 된
                  * 까닭의 목록이다. 거기에 체크를 켜 두면 실직이 업적처럼 읽힌다.
                  */}
                <img
                  src={`${ASSET}/controls/icon_check_${completed ? "on" : "off"}.png`}
                  alt=""
                  aria-hidden="true"
                  width={95}
                  height={81}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <img className="u6-report__seal" src={`${ASSET}/emblems/wax_seal.png`} alt="" aria-hidden="true" width={173} height={185} />
        </section>
      </div>

      <img className="u6-ending-divider" src={`${ASSET}/decorations/divider_main.png`} alt="" aria-hidden="true" />

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
            {/* 전멸 횟수만 두면 분모가 없다. 다섯 번 중 셋인지 스무 번 중 셋인지 알 수 없다. */}
            <ResultRow
              icon="icon_expeditions"
              label="원정"
              value={`${ending.totalExpeditions}회 · 클리어 ${ending.clearedExpeditions} · 전멸 ${ending.wipedExpeditions}`}
            />
            <ResultRow
              icon="icon_expeditions"
              label="도달 깊이"
              value={ending.highestDungeonCleared === 0
                ? "클리어한 던전 없음"
                : `던전 ${ending.highestDungeonCleared}번째까지`}
            />
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

      {/*
        * 나가는 자리에는 제 판이 있다.
        *
        * `button_back` 이 그 용도로 그려져 있는데 쓰지 않고 있었다. 그림을 판으로
        * 깔고 글자를 그 위에 얹는다.
        *
        * 문서를 새로 부르지 않는다. 휴대폰에서 전체 화면과 가로 잠금은 문서에
        * 매여 있어서, 문서가 바뀌면 둘 다 풀리고 「가로로 돌려 주세요」가 다시
        * 뜬다. 이 화면은 이미 `/campaign` 이라 주소로는 새 판을 세울 수 없으므로,
        * 스토어를 새 판으로 갈아 끼운다. 화면은 `phase` 가 정하니 인트로가
        * 저절로 나온다.
        */}
      <button className="u6-ending-cta" type="button" onClick={onStartNewCampaign}>
        <img className="u6-ending-cta__plate" src={`${ASSET}/controls/button_back.png`} alt="" aria-hidden="true" />
        <img src={`${ASSET}/controls/icon_button_handshake.png`} alt="" aria-hidden="true" width={140} height={91} />
        <strong>새 캠페인 시작</strong>
        <img className="u6-ending-cta__arrow" src={`${ASSET}/controls/icon_arrow.png`} alt="" aria-hidden="true" width={96} height={59} />
      </button>
    </div>
  );
}
