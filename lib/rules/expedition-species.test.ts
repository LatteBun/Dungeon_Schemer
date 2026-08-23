import { describe, expect, it } from "vitest";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { generateDungeonMap } from "@/lib/rules/dungeon-map";
import { materializeNodeEvent, prepareExpeditionEvents } from "@/lib/rules/expedition-events";
import { THEMES } from "@/lib/content/themes";

/**
 * 조우 종은 던전의 생태가 정한다.
 *
 * `event-registry` 는 조우를 선언하지 않은 monster 사건에 `theme.monsters[0]`
 * 를 넣는다. 54개 사건 전부가 그렇다. 그 종이 그 던전에 살지 않으면
 * `eventMatchesProfile` 이 사건을 통째로 걸러 내고, 결국 `monster` 노드를
 * 계획해 놓고도 물질화하지 못한다. 실제로 생태 패키지 15개 중 9개가 그랬다.
 *
 * 자리표시자를 던전이 켠 몹으로 갈아끼우면 그 일이 없다. 사건 본문과 조언은
 * 그대로 두고 종만 바꾼다.
 */

const SEEDS = ["u5-dungeon-progress-preview", "s1", "s2"] as const;

describe("강한 연계 노드 확보", () => {
  /*
   * 노드 분류는 하한 없는 균등 추첨이고 보스 정보 cut 층은 통째로 special 로
   * 먼저 빠진다. 그래서 ★3 이상 던전의 9% 가 강한 연계에 쓸 분류의 노드를
   * 요구 수만큼 갖지 못한 채 나왔고, 그때 원정이 시작조차 되지 않았다.
   * 노드 21개 중 monster 가 1개인 던전이 실제로 있었다.
   */
  it("★3 이상 던전이 모두 원정을 시작할 수 있다", () => {
    const blocked: string[] = [];

    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const campaign = initializeCampaign(seed);
      for (const dungeon of campaign.dungeons) {
        const theme = THEMES.find((candidate) => candidate.id === dungeon.theme)!;
        for (const attempt of [0, 1]) {
          const map = generateDungeonMap({
            campaignSeed: seed, dungeonId: dungeon.id,
            initialRiskLevel: dungeon.initialRiskLevel, attempt,
          });
          try {
            prepareExpeditionEvents({
              campaignSeed: seed, dungeonId: dungeon.id,
              initialRiskLevel: dungeon.initialRiskLevel, riskLevel: dungeon.riskLevel,
              attempt, map, theme,
              activeRuleIds: dungeon.activeRuleIds,
              activeMonsterIds: dungeon.activeMonsterIds,
            });
          } catch (error) {
            blocked.push(`${seed}/${dungeon.id} ★${dungeon.initialRiskLevel} a${attempt}: ${(error as Error).message}`);
          }
        }
      }
    }

    expect(blocked).toEqual([]);
  });

  /* 되는 던전은 건드리지 않는다. 같은 입력이 같은 계획을 낸다. */
  it("같은 입력은 같은 계획을 낸다", () => {
    const campaign = initializeCampaign("a");
    for (const dungeon of campaign.dungeons.slice(0, 5)) {
      const theme = THEMES.find((candidate) => candidate.id === dungeon.theme)!;
      const map = generateDungeonMap({
        campaignSeed: "a", dungeonId: dungeon.id,
        initialRiskLevel: dungeon.initialRiskLevel, attempt: 0,
      });
      const call = () => prepareExpeditionEvents({
        campaignSeed: "a", dungeonId: dungeon.id,
        initialRiskLevel: dungeon.initialRiskLevel, riskLevel: dungeon.riskLevel,
        attempt: 0, map, theme,
        activeRuleIds: dungeon.activeRuleIds,
        activeMonsterIds: dungeon.activeMonsterIds,
      });
      expect([...call().nodePlans.values()]).toEqual([...call().nodePlans.values()]);
    }
  });
});

describe("사건 조우 종", () => {
  it("모든 생태 패키지가 monster 사건을 받는다", () => {
    const empty: string[] = [];

    for (const seed of SEEDS) {
      const campaign = initializeCampaign(seed);
      for (const dungeon of campaign.dungeons) {
        const theme = THEMES.find((candidate) => candidate.id === dungeon.theme)!;
        const map = generateDungeonMap({
          campaignSeed: seed,
          dungeonId: dungeon.id,
          initialRiskLevel: dungeon.initialRiskLevel,
          attempt: 0,
        });
        let prepared;
        try {
          prepared = prepareExpeditionEvents({
            campaignSeed: seed, dungeonId: dungeon.id,
            initialRiskLevel: dungeon.initialRiskLevel, riskLevel: dungeon.riskLevel,
            attempt: 0, map, theme,
            activeRuleIds: dungeon.activeRuleIds,
            activeMonsterIds: dungeon.activeMonsterIds,
          });
        } catch {
          continue; /* 준비 실패는 별개 문제다. 여기서는 공급만 본다. */
        }

        const planned = [...prepared.nodePlans.values()].filter((plan) => plan.category === "monster").length;
        if (planned === 0) continue;

        let got = 0;
        let state = prepared;
        for (const node of map.nodes) {
          if (node.kind !== "normal") continue;
          try {
            const result = materializeNodeEvent({
              prepared: state, nodeId: node.id, campaignSeed: seed, dungeonId: dungeon.id,
              attempt: 0, theme,
              activeRuleIds: dungeon.activeRuleIds,
              activeMonsterIds: dungeon.activeMonsterIds,
            });
            state = result.state;
            if (result.event.kind === "monster") got += 1;
          } catch { /* 선행 단서 미보유 등 규칙이 옳게 거부하는 경우다. */ }
        }
        if (got === 0) empty.push(`${seed}/${dungeon.id}(${dungeon.ecologyProfileId})`);
      }
    }

    expect(empty).toEqual([]);
  });

  it("물질화한 사건의 조우 종이 전부 그 던전에 사는 몹이다", () => {
    const strangers: string[] = [];
    const campaign = initializeCampaign("s1");

    for (const dungeon of campaign.dungeons) {
      const theme = THEMES.find((candidate) => candidate.id === dungeon.theme)!;
      const map = generateDungeonMap({
        campaignSeed: "s1", dungeonId: dungeon.id,
        initialRiskLevel: dungeon.initialRiskLevel, attempt: 0,
      });
      let state;
      try {
        state = prepareExpeditionEvents({
          campaignSeed: "s1", dungeonId: dungeon.id,
          initialRiskLevel: dungeon.initialRiskLevel, riskLevel: dungeon.riskLevel,
          attempt: 0, map, theme,
          activeRuleIds: dungeon.activeRuleIds,
          activeMonsterIds: dungeon.activeMonsterIds,
        });
      } catch { continue; }

      const active = new Set<string>(dungeon.activeMonsterIds);
      for (const node of map.nodes) {
        if (node.kind !== "normal") continue;
        try {
          const result = materializeNodeEvent({
            prepared: state, nodeId: node.id, campaignSeed: "s1", dungeonId: dungeon.id,
            attempt: 0, theme,
            activeRuleIds: dungeon.activeRuleIds,
            activeMonsterIds: dungeon.activeMonsterIds,
          });
          state = result.state;
          const enemies = result.event.kind === "merchant" ? [] : (result.event.encounter?.enemies ?? []);
          for (const enemy of enemies) {
            if (!active.has(enemy.monsterId)) strangers.push(`${dungeon.id} ${result.event.id} → ${enemy.monsterId}`);
          }
        } catch { /* 위와 같다. */ }
      }
    }

    expect(strangers).toEqual([]);
  });
});
