import { CLASSES } from "@/lib/content/classes";
import {
  CHARACTER_POOL_SIZE,
  CHARACTERS_PER_CLASS,
  type CharacterId,
  type ClassId,
} from "@/lib/domain";

export const CHARACTER_GENDERS = ["male", "female"] as const;

export type CharacterGender = (typeof CHARACTER_GENDERS)[number];

export const PORTRAIT_VARIANTS = ["a", "b", "c", "d", "e", "f"] as const;

export type PortraitVariant = (typeof PORTRAIT_VARIANTS)[number];

export interface CharacterRosterEntry {
  readonly id: CharacterId;
  readonly name: string;
  readonly gender: CharacterGender;
  readonly classId: ClassId;
  readonly portraitVariant: PortraitVariant;
}

export const CHARACTER_ROSTER = [
  { id: "character-warrior-a" as CharacterId, name: "발드릭", gender: "male", classId: "warrior" as ClassId, portraitVariant: "a" },
  { id: "character-warrior-b" as CharacterId, name: "브리엘라", gender: "female", classId: "warrior" as ClassId, portraitVariant: "b" },
  { id: "character-warrior-c" as CharacterId, name: "로데릭", gender: "male", classId: "warrior" as ClassId, portraitVariant: "c" },
  { id: "character-warrior-d" as CharacterId, name: "마르셀라", gender: "female", classId: "warrior" as ClassId, portraitVariant: "d" },
  { id: "character-warrior-e" as CharacterId, name: "토르벤", gender: "male", classId: "warrior" as ClassId, portraitVariant: "e" },
  { id: "character-warrior-f" as CharacterId, name: "이솔라", gender: "female", classId: "warrior" as ClassId, portraitVariant: "f" },
  { id: "character-archer-a" as CharacterId, name: "엘리시아", gender: "female", classId: "archer" as ClassId, portraitVariant: "a" },
  { id: "character-archer-b" as CharacterId, name: "알렌", gender: "male", classId: "archer" as ClassId, portraitVariant: "b" },
  { id: "character-archer-c" as CharacterId, name: "카엘", gender: "male", classId: "archer" as ClassId, portraitVariant: "c" },
  { id: "character-archer-d" as CharacterId, name: "레오니스", gender: "male", classId: "archer" as ClassId, portraitVariant: "d" },
  { id: "character-archer-e" as CharacterId, name: "리비아", gender: "female", classId: "archer" as ClassId, portraitVariant: "e" },
  { id: "character-archer-f" as CharacterId, name: "아델린", gender: "female", classId: "archer" as ClassId, portraitVariant: "f" },
  { id: "character-cleric-a" as CharacterId, name: "세드릭", gender: "male", classId: "cleric" as ClassId, portraitVariant: "a" },
  { id: "character-cleric-b" as CharacterId, name: "세실리아", gender: "female", classId: "cleric" as ClassId, portraitVariant: "b" },
  { id: "character-cleric-c" as CharacterId, name: "루시엔", gender: "male", classId: "cleric" as ClassId, portraitVariant: "c" },
  { id: "character-cleric-d" as CharacterId, name: "로레나", gender: "female", classId: "cleric" as ClassId, portraitVariant: "d" },
  { id: "character-cleric-e" as CharacterId, name: "아멜리아", gender: "female", classId: "cleric" as ClassId, portraitVariant: "e" },
  { id: "character-cleric-f" as CharacterId, name: "에드윈", gender: "male", classId: "cleric" as ClassId, portraitVariant: "f" },
  { id: "character-mage-a" as CharacterId, name: "발테르", gender: "male", classId: "mage" as ClassId, portraitVariant: "a" },
  { id: "character-mage-b" as CharacterId, name: "비비안", gender: "female", classId: "mage" as ClassId, portraitVariant: "b" },
  { id: "character-mage-c" as CharacterId, name: "오스카르", gender: "male", classId: "mage" as ClassId, portraitVariant: "c" },
  { id: "character-mage-d" as CharacterId, name: "셀레네", gender: "female", classId: "mage" as ClassId, portraitVariant: "d" },
  { id: "character-mage-e" as CharacterId, name: "에리온", gender: "male", classId: "mage" as ClassId, portraitVariant: "e" },
  { id: "character-mage-f" as CharacterId, name: "헨서라", gender: "female", classId: "mage" as ClassId, portraitVariant: "f" },
  { id: "character-rogue-a" as CharacterId, name: "라울", gender: "male", classId: "rogue" as ClassId, portraitVariant: "a" },
  { id: "character-rogue-b" as CharacterId, name: "카밀라", gender: "female", classId: "rogue" as ClassId, portraitVariant: "b" },
  { id: "character-rogue-c" as CharacterId, name: "다미안", gender: "male", classId: "rogue" as ClassId, portraitVariant: "c" },
  { id: "character-rogue-d" as CharacterId, name: "니콜라스", gender: "male", classId: "rogue" as ClassId, portraitVariant: "d" },
  { id: "character-rogue-e" as CharacterId, name: "베로니카", gender: "female", classId: "rogue" as ClassId, portraitVariant: "e" },
  { id: "character-rogue-f" as CharacterId, name: "이네스", gender: "female", classId: "rogue" as ClassId, portraitVariant: "f" },
] as const satisfies readonly CharacterRosterEntry[];

function assertRoster(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`공식 캐릭터 로스터 불변식 위반: ${message}`);
}

function createRosterById(): ReadonlyMap<CharacterId, CharacterRosterEntry> {
  assertRoster(CHARACTER_ROSTER.length === CHARACTER_POOL_SIZE, `수는 ${CHARACTER_POOL_SIZE}명이어야 한다`);

  const ids = new Set<CharacterId>();
  const names = new Set<string>();
  const supportedGenders = new Set<string>(CHARACTER_GENDERS);
  const byId = new Map<CharacterId, CharacterRosterEntry>();

  for (const entry of CHARACTER_ROSTER) {
    assertRoster(!ids.has(entry.id), `ID가 중복되었다: ${entry.id}`);
    assertRoster(!names.has(entry.name), `이름이 중복되었다: ${entry.name}`);
    assertRoster(supportedGenders.has(entry.gender), `지원하지 않는 성별이다: ${entry.gender}`);
    assertRoster(CLASSES.some((classDef) => classDef.id === entry.classId), `직업을 찾을 수 없다: ${entry.classId}`);
    assertRoster(
      entry.id === `character-${entry.classId}-${entry.portraitVariant}`,
      `ID와 직업·변형이 일치하지 않는다: ${entry.id}`,
    );
    ids.add(entry.id);
    names.add(entry.name);
    byId.set(entry.id, entry);
  }

  for (const classDef of CLASSES) {
    const entries = CHARACTER_ROSTER.filter((entry) => entry.classId === classDef.id);
    assertRoster(entries.length === CHARACTERS_PER_CLASS, `${classDef.id} 인원은 ${CHARACTERS_PER_CLASS}명이어야 한다`);
    const variants = entries.map((entry) => entry.portraitVariant).sort();
    assertRoster(
      variants.every((variant, index) => variant === PORTRAIT_VARIANTS[index]),
      `${classDef.id} 변형은 A~F를 각각 한 번씩 가져야 한다`,
    );
  }

  return byId;
}

const rosterById = createRosterById();

export function characterRosterEntryFor(characterId: CharacterId): CharacterRosterEntry {
  const entry = rosterById.get(characterId);
  if (entry === undefined) {
    throw new Error(`공식 캐릭터 로스터에 없는 ID: ${characterId}`);
  }
  return entry;
}
