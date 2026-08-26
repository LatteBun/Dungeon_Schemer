import { THEMES } from "@/lib/content/themes";
import { DENOUNCE_THRESHOLD } from "@/lib/domain";
import type {
  ActiveExpeditionContext,
  CampaignState,
  Character,
  ChoiceId,
  EventKind,
  MemberReaction,
  NodeId,
  SituationEvent,
  ThemeContent,
} from "@/lib/domain";
import { getGuidePromotionEligibility } from "@/lib/rules/promotion";
import { countLivingZeroTrust } from "@/lib/rules/ending";
import { presentShuffledAdvice } from "@/lib/rules/advice-evaluation";
import { PERSONALITY_LABEL, classLabel, portraitSrcForCharacterId } from "./character-labels";
import { enemyBattleAssetSrc } from "./u5-battle-assets";
import { createU5BattleReplay, type U5BattleReplay } from "./u5-battle-replay";
import { inSeatOrder } from "./party-seat-order";
import type { TopStatusView } from "./TopStatusBar";
import type { U5EcologyView, U5LogEntry } from "./u5-log";
import { getMerchantAdviceAvailability } from "@/lib/rules/merchant";
import { toAdviceViews, type U5OutcomeView, type U5ProgressView, type U5SceneKind } from "./u5-progress-model";

/**
 * 스토어 상태에서 화면 View 를 만든다.
 *
 * 화면은 View 만 안다. 규칙 타입도 스토어도 모른다. 그 경계를 여기서 지킨다.
 * 규칙을 재구현하지 않고 selector 결과를 View 로 옮긴다.
 */

export function statusFor(campaign: CampaignState, active: ActiveExpeditionContext | null): TopStatusView {
  const eligibility = getGuidePromotionEligibility(campaign);
  const dungeon = active === null
    ? undefined
    : campaign.dungeons.find((candidate) => candidate.id === active.expedition.dungeonId);
  return {
    rank: campaign.rank,
    reputation: campaign.reputation,
    gold: campaign.gold,
    canPromote: eligibility !== null && (eligibility.canPromoteByReputation || eligibility.canPromoteByGold),
    remainingDungeons: campaign.dungeons.filter((candidate) => candidate.status !== "cleared").length,
    zeroTrust: {
      livingCount: countLivingZeroTrust(campaign),
      threshold: DENOUNCE_THRESHOLD,
    },
    ...(eligibility === null ? {} : {
      nextPromotion: { rank: eligibility.toRank, reputationRequired: eligibility.reputationRequired },
    }),
    ...(dungeon === undefined ? {} : {
      currentDungeon: { name: dungeon.name, riskLevel: active!.expedition.riskLevel },
    }),
  };
}

/**
 * 지도에 내보낼 노드별 공개 분류다.
 *
 * `E3` 의 계획에서 `category` 만 꺼낸다. **숨은 `hiddenRole` 은 내보내지 않는다.**
 * 보스 정보 지점도 강한 연계 후속도 지도에서는 평범한 같은 분류로 보여야 한다.
 */
export function publicKindByNodeId(active: ActiveExpeditionContext): Readonly<Partial<Record<NodeId, EventKind>>> {
  const plans = active.preparedEvents?.nodePlans;
  if (plans === undefined) return {};
  const out: Partial<Record<NodeId, EventKind>> = {};
  for (const [nodeId, plan] of plans) out[nodeId] = plan.category;
  return out;
}

function themeOf(campaign: CampaignState, active: ActiveExpeditionContext): ThemeContent {
  const dungeon = campaign.dungeons.find((candidate) => candidate.id === active.expedition.dungeonId);
  const theme = dungeon === undefined ? undefined : THEMES.find((candidate) => candidate.id === dungeon.theme);
  if (theme === undefined) throw new Error(`원정 테마를 찾을 수 없다: ${active.expedition.dungeonId}`);
  return theme;
}

export function partyViewsFor(seed: string, members: readonly Character[]) {
  return inSeatOrder(seed, members, (member) => String(member.id)).map((member) => ({
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
  }));
}

/** 사건 분류를 장면 종류로 옮긴다. 지도의 공개 분류와 같은 낱말이다. */
function sceneKindOf(kind: SituationEvent["kind"]): U5SceneKind {
  return kind === "merchant" ? "merchant" : kind === "rest" ? "rest" : kind === "special" ? "special" : "monster";
}

/**
 * 진행 화면 View 를 만든다.
 *
 * 조언 순서는 `E2` 가 정한다. 화면이 다시 섞지 않는다. `ChoiceId` 도 넘기지
 * 않는다 — ID 가 `-help`·`-harm` 으로 끝나 정답이 새기 때문이다.
 */
/*
 * 지금 고를 수 없는 조언과 그 이유.
 *
 * 상인 사건만 해당한다. 값을 보여주면서 살 수 있는지는 안 알려 주면 길잡이는
 * 눌러 보고서야 안 된다는 것을 안다. 판단은 `C4` 가 하고 화면은 옮겨 적는다.
 */
const UNAVAILABLE_TEXT: Readonly<Record<string, string>> = {
  insufficientGold: "골드가 모자란다",
  pendingEffect: "이미 사 둔 것이 남아 있다",
};

function unavailableAdviceSlots(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
  presented: readonly { readonly id: ChoiceId }[],
): Readonly<Record<number, string>> {
  const event = active.pendingEvent;
  if (event === null || event.kind !== "merchant") return {};

  const byId = new Map(event.advice.map((option) => [option.id, option]));
  const blocked: Record<number, string> = {};
  presented.forEach((option, slot) => {
    const advice = byId.get(option.id);
    if (advice === undefined) return;
    const availability = getMerchantAdviceAvailability(
      advice,
      campaign.gold,
      active.expedition.pendingMerchantEffect,
    );
    if (availability.executable) return;
    blocked[slot] = UNAVAILABLE_TEXT[availability.reason] ?? "지금은 고를 수 없다";
  });
  return blocked;
}

/**
 * 진행 화면. 고르는 중이거나 결과를 보는 중이다.
 *
 * 둘은 같은 화면의 두 상태다 — 상황도 파티도 그대로 있고, 조언 자리에 결과가
 * 들어선다. 그래서 `pendingEvent` 든 `pendingOutcome` 이든 여기서 만든다.
 */
export function progressViewFor(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
): U5ProgressView | null {
  const event = active.pendingEvent ?? active.pendingOutcome?.event ?? null;
  if (event === null) return null;

  const dungeon = campaign.dungeons.find((candidate) => candidate.id === active.expedition.dungeonId);
  if (dungeon === undefined) throw new Error(`원정 던전을 찾을 수 없다: ${active.expedition.dungeonId}`);

  const depth = active.expedition.map.layers
    .findIndex((layer) => layer.nodeIds.includes(active.expedition.currentNodeId));
  const presented = presentShuffledAdvice({
    campaignSeed: campaign.seed,
    dungeonId: dungeon.id,
    attempt: dungeon.attempts,
    depth: depth < 0 ? 0 : depth,
    event,
  });

  return {
    dungeonName: dungeon.name,
    theme: dungeon.theme,
    sceneKind: sceneKindOf(event.kind),
    nodeLabel: event.title,
    situation: event.description,
    advice: toAdviceViews(presented, unavailableAdviceSlots(campaign, active, presented)),
    outcome: outcomeViewFor(active),
    party: partyViewsFor(campaign.seed, active.partyMembers),
  };
}

/**
 * 화면이 고른 슬롯을 조언 ID 로 옮긴다.
 *
 * 화면은 슬롯 번호만 안다. 이 함수가 유일한 통로다.
 */
export function adviceIdForSlotIn(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
  slot: number,
): SituationEvent["advice"][number]["id"] {
  const event = active.pendingEvent;
  if (event === null) throw new Error("조언을 고를 사건이 없다");
  const dungeon = campaign.dungeons.find((candidate) => candidate.id === active.expedition.dungeonId);
  if (dungeon === undefined) throw new Error(`원정 던전을 찾을 수 없다: ${active.expedition.dungeonId}`);
  const depth = active.expedition.map.layers
    .findIndex((layer) => layer.nodeIds.includes(active.expedition.currentNodeId));
  const presented = presentShuffledAdvice({
    campaignSeed: campaign.seed,
    dungeonId: dungeon.id,
    attempt: dungeon.attempts,
    depth: depth < 0 ? 0 : depth,
    event,
  });
  const chosen = presented[slot];
  if (chosen === undefined) throw new Error(`조언 슬롯이 없다: ${slot}`);
  return chosen.id;
}

/** 공개된 생태 규칙과 관찰 단서. 숨은 규칙을 자동으로 정답 처리하지 않는다. */
export function ecologyViewFor(campaign: CampaignState, active: ActiveExpeditionContext): U5EcologyView {
  const theme = themeOf(campaign, active);
  const text = new Map(theme.rules.map((rule) => [rule.id, rule.text]));
  return {
    disclosedRules: active.expedition.disclosedRuleIds.map((id) => text.get(id) ?? String(id)),
    /*
     * 사건에서 본 것이다. 규칙 문장으로 승격하지 않는다.
     *
     * 공개된 규칙은 `E2` 가 답사로 알려 준 사실이고, 이것은 길잡이가 제 눈으로
     * 본 것이다. 둘을 같은 칸에 두면 무엇이 확인된 것인지 흐려진다.
     */
    observedClues: active.records
      .filter((record) => record.observation !== "")
      .map((record) => record.observation),
  };
}

/*
 * 반응마다 사람이 읽는 한 줄.
 *
 * 내부 판정값을 그대로 내보이지 않는다. `accepted` 를 화면에 쓰면 길잡이가 읽는
 * 것이 사람의 태도가 아니라 규칙의 상태가 된다.
 */
const REACTION_NOTE: Readonly<Record<MemberReaction["reaction"], string>> = {
  accepted: "고개를 끄덕이고 그대로 움직인다.",
  suspected: "눈을 가늘게 뜨고 한 박자 늦게 따른다.",
  exposed: "손을 멈추고 이쪽을 돌아본다.",
};

/** 조언이 어떻게 됐는지. 아직 고르는 중이면 `null` 이다. */
export function outcomeViewFor(active: ActiveExpeditionContext): U5OutcomeView | null {
  const outcome = active.pendingOutcome;
  if (outcome === null) return null;

  const nameOf = (characterId: Character["id"]) =>
    active.partyMembers.find((member) => member.id === characterId)?.name ?? String(characterId);
  const changes = [
    ...outcome.hpChanges.map((one) => ({ label: "HP", detail: `${nameOf(one.characterId)} ${one.before} → ${one.after}` })),
    ...outcome.trustChanges.map((one) => ({ label: "신뢰", detail: `${nameOf(one.characterId)} ${one.before} → ${one.after}` })),
  ];

  return {
    reactions: outcome.reactions.map((one) => ({
      memberName: nameOf(one.characterId),
      reaction: one.reaction,
      note: REACTION_NOTE[one.reaction],
    })),
    /* 결과 문장은 규칙이 골랐다. 화면이 다시 고르지 않는다. */
    resultText: outcome.resultText,
    /* 변화가 없으면 없다고 적는다. 지어내지 않는다. */
    changes: changes.length === 0 ? [{ label: "변화", detail: "수치와 신뢰가 그대로다." }] : changes,
  };
}

/**
 * 그 자리에서 벌어진 전투. 싸우지 않았으면 `null` 이다.
 *
 * 보스전만 재생되고 일반 몹 전투는 화면에 닿지 않았다. `U5ProgressScreen` 은
 * `battleReplay` 를 이미 받고 있었는데 아무도 넘기지 않았다.
 */
export function eventReplayFor(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
): U5BattleReplay | null {
  const resolution = active.pendingOutcome?.battle ?? null;
  if (resolution === null) return null;

  const theme = themeOf(campaign, active);
  const nameOfMonster = new Map(theme.monsters.map((monster) => [String(monster.id), monster.name]));

  return createU5BattleReplay({
    resolution,
    presentations: [
      ...active.partyMembers.map((member) => ({
        id: String(member.id),
        name: member.name,
        /*
         * 싸움에 든 사람은 그때 살아 있었다.
         *
         * `partyMembers` 는 전투가 끝난 뒤의 상태다. 그것으로 초상화를 고르면
         * 이 싸움에서 죽을 사람이 **첫 프레임부터** 죽은 그림으로 서 있다.
         * 살아서 시작하는데 미리 회색인 것이다.
         *
         * 쓰러지는 것은 재생이 프레임마다 보여준다 - `defeatedParticipantIds`
         * 가 그 순간에 흐려 준다. 초상화가 그것을 앞질러서는 안 된다.
         */
        imageSrc: portraitSrcForCharacterId(member.id),
      })),
      /* 적의 이름은 콘텐츠에서 온다. 화면이 지어내지 않는다. */
      ...resolution.enemies.map((enemy) => ({
        id: String(enemy.id),
        name: nameOfMonster.get(String(enemy.monsterId)) ?? String(enemy.monsterId),
        imageSrc: enemyBattleAssetSrc(String(enemy.monsterId)),
      })),
    ],
  });
}

const REACTION_WORD: Readonly<Record<string, string>> = {
  accepted: "수용",
  suspected: "의심",
  exposed: "적발",
  adviceHelped: "믿음이 맞았다",
  adviceHarmed: "믿음이 틀렸다",
  suspicionWasCorrect: "의심이 맞았다",
  suspicionWasCostly: "의심이 손해였다",
};

/**
 * 이 원정의 진행 기록.
 *
 * 지나온 자리마다 관찰 · 조언 · 반응 · 전투가 한 묶음이다. 한 항목이 여러
 * 필터에 걸리므로 필터별로 목록을 복제하지 않는다 — 복제하면 같은 사건이 두
 * 벌로 남아 한쪽만 고쳐진다.
 */
export function logFor(campaign: CampaignState, active: ActiveExpeditionContext): readonly U5LogEntry[] {
  const theme = themeOf(campaign, active);
  const text = new Map(theme.rules.map((rule) => [rule.id, rule.text]));
  const nameOf = (characterId: Character["id"]) =>
    active.partyMembers.find((member) => member.id === characterId)?.name ?? String(characterId);

  const entries: U5LogEntry[] = [];
  const push = (tags: U5LogEntry["tags"], label: string, detail: string) => {
    if (detail !== "") entries.push({ order: entries.length + 1, tags, label, detail });
  };

  /* 답사가 알려 준 것이 먼저다. 던전에 들기 전에 이미 알고 있던 사실이다. */
  push(
    ["ecology"],
    "생태 공개",
    active.expedition.disclosedRuleIds.map((id) => text.get(id) ?? String(id)).join(" · "),
  );

  for (const record of active.records) {
    push(["clue"], "관찰", record.observation);
    /* 조언 식별자는 내부 정답을 담고 있어 화면에 내지 않는다. 문구만 쓴다. */
    push([], "조언 선택", record.choice);
    push(
      [],
      "파티 반응",
      record.reactions.map((one) => `${nameOf(one.characterId)} ${REACTION_WORD[one.reaction] ?? one.reaction}`).join(" · "),
    );
    push(
      ["battle"],
      "피해",
      record.damage.map((one) => `${nameOf(one.characterId)} HP ${one.before} → ${one.after}`).join(" · "),
    );
    if (record.battle !== null) {
      push(["battle"], "전투", `${record.battle.rounds}라운드 · ${record.battle.victory ? "파티 생환" : "파티 전멸"}`);
    }
  }

  return entries;
}


/**
 * 원정이 끝난 자리의 진행 View.
 *
 * 보스전도 같은 화면에서 본다. 전에는 전투 장면만 덩그러니 띄우고 상단 상태도
 * 파티도 없어, `/u5-2-test` 에서 보던 것과 다른 화면이 되었다. 규칙이 남긴 보스
 * 기록에 재료가 다 있으므로 그것을 옮겨 적는다.
 */
export function expeditionEndViewFor(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
): U5ProgressView {
  const dungeon = campaign.dungeons.find((one) => one.id === active.expedition.dungeonId);
  if (dungeon === undefined) throw new Error(`원정 던전을 찾을 수 없다: ${active.expedition.dungeonId}`);

  const boss = active.expedition.bossResult;
  const record = active.records.at(-1) ?? null;
  const survivors = active.partyMembers.filter((member) => member.alive).length;
  const nameOf = (characterId: Character["id"]) =>
    active.partyMembers.find((member) => member.id === characterId)?.name ?? String(characterId);

  return {
    dungeonName: dungeon.name,
    theme: dungeon.theme,
    /* 보스전은 monster 장면을 쓴다. 전용 장면 자산이 따로 없다. */
    sceneKind: "monster",
    nodeLabel: boss === null ? "원정 종료" : "보스방",
    situation: boss === null
      ? "더 나아갈 수 없다. 남은 사람을 데리고 돌아간다."
      : record?.choice ?? "보스방에 들었다",
    /* 고를 것이 없다. 결과만 남았다. */
    advice: [],
    outcome: {
      /* 보스전의 반응은 그 믿음이 옳았는지다. `E4` 가 판정한 것을 옮긴다. */
      reactions: (record?.reactions ?? []).map((one) => ({
        memberName: nameOf(one.characterId),
        reaction: one.reaction === "accepted" || one.reaction === "suspected" || one.reaction === "exposed"
          ? one.reaction
          : "accepted",
        note: REACTION_WORD[one.reaction] ?? String(one.reaction),
      })),
      resultText: boss === null
        ? `${survivors}명이 남았다.`
        : boss.status === "cleared"
          ? `보스를 넘어섰다. ${survivors}명이 살아 남았다.`
          : "보스방을 넘지 못했다. 아무도 돌아오지 못했다.",
      changes: (record?.damage ?? []).length === 0
        ? [{ label: "변화", detail: "수치가 그대로다." }]
        : (record?.damage ?? []).map((one) => ({
          label: "HP",
          detail: `${nameOf(one.characterId)} ${one.before} → ${one.after}`,
        })),
    },
    /*
     * 싸움에 들어갈 때의 파티를 보여준다.
     *
     * 이 화면은 방금 벌어진 일의 재생이다. 옆에 선 파티가 이미 "사망" 으로
     * 회색이면 재생이 시작하기도 전에 결말이 서 있는 셈이고, 화면이 깨진 것처럼
     * 보인다. 무슨 일이 있었는지는 아래 결과가 말한다.
     */
    party: partyViewsFor(campaign.seed, rewound(active)),
  };
}

/**
 * 마지막 기록을 되감아 그 자리에 들어갈 때의 파티를 만든다.
 *
 * 기록이 사람마다 전후를 남기므로 "전" 을 되짚을 수 있다. 화면이 파티를 따로
 * 들고 있을 필요가 없다.
 */
function rewound(active: ActiveExpeditionContext): readonly Character[] {
  const record = active.records.at(-1);
  if (record === undefined) return active.partyMembers;

  const hpBefore = new Map(record.damage.map((one) => [String(one.characterId), one.before]));
  const trustBefore = new Map(record.trustChanges.map((one) => [String(one.characterId), one.before]));
  return active.partyMembers.map((member) => {
    const hp = hpBefore.get(String(member.id)) ?? member.hp;
    return {
      ...member,
      hp,
      trust: trustBefore.get(String(member.id)) ?? member.trust,
      /* 그 자리에 들어간 사람은 그때 살아 있었다. */
      alive: hp > 0,
    };
  });
}

/**
 * 보스전 재생을 만든다.
 *
 * 이름과 그림만 붙인다. 무슨 일이 일어났는지는 `E4` 가 이미 정했다 — 어느
 * 행동에서 어떤 믿음이 작용했는지(`cues`)와 그 믿음이 옳았는지(`verifications`)
 * 까지 규칙이 계산해 둔 값이므로 그대로 넘긴다. 한동안 화면이 이 둘을 통째로
 * 버리고 있었고, 그래서 보스전이 그냥 때리고 맞는 장면이었다.
 */
export function bossReplayFor(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
): U5BattleReplay | null {
  const result = active.expedition.bossResult;
  if (result === null) return null;

  const dungeon = campaign.dungeons.find((one) => one.id === active.expedition.dungeonId);
  const theme = THEMES.find((one) => one.id === dungeon?.theme);
  const boss = theme?.bosses.find((one) => one.id === dungeon?.bossId);

  return createU5BattleReplay({
    resolution: result.battle,
    cues: result.cues,
    verifications: result.verifications,
    presentations: [
      ...active.partyMembers.map((member) => ({
        id: String(member.id),
        name: member.name,
        /*
         * 싸움에 든 사람은 그때 살아 있었다.
         *
         * `partyMembers` 는 전투가 끝난 뒤의 상태다. 그것으로 초상화를 고르면
         * 이 싸움에서 죽을 사람이 **첫 프레임부터** 죽은 그림으로 서 있다.
         * 살아서 시작하는데 미리 회색인 것이다.
         *
         * 쓰러지는 것은 재생이 프레임마다 보여준다 - `defeatedParticipantIds`
         * 가 그 순간에 흐려 준다. 초상화가 그것을 앞질러서는 안 된다.
         */
        imageSrc: portraitSrcForCharacterId(member.id),
      })),
      /* 적의 이름은 콘텐츠에서 온다. 화면이 보스 이름을 지어내지 않는다. */
      ...result.battle.enemies.map((enemy) => ({
        id: String(enemy.id),
        name: boss?.name ?? String(enemy.monsterId),
        imageSrc: enemyBattleAssetSrc(String(enemy.monsterId)),
      })),
    ],
  });
}

/**
 * 지도에서 읽는 답사 기록.
 *
 * 공개된 생태 규칙은 다음 지점을 고를 때 쓰라고 `E2` 가 준 사실인데, 그동안
 * 진행 화면의 기록 탭에만 있었다. 정작 고르는 자리는 지도다.
 */
export function surveyViewFor(campaign: CampaignState, active: ActiveExpeditionContext) {
  const theme = themeOf(campaign, active);
  const text = new Map(theme.rules.map((rule) => [rule.id, rule.text]));

  return {
    visited: active.expedition.visitedNodeIds.length,
    /* 입구와 보스방을 뺀 지점 수다. 걸어서 고를 수 있는 자리만 센다. */
    total: active.expedition.map.nodes.filter((node) => node.kind === "normal").length,
    disclosedRules: active.expedition.disclosedRuleIds.map((id) => text.get(id) ?? String(id)),
  };
}

export interface PartyMemberChangeView {
  /** 무엇을 보고 무엇을 골랐는지. 그 사람에게 일어난 일의 이유다. */
  readonly cause: string;
  /** 그 사람이 어떻게 받아들였는지. 반응하지 않았으면 없다. */
  readonly reaction?: string;
  readonly hp?: { readonly before: number; readonly after: number };
  readonly trust?: { readonly before: number; readonly after: number };
}

/**
 * 이 원정에서 그 사람에게 일어난 일.
 *
 * 파티 카드를 뒤집으면 보이는 것이다. 지금 수치만 보고는 무엇 때문에 그렇게
 * 됐는지 알 수 없다 — 신뢰가 왜 깎였는지가 곧 다음 조언이 먹힐지를 가른다.
 *
 * 아무 일도 없었던 자리는 적지 않는다. 지나온 지점을 전부 나열하면 정작 무엇이
 * 그 사람을 바꿨는지가 묻힌다.
 */
export function memberChangesFor(
  active: ActiveExpeditionContext,
  characterId: Character["id"],
): readonly PartyMemberChangeView[] {
  return active.records.flatMap((record) => {
    const reaction = record.reactions.find((one) => one.characterId === characterId);
    const hp = record.damage.find((one) => one.characterId === characterId);
    const trust = record.trustChanges.find((one) => one.characterId === characterId);
    if (reaction === undefined && hp === undefined && trust === undefined) return [];

    return [{
      cause: record.choice === "" ? record.observation : record.choice,
      ...(reaction === undefined ? {} : { reaction: REACTION_WORD[reaction.reaction] ?? reaction.reaction }),
      ...(hp === undefined ? {} : { hp: { before: hp.before, after: hp.after } }),
      ...(trust === undefined ? {} : { trust: { before: trust.before, after: trust.after } }),
    }];
  });
}
