import { describe, expect, it } from "vitest";
import { createStrategy } from "./strategies";
import { merchantTraceDeltaFor, runCampaign, type CampaignTransitionObservation } from "./campaign-driver";
import { createCampaignStore } from "@/lib/store/campaign-store";
import type { Accuracy } from "./public-state";

describe("백테스트 캠페인 driver", () => {
  it("실제 Store 액션으로 캠페인을 엔딩까지 진행한다", () => {
    const result = runCampaign({ seed: "driver-smoke", strategy: createStrategy("survival"), accuracy: 0.7 });
    if (!result.ok) throw new Error(`${result.errorKind}: ${result.message}`);
    expect(result.ok).toBe(true);
    expect(result.campaign.phase).toBe("ended");
    expect(result.trace.actionTypes).toContain("COMPLETE_EXPEDITION");
    expect(result.trace.actionTypes).toContain("ACKNOWLEDGE_OUTCOME");
    expect(result.trace.steps).toBeLessThanOrEqual(800);
  });

  it("단일 실행 가능 상인 조언의 정확도 miss도 캠페인을 중단시키지 않는다", () => {
    // Break caught: a sampled miss used to reject the sole neutral executable merchant option.
    const result = runCampaign({
      seed: "b1b-calibration-v1/000000",
      strategy: createStrategy("opportunist"),
      accuracy: 0.4,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.campaign.phase).toBe("ended");
  });

  it("rank 잠금만 남은 board에서 기회주의형은 골드 승급으로 정상 종료한다", () => {
    // Break caught: the opportunist merchant reserve declined the only promotion that could unlock a contract, causing a board generation error.
    const result = runCampaign({
      seed: "b1b-calibration-v1/000002",
      strategy: createStrategy("opportunist"),
      accuracy: 0.7,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.campaign.phase).toBe("ended");
  });

  it("실제 원정의 조언 압력과 보스 진입 상태를 추적한다", () => {
    const result = runCampaign({ seed: "driver-balance-trace", strategy: createStrategy("survival"), accuracy: 0.7 });

    if (!result.ok) throw new Error(`${result.errorKind}: ${result.message}`);
    expect(result.ok).toBe(true);
    expect(result.trace.balanceExpeditions.length).toBeGreaterThanOrEqual(result.campaign.statistics.totalExpeditions);
    expect(result.trace.balanceExpeditions.filter((one) => one.result !== null)).toHaveLength(
      result.campaign.statistics.totalExpeditions,
    );
    expect(result.trace.balanceExpeditions.every((one) => one.startAdvicePressure === 0)).toBe(true);
    expect(result.trace.balanceExpeditions.every((one) => one.maxAdvicePressure >= 0 && one.maxAdvicePressure <= 3)).toBe(true);
    expect(result.trace.balanceExpeditions.filter((one) => one.bossEntry !== null)
      .every((one) => one.bossEntry!.hp <= one.bossEntry!.maxHp)).toBe(true);
  });

  it("회피·비전투를 제외하고 확정 일반전과 보스전을 전이 직후 한 번씩만 관측한다", () => {
    const result = runCampaign({ seed: "driver-battle-trace", strategy: createStrategy("survival"), accuracy: 1 as Accuracy });
    if (!result.ok) throw new Error(`${result.errorKind}: ${result.message}`);

    const battles = result.trace.battles;
    expect(result.trace.nodeCategoryChoices.monster).toBeGreaterThan(0);
    expect(result.trace.nodeCategoryChoices.rest + result.trace.nodeCategoryChoices.merchant + result.trace.nodeCategoryChoices.special)
      .toBeGreaterThan(0);
    expect(battles).toHaveLength(result.campaign.statistics.totalExpeditions);
    expect(battles.every((entry) => entry.kind === "boss")).toBe(true);
    expect(battles.every((entry) => entry.battle.party.every((member) => {
      const partyMember = entry.party.find((candidate) => candidate.characterId === member.id);
      return partyMember !== undefined && partyMember.hpAfter === member.hp;
    }))).toBe(true);
    const keys = battles.map((entry) => `${entry.kind}\u0000${entry.expeditionId}\u0000${JSON.stringify(entry.battle)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("조언 직후 일반전·회피·비전투 사실과 전투 trace를 직접 대조한다", () => {
    const transitions: CampaignTransitionObservation[] = [];
    const result = runCampaign({
      seed: "driver-battle-trace",
      strategy: createStrategy("survival"),
      accuracy: 0.7,
      onTransition: (transition) => transitions.push(transition),
    });
    if (!result.ok) throw new Error(`${result.errorKind}: ${result.message}`);

    const adviceTransitions = transitions.filter((transition) => transition.actionType === "CHOOSE_ADVICE");
    const foughtMonsterTransitions = adviceTransitions.filter((transition) =>
      transition.pendingOutcome?.eventKind === "monster" && transition.pendingOutcome.battle !== null,
    );
    const avoidedMonsterTransitions = adviceTransitions.filter((transition) =>
      transition.pendingOutcome?.eventKind === "monster" && transition.pendingOutcome.battle === null,
    );
    const nonCombatTransitions = adviceTransitions.filter((transition) =>
      transition.pendingOutcome !== null && transition.pendingOutcome.eventKind !== "monster",
    );

    expect(foughtMonsterTransitions.length).toBeGreaterThan(0);
    expect(avoidedMonsterTransitions.length).toBeGreaterThan(0);
    expect(nonCombatTransitions.length).toBeGreaterThan(0);

    const generalBattleKeys = result.trace.battles
      .filter((entry) => entry.kind === "general")
      .map((entry) => `${entry.expeditionId}\u0000${JSON.stringify(entry.battle)}`);
    const foughtMonsterKeys = foughtMonsterTransitions
      .map((transition) => `${transition.expeditionId}\u0000${JSON.stringify(transition.pendingOutcome!.battle)}`);
    expect(generalBattleKeys).toEqual(foughtMonsterKeys);
  });

  it("실제 Store 전이에서 원정과 월드턴 손실 원장을 기록한다", () => {
    const result = runCampaign({ seed: "driver-smoke", strategy: createStrategy("survival"), accuracy: 0.7 });
    if (!result.ok) throw new Error(`${result.errorKind}: ${result.message}`);

    expect(result.trace.depletion).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "expedition-boss",
        expeditionId: expect.any(String),
        dungeonId: expect.any(String),
      }),
      expect.objectContaining({
        source: "world-turn-rest",
        expeditionId: null,
        dungeonId: null,
      }),
    ]));
    expect(result.trace.depletion.every((entry) =>
      Number.isInteger(entry.hpLost) && entry.hpLost >= 0
      && Number.isInteger(entry.hpRecovered) && entry.hpRecovered >= 0,
    )).toBe(true);
    const totals = result.trace.depletion.reduce((sum, entry) => ({
      deaths: sum.deaths + entry.deaths,
      trustZeroed: sum.trustZeroed + entry.trustZeroed,
      seriousInjuriesStarted: sum.seriousInjuriesStarted + entry.seriousInjuriesStarted,
      seriousInjuriesCleared: sum.seriousInjuriesCleared + entry.seriousInjuriesCleared,
    }), { deaths: 0, trustZeroed: 0, seriousInjuriesStarted: 0, seriousInjuriesCleared: 0 });
    const members = result.campaign.pool.order.map((id) => result.campaign.pool.byId[id]!);
    expect(totals.deaths).toBe(result.campaign.statistics.totalDeaths);
    expect(totals.trustZeroed).toBe(members.filter((member) => member.trust === 0).length);
    expect(totals.seriousInjuriesStarted - totals.seriousInjuriesCleared)
      .toBe(members.filter((member) => member.gravelyWounded).length);
  });

  it("인력 소진 종료에는 가용 직업 경계를 넘긴 선행 손실과 전멸 source를 보존한다", () => {
    /*
     * 지도 배정은 진화해도, 실제로 인력 소진한 실행의 원장 의미는 고정한다.
     *
     * 전멸로 끝난 실행을 고른다. 인력 소진은 마지막 전멸 없이 소모만으로도
     * 닿을 수 있어서, 그냥 첫 실행을 집으면 `wipeSource` 가 비어 있는 판이
     * 잡힌다 — 게시판이 다른 던전을 걸기 시작하자 실제로 그렇게 됐다. 여기서
     * 보려는 것은 전멸이 원장에 남는가이므로 그 조건을 밖으로 드러낸다.
     */
    const result = Array.from({ length: 40 }, (_, index) => runCampaign({
      seed: `b1b-calibration-v1/${String(index).padStart(6, "0")}`,
      strategy: createStrategy("survival"),
      accuracy: 0.7,
    })).find((candidate) => candidate.ok
      && candidate.campaign.ending?.kind === "exhausted"
      && candidate.trace.terminationEvidence?.wipeSource != null);

    expect(result).toBeDefined();
    if (result === undefined || !result.ok) throw new Error("인력 소진 실행을 찾지 못했다");

    expect(result.campaign.ending?.kind).toBe("exhausted");
    expect(result.trace.terminationEvidence).toMatchObject({
      sourceLosses: expect.arrayContaining([
        expect.objectContaining({ source: "expedition-boss", deaths: expect.any(Number) }),
      ]),
      wipeSource: "expedition-boss",
      precedingPool: { emergencyEligibleClassCount: expect.any(Number) },
      finalPool: { emergencyEligibleClassCount: expect.any(Number) },
    });
    expect(result.trace.terminationEvidence!.precedingPool.emergencyEligibleClassCount).toBeGreaterThanOrEqual(3);
    expect(result.trace.terminationEvidence!.finalPool.emergencyEligibleClassCount).toBeLessThan(3);
  });

  it("원정마다 초기·현재 위험도와 던전별 시도 번호를 기록한다", () => {
    const result = runCampaign({
      seed: "driver-balance-trace",
      strategy: createStrategy("survival"),
      accuracy: 0.7,
    });
    if (!result.ok) throw new Error(`${result.errorKind}: ${result.message}`);

    const attempts = new Map<string, number>();
    for (const expedition of result.trace.balanceExpeditions) {
      const expected = (attempts.get(expedition.dungeonId) ?? 0) + 1;
      expect(expedition.attemptNumber).toBe(expected);
      expect(expedition.currentRiskLevel).toBeGreaterThanOrEqual(expedition.initialRiskLevel);
      attempts.set(expedition.dungeonId, expected);
    }
  });

  it("step limit로 끝난 원정의 확정 손실과 interrupted 상태를 보존한다", () => {
    const result = runCampaign({
      seed: "driver-interrupted-trace",
      strategy: createStrategy("survival"),
      accuracy: 0.7,
      stepLimit: 30,
    });

    expect(result.ok).toBe(false);
    expect(result.trace.balanceExpeditions.length).toBeGreaterThanOrEqual(1);
    expect(result.trace.balanceExpeditions.some((expedition) => expedition.result === "interrupted")).toBe(true);
    expect(result.trace.depletion.length).toBeGreaterThan(0);
  });

  it("전투 전멸도 결과를 확인한 뒤 정산한다", () => {
    const base = createStrategy("selective-betrayal");
    const harmful = {
      ...base,
      chooseOffer: (view: Parameters<typeof base.chooseOffer>[0]) => ({ ...base.chooseOffer(view), betrayal: true }),
      chooseAdviceIntent: () => "harm" as const,
    };
    let found = false;
    for (let index = 0; index < 40; index += 1) {
      const result = runCampaign({ seed: `driver-wipe-ack-${index}`, strategy: harmful, accuracy: 1 as unknown as Accuracy });
      const actions = result.trace.actionTypes;
      if (actions.some((action, actionIndex) => action === "COMPLETE_EXPEDITION"
        && actions[actionIndex - 1] === "ACKNOWLEDGE_OUTCOME"
        && actions[actionIndex - 2] === "CHOOSE_ADVICE")) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  }, 15_000);

  it("원정을 시작해도 상인 효과를 소비한 것으로 세지 않는다", () => {
    const result = runCampaign({
      seed: "driver-merchant-start",
      strategy: createStrategy("survival"),
      accuracy: 0.7,
      stepLimit: 3,
    });

    expect(result.trace.actionTypes).toEqual(["OPEN_BOARD", "SELECT_CONTRACT", "START_EXPEDITION"]);
    expect(result.trace.merchantEffectsConsumed).toBe(0);
  });

  it("골드 승급 비용을 상인 지출로 합산하지 않는다", () => {
    const before = createCampaignStore("driver-gold-promotion").getState();
    const after = {
      ...before,
      campaign: { ...before.campaign, gold: before.campaign.gold - 10 },
    };

    expect(merchantTraceDeltaFor({ type: "PROMOTE_GUIDE", method: "gold" }, before, after)).toEqual({
      goldSpent: 0,
      effectsConsumed: 0,
    });
  });

  it("실제 상인 조언의 골드와 효과 소비를 모두 기록한다", () => {
    /* 상인 칸의 위치는 지도 규칙에 따라 달라진다. 효과가 실제 발동한 실행을 찾는다. */
    const result = Array.from({ length: 40 }, (_, index) => runCampaign({
      seed: `driver-merchant-effect-${index}`,
      strategy: createStrategy("survival"),
      accuracy: 0.7,
    })).find((candidate) => candidate.trace.merchantGoldSpent > 0 && candidate.trace.merchantEffectsConsumed > 0);

    expect(result).toBeDefined();
    if (result === undefined) throw new Error("상인 효과를 소비한 실행을 찾지 못했다");
    expect(result.trace.merchantGoldSpent).toBeGreaterThan(0);
    expect(result.trace.merchantEffectsConsumed).toBeGreaterThan(0);
  });

  it("같은 seed·전략·정확도는 같은 trace와 결과를 만든다", () => {
    const first = runCampaign({ seed: "driver-repeat", strategy: createStrategy("opportunist"), accuracy: 0.4 });
    const second = runCampaign({ seed: "driver-repeat", strategy: createStrategy("opportunist"), accuracy: 0.4 });
    expect(second.trace).toEqual(first.trace);
    expect(second).toEqual(first);
  });

  it("세 전략과 두 정확도 조합을 모두 실행한다", () => {
    for (const strategyId of ["survival", "opportunist", "selective-betrayal"] as const) {
      for (const accuracy of [0.4, 0.7] as const) {
        const result = runCampaign({ seed: `driver-${strategyId}-${accuracy}`, strategy: createStrategy(strategyId), accuracy });
        expect(result.trace.steps).toBeLessThanOrEqual(800);
      }
    }
  });
});
