import { describe, expect, it } from "vitest";
import { CHARACTER_ROSTER } from "@/lib/content/character-roster";
import type { CharacterId } from "@/lib/domain";
import {
  portraitSrcForCharacterId,
  portraitVariantForCharacterId,
} from "./character-labels";

describe("character portrait resolver", () => {
  it("maps every official character ID to its live roster portrait", () => {
    for (const entry of CHARACTER_ROSTER) {
      expect(portraitVariantForCharacterId(entry.id)).toBe(entry.portraitVariant);
      expect(portraitSrcForCharacterId(entry.id)).toBe(
        `/assets/characters/live/${entry.classId}/${entry.classId}_${entry.portraitVariant}.png`,
      );
    }
  });

  it("rejects an ID outside the official roster", () => {
    expect(() => portraitSrcForCharacterId("character-warrior-z" as CharacterId)).toThrow(
      /공식 캐릭터 로스터/,
    );
  });
});
