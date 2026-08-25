import { describe, expect, it } from "vitest";
import { CLASSES } from "@/lib/content/classes";
import {
  CHARACTER_POOL_SIZE,
  CHARACTERS_PER_CLASS,
  type CharacterId,
} from "@/lib/domain";
import {
  CHARACTER_ROSTER,
  PORTRAIT_VARIANTS,
  characterRosterEntryFor,
} from "./character-roster";

const EXPECTED_ROSTER = [
  ["character-warrior-a", "가론", "warrior", "a"],
  ["character-warrior-b", "라이문드", "warrior", "b"],
  ["character-warrior-c", "바스티안", "warrior", "c"],
  ["character-warrior-d", "하르멜", "warrior", "d"],
  ["character-warrior-e", "헬가", "warrior", "e"],
  ["character-warrior-f", "브릭스턴", "warrior", "f"],
  ["character-archer-a", "네리사", "archer", "a"],
  ["character-archer-b", "다이린", "archer", "b"],
  ["character-archer-c", "파에린", "archer", "c"],
  ["character-archer-d", "노엘라", "archer", "d"],
  ["character-archer-e", "실바나", "archer", "e"],
  ["character-archer-f", "카트린", "archer", "f"],
  ["character-cleric-a", "마요라", "cleric", "a"],
  ["character-cleric-b", "세라핀", "cleric", "b"],
  ["character-cleric-c", "이졸데", "cleric", "c"],
  ["character-cleric-d", "로자린드", "cleric", "d"],
  ["character-cleric-e", "제라딘", "cleric", "e"],
  ["character-cleric-f", "미라벨", "cleric", "f"],
  ["character-mage-a", "아드리크", "mage", "a"],
  ["character-mage-b", "타리엘", "mage", "b"],
  ["character-mage-c", "베로니크", "mage", "c"],
  ["character-mage-d", "사이러스", "mage", "d"],
  ["character-mage-e", "루시안", "mage", "e"],
  ["character-mage-f", "이반드로", "mage", "f"],
  ["character-rogue-a", "카심", "rogue", "a"],
  ["character-rogue-b", "델런", "rogue", "b"],
  ["character-rogue-c", "무렌", "rogue", "c"],
  ["character-rogue-d", "오린", "rogue", "d"],
  ["character-rogue-e", "코르빈", "rogue", "e"],
  ["character-rogue-f", "펠릭스", "rogue", "f"],
] as const;

describe("공식 캐릭터 로스터", () => {
  it("Spec의 30개 고정 ID·이름·직업·변형을 순서대로 가진다", () => {
    expect(CHARACTER_ROSTER.map((entry) => [
      entry.id,
      entry.name,
      entry.classId,
      entry.portraitVariant,
    ])).toEqual(EXPECTED_ROSTER);
  });

  it("전체 수와 이름·ID 고유성을 보장한다", () => {
    expect(CHARACTER_ROSTER).toHaveLength(CHARACTER_POOL_SIZE);
    expect(new Set(CHARACTER_ROSTER.map((entry) => entry.id)).size).toBe(CHARACTER_POOL_SIZE);
    expect(new Set(CHARACTER_ROSTER.map((entry) => entry.name)).size).toBe(CHARACTER_POOL_SIZE);
  });

  it("각 직업에 여섯 명과 A부터 F까지의 변형을 정확히 한 번씩 둔다", () => {
    for (const classDef of CLASSES) {
      const entries = CHARACTER_ROSTER.filter((entry) => entry.classId === classDef.id);
      expect(entries).toHaveLength(CHARACTERS_PER_CLASS);
      expect(entries.map((entry) => entry.portraitVariant).sort()).toEqual(PORTRAIT_VARIANTS);
    }
  });

  it("ID의 직업·변형 구성이 로스터 필드와 일치한다", () => {
    for (const entry of CHARACTER_ROSTER) {
      expect(entry.id).toBe(`character-${entry.classId}-${entry.portraitVariant}`);
    }
  });

  it("공식 ID로 항목을 조회하고 알 수 없는 ID는 명확하게 거절한다", () => {
    expect(characterRosterEntryFor("character-mage-f" as CharacterId)).toMatchObject({
      name: "이반드로",
      classId: "mage",
      portraitVariant: "f",
    });
    expect(() => characterRosterEntryFor("fixture-member" as CharacterId))
      .toThrow("공식 캐릭터 로스터에 없는 ID: fixture-member");
  });
});
