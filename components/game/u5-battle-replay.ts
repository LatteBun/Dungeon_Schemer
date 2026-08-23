import type { BattleResolution } from "@/lib/rules/battle-engine";

export interface U5BattleParticipantPresentation {
  readonly id: string;
  readonly name: string;
  readonly imageSrc: string;
}

export interface U5BattleReplayInput {
  readonly resolution: BattleResolution;
  readonly presentations: readonly U5BattleParticipantPresentation[];
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
}

export interface U5BattleReplay {
  readonly participants: readonly U5BattleReplayParticipant[];
  readonly frames: readonly U5BattleReplayFrame[];
  readonly outcome: BattleResolution["status"];
  readonly termination: BattleResolution["termination"];
}

type ParticipantSource = BattleResolution["party"][number] | BattleResolution["enemies"][number];

function invalid(message: string): never {
  throw new Error(`U5 전투 replay가 유효하지 않다: ${message}`);
}

function addUnique<T extends { readonly id: string }>(map: Map<string, T>, value: T, kind: string): void {
  if (map.has(value.id)) invalid(`${kind} ID가 중복됐다: ${value.id}`);
  map.set(value.id, value);
}

function snapshot(
  phase: U5BattleReplayPhase,
  actionIndex: number | null,
  actorId: string | null,
  targetId: string | null,
  damage: number | null,
  hpByParticipantId: Readonly<Record<string, number>>,
  defeatedParticipantIds: ReadonlySet<string>,
): U5BattleReplayFrame {
  return {
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

  let currentHpByParticipantId: Record<string, number> = { ...initialHpByParticipantId };
  const defeatedParticipantIds = new Set<string>();
  const frames: U5BattleReplayFrame[] = [snapshot("idle", null, null, null, null, currentHpByParticipantId, defeatedParticipantIds)];

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

    frames.push(snapshot("attack", actionIndex, action.actorId, action.targetId, null, currentHpByParticipantId, defeatedParticipantIds));
    frames.push(snapshot("impact", actionIndex, action.actorId, action.targetId, action.damage, currentHpByParticipantId, defeatedParticipantIds));
    currentHpByParticipantId = { ...currentHpByParticipantId, [action.targetId]: action.targetHpAfter };
    if (action.defeated) defeatedParticipantIds.add(action.targetId);
    frames.push(snapshot("settle", actionIndex, action.actorId, action.targetId, null, currentHpByParticipantId, defeatedParticipantIds));
  });

  for (const [participantId, participant] of participantsById) {
    if (currentHpByParticipantId[participantId] !== participant.hp) invalid(`최종 HP가 resolution과 맞지 않는다: ${participantId}`);
  }
  frames.push(snapshot("complete", null, null, null, null, currentHpByParticipantId, defeatedParticipantIds));

  return { participants, frames, outcome: input.resolution.status, termination: input.resolution.termination };
}
