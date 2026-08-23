import type { Rng } from "@/lib/rng";

import type { Character } from "./character";
import type { CharacterPool, ExpeditionParty } from "./pool";
import { RuleError } from "./errors";
import type { CharacterId } from "./ids";

/** 원정에 나가지 않은 캐릭터가 한 턴 동안 하는 일. */
export type WorldTurnActivity = "forcedRest" | "rest" | "background";

export const WORLD_TURN_ACTIVITIES = [
  "forcedRest",
  "rest",
  "background",
] as const satisfies readonly WorldTurnActivity[];

/** HP가 최대의 이 비율 미만이면 강제 휴식이다. */
export const FORCED_REST_HP_RATIO = 0.5;
/** 처리 후 HP가 최대의 이 비율 미만이면 중상이다. */
export const GRAVELY_WOUNDED_HP_RATIO = 0.2;
/** 휴식 회복량은 최대 HP 비례다. 현재 HP 비례는 크게 다칠수록 덜 회복한다. */
export const REST_RECOVERY_RATIO = 0.15;
export const REST_RECOVERY_MIN = 2;
/** 백그라운드 원정에서는 사망하지 않는다. */
export const BACKGROUND_HP_FLOOR = 1;

export interface WorldTurnAssignment {
  characterId: CharacterId;
  activity: WorldTurnActivity;
}

/** 한 캐릭터의 월드턴 처리 결과. 화면이 사유를 지어내지 않도록 규칙이 남긴다. */
export interface WorldTurnOutcome {
  characterId: CharacterId;
  activity: WorldTurnActivity;
  hpDelta: number;
  goldDelta: number;
  /** 이 턴에 중상이 되었는지. 이미 중상이었다가 풀린 경우는 false다. */
  becameGravelyWounded: boolean;
  reason: string;
}

export interface WorldTurnResult {
  worldTurn: number;
  outcomes: readonly WorldTurnOutcome[];
}

export interface WorldTurnExecution {
  pool: CharacterPool;
  result: WorldTurnResult;
}

export function runWorldTurn(
  pool: CharacterPool,
  expeditionParty: ExpeditionParty,
  worldTurn: number,
  worldturnRng: Rng,
): WorldTurnExecution {
  validateWorldTurnInput(pool, expeditionParty, worldTurn);
  const assignments = selectWorldTurnAssignments(pool, expeditionParty, worldturnRng);
  const nextById = { ...pool.byId } as Record<CharacterId, Character>;
  const outcomes = assignments.map((assignment) => {
    const applied = applyWorldTurnAssignment(
      nextById[assignment.characterId],
      assignment,
      worldturnRng,
    );
    nextById[assignment.characterId] = applied.character;
    return applied.outcome;
  });

  return {
    pool: { byId: nextById, order: [...pool.order] },
    result: { worldTurn: worldTurn + 1, outcomes },
  };
}

function validateWorldTurnInput(
  pool: CharacterPool,
  expeditionParty: ExpeditionParty,
  worldTurn: number,
): void {
  if (!Number.isInteger(worldTurn) || worldTurn < 0) {
    throw new RuleError("INVALID_STATE", "월드턴 번호가 유효하지 않다", {
      field: "worldTurn",
    });
  }

  const orderedIds = new Set(pool.order);
  if (orderedIds.size !== pool.order.length) {
    throw new RuleError("INVALID_STATE", "캐릭터 풀 순서에 중복 ID가 있다", {
      field: "pool.order",
    });
  }

  const poolIds = Object.keys(pool.byId);
  const poolIdSet = new Set(poolIds);
  if (
    poolIds.length !== pool.order.length ||
    pool.order.some((characterId) => !poolIdSet.has(characterId))
  ) {
    throw new RuleError("INVALID_STATE", "캐릭터 풀의 ID 집합이 맞지 않다", {
      field: "pool",
    });
  }

  for (const [key, member] of Object.entries(pool.byId)) {
    const characterId = key as CharacterId;
    if (member.id !== characterId) {
      throw new RuleError("INVALID_STATE", "캐릭터 ID가 키와 다르다", {
        field: "byId",
        characterId,
      });
    }
    if (!Number.isInteger(member.maxHp) || member.maxHp <= 0) {
      throw new RuleError("INVALID_STATE", "최대 HP가 유효하지 않다", {
        field: "maxHp",
        characterId,
      });
    }
    if (
      !Number.isInteger(member.hp) ||
      member.hp < 0 ||
      member.hp > member.maxHp ||
      (member.alive && member.hp === 0) ||
      (!member.alive && member.hp !== 0)
    ) {
      throw new RuleError("INVALID_STATE", "HP가 유효하지 않다", {
        field: "hp",
        characterId,
      });
    }
    if (!Number.isInteger(member.gold) || member.gold < 0) {
      throw new RuleError("INVALID_STATE", "골드가 유효하지 않다", {
        field: "gold",
        characterId,
      });
    }
    if (!Number.isInteger(member.trust) || member.trust < 0 || member.trust > 100) {
      throw new RuleError("INVALID_STATE", "신뢰가 유효하지 않다", {
        field: "trust",
        characterId,
      });
    }
  }

  const partyIds = new Set(expeditionParty.memberIds);
  if (partyIds.size !== expeditionParty.memberIds.length) {
    throw new RuleError("DUPLICATE_ID", "원정 파티에 중복 ID가 있다", {
      field: "expeditionParty.memberIds",
    });
  }
  for (const characterId of expeditionParty.memberIds) {
    if (!pool.byId[characterId]) {
      throw new RuleError("UNKNOWN_ID", "원정 파티에 알 수 없는 캐릭터 ID가 있다", {
        characterId,
      });
    }
  }
}

function selectWorldTurnAssignments(
  pool: CharacterPool,
  expeditionParty: ExpeditionParty,
  worldturnRng: Rng,
): WorldTurnAssignment[] {
  const partyIds = new Set(expeditionParty.memberIds);
  const assignmentsById = new Map<CharacterId, WorldTurnActivity>();
  const candidates: CharacterId[] = [];

  for (const characterId of pool.order) {
    const member = pool.byId[characterId];
    if (partyIds.has(characterId) || !member.alive) continue;

    if (member.gravelyWounded) {
      assignmentsById.set(characterId, "rest");
      continue;
    }
    if (member.hp / member.maxHp < FORCED_REST_HP_RATIO) {
      assignmentsById.set(characterId, "forcedRest");
      continue;
    }
    candidates.push(characterId);
  }

  const shuffledCandidates = worldturnRng.shuffle(candidates);
  const restCount = Math.ceil(shuffledCandidates.length / 2);
  shuffledCandidates.forEach((characterId, index) => {
    assignmentsById.set(characterId, index < restCount ? "rest" : "background");
  });

  return pool.order.flatMap((characterId) => {
    const activity = assignmentsById.get(characterId);
    return activity ? [{ characterId, activity }] : [];
  });
}

interface AppliedWorldTurn {
  character: Character;
  outcome: WorldTurnOutcome;
}

function applyWorldTurnAssignment(
  member: Character,
  assignment: WorldTurnAssignment,
  worldturnRng: Rng,
): AppliedWorldTurn {
  if (assignment.activity === "background") {
    const lossPercent = worldturnRng.int(10, 20);
    const hpLoss = Math.max(1, Math.round((member.maxHp * lossPercent) / 100));
    const nextHp = Math.max(BACKGROUND_HP_FLOOR, member.hp - hpLoss);
    const goldDelta = worldturnRng.int(5, 15);
    return buildAppliedWorldTurn(
      member,
      assignment,
      nextHp,
      goldDelta,
      `월드턴 백그라운드 원정: HP -${member.hp - nextHp}, 골드 +${goldDelta}`,
    );
  }

  const recovery = Math.max(
    REST_RECOVERY_MIN,
    Math.round(member.maxHp * REST_RECOVERY_RATIO),
  );
  const nextHp = Math.min(member.maxHp, member.hp + recovery);
  const hpDelta = nextHp - member.hp;
  return buildAppliedWorldTurn(
    member,
    assignment,
    nextHp,
    0,
    `월드턴 ${assignment.activity === "forcedRest" ? "강제 휴식" : "휴식"}: HP +${hpDelta}`,
  );
}

function buildAppliedWorldTurn(
  member: Character,
  assignment: WorldTurnAssignment,
  nextHp: number,
  goldDelta: number,
  baseReason: string,
): AppliedWorldTurn {
  const nextGravelyWounded = nextHp / member.maxHp < GRAVELY_WOUNDED_HP_RATIO;
  const becameGravelyWounded = !member.gravelyWounded && nextGravelyWounded;
  const woundedReason = becameGravelyWounded
    ? "중상 발생"
    : member.gravelyWounded && !nextGravelyWounded
      ? "중상 해제"
      : undefined;

  return {
    character: {
      ...member,
      hp: nextHp,
      gold: member.gold + goldDelta,
      gravelyWounded: nextGravelyWounded,
    },
    outcome: {
      characterId: assignment.characterId,
      activity: assignment.activity,
      hpDelta: nextHp - member.hp,
      goldDelta,
      becameGravelyWounded,
      reason: woundedReason ? `${baseReason}, ${woundedReason}` : baseReason,
    },
  };
}
