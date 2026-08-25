import { describe, expect, it } from "vitest";
import { CLASSES } from "@/lib/content/classes";
import {
  CHARACTER_POOL_SIZE,
  CHARACTERS_PER_CLASS,
  type CharacterId,
} from "@/lib/domain";
import {
  CHARACTER_GENDERS,
  CHARACTER_ROSTER,
  PORTRAIT_VARIANTS,
  characterRosterEntryFor,
} from "./character-roster";

const EXPECTED_ROSTER = [
  ["character-warrior-a", "발드릭", "male", "warrior", "a"],
  ["character-warrior-b", "브리엘라", "female", "warrior", "b"],
  ["character-warrior-c", "로데릭", "male", "warrior", "c"],
  ["character-warrior-d", "마르셀라", "female", "warrior", "d"],
  ["character-warrior-e", "토르벤", "male", "warrior", "e"],
  ["character-warrior-f", "이솔라", "female", "warrior", "f"],
  ["character-archer-a", "엘리시아", "female", "archer", "a"],
  ["character-archer-b", "알렌", "male", "archer", "b"],
  ["character-archer-c", "카엘", "male", "archer", "c"],
  ["character-archer-d", "레오니스", "male", "archer", "d"],
  ["character-archer-e", "리비아", "female", "archer", "e"],
  ["character-archer-f", "아델린", "female", "archer", "f"],
  ["character-cleric-a", "세드릭", "male", "cleric", "a"],
  ["character-cleric-b", "세실리아", "female", "cleric", "b"],
  ["character-cleric-c", "루시엔", "male", "cleric", "c"],
  ["character-cleric-d", "로레나", "female", "cleric", "d"],
  ["character-cleric-e", "아멜리아", "female", "cleric", "e"],
  ["character-cleric-f", "에드윈", "male", "cleric", "f"],
  ["character-mage-a", "발테르", "male", "mage", "a"],
  ["character-mage-b", "비비안", "female", "mage", "b"],
  ["character-mage-c", "오스카르", "male", "mage", "c"],
  ["character-mage-d", "셀레네", "female", "mage", "d"],
  ["character-mage-e", "에리온", "male", "mage", "e"],
  ["character-mage-f", "헨서라", "female", "mage", "f"],
  ["character-rogue-a", "라울", "male", "rogue", "a"],
  ["character-rogue-b", "카밀라", "female", "rogue", "b"],
  ["character-rogue-c", "다미안", "male", "rogue", "c"],
  ["character-rogue-d", "니콜라스", "male", "rogue", "d"],
  ["character-rogue-e", "베로니카", "female", "rogue", "e"],
  ["character-rogue-f", "이네스", "female", "rogue", "f"],
] as const;

describe("공식 캐릭터 로스터", () => {
  it("Spec의 30개 고정 ID·이름·성별·직업·변형을 순서대로 가진다", () => {
    expect(CHARACTER_ROSTER.map((entry) => [
      entry.id,
      entry.name,
      entry.gender,
      entry.classId,
      entry.portraitVariant,
    ])).toEqual(EXPECTED_ROSTER);
  });

  it("지원 성별을 각각 15명씩 가진다", () => {
    expect(CHARACTER_GENDERS).toEqual(["male", "female"]);
    expect(CHARACTER_ROSTER.filter((entry) => entry.gender === "male")).toHaveLength(15);
    expect(CHARACTER_ROSTER.filter((entry) => entry.gender === "female")).toHaveLength(15);
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
      name: "헨서라",
      gender: "female",
      classId: "mage",
      portraitVariant: "f",
    });
    expect(() => characterRosterEntryFor("fixture-member" as CharacterId))
      .toThrow("공식 캐릭터 로스터에 없는 ID: fixture-member");
  });
});
