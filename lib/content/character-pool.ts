import { CLASSES } from "@/lib/content/classes";
import { CHARACTER_NAMES } from "@/lib/content/character-names";
import type { Rng } from "@/lib/rng";
import {
  CHARACTER_POOL_SIZE,
  CHARACTERS_PER_CLASS,
  CHARACTERS_PER_PERSONALITY,
  PERSONALITIES,
  TRUST_MAX,
  TRUST_MIN,
} from "@/lib/domain";
import type { Character, CharacterId, CharacterPool, Personality } from "@/lib/domain";

/**
 * 성격별 초기 신뢰 기본값. 시드로 -5~+5를 더하고 0~100으로 자른다.
 * docs/systems/CHARACTERS_AND_TRUST.md
 */
const TRUST_BASE_BY_PERSONALITY: Readonly<Record<Personality, number>> = {
  suspicious: 35,
  prudent: 45,
  greedy: 50,
  righteous: 55,
  impulsive: 60,
};

const TRUST_SEED_SPREAD = 5;
const GOLD_MIN = 20;
const GOLD_MAX = 45;

/**
 * 캠페인 시작 캐릭터 풀 30명을 생성한다.
 *
 * 5직업 × 6명, 5성격 × 6명을 각각 섞어서 짝짓기 때문에 직업과 성격의 조합은
 * 시드마다 달라지지만 두 축의 인원수는 항상 고정이다. 이름은 후보 목록에서
 * 중복 없이 뽑는다.
 * docs/systems/CHARACTER_POOL_AND_WORLDTURN.md
 */
export function generateCharacterPool(rng: Rng): CharacterPool {
  const pool = rng.derive("pool");

  const classSlots = CLASSES.flatMap((classDef) =>
    Array.from({ length: CHARACTERS_PER_CLASS }, () => classDef),
  );
  const personalitySlots = PERSONALITIES.flatMap((personality) =>
    Array.from({ length: CHARACTERS_PER_PERSONALITY }, () => personality),
  );

  const shuffledClasses = pool.shuffle(classSlots);
  const shuffledPersonalities = pool.shuffle(personalitySlots);
  const shuffledNames = pool.shuffle(CHARACTER_NAMES).slice(0, CHARACTER_POOL_SIZE);

  const byId: Record<CharacterId, Character> = {};
  const order: CharacterId[] = [];

  for (let index = 0; index < CHARACTER_POOL_SIZE; index += 1) {
    const classDef = shuffledClasses[index];
    const personality = shuffledPersonalities[index];
    const id = `character-${String(index + 1).padStart(3, "0")}` as CharacterId;

    const trustSpread = pool.int(-TRUST_SEED_SPREAD, TRUST_SEED_SPREAD);
    const trust = Math.min(
      TRUST_MAX,
      Math.max(TRUST_MIN, TRUST_BASE_BY_PERSONALITY[personality] + trustSpread),
    );
    const gold = pool.int(GOLD_MIN, GOLD_MAX);

    const character: Character = {
      id,
      name: shuffledNames[index],
      classId: classDef.id,
      personality,
      maxHp: classDef.maxHp,
      hp: classDef.maxHp,
      trust,
      gold,
      alive: true,
      gravelyWounded: false,
    };

    byId[id] = character;
    order.push(id);
  }

  return { byId, order };
}
