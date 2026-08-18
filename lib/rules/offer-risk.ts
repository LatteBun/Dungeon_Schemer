import type { DungeonEventPools } from "@/lib/content/events";
import { EVENT_KINDS, RuleError } from "@/lib/domain";
import type {
  BoardOffer,
  CampaignState,
  EventKind,
  GeneratedMap,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { expeditionKey } from "./expedition-key";
import { generateGradeMap } from "./map";

export interface OfferRiskSummary {
  /** 입구와 보스방을 뺀 사건 지점의 분류별 개수. 합은 offer.nodeCount다. */
  readonly counts: Readonly<Record<EventKind, number>>;
  /** 보스방 수. 지도마다 항상 1이다. */
  readonly bossCount: number;
}

/**
 * 공고가 가리키는 던전의 지도를 계약 전에 만든다.
 *
 * 탐험이 쓰는 expeditionKey 를 그대로 쓰므로 계약 뒤 생기는 지도와 같다.
 * 키가 공고와 파티를 타지 않기 때문이다.
 */
export function previewOfferMap(
  state: CampaignState,
  offer: BoardOffer,
  pools: DungeonEventPools,
): GeneratedMap {
  const dungeon = state.dungeons.find(
    (candidate) => candidate.id === offer.dungeonId,
  );
  if (dungeon === undefined) {
    throw new RuleError(
      "UNKNOWN_ID",
      `캠페인에 없는 던전이다: ${offer.dungeonId}`,
      { offerId: offer.id, dungeonId: offer.dungeonId },
    );
  }

  return generateGradeMap(
    dungeon.grade,
    createRng(expeditionKey(state, dungeon)).derive("map"),
    { eventPools: pools },
  );
}

/**
 * 계약 전에 공개하는 사건 분류별 개수다.
 *
 * 지도 전체 기준이라 실제로 한 경로에서 지나는 지점보다 많다. 계약 단계의
 * 질문이 "어느 갈래로 갈까"가 아니라 "이 던전이 대체로 어떤 성격인가"이므로
 * 갈래별로 나누지 않는다.
 *
 * CampaignMachineContext 를 받지 않는 이유는 그 타입이 lib/flow 에 있고
 * lib/rules 가 lib/flow 를 import 하지 않기 때문이다. 조회표를 매번 만들지만
 * 이 경로는 사람이 게시판을 볼 때만 돈다.
 */
export function summarizeOfferRisk(
  state: CampaignState,
  offer: BoardOffer,
  pools: DungeonEventPools,
): OfferRiskSummary {
  const map = previewOfferMap(state, offer, pools);
  const kindById = new Map<string, EventKind>(
    EVENT_KINDS.flatMap((kind) =>
      pools.regular[kind].map((event) => [event.id as string, kind])),
  );

  const counts: Record<EventKind, number> = {
    monster: 0,
    rest: 0,
    merchant: 0,
    special: 0,
  };
  let bossCount = 0;

  for (const node of map.nodes) {
    if (node.id === map.bossNodeId) {
      bossCount += 1;
      continue;
    }
    // 입구는 전용 사건을 쓰고 일반 풀에 없다. 사건이 열리지도 않으므로 세지 않는다.
    if (node.id === map.entryNodeId) continue;
    const kind = kindById.get(node.eventId as string);
    if (kind === undefined) {
      throw new RuleError(
        "UNKNOWN_ID",
        `풀에 없는 사건이 지도에 있다: ${node.eventId}`,
        { nodeId: node.id, eventId: node.eventId },
      );
    }
    counts[kind] += 1;
  }

  return { counts, bossCount };
}
