import Link from "next/link";
import { createE1TestSnapshot } from "@/app/e1-test/e1-test-snapshot";
import type { E1GradeView, E1NodeView } from "@/app/e1-test/e1-test-snapshot";
import { EVENT_KIND_LABELS, EVENT_KIND_MARKS } from "@/components/game/labels";

interface E1TestPageProps {
  searchParams: Promise<{ seed?: string | string[] | undefined }>;
}

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function passLabel(pass: boolean): string {
  return pass ? "통과" : "실패";
}

function passClass(pass: boolean): string {
  return pass ? "text-trust-up" : "text-trust-down";
}

/**
 * 지점 하나를 그린다. 정보 기회와 보스 보장은 색이 아니라 기호와 문구로도
 * 구분한다. 색만으로 상태를 나누지 않는 것이 접근성 기준이다.
 */
function NodeCard({ node }: { node: E1NodeView }) {
  const marks = [
    node.hasInfoOpportunity ? "◈ 정보 기회" : null,
    node.bossRelatedInfoCount > 0 ? "! 보스 보장" : null,
  ].filter((mark): mark is string => mark !== null);

  return (
    <div
      className={`flex-1 rounded border px-3 py-2 text-center ${
        node.hasInfoOpportunity ? "border-trust-up/60 bg-trust-up/5" : "border-edge"
      }`}
      data-testid={`e1-node-${node.id}`}
    >
      <p className="text-sm text-parchment">
        {EVENT_KIND_MARKS[node.kind]} {node.eventTitle}
      </p>
      <p className="mt-1 text-xs text-muted">
        {EVENT_KIND_LABELS[node.kind]} · {node.riskSummary}
      </p>
      {marks.length > 0 ? (
        <p className="mt-1 text-xs text-trust-up">{marks.join(" · ")}</p>
      ) : null}
    </div>
  );
}

function GradeSection({ view }: { view: E1GradeView }) {
  return (
    <section
      className="rounded-lg border border-edge bg-panel p-5"
      aria-labelledby={`grade-${view.grade}`}
      data-testid={`e1-grade-${view.grade}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`grade-${view.grade}`} className="text-xl text-parchment">
          {view.grade}급 지도
          <span className="ml-2 text-sm text-muted">갈래 길이 {view.branchLength}</span>
        </h2>
        <span
          className={`rounded-full border px-3 py-1 text-xs ${
            view.status === "pass"
              ? "border-trust-up/50 text-trust-up"
              : "border-trust-down/50 text-trust-down"
          }`}
          data-testid={`e1-status-${view.grade}`}
        >
          {view.status === "pass" ? "불변식 통과" : "불변식 실패"}
        </span>
      </div>

      {view.error !== undefined ? (
        <p className="mt-3 text-sm text-trust-down">{view.error}</p>
      ) : null}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div>
          <p className="text-xs text-muted">
            입구는 맨 아래다. 어느 갈래를 골라도 맨 위 보스방으로 모인다.
          </p>
          <ol className="mt-3 flex flex-col gap-2">
            {view.rows.map((row) => (
              <li key={row.depth}>
                <div className="flex items-stretch justify-center gap-2">
                  {row.nodes.map((node) => (
                    <NodeCard key={node.id} node={node} />
                  ))}
                </div>
                <p className="mt-1 text-center text-[11px] text-muted">깊이 {row.depth}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm text-parchment">불변식</h3>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {view.checks.map((entry) => (
                <li key={entry.label} className="flex justify-between gap-3">
                  <span className="text-muted">{entry.label}</span>
                  <span className={passClass(entry.pass)}>
                    {entry.actual}
                    {entry.pass ? "" : ` (기대 ${entry.expected})`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm text-parchment">경로별 실측</h3>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {view.paths.map((path) => (
                <li key={path.label} className="rounded border border-edge p-3">
                  <p className="text-parchment">{path.label}</p>
                  <p className="mt-1 text-xs text-muted">
                    일반 사건 {path.regularEventCount} · 정보 {path.infoCount}회 · 보스 보장{" "}
                    {path.bossRelatedInfoCount}회
                  </p>
                  <p className={`mt-1 text-xs ${passClass(path.coversAllKinds)}`}>
                    지나는 분류 {[...new Set(path.kinds)].map((kind) => EVENT_KIND_LABELS[kind]).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted">
            입구 {EVENT_KIND_LABELS[view.entryKind]} · 합류{" "}
            {EVENT_KIND_LABELS[view.mergeKind]} · 정보 기회가 찍힌 지점{" "}
            {view.infoNodeCount}곳
          </p>
        </div>
      </div>
    </section>
  );
}

export default async function E1TestPage({ searchParams }: E1TestPageProps) {
  const params = await searchParams;
  const seed = firstSearchParam(params.seed)?.trim() || "e1-fixture";
  const snapshot = createE1TestSnapshot(seed);
  const allPass = snapshot.grades.every((grade) => grade.status === "pass")
    && snapshot.negativeCases.every((entry) => entry.pass)
    && snapshot.reproducibility.sameSeed;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-4 border-b border-edge pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted">
              E1 / Grade Map & Info Opportunity
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-parchment">
              등급별 대칭 지도 검증
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/f1-test"
              className="rounded border border-edge px-3 py-2 text-muted hover:bg-edge hover:text-parchment"
            >
              F1 테스트
            </Link>
            <Link
              href="/f2-test"
              className="rounded border border-edge px-3 py-2 text-muted hover:bg-edge hover:text-parchment"
            >
              F2 테스트
            </Link>
            <Link
              href="/play"
              className="rounded border border-edge px-3 py-2 text-muted hover:bg-edge hover:text-parchment"
            >
              프로토타입
            </Link>
          </nav>
        </div>
        <p className="max-w-4xl text-sm leading-6 text-muted">
          `generateGradeMap`이 만든 C·B·A·S 지도를 같은 시드로 나란히 확인하는 서버
          검증 화면이다. 아직 캠페인 흐름에 연결되지 않았으므로 `/play`의 지도는 이
          생성기가 아니라 단일 런 프로토타입의 것이다. 연결은 I1·U2에서 한다.
        </p>
        <p
          className={`text-sm ${allPass ? "text-trust-up" : "text-trust-down"}`}
          data-testid="e1-overall"
        >
          {allPass
            ? "네 등급 불변식, 의도적 실패 fixture, 시드 재현성이 모두 통과했다."
            : "확인이 필요한 항목이 있다. 아래 실패 표시를 따라간다."}
        </p>
      </header>

      {snapshot.grades.map((view) => (
        <GradeSection key={view.grade} view={view} />
      ))}

      <section
        className="rounded-lg border border-edge bg-panel p-5"
        aria-labelledby="negative-heading"
        data-testid="e1-negative-cases"
      >
        <h2 id="negative-heading" className="text-xl text-parchment">
          의도적 실패 fixture
        </h2>
        <p className="mt-2 text-sm text-muted">
          생성기와 검증기가 잘못된 입력을 삼키지 않고 `INVALID_GENERATION`을 던지는지
          확인한다. 여기서 `실패`가 보이면 오류가 조용히 통과했다는 뜻이다.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {snapshot.negativeCases.map((entry) => (
            <li key={entry.label} className="rounded border border-edge p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-parchment">{entry.label}</span>
                <span className={passClass(entry.pass)}>{passLabel(entry.pass)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{entry.reason}</p>
              <p className="mt-1 font-mono text-xs text-muted">
                {entry.errorCode ?? "오류 없음"}
                {entry.message === undefined ? "" : ` · ${entry.message}`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="rounded-lg border border-edge bg-panel p-5"
        aria-labelledby="repro-heading"
        data-testid="e1-reproducibility"
      >
        <h2 id="repro-heading" className="text-xl text-parchment">
          시드 재현성
        </h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p className="text-muted">
            같은 시드 동일 결과:{" "}
            <span className={passClass(snapshot.reproducibility.sameSeed)}>
              {passLabel(snapshot.reproducibility.sameSeed)}
            </span>
          </p>
          <p className="text-muted">
            다른 시드 배치 변화:{" "}
            <span className={passClass(snapshot.reproducibility.otherSeedDiffers)}>
              {passLabel(snapshot.reproducibility.otherSeedDiffers)}
            </span>
          </p>
        </div>
        <p className="mt-3 break-all font-mono text-xs text-muted">
          B급 왼쪽 경로: {snapshot.reproducibility.sampleNodeIds.join(" → ")}
        </p>
        <form method="get" className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row">
          <label htmlFor="seed" className="sr-only">
            테스트 시드
          </label>
          <input
            id="seed"
            name="seed"
            defaultValue={snapshot.seed}
            className="min-w-0 flex-1 rounded border border-edge bg-ink px-3 py-2 text-sm text-parchment outline-none focus:border-trust-up"
          />
          <button
            type="submit"
            className="rounded border border-trust-up px-4 py-2 text-sm text-trust-up hover:bg-trust-up/10"
          >
            시드 적용
          </button>
        </form>
      </section>
    </main>
  );
}
