import { RuleError } from "@/lib/domain";
import type {
  Character,
  MerchantAdviceOption,
  NextBattleMerchantEffect,
  PendingMerchantEffect,
} from "@/lib/domain";

export type MerchantAdviceAvailability =
  | { executable: true }
  | { executable: false; reason: "insufficientGold" | "pendingEffect" };

function invalidState(
  message: string,
  details: Record<string, unknown>,
): never {
  throw new RuleError("INVALID_STATE", message, details);
}

function assertValidGold(gold: number): void {
  if (!Number.isInteger(gold) || gold < 0) {
    invalidState("현재 골드는 0 이상의 정수여야 한다", {
      field: "gold",
      gold,
    });
  }
}

function assertValidNextBattleEffect(
  nextBattle: NextBattleMerchantEffect,
  details: Record<string, unknown>,
): void {
  const incoming = nextBattle.incomingDamageMultiplier;
  const party = nextBattle.partyDamageMultiplier;
  const values = [incoming, party].filter(
    (value): value is number => value !== undefined,
  );

  if (
    values.length !== 1 ||
    !Number.isFinite(values[0]) ||
    values[0] <= 0
  ) {
    invalidState("다음 전투 merchant 효과가 유효하지 않다", {
      ...details,
      incomingDamageMultiplier: incoming,
      partyDamageMultiplier: party,
    });
  }
}

function assertValidPendingEffect(
  pendingMerchantEffect: PendingMerchantEffect | null,
): void {
  if (pendingMerchantEffect === null) return;

  if (
    typeof pendingMerchantEffect.adviceId !== "string" ||
    pendingMerchantEffect.adviceId.length === 0
  ) {
    invalidState("pending merchant 효과의 조언 ID가 유효하지 않다", {
      field: "pendingMerchantEffect.adviceId",
      adviceId: pendingMerchantEffect.adviceId,
    });
  }

  assertValidNextBattleEffect(pendingMerchantEffect.nextBattle, {
    field: "pendingMerchantEffect.nextBattle",
    adviceId: pendingMerchantEffect.adviceId,
  });
}

function assertValidMembers(members: readonly Character[]): void {
  for (const member of members) {
    if (!Number.isInteger(member.maxHp) || member.maxHp <= 0) {
      invalidState("파티원의 최대 HP가 유효하지 않다", {
        field: "members.maxHp",
        characterId: member.id,
        maxHp: member.maxHp,
      });
    }
    if (
      !Number.isInteger(member.hp) ||
      member.hp < 1 ||
      member.hp > member.maxHp
    ) {
      invalidState("파티원의 HP가 유효하지 않다", {
        field: "members.hp",
        characterId: member.id,
        hp: member.hp,
        maxHp: member.maxHp,
      });
    }
  }
}

function nextBattleEffectOf(
  advice: MerchantAdviceOption,
): NextBattleMerchantEffect | undefined {
  if (advice.outcome === "neutral") return undefined;
  return advice.merchantEffect.nextBattle;
}

export function getMerchantAdviceAvailability(
  advice: MerchantAdviceOption,
  gold: number,
  pendingMerchantEffect: PendingMerchantEffect | null,
): MerchantAdviceAvailability {
  assertValidGold(gold);
  assertValidPendingEffect(pendingMerchantEffect);

  if (gold < advice.goldCost) {
    return { executable: false, reason: "insufficientGold" };
  }
  if (
    pendingMerchantEffect !== null &&
    nextBattleEffectOf(advice) !== undefined
  ) {
    return { executable: false, reason: "pendingEffect" };
  }
  return { executable: true };
}

export function applyAcceptedMerchantAdvice<M extends Character>(input: {
  advice: MerchantAdviceOption;
  gold: number;
  members: readonly M[];
  pendingMerchantEffect: PendingMerchantEffect | null;
}): {
  gold: number;
  members: readonly M[];
  pendingMerchantEffect: PendingMerchantEffect | null;
} {
  const availability = getMerchantAdviceAvailability(
    input.advice,
    input.gold,
    input.pendingMerchantEffect,
  );
  if (!availability.executable) {
    if (availability.reason === "insufficientGold") {
      throw new RuleError(
        "INSUFFICIENT_GOLD",
        "골드가 부족해 merchant 조언을 실행할 수 없다",
        {
          adviceId: input.advice.id,
          gold: input.gold,
          goldCost: input.advice.goldCost,
        },
      );
    }
    invalidState("다음 전투 merchant 효과가 이미 예약되어 있다", {
      adviceId: input.advice.id,
      pendingAdviceId: input.pendingMerchantEffect?.adviceId,
    });
  }

  assertValidMembers(input.members);

  const immediateDelta = input.advice.outcome === "neutral"
    ? undefined
    : input.advice.merchantEffect.immediateHpDeltaPerMember;
  const members = immediateDelta === undefined
    ? input.members
    : input.members.map((member) => {
      if (!member.alive) return member;
      return {
        ...member,
        hp: Math.min(member.maxHp, Math.max(1, member.hp + immediateDelta)),
      };
    });

  const nextBattle = nextBattleEffectOf(input.advice);
  const pendingMerchantEffect = nextBattle === undefined
    ? input.pendingMerchantEffect
    : {
      adviceId: input.advice.id,
      nextBattle: { ...nextBattle },
    };

  return {
    gold: input.gold - input.advice.goldCost,
    members,
    pendingMerchantEffect,
  };
}

export function consumePendingMerchantEffect(
  pendingMerchantEffect: PendingMerchantEffect | null,
): {
  pendingMerchantEffect: null;
  nextBattle: NextBattleMerchantEffect | null;
} {
  assertValidPendingEffect(pendingMerchantEffect);

  return {
    pendingMerchantEffect: null,
    nextBattle: pendingMerchantEffect === null
      ? null
      : { ...pendingMerchantEffect.nextBattle },
  };
}
