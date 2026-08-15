import { Panel } from "@/components/ui/Panel";
import type { ContractView } from "./campaign-view-model";

interface ContractPanelProps {
  contract: ContractView | null;
}

/** 오른쪽 계약·파티 확인. 선택한 던전과 출전 파티 3인의 상세를 보여준다. */
export function ContractPanel({ contract }: ContractPanelProps) {
  if (contract === null) {
    return (
      <Panel title="선택 상세">
        <p className="text-sm text-muted">공고를 선택하세요.</p>
      </Panel>
    );
  }

  return (
    <Panel title={`선택 상세 · ${contract.dungeonLabel}`}>
      <p className="text-xs text-muted">
        등급 {contract.grade} · 필요 명성 {contract.requiredReputation} · 명성{" "}
        {contract.reputationReward} + {contract.goldReward}G
      </p>
      <p className="mt-1 text-xs text-muted">
        지도: 전체 {contract.nodeCount}지점 · 두 갈래 · 보스방 공개
      </p>
      <p
        className={`mt-1 text-xs ${contract.acceptable ? "text-trust-up" : "text-trust-down"}`}
      >
        {contract.acceptable
          ? "✓ 지원 가능"
          : `× 지원 불가 · ${
              contract.acceptBlockReason === "insufficientReputation"
                ? "명성 부족"
                : contract.acceptBlockReason === "partyUnavailable"
                  ? "파티 지원 불가"
                  : ""
            }`}
      </p>

      <h3 className="mt-3 text-sm font-semibold text-muted">
        출전 파티 · {contract.partyLabel}
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {contract.members.map((member) => (
          <li
            key={member.memberId}
            className="rounded border border-edge px-3 py-2"
          >
            <p className="flex items-baseline justify-between gap-2 text-sm text-parchment">
              <span>
                {member.name}
                <span className="ml-1 text-xs text-muted">
                  {member.className}
                </span>
              </span>
              <span className="text-xs text-muted">
                성격: {member.personalityLabel}
              </span>
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
              <span>
                HP {member.currentHp} / {member.maxHp}
              </span>
              <span>개인 신뢰 {member.trust}</span>
              <span>소지 {member.carriedGold}G</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {member.memorySummary} · 행동 기억 유지
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
