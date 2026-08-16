import { TRUTH_TYPES, GRADES } from "@/lib/domain";
import type {
  CampaignStatistics,
  CardTruthStat,
  ExpeditionState,
  ExpeditionRecord,
  TurningPoint,
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

function scoreSwingOf(record: ExpeditionRecord): number {
  return Math.abs(record.scoreAfter - record.scoreBefore);
}

function addCardStats(
  base: Record<TruthType, CardTruthStat>,
  added: Record<TruthType, CardTruthStat>,
): Record<TruthType, CardTruthStat> {
  return Object.fromEntries(
    TRUTH_TYPES.map((truthType) => [truthType, {
      delivered: base[truthType].delivered + added[truthType].delivered,
      accepted: base[truthType].accepted + added[truthType].accepted,
      suspected: base[truthType].suspected + added[truthType].suspected,
      exposed: base[truthType].exposed + added[truthType].exposed,
      lateExposed: base[truthType].lateExposed + added[truthType].lateExposed,
    }]),
  ) as Record<TruthType, CardTruthStat>;
}

/**
 * 캠페인의 궤적을 꺾은 원정 하나를 고른다.
 *
 * 단위가 다른 값을 억지로 한 축에 더하지 않고 우선순위로 고른다. 첫 전멸이
 * 승급보다 앞서는 근거는 첫 백테스트다. wipeGoldFirst 전략의 77.4%가 첫
 * 전멸 뒤 지원 불가로 끝나 평균 6.4회 원정으로 캠페인이 멈췄다.
 *
 * 점수 변화폭을 마지막에 두는 것은 승급 점수가 `명성 × 2 + 누적 골드`라
 * 등급이 높은 던전일수록 보상도 손실도 커지기 때문이다. 이것만으로 고르면
 * S급 원정이 거의 항상 뽑혀 전환점이 등급의 다른 이름이 된다.
 *
 * 세 갈래 모두 비교가 `>`이므로 동률이면 먼저 온 기록이 남는다.
 * docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md 「확인된 밸런스 문제」
 */
export function findTurningPoint(
  records: readonly ExpeditionRecord[],
): TurningPoint | null {
  const wiped = records.find((record) => record.status === "failed");
  if (wiped !== undefined) {
    return {
      kind: "firstWipe",
      expeditionOrder: wiped.order,
      summary: `${wiped.order}번째 원정에서 출전한 파티가 전멸했다`,
    };
  }

  const promoted = records
    .filter((record) => record.rankBefore !== record.rankAfter)
    .reduce<ExpeditionRecord | null>(
      (best, record) =>
        best === null
          || GRADES.indexOf(record.rankAfter) > GRADES.indexOf(best.rankAfter)
          ? record
          : best,
      null,
    );
  if (promoted !== null) {
    return {
      kind: "promotion",
      expeditionOrder: promoted.order,
      summary: `${promoted.order}번째 원정에서 등급이 `
        + `${promoted.rankBefore}에서 ${promoted.rankAfter}로 올랐다`,
    };
  }

  const swung = records.reduce<ExpeditionRecord | null>(
    (best, record) =>
      best === null || scoreSwingOf(record) > scoreSwingOf(best) ? record : best,
    null,
  );
  if (swung === null) return null;

  return {
    kind: "scoreSwing",
    expeditionOrder: swung.order,
    summary: `${swung.order}번째 원정에서 승급 점수가 ${scoreSwingOf(swung)} 움직였다`,
  };
}

/**
 * 원정 하나를 통계에 접어 넣는다.
 *
 * 전환점을 증분으로 유지하지 않고 매번 연대기 전체에서 다시 고른다.
 * 우선순위가 뒤늦게 뒤집히기 때문이다. 3번째 원정에서 전멸하면 1·2번째에서
 * 고른 승급 전환점을 물러야 한다. 연대기가 15건 남짓이라 비용이 없다.
 */
export function recordExpedition(
  statistics: CampaignStatistics,
  record: ExpeditionRecord,
): CampaignStatistics {
  const expeditions = [...statistics.expeditions, record];

  return {
    cards: addCardStats(statistics.cards, record.cards),
    clearedExpeditions:
      statistics.clearedExpeditions + (record.status === "cleared" ? 1 : 0),
    wipedExpeditions:
      statistics.wipedExpeditions + (record.status === "failed" ? 1 : 0),
    expeditions,
    turningPoint: findTurningPoint(expeditions),
  };
}
