import type { DecisionRecord, MemberId } from "@/lib/domain";

export interface TrustHistoryEntry {
  /** 로그 순번이다. 시각이 아니다. 시각을 쓰면 재현성이 깨진다. */
  at: number;
  /** 무슨 사건이었는지. DecisionRecord.summary 그대로다. */
  summary: string;
  /** 실제로 적용된 변화량이다. */
  delta: number;
  /** 그 성격이 왜 그렇게 반응했는지. */
  reason: string;
}

export const RECENT_TRUST_CHANGE_LIMIT = 3;

/**
 * 로그를 최신부터 거슬러 훑어 해당 파티원의 신뢰 변화만 모은다.
 * 로그는 추가 전용이므로 원본을 건드리지 않는다.
 */
export function recentTrustChanges(
  log: DecisionRecord[],
  memberId: MemberId,
  limit: number = RECENT_TRUST_CHANGE_LIMIT,
): TrustHistoryEntry[] {
  if (limit <= 0) return [];

  const entries: TrustHistoryEntry[] = [];

  for (let index = log.length - 1; index >= 0; index -= 1) {
    const record = log[index];
    for (const change of record.trustChanges) {
      if (change.memberId !== memberId) continue;
      entries.push({
        at: record.at,
        summary: record.summary,
        delta: change.delta,
        reason: change.reason,
      });
      if (entries.length >= limit) return entries;
    }
  }

  return entries;
}
