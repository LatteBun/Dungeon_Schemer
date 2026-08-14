import { eventHpDelta } from "@/lib/content/effects";
import { ITEMS } from "@/lib/content/items";
import { RuleError } from "@/lib/domain";
import type {
  CampaignMember,
  ChoiceId,
  DungeonEvent,
  EventChoice,
  Grade,
  ItemDef,
  MemberId,
  TrustChange,
} from "@/lib/domain";
import type { Rng } from "@/lib/rng";
import { evaluateTrust } from "@/lib/rules/trust";
import type { TrustAction } from "@/lib/rules/trust";

export interface ResolveEventChoiceInput {
  readonly event: DungeonEvent;
  readonly choiceId: ChoiceId;
  readonly grade: Grade;
  readonly members: readonly CampaignMember[];
  readonly currentGold: number;
  readonly rng: Rng;
  readonly items?: readonly ItemDef[];
}

export interface EventResolution {
  /** 살아 있던 파티원 전원이 함께 받은 HP 변화. */
  readonly hpDelta: number;
  readonly members: CampaignMember[];
  readonly currentGold: number;
  readonly goldSpent: number;
  readonly trustChanges: TrustChange[];
  readonly casualtyIds: MemberId[];
  readonly wiped: boolean;
  readonly summary: string;
}

/**
 * 행동이 만드는 즉시 신뢰 변화다.
 *
 * 태그마다 따로 두지 않는 이유는 조정할 상수가 두 벌이 되기 때문이다. 파티를
 * 돕는 행동과 위험에 빠뜨리는 행동만 그 자리에서 신뢰를 움직인다.
 */
const TRUST_ACTION_BY_TAG: Partial<Record<EventChoice["effectTags"][number], TrustAction>> = {
  support: "protectAlly",
  sabotage: "betrayAlly",
};

function findChoice(event: DungeonEvent, choiceId: ChoiceId): EventChoice {
  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (choice === undefined) {
    throw new RuleError("UNKNOWN_ID", `사건에 없는 선택지다: ${choiceId}`, {
      eventId: event.id,
      choiceId,
    });
  }
  return choice;
}

/**
 * 거래 상품을 찾는다.
 *
 * 잔액 확인을 상태를 만들기 전에 끝낸다. 골드만 빠지고 효과가 안 들어가는
 * 중간 상태를 만들지 않기 위해서다.
 */
function findPurchase(
  choice: EventChoice,
  currentGold: number,
  items: readonly ItemDef[],
): ItemDef | null {
  if (!choice.effectTags.includes("trade")) return null;

  if (choice.itemId === undefined) {
    throw new RuleError("UNKNOWN_ID", `거래 선택지에 상품이 없다: ${choice.id}`, {
      choiceId: choice.id,
    });
  }
  const item = items.find((candidate) => candidate.id === choice.itemId);
  if (item === undefined) {
    throw new RuleError("UNKNOWN_ID", `없는 상품을 가리킨다: ${choice.itemId}`, {
      choiceId: choice.id,
      itemId: choice.itemId,
    });
  }
  if (item.price > currentGold) {
    throw new RuleError(
      "INSUFFICIENT_GOLD",
      `골드가 부족해 살 수 없다: ${item.name}에 ${item.price}, 보유 ${currentGold}`,
      { choiceId: choice.id, itemId: item.id, price: item.price, currentGold },
    );
  }
  return item;
}

/**
 * 사건 지점의 행동 하나를 적용한다.
 *
 * HP 변화는 살아 있는 파티원 전원에게 같이 적용한다. 사건은 파티 전체가 겪는
 * 상황이고, 개인별 차이는 정보 카드 반응이 만들기 때문이다.
 * docs/superpowers/specs/2026-08-15-sbh3821-event-action-boss-fight-design.md
 */
export function resolveEventChoice(
  input: ResolveEventChoiceInput,
): EventResolution {
  const choice = findChoice(input.event, input.choiceId);
  const purchase = findPurchase(choice, input.currentGold, input.items ?? ITEMS);

  const hpDelta = eventHpDelta(
    input.event.kind,
    choice.effectTags,
    input.grade,
    purchase?.effectTags ?? [],
  );
  const trustAction = choice.effectTags
    .map((tag) => TRUST_ACTION_BY_TAG[tag])
    .find((action): action is TrustAction => action !== undefined);

  const casualtyIds: MemberId[] = [];
  const trustChanges: TrustChange[] = [];
  const members = input.members.map((member) => {
    if (!member.alive) return { ...member };

    const currentHp = Math.max(0, Math.min(member.maxHp, member.currentHp + hpDelta));
    const alive = currentHp > 0;
    if (!alive) casualtyIds.push(member.id);

    const survivor = { ...member, currentHp, alive };
    // 죽은 사람의 신뢰는 움직여도 갈 곳이 없다.
    if (!alive || trustAction === undefined) return survivor;

    const evaluation = evaluateTrust(survivor, trustAction, input.rng);
    trustChanges.push(evaluation.change);
    return evaluation.member;
  });

  const goldSpent = purchase?.price ?? 0;
  const survivorCount = members.filter((member) => member.alive).length;

  return {
    hpDelta,
    members,
    currentGold: input.currentGold - goldSpent,
    goldSpent,
    trustChanges,
    casualtyIds,
    wiped: survivorCount === 0,
    summary: purchase === null
      ? `${input.event.title} · ${choice.label}`
      : `${input.event.title} · ${choice.label} (${purchase.name} ${purchase.price}골드)`,
  };
}
