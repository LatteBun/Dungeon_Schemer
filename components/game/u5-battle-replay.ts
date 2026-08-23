import type { BossInfoPresentationCue, BossInfoVerification } from "@/lib/domain";
import type { BattleResolution } from "@/lib/rules/battle-engine";

export interface U5BattleParticipantPresentation {
  readonly id: string;
  readonly name: string;
  readonly imageSrc: string;
}

export interface U5BattleReplayInput {
  readonly resolution: BattleResolution;
  readonly presentations: readonly U5BattleParticipantPresentation[];
  /*
   * `E4` 가 보스전에서 낸 정보 표시 신호다.
   *
   * `actionIndex` 로 어느 행동에서 그 믿음이 작용했는지를 가리킨다. 규칙 계층이
   * 그 값을 계산할 이유는 재생을 위한 것 말고 없다. 일반 전투에는 없다.
   */
  readonly cues?: readonly BossInfoPresentationCue[];
  /** 전투 뒤 그 믿음이 옳았는지. `E4` 가 판정한다. */
  readonly verifications?: readonly BossInfoVerification[];
}

export interface U5BattleReplayParticipant {
  readonly id: string;
  readonly side: "party" | "enemy";
  readonly name: string;
  readonly imageSrc: string;
  readonly maxHp: number;
  readonly initialHp: number;
  readonly finalHp: number;
}

export type U5BattleReplayPhase = "idle" | "attack" | "impact" | "settle" | "complete";

export interface U5BattleReplayFrame {
  readonly phase: U5BattleReplayPhase;
  readonly actionIndex: number | null;
  readonly actorId: string | null;
  readonly targetId: string | null;
  readonly damage: number | null;
  readonly hpByParticipantId: Readonly<Record<string, number>>;
  readonly defeatedParticipantIds: readonly string[];
  /** 이 프레임에서 드러나는 보스 정보다. 없으면 빈 배열이다. */
  readonly cues: readonly U5BattleCueView[];
}

export interface U5BattleCueView {
  readonly characterId: string;
  readonly axis: BossInfoPresentationCue["axis"];
  readonly direction: BossInfoPresentationCue["direction"];
  readonly presentationKey: string;
}

export interface U5BattleReplay {
  readonly participants: readonly U5BattleReplayParticipant[];
  readonly frames: readonly U5BattleReplayFrame[];
  readonly outcome: BattleResolution["status"];
  readonly termination: BattleResolution["termination"];
  /** 전투 뒤 신뢰 검증. 화면이 인과 사슬의 마지막 칸으로 쓴다. */
  readonly verifications: readonly U5BattleVerificationView[];
}

export interface U5BattleVerificationView {
  readonly characterId: string;
  readonly action: BossInfoVerification["action"];
  readonly applied: boolean;
}

type ParticipantSource = BattleResolution["party"][number] | BattleResolution["enemies"][number];

function invalid(message: string): never {
  throw new Error(`U5 전투 replay가 유효하지 않다: ${message}`);
}

function addUnique<T extends { readonly id: string }>(map: Map<string, T>, value: T, kind: string): void {
  if (map.has(value.id)) invalid(`${kind} ID가 중복됐다: ${value.id}`);
  map.set(value.id, value);
}

/**
 * `E4` 의 timing 을 재생 단계에 옮긴다.
 *
 * 규칙은 전투 안의 어느 순간인지를 말하고, 재생은 그것을 프레임으로 나눠 놓았다.
 * 둘을 잇는 표가 여기 하나만 있어야 화면이 제 마음대로 고르지 않는다.
 */
const PHASE_BY_TIMING: Readonly<Record<BossInfoPresentationCue["timing"], U5BattleReplayPhase>> = {
  battleStart: "idle",
  beforeTarget: "attack",
  beforeDamage: "impact",
  afterDamage: "settle",
};

function snapshot(
  phase: U5BattleReplayPhase,
  actionIndex: number | null,
  actorId: string | null,
  targetId: string | null,
  damage: number | null,
  hpByParticipantId: Readonly<Record<string, number>>,
  defeatedParticipantIds: ReadonlySet<string>,
  cues: readonly U5BattleCueView[] = [],
): U5BattleReplayFrame {
  return {
    cues,
    phase,
    actionIndex,
    actorId,
    targetId,
    damage,
    hpByParticipantId: { ...hpByParticipantId },
    defeatedParticipantIds: [...defeatedParticipantIds],
  };
}

export function createU5BattleReplay(input: U5BattleReplayInput): U5BattleReplay {
  const participantsById = new Map<string, ParticipantSource>();
  const sideByParticipantId = new Map<string, "party" | "enemy">();
  for (const member of input.resolution.party) {
    addUnique(participantsById, member, "resolution 참가자");
    sideByParticipantId.set(member.id, "party");
  }
  for (const enemy of input.resolution.enemies) {
    addUnique(participantsById, enemy, "resolution 참가자");
    sideByParticipantId.set(enemy.id, "enemy");
  }

  const presentationById = new Map<string, U5BattleParticipantPresentation>();
  for (const presentation of input.presentations) addUnique(presentationById, presentation, "presentation");
  for (const participantId of participantsById.keys()) {
    if (!presentationById.has(participantId)) invalid(`presentation이 없는 참가자다: ${participantId}`);
  }
  for (const presentationId of presentationById.keys()) {
    if (!participantsById.has(presentationId)) invalid(`사용되지 않은 presentation이다: ${presentationId}`);
  }

  const initialHpByParticipantId: Record<string, number> = {};
  for (const action of input.resolution.actions) {
    if (!participantsById.has(action.targetId)) invalid(`알 수 없는 target이다: ${action.targetId}`);
    if (initialHpByParticipantId[action.targetId] === undefined) initialHpByParticipantId[action.targetId] = action.targetHpBefore;
  }
  for (const [participantId, participant] of participantsById) {
    if (initialHpByParticipantId[participantId] === undefined) initialHpByParticipantId[participantId] = participant.hp;
  }

  const participants = [...input.resolution.party.map((member) => [member, "party"] as const), ...input.resolution.enemies.map((enemy) => [enemy, "enemy"] as const)].map(([source, side]) => {
    const presentation = presentationById.get(source.id);
    if (presentation === undefined) invalid(`presentation이 없는 참가자다: ${source.id}`);
    return { id: source.id, side, name: presentation.name, imageSrc: presentation.imageSrc, maxHp: source.maxHp, initialHp: initialHpByParticipantId[source.id], finalHp: source.hp };
  });

  const cueViews = (input.cues ?? []).map((cue) => ({
    actionIndex: cue.actionIndex,
    phase: PHASE_BY_TIMING[cue.timing],
    view: {
      characterId: String(cue.characterId),
      axis: cue.axis,
      direction: cue.direction,
      presentationKey: cue.presentationKey,
    } satisfies U5BattleCueView,
  }));
  const cuesFor = (phase: U5BattleReplayPhase, actionIndex: number | null): readonly U5BattleCueView[] =>
    cueViews.filter((one) => one.phase === phase && one.actionIndex === actionIndex).map((one) => one.view);

  let currentHpByParticipantId: Record<string, number> = { ...initialHpByParticipantId };
  const defeatedParticipantIds = new Set<string>();
    /* battleStart 큐는 어느 행동에도 매이지 않으므로 idle 프레임이 받는다. */
  const frames: U5BattleReplayFrame[] = [snapshot("idle", null, null, null, null, currentHpByParticipantId, defeatedParticipantIds, cueViews.filter((one) => one.phase === "idle").map((one) => one.view))];

  input.resolution.actions.forEach((action, actionIndex) => {
    const actor = participantsById.get(action.actorId);
    const target = participantsById.get(action.targetId);
    if (actor === undefined) invalid(`알 수 없는 actor다: ${action.actorId}`);
    if (target === undefined) invalid(`알 수 없는 target이다: ${action.targetId}`);
    if (sideByParticipantId.get(action.actorId) !== action.actorSide) invalid(`actorSide가 참가자와 맞지 않는다: ${action.actorId}`);
    if (defeatedParticipantIds.has(action.actorId)) invalid(`쓰러진 참가자가 다시 행동한다: ${action.actorId}`);
    /* actor 만 보고 target 을 보지 않으면, 시체를 다시 때리는 action 이 HP 0 → 0
     * 으로 조용히 통과한다. 재생은 아무 일도 일어나지 않는 프레임 세 장을 낳는다. */
    if (defeatedParticipantIds.has(action.targetId)) invalid(`쓰러진 참가자를 다시 노린다: ${action.targetId}`);
    if (currentHpByParticipantId[action.targetId] !== action.targetHpBefore) invalid(`target HP chain이 맞지 않는다: ${action.targetId}`);
    if (action.defeated !== (action.targetHpAfter === 0)) invalid(`defeated와 targetHpAfter가 맞지 않는다: ${action.targetId}`);

    frames.push(snapshot("attack", actionIndex, action.actorId, action.targetId, null, currentHpByParticipantId, defeatedParticipantIds, cuesFor("attack", actionIndex)));
    frames.push(snapshot("impact", actionIndex, action.actorId, action.targetId, action.damage, currentHpByParticipantId, defeatedParticipantIds, cuesFor("impact", actionIndex)));
    currentHpByParticipantId = { ...currentHpByParticipantId, [action.targetId]: action.targetHpAfter };
    if (action.defeated) defeatedParticipantIds.add(action.targetId);
    frames.push(snapshot("settle", actionIndex, action.actorId, action.targetId, null, currentHpByParticipantId, defeatedParticipantIds, cuesFor("settle", actionIndex)));
  });

  for (const [participantId, participant] of participantsById) {
    if (currentHpByParticipantId[participantId] !== participant.hp) invalid(`최종 HP가 resolution과 맞지 않는다: ${participantId}`);
  }
  frames.push(snapshot("complete", null, null, null, null, currentHpByParticipantId, defeatedParticipantIds));

  return {
    participants,
    frames,
    outcome: input.resolution.status,
    termination: input.resolution.termination,
    verifications: (input.verifications ?? []).map((one) => ({
      characterId: String(one.characterId),
      action: one.action,
      applied: one.applied,
    })),
  };
}
