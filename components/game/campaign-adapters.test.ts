import { describe, expect, it } from "vitest";
import { DENOUNCE_THRESHOLD, type CampaignState, type Character } from "@/lib/domain";
import { createCampaignStore } from "@/lib/store/campaign-store";
import { firstChoosableAdvice } from "@/lib/store/legal-advice";
import { createExpeditionForOffer } from "@/lib/rules/campaign-transition";
import { countEmergencyEligibleAdventurers } from "@/lib/rules/ending";
import {
  adviceIdForSlotIn,
  ecologyViewFor,
  logFor,
  progressViewFor,
  publicKindByNodeId,
  statusFor,
} from "./campaign-adapters";

/**
 * 어댑터 계약.
 *
 * 화면은 View 만 안다. 규칙 타입도 스토어도 모른다. 그 경계가 지켜지는지와,
 * 감춰야 할 것이 새지 않는지를 본다.
 */

const SEED = "i2-adapters";

function withZeroTrust(
  campaign: CampaignState,
  livingCount: number,
  deadCount = 0,
): CampaignState {
  const byId = { ...campaign.pool.byId } as Record<string, Character>;
  for (const id of campaign.pool.order.slice(0, livingCount)) {
    const member = byId[id];
    if (member === undefined) throw new Error(`missing character ${id}`);
    byId[id] = { ...member, trust: 0, alive: true, hp: Math.max(1, member.hp) };
  }
  for (const id of campaign.pool.order.slice(livingCount, livingCount + deadCount)) {
    const member = byId[id];
    if (member === undefined) throw new Error(`missing character ${id}`);
    byId[id] = { ...member, trust: 0, alive: false, hp: 0 };
  }
  return { ...campaign, pool: { ...campaign.pool, byId } };
}

function withEmergencyEligibility(
  campaign: CampaignState,
  affected: { wounded: number; dead: number; zeroTrust: number },
): CampaignState {
  const byId = { ...campaign.pool.byId } as Record<string, Character>;
  let cursor = 0;
  const update = (changes: Partial<Character>) => {
    const id = campaign.pool.order[cursor++];
    const member = id === undefined ? undefined : byId[id];
    if (member === undefined) throw new Error("missing character");
    byId[id] = { ...member, ...changes };
  };
  for (let index = 0; index < affected.wounded; index++) update({ gravelyWounded: true });
  for (let index = 0; index < affected.dead; index++) update({ alive: false, hp: 0 });
  for (let index = 0; index < affected.zeroTrust; index++) update({ trust: 0 });
  return { ...campaign, pool: { ...campaign.pool, byId } };
}

function inExpedition() {
  const store = createCampaignStore(SEED);
  store.getState().dispatch({ type: "OPEN_BOARD" });
  const offer = store.getState().campaign.offers.find((one) => one.lockReason === null)!;
  store.getState().dispatch({ type: "SELECT_CONTRACT", offerId: offer.id });
  const built = createExpeditionForOffer(store.getState().campaign, offer);
  store.getState().dispatch({ type: "START_EXPEDITION", expeditionId: "exp-i2-01", ...built });
  return store;
}

function atEvent() {
  const store = inExpedition();
  const active = store.getState().context.activeExpedition!;
  const entry = active.expedition.map.nodes.find((node) => node.id === active.expedition.currentNodeId)!;
  store.getState().dispatch({ type: "VISIT_NODE", nodeId: entry.nextNodeIds[0]! });
  return store;
}

describe("상태 바", () => {
  it("응급 편성 가능한 남은 용사 수를 전달한다", () => {
    const initial = createCampaignStore(SEED).getState().campaign;
    const campaign = withEmergencyEligibility(initial, {
      wounded: 1,
      dead: 1,
      zeroTrust: 1,
    });

    expect(statusFor(campaign, null).remainingAdventurers)
      .toBe(countEmergencyEligibleAdventurers(campaign));
  });

  it("초기 캠페인은 살아 있는 신뢰 0 인원과 도메인 기준을 함께 낸다", () => {
    const campaign = createCampaignStore(SEED).getState().campaign;

    expect(statusFor(campaign, null).zeroTrust).toEqual({
      livingCount: 0,
      threshold: DENOUNCE_THRESHOLD,
    });
  });

  it("살아 있는 신뢰 0만 세고 사망자는 제외한다", () => {
    const initial = createCampaignStore(SEED).getState().campaign;
    const campaign = withZeroTrust(initial, 2, 1);

    expect(statusFor(campaign, null).zeroTrust.livingCount).toBe(2);
  });

  it("기준을 넘은 실제 인원을 제한하지 않는다", () => {
    const initial = createCampaignStore(SEED).getState().campaign;

    expect(statusFor(withZeroTrust(initial, 7), null).zeroTrust.livingCount).toBe(7);
  });

  it("캠페인에서 만든다", () => {
    const store = createCampaignStore(SEED);
    const status = statusFor(store.getState().campaign, null);

    expect(status.rank).toBe(store.getState().campaign.rank);
    expect(status.reputation).toBe(store.getState().campaign.reputation);
    expect(status.gold).toBe(store.getState().campaign.gold);
    expect(status.currentDungeon).toBeUndefined();
  });

  it("원정 중이면 현재 던전을 보인다", () => {
    const store = inExpedition();
    const status = statusFor(store.getState().campaign, store.getState().context.activeExpedition);

    expect(status.currentDungeon).toBeDefined();
    /* 계약 시점의 위험도다. 던전이 올라도 이 원정은 그 값이다. */
    expect(status.currentDungeon!.riskLevel)
      .toBe(store.getState().context.activeExpedition!.expedition.riskLevel);
  });
});

describe("지도의 공개 분류", () => {
  it("계획의 분류만 내보낸다", () => {
    const store = atEvent();
    const active = store.getState().context.activeExpedition!;
    const kinds = publicKindByNodeId(active);

    expect(Object.keys(kinds).length).toBeGreaterThan(0);
    for (const value of Object.values(kinds)) {
      expect(["monster", "rest", "merchant", "special"]).toContain(value);
    }
  });

  /*
   * 숨은 역할은 지도에서 보이면 안 된다. 보스 정보 지점도 강한 연계 후속도
   * 평범한 같은 분류로 보여야 한다.
   */
  it("숨은 역할을 내보내지 않는다", () => {
    const store = atEvent();
    const active = store.getState().context.activeExpedition!;
    const serialized = JSON.stringify(publicKindByNodeId(active));

    for (const role of ["bossInfo", "strongPredecessor", "strongFollower", "hiddenRole"]) {
      expect(serialized).not.toContain(role);
    }
  });

  /*
   * 지점을 밟기 전에도 분류가 있어야 한다. 지도의 일이 그것이다.
   *
   * 한때 계획을 첫 방문 때 만들었더니 지도 화면이 빈 분류를 받아 던졌다.
   */
  it("원정을 시작하자마자 분류가 있다", () => {
    const store = inExpedition();
    expect(Object.keys(publicKindByNodeId(store.getState().context.activeExpedition!)).length)
      .toBeGreaterThan(0);
  });
});

describe("진행 화면 View", () => {
  it("사건이 없으면 만들지 않는다", () => {
    const store = inExpedition();
    expect(progressViewFor(store.getState().campaign, store.getState().context.activeExpedition!)).toBeNull();
  });

  it("사건이 있으면 조언 셋과 상황을 만든다", () => {
    const store = atEvent();
    const view = progressViewFor(store.getState().campaign, store.getState().context.activeExpedition!)!;

    expect(view.advice).toHaveLength(3);
    expect(view.situation.length).toBeGreaterThan(0);
    expect(view.party).toHaveLength(3);
    /* 선택 전이므로 결과가 없다. */
    expect(view.outcome).toBeNull();
  });

  /*
   * 조언 ID 가 화면에 닿으면 정답이 샌다. 콘텐츠 ID 가 `-help`·`-harm` 으로
   * 끝나기 때문이다.
   */
  it("조언 식별자와 내부 유형이 새지 않는다", () => {
    const store = atEvent();
    const active = store.getState().context.activeExpedition!;
    const view = progressViewFor(store.getState().campaign, active)!;
    const serialized = JSON.stringify(view);

    for (const option of active.pendingEvent!.advice) {
      expect(serialized).not.toContain(option.id);
    }
    for (const leak of ["help", "harm", "neutral", "consistent", "contradictory"]) {
      expect(serialized).not.toContain(leak);
    }
  });

  it("슬롯을 조언 ID 로 옮긴다", () => {
    const store = atEvent();
    const active = store.getState().context.activeExpedition!;
    const ids = [0, 1, 2].map((slot) => adviceIdForSlotIn(store.getState().campaign, active, slot));

    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(active.pendingEvent!.advice.some((one) => one.id === id)).toBe(true);
    }
  });
});

describe("생태 View", () => {
  it("공개된 규칙만 문장으로 낸다", () => {
    const store = inExpedition();
    const active = store.getState().context.activeExpedition!;
    const view = ecologyViewFor(store.getState().campaign, active);

    expect(view.disclosedRules).toHaveLength(active.expedition.disclosedRuleIds.length);
    /* 규칙 ID 가 아니라 사람이 읽는 문장이어야 한다. */
    for (const [index, text] of view.disclosedRules.entries()) {
      expect(text).not.toBe(String(active.expedition.disclosedRuleIds[index]));
    }
  });
});

/** 조언 하나를 실제로 고른 뒤의 상태. 기록이 한 칸 쌓여 있다. */
function walkOneEvent() {
  const store = atEvent();
  const active = store.getState().context.activeExpedition!;
  if (active.pendingEvent === null) throw new Error("사건이 확정되지 않았다");
  store.getState().dispatch({ type: "CHOOSE_ADVICE", adviceId: firstChoosableAdvice(store.getState().campaign, active) });
  const state = store.getState();
  return { campaign: state.campaign, active: state.context.activeExpedition! };
}

function startExpedition() {
  const state = inExpedition().getState();
  return { campaign: state.campaign, active: state.context.activeExpedition! };
}

describe("진행 기록", () => {
  it("답사가 알려 준 생태를 먼저 적는다", () => {
    const walked = walkOneEvent();
    const entries = logFor(walked.campaign, walked.active);

    expect(entries[0]?.label).toBe("생태 공개");
    expect(entries[0]?.tags).toEqual(["ecology"]);
  });

  /* 조언 식별자는 내부 정답을 담고 있다. 기록에 문구만 남아야 한다. */
  it("조언 식별자가 기록에 새지 않는다", () => {
    const walked = walkOneEvent();
    const dump = logFor(walked.campaign, walked.active).map((one) => one.detail).join(" ");

    expect(dump).not.toMatch(/-help|-harm|-neutral/);
  });

  it("지나온 자리마다 관찰과 조언이 남는다", () => {
    const walked = walkOneEvent();
    const entries = logFor(walked.campaign, walked.active);

    expect(entries.some((one) => one.label === "관찰")).toBe(true);
    expect(entries.some((one) => one.label === "조언 선택")).toBe(true);
  });

  /* 순번은 1부터 빈틈없이 이어져야 필터가 시간 순서를 잃지 않는다. */
  it("순번이 1부터 이어진다", () => {
    const entries = logFor(walkOneEvent().campaign, walkOneEvent().active);

    expect(entries.map((one) => one.order)).toEqual(entries.map((_, index) => index + 1));
  });

  it("아무 데도 가지 않았으면 생태 한 줄뿐이다", () => {
    const fresh = startExpedition();

    expect(logFor(fresh.campaign, fresh.active).every((one) => one.label === "생태 공개")).toBe(true);
  });

  /* 본 것과 알려 준 것은 다른 칸에 선다. 섞으면 무엇이 확인된 것인지 흐려진다. */
  it("관찰한 것을 규칙 문장으로 승격하지 않는다", () => {
    const walked = walkOneEvent();
    const ecology = ecologyViewFor(walked.campaign, walked.active);

    expect(ecology.observedClues.length).toBeGreaterThan(0);
    for (const clue of ecology.observedClues) expect(ecology.disclosedRules).not.toContain(clue);
  });
});
