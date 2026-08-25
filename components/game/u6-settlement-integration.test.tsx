import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CampaignState, Character, SettlementSnapshot } from "@/lib/domain";
import { createOfferReward } from "@/lib/rules/board";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { settleExpedition } from "@/lib/rules/settlement";
import { statusFor } from "./campaign-adapters";
import { U6SettlementScreen } from "./U6SettlementScreen";
import { createU6SettlementView } from "./u6-settlement-model";

function partyMembers(campaign: CampaignState): Character[] {
  const members: Character[] = [];
  const classes = new Set<string>();
  for (const id of campaign.pool.order) {
    const member = campaign.pool.byId[id];
    if (member === undefined || classes.has(member.classId)) continue;
    classes.add(member.classId);
    members.push(member);
    if (members.length === 3) break;
  }
  if (members.length !== 3) throw new Error("서로 다른 직업 셋이 없다");
  return members;
}

function renderResult(campaign: CampaignState, snapshot: SettlementSnapshot): string {
  const dungeon = campaign.dungeons.find((candidate) => candidate.id === snapshot.dungeonId);
  if (dungeon === undefined) throw new Error("정산 던전이 없다");
  const execution = settleExpedition(campaign, snapshot);
  return renderToStaticMarkup(createElement(U6SettlementScreen, {
    status: statusFor(execution.campaign, null),
    settlement: createU6SettlementView(
      execution.campaign,
      execution.result,
      dungeon.name,
      dungeon.theme,
    ),
  }));
}

describe("U6 정산 통합", () => {
  it("2명 생환 클리어가 정복·사망·생존자 신뢰 0을 보여준다", () => {
    const campaign = initializeCampaign("u6-integration-clear");
    const dungeon = campaign.dungeons[0];
    const [first, second, third] = partyMembers(campaign);
    if (dungeon === undefined) throw new Error("정산 던전이 없다");
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error("파티가 없다");
    }
    const finalMembers = [
      { ...first, hp: Math.max(1, first.hp - 5), trust: 0 },
      { ...second, hp: Math.max(1, second.hp - 3) },
      { ...third, hp: 0, alive: false },
    ];

    const html = renderResult(campaign, {
      expeditionId: "u6-integration-clear-expedition",
      dungeonId: dungeon.id,
      contractRisk: dungeon.riskLevel,
      contractReward: createOfferReward(campaign, dungeon),
      party: { memberIds: [first.id, second.id, third.id] },
      finalMembers,
      status: "cleared",
      causeInputs: {
        choice: "수상한 표식 두 건만 믿으라고 했다",
        reactions: `${first.name} 수용 · ${second.name} 의심`,
        damage: `${third.name} HP ${third.hp} → 0`,
      },
    });

    expect(html).toContain(`${dungeon.name} 정복`);
    expect(html).toContain(`${third.name} 사망`);
    expect(html).toContain(`신뢰 ${first.trust} → 0`);
    expect(html).toContain("정체 발각");
    expect(html).toContain("1 / 5");
    expect(html).not.toContain("위험도 유지");
  });

  it("전멸이 계약 보상 없음·유품·위험도 상승을 보여준다", () => {
    const campaign = initializeCampaign("u6-integration-wipe");
    const dungeon = campaign.dungeons.find((candidate) => candidate.riskLevel < 5);
    if (dungeon === undefined) throw new Error("상승 가능한 정산 던전이 없다");
    const members = partyMembers(campaign);
    const finalMembers = members.map((member) => ({ ...member, hp: 0, alive: false }));

    const html = renderResult(campaign, {
      expeditionId: "u6-integration-wipe-expedition",
      dungeonId: dungeon.id,
      contractRisk: dungeon.riskLevel,
      contractReward: createOfferReward(campaign, dungeon),
      party: { memberIds: members.map((member) => member.id) },
      finalMembers,
      status: "wiped",
      causeInputs: {
        choice: "보스의 약점을 잘못 짚었다",
        reactions: "세 명 모두 조언을 따랐다",
        damage: finalMembers.map((member) => `${member.name} HP → 0`).join(" · "),
      },
    });

    expect(html).toContain("원정대 전멸");
    expect(html).toContain("계약 보상");
    expect(html).toContain("없음");
    expect(html).toContain("유품 골드");
    expect(html).toContain(`★${dungeon.riskLevel}`);
    expect(html).toContain(`★${dungeon.riskLevel + 1}`);
  });
});
