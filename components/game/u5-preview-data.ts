import { initializeCampaign } from "@/lib/rules/campaign-init";
import {
  decideImmediateAdvice,
  disclosedRuleIds,
  finalizeImmediateAdviceTrust,
  presentShuffledAdvice,
} from "@/lib/rules/advice-evaluation";
import { CLASSES } from "@/lib/content/classes";
import { generateDungeonMap } from "@/lib/rules/dungeon-map";
import { getGuidePromotionEligibility } from "@/lib/rules/promotion";
import {
  applyEventChoice,
  materializeNodeEvent,
  prepareExpeditionEvents,
  resolveMonsterEventBattle,
} from "@/lib/rules/expedition-events";
import { SPIDER_THEME } from "@/lib/content/themes";
import type {
  CampaignDungeon,
  Character,
  ChoiceId,
  DungeonId,
  SituationEvent,
} from "@/lib/domain";
import { PERSONALITY_LABEL, classLabel, portraitSrcForCharacter } from "./character-labels";
import type { TopStatusView } from "./TopStatusBar";
import type { U5EcologyView, U5LogEntry } from "./u5-log";
import {
  adviceIdForSlot,
  toAdviceViews,
  type U5ProgressView,
  type U5SceneKind,
} from "./u5-progress-model";

/**
 * `/u5-test` 프리뷰 데이터.
 *
 * 지어내는 것이 없다. 지도는 `E1`, 사건 배치와 물질화는 `E3`, 조언 제시와
 * 반응 판정과 생태 공개는 `E2` 가 한다. 던전 이름·위험도·사건 제목·깊이도
 * 규칙이 낸 값을 그대로 쓴다.
 *
 * 이 파일이 하는 일은 **아홉 상태를 고르는 것**뿐이다. 실제 원정에서는
 * 플레이어의 경로 선택이 그 일을 하고, 그 연결이 `I2` 의 몫이다.
 */

const PREVIEW_SEED = "u5-dungeon-progress-preview";
/* 캠페인에 실제로 있는 던전이다. 전에는 어디에도 없는 "spider-1" 을 시드
 * 문자열로만 쓰고 있어서, 던전을 조회하는 순간 드러났다. */
const PREVIEW_DUNGEON = "dungeon-spider-03" as DungeonId;
const PREVIEW_ATTEMPT = 0;

const campaign = initializeCampaign(PREVIEW_SEED);

/** 살아 있는 파티원 셋. 캠페인 풀에서 결정적으로 고른다. */
const members: readonly Character[] = Object.values(campaign.pool.byId)
  .filter((member): member is Character => member !== undefined && member.alive)
  .slice(0, 3);

/* 좁힌 타입을 돌려준다. 아래 함수들이 hoisting 때문에 좁힘을 물려받지 못한다. */
function previewDungeon(): CampaignDungeon {
  const found = campaign.dungeons.find((candidate) => candidate.id === PREVIEW_DUNGEON);
  if (found === undefined) throw new Error(`프리뷰 던전이 캠페인에 없다: ${PREVIEW_DUNGEON}`);
  return found;
}

const dungeon = previewDungeon();

const previewMap = generateDungeonMap({
  campaignSeed: PREVIEW_SEED,
  dungeonId: PREVIEW_DUNGEON,
  initialRiskLevel: dungeon.initialRiskLevel,
  attempt: PREVIEW_ATTEMPT,
});

const preparedEvents = prepareExpeditionEvents({
  campaignSeed: PREVIEW_SEED,
  dungeonId: PREVIEW_DUNGEON,
  initialRiskLevel: dungeon.initialRiskLevel,
  riskLevel: dungeon.riskLevel,
  attempt: PREVIEW_ATTEMPT,
  map: previewMap,
  theme: SPIDER_THEME,
  activeRuleIds: dungeon.activeRuleIds,
  activeMonsterIds: dungeon.activeMonsterIds,
});

interface Sample {
  readonly event: SituationEvent;
  /** 그 노드가 놓인 층이다. 조언 섞기가 이 값을 쓴다. */
  readonly depth: number;
}

/**
 * 실제 지도를 걸어 분류마다 사건 하나씩을 얻는다.
 *
 * 노드를 지도 순서대로 방문한다. 강한 연계의 후속 노드는 선행 단서를 아직
 * 들고 있지 않으면 `E3` 가 거부하는데, 그것은 규칙이 옳게 도는 것이므로
 * 건너뛰고 다음 노드를 본다. 프리뷰가 필요한 것은 분류별 표본 하나씩이다.
 */
function materializeSamples(): Readonly<Record<SituationEvent["kind"], Sample>> {
  const layerByNode = new Map(previewMap.layers.flatMap((layer, index) => layer.nodeIds.map((nodeId) => [nodeId, index] as const)));
  const found = new Map<SituationEvent["kind"], Sample>();
  let state = preparedEvents;

  for (const node of previewMap.nodes) {
    if (node.kind !== "normal") continue;
    let materialized;
    try {
      materialized = materializeNodeEvent({
        prepared: state,
        nodeId: node.id,
        campaignSeed: PREVIEW_SEED,
        dungeonId: PREVIEW_DUNGEON,
        attempt: PREVIEW_ATTEMPT,
        theme: SPIDER_THEME,
        activeRuleIds: dungeon.activeRuleIds,
        activeMonsterIds: dungeon.activeMonsterIds,
      });
    } catch {
      continue;
    }
    state = materialized.state;
    if (found.has(materialized.event.kind)) continue;
    found.set(materialized.event.kind, { event: materialized.event, depth: layerByNode.get(node.id) ?? 1 });
  }

  const kinds: readonly SituationEvent["kind"][] = ["monster", "merchant", "special", "rest"];
  const missing = kinds.filter((kind) => !found.has(kind));
  if (missing.length > 0) throw new Error(`프리뷰 지도에서 물질화하지 못한 분류가 있다: ${missing.join(", ")}`);

  return Object.fromEntries(kinds.map((kind) => [kind, found.get(kind)!])) as Readonly<Record<SituationEvent["kind"], Sample>>;
}

const samples = materializeSamples();

/**
 * 아무도 수용하지 않는 (사건, 슬롯) 을 실제 판정으로 찾는다.
 *
 * 전에는 수용 반응이 나온 판정에 기본 결과 문구만 덮어썼다. 그래서 "아무도
 * 수용하지 않음" 이라는 이름표 옆에 수용·수용·의심이 나란히 섰다. 규칙을
 * 뒤집는 대신, 규칙이 그렇게 내는 자리를 찾아 보여준다.
 *
 * 신뢰가 낮거나 의심 많은 파티원이 모이면 좋은 조언도 통하지 않는다는 것이
 * 이 화면이 말하려는 바다. 그것을 지어내면 말이 되지 않는다.
 */
function findUnacceptedCase(): { readonly sample: Sample; readonly slot: 0 | 1 | 2 } {
  for (const sample of [samples.monster, samples.special, samples.rest, samples.merchant]) {
    const presented = presentShuffledAdvice({
      campaignSeed: PREVIEW_SEED,
      dungeonId: PREVIEW_DUNGEON,
      attempt: PREVIEW_ATTEMPT,
      depth: sample.depth,
      event: sample.event,
    });
    for (const slot of [0, 1, 2] as const) {
      const decision = decideImmediateAdvice({
        campaignSeed: PREVIEW_SEED,
        dungeonId: PREVIEW_DUNGEON,
        attempt: PREVIEW_ATTEMPT,
        depth: sample.depth,
        event: sample.event,
        adviceId: adviceIdForSlot(presented, slot),
        members,
      });
      if (!decision.executed) return { sample, slot };
    }
  }
  throw new Error("아무도 수용하지 않는 경우를 프리뷰 파티에서 찾지 못했다");
}

const unaccepted = findUnacceptedCase();

/*
 * 프리뷰가 무엇을 근거로 그렸는지 밝힌다.
 *
 * 검사가 이 값을 다시 지어내면 프리뷰와 검사가 따로 놀아, 프리뷰가 바뀌어도
 * 검사는 옛 입력으로 통과한다. 실제로 그런 검사가 하나 있었다.
 */
export const U5_PREVIEW_SOURCE = {
  seed: PREVIEW_SEED,
  dungeonId: PREVIEW_DUNGEON,
  attempt: PREVIEW_ATTEMPT,
  dungeon,
  samples,
} as const;

const ecologyRuleText = new Map(SPIDER_THEME.rules.map((rule) => [rule.id, rule.text]));

function ecologyFor(riskLevel: 1 | 2 | 3 | 4 | 5): U5EcologyView {
  const profile = campaign.dungeons.find((dungeon) => dungeon.id === PREVIEW_DUNGEON);
  const activeRuleIds = profile?.activeRuleIds ?? SPIDER_THEME.rules.slice(0, 3).map((rule) => rule.id);

  return {
    // E2 가 위험도에 따라 공개한 것만 담는다.
    disclosedRules: disclosedRuleIds({
      campaignSeed: PREVIEW_SEED,
      dungeonId: PREVIEW_DUNGEON,
      riskLevel,
      activeRuleIds,
    }).map((id) => ecologyRuleText.get(id) ?? String(id)),
    // 사건에서 본 사실. 규칙 문장으로 승격하지 않는다.
    observedClues: [
      "바닥에 그을린 자국이 남아 있다.",
      "천장 거미줄이 한쪽만 성기다.",
    ],
  };
}

/**
 * 상태 바도 캠페인에서 온다.
 *
 * 전에는 명성 74 · 골드 186 · 남은 던전 11 이 박혀 있었다. 이 캠페인의 값은
 * 명성 30 · 골드 10 · 남은 던전 15 다. 화면이 규칙과 다른 숫자를 말하고 있었다.
 */
function status(over: Partial<TopStatusView> = {}): TopStatusView {
  const eligibility = getGuidePromotionEligibility(campaign);
  return {
    rank: campaign.rank,
    reputation: campaign.reputation,
    gold: campaign.gold,
    canPromote: eligibility !== null && (eligibility.canPromoteByReputation || eligibility.canPromoteByGold),
    remainingDungeons: campaign.dungeons.filter((candidate) => candidate.status !== "cleared").length,
    currentDungeon: { name: dungeon.name, riskLevel: dungeon.riskLevel },
    ...(eligibility === null ? {} : {
      nextPromotion: { rank: eligibility.toRank, reputationRequired: eligibility.reputationRequired },
    }),
    ...over,
  };
}

function partyViews() {
  return members.map((member) => ({
    id: String(member.id),
    name: member.name,
    classLabel: classLabel(member.classId),
    personalityLabel: PERSONALITY_LABEL[member.personality],
    hp: member.hp,
    maxHp: member.maxHp,
    trust: member.trust,
    gold: member.gold,
    alive: member.alive,
    portraitSrc: portraitSrcForCharacter({
      id: member.id,
      classId: member.classId,
      alive: member.alive,
    }),
  }));
}

function progressFor(input: {
  event: SituationEvent;
  sceneKind: U5SceneKind;
  nodeLabel: string;
  /** 고른 슬롯. 없으면 선택 전이다. */
  chosenSlot?: 0 | 1 | 2;
  depth?: number;
}): U5ProgressView {
  const depth = input.depth ?? 2;
  const presented = presentShuffledAdvice({
    campaignSeed: PREVIEW_SEED,
    dungeonId: PREVIEW_DUNGEON,
    attempt: PREVIEW_ATTEMPT,
    depth,
    event: input.event,
  });

  const base: U5ProgressView = {
    dungeonName: dungeon.name,
    theme: "spider",
    sceneKind: input.sceneKind,
    nodeLabel: input.nodeLabel,
    situation: input.event.description,
    advice: toAdviceViews(presented),
    outcome: null,
    party: partyViews(),
  };

  if (input.chosenSlot === undefined) {
    return base;
  }

  const adviceId: ChoiceId = adviceIdForSlot(presented, input.chosenSlot);
  const decision = decideImmediateAdvice({
    campaignSeed: PREVIEW_SEED,
    dungeonId: PREVIEW_DUNGEON,
    attempt: PREVIEW_ATTEMPT,
    depth,
    event: input.event,
    adviceId,
    members,
  });

  const byId = new Map(members.map((member) => [member.id, member]));
  const chosen = input.event.advice.find((one) => one.id === adviceId);
  /*
   * 실행 여부는 규칙이 정한다.
   *
   * 한 명이라도 수용하면 실행이고, 아무도 수용하지 않으면 파티가 자기 방식대로
   * 처리한다. 화면이 이 값을 뒤집으면 "아무도 수용하지 않음" 문구 옆에 수용
   * 반응이 나란히 서는 일이 생긴다. 실제로 그랬다.
   */
  const resultText = decision.executed
    ? chosen?.resultText ?? input.event.defaultResultText
    : input.event.defaultResultText;

  /* executed 가 판정과 다르면 여기서 던진다. 화면이 결과를 지어낼 수 없다. */
  const resolution = finalizeImmediateAdviceTrust({
    decision,
    members,
    applied: { executed: decision.executed, resultText },
  });

  const applied = applyEventChoice({ event: input.event, decision, members });
  const hpChanges = applied.members.flatMap((after) => {
    const before = byId.get(after.id);
    if (before === undefined || before.hp === after.hp) return [];
    return [{ label: "HP", detail: `${after.name} ${before.hp} → ${after.hp}` }];
  });
  const trustChanges = resolution.trustChanges.flatMap((change) => {
    const member = byId.get(change.characterId);
    if (member === undefined || change.delta === 0) return [];
    return [{ label: "신뢰", detail: `${member.name} ${member.trust} → ${member.trust + change.delta}` }];
  });

  return {
    ...base,
    outcome: {
      reactions: decision.reactions.map((one) => ({
        memberName: byId.get(one.characterId)?.name ?? String(one.characterId),
        reaction: one.reaction,
        note:
          one.reaction === "accepted"
            ? "고개를 끄덕이고 그대로 움직인다."
            : one.reaction === "suspected"
              ? "눈을 가늘게 뜨고 한 박자 늦게 따른다."
              : "손을 멈추고 이쪽을 돌아본다.",
      })),
      resultText,
      /* 변화가 없으면 없다고 적는다. 지어내지 않는다. */
      changes: [...hpChanges, ...trustChanges].length === 0
        ? [{ label: "변화", detail: "수치와 신뢰가 그대로다." }]
        : [...hpChanges, ...trustChanges],
    },
  };
}

/**
 * 진행 기록도 지어내지 않는다.
 *
 * 전에는 각본이었고, 거기 적힌 코르빈·이반드로·브릭스턴은 이 프리뷰의 파티도
 * 아니었다. 지금은 실제로 공개된 생태 규칙, 실제 사건 묘사, 실제 반응 판정,
 * 실제 전투 기록에서 만든다.
 *
 * 실제 원정이라면 플레이어가 걸어온 길이 이 목록을 만든다. 프리뷰는 한 지점만
 * 걷고, 그 연결이 `I2` 의 몫이다.
 */
/** 화면 문구와 같은 낱말을 쓴다. 내부 판정값은 내지 않는다. */
function reactionWord(reaction: "accepted" | "suspected" | "exposed"): string {
  return reaction === "accepted" ? "수용" : reaction === "suspected" ? "의심" : "적발";
}

function buildLog(): readonly U5LogEntry[] {
  const sample = samples.monster;
  const event = sample.event;
  /*
   * 분류로 뽑은 표본이라 monster 여야 한다. `NonMerchantSituationEvent` 는
   * kind 가 유니온인 한 덩어리라 조건문으로 좁혀지지 않으므로, 술어로 확인한다.
   */
  const isMonster = (candidate: SituationEvent): candidate is SituationEvent & { readonly kind: "monster" } =>
    candidate.kind === "monster";
  if (!isMonster(event)) throw new Error("monster 표본이 monster 사건이 아니다");
  const monsterEvent = event;

  const presented = presentShuffledAdvice({
    campaignSeed: PREVIEW_SEED, dungeonId: PREVIEW_DUNGEON,
    attempt: PREVIEW_ATTEMPT, depth: sample.depth, event,
  });
  const adviceId = adviceIdForSlot(presented, 0);
  const decision = decideImmediateAdvice({
    campaignSeed: PREVIEW_SEED, dungeonId: PREVIEW_DUNGEON,
    attempt: PREVIEW_ATTEMPT, depth: sample.depth, event, adviceId, members,
  });
  const byId = new Map(members.map((member) => [member.id, member]));
  const applied = applyEventChoice({ event: monsterEvent, decision, members });
  const battle = resolveMonsterEventBattle({
    event: monsterEvent,
    modifier: applied.encounterModifier ?? {},
    activeMonsterIds: dungeon.activeMonsterIds,
    monsterDefs: SPIDER_THEME.monsters,
    members: applied.members,
    classDefs: CLASSES,
    seed: `${PREVIEW_SEED}/${PREVIEW_DUNGEON}/log`,
    pendingMerchantEffect: null,
    retrySteps: 0,
  }).battle;

  const disclosed = disclosedRuleIds({
    campaignSeed: PREVIEW_SEED,
    dungeonId: PREVIEW_DUNGEON,
    activeRuleIds: dungeon.activeRuleIds,
    riskLevel: dungeon.riskLevel,
  });
  const entries: U5LogEntry[] = [
    {
      order: 1, tags: ["ecology"], label: "생태 공개",
      detail: disclosed.map((ruleId) => ecologyRuleText.get(ruleId) ?? String(ruleId)).join(" · "),
    },
    { order: 2, tags: ["clue"], label: "관찰", detail: event.description },
    {
      order: 3, tags: [], label: "조언 선택",
      /* 조언 식별자는 내부 정답을 담고 있어 화면에 내지 않는다. 문구만 쓴다. */
      detail: presented.find((one) => one.id === adviceId)?.label ?? "",
    },
    {
      order: 4, tags: [], label: "파티 반응",
      detail: decision.reactions
        .map((one) => `${byId.get(one.characterId)?.name ?? String(one.characterId)} ${reactionWord(one.reaction)}`)
        .join(" · "),
    },
  ];

  if (battle !== null) {
    entries.push({
      order: entries.length + 1, tags: ["battle"], label: "전투",
      detail: `${battle.rounds}라운드 · ${battle.status === "victory" ? "파티 생환" : "파티 전멸"}`,
    });
    const hurt = battle.party.flatMap((after) => {
      const before = members.find((candidate) => String(candidate.id) === String(after.id));
      if (before === undefined || before.hp === after.hp) return [];
      return [`${before.name} HP ${before.hp} → ${after.hp}`];
    });
    if (hurt.length > 0) {
      entries.push({ order: entries.length + 1, tags: ["battle"], label: "피해", detail: hurt.join(" · ") });
    }
  }

  if (event.revealsClue !== undefined) {
    entries.push({ order: entries.length + 1, tags: ["clue"], label: "단서", detail: event.title });
  }
  return entries;
}

const LOG: readonly U5LogEntry[] = buildLog();

export type U5PreviewId =
  | "monster-before"
  | "monster-after"
  | "monster-default"
  | "merchant"
  | "special"
  | "rest"
  | "log-clue"
  | "log-battle"
  | "log-ecology";

export interface U5PreviewEntry {
  id: U5PreviewId;
  label: string;
  status: TopStatusView;
  progress: U5ProgressView;
  log: readonly U5LogEntry[];
  ecology: U5EcologyView;
  initialMode?: "advice" | "log";
  initialFilter?: "all" | "clue" | "battle" | "ecology";
}

const monsterSample = samples.monster;
const merchantSample = samples.merchant;
const specialSample = samples.special;
const restSample = samples.rest;

const monsterBefore = progressFor({ event: monsterSample.event, sceneKind: "monster", nodeLabel: monsterSample.event.title, depth: monsterSample.depth });

export const U5_PREVIEW_ENTRIES: readonly U5PreviewEntry[] = [
  {
    id: "monster-before",
    label: "일반 사건 · 선택 전",
    status: status(),
    progress: monsterBefore,
    log: LOG,
    ecology: ecologyFor(dungeon.riskLevel),
  },
  {
    id: "monster-after",
    label: "일반 사건 · 선택 후",
    status: status(),
    progress: progressFor({ event: monsterSample.event, sceneKind: "monster", nodeLabel: monsterSample.event.title, depth: monsterSample.depth, chosenSlot: 0 }),
    log: LOG,
    ecology: ecologyFor(dungeon.riskLevel),
  },
  {
    id: "monster-default",
    label: "아무도 수용하지 않음",
    status: status(),
    progress: progressFor({
      event: unaccepted.sample.event,
      sceneKind: unaccepted.sample.event.kind,
      nodeLabel: unaccepted.sample.event.title,
      depth: unaccepted.sample.depth,
      chosenSlot: unaccepted.slot,
    }),
    log: LOG,
    ecology: ecologyFor(dungeon.riskLevel),
  },
  {
    id: "merchant",
    label: "상인 사건",
    status: status(),
    progress: progressFor({ event: merchantSample.event, sceneKind: "merchant", nodeLabel: merchantSample.event.title, depth: merchantSample.depth }),
    log: LOG,
    ecology: ecologyFor(dungeon.riskLevel),
  },
  {
    id: "special",
    label: "특수 사건",
    status: status(),
    progress: progressFor({ event: specialSample.event, sceneKind: "special", nodeLabel: specialSample.event.title, depth: specialSample.depth }),
    log: LOG,
    ecology: ecologyFor(3),
  },
  {
    id: "rest",
    label: "휴식 지점",
    status: status(),
    progress: progressFor({ event: restSample.event, sceneKind: "rest", nodeLabel: restSample.event.title, depth: restSample.depth }),
    log: LOG,
    ecology: ecologyFor(dungeon.riskLevel),
  },
  {
    id: "log-clue",
    label: "진행 기록 · 단서",
    status: status(),
    progress: monsterBefore,
    log: LOG,
    ecology: ecologyFor(dungeon.riskLevel),
    initialMode: "log",
    initialFilter: "clue",
  },
  {
    id: "log-battle",
    label: "진행 기록 · 전투",
    status: status(),
    progress: monsterBefore,
    log: LOG,
    ecology: ecologyFor(dungeon.riskLevel),
    initialMode: "log",
    initialFilter: "battle",
  },
  {
    id: "log-ecology",
    label: "진행 기록 · 생태",
    status: status(),
    progress: monsterBefore,
    log: LOG,
    ecology: ecologyFor(dungeon.riskLevel),
    initialMode: "log",
    initialFilter: "ecology",
  },
];
