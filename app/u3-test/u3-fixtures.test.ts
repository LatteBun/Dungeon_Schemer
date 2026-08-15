import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/content/bosses";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import {
  affordableChoiceIds,
  createCampaignMachineContext,
  transitionCampaign,
} from "@/lib/flow/campaign-machine";
import { createRng } from "@/lib/rng";
import { resolveBossFight } from "@/lib/rules/boss";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { settleExpedition } from "@/lib/rules/settlement";
import type { CampaignMember, CampaignState, ExpeditionState } from "@/lib/domain";
import { completedCampaignOutcome, runOneExpedition } from "./u3-fixtures";

const CONTEXT = createCampaignMachineContext({
  events: DUNGEON_EVENT_POOLS,
  cards: INFO_CARDS,
  items: ITEMS,
  bosses: BOSSES,
});

function participantsOf(
  state: CampaignState,
  expedition: ExpeditionState,
): CampaignMember[] {
  const party = state.parties.find((candidate) => candidate.id === expedition.partyId)!;
  const memberIds = new Set(party.memberIds.map(String));
  return state.members.filter((member) => memberIds.has(member.id as string));
}

function advanceFixtureRouteToBoss(seed: string): CampaignState {
  let state = transitionCampaign(initializeCampaign(seed), { type: "openBoard" }, CONTEXT);
  const offer = state.board.find((candidate) => !candidate.locked)!;
  state = transitionCampaign(
    state,
    { type: "acceptContract", offerId: offer.id },
    CONTEXT,
  );

  for (let guard = 0; state.phase !== "boss"; guard += 1) {
    if (guard > 100 || state.expedition === null) {
      throw new Error(`보스방 진행 실패: ${seed} · ${state.phase}`);
    }
    const expedition = state.expedition;

    if (state.phase === "map") {
      const current = expedition.map.nodes.find(
        (node) => node.id === expedition.currentNodeId,
      )!;
      state = transitionCampaign(
        state,
        { type: "selectNode", nodeId: current.nextNodeIds[0] },
        CONTEXT,
      );
    } else if (state.phase === "infoOpportunity") {
      state = transitionCampaign(
        state,
        { type: "chooseInfoCard", cardId: expedition.pendingInfo!.cardIds[0] },
        CONTEXT,
      );
    } else if (state.phase === "event") {
      const choiceId =
        affordableChoiceIds(state, CONTEXT)[0] ?? expedition.pendingEvent!.choiceIds[0];
      state = transitionCampaign(state, { type: "chooseEvent", choiceId }, CONTEXT);
    } else {
      throw new Error(`예상 밖 단계: ${state.phase}`);
    }
  }

  return state;
}

describe("completedCampaignOutcome", () => {
  it("완료 상태로 모든 던전을 처리하고 원정 종료 엔딩을 만든다", () => {
    const outcome = completedCampaignOutcome("u3-demo");

    expect(outcome.stateAfter.dungeons).toHaveLength(15);
    expect(outcome.stateAfter.dungeons.every((dungeon) => dungeon.status === "cleared")).toBe(
      true,
    );
    expect(outcome.ending?.id).toBe("expeditionComplete");
    expect(outcome.stateAfter.ending).toEqual(outcome.ending);
    expect(outcome.headerView.remainingDungeons).toBe(0);
  });
});

describe("runOneExpedition", () => {
  it("정확한 원정 RNG 키의 직접 보스·정산 결과가 전이 경로와 같다", () => {
    const seed = "u3-direct-transition-parity";
    const fixture = runOneExpedition(seed);
    const beforeBoss = advanceFixtureRouteToBoss(seed);
    const expedition = beforeBoss.expedition!;
    const dungeon = beforeBoss.dungeons.find(
      (candidate) => candidate.id === expedition.dungeonId,
    )!;
    const boss = CONTEXT.bossByGrade.get(dungeon.grade)!;
    const key = `${beforeBoss.seed}/${dungeon.id}#${dungeon.failureCount}`;
    const directBoss = resolveBossFight({
      boss,
      members: participantsOf(beforeBoss, expedition),
      infoRecords: expedition.infoRecords,
      rng: createRng(key).derive("boss"),
    });

    expect(fixture.bossResolution).toEqual(directBoss);

    const afterBoss = transitionCampaign(beforeBoss, { type: "resolveBoss" }, CONTEXT);
    const bossResult = afterBoss.expedition!.bossResult!;
    expect(bossResult).toEqual({
      survivorIds: directBoss.survivorIds,
      casualtyIds: directBoss.casualtyIds,
      damageByMember: Object.fromEntries(
        directBoss.members.map((entry) => [entry.member.id as string, entry.damage]),
      ),
    });
    const participantIds = new Set(directBoss.members.map((entry) => String(entry.member.id)));
    expect(
      afterBoss.members.filter((member) => participantIds.has(member.id as string)),
    ).toEqual(directBoss.members.map((entry) => entry.member));

    const directSettlement = settleExpedition({
      state: afterBoss,
      expedition: afterBoss.expedition!,
      rng: createRng(key).derive("regroup"),
    });
    const transitionedSettlement = transitionCampaign(
      afterBoss,
      { type: "applySettlement" },
      CONTEXT,
    );

    expect(fixture.steps).toEqual(directSettlement.steps);
    expect(fixture.stateAfter).toEqual(directSettlement.state);
    expect(directSettlement.state).toEqual(transitionedSettlement);
  });
});
