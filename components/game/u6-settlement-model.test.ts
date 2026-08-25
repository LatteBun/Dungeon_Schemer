import { describe, expect, it } from "vitest";
import { TRUST_MIN, type SettlementResult } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { CAUSE_ORDER, createU6SettlementView, type U6SettlementView } from "./u6-settlement-model";

function distinctMembers(campaign: ReturnType<typeof initializeCampaign>) {
  const members = [];
  const classes = new Set<string>();
  for (const id of campaign.pool.order) {
    const member = campaign.pool.byId[id];
    if (member === undefined || classes.has(member.classId)) continue;
    classes.add(member.classId);
    members.push(member);
    if (members.length === 3) break;
  }
  if (members.length !== 3) throw new Error("서로 다른 직업 셋이 없다");
  return members as [typeof members[number], typeof members[number], typeof members[number]];
}

function result(campaign: ReturnType<typeof initializeCampaign>, over: Partial<SettlementResult> = {}): SettlementResult {
  const dungeon = campaign.dungeons[0]!;
  const members = distinctMembers(campaign);
  return {
    expeditionId: "exp-u6", dungeonId: dungeon.id, status: "wiped", survivorIds: [], survivorCount: 0,
    memberChanges: members.map((member) => ({ characterId: member.id, before: member, after: member })),
    reputationDelta: -6, goldDelta: 0, relicGold: 84, riskBefore: 1, riskAfter: 2, riskCapped: false,
    nextReward: { reputation: 10, gold: 20 },
    causeChain: { choice: "선택 내용", reactions: "반응 내용", damage: "피해 내용", economy: "경제 내용", campaignChange: "변화 내용" },
    ...over,
  };
}

const settlement = (over: Partial<U6SettlementView> = {}): U6SettlementView => ({
  dungeonName: "거미굴 3", themeId: "spider", survivors: 2,
  causeChain: CAUSE_ORDER.map((order) => ({ order, label: `${order}단계`, detail: "내용" })),
  riskBefore: 3, riskAfter: 3, riskCapped: false, members: [], reputationDelta: 9, goldDelta: 19, relicGold: 0,
  nextReward: { reputation: 15, gold: 32 }, ...over,
  outcome: { kind: "cleared", title: "거미굴 3 정복", summary: "2명 귀환 · 이름 사망" },
  causes: [
    { kind: "choice", label: "마지막 조언", detail: "선택 내용" },
    { kind: "reactions", label: "파티의 판단", detail: "반응 내용" },
  ],
  dungeonOutcome: { kind: "cleared" },
  trustPressure: null,
});

describe("U6 정산 화면 모델", () => {
  it("원인 사슬은 1~5 순서를 빠뜨리지 않는다", () => {
    expect(CAUSE_ORDER).toEqual([1, 2, 3, 4, 5]);
    expect(settlement().causeChain.map((step) => step.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("전멸은 생존 0명이고 계약 보상 대신 유품이 들어온다", () => {
    const wiped = settlement({ survivors: 0, reputationDelta: -10, goldDelta: 0, relicGold: 84 });
    expect(wiped.survivors).toBe(0);
    expect(wiped.reputationDelta).toBeLessThan(0);
    expect(wiped.relicGold).toBeGreaterThan(0);
  });

  it("★5 던전은 위험도가 더 오르지 않는다", () => {
    const capped = settlement({ survivors: 0, riskBefore: 5, riskAfter: 5, riskCapped: true });
    expect(capped.riskAfter).toBe(capped.riskBefore);
    expect(capped.riskCapped).toBe(true);
  });

  it("정산 결과의 계약금과 유품을 재계산 없이 U6으로 옮긴다", () => {
    const campaign = initializeCampaign("u6-settlement-adapter");
    const view = createU6SettlementView(campaign, result(campaign), "묘지 1", "graveyard");
    expect(view).toMatchObject({ survivors: 0, goldDelta: 0, relicGold: 84, riskBefore: 1, riskAfter: 2 });
    expect(view.causeChain.map((step) => step.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("클리어 결과의 다음 보상 null을 재계산 없이 보존한다", () => {
    const campaign = initializeCampaign("u6-cleared-reward");
    expect(createU6SettlementView(campaign, result(campaign, { status: "cleared", survivorCount: 3, nextReward: null }), "사막 5", "desert").nextReward).toBeNull();
  });

  it("★5 클리어는 위험도 상한에 막힌 실패가 아니다", () => {
    const campaign = initializeCampaign("u6-settlement-cap");
    const view = createU6SettlementView(campaign, result(campaign, {
      status: "cleared", survivorCount: 3, survivorIds: [campaign.pool.order[0]!], riskBefore: 5, riskAfter: 5, riskCapped: false,
    }), "사막 5", "desert");
    expect(view.riskCapped).toBe(false);
  });

  it("클리어는 위험도 유지가 아니라 정복 결과로 분류한다", () => {
    const campaign = initializeCampaign("u6-cleared-view");
    const [first, second, third] = distinctMembers(campaign);
    const afterMembers = [{ ...first, hp: Math.max(1, first.hp - 3) }, { ...second, hp: Math.max(1, second.hp - 4) }, { ...third, hp: 0, alive: false }];
    const byId = { ...campaign.pool.byId };
    for (const member of afterMembers) byId[member.id] = member;
    const afterCampaign = { ...campaign, pool: { ...campaign.pool, byId } };
    const settlementResult = result(campaign, {
      status: "cleared", survivorCount: 2, survivorIds: [first.id, second.id],
      memberChanges: afterMembers.map((after, index) => ({ characterId: after.id, before: [first, second, third][index]!, after })),
      riskBefore: 2, riskAfter: 2, riskCapped: false, nextReward: null,
    });
    const view = createU6SettlementView(afterCampaign, settlementResult, "거미굴 2", "spider");
    expect(view.outcome).toEqual({ kind: "cleared", title: "거미굴 2 정복", summary: `2명 귀환 · ${third.name} 사망` });
    expect(view.dungeonOutcome).toEqual({ kind: "cleared" });
  });

  it("살아 있는 신뢰 0의 전후 인원과 현재 보정을 만든다", () => {
    const campaign = initializeCampaign("u6-zero-trust-view");
    const [first, second, third] = distinctMembers(campaign);
    const outsideId = campaign.pool.order.find((id) => ![first.id, second.id, third.id].includes(id));
    if (outsideId === undefined) throw new Error("파티 밖 인물이 없다");
    const outside = campaign.pool.byId[outsideId];
    if (outside === undefined) throw new Error("파티 밖 인물이 없다");
    const existingZero = { ...outside, trust: 0, alive: true };
    const beforeById = { ...campaign.pool.byId, [existingZero.id]: existingZero };
    const beforeCampaign = { ...campaign, pool: { ...campaign.pool, byId: beforeById } };
    const afterFirst = { ...first, trust: 0 };
    const afterById = { ...beforeById, [afterFirst.id]: afterFirst };
    const afterCampaign = { ...beforeCampaign, pool: { ...beforeCampaign.pool, byId: afterById } };
    const settlementResult = result(campaign, {
      status: "cleared", survivorCount: 3, survivorIds: [first.id, second.id, third.id],
      memberChanges: [{ characterId: first.id, before: first, after: afterFirst }, { characterId: second.id, before: second, after: second }, { characterId: third.id, before: third, after: third }],
      nextReward: null,
    });
    const view = createU6SettlementView(afterCampaign, settlementResult, "묘지 1", "graveyard");
    expect(view.trustPressure).toMatchObject({ beforeCount: 1, afterCount: 2, threshold: 5, acceptModifier: -5, exposeModifier: 0, reachedThreshold: false });
    expect(view.members[0]?.trust).toMatchObject({ changed: true, isZero: true, becameZero: true, countsTowardCampaign: true });
  });

  it("사망한 신뢰 0 인물은 누적에서 제외한다", () => {
    const campaign = initializeCampaign("u6-dead-zero-trust");
    const [first, second, third] = distinctMembers(campaign);
    const beforeFirst = { ...first, trust: 0 };
    const beforeById = { ...campaign.pool.byId, [first.id]: beforeFirst };
    const beforeCampaign = { ...campaign, pool: { ...campaign.pool, byId: beforeById } };
    const deadFirst = { ...beforeFirst, hp: 0, alive: false };
    const afterById = { ...beforeById, [first.id]: deadFirst };
    const afterCampaign = { ...beforeCampaign, pool: { ...beforeCampaign.pool, byId: afterById } };
    const settlementResult = result(campaign, {
      status: "cleared", survivorCount: 2, survivorIds: [second.id, third.id],
      memberChanges: [{ characterId: first.id, before: beforeFirst, after: deadFirst }, { characterId: second.id, before: second, after: second }, { characterId: third.id, before: third, after: third }], nextReward: null,
    });
    const view = createU6SettlementView(afterCampaign, settlementResult, "사막 1", "desert");
    expect(view.trustPressure).toMatchObject({ beforeCount: 1, afterCount: 0 });
    expect(view.members[0]?.trust.countsTowardCampaign).toBe(false);
  });

  it("원정 전부터 신뢰 0인 생존자는 변화가 없어도 발각 상태로 만든다", () => {
    const campaign = initializeCampaign("u6-existing-zero-trust");
    const [first, second, third] = distinctMembers(campaign);
    const zeroFirst = { ...first, trust: TRUST_MIN };
    const afterById = { ...campaign.pool.byId, [first.id]: zeroFirst };
    const afterCampaign = { ...campaign, pool: { ...campaign.pool, byId: afterById } };
    const settlementResult = result(campaign, {
      status: "cleared", survivorCount: 3, survivorIds: [first.id, second.id, third.id],
      memberChanges: [{ characterId: first.id, before: zeroFirst, after: zeroFirst }, { characterId: second.id, before: second, after: second }, { characterId: third.id, before: third, after: third }], nextReward: null,
    });
    const view = createU6SettlementView(afterCampaign, settlementResult, "거미굴 1", "spider");
    expect(view.members[0]?.trust).toMatchObject({ changed: false, isZero: true, becameZero: false, countsTowardCampaign: true });
  });

  it("사망하면서 신뢰 0이 된 인물은 변화만 남기고 누적 원인에서 제외한다", () => {
    const campaign = initializeCampaign("u6-died-at-zero-trust");
    const [first, second, third] = distinctMembers(campaign);
    const beforeFirst = { ...first, trust: 8 };
    const deadFirst = { ...beforeFirst, hp: 0, alive: false, trust: TRUST_MIN };
    const afterById = { ...campaign.pool.byId, [first.id]: deadFirst };
    const afterCampaign = { ...campaign, pool: { ...campaign.pool, byId: afterById } };
    const settlementResult = result(campaign, {
      status: "cleared", survivorCount: 2, survivorIds: [second.id, third.id],
      memberChanges: [{ characterId: first.id, before: beforeFirst, after: deadFirst }, { characterId: second.id, before: second, after: second }, { characterId: third.id, before: third, after: third }], nextReward: null,
    });
    const view = createU6SettlementView(afterCampaign, settlementResult, "사막 1", "desert");
    expect(view.members[0]?.trust).toMatchObject({ changed: true, isZero: true, becameZero: true, countsTowardCampaign: false });
  });
});
