import { BOSSES } from "@/lib/content/bosses";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import { validateContentPools } from "@/lib/content/validation";
import { EVENT_KINDS, RuleError } from "@/lib/domain";
import type { BossDef, DungeonEvent, EventKind, InfoCard, ItemDef } from "@/lib/domain";
import { createFixtureCampaignState, createFixtureExpeditionState } from "@/lib/rules/fixtures";

export interface F2NegativeCase {
  label: string;
  pass: boolean;
  errorCode?: string;
  message?: string;
}

export interface F2Snapshot {
  seed: string;
  f1: {
    campaign: { seed: string; phase: string; rank: string; dungeonCount: number; partyCount: number };
    expedition: { dungeonId: string; partyId: string; mapNodeCount: number; pathCount: number };
  };
  contentStatus: "pass" | "fail";
  contentError?: string;
  events: { total: number; byKind: Record<EventKind, number>; minimumChoices: number; entries: Array<{ id: string; kind: EventKind; title: string; choiceCount: number }> };
  cards: { total: number; byTruthType: Record<string, number>; bossSubjectCount: number; entries: Array<{ id: string; truthType: string; subject: string; topic: string }> };
  items: { total: number; kinds: string[]; hasFakeMap: boolean; entries: Array<{ id: string; kind: string; name: string; price: number; effectTags: readonly string[] }> };
  bosses: { grades: string[]; entries: Array<{ id: string; grade: string; name: string; baseDamage: number }> };
  capacity: Array<{ grade: string; required: number; available: number; pass: boolean }>;
  negativeCases: F2NegativeCase[];
  reproducibility: { sameSeed: boolean; campaignSeed: string; expeditionNodeIds: string[] };
}

type MutablePools = { events: { regular: Record<EventKind, DungeonEvent[]>; boss: DungeonEvent[] }; cards: InfoCard[]; items: ItemDef[]; bosses: BossDef[] };

function mutablePools(): MutablePools {
  return structuredClone({ events: DUNGEON_EVENT_POOLS, cards: INFO_CARDS, items: ITEMS, bosses: BOSSES }) as MutablePools;
}

function negativeCase(label: string, mutate: (pools: MutablePools) => void): F2NegativeCase {
  const pools = mutablePools();
  try {
    mutate(pools);
    validateContentPools(pools);
    return { label, pass: false, message: "검증이 실패하지 않았다." };
  } catch (error) {
    const ruleError = error instanceof RuleError ? error : undefined;
    return { label, pass: ruleError?.code === "INVALID_GENERATION", errorCode: ruleError?.code, message: ruleError?.message ?? String(error) };
  }
}

function f1Snapshot(seed: string) {
  const campaign = createFixtureCampaignState(seed);
  const expedition = createFixtureExpeditionState();
  return {
    campaign: { seed: campaign.seed, phase: campaign.phase, rank: campaign.rank, dungeonCount: campaign.dungeons.length, partyCount: campaign.parties.length },
    expedition: { dungeonId: String(expedition.dungeonId), partyId: String(expedition.partyId), mapNodeCount: expedition.map.nodes.length, pathCount: expedition.map.paths.length },
  };
}

export function createF2TestSnapshot(seed: string): F2Snapshot {
  const pools = mutablePools();
  let contentStatus: F2Snapshot["contentStatus"] = "pass";
  let contentError: string | undefined;
  try { validateContentPools(pools); } catch (error) { contentStatus = "fail"; contentError = error instanceof Error ? error.message : String(error); }
  const regularEvents = EVENT_KINDS.flatMap((kind) => DUNGEON_EVENT_POOLS.regular[kind]);
  const allEvents = [...regularEvents, ...DUNGEON_EVENT_POOLS.boss];
  const byKind = Object.fromEntries(EVENT_KINDS.map((kind) => [kind, DUNGEON_EVENT_POOLS.regular[kind].length])) as Record<EventKind, number>;
  const byTruthType = Object.fromEntries(["truth", "lie", "neutral"].map((truthType) => [truthType, INFO_CARDS.filter((card) => card.truthType === truthType).length]));
  const f1 = f1Snapshot(seed);
  const f1Again = f1Snapshot(seed);
  const negativeCases = [
    negativeCase("중복 사건 ID", (value) => { value.events.regular.rest[0].id = value.events.regular.monster[0].id; }),
    negativeCase("일반 사건 부족", (value) => { value.events.regular.special = value.events.regular.special.slice(0, 2); }),
    negativeCase("보스 주제 카드 부족", (value) => { value.cards = value.cards.filter((card) => card.subject !== "boss"); }),
    negativeCase("유인용 미끼 누락", (value) => { value.items = value.items.filter((item) => item.kind !== "lure"); }),
    negativeCase("보스 기본 피해 오류", (value) => { value.bosses[0].baseDamage = 0; }),
  ];
  return {
    seed,
    f1,
    contentStatus,
    contentError,
    events: { total: regularEvents.length, byKind, minimumChoices: Math.min(...allEvents.map((event) => event.choices.length)), entries: allEvents.map((event) => ({ id: String(event.id), kind: event.kind, title: event.title, choiceCount: event.choices.length })) },
    cards: { total: INFO_CARDS.length, byTruthType, bossSubjectCount: INFO_CARDS.filter((card) => card.subject === "boss").length, entries: INFO_CARDS.map((card) => ({ id: String(card.id), truthType: card.truthType, subject: card.subject, topic: card.topic })) },
    items: { total: ITEMS.length, kinds: ITEMS.map((item) => item.kind), hasFakeMap: ITEMS.some((item) => `${item.id} ${item.name}`.includes("fake-map") || item.name.includes("가짜 지도")), entries: ITEMS.map((item) => ({ id: String(item.id), kind: item.kind, name: item.name, price: item.price, effectTags: item.effectTags })) },
    bosses: { grades: BOSSES.map((boss) => boss.grade), entries: BOSSES.map((boss) => ({ id: String(boss.id), grade: boss.grade, name: boss.name, baseDamage: boss.baseDamage })) },
    capacity: ([6, 8, 10, 12] as const).map((required, index) => ({ grade: ["C", "B", "A", "S"][index], required, available: regularEvents.length, pass: regularEvents.length >= required })),
    negativeCases,
    reproducibility: { sameSeed: JSON.stringify(f1) === JSON.stringify(f1Again), campaignSeed: f1Again.campaign.seed, expeditionNodeIds: createFixtureExpeditionState().map.nodes.map((node) => String(node.id)) },
  };
}
