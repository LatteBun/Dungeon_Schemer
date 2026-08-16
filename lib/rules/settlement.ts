import { CAMPAIGN_GRADE_CONFIG } from "@/lib/content/dungeons";
import { GRADES, RuleError } from "@/lib/domain";
import type {
  CampaignDungeon,
  CampaignEnding,
  CampaignMember,
  CampaignState,
  ExpeditionRecord,
  ExpeditionResult,
  ExpeditionState,
  Grade,
  MemberId,
  SettlementStep,
  SettlementStepKind,
} from "@/lib/domain";
import type { Rng } from "@/lib/rng";
import { generateBoard } from "@/lib/rules/board";
import { resolveEnding } from "@/lib/rules/ending";
import { maintainPartiesAfterExpedition } from "@/lib/rules/party-lifecycle";
import { calculatePromotionScore, promote } from "@/lib/rules/promotion";
import { recordExpedition, summarizeExpeditionCards } from "@/lib/rules/statistics";

/** 타입은 도메인으로 옮겼다. 기존 import 경로를 깨지 않기 위해 다시 내보낸다. */
export type { SettlementStep, SettlementStepKind };

export interface SettleExpeditionInput {
  readonly state: CampaignState;
  readonly expedition: ExpeditionState;
  readonly rng: Rng;
}

export interface SettlementResult {
  readonly state: CampaignState;
  readonly steps: SettlementStep[];
}

/**
 * 정산이 남기는 원인 사슬의 순서다.
 *
 * 상위 plan이 정한 처리 순서와 같다. 승급이 파티 처리보다 앞서는 이유는 승급
 * 점수가 명성과 누적 골드만 쓰기 때문인데, 나중에 승급이 파티를 참조하게 될 때
 * 결과가 갈리지 않도록 순서를 고정한다.
 * docs/superpowers/specs/2026-08-15-sbh3821-settlement-promotion-ending-design.md
 */
export const SETTLEMENT_STEP_ORDER = [
  "survival",
  "reward",
  "dungeon",
  "promotion",
  "party",
  "ending",
] as const satisfies readonly SettlementStepKind[];

/** 생존 인원별 클리어 보상 비율. 소수점은 버린다. */
export const CLEAR_REWARD_RATIO: Readonly<Record<number, number>> = {
  3: 1,
  2: 0.6,
  1: 0.3,
};

function nextGradeAfterFailure(grade: Grade): Grade {
  return GRADES[Math.min(GRADES.indexOf(grade) + 1, GRADES.length - 1)];
}

function assertSettleable(
  state: CampaignState,
  expedition: ExpeditionState,
): { result: ExpeditionResult; dungeon: CampaignDungeon } {
  const { result } = expedition;
  if (result === null) {
    throw new RuleError(
      "INVALID_SETTLEMENT",
      "결과가 없는 원정은 정산할 수 없다.",
      { dungeonId: expedition.dungeonId, partyId: expedition.partyId },
    );
  }

  const dungeon = state.dungeons.find((entry) => entry.id === expedition.dungeonId);
  if (dungeon === undefined) {
    throw new RuleError(
      "UNKNOWN_ID",
      `캠페인에 없는 던전이다: ${expedition.dungeonId}`,
      { dungeonId: expedition.dungeonId },
    );
  }

  const cleared = result.survivorIds.length > 0;
  if (cleared !== (result.status === "cleared")) {
    throw new RuleError(
      "INVALID_SETTLEMENT",
      `생존자 수와 결과 상태가 어긋난다: ${result.status}에 생존 ${result.survivorIds.length}명`,
      { status: result.status, survivors: result.survivorIds.length },
    );
  }

  return { result, dungeon };
}

interface Payout {
  readonly reputation: number;
  readonly gold: number;
  /** 전멸에서 회수한 유품. 현재 골드와 누적 골드에 함께 더한다. */
  readonly loot: number;
  readonly lootedIds: ReadonlySet<string>;
}

/**
 * 보상과 손실을 계산한다.
 *
 * 부분 생존 클리어에서 사망자의 소지 골드를 얻지 않는 것이 핵심이다. 시체를
 * 뒤지는 것은 전멸했을 때만 하는 일이다.
 * docs/systems/PROGRESSION_AND_ENDINGS.md
 */
function calculatePayout(
  state: CampaignState,
  result: ExpeditionResult,
  dungeon: CampaignDungeon,
): Payout {
  const config = CAMPAIGN_GRADE_CONFIG[dungeon.grade];

  if (result.status === "failed") {
    const casualties = new Set<string>(result.casualtyIds);
    const loot = state.members
      .filter((member) => casualties.has(member.id))
      .reduce((sum, member) => sum + member.carriedGold, 0);
    // 생존 비율을 적용하지 않고 3명 생존 기본 명성을 그대로 뺀다.
    return {
      reputation: -config.baseReputationReward,
      gold: 0,
      loot,
      lootedIds: casualties,
    };
  }

  const ratio = CLEAR_REWARD_RATIO[result.survivorIds.length] ?? 0;
  return {
    reputation: Math.floor(config.baseReputationReward * ratio),
    gold: Math.floor(config.baseGoldReward * ratio),
    loot: 0,
    lootedIds: new Set(),
  };
}

function lootMembers(
  members: readonly CampaignMember[],
  lootedIds: ReadonlySet<string>,
): CampaignMember[] {
  // 유품을 회수한 뒤 0으로 만든다. 길잡이가 실제로 가져갔고, 나중에 어떤 규칙이
  // 죽은 인물의 소지 골드를 다시 읽어도 두 번 세지 않는다.
  return members.map((member) =>
    lootedIds.has(member.id) ? { ...member, carriedGold: 0 } : { ...member });
}

function settleDungeon(
  dungeon: CampaignDungeon,
  result: ExpeditionResult,
): CampaignDungeon {
  if (result.status === "cleared") {
    return { ...dungeon, status: "cleared" };
  }
  return {
    ...dungeon,
    grade: nextGradeAfterFailure(dungeon.grade),
    failureCount: dungeon.failureCount + 1,
  };
}

function survivalSummary(result: ExpeditionResult): string {
  return result.status === "cleared"
    ? `생존 ${result.survivorIds.length}명 · 사망 ${result.casualtyIds.length}명으로 클리어`
    : `출전 ${result.casualtyIds.length}명 전멸`;
}

function endingSummary(ending: CampaignEnding | null): string {
  return ending === null ? "다음 공고로 이어진다" : ending.reason;
}

/**
 * 원정 하나의 결과를 캠페인에 반영하고 다음 게시판 또는 엔딩까지 잇는다.
 *
 * `state.members`는 이미 원정 결과가 반영된 상태여야 한다. 정산은 HP를 다시
 * 계산하지 않고 자원·던전·등급·파티만 다룬다.
 */
export function settleExpedition(
  input: SettleExpeditionInput,
): SettlementResult {
  const { result, dungeon } = assertSettleable(input.state, input.expedition);
  const payout = calculatePayout(input.state, result, dungeon);
  const settledDungeon = settleDungeon(dungeon, result);

  const afterPayout: CampaignState = {
    ...input.state,
    currentReputation: input.state.currentReputation + payout.reputation,
    currentGold: input.state.currentGold + payout.gold + payout.loot,
    cumulativeGold: input.state.cumulativeGold + payout.gold + payout.loot,
    dungeons: input.state.dungeons.map((entry) =>
      entry.id === settledDungeon.id ? settledDungeon : { ...entry }),
    members: lootMembers(input.state.members, payout.lootedIds),
  };

  const score = calculatePromotionScore(
    afterPayout.currentReputation,
    afterPayout.cumulativeGold,
  );
  const rank = promote(afterPayout.rank, score);

  const afterParties = maintainPartiesAfterExpedition(
    { ...afterPayout, rank },
    result,
    input.rng,
  );

  // 엔딩은 새 게시판을 봐야 판정할 수 있다. 공고가 모두 잠겼는지는 재편이 끝난
  // 파티로 다시 만든 보드에서만 드러난다.
  const withBoard: CampaignState = {
    ...afterParties,
    board: generateBoard(afterParties),
    expedition: null,
  };
  const ending = resolveEnding(withBoard, result.survivorIds as MemberId[]);

  const steps: SettlementStep[] = [
    { kind: "survival", summary: survivalSummary(result) },
    {
      kind: "reward",
      summary: `명성 ${payout.reputation >= 0 ? "+" : ""}${payout.reputation} · `
        + `골드 +${payout.gold + payout.loot}`
        + (payout.loot > 0 ? ` (유품 ${payout.loot})` : ""),
    },
    {
      kind: "dungeon",
      summary: settledDungeon.status === "cleared"
        ? `${settledDungeon.id} 클리어`
        : `${settledDungeon.id} 등급 ${dungeon.grade}→${settledDungeon.grade}`,
    },
    {
      kind: "promotion",
      summary: rank === afterPayout.rank
        ? `승급 점수 ${score} · 등급 ${rank} 유지`
        : `승급 점수 ${score} · 등급 ${afterPayout.rank}→${rank}`,
    },
    {
      kind: "party",
      summary: `완성 파티 ${withBoard.parties.filter((party) => party.complete).length}팀 · `
        + `공고 ${withBoard.board.length}건`,
    },
    { kind: "ending", summary: endingSummary(ending) },
  ];

  const record: ExpeditionRecord = {
    order: input.state.statistics.expeditions.length + 1,
    dungeonId: dungeon.id,
    // settledDungeon 이 아니라 dungeon 이다. 실패로 등급이 오르기 전 값이어야
    // 연대기가 "어느 등급에 나갔다가 무슨 일을 겪었는지"를 옳게 말한다.
    grade: dungeon.grade,
    partyId: input.expedition.partyId,
    status: result.status,
    survivorCount: result.survivorIds.length,
    casualtyCount: result.casualtyIds.length,
    cards: summarizeExpeditionCards(input.expedition),
    bossDamageTotal: Object.values(
      input.expedition.bossResult?.damageByMember ?? {},
    ).reduce((sum, damage) => sum + damage, 0),
    reputationDelta: payout.reputation,
    goldDelta: payout.gold + payout.loot,
    scoreBefore: calculatePromotionScore(
      input.state.currentReputation,
      input.state.cumulativeGold,
    ),
    scoreAfter: score,
    // promote 이전 값이다.
    rankBefore: input.state.rank,
    rankAfter: rank,
    steps,
  };

  return {
    state: {
      ...withBoard,
      ending,
      phase: ending === null ? "board" : "ended",
      statistics: recordExpedition(input.state.statistics, record),
    },
    steps,
  };
}
