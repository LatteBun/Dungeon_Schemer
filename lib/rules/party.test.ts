import { describe, expect, it } from "vitest";
import { CLASSES } from "@/lib/content/classes";
import {
  CAMPAIGN_PARTY_SIZE,
  PARTY_SIZE_MAX,
  PARTY_SIZE_MIN,
  TRUST_MAX,
  TRUST_MIN,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import {
  generateMemberProfile,
  generateParty,
  INITIAL_TRUST_BASE,
  INITIAL_TRUST_JITTER,
} from "@/lib/rules/party";

const SEEDS = ["seed-a", "seed-b", "seed-c", "던전-1", "던전-2"];

function partyOf(seed: string) {
  return generateParty(createRng(seed).derive("party"));
}

describe("파티 생성 규칙", () => {
  it("size 옵션으로 3인 파티를 고정 생성한다", () => {
    const party = generateParty(createRng("campaign-party").derive("party"), {
      size: CAMPAIGN_PARTY_SIZE,
    });

    expect(party).toHaveLength(3);
    expect(new Set(party.map((member) => member.classId)).size).toBe(3);
    expect(new Set(party.map((member) => member.personality)).size).toBe(3);
  });

  it("예비 인원용 단일 프로필도 같은 신뢰 계약을 사용한다", () => {
    const profile = generateMemberProfile(createRng("reserve-profile"));

    expect(profile.name).not.toBe("");
    expect(profile.trust).toBeGreaterThanOrEqual(TRUST_MIN);
    expect(profile.trust).toBeLessThanOrEqual(TRUST_MAX);
  });

  it("size가 파티 범위를 벗어나면 거부한다", () => {
    expect(() =>
      generateParty(createRng("invalid-party"), { size: 2 }),
    ).toThrow(/파티 인원/);
  });

  it("같은 시드는 같은 파티를 재현한다", () => {
    for (const seed of SEEDS) {
      expect(partyOf(seed)).toEqual(partyOf(seed));
    }
  });

  it("다른 시드는 다른 파티를 만든다", () => {
    expect(partyOf("seed-a")).not.toEqual(partyOf("seed-b"));
    expect(partyOf("seed-b")).not.toEqual(partyOf("seed-c"));
  });

  it("인원은 항상 3~5명이다", () => {
    for (let i = 0; i < 50; i += 1) {
      const party = partyOf(`size-check-${i}`);
      expect(party.length).toBeGreaterThanOrEqual(PARTY_SIZE_MIN);
      expect(party.length).toBeLessThanOrEqual(PARTY_SIZE_MAX);
    }
  });

  it("직업·성격·이름은 한 파티 안에서 중복되지 않는다", () => {
    for (const seed of SEEDS) {
      const party = partyOf(seed);
      const classIds = party.map((m) => m.classId);
      const personalities = party.map((m) => m.personality);
      const names = party.map((m) => m.name);
      expect(new Set(classIds).size).toBe(party.length);
      expect(new Set(personalities).size).toBe(party.length);
      expect(new Set(names).size).toBe(party.length);
    }
  });

  it("초기 신뢰는 성격별 기본값 ± 랜덤 폭 안이고 신뢰 척도 안이다", () => {
    for (const seed of SEEDS) {
      for (const member of partyOf(seed)) {
        const base = INITIAL_TRUST_BASE[member.personality];
        expect(member.trust).toBeGreaterThanOrEqual(base - INITIAL_TRUST_JITTER);
        expect(member.trust).toBeLessThanOrEqual(base + INITIAL_TRUST_JITTER);
        expect(member.trust).toBeGreaterThanOrEqual(TRUST_MIN);
        expect(member.trust).toBeLessThanOrEqual(TRUST_MAX);
      }
    }
  });

  it("모든 파티원은 살아 있는 상태로 시작한다", () => {
    for (const member of partyOf("seed-a")) {
      expect(member.alive).toBe(true);
    }
  });

  it("직업 풀이 인원보다 작으면 오류를 던진다", () => {
    const rng = createRng("pool-too-small").derive("party");
    expect(() =>
      generateParty(rng, { classes: CLASSES.slice(0, 2) }),
    ).toThrow(/직업 풀/);
  });
});
