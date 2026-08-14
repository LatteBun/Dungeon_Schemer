import { CLASSES } from "@/lib/content/classes";
import { MEMBER_NAMES } from "@/lib/content/names";
import {
  PARTY_SIZE_MAX,
  PARTY_SIZE_MIN,
  PERSONALITIES,
  TRUST_MAX,
  TRUST_MIN,
} from "@/lib/domain";
import type { ClassDef, MemberId, PartyMember, Personality } from "@/lib/domain";
import type { Rng } from "@/lib/rng";

/**
 * 성격별 초기 신뢰 기본값. 프로토타입 잠정값이다.
 * 의심 많음은 높은 신뢰에 도달하기 어렵다는 방향을 시작값에 반영하고,
 * 충동적은 쉽게 믿는 성격으로 두어 대비를 만든다.
 * docs/superpowers/specs/2026-08-12-sbh3821-party-generation-design.md
 */
export const INITIAL_TRUST_BASE: Readonly<Record<Personality, number>> = {
  suspicious: 35,
  prudent: 45,
  greedy: 50,
  righteous: 55,
  impulsive: 60,
};

/** 초기 신뢰에 더하는 랜덤 폭. 기본값 ± 이 값 안에서 정해진다. */
export const INITIAL_TRUST_JITTER = 5;

export interface GeneratePartyOptions {
  /** 직업 풀. 기본값은 콘텐츠 데이터의 CLASSES. */
  classes?: readonly ClassDef[];
  /** 이름 풀. 기본값은 콘텐츠 데이터의 MEMBER_NAMES. */
  names?: readonly string[];
  /** 고정 인원. 생략하면 기존처럼 3~5명을 시드로 선택한다. */
  size?: number;
}

export interface MemberProfile {
  name: string;
  classId: ClassDef["id"];
  personality: Personality;
  trust: number;
}

export function generateMemberProfile(
  rng: Rng,
  options: GeneratePartyOptions = {},
): MemberProfile {
  const classPool = options.classes ?? CLASSES;
  const namePool = options.names ?? MEMBER_NAMES;
  const classDef = rng.pick(classPool);
  const personality = rng.pick(PERSONALITIES);
  const name = rng.pick(namePool);
  const base = INITIAL_TRUST_BASE[personality];

  return {
    classId: classDef.id,
    name,
    personality,
    trust: clampTrust(base + rng.int(-INITIAL_TRUST_JITTER, INITIAL_TRUST_JITTER)),
  };
}

function clampTrust(value: number): number {
  return Math.min(TRUST_MAX, Math.max(TRUST_MIN, value));
}

/**
 * 시드로 3~5명 파티를 만든다. 같은 시드는 같은 파티를 재현한다.
 *
 * - 직업·성격·이름은 한 파티 안에서 중복되지 않는다.
 * - 초기 신뢰는 성격별 기본값 ± INITIAL_TRUST_JITTER.
 * - 재현성 규약에 따라 Rng를 인자로 받는다.
 *
 * 호출 예: `generateParty(createRng(seed).derive("party"))`
 */
export function generateParty(
  rng: Rng,
  options: GeneratePartyOptions = {},
): PartyMember[] {
  const classPool = options.classes ?? CLASSES;
  const namePool = options.names ?? MEMBER_NAMES;

  const size = options.size ?? rng.int(PARTY_SIZE_MIN, PARTY_SIZE_MAX);
  if (!Number.isInteger(size) || size < PARTY_SIZE_MIN || size > PARTY_SIZE_MAX) {
    throw new Error(`파티 인원은 ${PARTY_SIZE_MIN}~${PARTY_SIZE_MAX}명이어야 한다: ${size}`);
  }

  if (classPool.length < size) {
    throw new Error(
      `직업 풀(${classPool.length})이 파티 인원(${size})보다 작다. 중복 불허 규칙을 지킬 수 없다.`,
    );
  }
  if (namePool.length < size) {
    throw new Error(
      `이름 풀(${namePool.length})이 파티 인원(${size})보다 작다. 중복 불허 규칙을 지킬 수 없다.`,
    );
  }

  const classes = rng.shuffle(classPool).slice(0, size);
  const personalities = rng.shuffle(PERSONALITIES).slice(0, size);
  const names = rng.shuffle(namePool).slice(0, size);

  return classes.map((classDef, index) => {
    const personality = personalities[index];
    const base = INITIAL_TRUST_BASE[personality];
    const jitter = rng.int(-INITIAL_TRUST_JITTER, INITIAL_TRUST_JITTER);

    return {
      id: `member-${index + 1}` as MemberId,
      name: names[index],
      classId: classDef.id,
      personality,
      trust: clampTrust(base + jitter),
      alive: true,
    };
  });
}
