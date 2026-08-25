import { CLASSES } from "@/lib/content/classes";
import {
  characterRosterEntryFor,
  type PortraitVariant,
} from "@/lib/content/character-roster";
import type { CharacterId, ClassId, Personality } from "@/lib/domain";

/**
 * 캐릭터 표시 — 이름과 초상.
 *
 * 화면마다 같은 표를 복사하면 한쪽만 고쳐진다. 실제로 U3 는 한글로 보여주는데
 * U5 는 classId·personality 원값이 그대로 나왔고, 초상은 U4 만 갖고 있어
 * U3·U5 는 빈 자리가 나왔다. 한 곳에 둔다.
 */

export const PERSONALITY_LABEL: Readonly<Record<Personality, string>> = {
  suspicious: "의심 많은",
  righteous: "정의로운",
  greedy: "탐욕적인",
  prudent: "신중한",
  impulsive: "충동적인",
};

const CLASS_NAME_BY_ID = new Map(CLASSES.map((one) => [one.id, one.name]));

/** 콘텐츠에 없는 직업이면 식별자를 그대로 돌려준다. 화면이 비지 않게 한다. */
export function classLabel(classId: ClassId): string {
  return CLASS_NAME_BY_ID.get(classId) ?? String(classId);
}

/**
 * 공식 로스터가 CharacterId의 초상화 variant를 소유한다.
 */
export function portraitVariantForCharacterId(characterId: CharacterId): PortraitVariant {
  return characterRosterEntryFor(characterId).portraitVariant;
}

/** 살아 있으면 live, 죽었으면 dead 폴더를 쓴다. */
export function portraitSrcForCharacterId(characterId: CharacterId): string {
  const entry = characterRosterEntryFor(characterId);
  return `/assets/characters/live/${entry.classId}/${entry.classId}_${entry.portraitVariant}.png`;
}
