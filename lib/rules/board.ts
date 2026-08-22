import { canDeploy, BOARD_OFFER_MAX, RANK_RISK_LIMIT, RISK_LEVELS } from "@/lib/domain";
import { RuleError } from "@/lib/domain";
import { createRng, type Rng } from "@/lib/rng";
import type {
  BoardOffer,
  CampaignDungeon,
  CampaignState,
  CharacterId,
  ClassId,
  ExpeditionParty,
  RiskLevel,
} from "@/lib/domain";

type ClassTriple = readonly [ClassId, ClassId, ClassId];

function invalidGeneration(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function shuffledRiskGroups(
  dungeons: readonly CampaignDungeon[],
  descending: boolean,
  rng: Rng,
): CampaignDungeon[] {
  const groups = new Map<RiskLevel, CampaignDungeon[]>();
  for (const dungeon of dungeons) {
    const group = groups.get(dungeon.riskLevel);
    if (group === undefined) {
      groups.set(dungeon.riskLevel, [dungeon]);
    } else {
      group.push(dungeon);
    }
  }

  const levels = [...RISK_LEVELS].sort((left, right) =>
    descending ? right - left : left - right,
  );
  return levels.flatMap((level) => rng.shuffle(groups.get(level) ?? []));
}

function selectDungeons(state: CampaignState, limit: number, rng: Rng): CampaignDungeon[] {
  const remaining = state.dungeons.filter((dungeon) => dungeon.status !== "cleared");
  const riskLimit = RANK_RISK_LIMIT[state.rank];
  const accessible = remaining.filter((dungeon) => dungeon.riskLevel <= riskLimit);
  const locked = remaining.filter((dungeon) => dungeon.riskLevel > riskLimit);

  return [
    ...shuffledRiskGroups(accessible, true, rng),
    ...shuffledRiskGroups(locked, false, rng),
  ].slice(0, limit);
}

function classTriples(classes: readonly ClassId[]): ClassTriple[] {
  const triples: ClassTriple[] = [];
  for (let first = 0; first < classes.length - 2; first += 1) {
    for (let second = first + 1; second < classes.length - 1; second += 1) {
      for (let third = second + 1; third < classes.length; third += 1) {
        triples.push([classes[first], classes[second], classes[third]]);
      }
    }
  }
  return triples;
}

function planKey(classes: readonly ClassId[], remaining: ReadonlyMap<ClassId, number>): string {
  return classes.map((classId) => `${classId}:${remaining.get(classId) ?? 0}`).join("|");
}

function bestClassPlan(
  classes: readonly ClassId[],
  combinations: readonly ClassTriple[],
  remaining: ReadonlyMap<ClassId, number>,
  remainingSlots: number,
  memo: Map<string, readonly ClassTriple[]>,
): readonly ClassTriple[] {
  if (remainingSlots === 0) return [];
  const key = `${remainingSlots}/${planKey(classes, remaining)}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  let best: readonly ClassTriple[] = [];
  for (const combination of combinations) {
    if (combination.some((classId) => (remaining.get(classId) ?? 0) === 0)) continue;
    const next = new Map(remaining);
    for (const classId of combination) {
      next.set(classId, (next.get(classId) ?? 0) - 1);
    }
    const candidate = [
      combination,
      ...bestClassPlan(classes, combinations, next, remainingSlots - 1, memo),
    ] as readonly ClassTriple[];
    if (candidate.length > best.length) best = candidate;
  }

  memo.set(key, best);
  return best;
}

function buildParties(state: CampaignState, rng: Rng): ExpeditionParty[] {
  const idsByClass = new Map<ClassId, CharacterId[]>();
  for (const id of state.pool.order) {
    const character = state.pool.byId[id];
    if (character === undefined || !canDeploy(character)) continue;
    const ids = idsByClass.get(character.classId);
    if (ids === undefined) {
      idsByClass.set(character.classId, [id]);
    } else {
      ids.push(id);
    }
  }

  const classes = [...idsByClass.keys()];
  if (classes.length < 3) return [];

  for (const [classId, ids] of idsByClass) {
    idsByClass.set(classId, rng.shuffle(ids));
  }
  const combinations = rng.shuffle(classTriples(classes));
  const remaining = new Map(classes.map((classId) => [classId, idsByClass.get(classId)?.length ?? 0]));
  const maxSlots = Math.min(BOARD_OFFER_MAX, Math.floor(state.pool.order.length / 3));
  const plan = bestClassPlan(classes, combinations, remaining, maxSlots, new Map());
  const cursors = new Map<ClassId, number>();

  return plan.map((combination) => ({
    memberIds: combination.map((classId) => {
      const ids = idsByClass.get(classId) ?? [];
      const cursor = cursors.get(classId) ?? 0;
      const id = ids[cursor];
      if (id === undefined) {
        return invalidGeneration(`임시 파티 편성이 누락됐다: ${classId}`, {
          contentType: "expeditionParty",
          classId,
        });
      }
      cursors.set(classId, cursor + 1);
      return id;
    }),
  }));
}

/** 현재 상태에서 한 게시판의 공고와 일회성 임시 파티를 만든다. */
export function createBoardOffers(state: CampaignState): readonly BoardOffer[] {
  const root = createRng(`${state.seed}/${state.worldTurn}`);
  const parties = buildParties(state, root.derive("party"));
  if (parties.length === 0) return [];

  const dungeons = selectDungeons(state, Math.min(BOARD_OFFER_MAX, parties.length), root.derive("board"));
  return dungeons.map((dungeon, index) => ({
    id: `offer-${state.worldTurn}-${dungeon.id}` as BoardOffer["id"],
    dungeonId: dungeon.id,
    riskLevel: dungeon.riskLevel,
    party: { memberIds: [...(parties[index]?.memberIds ?? [])] },
    lockReason: dungeon.riskLevel > RANK_RISK_LIMIT[state.rank] ? "rankTooLow" : null,
  }));
}
