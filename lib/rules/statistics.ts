import { TRUTH_TYPES } from "@/lib/domain";
import type {
  CampaignStatistics,
  CardTruthStat,
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
