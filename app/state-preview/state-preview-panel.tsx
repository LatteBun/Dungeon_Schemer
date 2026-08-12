"use client";

import { type FormEvent, useState } from "react";
import { CLASSES } from "@/lib/content/classes";
import {
  createPreviewRun,
  PREVIEW_INITIAL_SEED,
} from "@/app/state-preview/preview-run";
import { normalizePreviewSeed } from "@/app/state-preview/preview-seed";
import { createSeed } from "@/lib/rng";
import {
  useRunStore,
  useUiStore,
} from "@/lib/stores/game-store-provider";

export function StatePreviewPanel() {
  const run = useRunStore((state) => state.run);
  const [seedInput, setSeedInput] = useState(run.seed);
  const [seedError, setSeedError] = useState<string | null>(null);
  const startNewRun = useRunStore((state) => state.startNewRun);
  const resetRun = useRunStore((state) => state.resetRun);
  const selectedMemberId = useUiStore((state) => state.selectedMemberId);
  const selectMember = useUiStore((state) => state.selectMember);
  const clearSelectedMember = useUiStore(
    (state) => state.clearSelectedMember,
  );
  const resetUi = useUiStore((state) => state.resetUi);

  const selectedMember = run.party.find(
    (member) => member.id === selectedMemberId,
  );

  function startPreviewRun(seed: string) {
    startNewRun(createPreviewRun, seed);
    resetUi();
    setSeedInput(seed);
    setSeedError(null);
  }

  function handleSeedSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const seed = normalizePreviewSeed(seedInput);

    if (seed === null) {
      setSeedError("seed를 입력해 주세요.");
      return;
    }

    startPreviewRun(seed);
  }

  function handleNewPreviewRun() {
    startPreviewRun(createSeed());
  }

  function handleResetAll() {
    resetRun();
    resetUi();
    setSeedInput(PREVIEW_INITIAL_SEED);
    setSeedError(null);
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 p-6 sm:p-10">
      <header className="space-y-3">
        <p className="font-mono text-sm uppercase tracking-widest">
          Development only
        </p>
        <h1 className="text-3xl font-bold">F2 상태 스토어 개발 미리보기</h1>
        <p className="rounded border border-amber-500 p-4">
          표시 값은 기술 검증용 예시이며 공식 기본값이 아닙니다.
        </p>
      </header>

      <section
        aria-labelledby="seed-check-heading"
        className="space-y-3 rounded border p-4"
      >
        <h2 id="seed-check-heading" className="text-2xl font-semibold">
          R1 파티 생성 재현 확인
        </h2>
        <p>같은 seed는 같은 파티를 재현하고, 새 seed는 다른 조합을 생성합니다.</p>
        <form className="flex flex-wrap gap-3" onSubmit={handleSeedSubmit}>
          <label className="flex flex-col gap-1" htmlFor="preview-seed">
            재현할 seed
            <input
              id="preview-seed"
              className="rounded border px-3 py-2"
              value={seedInput}
              onChange={(event) => setSeedInput(event.target.value)}
            />
          </label>
          <button className="self-end rounded border px-3 py-2" type="submit">
            입력한 seed로 생성
          </button>
        </form>
        {seedError === null ? null : <p role="alert">{seedError}</p>}
      </section>

      <section aria-labelledby="run-state-heading" className="space-y-4">
        <h2 id="run-state-heading" className="text-2xl font-semibold">
          Run Store
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="font-semibold">seed</dt>
            <dd className="break-all font-mono">{run.seed}</dd>
          </div>
          <div>
            <dt className="font-semibold">phase</dt>
            <dd>{run.phase}</dd>
          </div>
          <div>
            <dt className="font-semibold">현재 노드</dt>
            <dd>{run.currentNodeId}</dd>
          </div>
          <div>
            <dt className="font-semibold">노드 수</dt>
            <dd>{run.dungeon.nodes.length}</dd>
          </div>
          <div>
            <dt className="font-semibold">파티원 수</dt>
            <dd>{run.party.length}</dd>
          </div>
          <div>
            <dt className="font-semibold">pending claim 수</dt>
            <dd>{run.pendingClaims.length}</dd>
          </div>
          <div>
            <dt className="font-semibold">log 수</dt>
            <dd>{run.log.length}</dd>
          </div>
          <div>
            <dt className="font-semibold">gold</dt>
            <dd>{run.resources.gold}</dd>
          </div>
          <div>
            <dt className="font-semibold">food</dt>
            <dd>{run.resources.food}</dd>
          </div>
          <div>
            <dt className="font-semibold">reputation</dt>
            <dd>{run.resources.reputation}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="party-heading" className="space-y-4">
        <h2 id="party-heading" className="text-2xl font-semibold">
          파티원별 상태
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {run.party.map((member) => (
            <li key={member.id} className="rounded border p-4">
              <h3 className="text-xl font-semibold">{member.name}</h3>
              <dl className="mt-3 space-y-1">
                <div>
                  <dt className="inline font-semibold">직업: </dt>
                  <dd className="inline">
                    {CLASSES.find((candidate) => candidate.id === member.classId)
                      ?.name ?? member.classId}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-semibold">class ID: </dt>
                  <dd className="inline">{member.classId}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">personality: </dt>
                  <dd className="inline">{member.personality}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">개인 trust: </dt>
                  <dd className="inline">{member.trust}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">alive: </dt>
                  <dd className="inline">{String(member.alive)}</dd>
                </div>
              </dl>
              <button
                type="button"
                aria-pressed={selectedMemberId === member.id}
                className="mt-4 rounded border px-3 py-2"
                onClick={() => selectMember(member.id)}
              >
                이 파티원 선택
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ui-state-heading" className="space-y-4">
        <h2 id="ui-state-heading" className="text-2xl font-semibold">
          UI Store
        </h2>
        <p>
          선택된 파티원:{" "}
          {selectedMember
            ? selectedMember.name + " (" + selectedMember.id + ")"
            : "없음"}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded border px-3 py-2"
            onClick={clearSelectedMember}
          >
            선택 해제
          </button>
          <button
            type="button"
            className="rounded border px-3 py-2"
            onClick={handleNewPreviewRun}
          >
            새 미리보기 런
          </button>
          <button
            type="button"
            className="rounded border px-3 py-2"
            onClick={handleResetAll}
          >
            모두 초기화
          </button>
        </div>
      </section>
    </main>
  );
}
