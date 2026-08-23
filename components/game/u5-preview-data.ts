import { initializeCampaign } from "@/lib/rules/campaign-init";
import {
  decideImmediateAdvice,
  disclosedRuleIds,
  presentShuffledAdvice,
} from "@/lib/rules/advice-evaluation";
import { eventsForTheme } from "@/lib/content/event-registry";
import { SPIDER_THEME } from "@/lib/content/themes";
import type {
  Character,
  ChoiceId,
  DungeonId,
  SituationEvent,
  ThemeId,
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
 * U6 와 다르다. 조언 제시·반응 판정·생태 공개를 **실제 E2 함수가 한다.**
 * 이 파일이 지어내는 것은 어떤 사건이 나왔는가 하나뿐이다.
 *
 * E3(사건 물질화)가 들어오면 아래 `pickEvent` 자리에 실제 물질화 결과가
 * 들어오고 나머지는 그대로다.
 */

const PREVIEW_SEED = "u5-dungeon-progress-preview";
const PREVIEW_DUNGEON = "spider-1" as DungeonId;
const PREVIEW_ATTEMPT = 1;

const campaign = initializeCampaign(PREVIEW_SEED);

/** 살아 있는 파티원 셋. 캠페인 풀에서 결정적으로 고른다. */
const members: readonly Character[] = Object.values(campaign.pool.byId)
  .filter((member): member is Character => member !== undefined && member.alive)
  .slice(0, 3);

/** E3 가 들어오면 이 자리가 실제 물질화 결과로 바뀐다. */
function pickEvent(kind: SituationEvent["kind"], theme: ThemeId): SituationEvent {
  const found = eventsForTheme(theme).find((event) => event.kind === kind)
    ?? eventsForTheme(theme)[0];
  if (found === undefined) {
    throw new Error(`프리뷰에 쓸 ${kind} 사건이 없다`);
  }
  return found;
}

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

function status(over: Partial<TopStatusView> = {}): TopStatusView {
  return {
    rank: "C",
    reputation: 74,
    gold: 186,
    canPromote: false,
    remainingDungeons: 11,
    currentDungeon: { name: "거미굴 1", riskLevel: 2 },
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
  /** 아무도 수용하지 않은 경로를 보여준다. */
  forceDefaultResult?: boolean;
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
    dungeonName: "거미굴 1",
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
  const accepted = decision.reactions.some((one) => one.reaction === "accepted");
  const chosen = input.event.advice.find((one) => one.id === adviceId);

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
      resultText:
        input.forceDefaultResult || !accepted
          ? input.event.defaultResultText
          : chosen?.resultText ?? input.event.defaultResultText,
      changes: [
        { label: "HP", detail: "브릭스턴 32 → 20" },
        { label: "신뢰", detail: "이반드로 60 → 54" },
      ],
    },
  };
}

const LOG: readonly U5LogEntry[] = [
  { order: 1, tags: ["ecology"], label: "생태 공개", detail: "이 던전의 활성 규칙이 드러났다." },
  { order: 2, tags: ["clue"], label: "관찰", detail: "바닥에 그을린 자국이 남아 있다." },
  { order: 3, tags: [], label: "조언 선택", detail: "성긴 쪽 통로를 권했다." },
  { order: 4, tags: [], label: "파티 반응", detail: "코르빈 수용 · 이반드로 의심" },
  { order: 5, tags: ["battle", "clue"], label: "전투", detail: "거미 두 마리가 굴을 타고 내려온다." },
  { order: 6, tags: ["battle"], label: "피해", detail: "브릭스턴 HP 12 감소" },
  { order: 7, tags: ["clue"], label: "관찰", detail: "천장 거미줄이 한쪽만 성기다." },
];

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

const monsterEvent = pickEvent("monster", "spider");
const merchantEvent = pickEvent("merchant", "spider");
const specialEvent = pickEvent("special", "spider");
const restEvent = pickEvent("rest", "spider");

const monsterBefore = progressFor({ event: monsterEvent, sceneKind: "monster", nodeLabel: "좁은 갈림길" });

export const U5_PREVIEW_ENTRIES: readonly U5PreviewEntry[] = [
  {
    id: "monster-before",
    label: "일반 사건 · 선택 전",
    status: status(),
    progress: monsterBefore,
    log: LOG,
    ecology: ecologyFor(2),
  },
  {
    id: "monster-after",
    label: "일반 사건 · 선택 후",
    status: status(),
    progress: progressFor({ event: monsterEvent, sceneKind: "monster", nodeLabel: "좁은 갈림길", chosenSlot: 0 }),
    log: LOG,
    ecology: ecologyFor(2),
  },
  {
    id: "monster-default",
    label: "아무도 수용하지 않음",
    status: status(),
    progress: progressFor({
      event: monsterEvent,
      sceneKind: "monster",
      nodeLabel: "좁은 갈림길",
      chosenSlot: 1,
      forceDefaultResult: true,
    }),
    log: LOG,
    ecology: ecologyFor(2),
  },
  {
    id: "merchant",
    label: "상인 사건",
    status: status(),
    progress: progressFor({ event: merchantEvent, sceneKind: "merchant", nodeLabel: "떠도는 상인", depth: 3 }),
    log: LOG,
    ecology: ecologyFor(2),
  },
  {
    id: "special",
    label: "특수 사건",
    status: status(),
    progress: progressFor({ event: specialEvent, sceneKind: "special", nodeLabel: "봉인된 방", depth: 4 }),
    log: LOG,
    ecology: ecologyFor(3),
  },
  {
    id: "rest",
    label: "휴식 지점",
    status: status(),
    progress: progressFor({ event: restEvent, sceneKind: "rest", nodeLabel: "꺼진 모닥불", depth: 5 }),
    log: LOG,
    ecology: ecologyFor(2),
  },
  {
    id: "log-clue",
    label: "진행 기록 · 단서",
    status: status(),
    progress: monsterBefore,
    log: LOG,
    ecology: ecologyFor(2),
    initialMode: "log",
    initialFilter: "clue",
  },
  {
    id: "log-battle",
    label: "진행 기록 · 전투",
    status: status(),
    progress: monsterBefore,
    log: LOG,
    ecology: ecologyFor(2),
    initialMode: "log",
    initialFilter: "battle",
  },
  {
    id: "log-ecology",
    label: "진행 기록 · 생태",
    status: status(),
    progress: monsterBefore,
    log: LOG,
    ecology: ecologyFor(2),
    initialMode: "log",
    initialFilter: "ecology",
  },
];
