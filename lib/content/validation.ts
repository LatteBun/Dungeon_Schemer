import { EVENT_EFFECT_TAGS, GRADES, ITEM_EFFECT_TAGS, ITEM_KINDS, RuleError, TRUTH_TYPES } from "@/lib/domain";
import type { BossDef, DungeonEvent, EventKind, InfoCard, ItemDef } from "@/lib/domain";
import type { DungeonEventPools } from "@/lib/content/events";

export interface ContentPools {
  events: DungeonEventPools;
  cards: readonly InfoCard[];
  items: readonly ItemDef[];
  bosses: readonly BossDef[];
}

function invalid(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function requireText(
  value: string,
  message: string,
  details: Record<string, unknown>,
): void {
  if (value.trim() === "") invalid(message, details);
}

function requireEventTag(tag: string, choiceId: string): void {
  if (!EVENT_EFFECT_TAGS.includes(tag as (typeof EVENT_EFFECT_TAGS)[number])) {
    invalid(`허용되지 않은 사건 효과 태그다: ${choiceId}`, { contentType: "eventChoice", id: choiceId, tag });
  }
}

interface EventValidationOptions {
  minimumChoices: number;
  rejectBossTarget: boolean;
}

function validateEvent(
  event: DungeonEvent,
  expectedKind: EventKind,
  eventIds: Set<string>,
  choiceIds: Set<string>,
  options: EventValidationOptions,
): void {
  if (event.kind !== expectedKind) {
    invalid(`이벤트 분류가 ${expectedKind} 풀이 아니다: ${event.id}`, { contentType: "event", id: event.id, kind: expectedKind });
  }
  if (eventIds.has(event.id)) {
    invalid(`이벤트 ID가 중복된다: ${event.id}`, { contentType: "event", id: event.id });
  }
  eventIds.add(event.id);
  requireText(event.title, `이벤트 제목이 비어 있다: ${event.id}`, { contentType: "event", id: event.id });
  requireText(event.description, `이벤트 설명이 비어 있다: ${event.id}`, { contentType: "event", id: event.id });
  if (event.choices.length < options.minimumChoices) {
    if (event.choices.length === 0) {
      invalid(`선택지가 없는 이벤트다: ${event.id}`, { contentType: "event", id: event.id, expected: options.minimumChoices, actual: 0 });
    }
    invalid(`선택지가 ${options.minimumChoices}개 미만인 이벤트다: ${event.id}`, { contentType: "event", id: event.id, expected: options.minimumChoices, actual: event.choices.length });
  }
  for (const choice of event.choices) {
    if (choiceIds.has(choice.id)) {
      invalid(`선택지 ID가 중복된다: ${choice.id}`, { contentType: "eventChoice", id: choice.id });
    }
    choiceIds.add(choice.id);
    requireText(choice.label, `선택지 라벨이 비어 있다: ${choice.id}`, { contentType: "eventChoice", id: choice.id });
    requireText(choice.expectedGain, `예상 이득이 비어 있다: ${choice.id}`, { contentType: "eventChoice", id: choice.id });
    requireText(choice.knownRisk, `알려진 위험이 비어 있다: ${choice.id}`, { contentType: "eventChoice", id: choice.id });
    if (choice.effectTags.length === 0) invalid(`사건 효과 태그가 비어 있다: ${choice.id}`, { contentType: "eventChoice", id: choice.id });
    for (const tag of choice.effectTags) requireEventTag(tag, choice.id);
    if (choice.target?.kind === "member") {
      invalid(`파티원 대상 선택지는 사용할 수 없다: ${choice.id}`, { contentType: "eventChoice", id: choice.id, targetKind: "member" });
    }
    if (options.rejectBossTarget && choice.target?.kind === "boss") {
      invalid(`F2 사건은 보스 대상 선택지를 사용할 수 없다: ${choice.id}`, { contentType: "eventChoice", id: choice.id, targetKind: "boss" });
    }
  }
}

function validateEventPools(
  pools: DungeonEventPools,
  minimumEventsPerKind: number,
  minimumChoices: number,
  rejectBossTarget: boolean,
): void {
  const eventIds = new Set<string>();
  const choiceIds = new Set<string>();
  let regularCount = 0;
  for (const kind of ["monster", "rest", "merchant", "special"] as const) {
    const events = pools.regular[kind];
    if (events.length < minimumEventsPerKind) {
      invalid(`${kind} 이벤트 풀은 최소 ${minimumEventsPerKind}개여야 한다: ${events.length}`, { contentType: "event", kind, expected: minimumEventsPerKind, actual: events.length });
    }
    regularCount += events.length;
    for (const event of events) validateEvent(event, kind, eventIds, choiceIds, { minimumChoices, rejectBossTarget });
  }
  if (regularCount < 12 && minimumEventsPerKind >= 3) {
    invalid(`일반 이벤트 풀은 최소 12개여야 한다: ${regularCount}`, { contentType: "event", expected: 12, actual: regularCount });
  }
  if (pools.boss.length === 0) invalid("보스 이벤트 풀이 비어 있다.", { contentType: "event", kind: "boss", expected: 1, actual: 0 });
  for (const event of pools.boss) {
    if (event.kind !== "special") invalid(`보스 이벤트는 special이어야 한다: ${event.id}`, { contentType: "event", id: event.id, kind: "boss", expected: "special", actual: event.kind });
    validateEvent(event, "special", eventIds, choiceIds, { minimumChoices, rejectBossTarget });
  }
}

function validateCards(cards: readonly InfoCard[]): void {
  const ids = new Set<string>();
  const counts = new Map<string, number>();
  let bossCount = 0;
  for (const card of cards) {
    if (ids.has(card.id)) invalid(`정보 카드 ID가 중복된다: ${card.id}`, { contentType: "card", id: card.id });
    ids.add(card.id);
    requireText(card.topic, `정보 카드 주제가 비어 있다: ${card.id}`, { contentType: "card", id: card.id });
    requireText(card.text, `정보 카드 본문이 비어 있다: ${card.id}`, { contentType: "card", id: card.id });
    counts.set(card.truthType, (counts.get(card.truthType) ?? 0) + 1);
    if (card.subject === "boss") bossCount += 1;
  }
  for (const truthType of TRUTH_TYPES) {
    const actual = counts.get(truthType) ?? 0;
    if (actual !== 4) invalid(`정보 카드 ${truthType} 수량이 4개가 아니다: ${actual}`, { contentType: "card", kind: truthType, expected: 4, actual });
  }
  if (bossCount < 2) invalid(`보스 주제 정보 카드가 2개 미만이다: ${bossCount}`, { contentType: "card", kind: "boss", expected: 2, actual: bossCount });
}

function validateItems(items: readonly ItemDef[]): void {
  const ids = new Set<string>();
  const names = new Set<string>();
  const kinds = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) invalid(`아이템 ID가 중복된다: ${item.id}`, { contentType: "item", id: item.id });
    ids.add(item.id);
    if (names.has(item.name)) invalid(`아이템 이름이 중복된다: ${item.name}`, { contentType: "item", id: item.id });
    names.add(item.name);
    requireText(item.name, `아이템 이름이 비어 있다: ${item.id}`, { contentType: "item", id: item.id });
    requireText(item.description, `아이템 설명이 비어 있다: ${item.id}`, { contentType: "item", id: item.id });
    if (!Number.isInteger(item.price) || item.price < 0) invalid(`아이템 가격이 비정상이다: ${item.id}`, { contentType: "item", id: item.id, price: item.price });
    if (item.effectTags.length === 0) invalid(`아이템 효과 태그가 비어 있다: ${item.id}`, { contentType: "item", id: item.id });
    for (const tag of item.effectTags) if (!ITEM_EFFECT_TAGS.includes(tag as (typeof ITEM_EFFECT_TAGS)[number])) invalid(`허용되지 않은 아이템 효과 태그다: ${item.id}`, { contentType: "item", id: item.id, tag });
    kinds.add(item.kind);
  }
  for (const kind of ITEM_KINDS) if (!kinds.has(kind)) invalid(`필수 아이템 종류가 누락됐다: ${kind}`, { contentType: "item", kind });
}

function validateBosses(bosses: readonly BossDef[]): void {
  const ids = new Set<string>();
  const grades = new Set<string>();
  for (const boss of bosses) {
    if (ids.has(boss.id)) invalid(`보스 ID가 중복된다: ${boss.id}`, { contentType: "boss", id: boss.id });
    ids.add(boss.id);
    if (grades.has(boss.grade)) invalid(`보스 등급이 중복된다: ${boss.grade}`, { contentType: "boss", kind: boss.grade });
    grades.add(boss.grade);
    requireText(boss.name, `보스 이름이 비어 있다: ${boss.id}`, { contentType: "boss", id: boss.id });
    requireText(boss.description, `보스 설명이 비어 있다: ${boss.id}`, { contentType: "boss", id: boss.id });
    if (!Number.isInteger(boss.baseDamage) || boss.baseDamage < 1) invalid(`보스 기본 피해가 비정상이다: ${boss.id}`, { contentType: "boss", id: boss.id, baseDamage: boss.baseDamage });
  }
  for (const grade of GRADES) if (!grades.has(grade)) invalid(`등급별 보스가 누락됐다: ${grade}`, { contentType: "boss", kind: grade });
}

export function validateDungeonEventPools(pools: DungeonEventPools): void {
  validateEventPools(pools, 2, 1, false);
}

export function validateContentPools(pools: ContentPools): void {
  validateEventPools(pools.events, 3, 2, true);
  if (pools.cards.length !== 12) invalid(`정보 카드 풀은 12개여야 한다: ${pools.cards.length}`, { contentType: "card", expected: 12, actual: pools.cards.length });
  validateCards(pools.cards);
  validateItems(pools.items);
  validateBosses(pools.bosses);
}
