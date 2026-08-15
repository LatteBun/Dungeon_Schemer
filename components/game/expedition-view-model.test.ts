import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { generateGradeMap } from "@/lib/rules/map";
import { createInfoOpportunity, evaluatePartyInfoCard } from "@/lib/rules/info";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import type {
  CampaignMember,
  ChoiceId,
  DungeonEvent,
  EventId,
  EventKind,
  ItemId,
} from "@/lib/domain";
import {
  toEventView,
  toInfoReactionsView,
  toMapView,
  toPartyStatusView,
} from "./expedition-view-model";

const ALL_EVENTS: DungeonEvent[] = [
  ...Object.values(DUNGEON_EVENT_POOLS.regular).flat(),
  ...DUNGEON_EVENT_POOLS.boss,
];
const eventById = (id: EventId): DungeonEvent => {
  const found = ALL_EVENTS.find((event) => event.id === id);
  if (found === undefined) throw new Error(`no event ${id}`);
  return found;
};
const eventKindById = (id: EventId): EventKind => eventById(id).kind;

function party(): CampaignMember[] {
  const state = initializeCampaign("u2-vm");
  const first = state.parties.find((candidate) => candidate.complete)!;
  return first.memberIds.map(
    (memberId) => state.members.find((member) => member.id === memberId)!,
  );
}

describe("toMapView", () => {
  it("현재·선택 가능·비활성 상태와 보스 노드를 표시한다", () => {
    const map = generateGradeMap("C", createRng("u2-vm-map").derive("map"));
    const view = toMapView(map, map.entryNodeId, [], eventKindById);
    const current = view.nodes.find((node) => node.id === map.entryNodeId);
    const entryNode = map.nodes.find((node) => node.id === map.entryNodeId)!;
    expect(current?.state).toBe("current");
    for (const node of view.nodes) {
      const selectable = entryNode.nextNodeIds.includes(node.id);
      if (selectable) expect(node.state).toBe("selectable");
    }
    expect(view.nodes.find((node) => node.id === map.bossNodeId)?.isBoss).toBe(true);
  });
});

describe("toEventView", () => {
  it("거래 잔액이 부족한 선택지를 비활성으로 표시한다", () => {
    const item = ITEMS[0];
    const event: DungeonEvent = {
      id: "e-merchant" as EventId,
      kind: "merchant",
      title: "떠돌이 상인",
      description: "상인이 물건을 편다.",
      choices: [
        {
          id: "c-buy" as ChoiceId,
          label: `${item.name} 구매`,
          expectedGain: "회복",
          knownRisk: "골드 소모",
          effectTags: ["trade"],
          itemId: item.id,
        },
        {
          id: "c-leave" as ChoiceId,
          label: "관망",
          expectedGain: "자원 보존",
          knownRisk: "기회 상실",
          effectTags: [],
        },
      ],
    };
    const itemById = (id: ItemId) => ITEMS.find((candidate) => candidate.id === id);
    const view = toEventView(event, item.price - 1, itemById);
    expect(view.choices[0].disabled).toBe(true);
    expect(view.choices[0].disabledReason).toMatch(/골드/);
    expect(view.choices[1].disabled).toBe(false);
  });
});

describe("toInfoReactionsView", () => {
  it("살아 있는 파티원마다 반응 라벨과 기호를 만든다", () => {
    const members = party();
    const map = generateGradeMap("C", createRng("u2-vm-info").derive("map"));
    const infoNode = map.nodes.find((node) => node.hasInfoOpportunity)!;
    const pending = createInfoOpportunity({
      node: infoNode,
      eventKind: eventKindById(infoNode.eventId),
      rng: createRng("u2-vm-info").derive("card"),
    });
    const card = INFO_CARDS.find((candidate) => candidate.id === pending.cardIds[0])!;
    const evaluation = evaluatePartyInfoCard({
      card,
      party: members,
      cardRng: createRng("u2-vm-info").derive("card"),
      trustRng: createRng("u2-vm-info").derive("trust"),
    });
    const view = toInfoReactionsView(evaluation);
    expect(view).toHaveLength(members.length);
    for (const row of view) {
      expect(["수용", "의심", "적발"]).toContain(row.reactionLabel);
      expect(["✓", "?", "!"]).toContain(row.reactionMark);
    }
  });
});

describe("toPartyStatusView", () => {
  it("신뢰 변화량과 빈 기억 문구를 파생한다", () => {
    const members = party();
    const view = toPartyStatusView(members, { [members[0].id]: 2 });
    expect(view[0].trustDelta).toBe(2);
    expect(view[1].trustDelta).toBe(0);
    expect(view[0].memoryNote).toBe("최근 변화 없음");
  });
});
