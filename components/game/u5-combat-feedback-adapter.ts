import type { ActiveExpeditionContext, CampaignState, MemberReaction } from "@/lib/domain";
import { inFormationOrder } from "./party-formation-order";
import type { U5CombatFeedbackView, U5FeedbackLine, U5FeedbackValueChange } from "./u5-combat-feedback";

type PreReaction = MemberReaction["reaction"];
type PostReaction = "adviceHelped" | "adviceHarmed" | "suspicionWasCorrect" | "suspicionWasCostly";

const PRE_BATTLE_COPY: Readonly<Record<PreReaction, string>> = {
  accepted: "알겠어. 네 말대로 하지.",
  suspected: "잠깐, 그대로 따르기엔 수상한데.",
  exposed: "처음부터 우릴 속이려 했군.",
};

const POST_BATTLE_COPY: Readonly<Record<PostReaction, string>> = {
  adviceHelped: "이번에는 네 조언이 맞았어.",
  adviceHarmed: "네 말을 믿은 게 실수였군.",
  suspicionWasCorrect: "역시 그대로 따르지 않길 잘했어.",
  suspicionWasCostly: "의심하느라 기회를 놓쳤군.",
};

export function u5PreBattleLine(reaction: PreReaction): string {
  return PRE_BATTLE_COPY[reaction];
}

export function u5PostBattleLine(reaction: "accepted" | "suspected", delta: number): string {
  const result: PostReaction = reaction === "accepted"
    ? delta >= 0 ? "adviceHelped" : "adviceHarmed"
    : delta >= 0 ? "suspicionWasCostly" : "suspicionWasCorrect";
  return POST_BATTLE_COPY[result];
}

function postLineForAction(action: string): string | null {
  return action in POST_BATTLE_COPY ? POST_BATTLE_COPY[action as PostReaction] : null;
}

export function selectU5FeedbackMember(
  changes: readonly U5FeedbackValueChange[],
  seatOrder: readonly string[],
): U5FeedbackValueChange | undefined {
  const seats = new Map(seatOrder.map((id, index) => [id, index]));
  return [...changes].sort((left, right) => {
    const delta = Math.abs(right.after - right.before) - Math.abs(left.after - left.before);
    if (delta !== 0) return delta;
    return (seats.get(left.memberId) ?? Number.MAX_SAFE_INTEGER) - (seats.get(right.memberId) ?? Number.MAX_SAFE_INTEGER);
  })[0];
}

/*
 * 같은 폭으로 변한 사람이 둘이면 화면에서 앞선 쪽을 고른다. 화면이 쓰는 차례와
 * 같아야 「저 사람 얘기구나」가 맞는다.
 */
function seatOrder(campaign: CampaignState, active: ActiveExpeditionContext): readonly string[] {
  return inFormationOrder(active.partyMembers, (member) => String(member.classId)).map((member) => String(member.id));
}

function nameOf(active: ActiveExpeditionContext, memberId: string): string {
  return active.partyMembers.find((member) => String(member.id) === memberId)?.name ?? memberId;
}

function changesOf(changes: readonly { readonly characterId: unknown; readonly before: number; readonly after: number }[]): readonly U5FeedbackValueChange[] {
  return changes.map((change) => ({ memberId: String(change.characterId), before: change.before, after: change.after }));
}

function signature(kind: "event" | "boss", active: ActiveExpeditionContext, identity: string, changes: readonly U5FeedbackValueChange[]): string {
  return [kind, active.expeditionId, active.records.length, identity, ...changes
    .map((change) => `${change.memberId}:${change.before}:${change.after}`).sort()].join("|");
}

function line(active: ActiveExpeditionContext, memberId: string, text: string): U5FeedbackLine {
  return { memberId, memberName: nameOf(active, memberId), text };
}

export function eventCombatFeedbackFor(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
): U5CombatFeedbackView | undefined {
  const outcome = active.pendingOutcome;
  if (outcome?.battle === null || outcome === null) return undefined;
  const seats = seatOrder(campaign, active);
  const reactions = outcome.reactions.map((reaction) => ({ memberId: String(reaction.characterId), reaction: reaction.reaction }));
  const exposedIds = new Set(reactions.filter((reaction) => reaction.reaction === "exposed").map((reaction) => reaction.memberId));
  const allChanges = changesOf(outcome.trustChanges);
  const immediateTrustChanges = allChanges.filter((change) => exposedIds.has(change.memberId));
  const postBattleTrustChanges = allChanges.filter((change) => !exposedIds.has(change.memberId));
  const exposed = selectU5FeedbackMember(immediateTrustChanges, seats);
  const pre = exposed === undefined
    ? reactions.find((reaction) => reaction.reaction === "accepted") ?? reactions.find((reaction) => reaction.reaction === "suspected")
    : reactions.find((reaction) => reaction.memberId === exposed.memberId && reaction.reaction === "exposed");
  const post = selectU5FeedbackMember(postBattleTrustChanges, seats);
  const postReaction = post === undefined ? undefined : reactions.find((reaction) => reaction.memberId === post.memberId);
  return {
    signature: signature("event", active, String(outcome.event.id), allChanges),
    kind: "event",
    consequenceText: outcome.resultText,
    preBattleReaction: pre === undefined ? null : line(active, pre.memberId, u5PreBattleLine(pre.reaction)),
    immediateTrustChanges,
    postBattleReaction: post === undefined || postReaction === undefined || postReaction.reaction === "exposed"
      ? null
      : line(active, post.memberId, u5PostBattleLine(postReaction.reaction, post.after - post.before)),
    postBattleTrustChanges,
  };
}

export function bossCombatFeedbackFor(
  campaign: CampaignState,
  active: ActiveExpeditionContext,
): U5CombatFeedbackView | undefined {
  const result = active.expedition.bossResult;
  const record = active.records.at(-1);
  if (result === null || record === undefined) return undefined;
  const changes = changesOf(record.trustChanges);
  const selected = selectU5FeedbackMember(changes, seatOrder(campaign, active));
  const verification = selected === undefined ? undefined : result.verifications.find((one) => String(one.characterId) === selected.memberId);
  const text = verification === undefined ? null : postLineForAction(verification.action);
  return {
    signature: signature("boss", active, String(active.expedition.dungeonId), changes),
    kind: "boss",
    consequenceText: null,
    preBattleReaction: null,
    immediateTrustChanges: [],
    postBattleReaction: selected === undefined || text === null ? null : line(active, selected.memberId, text),
    postBattleTrustChanges: changes,
  };
}
