import { CLASSES } from "@/lib/content/classes";
import { eventsForTheme } from "@/lib/content/event-registry";
import { SPIDER_THEME } from "@/lib/content/themes";
import { DENOUNCE_THRESHOLD, type Character, type InfoRecord, type SituationEvent } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { countEmergencyEligibleAdventurers, countLivingZeroTrust } from "@/lib/rules/ending";
import type { BattleResolution } from "@/lib/rules/battle-engine";
import { resolveBossBattle } from "@/lib/rules/boss-battle-adapter";
import { presentShuffledAdvice, resolveBossInfoAdvice } from "@/lib/rules/advice-evaluation";
import { resolveMonsterEventBattle } from "@/lib/rules/expedition-events";
import type { TopStatusView } from "./TopStatusBar";
import {
  PERSONALITY_LABEL,
  classLabel,
  portraitSrcForCharacterId,
} from "./character-labels";
import { enemyBattleAssetSrc } from "./u5-battle-assets";
import { createU5BattleReplay, type U5BattleReplay } from "./u5-battle-replay";
import type { U5EcologyView, U5LogEntry } from "./u5-log";
import { U5_PREVIEW_MEMBERS } from "./u5-preview-data";
import type { U5ProgressView } from "./u5-progress-model";
import type { U5CombatFeedbackView } from "./u5-combat-feedback";

export type U5BattlePreviewId = "e3-monster" | "e4-boss";

export interface U5BattlePreviewEntry {
  readonly id: U5BattlePreviewId;
  readonly label: string;
  readonly sourceLabel: string;
  readonly status: TopStatusView;
  readonly progress: U5ProgressView;
  readonly log: readonly U5LogEntry[];
  readonly ecology: U5EcologyView;
  readonly resolution: BattleResolution;
  readonly replay: U5BattleReplay;
  readonly feedback: U5CombatFeedbackView;
}

const campaign = initializeCampaign("u5-dungeon-progress-preview-fixed-roster");
const cleric = U5_PREVIEW_MEMBERS.find((member) => member.classId === "cleric");
if (cleric === undefined) throw new Error("U5-2 치유 프리뷰에 쓸 성직자가 없다");
const clericId = cleric.id;
const companions = U5_PREVIEW_MEMBERS.filter((member) => member.id !== clericId);
if (companions.length !== 2) throw new Error("U5-2 치유 프리뷰에 쓸 동료 둘이 없다");
const injuredCompanion = {
  ...companions[0]!,
  hp: Math.max(1, Math.floor(companions[0]!.maxHp / 2)),
};
const members: readonly Character[] = U5_PREVIEW_MEMBERS.map((member) =>
  member.id === injuredCompanion.id ? injuredCompanion : member,
);
const battleAbilityUsesRemainingByCharacterId = { [clericId]: 2 } as const;
const bossCandidate = SPIDER_THEME.bosses.find((candidate) => candidate.id === "boss-spider-2");

if (members.length !== 3) throw new Error("U5-2 프리뷰에 쓸 살아 있는 파티원 셋이 없다");
if (bossCandidate === undefined) throw new Error("U5-2 프리뷰에 쓸 공식 거미 보스가 없다");
const boss = bossCandidate;

/*
 * 보스전은 `E4` 가 계산한다.
 *
 * 한때 이 자리에 `resolveBossBattle` 을 부르지 않는 시각 fixture 가 있었다.
 * `E4` 가 없던 동안의 임시였고 화면에도 그렇게 표시했다. 이제 실제 보스
 * 던전과 파티를 넣어 규칙이 낸 턴 기록을 그대로 재생한다. 화면은 피해도
 * 확률도 신뢰도 다시 계산하지 않는다.
 */
const bossDungeonCandidate = campaign.dungeons.find(
  (candidate) => candidate.theme === SPIDER_THEME.id && candidate.bossId === boss.id,
);
if (bossDungeonCandidate === undefined) throw new Error(`U5-2 프리뷰에 쓸 ${boss.id} 던전이 캠페인에 없다`);
const bossDungeon = bossDungeonCandidate;

/**
 * 보스 정보를 실제로 하나 받아 보스전까지 들고 간다.
 *
 * 전에는 `infoRecords: []` 를 넘겼다. 그러면 `E4` 가 낼 표시 신호도 사후 검증도
 * 없어서, 화면이 그것을 그리도록 고쳐도 보여줄 것이 없다. 이 던전의 보스를
 * 가리키는 `special` 사건을 찾아 조언을 하나 고르고, `E2` 가 만든 지연 기록을
 * 그대로 넘긴다. 아무도 수용하지 않으면 기록이 비고, 그것도 규칙의 결과다.
 */
function bossInfoRecords(): readonly InfoRecord[] {
  const event = eventsForTheme(SPIDER_THEME.id).find((candidate) =>
    candidate.kind === "special" && candidate.targetBossId === boss.id);
  if (event === undefined) return [];

  const presented = presentShuffledAdvice({
    campaignSeed: "u5-2-boss-preview", dungeonId: bossDungeon.id,
    attempt: 0, depth: 1, event,
  });
  /* 도움·방해 조언이라야 지연 기록이 생긴다. 중립은 modifier 를 만들지 않는다. */
  const carried = presented.find((one) => {
    const option = event.advice.find((candidate) => candidate.id === one.id);
    return option !== undefined && option.outcome !== "neutral";
  });
  if (carried === undefined) return [];

  return resolveBossInfoAdvice({
    campaignSeed: "u5-2-boss-preview", dungeonId: bossDungeon.id,
    attempt: 0, depth: 1, event, adviceId: carried.id,
    members, dungeon: bossDungeon,
  }).decision.delayedRecords;
}

const bossInfo = bossInfoRecords();

function resolveBoss() {
  return resolveBossBattle({
    dungeon: bossDungeon,
    theme: SPIDER_THEME,
    members,
    classDefs: CLASSES,
    infoRecords: bossInfo,
    seed: "u5-2-boss-preview",
    pendingMerchantEffect: null,
    advicePressure: 0,
    battleAbilityUsesRemainingByCharacterId,
  });
}

function partyPresentations() {
  return members.map((member) => ({
    id: member.id,
    name: member.name,
    imageSrc: portraitSrcForCharacterId(member.id),
  }));
}

function enemyPresentations(resolution: BattleResolution) {
  return resolution.enemies.map((enemy) => {
    const monster = SPIDER_THEME.monsters.find((candidate) => candidate.id === enemy.monsterId);
    if (monster === undefined) throw new Error(`U5-2 E3 프리뷰 monster가 공식 spider 콘텐츠에 없다: ${enemy.monsterId}`);
    return { id: enemy.id, name: monster.name, imageSrc: enemyBattleAssetSrc(enemy.monsterId) };
  });
}

function createE3Resolution(): BattleResolution {
  const event = eventsForTheme("spider").find(
    (candidate): candidate is SituationEvent & { readonly kind: "monster" } =>
      candidate.kind === "monster" && candidate.encounter !== undefined,
  );
  if (event === undefined) throw new Error("U5-2 프리뷰에 쓸 encounter가 있는 spider monster 사건이 없다");

  const { battle } = resolveMonsterEventBattle({
    event,
    modifier: {},
    activeMonsterIds: SPIDER_THEME.monsters.map((monster) => monster.id),
    monsterDefs: SPIDER_THEME.monsters,
    members,
    classDefs: CLASSES,
    seed: "u5-2-e3-monster-preview",
    pendingMerchantEffect: null,
    advicePressure: 0,
    battleAbilityUsesRemainingByCharacterId,
  });
  if (battle === null) throw new Error("U5-2 E3 프리뷰 전투 결과가 비어 있다");
  return battle;
}

function basePreview() {
  return {
    status: {
      rank: campaign.rank,
      reputation: campaign.reputation,
      gold: campaign.gold,
      canPromote: false,
      remainingAdventurers: countEmergencyEligibleAdventurers(campaign),
      remainingDungeons: campaign.dungeons.filter((candidate) => candidate.status !== "cleared").length,
      zeroTrust: {
        livingCount: countLivingZeroTrust(campaign),
        threshold: DENOUNCE_THRESHOLD,
      },
      currentDungeon: { name: bossDungeon.name, riskLevel: bossDungeon.riskLevel },
    } satisfies TopStatusView,
    progress: {
      dungeonName: bossDungeon.name,
      theme: "spider",
      sceneKind: "monster",
      nodeLabel: "전투 프리뷰",
      situation: "확정된 자동 전투 기록을 순서대로 재생한다.",
      advice: [],
      outcome: null,
      party: members.map((member) => ({
        id: String(member.id),
        name: member.name,
        classLabel: classLabel(member.classId),
        personalityLabel: PERSONALITY_LABEL[member.personality],
        hp: member.hp,
        maxHp: member.maxHp,
        trust: member.trust,
        gold: member.gold,
        alive: member.alive,
        portraitSrc: portraitSrcForCharacterId(member.id),
        ...(member.id === clericId ? { battleAbilityUsesRemaining: 2 } : {}),
      })),
    } satisfies U5ProgressView,
    log: [] as readonly U5LogEntry[],
    ecology: {
      disclosedRules: SPIDER_THEME.rules.slice(0, 2).map((rule) => rule.text),
      observedClues: [],
    } satisfies U5EcologyView,
  };
}

function previewPostBattleFeedback(
  signature: string,
  kind: U5CombatFeedbackView["kind"],
  replay: U5BattleReplay,
): Pick<U5CombatFeedbackView, "signature" | "kind" | "postBattleReaction" | "postBattleTrustChanges"> {
  const participant = replay.participants.find(
    (candidate) => candidate.side === "party" && candidate.finalHp !== candidate.initialHp,
  ) ?? replay.participants.find((candidate) => candidate.side === "party");
  const member = members.find((candidate) => candidate.id === participant?.id) ?? members[0]!;
  const after = Math.max(0, member.trust - 2);
  return {
    signature,
    kind,
    postBattleReaction: {
      memberId: member.id,
      memberName: member.name,
      text: "네 말을 믿은 게 실수였군.",
    },
    postBattleTrustChanges: [{ memberId: member.id, before: member.trust, after }],
  };
}

export function createU5BattlePreviewEntries(): readonly U5BattlePreviewEntry[] {
  const base = basePreview();
  const e3Resolution = createE3Resolution();
  const e3Replay = createU5BattleReplay({
    resolution: e3Resolution,
    presentations: [...partyPresentations(), ...enemyPresentations(e3Resolution)],
  });
  const boss4 = resolveBoss();
  const bossResolution = boss4.bossResult.battle;
  const bossReplay = createU5BattleReplay({
    resolution: bossResolution,
    /*
     * `E4` 가 낸 정보 표시 신호와 사후 검증을 그대로 넘긴다.
     *
     * `cues` 의 `actionIndex` 는 전투 기록의 몇 번째 행동인지를 가리킨다.
     * 규칙이 그 값을 계산할 이유는 재생을 위한 것 말고 없는데, 한동안 화면이
     * 통째로 버리고 있었다. 그래서 보스전이 그냥 때리고 맞는 장면이었다.
     */
    cues: boss4.bossResult.cues,
    verifications: boss4.bossResult.verifications,
    /* 보스 ID 는 규칙이 정한다. 화면이 지어낸 이름을 쓰지 않는다. */
    presentations: [
      ...partyPresentations(),
      ...bossResolution.enemies.map((enemy) => ({
        id: enemy.id,
        name: boss.name,
        imageSrc: enemyBattleAssetSrc(boss.id),
      })),
    ],
  });

  return [
    {
      id: "e3-monster",
      label: "E3 실제 일반전",
      sourceLabel: "resolveMonsterEventBattle · 고정 seed",
      status: base.status,
      progress: {
        ...base.progress,
        sceneKind: "monster",
        nodeLabel: "E3 실제 일반전",
        situation: "기존 E3가 계산한 일반 몬스터 전투 기록을 재생한다.",
      },
      log: base.log,
      ecology: base.ecology,
      resolution: e3Resolution,
      replay: e3Replay,
      feedback: {
        ...previewPostBattleFeedback("preview:e3", "event", e3Replay),
        consequenceText: "거미가 추가로 등장한다.",
        preBattleReaction: { memberId: members[0]!.id, memberName: members[0]!.name, text: "알겠어. 네 말대로 하지." },
        immediateTrustChanges: [],
      },
    },
    {
      id: "e4-boss",
      label: "E4 실제 보스전",
      sourceLabel: "resolveBossBattle · 고정 seed",
      status: base.status,
      progress: {
        ...base.progress,
        sceneKind: "boss",
        nodeLabel: "E4 실제 보스전",
        situation: `${boss.name} 과의 턴 단위 보스전 기록을 재생한다.`,
      },
      log: base.log,
      ecology: base.ecology,
      resolution: bossResolution,
      replay: bossReplay,
      feedback: {
        ...previewPostBattleFeedback("preview:e4", "boss", bossReplay),
        consequenceText: null,
        preBattleReaction: null,
        immediateTrustChanges: [],
      },
    },
  ];
}

export const U5_BATTLE_PREVIEW_ENTRIES: readonly U5BattlePreviewEntry[] =
  createU5BattlePreviewEntries();
