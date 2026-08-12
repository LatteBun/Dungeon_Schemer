import { describe, expect, it } from "vitest";
import { PERSONALITIES } from "@/lib/domain";
import type { ClassId, MemberId, PartyMember } from "@/lib/domain";
import { createRng } from "@/lib/rng";
import {
  evaluateTrust,
  TRUST_ACTIONS,
  TRUST_RULES,
} from "@/lib/rules/trust";

function member(
  personality: PartyMember["personality"],
  trust = 50,
): PartyMember {
  return {
    id: `member-${personality}` as MemberId,
    name: personality,
    classId: "test-class" as ClassId,
    personality,
    trust,
    alive: true,
  };
}

function trustRng(seed: string) {
  return createRng(seed).derive("trust");
}

describe("개인 신뢰 판정표", () => {
  it("행동 여덟과 모든 성격의 규칙이 빠짐없이 존재한다", () => {
    expect(TRUST_ACTIONS).toHaveLength(8);
    expect(Object.keys(TRUST_RULES).sort()).toEqual(
      [...PERSONALITIES].sort(),
    );
    for (const personality of PERSONALITIES) {
      expect(Object.keys(TRUST_RULES[personality]).sort()).toEqual(
        [...TRUST_ACTIONS].sort(),
      );
    }
  });

  it("같은 행동에서 성격에 따른 의미 있는 차이가 난다", () => {
    for (const action of TRUST_ACTIONS) {
      const deltas = PERSONALITIES.map(
        (personality) => TRUST_RULES[personality][action].baseDelta,
      );
      expect(new Set(deltas).size).toBeGreaterThan(1);
    }
  });

  it("모든 표준 사유가 비어 있지 않고 성격 이름을 포함한다", () => {
    const labels = {
      suspicious: "의심 많은 성격",
      righteous: "정의로운 성격",
      greedy: "탐욕스러운 성격",
      prudent: "신중한 성격",
      impulsive: "충동적 성격",
    } as const;

    for (const personality of PERSONALITIES) {
      for (const action of TRUST_ACTIONS) {
        const reason = TRUST_RULES[personality][action].reason;
        expect(reason.trim()).not.toBe("");
        expect(reason).toContain(labels[personality]);
      }
    }
  });
});

describe("개인 신뢰 판정 난수", () => {
  it("같은 시드와 같은 입력은 같은 결과를 만든다", () => {
    const target = member("righteous");
    expect(
      evaluateTrust(target, "actHonestly", trustRng("same")),
    ).toEqual(evaluateTrust(target, "actHonestly", trustRng("same")));
  });

  it("실제 변화가 기본값의 20% 변동 범위 안에 있다", () => {
    for (const personality of PERSONALITIES) {
      for (const action of TRUST_ACTIONS) {
        const base = TRUST_RULES[personality][action].baseDelta;
        const spread = base === 0 ? 0 : Math.max(1, Math.round(Math.abs(base) * 0.2));
        for (let index = 0; index < 30; index += 1) {
          const result = evaluateTrust(
            member(personality),
            action,
            trustRng(`range-${personality}-${action}-${index}`),
          );
          expect(result.change.delta).toBeGreaterThanOrEqual(base - spread);
          expect(result.change.delta).toBeLessThanOrEqual(base + spread);
          if (base > 0) expect(result.change.delta).toBeGreaterThan(0);
          if (base < 0) expect(result.change.delta).toBeLessThan(0);
        }
      }
    }
  });
});

describe("개인 신뢰 판정 경계", () => {
  it("100을 넘지 않고 실제 적용된 상승량을 기록한다", () => {
    const result = evaluateTrust(
      member("righteous", 99),
      "actHonestly",
      trustRng("upper-bound"),
    );
    expect(result.member.trust).toBe(100);
    expect(result.change.delta).toBe(1);
    expect(result.exposed).toBe(false);
  });

  it("0을 넘지 않고 실제 적용된 하락량과 발각을 기록한다", () => {
    const result = evaluateTrust(
      member("righteous", 2),
      "deceptionExposed",
      trustRng("lower-bound"),
    );
    expect(result.member.trust).toBe(0);
    expect(result.change.delta).toBe(-2);
    expect(result.exposed).toBe(true);
  });

  it("이미 0인 신뢰는 긍정 행동으로 회복되지 않는다", () => {
    const result = evaluateTrust(
      member("righteous", 0),
      "actHonestly",
      trustRng("already-exposed"),
    );
    expect(result.member.trust).toBe(0);
    expect(result.change.delta).toBe(0);
    expect(result.change.reason).toContain("이미 정체가 발각됨");
    expect(result.exposed).toBe(true);
  });

  it("기본값 0은 난수를 소비하지 않는다", () => {
    const used = trustRng("zero-does-not-consume");
    evaluateTrust(member("greedy"), "actHonestly", used);
    const afterZero = evaluateTrust(member("greedy"), "secureReward", used);

    const untouched = trustRng("zero-does-not-consume");
    const direct = evaluateTrust(
      member("greedy"),
      "secureReward",
      untouched,
    );
    expect(afterZero).toEqual(direct);
  });

  it("이미 0인 입력은 난수를 소비하지 않는다", () => {
    const used = trustRng("exposed-does-not-consume");
    evaluateTrust(member("righteous", 0), "actHonestly", used);
    const afterExposed = evaluateTrust(
      member("righteous"),
      "actHonestly",
      used,
    );

    const untouched = trustRng("exposed-does-not-consume");
    const direct = evaluateTrust(
      member("righteous"),
      "actHonestly",
      untouched,
    );
    expect(afterExposed).toEqual(direct);
  });

  it.each([-1, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "유효하지 않은 신뢰 %s는 RangeError를 던진다",
    (trust) => {
      expect(() =>
        evaluateTrust(
          member("prudent", trust),
          "avoidRisk",
          trustRng("invalid"),
        ),
      ).toThrow(RangeError);
    },
  );

  it("입력 파티원 객체를 변경하지 않는다", () => {
    const original = member("impulsive", 50);
    const snapshot = structuredClone(original);
    const result = evaluateTrust(
      original,
      "takeRisk",
      trustRng("immutable"),
    );
    expect(original).toEqual(snapshot);
    expect(result.member).not.toBe(original);
  });
});
