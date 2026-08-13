import { describe, expect, it } from "vitest";
import type { DecisionRecord, MemberId, NodeId } from "@/lib/domain";
import {
  RECENT_TRUST_CHANGE_LIMIT,
  recentTrustChanges,
} from "@/lib/rules/trust-history";

const ALPHA = "m-alpha" as MemberId;
const BETA = "m-beta" as MemberId;

function record(
  at: number,
  changes: { memberId: MemberId; delta: number; reason: string }[],
): DecisionRecord {
  return {
    at,
    nodeId: `n-${at}` as NodeId,
    summary: `${at}번째 결정`,
    trustChanges: changes,
  };
}

const LOG: DecisionRecord[] = [
  record(0, [{ memberId: ALPHA, delta: 4, reason: "첫 번째" }]),
  record(1, [{ memberId: BETA, delta: -6, reason: "베타의 것" }]),
  record(2, [{ memberId: ALPHA, delta: -3, reason: "두 번째" }]),
  record(3, [{ memberId: ALPHA, delta: 7, reason: "세 번째" }]),
  record(4, [{ memberId: ALPHA, delta: 1, reason: "네 번째" }]),
];

describe("최근 신뢰 변화 추출", () => {
  it("다른 파티원의 변화를 섞지 않는다", () => {
    const entries = recentTrustChanges(LOG, BETA);
    expect(entries).toHaveLength(1);
    expect(entries[0].reason).toBe("베타의 것");
    expect(entries[0].delta).toBe(-6);
  });

  it("최신 기록이 먼저 온다", () => {
    const entries = recentTrustChanges(LOG, ALPHA);
    expect(entries.map((entry) => entry.reason)).toEqual([
      "네 번째",
      "세 번째",
      "두 번째",
    ]);
  });

  it("기본 개수 제한은 3이다", () => {
    expect(RECENT_TRUST_CHANGE_LIMIT).toBe(3);
    expect(recentTrustChanges(LOG, ALPHA)).toHaveLength(3);
  });

  it("개수 제한을 넘기지 않는다", () => {
    expect(recentTrustChanges(LOG, ALPHA, 2)).toHaveLength(2);
    expect(recentTrustChanges(LOG, ALPHA, 99)).toHaveLength(4);
  });

  it("제한이 0 이하이면 빈 배열이다", () => {
    expect(recentTrustChanges(LOG, ALPHA, 0)).toEqual([]);
    expect(recentTrustChanges(LOG, ALPHA, -1)).toEqual([]);
  });

  it("기록이 없는 파티원은 빈 배열이다", () => {
    expect(recentTrustChanges(LOG, "m-none" as MemberId)).toEqual([]);
    expect(recentTrustChanges([], ALPHA)).toEqual([]);
  });

  it("한 기록에 같은 파티원의 변화가 여럿이면 모두 담는다", () => {
    const doubled = [
      record(0, [
        { memberId: ALPHA, delta: 2, reason: "앞" },
        { memberId: ALPHA, delta: -5, reason: "뒤" },
      ]),
    ];
    const entries = recentTrustChanges(doubled, ALPHA);
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.reason)).toEqual(["앞", "뒤"]);
  });

  it("한 기록 안에서 제한에 걸리면 그 자리에서 멈춘다", () => {
    const straddling: DecisionRecord[] = [
      record(0, [{ memberId: ALPHA, delta: 1, reason: "오래된" }]),
      record(1, [
        { memberId: ALPHA, delta: 10, reason: "A" },
        { memberId: ALPHA, delta: 20, reason: "B" },
        { memberId: ALPHA, delta: 30, reason: "C" },
      ]),
    ];
    const entries = recentTrustChanges(straddling, ALPHA, 2);
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.reason)).toEqual(["A", "B"]);
  });

  it("로그 순번과 사건 요약을 함께 싣는다", () => {
    const entries = recentTrustChanges(LOG, ALPHA, 1);
    expect(entries[0].at).toBe(4);
    expect(entries[0].summary).toBe("4번째 결정");
  });

  it("원본 로그를 변경하지 않는다", () => {
    const snapshot = structuredClone(LOG);
    recentTrustChanges(LOG, ALPHA);
    expect(LOG).toEqual(snapshot);
  });
});
