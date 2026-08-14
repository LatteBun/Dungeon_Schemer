import { describe, expect, it } from "vitest";
import type {
  CardId,
  ClassId,
  InfoCard,
  MemberId,
  PartyMember,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import type { Rng } from "@/lib/rng";
import { TRUST_RULES } from "@/lib/rules/trust";
import {
  evaluateInfoCard,
  type InfoCardEvaluation,
} from "@/lib/rules/info";

function scriptedRng(...values: number[]): Rng {
  let index = 0;
  const rng: Rng = {
    seed: "scripted",
    float: () => {
      throw new Error("이 테스트는 float를 사용하지 않는다.");
    },
    int: (min, max) => {
      const value = values[index++];
      if (value === undefined || value < min || value > max) {
        throw new Error(
          "허용 범위 " + min + "~" + max + " 밖의 scriptedRng 값: " + value,
        );
      }
      return value;
    },
    pick: <T>(items: readonly T[]) => items[0] as T,
    shuffle: <T>(items: readonly T[]) => [...items],
    derive: () => rng,
  };
  return rng;
}

function member(
  personality: PartyMember["personality"],
  trust = 50,
  alive = true,
): PartyMember {
  return {
    id: "member-" + personality + "-" + trust as MemberId,
    name: personality,
    classId: "test-class" as ClassId,
    personality,
    trust,
    alive,
  };
}

function card(truthType: InfoCard["truthType"]): InfoCard {
  return {
    id: "card-" + truthType as CardId,
    truthType,
    subject: "event",
    topic: "테스트 정보",
    text: truthType + " 카드",
  };
}

function partyResult(result: InfoCardEvaluation) {
  if (result.audience !== "party") {
    throw new Error("파티 결과가 필요하다.");
  }
  return result;
}

describe("정보 카드 반응", () => {
  it("보스는 세 카드 유형의 기본 반응과 플래그를 반환한다", () => {
    const cases = [
      ["truth", 1, "accepted", false, false],
      ["truth", 71, "suspected", false, true],
      ["neutral", 1, "accepted", false, false],
      ["neutral", 56, "suspected", false, true],
      ["lie", 1, "exposed", false, false],
      ["lie", 16, "accepted", true, false],
      ["lie", 61, "suspected", false, true],
    ] as const;

    for (const [
      truthType,
      roll,
      reaction,
      pendingVerification,
      pendingSuspicionEvaluation,
    ] of cases) {
      expect(
        evaluateInfoCard({
          audience: "boss",
          card: card(truthType),
          cardRng: scriptedRng(roll),
        }),
      ).toEqual({
        audience: "boss",
        reaction,
        pendingVerification,
        pendingSuspicionEvaluation,
      });
    }
  });

  it("파티원마다 같은 카드에 다른 반응과 즉시 신뢰 판정 결과를 낸다", () => {
    const party = [
      member("righteous"),
      member("greedy"),
      member("prudent"),
    ];

    const truth = partyResult(
      evaluateInfoCard({
        audience: "party",
        card: card("truth"),
        party,
        cardRng: scriptedRng(1, 100, 100),
        trustRng: scriptedRng(0),
      }),
    );
    expect(truth.memberResults.map((result) => result.reaction)).toEqual([
      "accepted",
      "suspected",
      "suspected",
    ]);
    expect(truth.memberResults[0].trustEvaluation?.change.reason).toBe(
      TRUST_RULES.righteous.actHonestly.reason,
    );

    const neutral = partyResult(
      evaluateInfoCard({
        audience: "party",
        card: card("neutral"),
        party,
        cardRng: scriptedRng(1, 100, 100),
        trustRng: scriptedRng(),
      }),
    );
    expect(neutral.memberResults[0].trustEvaluation).toBeNull();

    const lie = partyResult(
      evaluateInfoCard({
        audience: "party",
        card: card("lie"),
        party,
        cardRng: scriptedRng(31, 1, 100),
        trustRng: scriptedRng(0, 0),
      }),
    );
    expect(lie.memberResults.map((result) => result.reaction)).toEqual([
      "accepted",
      "exposed",
      "suspected",
    ]);
    expect(lie.memberResults[0].trustEvaluation?.change.reason).toBe(
      TRUST_RULES.righteous.deceptionAccepted.reason,
    );
    expect(lie.memberResults[1].trustEvaluation?.change.reason).toBe(
      TRUST_RULES.greedy.deceptionExposed.reason,
    );
    expect(lie.memberResults[2].trustEvaluation).toBeNull();
  });

  it("거짓 카드의 수용·의심·적발 플래그를 파티원별로 만든다", () => {
    const result = partyResult(
      evaluateInfoCard({
        audience: "party",
        card: card("lie"),
        party: [
          member("suspicious", 0),
          member("impulsive", 100),
          member("greedy"),
        ],
        cardRng: scriptedRng(1, 30, 100),
        trustRng: scriptedRng(0, 0),
      }),
    );

    expect(result.memberResults.map((entry) => entry.reaction)).toEqual([
      "exposed",
      "accepted",
      "suspected",
    ]);
    expect(result.memberResults.map((entry) => entry.pendingVerification)).toEqual([
      false,
      true,
      false,
    ]);
    expect(
      result.memberResults.map((entry) => entry.pendingSuspicionEvaluation),
    ).toEqual([false, false, true]);
  });

  it("확률 하한·상한과 거짓의 최소 의심 구간을 지킨다", () => {
    const truthAt95 = partyResult(
      evaluateInfoCard({
        audience: "party",
        card: card("truth"),
        party: [member("impulsive", 100)],
        cardRng: scriptedRng(95),
        trustRng: scriptedRng(0),
      }),
    );
    const truthAt96 = partyResult(
      evaluateInfoCard({
        audience: "party",
        card: card("truth"),
        party: [member("impulsive", 100)],
        cardRng: scriptedRng(96),
        trustRng: scriptedRng(),
      }),
    );
    const lowTrustSuspicious = [member("suspicious", 0)];
    const lieAt50 = partyResult(
      evaluateInfoCard({
        audience: "party",
        card: card("lie"),
        party: lowTrustSuspicious,
        cardRng: scriptedRng(50),
        trustRng: scriptedRng(),
      }),
    );
    const lieAt51 = partyResult(
      evaluateInfoCard({
        audience: "party",
        card: card("lie"),
        party: lowTrustSuspicious,
        cardRng: scriptedRng(51),
        trustRng: scriptedRng(0),
      }),
    );
    const lieAt56 = partyResult(
      evaluateInfoCard({
        audience: "party",
        card: card("lie"),
        party: lowTrustSuspicious,
        cardRng: scriptedRng(56),
        trustRng: scriptedRng(),
      }),
    );

    expect(truthAt95.memberResults[0].reaction).toBe("accepted");
    expect(truthAt96.memberResults[0].reaction).toBe("suspected");
    expect(lieAt50.memberResults[0].reaction).toBe("exposed");
    expect(lieAt51.memberResults[0].reaction).toBe("accepted");
    expect(lieAt56.memberResults[0].reaction).toBe("suspected");
  });

  it("사망자를 제외하고 입력을 바꾸지 않으며 같은 시드에서 재현된다", () => {
    const party = [member("prudent"), member("greedy", 50, false)];
    const snapshot = structuredClone(party);
    const first = evaluateInfoCard({
      audience: "party",
      card: card("truth"),
      party,
      cardRng: createRng("same").derive("card"),
      trustRng: createRng("same").derive("trust"),
    });
    const second = evaluateInfoCard({
      audience: "party",
      card: card("truth"),
      party,
      cardRng: createRng("same").derive("card"),
      trustRng: createRng("same").derive("trust"),
    });

    expect(first).toEqual(second);
    expect(partyResult(first).memberResults).toHaveLength(1);
    expect(party).toEqual(snapshot);
    expect(partyResult(first).memberResults[0].member).not.toBe(party[0]);
  });
});
