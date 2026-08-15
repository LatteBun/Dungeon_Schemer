import { BOSSES } from "@/lib/content/bosses";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { INFO_CARDS } from "@/lib/content/info-cards";
import { ITEMS } from "@/lib/content/items";
import { GRADES, RuleError } from "@/lib/domain";
import type {
  BoardOffer,
  CampaignEndingId,
  CampaignState,
  CardId,
  ChoiceId,
  Grade,
  NodeId,
} from "@/lib/domain";
import {
  affordableChoiceIds,
  createCampaignMachineContext,
  transitionCampaign,
} from "@/lib/flow/campaign-machine";
import type { CampaignMachineContext } from "@/lib/flow/campaign-machine";
import { generateBoard } from "@/lib/rules/board";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { calculatePromotionScore } from "@/lib/rules/promotion";
import { simulateBaseline } from "@/lib/backtest/fixtures";
import type { BaselineReport } from "@/lib/backtest/fixtures";

export const STRATEGY_NAMES = ["survivalFirst", "balanced", "wipeGoldFirst"] as const;
export type StrategyName = (typeof STRATEGY_NAMES)[number];

/**
 * 전략은 후보 중 하나를 고르기만 한다. 상태를 직접 바꾸지 않으며 모든 변화는
 * `transitionCampaign` action을 통한다.
 */
export interface Strategy {
  readonly name: StrategyName;
  chooseOffer(state: CampaignState, offers: readonly BoardOffer[]): BoardOffer | null;
  chooseNode(state: CampaignState, candidates: readonly NodeId[]): NodeId;
  chooseCard(state: CampaignState, cardIds: readonly CardId[]): CardId;
  chooseChoice(state: CampaignState, choiceIds: readonly ChoiceId[]): ChoiceId;
}

export interface SimulationReport {
  readonly seed: string;
  readonly strategy: StrategyName;
  readonly expeditions: number;
  readonly clears: number;
  readonly wipes: number;
  readonly gradeRises: number;
  readonly bossDeaths: number;
  readonly finalRank: Grade;
  readonly ending: CampaignEndingId | null;
  readonly currentReputation: number;
  readonly currentGold: number;
  readonly cumulativeGold: number;
  readonly promotionScore: number;
  /** 등급별 최초 도달 원정 번호. 도달하지 못하면 없다. */
  readonly firstReached: Partial<Record<Exclude<Grade, "C">, number>>;
  readonly averageHp: number;
  readonly averageTrust: number;
  /** 보스방 도착 시 파티 평균 HP를 등급별로 모은 것. */
  readonly bossEntryHpByGrade: Partial<Record<Grade, number[]>>;
  readonly cardUsage: Readonly<Record<string, number>>;
  /** 시작하자마자 아무 공고도 지원할 수 없었는가. */
  readonly unplayable: boolean;
  readonly generationError: string | null;
}

export interface BacktestReport {
  readonly seedCount: number;
  readonly generationErrors: string[];
  readonly unplayableSeeds: string[];
  readonly byStrategy: Readonly<Record<StrategyName, StrategySummary>>;
  readonly baseline: BaselineReport;
}

export interface StrategySummary {
  readonly campaigns: number;
  readonly endingRates: Readonly<Record<CampaignEndingId | "none", number>>;
  readonly reachRates: Readonly<Record<Exclude<Grade, "C">, number>>;
  readonly medianFirstReached: Partial<Record<Exclude<Grade, "C">, number>>;
  readonly averageExpeditions: number;
  readonly averageClears: number;
  readonly averageWipes: number;
  readonly averageGradeRises: number;
  readonly averageFinalScore: number;
  readonly averageHp: number;
  readonly averageTrust: number;
  /** 첫 전멸 뒤 지원 불가로 끝난 비율. C3이 남긴 명성 음수 절벽을 잰다. */
  readonly wipeThenSupportUnavailableRate: number;
  readonly averageBossEntryHp: Partial<Record<Grade, number>>;
  readonly cardExposure: {
    readonly distinct: number;
    readonly most: { id: string; count: number } | null;
    readonly least: { id: string; count: number } | null;
  };
}

const CONTEXT: CampaignMachineContext = createCampaignMachineContext({
  events: DUNGEON_EVENT_POOLS,
  cards: INFO_CARDS,
  items: ITEMS,
  bosses: BOSSES,
});

const CARD_BY_ID = new Map(INFO_CARDS.map((card) => [card.id as string, card]));
const GRADE_INDEX: Readonly<Record<Grade, number>> = { C: 0, B: 1, A: 2, S: 3 };

function truthRank(cardId: CardId, order: readonly string[]): number {
  const card = CARD_BY_ID.get(cardId as string);
  const index = card === undefined ? -1 : order.indexOf(card.truthType);
  return index < 0 ? order.length : index;
}

/** 후보 카드 중 선호하는 진위가 앞선 것을 고른다. */
function pickCard(cardIds: readonly CardId[], order: readonly string[]): CardId {
  return [...cardIds].sort((left, right) =>
    truthRank(left, order) - truthRank(right, order))[0];
}

/** 후보 선택지 중 선호 태그를 가진 첫 번째. 없으면 첫 후보. */
function pickChoice(
  state: CampaignState,
  choiceIds: readonly ChoiceId[],
  preferred: readonly string[],
): ChoiceId {
  const pending = state.expedition?.pendingEvent;
  const event = pending === null || pending === undefined
    ? undefined
    : CONTEXT.eventById.get(pending.eventId as string);
  if (event === undefined) return choiceIds[0];

  for (const tag of preferred) {
    const found = event.choices.find(
      (choice) => choiceIds.includes(choice.id) && choice.effectTags.includes(tag as never),
    );
    if (found !== undefined) return found.id;
  }
  return choiceIds[0];
}

function partyCarriedGold(state: CampaignState, offer: BoardOffer): number {
  const party = state.parties.find((entry) => entry.id === offer.partyId);
  if (party === undefined) return 0;
  return party.memberIds.reduce((sum, id) => {
    const member = state.members.find((entry) => entry.id === id);
    return sum + (member?.carriedGold ?? 0);
  }, 0);
}

function gradeOf(state: CampaignState, offer: BoardOffer): Grade {
  return state.dungeons.find((entry) => entry.id === offer.dungeonId)?.grade ?? "C";
}

export const STRATEGIES: Readonly<Record<StrategyName, Strategy>> = {
  // 파티를 살려서 계약 보상을 쌓는다. 낮은 등급, 진실, 지원.
  survivalFirst: {
    name: "survivalFirst",
    chooseOffer: (state, offers) => [...offers]
      .sort((left, right) => GRADE_INDEX[gradeOf(state, left)] - GRADE_INDEX[gradeOf(state, right)])
      .at(0) ?? null,
    chooseNode: (_state, candidates) => candidates[0],
    chooseCard: (_state, cardIds) => pickCard(cardIds, ["truth", "neutral", "lie"]),
    chooseChoice: (state, choiceIds) =>
      pickChoice(state, choiceIds, ["support", "rest", "item", "information", "observe"]),
  },

  // 지원 가능한 가장 높은 등급을 고르고 개입은 최소로 한다.
  balanced: {
    name: "balanced",
    chooseOffer: (state, offers) => [...offers]
      .sort((left, right) => GRADE_INDEX[gradeOf(state, right)] - GRADE_INDEX[gradeOf(state, left)])
      .at(0) ?? null,
    chooseNode: (_state, candidates) => candidates[candidates.length - 1],
    chooseCard: (_state, cardIds) => pickCard(cardIds, ["neutral", "truth", "lie"]),
    chooseChoice: (state, choiceIds) =>
      pickChoice(state, choiceIds, ["observe", "information", "trade", "support"]),
  },

  // 파티를 죽여 유품을 챙긴다. 소지 골드가 많은 파티, 거짓, 방해.
  wipeGoldFirst: {
    name: "wipeGoldFirst",
    chooseOffer: (state, offers) => [...offers]
      .sort((left, right) => partyCarriedGold(state, right) - partyCarriedGold(state, left))
      .at(0) ?? null,
    chooseNode: (_state, candidates) => candidates[0],
    chooseCard: (_state, cardIds) => pickCard(cardIds, ["lie", "neutral", "truth"]),
    chooseChoice: (state, choiceIds) =>
      pickChoice(state, choiceIds, ["sabotage", "observe", "information", "support"]),
  },
};

interface Tally {
  expeditions: number;
  clears: number;
  wipes: number;
  gradeRises: number;
  bossDeaths: number;
  firstReached: Partial<Record<Exclude<Grade, "C">, number>>;
  bossEntryHpByGrade: Partial<Record<Grade, number[]>>;
  cardUsage: Record<string, number>;
}

function averageHp(state: CampaignState): number {
  const alive = state.members.filter((member) => member.alive);
  if (alive.length === 0) return 0;
  return alive.reduce((sum, member) => sum + member.currentHp, 0) / alive.length;
}

function averageTrust(state: CampaignState): number {
  const alive = state.members.filter((member) => member.alive);
  if (alive.length === 0) return 0;
  return alive.reduce((sum, member) => sum + member.trust, 0) / alive.length;
}

function partyHp(state: CampaignState): number {
  const expedition = state.expedition;
  if (expedition === null) return 0;
  const party = state.parties.find((entry) => entry.id === expedition.partyId);
  if (party === undefined) return 0;
  const members = party.memberIds
    .map((id) => state.members.find((entry) => entry.id === id))
    .filter((member) => member?.alive === true);
  if (members.length === 0) return 0;
  return members.reduce((sum, member) => sum + (member?.currentHp ?? 0), 0) / members.length;
}

/**
 * 한 캠페인을 끝까지 돌린다.
 *
 * 전략은 후보를 고르기만 하고 모든 상태 변화는 `transitionCampaign`을 지난다.
 * 시뮬레이터가 규칙을 흉내 내면 백테스트가 실제 게임이 아닌 것을 재게 된다.
 */
export function simulateCampaign(
  seed: string,
  strategyName: StrategyName,
): SimulationReport {
  const strategy = STRATEGIES[strategyName];
  const tally: Tally = {
    expeditions: 0,
    clears: 0,
    wipes: 0,
    gradeRises: 0,
    bossDeaths: 0,
    firstReached: {},
    bossEntryHpByGrade: {},
    cardUsage: {},
  };

  let state: CampaignState;
  try {
    const initial = initializeCampaign(seed);
    state = { ...initial, board: generateBoard(initial) };
  } catch (error) {
    return failedReport(seed, strategyName, tally, error);
  }

  const openOffers = state.board.filter((offer) => !offer.locked);
  const unplayable = openOffers.length === 0;

  // 한 캠페인은 던전 15개이고 전멸은 던전을 남기므로 상한을 넉넉히 둔다.
  const maxSteps = 20_000;
  let steps = 0;

  try {
    while (state.phase !== "ended" && steps < maxSteps) {
      steps += 1;

      if (state.phase === "board") {
        const available = state.board.filter((offer) => !offer.locked);
        const offer = strategy.chooseOffer(state, available);
        if (offer === null || available.length === 0) break;
        tally.expeditions += 1;
        state = transitionCampaign(state, { type: "acceptContract", offerId: offer.id }, CONTEXT);
        continue;
      }

      if (state.phase === "map") {
        const current = state.expedition!.map.nodes.find(
          (node) => node.id === state.expedition!.currentNodeId,
        )!;
        const nodeId = strategy.chooseNode(state, current.nextNodeIds);
        state = transitionCampaign(state, { type: "selectNode", nodeId }, CONTEXT);
        continue;
      }

      if (state.phase === "infoOpportunity") {
        const cardIds = state.expedition!.pendingInfo!.cardIds;
        const cardId = strategy.chooseCard(state, cardIds);
        tally.cardUsage[cardId as string] = (tally.cardUsage[cardId as string] ?? 0) + 1;
        state = transitionCampaign(state, { type: "chooseInfoCard", cardId }, CONTEXT);
        continue;
      }

      if (state.phase === "event") {
        const choiceIds = affordableChoiceIds(state, CONTEXT);
        const choiceId = strategy.chooseChoice(state, choiceIds);
        state = transitionCampaign(state, { type: "chooseEvent", choiceId }, CONTEXT);
        continue;
      }

      if (state.phase === "boss") {
        const grade = state.dungeons.find(
          (entry) => entry.id === state.expedition!.dungeonId,
        )!.grade;
        tally.bossEntryHpByGrade[grade] = [
          ...(tally.bossEntryHpByGrade[grade] ?? []),
          partyHp(state),
        ];
        const before = state.members.filter((member) => member.alive).length;
        state = transitionCampaign(state, { type: "resolveBoss" }, CONTEXT);
        tally.bossDeaths += before - state.members.filter((member) => member.alive).length;
        continue;
      }

      if (state.phase === "settlement") {
        const rankBefore = state.rank;
        const failed = state.expedition!.result!.status === "failed";
        state = transitionCampaign(state, { type: "applySettlement" }, CONTEXT);
        if (failed) tally.wipes += 1;
        else tally.clears += 1;
        if (state.rank !== rankBefore) {
          tally.gradeRises += 1;
          for (const grade of GRADES) {
            if (grade === "C") continue;
            if (GRADE_INDEX[state.rank] >= GRADE_INDEX[grade]
              && tally.firstReached[grade] === undefined) {
              tally.firstReached[grade] = tally.expeditions;
            }
          }
        }
        continue;
      }

      break;
    }
  } catch (error) {
    return failedReport(seed, strategyName, tally, error, state);
  }

  return {
    seed,
    strategy: strategyName,
    expeditions: tally.expeditions,
    clears: tally.clears,
    wipes: tally.wipes,
    gradeRises: tally.gradeRises,
    bossDeaths: tally.bossDeaths,
    finalRank: state.rank,
    ending: state.ending?.id ?? null,
    currentReputation: state.currentReputation,
    currentGold: state.currentGold,
    cumulativeGold: state.cumulativeGold,
    promotionScore: calculatePromotionScore(state.currentReputation, state.cumulativeGold),
    firstReached: tally.firstReached,
    averageHp: averageHp(state),
    averageTrust: averageTrust(state),
    bossEntryHpByGrade: tally.bossEntryHpByGrade,
    cardUsage: tally.cardUsage,
    unplayable,
    generationError: null,
  };
}

function failedReport(
  seed: string,
  strategy: StrategyName,
  tally: Tally,
  error: unknown,
  state?: CampaignState,
): SimulationReport {
  const message = error instanceof RuleError
    ? `${error.code}: ${error.message}`
    : String(error);
  return {
    seed,
    strategy,
    expeditions: tally.expeditions,
    clears: tally.clears,
    wipes: tally.wipes,
    gradeRises: tally.gradeRises,
    bossDeaths: tally.bossDeaths,
    finalRank: state?.rank ?? "C",
    ending: state?.ending?.id ?? null,
    currentReputation: state?.currentReputation ?? 0,
    currentGold: state?.currentGold ?? 0,
    cumulativeGold: state?.cumulativeGold ?? 0,
    promotionScore: 0,
    firstReached: tally.firstReached,
    averageHp: 0,
    averageTrust: 0,
    bossEntryHpByGrade: tally.bossEntryHpByGrade,
    cardUsage: tally.cardUsage,
    unplayable: false,
    generationError: message,
  };
}

export function simulateFixture(name: "baseline"): BaselineReport {
  if (name !== "baseline") throw new Error(`알 수 없는 fixture다: ${name}`);
  return simulateBaseline();
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function summarize(reports: readonly SimulationReport[]): StrategySummary {
  const total = Math.max(1, reports.length);
  const endingRates = { distrust: 0, expeditionComplete: 0, supportUnavailable: 0, partyExhausted: 0, none: 0 };
  for (const report of reports) {
    endingRates[report.ending ?? "none"] += 1 / total;
  }

  const reachRates = { B: 0, A: 0, S: 0 };
  const medianFirstReached: Partial<Record<Exclude<Grade, "C">, number>> = {};
  for (const grade of ["B", "A", "S"] as const) {
    const reached = reports.filter((report) => report.firstReached[grade] !== undefined);
    reachRates[grade] = reached.length / total;
    medianFirstReached[grade] = median(
      reached.map((report) => report.firstReached[grade]!),
    );
  }

  const averageBossEntryHp: Partial<Record<Grade, number>> = {};
  for (const grade of GRADES) {
    const samples = reports.flatMap((report) => report.bossEntryHpByGrade[grade] ?? []);
    if (samples.length > 0) averageBossEntryHp[grade] = mean(samples);
  }

  const usage = new Map<string, number>();
  for (const report of reports) {
    for (const [cardId, count] of Object.entries(report.cardUsage)) {
      usage.set(cardId, (usage.get(cardId) ?? 0) + count);
    }
  }
  const sortedUsage = [...usage.entries()].sort((left, right) => right[1] - left[1]);

  return {
    campaigns: reports.length,
    endingRates,
    reachRates,
    medianFirstReached,
    averageExpeditions: mean(reports.map((report) => report.expeditions)),
    averageClears: mean(reports.map((report) => report.clears)),
    averageWipes: mean(reports.map((report) => report.wipes)),
    averageGradeRises: mean(reports.map((report) => report.gradeRises)),
    averageFinalScore: mean(reports.map((report) => report.promotionScore)),
    averageHp: mean(reports.map((report) => report.averageHp)),
    averageTrust: mean(reports.map((report) => report.averageTrust)),
    // C3이 남긴 명성 음수 절벽. 전멸을 겪은 캠페인이 지원 불가로 끝난 비율이다.
    wipeThenSupportUnavailableRate: reports.filter(
      (report) => report.wipes > 0 && report.ending === "supportUnavailable",
    ).length / total,
    averageBossEntryHp,
    cardExposure: {
      distinct: sortedUsage.length,
      most: sortedUsage.at(0) === undefined
        ? null
        : { id: sortedUsage[0][0], count: sortedUsage[0][1] },
      least: sortedUsage.at(-1) === undefined
        ? null
        : { id: sortedUsage[sortedUsage.length - 1][0], count: sortedUsage[sortedUsage.length - 1][1] },
    },
  };
}

/**
 * 시드마다 세 전략을 모두 돌리고 보고서를 만든다.
 *
 * 합격·불합격을 판정하지 않는다. 강제하는 것은 생성 오류 0건과 시작 즉시 진행
 * 불가 시드 0건뿐이고 나머지는 밸런스 조정 자료다.
 */
export function runBacktest(
  options: { seedCount?: number; seedPrefix?: string } = {},
): BacktestReport {
  const seedCount = options.seedCount ?? 10_000;
  const prefix = options.seedPrefix ?? "campaign";
  const generationErrors: string[] = [];
  const unplayableSeeds: string[] = [];
  const byStrategy: Record<StrategyName, SimulationReport[]> = {
    survivalFirst: [],
    balanced: [],
    wipeGoldFirst: [],
  };

  for (let index = 0; index < seedCount; index += 1) {
    const seed = `${prefix}-${index}`;
    for (const name of STRATEGY_NAMES) {
      const report = simulateCampaign(seed, name);
      byStrategy[name].push(report);
      if (report.generationError !== null) {
        generationErrors.push(`${seed}/${name}: ${report.generationError}`);
      }
      if (report.unplayable) unplayableSeeds.push(`${seed}/${name}`);
    }
  }

  return {
    seedCount,
    generationErrors,
    unplayableSeeds,
    byStrategy: {
      survivalFirst: summarize(byStrategy.survivalFirst),
      balanced: summarize(byStrategy.balanced),
      wipeGoldFirst: summarize(byStrategy.wipeGoldFirst),
    },
    baseline: simulateBaseline(),
  };
}
