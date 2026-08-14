"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { MOCK_CARDS } from "@/lib/mock";
import {
  createInfoCardHarnessResult,
  type HarnessAudience,
} from "@/lib/dev-tools/test-snapshots";
import type { InfoCardEvaluation, InfoReaction } from "@/lib/rules/info";

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

function PartyResults({
  evaluation,
  party,
}: {
  evaluation: Extract<InfoCardEvaluation, { audience: "party" }>;
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

function BossResult({
  evaluation,
}: {
  evaluation: Extract<InfoCardEvaluation, { audience: "boss" }>;
}) {
  return (
    <article className="rounded border border-edge p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-parchment">보스</h3>
        <span className={reactionStyle(evaluation.reaction)}>
          {REACTION_LABELS[evaluation.reaction]}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">반응</dt>
          <dd>{REACTION_LABELS[evaluation.reaction]}</dd>
        </div>
        <div>
          <dt className="text-muted">미검증 거짓</dt>
          <dd>{formatFlag(evaluation.pendingVerification)}</dd>
        </div>
        <div>
          <dt className="text-muted">의심 검증</dt>
          <dd>{formatFlag(evaluation.pendingSuspicionEvaluation)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">보스 정보 카드 판정은 신뢰도 판정을 사용하지 않습니다.</p>
    </article>
  );
}

export function InfoCardTestPanel() {
  const [draftSeed, setDraftSeed] = useState(DEFAULT_SEED);
  const [draftAudience, setDraftAudience] = useState<HarnessAudience>("party");
  const [draftCardIndex, setDraftCardIndex] = useState(0);
  const [selection, setSelection] = useState({
    seed: DEFAULT_SEED,
    audience: "party" as HarnessAudience,
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
    setSelection({
      seed,
      audience: draftAudience,
      cardIndex: draftCardIndex,
    });
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
          이미 선택한 카드 한 장을 파티 또는 보스에게 전달했을 때의 순수 판정 결과를
          확인합니다. 같은 seed와 선택은 같은 결과를 재현합니다.
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

          <fieldset className="flex flex-wrap gap-5">
            <legend className="sr-only">정보 대상</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="info-card-audience"
                value="party"
                checked={draftAudience === "party"}
                onChange={() => setDraftAudience("party")}
              />
              살아 있는 파티원 전체
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="info-card-audience"
                value="boss"
                checked={draftAudience === "boss"}
                onChange={() => setDraftAudience("boss")}
              />
              보스
            </label>
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
            {TRUTH_LABELS[selectedCard.truthType]} · {selection.audience === "party" ? "파티" : "보스"}
          </p>
          <h2 className="text-xl font-semibold">{selectedCard.topic}</h2>
          <p className="text-sm text-muted">{selectedCard.text}</p>
        </div>
      </Panel>

      <Panel title="판정 결과">
        {result.evaluation.audience === "party" ? (
          <PartyResults evaluation={result.evaluation} party={result.party} />
        ) : (
          <BossResult evaluation={result.evaluation} />
        )}
      </Panel>

      <Panel title="규칙 해석">
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          <li>진실 수용은 actHonestly, 거짓 수용은 deceptionAccepted를 즉시 적용합니다.</li>
          <li>중립 수용과 의심은 즉시 신뢰를 바꾸지 않으며, 의심한 정보의 효과도 적용하지 않습니다.</li>
          <li>거짓 적발은 deceptionExposed를 적용하고, 수용된 거짓은 나중에 검증할 수 있도록 남깁니다.</li>
          <li>신뢰도 0의 게임 오버 실행과 사후 의심 결과 반영은 후속 게임 흐름 범위입니다.</li>
        </ul>
      </Panel>
    </main>
  );
}
