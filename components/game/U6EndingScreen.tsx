import { GameShell } from "./GameShell";
import type { TopStatusView } from "./TopStatusBar";
import { ENDING_TITLE, endingCrestSrc, isNormalCompletion, type U6EndingView } from "./u6-ending-model";
import { rankCrestSrc } from "./u6-settlement-model";

export interface U6EndingScreenProps {
  status: TopStatusView;
  ending: U6EndingView;
}

const STAT_ICON = "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/stats";

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="u6-stat">
      <img src={`${STAT_ICON}/${icon}.png`} alt="" aria-hidden="true" width={120} height={120} />
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function U6EndingScreen({ status, ending }: U6EndingScreenProps) {
  const completed = isNormalCompletion(ending.kind);

  return (
    <div className="u6-result-screen u6-result-screen--ending" data-testid="u6-ending">
      <GameShell
        status={status}
        screenTitle="캠페인 종료"
        main={
          <div className="u6-ending-main">
            <section className="u6-ending-verdict" data-testid="u6-ending-verdict">
              <img
                className="u6-ending-verdict__crest"
                src={endingCrestSrc(ending.kind)}
                alt=""
                aria-hidden="true"
                width={144}
                height={170}
              />
              <p className="u6-ending-verdict__eyebrow">{completed ? "정상 완주" : "조기 종료"}</p>
              <h2>{ENDING_TITLE[ending.kind]}</h2>
              <p className="u6-ending-verdict__reason">{ending.reason}</p>
            </section>

            <section className="u6-final-rank" aria-labelledby="u6-final-rank-title">
              <h3 id="u6-final-rank-title">최종 등급</h3>
              <img src={rankCrestSrc(ending.finalRank)} alt="" aria-hidden="true" width={246} height={295} />
              <strong>{ending.finalRank}</strong>
              <p>
                {completed
                  ? "던전 15개를 모두 정리했다. 어느 등급이든 정상 완주다."
                  : "여기서 멈춘 것이 이 캠페인의 결말이다."}
              </p>
            </section>
          </div>
        }
        rightPanel={
          <div className="u6-ending-side">
            <section className="u6-ending-block" aria-labelledby="u6-stats-title">
              <h3 id="u6-stats-title">회고</h3>
              <p className="u6-ending-block__lead">어떤 선택이 이 결말을 만들었는가?</p>
              <dl className="u6-stats" data-testid="u6-stats">
                <Stat icon="icon_expeditions" label="원정" value={`${ending.expeditionCount}회`} />
                <Stat icon="icon_survived" label="생환" value={`${ending.survivedCount}명`} />
                <Stat icon="icon_dead" label="사망" value={`${ending.diedCount}명`} />
                <Stat icon="icon_trust" label="신뢰 0" value={`${ending.zeroTrustCount}명`} />
                <Stat icon="icon_reputation" label="최종 명성" value={`${ending.finalReputation}`} />
                <Stat icon="icon_gold" label="누적 골드" value={`${ending.cumulativeGold}`} />
              </dl>
              <ul className="u6-advice-stats">
                {ending.adviceStats.map((stat) => (
                  <li key={stat.label}>
                    <img src={`${STAT_ICON}/icon_advice.png`} alt="" aria-hidden="true" width={132} height={120} />
                    <strong>{stat.label}</strong>
                    <span>
                      전달 {stat.given} · 적발 {stat.caught}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="u6-ending-block u6-turning-point" data-testid="u6-turning-point" aria-labelledby="u6-turning-title">
              <h3 id="u6-turning-title">가장 큰 전환점</h3>
              {ending.turningPoint === null ? (
                <p>전환점이라 부를 만한 원정이 없었다.</p>
              ) : (
                <>
                  <strong>{ending.turningPoint.label}</strong>
                  <p>{ending.turningPoint.detail}</p>
                </>
              )}
            </section>

            <section className="u6-ending-block" aria-labelledby="u6-chronicle-title">
              <h3 id="u6-chronicle-title">원정 연대기</h3>
              <ol className="u6-chronicle" data-testid="u6-chronicle">
                {ending.chronicle.map((entry) => (
                  <li key={entry.worldTurn}>
                    <span className="u6-chronicle__turn">{entry.worldTurn}</span>
                    <span className="u6-chronicle__dungeon">{entry.dungeonName}</span>
                    <span className="u6-chronicle__outcome">{entry.outcome}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        }
        rightPanelLabel="캠페인 회고"
      />
    </div>
  );
}
