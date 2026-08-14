"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { MOCK_CARDS } from "@/lib/mock";
import { createInfoCardHarnessResult } from "@/lib/dev-tools/test-snapshots";
import type { InfoReaction, PartyInfoCardEvaluation } from "@/lib/rules/info";
import type { PartyMember } from "@/lib/domain";

const DEFAULT_SEED = "info-card-ui-seed";
const TRUTH_LABELS = {
  truth: "진실",
  lie: "거짓",
  neutral: "중립",
} as const;
const REACTION_LABELS: Record<InfoReaction, string> = {
  accepted: "수용",
  suspected: "의심",
  exposed: "적발",
};

function signed(value: number): string {
  return value > 0 ? "+" + value : String(value);
}

function reactionStyle(reaction: InfoReaction): string {
  if (reaction === "accepted") return "text-trust-up";
  if (reaction === "exposed") return "text-trust-down";
  return "text-muted";
}

function formatFlag(value: boolean): string {
  return value ? "활성" : "없음";
}

function formatModifier(value: number): string {
  return value === 0 ? "없음" : signed(Math.round(value * 100)) + "%";
}

function PartyResults({
  evaluation,
  party,
}: {
  evaluation: PartyInfoCardEvaluation<PartyMember>;
  party: ReturnType<typeof createInfoCardHarnessResult>["party"];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {evaluation.memberResults.map((entry) => {
        const original = party.find((member) => member.id === entry.member.id);
        const trustChange = entry.trustEvaluation?.change;
        return (
          <article key={entry.member.id} className="rounded border border-edge p-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-parchment">{entry.member.name}</h3>
              <span className={reactionStyle(entry.reaction)}>
                {REACTION_LABELS[entry.reaction]}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <dt className="text-muted">성격</dt>
                <dd>{entry.member.personality}</dd>
              </div>
              <div>
                <dt className="text-muted">신뢰</dt>
                <dd>
                  {original?.trust ?? entry.member.trust} → {entry.member.trust}
                </dd>
              </div>
              <div>
                <dt className="text-muted">즉시 변화</dt>
                <dd className={reactionStyle(entry.reaction)}>
                  {trustChange === undefined ? "없음" : signed(trustChange.delta)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">정체 발각</dt>
                <dd>{trustChange === undefined ? "없음" : String(entry.trustEvaluation?.exposed)}</dd>
              </div>
              <div>
                <dt className="text-muted">미검증 거짓</dt>
                <dd>{formatFlag(entry.pendingVerification)}</dd>
              </div>
              <div>
                <dt className="text-muted">의심 검증</dt>
                <dd>{formatFlag(entry.pendingSuspicionEvaluation)}</dd>
              </div>
              <div>
                <dt className="text-muted">보스 피해 보정</dt>
                <dd>{formatModifier(entry.bossDamageModifier)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              {trustChange?.reason ?? "즉시 신뢰 변화 없음"}
            </p>
          </article>
        );
      })}
    </div>
  );
}

export function InfoCardTestPanel() {
  const [draftSeed, setDraftSeed] = useState(DEFAULT_SEED);
  const [draftCardIndex, setDraftCardIndex] = useState(0);
  const [selection, setSelection] = useState({
    seed: DEFAULT_SEED,
    cardIndex: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const result = useMemo(
    () => createInfoCardHarnessResult(selection),
    [selection],
  );
  const selectedCard = MOCK_CARDS[selection.cardIndex];

  function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const seed = draftSeed.trim();
    if (seed === "") {
      setError("seed를 입력해 주세요.");
      return;
    }
    setSelection({ seed, cardIndex: draftCardIndex });
    setError(null);
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 p-6 sm:p-10">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          Development test harness · Info Card Evaluation
        </p>
        <h1 className="text-3xl font-bold text-parchment">정보 카드 판정 테스트</h1>
        <p className="max-w-3xl text-sm text-muted">
          이미 선택한 카드 한 장을 살아 있는 파티원 전체에게 전달했을 때의 순수 판정
          결과를 확인합니다. 보스는 카드의 주제일 수 있지만 수신자가 아닙니다. 같은
          seed와 선택은 같은 결과를 재현합니다.
        </p>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link className="rounded border border-edge px-3 py-2 hover:bg-edge" href="/integration-test">
            전체 통합 테스트
          </Link>
          <Link className="rounded border border-edge px-3 py-2 hover:bg-edge" href="/state-preview">
            상태 스토어 미리보기
          </Link>
        </nav>
      </header>

      <Panel title="판정 입력">
        <form className="space-y-5" onSubmit={handleRun}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-muted">카드 선택</legend>
            <div className="grid gap-3 md:grid-cols-3">
              {MOCK_CARDS.map((card, index) => (
                <button
                  key={card.id}
                  type="button"
                  aria-pressed={draftCardIndex === index}
                  className={
                    "rounded border p-3 text-left " +
                    (draftCardIndex === index
                      ? "border-trust-up bg-edge"
                      : "border-edge")
                  }
                  onClick={() => setDraftCardIndex(index)}
                >
                  <span className="block font-semibold">{TRUTH_LABELS[card.truthType]}</span>
                  <span className="mt-1 block text-sm text-muted">{card.topic}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-64 flex-col gap-1 text-sm" htmlFor="info-card-seed">
              재현할 seed
              <input
                id="info-card-seed"
                className="rounded border border-edge bg-ink px-3 py-2 text-parchment"
                value={draftSeed}
                onChange={(event) => setDraftSeed(event.target.value)}
              />
            </label>
            <button className="rounded border border-trust-up px-4 py-2" type="submit">
              판정 실행
            </button>
          </div>
          {error === null ? null : <p role="alert" className="text-trust-down">{error}</p>}
        </form>
      </Panel>

      <Panel title="선택된 카드" aside={<span className="text-xs text-muted">{selection.seed}</span>}>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted">
            {TRUTH_LABELS[selectedCard.truthType]} · 주제 {selectedCard.subject}
          </p>
          <h2 className="text-xl font-semibold">{selectedCard.topic}</h2>
          <p className="text-sm text-muted">{selectedCard.text}</p>
        </div>
      </Panel>

      <Panel title="판정 결과">
        <PartyResults evaluation={result.evaluation} party={result.party} />
      </Panel>

      <Panel title="규칙 해석">
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          <li>진실 수용은 actHonestly, 거짓 수용은 deceptionAccepted를 즉시 적용합니다.</li>
          <li>중립 수용과 의심은 즉시 신뢰를 바꾸지 않으며, 의심한 정보의 효과도 적용하지 않습니다.</li>
          <li>거짓 적발은 deceptionExposed를 적용하고, 수용된 거짓은 나중에 검증할 수 있도록 남깁니다.</li>
          <li>보스 피해 보정은 주제가 boss인 카드를 수용했을 때만 생깁니다. 여러 장의 합산과 -30%~+50% 상한은 보스전이 처리합니다.</li>
          <li>신뢰도 0의 게임 오버 실행과 사후 의심 결과 반영은 후속 게임 흐름 범위입니다.</li>
        </ul>
      </Panel>
    </main>
  );
}
