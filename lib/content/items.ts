import type { ItemDef, ItemEffectTag, ItemId, ItemKind } from "@/lib/domain";

function item(
  id: string,
  kind: ItemKind,
  name: string,
  description: string,
  price: number,
  effectTags: readonly ItemEffectTag[],
): ItemDef {
  return { id: id as ItemId, kind, name, description, price, effectTags };
}

export const ITEMS: readonly ItemDef[] = [
  item("item-healing-potion", "healing", "치료제", "상처를 치료하는 작은 약병이다.", 8, ["restoreHp"]),
  item("item-venom-vial", "poison", "독병", "위험한 적에게 사용할 수 있는 독이다.", 11, ["dealDamage"]),
  item("item-hard-rations", "food", "비상 식량", "오래 보관할 수 있는 단단한 식량이다.", 5, ["restoreFood"]),
  item("item-information-scroll", "information", "정보 두루마리", "던전의 흔적을 해석하는 기록이다.", 14, ["revealInformation"]),
  item("item-lure-pouch", "lure", "유인용 미끼", "몬스터의 주의를 다른 곳으로 돌리는 미끼다.", 9, ["lureMonster"]),
];
