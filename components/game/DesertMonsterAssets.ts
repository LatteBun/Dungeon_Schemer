export interface DesertMonsterAsset {
  id: string;
  name: string;
  kind: "monster" | "boss";
  src: string;
  description: string;
}

export const DESERT_MONSTER_ASSETS = [
  {
    id: "desert-scorpion",
    name: "사막전갈",
    kind: "monster",
    src: "/assets/monsters/desert/monster-desert-scorpion.png",
    description: "물가 근처에 굴을 파고 밤에 활동",
  },
  {
    id: "desert-lizard",
    name: "모래도마뱀",
    kind: "monster",
    src: "/assets/monsters/desert/monster-desert-lizard.png",
    description: "열을 저장하고 낮에 활동",
  },
  {
    id: "desert-cobra",
    name: "사막코브라",
    kind: "monster",
    src: "/assets/monsters/desert/monster-desert-cobra.png",
    description: "그늘을 선호하고 열기에 예민",
  },
  {
    id: "desert-spirit",
    name: "모래정령",
    kind: "monster",
    src: "/assets/monsters/desert/monster-desert-spirit.png",
    description: "건조 지대에 서식하고 물기를 꺼림",
  },
  {
    id: "desert-mummy",
    name: "미이라",
    kind: "monster",
    src: "/assets/monsters/desert/monster-desert-mummy.png",
    description: "발자국을 남기지 않고 무덤을 수호",
  },
  {
    id: "boss-desert-1",
    name: "거대 전갈 자카르",
    kind: "boss",
    src: "/assets/monsters/desert/boss-desert-01-zakar.png",
    description: "모래 아래 매복하고 출현 직후 잠깐 움직임이 멈춤",
  },
  {
    id: "boss-desert-2",
    name: "샌드웜 카르둠",
    kind: "boss",
    src: "/assets/monsters/desert/boss-desert-02-kardum.png",
    description: "모래 속에서 진동을 좇고 크게 솟은 뒤 재잠복에 시간이 걸림",
  },
  {
    id: "boss-desert-3",
    name: "모래거신 오벨론",
    kind: "boss",
    src: "/assets/monsters/desert/boss-desert-03-obelon.png",
    description: "신전 돌더미가 뭉친 거신이며 떨어진 돌을 다시 끌어모음",
  },
  {
    id: "boss-desert-4",
    name: "스핑크스 네프리스",
    kind: "boss",
    src: "/assets/monsters/desert/boss-desert-04-nephris.png",
    description: "마지막 관문을 지키며 질문 후 답을 들을 때까지 움직이지 않음",
  },
] as const satisfies readonly DesertMonsterAsset[];

