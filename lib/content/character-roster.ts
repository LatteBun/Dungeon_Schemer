import { CLASSES } from "@/lib/content/classes";
import {
  CHARACTER_POOL_SIZE,
  CHARACTERS_PER_CLASS,
  type CharacterId,
  type ClassId,
} from "@/lib/domain";

export const PORTRAIT_VARIANTS = ["a", "b", "c", "d", "e", "f"] as const;

export type PortraitVariant = (typeof PORTRAIT_VARIANTS)[number];

export interface CharacterRosterEntry {
  readonly id: CharacterId;
  readonly name: string;
  readonly classId: ClassId;
  readonly portraitVariant: PortraitVariant;
}

export const CHARACTER_ROSTER = [
  { id: "character-warrior-a" as CharacterId, name: "가론", classId: "warrior" as ClassId, portraitVariant: "a" },
  { id: "character-warrior-b" as CharacterId, name: "라이문드", classId: "warrior" as ClassId, portraitVariant: "b" },
  { id: "character-warrior-c" as CharacterId, name: "바스티안", classId: "warrior" as ClassId, portraitVariant: "c" },
  { id: "character-warrior-d" as CharacterId, name: "하르멜", classId: "warrior" as ClassId, portraitVariant: "d" },
  { id: "character-warrior-e" as CharacterId, name: "헬가", classId: "warrior" as ClassId, portraitVariant: "e" },
  { id: "character-warrior-f" as CharacterId, name: "브릭스턴", classId: "warrior" as ClassId, portraitVariant: "f" },
  { id: "character-archer-a" as CharacterId, name: "네리사", classId: "archer" as ClassId, portraitVariant: "a" },
  { id: "character-archer-b" as CharacterId, name: "다이린", classId: "archer" as ClassId, portraitVariant: "b" },
  { id: "character-archer-c" as CharacterId, name: "파에린", classId: "archer" as ClassId, portraitVariant: "c" },
  { id: "character-archer-d" as CharacterId, name: "노엘라", classId: "archer" as ClassId, portraitVariant: "d" },
  { id: "character-archer-e" as CharacterId, name: "실바나", classId: "archer" as ClassId, portraitVariant: "e" },
  { id: "character-archer-f" as CharacterId, name: "카트린", classId: "archer" as ClassId, portraitVariant: "f" },
  { id: "character-cleric-a" as CharacterId, name: "마요라", classId: "cleric" as ClassId, portraitVariant: "a" },
  { id: "character-cleric-b" as CharacterId, name: "세라핀", classId: "cleric" as ClassId, portraitVariant: "b" },
  { id: "character-cleric-c" as CharacterId, name: "이졸데", classId: "cleric" as ClassId, portraitVariant: "c" },
  { id: "character-cleric-d" as CharacterId, name: "로자린드", classId: "cleric" as ClassId, portraitVariant: "d" },
  { id: "character-cleric-e" as CharacterId, name: "제라딘", classId: "cleric" as ClassId, portraitVariant: "e" },
  { id: "character-cleric-f" as CharacterId, name: "미라벨", classId: "cleric" as ClassId, portraitVariant: "f" },
  { id: "character-mage-a" as CharacterId, name: "아드리크", classId: "mage" as ClassId, portraitVariant: "a" },
  { id: "character-mage-b" as CharacterId, name: "타리엘", classId: "mage" as ClassId, portraitVariant: "b" },
  { id: "character-mage-c" as CharacterId, name: "베로니크", classId: "mage" as ClassId, portraitVariant: "c" },
  { id: "character-mage-d" as CharacterId, name: "사이러스", classId: "mage" as ClassId, portraitVariant: "d" },
  { id: "character-mage-e" as CharacterId, name: "루시안", classId: "mage" as ClassId, portraitVariant: "e" },
  { id: "character-mage-f" as CharacterId, name: "이반드로", classId: "mage" as ClassId, portraitVariant: "f" },
  { id: "character-rogue-a" as CharacterId, name: "카심", classId: "rogue" as ClassId, portraitVariant: "a" },
  { id: "character-rogue-b" as CharacterId, name: "델런", classId: "rogue" as ClassId, portraitVariant: "b" },
  { id: "character-rogue-c" as CharacterId, name: "무렌", classId: "rogue" as ClassId, portraitVariant: "c" },
  { id: "character-rogue-d" as CharacterId, name: "오린", classId: "rogue" as ClassId, portraitVariant: "d" },
  { id: "character-rogue-e" as CharacterId, name: "코르빈", classId: "rogue" as ClassId, portraitVariant: "e" },
  { id: "character-rogue-f" as CharacterId, name: "펠릭스", classId: "rogue" as ClassId, portraitVariant: "f" },
] as const satisfies readonly CharacterRosterEntry[];

function assertRoster(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`공식 캐릭터 로스터 불변식 위반: ${message}`);
}

function createRosterById(): ReadonlyMap<CharacterId, CharacterRosterEntry> {
  assertRoster(CHARACTER_ROSTER.length === CHARACTER_POOL_SIZE, `수는 ${CHARACTER_POOL_SIZE}명이어야 한다`);

  const ids = new Set<CharacterId>();
  const names = new Set<string>();
  const byId = new Map<CharacterId, CharacterRosterEntry>();

  for (const entry of CHARACTER_ROSTER) {
    assertRoster(!ids.has(entry.id), `ID가 중복되었다: ${entry.id}`);
    assertRoster(!names.has(entry.name), `이름이 중복되었다: ${entry.name}`);
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
