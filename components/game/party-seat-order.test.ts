import { describe, expect, it } from "vitest";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { createBoardOffers } from "@/lib/rules/board";
import { createU3BoardView } from "./u3-board-model";
import { inSeatOrder } from "./party-seat-order";

const idOf = (value: string) => value;

/*
 * 파티원이 앉는 차례.
 *
 * `C1` 은 파티를 직업 조합으로 짜고 그 조합은 클래스가 풀에 처음 나온 차례를
 * 따른다. 그대로 두면 한 캠페인 안에서 01 번 자리가 늘 같은 직업이라, 길잡이가
 * 이름을 읽지 않고 자리로 사람을 센다.
 */
describe("파티원 앉는 차례", () => {
  const seeds = Array.from({ length: 16 }, (_, index) => `seat-${index}`);

  it("같은 사람은 어느 화면에서 불러도 같은 자리에 앉는다", () => {
    // 게시판과 지도가 다른 차례를 보이면 같은 파티를 다른 파티로 읽는다.
    for (const seed of seeds.slice(0, 4)) {
      const campaign = initializeCampaign(seed);
      const ids = createBoardOffers(campaign)[0]!.party.memberIds.map(String);
      expect(inSeatOrder(seed, ids, idOf)).toEqual(inSeatOrder(seed, [...ids].reverse(), idOf));
    }
  });

  it("사람을 빠뜨리거나 더하지 않는다", () => {
    const campaign = initializeCampaign("seat-0");
    const ids = createBoardOffers(campaign)[0]!.party.memberIds.map(String);
    expect([...inSeatOrder("seat-0", ids, idOf)].sort()).toEqual([...ids].sort());
  });

  it("규칙이 준 차례를 그대로 쓰지 않는다", () => {
    /* 한 시드가 우연히 제자리일 수 있으므로 여러 시드를 본다. */
    const changed = seeds.filter((seed) => {
      const campaign = initializeCampaign(seed);
      return createBoardOffers(campaign).some((offer) => {
        const ids = offer.party.memberIds.map(String);
        return inSeatOrder(seed, ids, idOf).join("|") !== ids.join("|");
      });
    });
    expect(changed.length).toBeGreaterThan(0);
  });

  it("한 캠페인 안에서 직업이 늘 같은 자리에 앉지는 않는다", () => {
    /*
     * 이 변경의 목적이다. 고치기 전에는 20 캠페인 100 공고가 모두 같은 직업
     * 차례였다. 공고가 여럿인 캠페인에서 차례가 하나로 굳지 않아야 한다.
     */
    const varied = seeds.filter((seed) => {
      const campaign = initializeCampaign(seed);
      const board = createU3BoardView(campaign, createBoardOffers(campaign));
      const orders = new Set(
        Object.values(board.detailsByOfferId).map((detail) =>
          detail.party.map((one) => one.classLabel).join("|")),
      );
      return orders.size > 1;
    });

    expect(varied.length).toBeGreaterThan(0);
  });
});
