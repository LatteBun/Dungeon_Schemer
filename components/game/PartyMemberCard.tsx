"use client";

/**
 * 파티원 카드 — 파티 상태를 보여주는 모든 화면이 함께 쓴다.
 *
 * U3·U4·U5 가 각자 카드를 그리면서 항목 순서와 표시가 갈렸다. 같은 파티원이
 * 화면마다 다르게 보이면 플레이어가 자리를 다시 배운다. 한 곳에 둔다.
 *
 * 카드 셋을 가로로 나란히 두고, 카드 안에서는 초상을 위에 크게 깐 뒤 정보를
 * 그 아래 둔다. 파티는 정확히 3명이라(EXPEDITION_PARTY_SIZE) 3열이 넘치거나
 * 모자라지 않는다. 원정 중 사망해도 슬롯은 셋 그대로다.
 *
 * HP 와 신뢰는 가로로 나란히 두지 않고 세로로 쌓아 각자 막대가 폭을 온전히
 * 쓰게 한다. 소지 골드는 라벨 문구 없이 아이콘과 금액을 붙여 둔다. 골드는
 * 이름을 붙이지 않아도 아이콘으로 읽힌다.
 */

import { useState } from "react";
import { useReducedMotion } from "framer-motion";

export interface PartyMemberCardView {
  id: string;
  name: string;
  classLabel: string;
  personalityLabel: string;
  hp: number;
  maxHp: number;
  trust: number;
  gold: number;
  /** 초상 자산이 없는 화면은 비운다. 자리는 남긴다. */
  portraitSrc?: string;
  /** 원정 중이 아닌 화면은 항상 살아 있다. */
  alive?: boolean;
}

export interface PartyMemberChangeEntry {
  /** 무엇 때문에 그렇게 됐는가. */
  readonly cause: string;
  readonly reaction?: string;
  readonly hp?: { readonly before: number; readonly after: number };
  readonly trust?: { readonly before: number; readonly after: number };
}

export interface PartyMemberSettledResult {
  readonly hpDelta?: number;
  readonly trustDelta?: number;
}

export interface PartyMemberCardProps {
  member: PartyMemberCardView;
  /** 화면별 접두사. U3 는 순번을 함께 보여준다. */
  index?: number;
  testId?: string;
  /*
   * 이 원정에서 그 사람에게 일어난 일.
   *
   * 주면 카드를 뒤집을 수 있다. 원정 밖 화면에는 되짚을 원정이 없으므로 주지
   * 않고, 그때는 카드가 뒤집히지 않는다.
   */
  changes?: readonly PartyMemberChangeEntry[];
  effect?: { readonly kind: "hp" | "trust"; readonly delta: number; readonly token: string };
  /** 현재 결과에서 확인을 마친 변화량. 다음 화면으로 이동할 때까지 앞면에 남긴다. */
  settledResult?: PartyMemberSettledResult;
  /** U5 결과 카드처럼 변화량 유무와 무관하게 결과 한 줄의 높이를 유지한다. */
  reserveSettledResultSpace?: boolean;
}

const GOLD_ICON = "/assets/u2/status-gold.svg";

/** 이 원정에서 얼마나 달라졌는가. 처음 값과 마지막 값만 본다. */
function netOf(
  changes: readonly PartyMemberChangeEntry[],
  pick: (entry: PartyMemberChangeEntry) => { readonly before: number; readonly after: number } | undefined,
): { readonly before: number; readonly after: number } | undefined {
  const seen = changes.map(pick).filter((one) => one !== undefined);
  const first = seen[0];
  const last = seen[seen.length - 1];
  return first === undefined || last === undefined ? undefined : { before: first.before, after: last.after };
}

function NetChange({ changes }: { changes: readonly PartyMemberChangeEntry[] }) {
  const hp = netOf(changes, (entry) => entry.hp);
  const trust = netOf(changes, (entry) => entry.trust);
  if (hp === undefined && trust === undefined) return null;

  return (
    <dl className="party-card__net">
      {hp === undefined ? null : (
        <div className={hp.after < hp.before ? "is-down" : "is-up"}>
          <dt>HP</dt>
          <dd>
            <b>{hp.after - hp.before > 0 ? `+${hp.after - hp.before}` : hp.after - hp.before}</b>
            <small>{hp.before} → {hp.after}</small>
          </dd>
        </div>
      )}
      {trust === undefined ? null : (
        <div className={trust.after < trust.before ? "is-down" : "is-up"}>
          <dt>신뢰</dt>
          <dd>
            <b>{trust.after - trust.before > 0 ? `+${trust.after - trust.before}` : trust.after - trust.before}</b>
            <small>{trust.before} → {trust.after}</small>
          </dd>
        </div>
      )}
    </dl>
  );
}

function percent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function signedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

export function PartyMemberCard({
  member,
  index,
  testId,
  changes,
  effect,
  settledResult,
  reserveSettledResultSpace = false,
}: PartyMemberCardProps) {
  const alive = member.alive ?? true;
  const reducedMotion = useReducedMotion() ?? false;
  const [flipped, setFlipped] = useState(false);
  const canFlip = changes !== undefined;
  const settledHp = settledResult?.hpDelta === 0 ? undefined : settledResult?.hpDelta;
  const settledTrust = settledResult?.trustDelta === 0 ? undefined : settledResult?.trustDelta;
  const hasSettledResult = settledHp !== undefined || settledTrust !== undefined;
  const showSettledResultSpace = reserveSettledResultSpace || hasSettledResult;

  /*
   * 뒤집을 수 있는 카드만 누를 수 있게 한다.
   *
   * 원정 밖에서는 되짚을 원정이 없다. 누를 수 없는 카드에 버튼 모양을 주면
   * 눌러 보고서야 아무 일도 없다는 것을 안다.
   */
  const face = (
    <article
      className={`party-card${alive ? "" : " is-dead"}${flipped ? " is-flipped" : ""}`}
      data-testid={testId ?? "party-member"}
    >
      <div className="party-card__portrait" aria-hidden={member.portraitSrc === undefined}>
        {index === undefined ? null : (
          <span className="party-card__number" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        {member.portraitSrc === undefined ? (
          <span className="party-card__portrait-empty" />
        ) : (
          <img src={member.portraitSrc} alt={`${member.name} 초상`} />
        )}
        {alive ? null : <strong className="party-card__death">사망</strong>}
      </div>

      <div className="party-card__content">
        <header className="party-card__identity">
          <strong>{member.name}</strong>
          <span>{member.classLabel}</span>
          <small>{member.personalityLabel}</small>
        </header>

        {/* HP 와 신뢰는 세로로 쌓는다. 막대가 폭을 온전히 써야 눈금이 읽힌다. */}
        <dl className="party-card__stats">
          <div className="party-card__stat">
            <dt>HP</dt>
            <dd>
              {member.hp} / {member.maxHp}
            </dd>
            <span className="party-meter" aria-hidden="true">
              <i style={{ width: `${alive ? percent(member.hp, member.maxHp) : 0}%` }} />
            </span>
            {effect?.kind === "hp" ? <output className="party-card__effect party-card__effect--hp" data-reduced-motion={reducedMotion} aria-live="polite">HP {effect.delta > 0 ? `+${effect.delta}` : `−${Math.abs(effect.delta)}`}</output> : null}
          </div>

          <div className="party-card__stat">
            <dt>신뢰</dt>
            <dd>{member.trust}</dd>
            <span className="party-meter party-meter--trust" aria-hidden="true">
              <i style={{ width: `${percent(member.trust, 100)}%` }} />
            </span>
            {effect?.kind === "trust" ? <output className="party-card__effect party-card__effect--trust" data-reduced-motion={reducedMotion} aria-live="polite">신뢰 {effect.delta > 0 ? `+${effect.delta}` : `−${Math.abs(effect.delta)}`}</output> : null}
          </div>

          {/* 라벨 문구를 두지 않는다. 아이콘과 금액이 붙어 있으면 읽힌다. */}
          <div className="party-card__gold">
            <dt>
              <img src={GOLD_ICON} alt="소지 골드" width={16} height={16} />
            </dt>
            <dd>{member.gold}</dd>
          </div>
        </dl>

        {showSettledResultSpace ? (
          <div
            className="party-card__settled-results"
            data-reduced-motion={reducedMotion}
            aria-live="polite"
            aria-hidden={hasSettledResult ? undefined : true}
          >
            {settledHp === undefined ? null : <output className="party-card__settled-result party-card__settled-result--hp">HP {signedDelta(settledHp)}</output>}
            {settledTrust === undefined ? null : <output className="party-card__settled-result party-card__settled-result--trust">신뢰 {signedDelta(settledTrust)}</output>}
          </div>
        ) : null}
      </div>

      {canFlip && (
        <div className="party-card__back" data-testid="party-member-changes">
          {/*
            * 뒤집혀도 누구인지는 남는다. 이름이 없으면 어느 카드인지 잃는다.
            *
            * 「이 원정에서」는 적지 않는다 - 아래 총합과 사슬이 이미 이 원정의
            * 것이고, 뒤집어 놓고 다시 설명할 자리가 아니다.
            */}
          <h4><strong>{member.name}</strong></h4>

          {/*
            * 이 원정의 총합을 먼저 크게 보여준다.
            *
            * 한 줄씩 훑어 더해야 얼마나 상했는지 알 수 있으면 되짚는 뜻이 없다.
            * 사슬은 그 아래에서 "왜" 를 말한다.
            */}
          <NetChange changes={changes} />
          {changes.length === 0 ? (
            <p className="party-card__back-empty">아직 아무 일도 없었다.</p>
          ) : (
            <ol className="party-card__changes">
              {changes.map((change, position) => (
                <li key={`${change.cause}-${position}`}>
                  <strong>{change.cause}</strong>
                  <span className="party-card__change-detail">
                    {[
                      change.reaction,
                      change.hp === undefined ? undefined : `HP ${change.hp.before} → ${change.hp.after}`,
                      change.trust === undefined ? undefined : `신뢰 ${change.trust.before} → ${change.trust.after}`,
                    ].filter((one) => one !== undefined).join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </article>
  );

  if (!canFlip) return face;

  return (
    <button
      type="button"
      className="party-card__flip"
      aria-pressed={flipped}
      aria-label={`${member.name} 카드 ${flipped ? "덮기" : "뒤집기"}`}
      onClick={() => setFlipped((current) => !current)}
    >
      {face}
    </button>
  );
}
