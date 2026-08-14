import Link from "next/link";
import { RNG_STREAMS } from "@/lib/rng";
import { RuleError } from "@/lib/domain";
import {
  createFixtureCampaignState,
  createFixtureExpeditionState,
} from "@/lib/rules/fixtures";

interface F1TestPageProps {
  searchParams: Promise<{ seed?: string | string[] | undefined }>;
}

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value);
}

export default async function F1TestPage({
  searchParams,
}: F1TestPageProps) {
  const params = await searchParams;
  const requestedSeed = firstSearchParam(params.seed)?.trim();
  const seed = requestedSeed || "f1-fixture";
  const campaign = createFixtureCampaignState(seed);
  const expedition = createFixtureExpeditionState();
  const error = new RuleError(
    "INVALID_TRANSITION",
    "현재 단계에서는 이 행동을 처리할 수 없습니다.",
    { phase: campaign.phase, expected: "contract" },
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-4 border-b border-edge pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted">
              F1 / Campaign Domain & State Contract
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-parchment">
              캠페인·탐험 도메인 검증
            </h1>
          </div>
          <Link
            href="/play"
            className="rounded border border-edge px-3 py-2 text-sm text-muted hover:bg-edge hover:text-parchment"
          >
            프로토타입 화면으로 돌아가기
          </Link>
          <Link
            href="/f2-test"
            className="rounded border border-trust-up/50 px-3 py-2 text-sm text-trust-up hover:bg-trust-up/10"
          >F2 콘텐츠 테스트</Link>
          <Link
            href="/e1-test"
            className="rounded border border-trust-up/50 px-3 py-2 text-sm text-trust-up hover:bg-trust-up/10"
          >E1 지도 테스트</Link>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-muted">
          이 페이지는 F1의 상태 계약, 브랜드 ID, 구조화 오류, 목적별 난수 스트림을
          사람이 직접 확인하는 테스트 장면이다. 아직 게시판·탐험을 실제로 진행하는
          플레이 화면은 C1~I1 범위에서 연결한다.
        </p>
      </header>

      <section
        aria-labelledby="campaign-heading"
        className="rounded-lg border border-edge bg-panel p-5"
        data-testid="f1-campaign"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="campaign-heading" className="text-xl text-parchment">
            캠페인 상태 fixture
          </h2>
          <span
            className="rounded-full border border-trust-up/50 px-3 py-1 text-xs text-trust-up"
            data-testid="f1-status"
          >
            계약 로드 성공
          </span>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-edge px-3 py-3">
            <dt className="text-xs text-muted">시드</dt>
            <dd className="mt-1 break-all font-mono text-sm text-parchment" data-testid="f1-seed">
              {campaign.seed}
            </dd>
          </div>
          <div className="rounded border border-edge px-3 py-3">
            <dt className="text-xs text-muted">단계 / 등급</dt>
            <dd className="mt-1 text-sm text-parchment" data-testid="f1-phase">
              {campaign.phase} / {campaign.rank}
            </dd>
          </div>
          <div className="rounded border border-edge px-3 py-3">
            <dt className="text-xs text-muted">명성 / 현재 골드</dt>
            <dd className="mt-1 text-sm text-parchment">
              {campaign.currentReputation} / {campaign.currentGold}
            </dd>
          </div>
          <div className="rounded border border-edge px-3 py-3">
            <dt className="text-xs text-muted">누적 골드</dt>
            <dd className="mt-1 text-sm text-parchment">
              {campaign.cumulativeGold}
            </dd>
          </div>
        </dl>
        <div
          className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-3"
          data-testid="f1-campaign-counts"
        >
          <p>던전 {campaign.dungeons.length}개</p>
          <p>완성 파티 {campaign.parties.filter((party) => party.complete).length}팀</p>
          <p>예비 인원 {campaign.reserveMemberIds.length}명</p>
        </div>
      </section>

      <section
        aria-labelledby="expedition-heading"
        className="rounded-lg border border-edge bg-panel p-5"
        data-testid="f1-expedition"
      >
        <h2 id="expedition-heading" className="text-xl text-parchment">
          탐험 상태 fixture
        </h2>
        <div className="mt-5 grid gap-3 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
          <p>던전 ID: <span className="font-mono text-parchment">{expedition.dungeonId}</span></p>
          <p>파티 ID: <span className="font-mono text-parchment">{expedition.partyId}</span></p>
          <p>지도 지점: <span className="text-parchment">{expedition.map.nodes.length}개</span></p>
          <p>경로: <span className="text-parchment">{expedition.map.paths.length}개</span></p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="sr-only">F1 지도 노드 계약</caption>
            <thead className="border-b border-edge text-xs text-muted">
              <tr>
                <th className="px-2 py-2 font-normal">노드</th>
                <th className="px-2 py-2 font-normal">사건</th>
                <th className="px-2 py-2 font-normal">위험</th>
                <th className="px-2 py-2 font-normal">정보 기회</th>
                <th className="px-2 py-2 font-normal">보스 관련 카드</th>
              </tr>
            </thead>
            <tbody>
              {expedition.map.nodes.map((node) => (
                <tr key={node.id} className="border-b border-edge/70 text-muted">
                  <td className="px-2 py-2 font-mono text-parchment">{node.id}</td>
                  <td className="px-2 py-2 font-mono">{node.eventId}</td>
                  <td className="px-2 py-2">{node.riskSummary}</td>
                  <td className="px-2 py-2">{node.hasInfoOpportunity ? "있음" : "없음"}</td>
                  <td className="px-2 py-2">{node.bossRelatedInfoCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-labelledby="rng-heading"
        className="rounded-lg border border-edge bg-panel p-5"
        data-testid="f1-rng"
      >
        <h2 id="rng-heading" className="text-xl text-parchment">
          목적별 난수 스트림
        </h2>
        <p className="mt-2 text-sm text-muted">
          한 영역의 난수 소비가 다른 영역 결과를 바꾸지 않도록 이름을 고정한다.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2" data-testid="f1-streams">
          {RNG_STREAMS.map((stream) => (
            <li
              key={stream}
              className="rounded-full border border-edge px-3 py-1 font-mono text-xs text-parchment"
            >
              {stream}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="error-heading"
        className="rounded-lg border border-edge bg-panel p-5"
        data-testid="f1-rule-error"
      >
        <h2 id="error-heading" className="text-xl text-parchment">
          구조화된 오류 계약
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">code</dt>
            <dd className="mt-1 font-mono text-sm text-trust-down">{error.code}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">message</dt>
            <dd className="mt-1 text-sm text-parchment">{error.message}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">details</dt>
            <dd className="mt-1 break-all font-mono text-xs text-muted">
              {formatJson(error.details)}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="manual-heading"
        className="rounded-lg border border-edge bg-panel p-5"
      >
        <h2 id="manual-heading" className="text-xl text-parchment">
          다른 시드로 재현성 확인
        </h2>
        <p className="mt-2 text-sm text-muted">
          아래 입력값은 fixture의 식별 가능한 시드로 그대로 표시된다. 같은 값을
          다시 제출하면 같은 계약 상태가 나타나야 한다.
        </p>
        <form method="get" className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row">
          <label htmlFor="seed" className="sr-only">
            테스트 시드
          </label>
          <input
            id="seed"
            name="seed"
            defaultValue={seed}
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
