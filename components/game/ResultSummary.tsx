import { StatValue } from "@/components/ui/StatValue";

interface MemberEntry { name: string; classLabel: string }
interface TrustChangeEntry { name: string; delta: number; reason: string }
interface SettlementView { outcome: "clear" | "gameOver"; survivors: MemberEntry[]; casualties: MemberEntry[]; trustChanges: TrustChangeEntry[]; rewards: { label: string; amount: number }[]; influentialDecisions: string[] }

/** CLEAR 문구와 함께 생존, 신뢰, 보상, 영향을 준 선택을 설명한다. */
export function ResultSummary({ settlement }: { settlement: SettlementView }) {
  const cleared = settlement.outcome === "clear";
  return <div className="flex flex-col gap-5">
    <div><p className={`text-3xl font-bold tracking-widest ${cleared ? "text-trust-up" : "text-trust-down"}`}>{cleared ? "CLEAR" : "GAME OVER"}</p><p className="mt-1 text-sm text-muted">{cleared ? "파티가 보스를 넘었다. 당신은 살아서 나왔다." : "탐험이 끝났다. 당신의 몫은 남지 않았다."}</p></div>
    <section><h3 className="text-xs font-semibold tracking-wide text-muted">생존과 사망</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">
      <div className="rounded border border-edge px-3 py-2"><p className="text-xs text-muted">생존 {settlement.survivors.length}명</p><ul className="mt-1 flex flex-col gap-1">{settlement.survivors.map((entry) => <li key={entry.name} className="text-sm text-parchment">{entry.name}<span className="ml-1 text-xs text-muted">{entry.classLabel}</span></li>)}</ul></div>
      <div className="rounded border border-edge px-3 py-2"><p className="text-xs text-muted">사망 {settlement.casualties.length}명</p><ul className="mt-1 flex flex-col gap-1">{settlement.casualties.map((entry) => <li key={entry.name} className="text-sm text-muted"><span aria-hidden="true">†</span> {entry.name}<span className="ml-1 text-xs">{entry.classLabel}</span></li>)}</ul></div>
    </div></section>
    <section><h3 className="text-xs font-semibold tracking-wide text-muted">신뢰 변화와 사유</h3><ul className="mt-2 flex flex-col">{settlement.trustChanges.map((change) => { const rising = change.delta >= 0; return <li key={change.name} className="border-b border-edge py-2 last:border-b-0"><p className="text-sm text-parchment">{change.name}{" "}<span className={rising ? "text-trust-up" : "text-trust-down"}><span aria-hidden="true">{rising ? "▲" : "▼"}</span><span className="sr-only">{rising ? "신뢰 상승 " : "신뢰 하락 "}</span>{Math.abs(change.delta)}</span></p><p className="text-xs text-muted">{change.reason}</p></li>; })}</ul></section>
    <section><h3 className="text-xs font-semibold tracking-wide text-muted">보상</h3><div className="mt-2 flex flex-wrap gap-4">{settlement.rewards.map((reward) => <StatValue key={reward.label} label={reward.label} value={reward.amount} />)}</div></section>
    <section><h3 className="text-xs font-semibold tracking-wide text-muted">결과에 영향을 준 선택</h3><ol className="mt-2 flex list-inside list-decimal flex-col gap-1">{settlement.influentialDecisions.map((decision) => <li key={decision} className="text-sm text-muted">{decision}</li>)}</ol></section>
  </div>;
}
