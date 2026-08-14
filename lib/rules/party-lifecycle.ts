import { CAMPAIGN_PARTY_SIZE, RuleError } from "@/lib/domain";
import type {
  CampaignMember,
  CampaignParty,
  CampaignState,
  ClassId,
  ExpeditionResult,
  MemberId,
  PartyId,
} from "@/lib/domain";
import type { Rng } from "@/lib/rng";

/** 비출전 생존자가 한 정산에서 회복하는 현재 HP 비율. */
export const REST_HEAL_RATIO = 0.05;

/**
 * 출전하지 않은 생존자만 회복시킨 새 목록을 반환한다.
 *
 * 회복량 = max(1, round(현재 HP × 0.05)), 회복 후 HP = min(최대, 현재 + 회복량).
 * 비율만 쓰면 HP가 낮을수록 회복이 0에 수렴해 다시 못 일어서므로 최소 1을 둔다.
 * docs/systems/PARTY_AND_TRUST.md
 */
export function healNonParticipants(
  members: readonly CampaignMember[],
  participantIds: ReadonlySet<MemberId>,
): CampaignMember[] {
  return members.map((member) => {
    if (!member.alive || participantIds.has(member.id)) return { ...member };

    const amount = Math.max(1, Math.round(member.currentHp * REST_HEAL_RATIO));
    return {
      ...member,
      currentHp: Math.min(member.maxHp, member.currentHp + amount),
    };
  });
}

/**
 * 직업별 인원이 `counts`일 때 만들 수 있는 완성 파티의 최대 개수다.
 *
 * 한 파티는 서로 다른 직업 3명이므로 한 직업은 파티마다 최대 한 명 들어간다.
 * 따라서 파티 k개를 만들 수 있는 조건은 `sum min(c_i, k) >= 3k`다. 탐색이
 * 아니라 계산이므로 결과가 항상 최적이다.
 */
function maxCompleteParties(counts: readonly number[], total: number): number {
  for (
    let parties = Math.floor(total / CAMPAIGN_PARTY_SIZE);
    parties > 0;
    parties -= 1
  ) {
    const capacity = counts.reduce(
      (sum, count) => sum + Math.min(count, parties),
      0,
    );
    if (capacity >= CAMPAIGN_PARTY_SIZE * parties) return parties;
  }
  return 0;
}

/**
 * 주어진 인물들로 완성 3인 파티를 최대한 만든다.
 *
 * 파티 수(1순위)는 위 계산으로 항상 최적이다. 매 자리에서 남은 인원이 가장
 * 많은 직업부터 쓰면 남은 직업 분포가 한쪽으로 쏠리지 않아 그 최적값에
 * 도달한다.
 *
 * 기존 동료 쌍(2순위)은 입력 순서로 표현한다. 호출자가 같은 파티였던 사람을
 * 붙여서 넘기면, 같은 직업 후보 중 앞선 사람을 고르는 규칙이 동료를 함께
 * 남긴다. 전역 최적해는 조합 폭발이라 프로토타입 범위에서 풀지 않는다.
 * docs/superpowers/specs/2026-08-14-sbh3821-persistent-party-design.md
 */
export function regroupSurvivors(
  memberIds: readonly MemberId[],
  availableMembers: readonly CampaignMember[],
  rng: Rng,
): CampaignParty[] {
  const byId = new Map(availableMembers.map((member) => [member.id, member]));
  const pool = memberIds
    .map((id) => byId.get(id))
    .filter((member): member is CampaignMember => member?.alive === true);

  // 직업별 대기열. 입력 순서를 유지해 동료가 붙어 있게 한다.
  const queues = new Map<ClassId, CampaignMember[]>();
  for (const member of pool) {
    const queue = queues.get(member.classId) ?? [];
    queue.push(member);
    queues.set(member.classId, queue);
  }

  const target = maxCompleteParties(
    [...queues.values()].map((queue) => queue.length),
    pool.length,
  );
  if (target === 0) return [];

  // 남은 인원이 같은 직업들 사이의 순서는 시드로 정한다.
  const classOrder = rng.shuffle([...queues.keys()]);
  const parties: CampaignParty[] = [];

  for (let index = 0; index < target; index += 1) {
    const chosen = classOrder
      .filter((classId) => (queues.get(classId)?.length ?? 0) > 0)
      .sort(
        (left, right) =>
          (queues.get(right)?.length ?? 0) - (queues.get(left)?.length ?? 0),
      )
      .slice(0, CAMPAIGN_PARTY_SIZE);

    parties.push({
      id: `party-regroup-${index + 1}` as PartyId,
      memberIds: chosen.map((classId) => {
        const queue = queues.get(classId);
        if (queue === undefined || queue.length === 0) {
          throw new RuleError(
            "INVALID_GENERATION",
            `재편 중 ${classId} 직업의 후보가 사라졌다.`,
            { classId },
          );
        }
        return queue.shift()!.id;
      }),
      complete: true,
    });
  }

  return parties;
}

function assertResultIsValid(
  state: CampaignState,
  result: ExpeditionResult,
): void {
  const memberById = new Map(state.members.map((member) => [member.id, member]));
  const participants = [...result.survivorIds, ...result.casualtyIds];

  for (const id of participants) {
    if (!memberById.has(id)) {
      throw new RuleError("UNKNOWN_ID", `캠페인에 없는 인물이다: ${id}`, {
        memberId: id,
      });
    }
  }

  if (new Set(participants).size !== participants.length) {
    throw new RuleError(
      "DUPLICATE_ID",
      "생존자와 사망자 목록에 같은 인물이 있다.",
      { participants },
    );
  }

  for (const id of result.survivorIds) {
    if (memberById.get(id)?.alive === false) {
      throw new RuleError(
        "INVALID_SETTLEMENT",
        `이미 죽은 인물이 생존자로 보고됐다: ${id}`,
        { memberId: id },
      );
    }
  }

  const assigned = new Set(
    state.parties.flatMap((party) => party.memberIds as readonly string[]),
  );
  for (const id of participants) {
    if (!assigned.has(id)) {
      throw new RuleError(
        "INVALID_SETTLEMENT",
        `어떤 파티에도 속하지 않은 인물이 출전했다: ${id}`,
        { memberId: id },
      );
    }
  }
}

/**
 * 정산 결과를 받아 파티 유지·충원·재편·회복을 한 번에 적용한다.
 *
 * 출전자 명단은 반드시 `result`에서 읽는다. 재편 뒤의 파티 구성에서 읽으면
 * 충원으로 들어온 예비가 출전자로 오인되고, 다른 파티로 옮겨간 생존자가
 * 비출전자로 오인된다.
 * docs/superpowers/specs/2026-08-14-sbh3821-persistent-party-design.md
 */
export function maintainPartiesAfterExpedition(
  state: CampaignState,
  result: ExpeditionResult,
  rng: Rng,
): CampaignState {
  assertResultIsValid(state, result);

  const casualties = new Set<string>(result.casualtyIds);
  const participantIds = new Set<MemberId>([
    ...result.survivorIds,
    ...result.casualtyIds,
  ]);

  const members = state.members.map((member) =>
    casualties.has(member.id) ? { ...member, alive: false } : { ...member },
  );
  const memberById = new Map(members.map((member) => [member.id, member]));
  const aliveIn = (ids: readonly MemberId[]): MemberId[] =>
    ids.filter((id) => memberById.get(id)?.alive === true);

  const reserves = aliveIn(state.reserveMemberIds);
  const usedReserves = new Set<string>();

  // 생존자가 많은 파티부터 채운다. 2명 팀은 한 명만 채우면 완성되므로
  // 1명 팀을 먼저 채워 예비를 소진하는 것보다 완성 파티가 많아진다.
  const survivorsByParty = state.parties.map((party) => ({
    party,
    survivors: aliveIn(party.memberIds),
  }));
  const fillOrder = [...survivorsByParty].sort(
    (left, right) => right.survivors.length - left.survivors.length,
  );

  const filled = new Map<string, MemberId[]>();
  for (const { party, survivors } of fillOrder) {
    const roster = [...survivors];
    if (roster.length === 0 || roster.length >= CAMPAIGN_PARTY_SIZE) {
      filled.set(party.id, roster);
      continue;
    }

    const taken = new Set(
      roster.map((id) => memberById.get(id)?.classId as string),
    );
    for (const reserveId of rng.shuffle(reserves)) {
      if (roster.length >= CAMPAIGN_PARTY_SIZE) break;
      if (usedReserves.has(reserveId)) continue;
      const classId = memberById.get(reserveId)?.classId as string;
      if (taken.has(classId)) continue;
      roster.push(reserveId);
      taken.add(classId);
      usedReserves.add(reserveId);
    }
    filled.set(party.id, roster);
  }

  let parties: CampaignParty[] = state.parties.map((party) => {
    const roster = filled.get(party.id) ?? [];
    return {
      ...party,
      memberIds: roster,
      complete: roster.length === CAMPAIGN_PARTY_SIZE,
    };
  });

  const leftoverReserves = reserves.filter((id) => !usedReserves.has(id));

  // 충원으로 완성하지 못한 파티가 남으면 손상 파티 생존자·대기 인물·남은
  // 예비를 한 풀로 모아 다시 짠다. 같은 파티였던 사람을 붙여서 넘겨
  // 재편이 동료를 함께 남기게 한다.
  const damaged = parties.filter((party) => !party.complete);
  let waiting = aliveIn(state.waitingMemberIds);
  let remainingReserves = leftoverReserves;

  if (damaged.length > 0) {
    const reserveSet = new Set<string>(leftoverReserves);
    const pool = [
      ...damaged.flatMap((party) => party.memberIds),
      ...waiting,
      ...leftoverReserves,
    ];
    const regrouped = regroupSurvivors(pool, members, rng);

    // 해체한 파티의 ID를 다시 쓴다. 새 ID를 계속 만들면 캠페인이 길어질수록
    // 화면과 로그가 가리키는 파티 ID가 흩어진다.
    const reusableIds = damaged
      .map((party) => party.id)
      .sort((left, right) => left.localeCompare(right));
    const rebuilt = regrouped.map((party, index) => ({
      ...party,
      id: reusableIds[index] ?? party.id,
    }));
    const placed = new Set<string>(
      rebuilt.flatMap((party) => party.memberIds as readonly string[]),
    );

    parties = [...parties.filter((party) => party.complete), ...rebuilt];

    // 배치되지 못한 사람 중 예비였던 사람은 예비로 돌아간다. 예비와 대기는
    // 다른 명단이므로 재편에 참여했다는 이유로 섞지 않는다.
    const unplaced = pool.filter((id) => !placed.has(id));
    waiting = unplaced.filter((id) => !reserveSet.has(id));
    remainingReserves = unplaced.filter((id) => reserveSet.has(id));
  }

  return {
    ...state,
    members: healNonParticipants(members, participantIds),
    parties,
    reserveMemberIds: remainingReserves,
    waitingMemberIds: waiting,
  };
}
