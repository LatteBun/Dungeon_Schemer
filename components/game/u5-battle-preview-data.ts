import { CLASSES } from "@/lib/content/classes";
import { eventsForTheme } from "@/lib/content/event-registry";
import { SPIDER_THEME } from "@/lib/content/themes";
import type { Character, SituationEvent } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import type { BattleResolution } from "@/lib/rules/battle-engine";
import { resolveMonsterEventBattle } from "@/lib/rules/expedition-events";
import type { TopStatusView } from "./TopStatusBar";
import { portraitSrcForCharacter } from "./u4-dungeon-map-model";
import { enemyBattleAssetSrc } from "./u5-battle-assets";
import { createU5BattleReplay, type U5BattleReplay } from "./u5-battle-replay";
import type { U5EcologyView, U5LogEntry } from "./u5-log";
import { U5_PREVIEW_ENTRIES } from "./u5-preview-data";
import type { U5ProgressView } from "./u5-progress-model";

export type U5BattlePreviewId = "e3-monster" | "boss-fixture";

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
}

const campaign = initializeCampaign("u5-dungeon-progress-preview");
const members: readonly Character[] = Object.values(campaign.pool.byId)
  .filter((member): member is Character => member !== undefined && member.alive)
  .slice(0, 3);
const bossCandidate = SPIDER_THEME.bosses.find((candidate) => candidate.id === "boss-spider-2");

if (members.length !== 3) throw new Error("U5-2 프리뷰에 쓸 살아 있는 파티원 셋이 없다");
if (bossCandidate === undefined) throw new Error("U5-2 프리뷰에 쓸 공식 거미 보스가 없다");
const boss = bossCandidate;

function battleMember(member: Character, hp = member.hp) {
  const classDef = CLASSES.find((candidate) => candidate.id === member.classId);
  if (classDef === undefined) throw new Error(`U5-2 프리뷰 파티 직업이 없다: ${member.classId}`);
  return {
    id: member.id,
    classId: member.classId,
    hp,
    maxHp: member.maxHp,
    attack: classDef.attack,
    hitWeight: classDef.hitWeight,
  };
}

const [bossPartyOne, bossPartyTwo, bossPartyThree] = members;
const bossEnemyId = "u5-2-boss-fixture-enemy";
const bossPartyOneFinalHp = Math.max(0, bossPartyOne.hp - 7);

// E4 미연결 시각 fixture이며 resolveBossBattle을 호출하지 않는다.
const BOSS_FIXTURE_RESOLUTION = {
  status: "victory",
  termination: "defeatedEnemies",
  rounds: 1,
  actions: [
    { round: 1, actorSide: "party", actorId: bossPartyOne.id, targetId: bossEnemyId, damage: 50, targetHpBefore: 150, targetHpAfter: 100, defeated: false },
    { round: 1, actorSide: "enemy", actorId: bossEnemyId, targetId: bossPartyOne.id, damage: 7, targetHpBefore: bossPartyOne.hp, targetHpAfter: bossPartyOneFinalHp, defeated: bossPartyOneFinalHp === 0 },
    { round: 1, actorSide: "party", actorId: bossPartyTwo.id, targetId: bossEnemyId, damage: 50, targetHpBefore: 100, targetHpAfter: 50, defeated: false },
    { round: 1, actorSide: "party", actorId: bossPartyThree.id, targetId: bossEnemyId, damage: 50, targetHpBefore: 50, targetHpAfter: 0, defeated: true },
  ],
  party: [
    battleMember(bossPartyOne, bossPartyOneFinalHp),
    battleMember(bossPartyTwo),
    battleMember(bossPartyThree),
  ],
  enemies: [{
    id: bossEnemyId,
    monsterId: boss.id,
    hp: 0,
    maxHp: boss.maxHp,
    baseDamage: boss.baseDamage,
  }],
} as const satisfies BattleResolution;

function partyPresentations() {
  return members.map((member) => ({
    id: member.id,
    name: member.name,
    imageSrc: portraitSrcForCharacter(member),
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
    retrySteps: 0,
  });
  if (battle === null) throw new Error("U5-2 E3 프리뷰 전투 결과가 비어 있다");
  return battle;
}

function basePreview() {
  const entry = U5_PREVIEW_ENTRIES.find((candidate) => candidate.id === "monster-before");
  if (entry === undefined) throw new Error("U5-2 프리뷰가 재사용할 U5 spider 상태가 없다");
  return entry;
}

export function createU5BattlePreviewEntries(): readonly U5BattlePreviewEntry[] {
  const base = basePreview();
  const e3Resolution = createE3Resolution();
  const e3Replay = createU5BattleReplay({
    resolution: e3Resolution,
    presentations: [...partyPresentations(), ...enemyPresentations(e3Resolution)],
  });
  const bossReplay = createU5BattleReplay({
    resolution: BOSS_FIXTURE_RESOLUTION,
    presentations: [
      ...partyPresentations(),
      { id: bossEnemyId, name: boss.name, imageSrc: enemyBattleAssetSrc(boss.id) },
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
    },
    {
      id: "boss-fixture",
      label: "보스 전투 fixture",
      sourceLabel: "E4 미연결 fixture · resolveBossBattle 미호출",
      status: base.status,
      progress: {
        ...base.progress,
        sceneKind: "boss",
        nodeLabel: "보스 전투 fixture",
        situation: "E4 연결 전 공식 보스 자산과 typed action 기록을 검증한다.",
      },
      log: base.log,
      ecology: base.ecology,
      resolution: BOSS_FIXTURE_RESOLUTION,
      replay: bossReplay,
    },
  ];
}

export const U5_BATTLE_PREVIEW_ENTRIES: readonly U5BattlePreviewEntry[] =
  createU5BattlePreviewEntries();
