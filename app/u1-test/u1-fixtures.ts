import { generateBoard } from "@/lib/rules/board";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import type { CampaignState } from "@/lib/domain";

/** 초기 상황: 등급 C·명성 0. 게시판은 C 공고로 채워져 전부 지원 가능(잠금 데모는 mid fixture). */
export function initialBoardState(): CampaignState {
  const base = initializeCampaign("u1-demo-initial");
  return { ...base, board: generateBoard(base) };
}

/**
 * 중반 상황: 등급 B·명성 38·던전 6개 클리어·던전 1개는 실패 횟수 표시,
 * 첫 파티 인물 상태를 다양하게 바꿔 계약 패널을 확인한다.
 */
export function midCampaignState(): CampaignState {
  const base = initializeCampaign("u1-demo-mid");

  const dungeons = base.dungeons.map((dungeon, index) => {
    if (index < 6) {
      return { ...dungeon, status: "cleared" as const };
    }
    if (index === 6) {
      return {
        ...dungeon,
        failureCount: 1,
      };
    }
    return dungeon;
  });

  const firstPartyMemberIds = new Set(
    base.parties.find((party) => party.complete)?.memberIds ?? [],
  );
  const memberOverrides = [
    { trust: 72, currentHp: 88, carriedGold: 18 },
    { trust: 54, currentHp: 100, carriedGold: 26 },
    { trust: 57, currentHp: 64, carriedGold: 11 },
  ];
  let overrideIndex = 0;
  const members = base.members.map((member) => {
    if (!firstPartyMemberIds.has(member.id) || overrideIndex >= memberOverrides.length) {
      return member;
    }
    const override = memberOverrides[overrideIndex];
    overrideIndex += 1;
    const memory =
      overrideIndex === 1
        ? [{ at: 1, kind: "settlement" as const, summary: "지난 정산에서 신뢰가 올랐다" }]
        : member.memory;
    return { ...member, ...override, memory };
  });

  const mid: CampaignState = {
    ...base,
    rank: "B",
    currentReputation: 38,
    currentGold: 36,
    cumulativeGold: 60,
    dungeons,
    members,
  };

  return { ...mid, board: generateBoard(mid) };
}
