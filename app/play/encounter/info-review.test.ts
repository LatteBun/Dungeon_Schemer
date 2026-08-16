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
import { initializeCampaign } from "@/lib/rules/campaign-init";
import type { CampaignState } from "@/lib/domain";
import { prepareInfoCardReview } from "./info-review";

const CONTEXT = createCampaignMachineContext({
  events: DUNGEON_EVENT_POOLS,
  cards: INFO_CARDS,
  items: ITEMS,
  bosses: BOSSES,
});

function stateAtInfoOpportunity(seed: string): CampaignState {
  let state = initializeCampaign(seed);
  const offer = state.board.find((candidate) => !candidate.locked)!;
  state = transitionCampaign(
    state,
    { type: "acceptContract", offerId: offer.id },
    CONTEXT,
  );

  for (let guard = 0; state.phase !== "infoOpportunity"; guard += 1) {
    if (guard > 100) throw new Error("정보 전달 단계에 닿지 않는다");
    const expedition = state.expedition!;

    if (state.phase === "map") {
      const current = expedition.map.nodes.find(
        (node) => node.id === expedition.currentNodeId,
      )!;
      state = transitionCampaign(
        state,
        { type: "selectNode", nodeId: current.nextNodeIds[0] },
        CONTEXT,
      );
    } else if (state.phase === "event") {
      const choiceId =
        affordableChoiceIds(state, CONTEXT)[0] ?? expedition.pendingEvent!.choiceIds[0];
      state = transitionCampaign(
        state,
        { type: "chooseEvent", choiceId },
        CONTEXT,
      );
    } else {
      throw new Error(`정보 전달 전 예상 밖 단계: ${state.phase}`);
    }
  }

  return state;
}

describe("prepareInfoCardReview", () => {
  it("카드 선택은 상태를 유지하며 실제 전이와 같은 개인 반응을 준비한다", () => {
    const before = stateAtInfoOpportunity("i1-info-review");
    const snapshot = structuredClone(before);
    const cardId = before.expedition!.pendingInfo!.cardIds[0];

    const review = prepareInfoCardReview(before, cardId, CONTEXT);

    expect(before).toEqual(snapshot);
    expect(before.phase).toBe("infoOpportunity");
    expect(review.selectedCardId).toBe(cardId);
    expect(review.reactions.length).toBeGreaterThan(0);

    const after = transitionCampaign(
      before,
      { type: "chooseInfoCard", cardId },
      CONTEXT,
    );
    const newRecords = after.expedition!.infoRecords.slice(
      before.expedition!.infoRecords.length,
    );

    expect(after.phase).toBe("event");
    for (const reaction of review.reactions) {
      const memberBefore = before.members.find(
        (member) => member.id === reaction.memberId,
      )!;
      const memberAfter = after.members.find(
        (member) => member.id === reaction.memberId,
      )!;
      const record = newRecords.find(
        (candidate) => candidate.memberId === reaction.memberId,
      )!;
      expect(reaction.reaction).toBe(record.reaction);
      expect(reaction.trust).toBe(memberAfter.trust);
      expect(reaction.trustDelta).toBe(memberAfter.trust - memberBefore.trust);
    }
  });
});
