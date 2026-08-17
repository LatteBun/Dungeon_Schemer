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
  /**
   * 한 턴에 대상 하나에게 주는 피해.
   *
   * 턴제로 바뀌기 전에는 전투 내내 한 번 주는 값이었다. 매 턴 적용되므로
   * 뜻이 달라졌고 수치도 함께 낮췄다.
   * docs/superpowers/specs/2026-08-17-sbh3821-turn-based-boss-fight-design.md
   */
  baseDamage: number;
  /** 파티가 이만큼 깎으면 보스가 쓰러진다. */
  maxHp: number;
}
