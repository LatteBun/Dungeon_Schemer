import { describe, expect, it } from "vitest";
import type { CampaignEnding, CampaignState, Character } from "@/lib/domain";
import { initializeCampaign } from "./campaign-init";
import { isPersonnelExhausted } from "./ending";

function campaignWith(
  members: readonly { classId: string; gravelyWounded?: boolean; alive?: boolean; trust?: number }[],
): CampaignState {
  const campaign = initializeCampaign("ending-exhaustion-test");
  const byId = Object.fromEntries(Object.entries(campaign.pool.byId).map(([id, member]) => [
    id,
    { ...member, alive: false, hp: 0, trust: 0 },
  ])) as Record<string, Character>;
  for (const entry of members) {
    const member = Object.values(campaign.pool.byId).find((candidate) => candidate.classId === entry.classId);
    if (member === undefined) throw new Error(`missing class ${entry.classId}`);
    byId[member.id] = {
      ...member,
      alive: entry.alive ?? true,
      hp: entry.alive === false ? 0 : member.maxHp,
      trust: entry.trust ?? 50,
      gravelyWounded: entry.gravelyWounded ?? false,
    };
  }
  return { ...campaign, pool: { ...campaign.pool, byId } };
}

describe("isPersonnelExhausted", () => {
  it("중상자를 포함해 세 직업을 만들 수 있으면 인력 소진이 아니다", () => {
    expect(isPersonnelExhausted(campaignWith([
      { classId: "warrior" },
      { classId: "rogue" },
      { classId: "cleric", gravelyWounded: true },
    ]))).toBe(false);
  });

  it("사망자와 신뢰 0을 뺀 뒤 세 직업을 못 만들면 인력 소진이다", () => {
    expect(isPersonnelExhausted(campaignWith([
      { classId: "warrior" },
      { classId: "rogue" },
      { classId: "mage", alive: false },
      { classId: "cleric", trust: 0 },
    ]))).toBe(true);
  });
});

describe("CampaignEnding 계약", () => {
  it("엔딩 제목과 결정적 트리거 캐릭터 ID를 표현한다", () => {
    const campaign = campaignWith([
      { classId: "warrior", trust: 0 },
      { classId: "rogue", trust: 0 },
    ]);
    const ending: CampaignEnding = {
      kind: "denounced",
      title: "누적 고발",
      reason: "살아 있는 용사 5명 이상이 길잡이를 불신합니다.",
      finalRank: "B",
      triggerCharacterIds: [campaign.pool.order[0]!],
    };

    expect(ending.triggerCharacterIds).toEqual([campaign.pool.order[0]]);
  });
});
