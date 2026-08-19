import type { ChoiceId, EventId, ItemId } from "./ids";

/** 사건 분류 넷. 모든 경로에 각각 한 번 이상 나온다. */
export type EventKind = "monster" | "rest" | "merchant" | "special";

export const EVENT_KINDS = [
  "monster",
  "rest",
  "merchant",
  "special",
] as const satisfies readonly EventKind[];

export type EventEffectTag =
  | "support"
  | "sabotage"
  | "rest"
  | "trade"
  | "item"
  | "information"
  | "observe";

export const EVENT_EFFECT_TAGS = [
  "support",
  "sabotage",
  "rest",
  "trade",
  "item",
  "information",
  "observe",
] as const satisfies readonly EventEffectTag[];

export type ItemKind = "remedy" | "poison" | "food" | "scroll" | "bait";

export const ITEM_KINDS = [
  "remedy",
  "poison",
  "food",
  "scroll",
  "bait",
] as const satisfies readonly ItemKind[];

export interface ItemDef {
  id: ItemId;
  kind: ItemKind;
  name: string;
  description: string;
  price: number;
}

export interface EventChoice {
  id: ChoiceId;
  label: string;
  effectTags: readonly EventEffectTag[];
}

export interface DungeonEvent {
  id: EventId;
  kind: EventKind;
  title: string;
  description: string;
  /** 사건마다 선택지 2개 이상이다. */
  choices: readonly EventChoice[];
}
