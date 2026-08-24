import type { ActiveExpeditionContext, CampaignState, ChoiceId } from "@/lib/domain";
import { getMerchantAdviceAvailability } from "@/lib/rules/merchant";

/**
 * 지금 실제로 고를 수 있는 조언 하나.
 *
 * 상인 사건에는 살 수 없는 선택지가 섞인다 — 골드가 모자라거나 이미 사 둔 것이
 * 남아 있으면 `C4` 가 막는다. 화면은 그런 선택지의 버튼을 잠그므로 길잡이는
 * 애초에 누를 수 없다.
 *
 * 캠페인을 자동으로 걷는 순회가 그 제약을 모르면, 사람은 할 수 없는 조작을
 * 넣고 거부를 만난다. 순회도 사람처럼 고르게 하는 자리다.
 */
export function firstChoosableAdvice(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
  /** 여러 판을 고루 보고 싶을 때 시작 위치를 옮긴다. */
  offset = 0,
): ChoiceId {
  const event = active.pendingEvent;
  if (event === null) throw new Error("고를 조언이 없다");

  const options = event.kind !== "merchant"
    ? event.advice
    : event.advice.filter((advice) => getMerchantAdviceAvailability(
      advice,
      campaign.gold,
      active.expedition.pendingMerchantEffect,
    ).executable);

  /* 전부 막혔으면 그대로 넘긴다. 규칙이 거부하는 것이 옳고, 그것도 봐야 한다. */
  const pool = options.length === 0 ? event.advice : options;
  return pool[offset % pool.length]!.id;
}
