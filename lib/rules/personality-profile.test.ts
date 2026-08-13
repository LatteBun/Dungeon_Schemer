import { describe, expect, it } from "vitest";
import { PERSONALITIES } from "@/lib/domain";
import type { Personality } from "@/lib/domain";
import { TRUST_ACTIONS, TRUST_RULES } from "@/lib/rules/trust";
import type { TrustAction } from "@/lib/rules/trust";
import {
  describePersonality,
  PERSONALITY_PROFILES,
  strengthOf,
  TRUST_ACTION_LABELS,
} from "@/lib/rules/personality-profile";

function find(personality: Personality, action: TrustAction) {
  const profile = describePersonality(personality);
  return [...profile.likes, ...profile.guards].find(
    (reaction) => reaction.action === action,
  );
}

function magnitudes(personality: Personality, actions: TrustAction[]) {
  return actions.map((action) =>
    Math.abs(TRUST_RULES[personality][action].baseDelta),
  );
}

describe("성격 프로필 강도 구간", () => {
  it("상위 경계 10과 중간 경계 6을 포함해서 판정한다", () => {
    // 신중함 기만 적발 -10 → 최고 단계
    expect(find("prudent", "deceptionExposed")?.strength).toBe(3);
    // 신중함 본인 이익 박탈 -7 → 중간 단계
    expect(find("prudent", "denyReward")?.strength).toBe(2);
    // 정의로움 본인 이익 박탈 -6 → 경계값 포함이므로 중간 단계
    expect(find("righteous", "denyReward")?.strength).toBe(2);
    // 의심 많음 본인 이익 박탈 -5 → 최소 단계
    expect(find("suspicious", "denyReward")?.strength).toBe(1);
  });

  it("strengthOf가 데이터와 무관하게 경계값을 직접 판정한다", () => {
    // 상위 경계(10) 포함 → 3단계. 양수와 음수 둘 다.
    expect(strengthOf(10)).toBe(3);
    expect(strengthOf(-10)).toBe(3);
    // 상위 경계 바로 아래(9) → 2단계.
    expect(strengthOf(9)).toBe(2);
    expect(strengthOf(-9)).toBe(2);
    // 중간 경계(6) 포함 → 2단계.
    expect(strengthOf(6)).toBe(2);
    expect(strengthOf(-6)).toBe(2);
    // 중간 경계 바로 아래(5) → 1단계.
    expect(strengthOf(5)).toBe(1);
    expect(strengthOf(-5)).toBe(1);
    // 상위 경계를 크게 넘는 값도 3단계에 머문다.
    expect(strengthOf(16)).toBe(3);
  });

  it("충동적 파티원의 경계 행동이 한 단계로 뭉치지 않는다", () => {
    // -10 -10 -8 -7 이므로 상위 경계가 12면 넷이 전부 같은 단계가 된다.
    const strengths = describePersonality("impulsive").guards.map(
      (reaction) => reaction.strength,
    );
    expect(new Set(strengths).size).toBeGreaterThan(1);
  });

  it("의심 많음은 최고 단계 호감 반응을 갖지 않는다", () => {
    // 최고가 +8이다. PARTY_AND_TRUST.md의 "높은 신뢰에 도달하기 어렵다"와 맞다.
    const likes = describePersonality("suspicious").likes;
    expect(likes.length).toBeGreaterThan(0);
    expect(likes.every((reaction) => reaction.strength < 3)).toBe(true);
  });
});

describe("성격 프로필 구성", () => {
  it("반응하지 않는 행동은 어느 쪽에도 넣지 않는다", () => {
    const greedy = describePersonality("greedy");
    const actions = [...greedy.likes, ...greedy.guards].map(
      (reaction) => reaction.action,
    );
    expect(actions).not.toContain("actHonestly");
    expect(actions).not.toContain("protectAlly");
    expect(actions).not.toContain("avoidRisk");
    expect(actions).toHaveLength(5);
  });

  it("모든 성격에서 기본 변화량 0인 행동만 빠진다", () => {
    for (const personality of PERSONALITIES) {
      const profile = describePersonality(personality);
      const shown = [...profile.likes, ...profile.guards];
      for (const reaction of shown) {
        expect(TRUST_RULES[personality][reaction.action].baseDelta).not.toBe(0);
      }
      const expected = TRUST_ACTIONS.filter(
        (action) => TRUST_RULES[personality][action].baseDelta !== 0,
      ).length;
      expect(shown).toHaveLength(expected);
    }
  });

  it("좋아함은 양수만, 경계함은 음수만 담는다", () => {
    for (const personality of PERSONALITIES) {
      const profile = describePersonality(personality);
      for (const reaction of profile.likes) {
        expect(
          TRUST_RULES[personality][reaction.action].baseDelta,
        ).toBeGreaterThan(0);
      }
      for (const reaction of profile.guards) {
        expect(
          TRUST_RULES[personality][reaction.action].baseDelta,
        ).toBeLessThan(0);
      }
    }
  });

  it("모든 성격이 좋아하는 행동과 경계하는 행동을 모두 가진다", () => {
    for (const personality of PERSONALITIES) {
      const profile = PERSONALITY_PROFILES[personality];
      expect(profile.likes.length).toBeGreaterThan(0);
      expect(profile.guards.length).toBeGreaterThan(0);
      for (const reaction of [...profile.likes, ...profile.guards]) {
        expect(reaction.label.trim()).not.toBe("");
      }
    }
  });
});

describe("성격 프로필 정렬", () => {
  it("강한 반응이 먼저 온다", () => {
    for (const personality of PERSONALITIES) {
      const profile = describePersonality(personality);
      for (const list of [profile.likes, profile.guards]) {
        const sizes = magnitudes(
          personality,
          list.map((reaction) => reaction.action),
        );
        expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
      }
    }
  });

  it("같은 크기의 반응은 TRUST_ACTIONS 순서를 따른다", () => {
    // 의심 많음의 동료 보호와 본인 이익 확보가 둘 다 +3이다.
    const likes = describePersonality("suspicious").likes.map(
      (reaction) => reaction.action,
    );
    expect(likes.indexOf("protectAlly")).toBeLessThan(
      likes.indexOf("secureReward"),
    );
  });

  it("같은 성격을 두 번 물어도 같은 순서를 낸다", () => {
    for (const personality of PERSONALITIES) {
      expect(describePersonality(personality)).toEqual(
        describePersonality(personality),
      );
    }
  });
});

describe("성격 프로필 공개 계약", () => {
  it("모든 공통 행동에 한국어 이름이 있다", () => {
    expect(Object.keys(TRUST_ACTION_LABELS).sort()).toEqual(
      [...TRUST_ACTIONS].sort(),
    );
    for (const action of TRUST_ACTIONS) {
      expect(TRUST_ACTION_LABELS[action].trim()).not.toBe("");
    }
  });

  it("탐욕스러움과 정의로움의 프로필이 실제로 다르다", () => {
    expect(describePersonality("greedy")).not.toEqual(
      describePersonality("righteous"),
    );
    expect(describePersonality("greedy").likes[0]?.action).toBe(
      "secureReward",
    );
    expect(describePersonality("righteous").likes[0]?.action).toBe(
      "actHonestly",
    );
  });

  it("PERSONALITY_PROFILES가 모든 성격을 담는다", () => {
    expect(Object.keys(PERSONALITY_PROFILES).sort()).toEqual(
      [...PERSONALITIES].sort(),
    );
    for (const personality of PERSONALITIES) {
      expect(PERSONALITY_PROFILES[personality]).toEqual(
        describePersonality(personality),
      );
    }
  });
});
