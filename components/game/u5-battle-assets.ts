export const U5_BATTLE_ENEMY_ASSET_SRC_BY_CONTENT_ID = {
  "spider-hatchling": "/assets/monsters/spider/monster-spider-hatchling.png",
  "spider-corpse": "/assets/monsters/spider/monster-spider-corpse.png",
  "spider-cave": "/assets/monsters/spider/monster-spider-cave.png",
  "spider-armored": "/assets/monsters/spider/monster-spider-armored.png",
  "spider-shadow": "/assets/monsters/spider/monster-spider-shadow.png",
  "boss-spider-1": "/assets/monsters/spider/boss-spider-01-ragna.png",
  "boss-spider-2": "/assets/monsters/spider/boss-spider-02-morkan.png",
  "boss-spider-3": "/assets/monsters/spider/boss-spider-03-serina.png",
  "boss-spider-4": "/assets/monsters/spider/boss-spider-04-araksha.png",
  "desert-scorpion": "/assets/monsters/desert/monster-desert-scorpion.png",
  "desert-lizard": "/assets/monsters/desert/monster-desert-lizard.png",
  "desert-cobra": "/assets/monsters/desert/monster-desert-cobra.png",
  "desert-spirit": "/assets/monsters/desert/monster-desert-spirit.png",
  "desert-mummy": "/assets/monsters/desert/monster-desert-mummy.png",
  "boss-desert-1": "/assets/monsters/desert/boss-desert-01-zakar.png",
  "boss-desert-2": "/assets/monsters/desert/boss-desert-02-kardum.png",
  "boss-desert-3": "/assets/monsters/desert/boss-desert-03-obelon.png",
  "boss-desert-4": "/assets/monsters/desert/boss-desert-04-nephris.png",
  "graveyard-zombie": "/assets/monsters/graveyard/monster-graveyard-zombie.png",
  "graveyard-ghoul": "/assets/monsters/graveyard/monster-graveyard-ghoul.png",
  "graveyard-soldier": "/assets/monsters/graveyard/monster-graveyard-soldier.png",
  "graveyard-archer": "/assets/monsters/graveyard/monster-graveyard-archer.png",
  "graveyard-mage": "/assets/monsters/graveyard/monster-graveyard-mage.png",
  "boss-graveyard-1": "/assets/monsters/graveyard/boss-graveyard-01-barkan.png",
  "boss-graveyard-2": "/assets/monsters/graveyard/boss-graveyard-02-morbian.png",
  "boss-graveyard-3": "/assets/monsters/graveyard/boss-graveyard-03-azrael.png",
  "boss-graveyard-4": "/assets/monsters/graveyard/boss-graveyard-04-valdrak.png",
} as const satisfies Readonly<Record<string, string>>;

export function enemyBattleAssetSrc(contentId: string): string {
  const src = (U5_BATTLE_ENEMY_ASSET_SRC_BY_CONTENT_ID as Readonly<Record<string, string>>)[contentId];
  if (src === undefined) throw new Error(`U5 전투 이미지가 없는 콘텐츠다: ${contentId}`);
  return src;
}
