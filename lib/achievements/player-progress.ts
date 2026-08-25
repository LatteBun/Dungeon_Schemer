import { ENDING_ORDER } from "@/lib/domain";
import type { EndingKind, GuideRank } from "@/lib/domain";

export const PLAYER_PROGRESS_VERSION = 1 as const;

export type AchievementId =
  | "first-record"
  | "dungeon-conqueror"
  | "distrust-ending"
  | "denounced-ending"
  | "exhausted-ending"
  | "unemployed-ending"
  | "s-rank-guide"
  | "everyone-returned"
  | "five-endings"
  | "hundred-advices"
  | "seasoned-expedition"
  | "death-in-the-plan";

export interface CompletedCampaignRecord {
  readonly runId: string;
  readonly ending: EndingKind;
  readonly finalRank: GuideRank;
  readonly totalExpeditions: number;
  readonly clearedExpeditions: number;
  readonly wipedExpeditions: number;
  readonly deaths: number;
  readonly advices: number;
}

export interface PlayerProgressV1 {
  readonly version: 1;
  readonly totals: {
    readonly completedCampaigns: number;
    readonly expeditions: number;
    readonly clearedExpeditions: number;
    readonly wipedExpeditions: number;
    readonly deaths: number;
    readonly advices: number;
  };
  readonly endingCounts: Readonly<Record<EndingKind, number>>;
  readonly unlocked: Readonly<Partial<Record<AchievementId, { readonly unlockedAt: string }>>>;
  readonly recordedRunIds: readonly string[];
}

export interface AchievementProgress {
  readonly current: number;
  readonly target: number;
}

export interface AchievementDefinition {
  readonly id: AchievementId;
  readonly title: string;
  readonly description: string;
  readonly category: "result" | "cumulative";
  readonly hiddenWhenLocked: boolean;
  readonly imageSrc: string;
  isUnlocked(progress: PlayerProgressV1, latest: CompletedCampaignRecord): boolean;
  progress?(progress: PlayerProgressV1): AchievementProgress;
}

const isNonNegativeSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

function addSafeCounter(current: number, increment: number, name: string): number {
  if (!isNonNegativeSafeInteger(current) || !isNonNegativeSafeInteger(increment)) {
    throw new TypeError(`${name} must remain a non-negative safe integer`);
  }
  const result = current + increment;
  if (!isNonNegativeSafeInteger(result)) {
    throw new TypeError(`${name} overflowed the safe integer range`);
  }
  return result;
}

function validateRecord(record: CompletedCampaignRecord): void {
  if (record.runId.length === 0) {
    throw new TypeError("runId must not be empty");
  }

  const counters = [
    record.totalExpeditions,
    record.clearedExpeditions,
    record.wipedExpeditions,
    record.deaths,
    record.advices,
  ];
  if (counters.some((value) => !isNonNegativeSafeInteger(value))) {
    throw new TypeError("campaign counters must be non-negative safe integers");
  }
}

export function createEmptyPlayerProgress(): PlayerProgressV1 {
  return {
    version: PLAYER_PROGRESS_VERSION,
    totals: {
      completedCampaigns: 0,
      expeditions: 0,
      clearedExpeditions: 0,
      wipedExpeditions: 0,
      deaths: 0,
      advices: 0,
    },
    endingCounts: Object.fromEntries(ENDING_ORDER.map((kind) => [kind, 0])) as Record<EndingKind, number>,
    unlocked: {},
    recordedRunIds: [],
  };
}

const cumulativeAchievement = (
  id: AchievementId,
  title: string,
  description: string,
  imageSrc: string,
  target: number,
  currentFor: (progress: PlayerProgressV1) => number,
): AchievementDefinition => ({
  id,
  title,
  description,
  category: "cumulative",
  hiddenWhenLocked: true,
  imageSrc,
  isUnlocked: (progress) => currentFor(progress) >= target,
  progress: (progress) => ({ current: currentFor(progress), target }),
});

export const ACHIEVEMENT_CATALOG: readonly AchievementDefinition[] = [
  {
    id: "first-record",
    title: "첫 기록",
    description: "성공 여부와 관계없이 첫 캠페인 결말을 기록한다.",
    category: "result",
    hiddenWhenLocked: true,
    imageSrc: "/assets/achievements/achievement_first_record.png",
    isUnlocked: (progress) => progress.totals.completedCampaigns >= 1,
  },
  {
    id: "dungeon-conqueror",
    title: "던전 정복자",
    description: "15개 던전을 모두 돌파해 원정 완료 엔딩을 맞는다.",
    category: "result",
    hiddenWhenLocked: true,
    imageSrc: "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/achievements/achievement_conquest.png",
    isUnlocked: (_progress, latest) => latest.ending === "completed",
  },
  {
    id: "distrust-ending",
    title: "불신의 대가",
    description: "원정 생존자 전원이 길잡이를 더는 믿지 않게 된다.",
    category: "result",
    hiddenWhenLocked: true,
    imageSrc: "/assets/achievements/achievement_distrust.png",
    isUnlocked: (_progress, latest) => latest.ending === "distrust",
  },
  {
    id: "denounced-ending",
    title: "누적 고발",
    description: "살아 있는 용사 5명 이상이 길잡이를 불신한다.",
    category: "result",
    hiddenWhenLocked: true,
    imageSrc: "/assets/achievements/achievement_denounced.png",
    isUnlocked: (_progress, latest) => latest.ending === "denounced",
  },
  {
    id: "exhausted-ending",
    title: "인력 소진",
    description: "서로 다른 직업 3명으로 원정대를 꾸릴 수 없게 된다.",
    category: "result",
    hiddenWhenLocked: true,
    imageSrc: "/assets/achievements/achievement_exhausted.png",
    isUnlocked: (_progress, latest) => latest.ending === "exhausted",
  },
  {
    id: "unemployed-ending",
    title: "실직",
    description: "승급할 수 없고 남은 모든 공고가 현재 길잡이 등급보다 높다.",
    category: "result",
    hiddenWhenLocked: true,
    imageSrc: "/assets/achievements/achievement_unemployed.png",
    isUnlocked: (_progress, latest) => latest.ending === "unemployed",
  },
  {
    id: "s-rank-guide",
    title: "S급 길잡이",
    description: "S급 길잡이로 캠페인을 완주한다.",
    category: "result",
    hiddenWhenLocked: true,
    imageSrc: "/assets/achievements/achievement_s_rank.png",
    isUnlocked: (_progress, latest) => latest.ending === "completed" && latest.finalRank === "S",
  },
  {
    id: "everyone-returned",
    title: "모두 함께 돌아오다",
    description: "사망자를 한 명도 내지 않고 15개 던전을 모두 돌파한다.",
    category: "result",
    hiddenWhenLocked: true,
    imageSrc: "/assets/achievements/achievement_everyone_returned.png",
    isUnlocked: (_progress, latest) => latest.ending === "completed" && latest.deaths === 0,
  },
  {
    id: "five-endings",
    title: "다섯 갈래의 결말",
    description: "다섯 종류의 엔딩을 각각 한 번씩 경험한다.",
    category: "result",
    hiddenWhenLocked: true,
    imageSrc: "/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/achievements/achievement_return.png",
    isUnlocked: (progress) => ENDING_ORDER.every((ending) => progress.endingCounts[ending] >= 1),
  },
  cumulativeAchievement(
    "hundred-advices",
    "백 번의 조언",
    "누적 조언 100회를 기록한다.",
    "/assets/achievements/achievement_advice.png",
    100,
    (progress) => progress.totals.advices,
  ),
  cumulativeAchievement(
    "seasoned-expedition",
    "노련한 원정대",
    "누적 원정 클리어 30회를 기록한다.",
    "/assets/achievements/achievement_expedition.png",
    30,
    (progress) => progress.totals.clearedExpeditions,
  ),
  cumulativeAchievement(
    "death-in-the-plan",
    "죽음도 계획의 일부",
    "누적 전멸 10회를 기록한다.",
    "/assets/achievements/achievement_wipe.png",
    10,
    (progress) => progress.totals.wipedExpeditions,
  ),
] as const;

export function recordCompletedCampaign(
  current: PlayerProgressV1,
  record: CompletedCampaignRecord,
  unlockedAt: string,
): PlayerProgressV1 {
  validateRecord(record);
  if (current.recordedRunIds.includes(record.runId)) {
    return current;
  }

  const totals = {
    completedCampaigns: addSafeCounter(current.totals.completedCampaigns, 1, "completedCampaigns"),
    expeditions: addSafeCounter(current.totals.expeditions, record.totalExpeditions, "expeditions"),
    clearedExpeditions: addSafeCounter(
      current.totals.clearedExpeditions,
      record.clearedExpeditions,
      "clearedExpeditions",
    ),
    wipedExpeditions: addSafeCounter(current.totals.wipedExpeditions, record.wipedExpeditions, "wipedExpeditions"),
    deaths: addSafeCounter(current.totals.deaths, record.deaths, "deaths"),
    advices: addSafeCounter(current.totals.advices, record.advices, "advices"),
  };
  const endingCount = addSafeCounter(current.endingCounts[record.ending], 1, `${record.ending} ending count`);

  const next: PlayerProgressV1 = {
    version: PLAYER_PROGRESS_VERSION,
    totals,
    endingCounts: {
      ...current.endingCounts,
      [record.ending]: endingCount,
    },
    unlocked: { ...current.unlocked },
    recordedRunIds: [...current.recordedRunIds, record.runId],
  };

  const unlocked = { ...next.unlocked };
  for (const achievement of ACHIEVEMENT_CATALOG) {
    if (unlocked[achievement.id] || !achievement.isUnlocked(next, record)) {
      continue;
    }
    unlocked[achievement.id] = { unlockedAt };
  }

  return { ...next, unlocked };
}

export function achievementProgressFor(
  progress: PlayerProgressV1,
  id: AchievementId,
): AchievementProgress | null {
  const achievement = ACHIEVEMENT_CATALOG.find((candidate) => candidate.id === id);
  return achievement?.progress?.(progress) ?? null;
}

export function unlockedAchievementCount(progress: PlayerProgressV1): number {
  return ACHIEVEMENT_CATALOG.reduce(
    (count, achievement) => count + (progress.unlocked[achievement.id] ? 1 : 0),
    0,
  );
}
