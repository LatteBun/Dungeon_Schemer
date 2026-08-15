import { Panel } from "@/components/ui/Panel";
import type { MemberReactionView } from "./expedition-view-model";

interface PartyReactionSidebarProps {
  reactions: MemberReactionView[];
}

export function PartyReactionSidebar({ reactions }: PartyReactionSidebarProps) {
  return (
    <Panel title="개인별 정보 반응">
      {reactions.length === 0 ? (
        <p className="text-sm text-muted">카드를 고르면 파티원별 반응이 나타납니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reactions.map((reaction) => {
            const deltaText = reaction.trustDelta > 0
              ? `▲${reaction.trustDelta}`
              : reaction.trustDelta < 0
                ? `▼${Math.abs(reaction.trustDelta)}`
                : "변화 없음";
            return (
              <li key={reaction.memberId} className="rounded border border-edge px-3 py-2">
                <p className="text-sm text-parchment">
                  {reaction.name}
                  <span className="ml-1 text-xs text-muted">
                    {reaction.className} · {reaction.personalityLabel}
                  </span>
                </p>
                <p className="mt-1 text-xs text-parchment">
                  {reaction.reactionMark} {reaction.reactionLabel} · 신뢰 {reaction.trust} ({deltaText})
                </p>
                <p className="mt-1 text-xs text-muted">{reaction.note}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
