import { CLASSES } from "@/lib/content/classes";
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
 * 초상 변형. 직업마다 여섯 장이 있다.
 *
 * 처음에는 두 장뿐이라 서른 명 풀에서 같은 얼굴이 열다섯 번씩 나왔다. 한 파티
 * 안에 같은 직업이 둘이면 같은 그림이 나란히 서는 일도 흔했다. 네 장을 더해
 * 여섯으로 넓힌다.
 */
export const PORTRAIT_VARIANTS = ["a", "b", "c", "d", "e", "f"] as const;

export type PortraitVariant = (typeof PORTRAIT_VARIANTS)[number];

/**
 * CharacterId 문자열만으로 변형을 정한다. 렌더 시점이나 생사 상태와 무관하게
 * 같은 캐릭터는 늘 같은 변형을 쓴다.
 */
export function portraitVariantForCharacterId(characterId: CharacterId): PortraitVariant {
  let hash = 2166136261;
  for (let index = 0; index < characterId.length; index += 1) {
    hash ^= characterId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return PORTRAIT_VARIANTS[(hash >>> 0) % PORTRAIT_VARIANTS.length]!;
}

/** 살아 있으면 live, 죽었으면 dead 폴더를 쓴다. */
export function portraitSrcForCharacter(input: {
  id: CharacterId;
  classId: ClassId;
  alive: boolean;
}): string {
  const variant = portraitVariantForCharacterId(input.id);
  const lifeFolder = input.alive ? "live" : "dead";
  return `/assets/characters/${lifeFolder}/${input.classId}/${input.classId}_${variant}.png`;
}
