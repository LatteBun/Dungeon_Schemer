import { TRUTH_TYPES } from "@/lib/domain";
import type {
  CampaignStatistics,
  CardTruthStat,
  ExpeditionState,
  TruthType,
} from "@/lib/domain";

function emptyCardStat(): CardTruthStat {
  return { delivered: 0, accepted: 0, suspected: 0, exposed: 0, lateExposed: 0 };
}

/** 진위 세 종류를 모두 채운 빈 집계다. 빠진 키가 생기지 않게 상수에서 만든다. */
export function emptyCardStats(): Record<TruthType, CardTruthStat> {
  return Object.fromEntries(
    TRUTH_TYPES.map((truthType) => [truthType, emptyCardStat()]),
  ) as Record<TruthType, CardTruthStat>;
}

/**
 * 새 캠페인의 통계다.
 *
 * 상수가 아니라 함수인 이유는 집계가 가변 숫자를 담기 때문이다. 한 벌을
 * 공유하면 한 캠페인의 수치가 다음 캠페인에 새어 든다.
 */
export function emptyStatistics(): CampaignStatistics {
  return {
    cards: emptyCardStats(),
    clearedExpeditions: 0,
    wipedExpeditions: 0,
    expeditions: [],
    turningPoint: null,
  };
}

/**
 * 원정 하나의 정보 기록을 진위별로 접는다.
 *
 * 사후 발각의 세 조건이 여기 한 곳에만 있다. 수용된 거짓이라도 보스전을
 * 치르지 않았거나 그 사람이 보스전에서 죽었으면 검증이 일어나지 않는다.
 * lib/rules/boss.ts 가 생존자만 검증하기 때문이다.
 */
export function summarizeExpeditionCards(
  expedition: ExpeditionState,
): Record<TruthType, CardTruthStat> {
  const cards = emptyCardStats();
  const verified = new Set<string>(
    (expedition.bossResult?.survivorIds ?? []).map(String),
  );

  // applyInfoRecord 가 전달 순서대로 덧붙이므로 한 번의 전달은 같은 cardId 가
  // 연속으로 놓인 구간 하나다. id 를 집합으로 세면 같은 카드의 재전달이 사라진다.
  let previousCardId: string | null = null;

  for (const record of expedition.infoRecords) {
    const stat = cards[record.truthType];
    const cardId = record.cardId as string;

    if (cardId !== previousCardId) {
      stat.delivered += 1;
      previousCardId = cardId;
    }
    stat[record.reaction] += 1;

    if (record.pendingVerification && verified.has(record.memberId as string)) {
      stat.lateExposed += 1;
    }
  }

  return cards;
}
