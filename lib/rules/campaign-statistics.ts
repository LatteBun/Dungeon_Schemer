import {
  CAMPAIGN_DUNGEON_ORDERS,
  RuleError,
} from "@/lib/domain";
import type {
  CampaignDungeon,
  CampaignDungeonOrder,
  CampaignStatistics,
  SettlementResult,
  SettlementSummary,
} from "@/lib/domain";

function invalidState(message: string, details: Record<string, unknown> = {}): never {
  throw new RuleError("INVALID_STATE", message, details);
}

function duplicateId(expeditionId: string): never {
  throw new RuleError("DUPLICATE_ID", "정산 원정 ID가 이미 통계에 있다", { expeditionId });
}

function isCampaignDungeonOrder(value: number): value is CampaignDungeonOrder {
  return (CAMPAIGN_DUNGEON_ORDERS as readonly number[]).includes(value);
}

function countDeaths(settlement: SettlementResult): 0 | 1 | 2 | 3 {
  const count = settlement.memberChanges.filter(
    ({ before, after }) => before.alive && !after.alive,
  ).length;
  if (count > 3) {
    return invalidState("정산 사망자 수가 파티 크기를 넘는다", {
      expeditionId: settlement.expeditionId,
      count,
    });
  }
  return count as 0 | 1 | 2 | 3;
}

function summaryFor(
  settlement: SettlementResult,
  dungeon: Pick<CampaignDungeon, "id" | "campaignOrder">,
): SettlementSummary {
  const deathCount = countDeaths(settlement);
  return {
    expeditionId: settlement.expeditionId,
    dungeonId: settlement.dungeonId,
    dungeonOrder: dungeon.campaignOrder,
    status: settlement.status,
    goldEarned: settlement.goldDelta + settlement.relicGold,
    survivorCount: settlement.survivorCount,
    deathCount,
  };
}

function assertStatisticsIntegrity(statistics: CampaignStatistics): void {
  const { settlements, settlementHistory } = statistics;
  if (settlements.length !== settlementHistory.length) {
    invalidState("원본 정산과 요약 이력의 길이가 다르다");
  }

  const settlementIds = new Set<string>();
  const summaryIds = new Set<string>();
  let clearedExpeditions = 0;
  let wipedExpeditions = 0;
  let totalDeaths = 0;
  let totalGoldEarned = 0;
  let highestDungeonCleared: CampaignDungeonOrder | 0 = 0;

  for (const [index, settlement] of settlements.entries()) {
    const summary = settlementHistory[index];
    if (summary === undefined) {
      invalidState("정산 요약 이력이 누락됐다", { index });
    }
    if (settlementIds.has(settlement.expeditionId)) {
      duplicateId(settlement.expeditionId);
    }
    if (summaryIds.has(summary.expeditionId)) {
      duplicateId(summary.expeditionId);
    }
    settlementIds.add(settlement.expeditionId);
    summaryIds.add(summary.expeditionId);

    if (
      settlement.expeditionId !== summary.expeditionId
      || settlement.dungeonId !== summary.dungeonId
      || settlement.status !== summary.status
      || settlement.survivorCount !== summary.survivorCount
      || !isCampaignDungeonOrder(summary.dungeonOrder)
      || summary.goldEarned !== settlement.goldDelta + settlement.relicGold
      || summary.deathCount !== countDeaths(settlement)
    ) {
      invalidState("정산 원본과 요약 이력이 일치하지 않는다", {
        expeditionId: settlement.expeditionId,
        index,
      });
    }

    if (settlement.status === "cleared") {
      clearedExpeditions += 1;
      highestDungeonCleared = Math.max(
        highestDungeonCleared,
        summary.dungeonOrder,
      ) as CampaignDungeonOrder;
    } else {
      wipedExpeditions += 1;
    }
    totalDeaths += summary.deathCount;
    totalGoldEarned += summary.goldEarned;
  }

  if (
    statistics.totalExpeditions !== settlements.length
    || statistics.clearedExpeditions !== clearedExpeditions
    || statistics.wipedExpeditions !== wipedExpeditions
    || statistics.totalDeaths !== totalDeaths
    || statistics.totalGoldEarned !== totalGoldEarned
    || statistics.highestDungeonCleared !== highestDungeonCleared
  ) {
    invalidState("정산 이력과 통계 합계가 일치하지 않는다");
  }
}

export function recordSettlementStatistics(
  statistics: CampaignStatistics,
  settlement: SettlementResult,
  dungeon: Pick<CampaignDungeon, "id" | "campaignOrder">,
): CampaignStatistics {
  assertStatisticsIntegrity(statistics);
  if (dungeon.id !== settlement.dungeonId) {
    invalidState("정산 던전과 통계 입력 던전이 다르다", {
      settlementDungeonId: settlement.dungeonId,
      dungeonId: dungeon.id,
    });
  }
  if (!isCampaignDungeonOrder(dungeon.campaignOrder)) {
    invalidState("정산 던전 순서가 유효하지 않다", {
      campaignOrder: dungeon.campaignOrder,
    });
  }
  if (
    statistics.settlements.some(({ expeditionId }) => expeditionId === settlement.expeditionId)
    || statistics.settlementHistory.some(({ expeditionId }) => expeditionId === settlement.expeditionId)
  ) {
    duplicateId(settlement.expeditionId);
  }

  const summary = summaryFor(settlement, dungeon);
  const isCleared = settlement.status === "cleared";
  return {
    settlements: [...statistics.settlements, settlement],
    settlementHistory: [...statistics.settlementHistory, summary],
    totalExpeditions: statistics.totalExpeditions + 1,
    clearedExpeditions: statistics.clearedExpeditions + (isCleared ? 1 : 0),
    wipedExpeditions: statistics.wipedExpeditions + (isCleared ? 0 : 1),
    totalDeaths: statistics.totalDeaths + summary.deathCount,
    totalGoldEarned: statistics.totalGoldEarned + summary.goldEarned,
    highestDungeonCleared: isCleared
      ? Math.max(statistics.highestDungeonCleared, dungeon.campaignOrder) as CampaignDungeonOrder
      : statistics.highestDungeonCleared,
  };
}
