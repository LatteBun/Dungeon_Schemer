"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import {
  EVENT_KIND_LABELS,
  PERSONALITY_LABELS,
  PHASE_LABELS,
  TRUTH_TYPE_LABELS,
} from "@/components/game/labels";
import { MOCK_CARDS } from "@/lib/mock";
import {
  createIntegrationSnapshot,
  type HarnessAudience,
  type IntegrationSnapshot,
} from "@/lib/dev-tools/test-snapshots";
import {
  type InfoCardEvaluation,
  type InfoReaction,
} from "@/lib/rules/info";
import { TRUST_ACTIONS, type TrustAction } from "@/lib/rules/trust";

const DEFAULT_SEED = "integration-ui-seed";
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

function IntegrationInfoResults({
  evaluation,
}: {
  evaluation: InfoCardEvaluation;
}) {
  if (evaluation.audience === "boss") {
    return (
      <article className="rounded border border-edge p-3">
        <p className={reactionStyle(evaluation.reaction)}>
          보스 반응: {REACTION_LABELS[evaluation.reaction]}
        </p>
        <p className="mt-2 text-sm text-muted">
          미검증 거짓: {String(evaluation.pendingVerification)} · 의심 검증:{" "}
          {String(evaluation.pendingSuspicionEvaluation)}
        </p>
      </article>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {evaluation.memberResults.map((entry) => (
        <article key={entry.member.id} className="rounded border border-edge p-3">
          <div className="flex justify-between gap-3">
            <span>{entry.member.name}</span>
            <span className={reactionStyle(entry.reaction)}>
              {REACTION_LABELS[entry.reaction]}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">
            신뢰: {entry.member.trust} · 즉시 delta:{" "}
            {entry.trustEvaluation === null
              ? "없음"
              : signed(entry.trustEvaluation.change.delta)}
          </p>
          <p className="mt-1 text-xs text-muted">
            미검증 {String(entry.pendingVerification)} · 의심 검증{" "}
            {String(entry.pendingSuspicionEvaluation)}
          </p>
        </article>
      ))}
    </div>
  );
}

function PartySection({ snapshot }: { snapshot: IntegrationSnapshot }) {
  return (
    <Panel title="R1 · 파티 생성">
      <div className="mb-3 grid gap-2 text-sm sm:grid-cols-3">
        <p>인원: {snapshot.party.length}</p>
        <p>생존자: {snapshot.party.filter((member) => member.alive).length}</p>
        <p>선택 대상: {snapshot.party[snapshot.selectedMemberIndex]?.name}</p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {snapshot.party.map((member, index) => (
          <li
            key={member.id}
            className={
              "rounded border p-3 " +
              (index === snapshot.selectedMemberIndex
                ? "border-trust-up"
                : "border-edge")
            }
          >
            <div className="flex justify-between gap-3">
              <span className="font-semibold">{member.name}</span>
              <span className={member.alive ? "text-trust-up" : "text-trust-down"}>
                {member.alive ? "생존" : "사망"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {member.classId} · {PERSONALITY_LABELS[member.personality]} · 신뢰{" "}
              {member.trust}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function TrustSection({ snapshot }: { snapshot: IntegrationSnapshot }) {
  const before = snapshot.party[snapshot.selectedMemberIndex];
  return (
    <Panel title="R2 · 개인 신뢰 판정">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">대상</dt>
          <dd>{before?.name}</dd>
        </div>
        <div>
          <dt className="text-muted">행동</dt>
          <dd>{snapshot.trustAction}</dd>
        </div>
        <div>
          <dt className="text-muted">신뢰 변화</dt>
          <dd>
            {before?.trust} → {snapshot.trustEvaluation.member.trust} (
            {signed(snapshot.trustEvaluation.change.delta)})
          </dd>
        </div>
        <div>
          <dt className="text-muted">exposed</dt>
          <dd>{String(snapshot.trustEvaluation.exposed)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted">{snapshot.trustEvaluation.change.reason}</p>
    </Panel>
  );
}

function DungeonSection({ snapshot }: { snapshot: IntegrationSnapshot }) {
  return (
    <Panel title="R4 · 던전 생성">
      <p className="mb-3 text-sm text-muted">
        노드 {snapshot.dungeon.dungeon.nodes.length}개 · 이벤트{" "}
        {snapshot.dungeon.events.length}개 · 입구 {snapshot.dungeon.dungeon.entryNodeId} · 보스{" "}
        {snapshot.dungeon.dungeon.bossNodeId}
      </p>
      <ol className="space-y-2">
        {snapshot.dungeon.dungeon.nodes.map((node) => {
          const event = snapshot.dungeon.events.find(
            (candidate) => candidate.id === node.eventId,
          );
          return (
            <li key={node.id} className="rounded border border-edge p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-mono">{node.id}</span>
                <span className="text-muted">
                  {event === undefined ? "이벤트 없음" : EVENT_KIND_LABELS[event.kind]}
                </span>
              </div>
              <p className="mt-1">{event?.title ?? node.eventId}</p>
              <p className="mt-1 text-xs text-muted">
                depth {node.depth} · 다음 {node.nextNodeIds.join(", ") || "없음"}
              </p>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function RunStateSection({ snapshot }: { snapshot: IntegrationSnapshot }) {
  const run = snapshot.run;
  return (
    <Panel title="F2 · RunState 스냅샷">
      <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-muted">seed</dt>
          <dd className="break-all font-mono">{run.seed}</dd>
        </div>
        <div>
          <dt className="text-muted">phase</dt>
          <dd>{PHASE_LABELS[run.phase]}</dd>
        </div>
        <div>
          <dt className="text-muted">current node</dt>
          <dd>{run.currentNodeId}</dd>
        </div>
        <div>
          <dt className="text-muted">party</dt>
          <dd>{run.party.length}명</dd>
        </div>
        <div>
          <dt className="text-muted">dungeon nodes</dt>
          <dd>{run.dungeon.nodes.length}개</dd>
        </div>
        <div>
          <dt className="text-muted">pending claims / log</dt>
          <dd>
            {run.pendingClaims.length} / {run.log.length}
          </dd>
        </div>
        <div>
          <dt className="text-muted">resources</dt>
          <dd>
            gold {run.resources.gold} · food {run.resources.food} · reputation{" "}
            {run.resources.reputation}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

export function IntegrationTestPanel() {
  const [draftSeed, setDraftSeed] = useState(DEFAULT_SEED);
  const [draftAudience, setDraftAudience] = useState<HarnessAudience>("party");
  const [draftCardIndex, setDraftCardIndex] = useState(0);
  const [draftMemberIndex, setDraftMemberIndex] = useState(0);
  const [draftTrustAction, setDraftTrustAction] = useState<TrustAction>("actHonestly");
  const [selection, setSelection] = useState({
    seed: DEFAULT_SEED,
    audience: "party" as HarnessAudience,
    cardIndex: 0,
    memberIndex: 0,
    trustAction: "actHonestly" as TrustAction,
  });
  const [error, setError] = useState<string | null>(null);
  const snapshot = useMemo(
    () => createIntegrationSnapshot(selection),
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
      memberIndex: draftMemberIndex,
      trustAction: draftTrustAction,
    });
    setError(null);
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-6 p-6 sm:p-10">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          Development test harness · Integration
        </p>
        <h1 className="text-3xl font-bold text-parchment">전체 규칙 통합 테스트</h1>
        <p className="max-w-4xl text-sm text-muted">
          같은 seed에서 R1 파티, R2 신뢰, R3 정보 카드, R4 던전, F2 RunState를
          함께 확인합니다. 각 규칙은 실제 순수 모듈을 호출합니다.
        </p>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link className="rounded border border-edge px-3 py-2 hover:bg-edge" href="/r3-test">
            R3 단독 테스트
          </Link>
          <Link className="rounded border border-edge px-3 py-2 hover:bg-edge" href="/state-preview">
            F2 상태 미리보기
          </Link>
        </nav>
      </header>

      <Panel title="통합 입력">
        <form className="grid gap-5 lg:grid-cols-2" onSubmit={handleRun}>
          <label className="flex flex-col gap-1 text-sm" htmlFor="integration-seed">
            재현할 seed
            <input
              id="integration-seed"
              className="rounded border border-edge bg-ink px-3 py-2 text-parchment"
              value={draftSeed}
              onChange={(event) => setDraftSeed(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm" htmlFor="integration-card">
            R3 카드
            <select
              id="integration-card"
              className="rounded border border-edge bg-ink px-3 py-2 text-parchment"
              value={draftCardIndex}
              onChange={(event) => setDraftCardIndex(Number(event.target.value))}
            >
              {MOCK_CARDS.map((card, index) => (
                <option key={card.id} value={index}>
                  {TRUTH_TYPE_LABELS[card.truthType]} · {card.topic}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm text-muted">R3 대상</legend>
            <label className="mr-5 inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="integration-audience"
                checked={draftAudience === "party"}
                onChange={() => setDraftAudience("party")}
              />
              파티
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="integration-audience"
                checked={draftAudience === "boss"}
                onChange={() => setDraftAudience("boss")}
              />
              보스
            </label>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm" htmlFor="integration-member">
            R2 대상 파티원
            <select
              id="integration-member"
              className="rounded border border-edge bg-ink px-3 py-2 text-parchment"
              value={draftMemberIndex}
              onChange={(event) => setDraftMemberIndex(Number(event.target.value))}
            >
              {snapshot.party.map((member, index) => (
                <option key={member.id} value={index}>
                  {index + 1}. {member.name} · {PERSONALITY_LABELS[member.personality]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm" htmlFor="integration-action">
            R2 공통 행동
            <select
              id="integration-action"
              className="rounded border border-edge bg-ink px-3 py-2 text-parchment"
              value={draftTrustAction}
              onChange={(event) => setDraftTrustAction(event.target.value as TrustAction)}
            >
              {TRUST_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button className="rounded border border-trust-up px-4 py-2" type="submit">
              전체 판정 실행
            </button>
          </div>
          {error === null ? null : <p role="alert" className="text-trust-down">{error}</p>}
        </form>
      </Panel>

      <Panel title="실행 요약">
        <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted">seed</dt>
            <dd className="break-all font-mono">{snapshot.seed}</dd>
          </div>
          <div>
            <dt className="text-muted">R3 카드</dt>
            <dd>{TRUTH_TYPE_LABELS[selectedCard.truthType]} · {selectedCard.topic}</dd>
          </div>
          <div>
            <dt className="text-muted">R3 대상</dt>
            <dd>{snapshot.audience === "party" ? "파티 전체" : "보스"}</dd>
          </div>
          <div>
            <dt className="text-muted">R2 대상</dt>
            <dd>{snapshot.party[snapshot.selectedMemberIndex]?.name}</dd>
          </div>
        </dl>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <PartySection snapshot={snapshot} />
        <TrustSection snapshot={snapshot} />
      </div>

      <Panel title="R3 · 정보 카드 결과">
        <IntegrationInfoResults evaluation={snapshot.infoEvaluation} />
      </Panel>

      <DungeonSection snapshot={snapshot} />
      <RunStateSection snapshot={snapshot} />

      <Panel title="현재 범위 안내">
        <p className="text-sm text-muted">
          P1 상태 머신, P2 보스전·종료, R5 결과 정산은 아직 연결 전입니다. 이 페이지는
          구현된 순수 규칙과 F2 상태 형태를 검증하는 개발용 도구입니다.
        </p>
      </Panel>
    </main>
  );
}
