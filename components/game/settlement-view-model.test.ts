import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/content/bosses";
import { createRng } from "@/lib/rng";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { resolveBossFight } from "@/lib/rules/boss";
import { resolveEnding } from "@/lib/rules/ending";
import type { CampaignMember, CampaignState } from "@/lib/domain";
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

describe("toBossResultView", () => {
  it("실제 보스전 결과에서 생존 여부와 HP 변화를 파생한다", () => {
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

    expect(view.members).toHaveLength(membersBefore.length);
    expect(["클리어", "전멸"]).toContain(view.outcomeLabel);
    for (const member of view.members) {
      const before = membersBefore.find((candidate) => candidate.id === member.memberId)!;
      expect(member.hpBefore).toBe(before.currentHp);
      expect(member.hpAfter).toBe(Math.max(0, member.hpBefore - member.damage));
      expect(member.survivalMark).toBe(member.survived ? "✓" : "×");
      expect(member.survivalLabel).toBe(member.survived ? "생존" : "사망");
    }
  });

  it("피해 보정을 백분율 문구로 바꾸고 0이면 보정 없음으로 쓴다", () => {
    const state = initializeCampaign("u3-modifier");
    const membersBefore = firstParty(state).map((member) => ({ ...member }));
    const resolution = resolveBossFight({
      boss: BOSSES.find((boss) => boss.grade === "C")!,
      members: membersBefore,
      infoRecords: [],
      rng: createRng("u3-modifier").derive("boss"),
    });

    const view = toBossResultView(resolution, membersBefore);

    // 정보 카드를 전달하지 않았으므로 모든 보정이 0이다.
    for (const member of view.members) {
      expect(member.modifierNote).toBe("보정 없음");
      expect(member.verificationNote).toBeNull();
      expect(member.trustDelta).toBe(0);
    }
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
});
