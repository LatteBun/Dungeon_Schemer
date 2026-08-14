import type { Grade } from "./campaign";
import type { BossId, ItemId } from "./ids";

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

export type ItemKind =
  | "healing"
  | "poison"
  | "food"
  | "information"
  | "lure";

export const ITEM_KINDS = [
  "healing",
  "poison",
  "food",
  "information",
  "lure",
] as const satisfies readonly ItemKind[];

export type ItemEffectTag =
  | "restoreHp"
  | "dealDamage"
  | "restoreFood"
  | "revealInformation"
  | "lureMonster";

export const ITEM_EFFECT_TAGS = [
  "restoreHp",
  "dealDamage",
  "restoreFood",
  "revealInformation",
  "lureMonster",
] as const satisfies readonly ItemEffectTag[];

export interface ItemDef {
  id: ItemId;
  kind: ItemKind;
  name: string;
  description: string;
  price: number;
  effectTags: readonly ItemEffectTag[];
}

export interface BossDef {
  id: BossId;
  grade: Grade;
  name: string;
  description: string;
  baseDamage: number;
}
