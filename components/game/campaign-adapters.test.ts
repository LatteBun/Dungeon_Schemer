import { describe, expect, it } from "vitest";
import { createCampaignStore } from "@/lib/store/campaign-store";
import { createExpeditionForOffer } from "@/lib/rules/campaign-transition";
import {
  adviceIdForSlotIn,
  ecologyViewFor,
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
