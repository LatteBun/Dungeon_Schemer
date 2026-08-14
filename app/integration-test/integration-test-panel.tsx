"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import {
  createIntegrationSnapshot,
  type IntegrationSnapshot,
} from "@/app/integration-test/integration-test-snapshot";

const DEFAULT_SEED = "integration-ui-seed";
const GRADES = ["C", "B", "A", "S"] as const;

function F1Section({ snapshot }: { snapshot: IntegrationSnapshot }) {
  const { campaign, expedition } = snapshot.f1;

  return (
    <section data-testid="integration-f1">
      <Panel title="F1 · 도메인 계약">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-parchment">캠페인 fixture</h3>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">seed</dt>
                <dd className="mt-1 break-all font-mono">{campaign.seed}</dd>
              </div>
              <div>
                <dt className="text-muted">phase / rank</dt>
                <dd className="mt-1">{campaign.phase} / {campaign.rank}</dd>
              </div>
              <div>
                <dt className="text-muted">던전</dt>
                <dd className="mt-1">{campaign.dungeonCount}개</dd>
              </div>
              <div>
                <dt className="text-muted">파티</dt>
                <dd className="mt-1">{campaign.partyCount}팀</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-parchment">탐험 fixture</h3>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">던전 ID</dt>
                <dd className="mt-1 break-all font-mono">{expedition.dungeonId}</dd>
              </div>
              <div>
                <dt className="text-muted">파티 ID</dt>
                <dd className="mt-1 break-all font-mono">{expedition.partyId}</dd>
              </div>
              <div>
                <dt className="text-muted">지도 지점</dt>
                <dd className="mt-1">{expedition.mapNodeCount}개</dd>
              </div>
              <div>
                <dt className="text-muted">경로</dt>
                <dd className="mt-1">{expedition.pathCount}개</dd>
              </div>
            </dl>
          </div>
        </div>
      </Panel>
    </section>
  );
}

function F2Section({ snapshot }: { snapshot: IntegrationSnapshot }) {
  const { f2 } = snapshot;

  return (
    <section data-testid="integration-f2">
      <Panel
        title="F2 · 콘텐츠 계약"
        aside={
          <span className={f2.contentStatus === "pass" ? "text-trust-up" : "text-trust-down"}>
            {f2.contentStatus === "pass" ? "검증 성공" : "검증 실패"}
          </span>
        }
      >
        {f2.contentError === undefined ? null : (
          <p className="mb-4 text-sm text-trust-down">{f2.contentError}</p>
        )}
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <p>일반 사건 <span className="text-parchment">{f2.events.total}개</span></p>
          <p>정보 카드 <span className="text-parchment">{f2.cards.total}개</span></p>
          <p>아이템 <span className="text-parchment">{f2.items.total}종</span></p>
          <p>보스 <span className="text-parchment">{f2.bosses.entries.length}종</span></p>
          <p>최소 선택지 <span className="text-parchment">{f2.events.minimumChoices}개</span></p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-parchment">등급별 사건 용량</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {f2.capacity.map((entry) => (
                <li key={entry.grade} className="rounded border border-edge p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span>{entry.grade}급</span>
                    <span className={entry.pass ? "text-trust-up" : "text-trust-down"}>
                      {entry.pass ? "통과" : "실패"}
                    </span>
                  </div>
                  <p className="mt-1 text-muted">필요 {entry.required} / 보유 {entry.available}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-parchment">의도적 실패 fixture</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {f2.negativeCases.map((entry) => (
                <li key={entry.label} className="rounded border border-edge p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span>{entry.label}</span>
                    <span className={entry.pass ? "text-trust-up" : "text-trust-down"}>
                      {entry.pass ? "통과" : "실패"}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted">{entry.errorCode ?? "오류 없음"}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <p>사건 종류별 수량: {Object.entries(f2.events.byKind).map(([kind, count]) => `${kind} ${count}`).join(" · ")}</p>
          <p>보스 등급: {f2.bosses.grades.join(" · ")}</p>
        </div>
        <p data-testid="integration-reproducible" className="mt-4 text-sm text-muted">
          seed 재현성: <span className="text-trust-up">{f2.reproducibility.sameSeed ? "통과" : "실패"}</span>
        </p>
      </Panel>
    </section>
  );
}

function C1Section({ snapshot }: { snapshot: IntegrationSnapshot }) {
  const { c1 } = snapshot;

  return (
    <section data-testid="integration-c1">
      <Panel
        title="C1 · 캠페인 초기화·게시판"
        aside={<span className="text-trust-up">{c1.phase} / {c1.rank}급</span>}
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-muted">seed</dt>
            <dd className="mt-1 break-all font-mono">{c1.seed}</dd>
          </div>
          <div>
            <dt className="text-muted">명성</dt>
            <dd className="mt-1">{c1.currentReputation}</dd>
          </div>
          <div>
            <dt className="text-muted">현재 골드</dt>
            <dd className="mt-1">{c1.currentGold}</dd>
          </div>
          <div>
            <dt className="text-muted">누적 골드</dt>
            <dd className="mt-1">{c1.cumulativeGold}</dd>
          </div>
          <div>
            <dt className="text-muted">전체 인원</dt>
            <dd className="mt-1">{c1.memberCount}명</dd>
          </div>
        </dl>

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4" data-testid="integration-c1-counts">
          {GRADES.map((grade) => (
            <p key={grade} className="rounded border border-edge px-3 py-2">
              {grade}급 던전 <span className="text-parchment">{c1.dungeonCounts[grade]}개</span>
            </p>
          ))}
          <p className="rounded border border-edge px-3 py-2">던전 총 {c1.dungeonCount}개</p>
          <p className="rounded border border-edge px-3 py-2">완성 파티 {c1.completePartyCount}팀</p>
          <p className="rounded border border-edge px-3 py-2">파티 {c1.partyCount}팀</p>
          <p className="rounded border border-edge px-3 py-2">예비 인원 {c1.reserveMemberCount}명</p>
        </div>

        <div className="mt-6" data-testid="integration-c1-board">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-parchment">초기 게시판</h3>
            <span className="text-xs text-muted">공고 {c1.board.length}개 / 최대 5개</span>
          </div>
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {c1.board.map((offer) => {
              const statusLabel = offer.locked ? "명성 부족으로 잠김" : "지원 가능";
              return (
                <li key={offer.id} className="rounded border border-edge p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-mono text-xs text-muted">{offer.id}</span>
                    <span aria-label={statusLabel} className={offer.locked ? "text-trust-down" : "text-trust-up"}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-parchment">
                    {offer.dungeonGrade}급 던전 · {offer.nodeCount}개 지점
                  </p>
                  <p className="mt-1 text-muted">
                    {offer.partyId} · {offer.partyMemberNames.join(", ") || "파티원 정보 없음"}
                  </p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
                    <div>
                      <dt>필요 명성</dt>
                      <dd className="mt-1 text-parchment">{offer.requiredReputation}</dd>
                    </div>
                    <div>
                      <dt>명성 보상</dt>
                      <dd className="mt-1 text-parchment">{offer.baseReputationReward}</dd>
                    </div>
                    <div>
                      <dt>골드 보상</dt>
                      <dd className="mt-1 text-parchment">{offer.baseGoldReward}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="mt-4 text-sm text-muted">
          C1 seed 재현성: <span className="text-trust-up">{c1.reproducible ? "통과" : "실패"}</span>
        </p>
      </Panel>
    </section>
  );
}

export function IntegrationTestPanel() {
  const [draftSeed, setDraftSeed] = useState(DEFAULT_SEED);
  const [selectedSeed, setSelectedSeed] = useState(DEFAULT_SEED);
  const [error, setError] = useState<string | null>(null);
  const snapshot = useMemo(
    () => createIntegrationSnapshot(selectedSeed),
    [selectedSeed],
  );

  function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const seed = draftSeed.trim();
    if (seed === "") {
      setError("seed를 입력해 주세요.");
      return;
    }
    setSelectedSeed(seed);
    setError(null);
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-6 p-6 sm:p-10">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          Development test harness · F1 / F2 / C1
        </p>
        <h1 className="text-3xl font-bold text-parchment">F1·F2·C1 통합 검증</h1>
        <p className="max-w-4xl text-sm text-muted">
          하나의 seed로 F1 도메인 fixture, F2 콘텐츠 계약, C1 초기 캠페인과 게시판을
          함께 재생성하는 개발용 화면입니다.
        </p>
        <nav className="flex flex-wrap gap-3 text-sm" aria-label="단독 검증 화면">
          <Link className="rounded border border-edge px-3 py-2 hover:bg-edge" href="/f1-test">F1 테스트</Link>
          <Link className="rounded border border-edge px-3 py-2 hover:bg-edge" href="/f2-test">F2 테스트</Link>
          <Link className="rounded border border-edge px-3 py-2 hover:bg-edge" href="/info-card-test">정보 카드 단독 테스트</Link>
        </nav>
      </header>

      <Panel title="공통 seed 입력">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleRun}>
          <label className="sr-only" htmlFor="integration-seed">통합 테스트 seed</label>
          <input
            id="integration-seed"
            className="min-w-0 flex-1 rounded border border-edge bg-ink px-3 py-2 text-parchment"
            value={draftSeed}
            onChange={(event) => setDraftSeed(event.target.value)}
          />
          <button className="rounded border border-trust-up px-4 py-2 text-trust-up" type="submit">
            seed 적용
          </button>
        </form>
        {error === null ? null : <p className="mt-3 text-sm text-trust-down" role="alert">{error}</p>}
      </Panel>

      <F1Section snapshot={snapshot} />
      <F2Section snapshot={snapshot} />
      <C1Section snapshot={snapshot} />
    </main>
  );
}
