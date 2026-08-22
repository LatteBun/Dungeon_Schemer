"use client";

import { useState } from "react";
import { GameShell } from "./GameShell";
import { PartyMemberCard } from "./PartyMemberCard";
import type { TopStatusView } from "./TopStatusBar";
import {
  U5_LOG_FILTERS,
  U5_LOG_FILTER_LABEL,
  filterLog,
  type U5EcologyView,
  type U5LogEntry,
  type U5LogFilter,
} from "./u5-log";
import { sceneSrc, type U5ProgressView } from "./u5-progress-model";

export type U5ConsoleMode = "advice" | "log";

export interface U5ProgressScreenProps {
  status: TopStatusView;
  progress: U5ProgressView;
  log: readonly U5LogEntry[];
  ecology: U5EcologyView;
  /** 슬롯 번호로 받는다. 화면은 조언 식별자를 모른다. */
  onSelectAdvice?: (slot: number) => void;
  initialMode?: U5ConsoleMode;
  initialFilter?: U5LogFilter;
}

const REACTION_LABEL = {
  accepted: "수용",
  suspected: "의심",
  exposed: "적발",
} as const;

/**
 * 조언 하나. 세 개가 같은 클래스와 같은 구조로 그려진다.
 *
 * 슬롯 번호 말고는 서로 다른 표시가 없어야 한다. 유형·정합·확률·신뢰 변화는
 * View 에 아예 없으므로 여기서 실수로도 드러낼 수 없다.
 */
function AdviceOption({ slot, text, rationale, goldCost, onSelect }: {
  slot: number;
  text: string;
  rationale: string;
  goldCost?: number;
  onSelect?: (slot: number) => void;
}) {
  return (
    <li className="u5-advice">
      <button type="button" className="u5-advice__button" onClick={() => onSelect?.(slot)}>
        {/* 번호는 자리이지 유형이 아니다. 슬롯마다 색을 달리하지 않는다. */}
        <span className="u5-advice__slot" aria-hidden="true">{slot + 1}</span>
        <strong className="u5-advice__text">{text}</strong>
        <span className="u5-advice__divider" aria-hidden="true" />
        <span className="u5-advice__rationale">{rationale}</span>
        {goldCost === undefined ? null : (
          <span className="u5-advice__cost">골드 {goldCost}</span>
        )}
      </button>
    </li>
  );
}

function Outcome({ outcome }: { outcome: NonNullable<U5ProgressView["outcome"]> }) {
  return (
    <div className="u5-outcome" data-testid="u5-outcome">
      <section className="u5-outcome__step" aria-labelledby="u5-reactions-title">
        <h4 id="u5-reactions-title">파티원별 반응</h4>
        <ul className="u5-reactions">
          {outcome.reactions.map((reaction) => (
            <li key={reaction.memberName} className={`u5-reaction is-${reaction.reaction}`}>
              <strong>{reaction.memberName}</strong>
              <span className="u5-reaction__verdict">{REACTION_LABEL[reaction.reaction]}</span>
              <span className="u5-reaction__note">{reaction.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="u5-outcome__step" aria-labelledby="u5-result-title">
        <h4 id="u5-result-title">사건 결과</h4>
        <p className="u5-outcome__result">{outcome.resultText}</p>
      </section>

      <section className="u5-outcome__step" aria-labelledby="u5-changes-title">
        <h4 id="u5-changes-title">수치·신뢰 변화</h4>
        <dl className="u5-changes">
          {outcome.changes.map((change) => (
            <div key={change.label}>
              <dt>{change.label}</dt>
              <dd>{change.detail}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function LogPanel({ log, ecology, filter, onFilter }: {
  log: readonly U5LogEntry[];
  ecology: U5EcologyView;
  filter: U5LogFilter;
  onFilter: (next: U5LogFilter) => void;
}) {
  return (
    <div className="u5-log" data-testid="u5-log">
      <nav className="u5-log__filters" aria-label="진행 기록 필터">
        {U5_LOG_FILTERS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={candidate === filter ? "is-active" : ""}
            aria-pressed={candidate === filter}
            onClick={() => onFilter(candidate)}
          >
            {U5_LOG_FILTER_LABEL[candidate]}
          </button>
        ))}
      </nav>

      {filter === "ecology" ? (
        <div className="u5-ecology" data-testid="u5-ecology">
          <section aria-labelledby="u5-ecology-rules">
            <h4 id="u5-ecology-rules">확인된 생태</h4>
            <ul>
              {ecology.disclosedRules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
          </section>
          <section aria-labelledby="u5-ecology-clues">
            <h4 id="u5-ecology-clues">관찰 단서</h4>
            <ul>
              {ecology.observedClues.map((clue) => <li key={clue}>{clue}</li>)}
            </ul>
          </section>
        </div>
      ) : (
        <ol className="u5-log__entries">
          {filterLog(log, filter).map((entry) => (
            <li key={entry.order}>
              <span className="u5-log__order">{entry.order}</span>
              <strong>{entry.label}</strong>
              <span>{entry.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function U5ProgressScreen({
  status,
  progress,
  log,
  ecology,
  onSelectAdvice,
  initialMode,
  initialFilter = "all",
}: U5ProgressScreenProps) {
  /*
   * 행동 / 조언을 전면에 둔다. 선택 뒤 결과(반응 → 결과 → 변화)도 이 모드에
   * 있으므로 자동으로 진행 기록으로 넘기면 플레이어가 결과를 놓친다. 규격은
   * 진행 기록으로 "전환할 수 있다" 이지 자동으로 넘어간다가 아니다.
   */
  const [mode, setMode] = useState<U5ConsoleMode>(initialMode ?? "advice");
  const [filter, setFilter] = useState<U5LogFilter>(initialFilter);

  return (
    <div className="u5-progress-screen" data-testid="u5-progress">
      <GameShell
        status={status}
        screenTitle={`${progress.dungeonName} · ${progress.nodeLabel}`}
        main={
          <div className="u5-main">
            <div
              className="u5-scene"
              data-testid="u5-scene"
              data-scene-kind={progress.sceneKind}
              style={{ backgroundImage: `url("${sceneSrc(progress.theme, progress.sceneKind)}")` }}
              aria-hidden="true"
            />

            <div className="u5-console" data-testid="u5-console">
              <nav className="u5-console__tabs" aria-label="콘솔 모드">
                <button type="button" className={mode === "advice" ? "is-active" : ""} aria-pressed={mode === "advice"} onClick={() => setMode("advice")}>
                  행동 / 조언
                </button>
                <button type="button" className={mode === "log" ? "is-active" : ""} aria-pressed={mode === "log"} onClick={() => setMode("log")}>
                  진행 기록
                </button>
              </nav>

              {mode === "advice" ? (
                <div className="u5-advice-mode">
                  {/* 상황 묘사가 추론의 근거를 실어 나르므로 조언보다 먼저 온다. */}
                  <p className="u5-situation" data-testid="u5-situation">{progress.situation}</p>

                  {progress.outcome === null ? (
                    <ul className="u5-advice-list" data-testid="u5-advice-list">
                      {progress.advice.map((option) => (
                        <AdviceOption
                          key={option.slot}
                          slot={option.slot}
                          text={option.text}
                          rationale={option.rationale}
                          goldCost={option.goldCost}
                          onSelect={onSelectAdvice}
                        />
                      ))}
                    </ul>
                  ) : (
                    <Outcome outcome={progress.outcome} />
                  )}
                </div>
              ) : (
                <LogPanel log={log} ecology={ecology} filter={filter} onFilter={setFilter} />
              )}
            </div>
          </div>
        }
        rightPanel={
          <section className="panel-section u5-party" data-testid="u5-party" aria-labelledby="u5-party-title">
            <h3 id="u5-party-title">파티 상태</h3>
            <ul className="party-list">
              {progress.party.map((member) => (
                <li key={member.id}>
                  <PartyMemberCard member={member} testId="u5-party-member" />
                </li>
              ))}
            </ul>
          </section>
        }
        rightPanelLabel="파티 상태"
      />
    </div>
  );
}
