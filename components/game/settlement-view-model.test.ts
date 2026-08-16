import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/content/bosses";
import { createRng } from "@/lib/rng";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { resolveBossFight } from "@/lib/rules/boss";
import { resolveEnding } from "@/lib/rules/ending";
import { BOSS_DAMAGE_MODIFIERS } from "@/lib/rules/info";
import { runOneExpedition } from "@/app/u3-test/u3-fixtures";
import { emptyStatistics, recordExpedition } from "@/lib/rules/statistics";
import { createFixtureCampaignState, createFixtureExpeditionRecord } from "@/lib/rules/fixtures";
import type {
  CampaignEnding,
  CampaignMember,
  CampaignState,
  CardId,
  DungeonId,
  InfoRecord,
  MemberId,
  TruthType,
} from "@/lib/domain";
import type { SettlementStep } from "@/lib/rules/settlement";
import {
  toBossResultView,
  toEndingView,
  toSettlementTimelineView,
} from "./settlement-view-model";

function firstParty(state: CampaignState): CampaignMember[] {
  const party = state.parties.find((candidate) => candidate.complete)!;
  return party.memberIds.map(
    (memberId) => state.members.find((member) => member.id === memberId)!,
  );
}

function bossRecord(
  memberId: MemberId,
  truthType: TruthType,
  reaction: InfoRecord["reaction"],
): InfoRecord {
  return {
    cardId: `u3-${truthType}-${memberId}` as CardId,
    truthType,
    subject: "boss",
    memberId,
    reaction,
    modifier: reaction === "accepted" ? BOSS_DAMAGE_MODIFIERS[truthType] : 0,
    pendingVerification: truthType === "lie" && reaction === "accepted",
  };
}

describe("toBossResultView", () => {
  it("실제 클리어 결과를 정확한 라벨과 HP 변화로 파생한다", () => {
    const state = initializeCampaign("u3-boss");
    const membersBefore = firstParty(state).map((member, index) => ({
      ...member,
      // 보스 피해보다 낮은 HP도 화면에서는 0으로 멈춘다.
      currentHp: index === 0 ? 1 : member.currentHp,
    }));
    const resolution = resolveBossFight({
      boss: BOSSES.find((boss) => boss.grade === "C")!,
      members: membersBefore,
      infoRecords: [],
      rng: createRng("u3-boss").derive("boss"),
    });

    const view = toBossResultView(resolution, membersBefore);

    expect(view.outcome).toBe("clear");
    expect(view.outcomeLabel).toBe("클리어");
    expect(view.members).toHaveLength(membersBefore.length);
    for (const member of view.members) {
      const before = membersBefore.find((candidate) => candidate.id === member.memberId)!;
      expect(member.hpBefore).toBe(before.currentHp);
      expect(member.hpAfter).toBe(Math.max(0, before.currentHp - member.damage));
      expect(member.survivalMark).toBe(member.survived ? "✓" : "×");
      expect(member.survivalLabel).toBe(member.survived ? "생존" : "사망");
    }
  });

  it("실제 전멸 결과를 정확한 라벨로 파생한다", () => {
    const state = initializeCampaign("u3-wipe-label");
    const membersBefore = firstParty(state).map((member) => ({
      ...member,
      currentHp: 1,
    }));
    const resolution = resolveBossFight({
      boss: BOSSES.find((boss) => boss.grade === "S")!,
      members: membersBefore,
      infoRecords: [],
      rng: createRng("u3-wipe-label").derive("boss"),
    });

    const view = toBossResultView(resolution, membersBefore);

    expect(view.outcome).toBe("wipe");
    expect(view.outcomeLabel).toBe("전멸");
  });

  it("양·음수 피해 보정과 사후 검증을 해당 파티원에게 조인한다", () => {
    const state = initializeCampaign("u3-modifier");
    const membersBefore = firstParty(state).map((member) => ({ ...member }));
    const [truthMember, deceivedMember, suspiciousMember] = membersBefore;
    const infoRecords = [
      bossRecord(truthMember.id, "truth", "accepted"),
      bossRecord(deceivedMember.id, "lie", "accepted"),
      bossRecord(suspiciousMember.id, "lie", "suspected"),
    ];
    const resolution = resolveBossFight({
      boss: BOSSES.find((boss) => boss.grade === "C")!,
      members: membersBefore,
      infoRecords,
      rng: createRng("u3-modifier").derive("boss"),
    });

    const view = toBossResultView(resolution, membersBefore);
    const truthView = view.members.find((member) => member.memberId === truthMember.id)!;
    const deceivedView = view.members.find(
      (member) => member.memberId === deceivedMember.id,
    )!;
    const suspiciousView = view.members.find(
      (member) => member.memberId === suspiciousMember.id,
    )!;
    const deceivedVerification = resolution.verifications.find(
      (verification) => verification.memberId === deceivedMember.id,
    )!;
    const suspiciousVerification = resolution.verifications.find(
      (verification) => verification.memberId === suspiciousMember.id,
    )!;

    expect(truthView.modifierNote).toBe("보스 피해 -20%");
    expect(truthView.verificationNote).toBeNull();
    expect(truthView.trustDelta).toBe(0);
    expect(deceivedView.modifierNote).toBe("보스 피해 +25%");
    expect(deceivedView.verificationNote).toBe(deceivedVerification.change.reason);
    expect(deceivedView.trustDelta).toBe(deceivedVerification.change.delta);
    expect(suspiciousView.modifierNote).toBe("보정 없음");
    expect(suspiciousView.verificationNote).toBe(suspiciousVerification.change.reason);
    expect(suspiciousView.trustDelta).toBe(suspiciousVerification.change.delta);
  });

  it("보스 전 스냅샷이 없으면 사후 HP와 피해로 전후 HP를 복원한다", () => {
    const state = initializeCampaign("u3-fallback");
    const membersBefore = firstParty(state).map((member) => ({ ...member }));
    const resolution = resolveBossFight({
      boss: BOSSES.find((boss) => boss.grade === "C")!,
      members: membersBefore,
      infoRecords: [],
      rng: createRng("u3-fallback").derive("boss"),
    });
    const missingEntry = resolution.members[0];

    const view = toBossResultView(resolution, membersBefore.slice(1));
    const missingView = view.members.find(
      (member) => member.memberId === missingEntry.member.id,
    )!;

    expect(missingView.hpBefore).toBe(
      missingEntry.member.currentHp + missingEntry.damage,
    );
    expect(missingView.hpAfter).toBe(missingEntry.member.currentHp);
  });

  it("사망자의 누락된 전투 전 HP는 clamp 뒤 복원할 수 없으므로 null이다", () => {
    const state = initializeCampaign("u3-dead-fallback");
    const membersBefore = firstParty(state).map((member) => ({
      ...member,
      currentHp: 1,
    }));
    const resolution = resolveBossFight({
      boss: BOSSES.find((boss) => boss.grade === "S")!,
      members: membersBefore,
      infoRecords: [],
      rng: createRng("u3-dead-fallback").derive("boss"),
    });
    const missingEntry = resolution.members[0];

    const view = toBossResultView(resolution, membersBefore.slice(1));
    const missingView = view.members.find(
      (member) => member.memberId === missingEntry.member.id,
    )!;

    expect(missingEntry.member.currentHp).toBe(0);
    expect(missingView.hpBefore).toBeNull();
    expect(missingView.hpAfter).toBe(0);
  });
});

describe("toSettlementTimelineView", () => {
  it("번호를 1부터 매기고 순서와 원문을 그대로 지킨다", () => {
    const steps: SettlementStep[] = [
      { kind: "survival", summary: "생존 2 · 사망 1" },
      { kind: "reward", summary: "명성 +6 · 골드 +12" },
      { kind: "ending", summary: "엔딩 없음" },
    ];

    const view = toSettlementTimelineView(steps);

    expect(view.map((step) => step.order)).toEqual([1, 2, 3]);
    expect(view.map((step) => step.kind)).toEqual(["survival", "reward", "ending"]);
    expect(view.map((step) => step.summary)).toEqual([
      "생존 2 · 사망 1",
      "명성 +6 · 골드 +12",
      "엔딩 없음",
    ]);
    expect(view[0].label).toBe("생존·신뢰");
  });

  it("실제 정산 규칙의 6단계 원문과 라벨을 보존한다", () => {
    const steps = runOneExpedition("u3-real-settlement").steps;

    const view = toSettlementTimelineView(steps);

    expect(view.map((step) => step.kind)).toEqual([
      "survival",
      "reward",
      "dungeon",
      "promotion",
      "party",
      "ending",
    ]);
    expect(view.map((step) => step.label)).toEqual([
      "생존·신뢰",
      "계약 보상",
      "던전",
      "승급",
      "파티·회복",
      "다음 상태",
    ]);
    expect(view.map((step) => step.summary)).toEqual(
      steps.map((step) => step.summary),
    );
  });
});

describe("toEndingView", () => {
  it("엔딩이 없으면 null이다", () => {
    const state = initializeCampaign("u3-no-ending");
    expect(toEndingView(state, null)).toBeNull();
  });

  it("모든 던전을 클리어하면 원정 종료를 최종 등급·요약과 함께 보여준다", () => {
    const base = initializeCampaign("u3-complete");
    const cleared: CampaignState = {
      ...base,
      currentReputation: 72,
      cumulativeGold: 200,
      currentGold: 146,
      dungeons: base.dungeons.map((dungeon) => ({ ...dungeon, status: "cleared" as const })),
    };
    const ending = resolveEnding(cleared, [])!;

    const view = toEndingView(cleared, ending)!;

    expect(view.endingId).toBe("expeditionComplete");
    expect(view.endingLabel).toBe("원정 종료");
    expect(view.reason).toBe(ending.reason);
    expect(view.promotionScore).toBe(72 * 2 + 200);
    expect(view.summary.clearedDungeons).toBe(15);
    expect(view.summary.totalDungeons).toBe(15);
    expect(view.summary.finalReputation).toBe(72);
    expect(view.summary.cumulativeGold).toBe(200);
    expect(view.summary.seed).toBe("u3-complete");
    expect(view.summary.survivalRate).toBe(100);
  });

  it("나머지 세 엔딩을 규칙 결과와 정확한 화면 이름으로 매핑한다", () => {
    const base = initializeCampaign("u3-ending-labels");
    const survivorIds = base.parties[0].memberIds.slice(0, 2);
    const distrustState: CampaignState = {
      ...base,
      members: base.members.map((member) =>
        survivorIds.includes(member.id) ? { ...member, trust: 0 } : member),
    };
    const supportUnavailableState: CampaignState = {
      ...base,
      currentReputation: -100,
    };
    const partyExhaustedState: CampaignState = {
      ...base,
      parties: base.parties.map((party) => ({ ...party, complete: false })),
    };
    const cases = [
      {
        state: distrustState,
        survivors: survivorIds,
        endingId: "distrust",
        label: "불신의 대가",
      },
      {
        state: supportUnavailableState,
        survivors: [] as MemberId[],
        endingId: "supportUnavailable",
        label: "길잡이 자격 박탈",
      },
      {
        state: partyExhaustedState,
        survivors: [] as MemberId[],
        endingId: "partyExhausted",
        label: "용사들의 시대가 끝나다",
      },
    ] as const;

    for (const testCase of cases) {
      const ending = resolveEnding(testCase.state, testCase.survivors)!;
      const view = toEndingView(testCase.state, ending)!;

      expect(ending.id).toBe(testCase.endingId);
      expect(view.endingLabel).toBe(testCase.label);
      expect(view.reason).toBe(ending.reason);
    }
  });

  it("생존률을 가장 가까운 정수로 반올림한다", () => {
    const base = initializeCampaign("u3-survival-rounding");
    const state: CampaignState = {
      ...base,
      dungeons: base.dungeons.map((dungeon) => ({
        ...dungeon,
        status: "cleared" as const,
      })),
      members: base.members.slice(0, 3).map((member, index) => ({
        ...member,
        alive: index < 2,
        currentHp: index < 2 ? member.currentHp : 0,
      })),
    };
    const ending = resolveEnding(state, [])!;

    const view = toEndingView(state, ending)!;

    expect(view.summary.aliveMembers).toBe(2);
    expect(view.summary.deadMembers).toBe(1);
    expect(view.summary.survivalRate).toBe(67);
  });
});

const ENDING: CampaignEnding = {
  id: "expeditionComplete",
  reason: "던전 15개를 모두 정리하고 원정을 끝냈다.",
  at: 0,
};

function stateWithStatistics(): CampaignState {
  const cards = emptyStatistics().cards;
  cards.lie.delivered = 2;
  cards.lie.accepted = 4;
  cards.lie.exposed = 1;
  cards.lie.lateExposed = 3;

  const statistics = [
    createFixtureExpeditionRecord({
      order: 1,
      grade: "B",
      dungeonId: "dungeon-003" as DungeonId,
      cards,
      reputationDelta: -6,
      goldDelta: 31,
      scoreBefore: 274,
      scoreAfter: 262,
      status: "failed",
      survivorCount: 0,
      casualtyCount: 3,
    }),
  ].reduce(recordExpedition, emptyStatistics());

  return { ...createFixtureCampaignState(), statistics };
}

describe("toEndingView 누적 통계", () => {
  it("진위 세 종류를 순서대로 이름표와 함께 낸다", () => {
    const view = toEndingView(stateWithStatistics(), ENDING);

    expect(view?.cards.map((card) => card.label)).toEqual(["진실", "거짓", "중립"]);
    expect(view?.cards[1].delivered).toBe(2);
    expect(view?.cards[1].lateExposed).toBe(3);
  });

  it("생환과 전멸 원정 수를 요약에 넣는다", () => {
    const view = toEndingView(stateWithStatistics(), ENDING);

    expect(view?.summary.clearedExpeditions).toBe(0);
    expect(view?.summary.wipedExpeditions).toBe(1);
  });

  it("전환점에 규칙 문장과 화면 이름표를 함께 담는다", () => {
    const view = toEndingView(stateWithStatistics(), ENDING);

    expect(view?.turningPoint?.summary).toContain("전멸했다");
    expect(view?.turningPoint?.dungeonLabel).toBe("B급 3번");
    expect(view?.turningPoint?.detail).toContain("274 → 262");
  });

  it("연대기가 기호와 글자를 함께 낸다", () => {
    const view = toEndingView(stateWithStatistics(), ENDING);
    const entry = view?.chronicle[0];

    expect(entry?.orderLabel).toBe("01");
    expect(entry?.statusMark).toBe("×");
    expect(entry?.statusLabel).toBe("전멸");
    expect(entry?.rewardLabel).toBe("명성 -6 · 골드 +31");
  });

  it("통계가 비면 전환점이 없고 연대기가 빈 목록이다", () => {
    const view = toEndingView(createFixtureCampaignState(), ENDING);

    expect(view?.turningPoint).toBeNull();
    expect(view?.chronicle).toEqual([]);
  });
});
