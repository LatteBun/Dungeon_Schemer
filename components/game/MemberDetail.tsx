import type {
  PersonalityProfile,
  ReactionStrength,
  TrustReaction,
} from "@/lib/rules/personality-profile";
import type { TrustHistoryEntry } from "@/lib/rules/trust-history";

/** 색과 기호에만 기대지 않도록 스크린 리더에 읽을 말을 따로 둔다. */
const LIKE_LABELS: Record<ReactionStrength, string> = {
  3: "매우 좋아함",
  2: "좋아함",
  1: "조금 좋아함",
};

const GUARD_LABELS: Record<ReactionStrength, string> = {
  3: "매우 경계함",
  2: "경계함",
  1: "조금 경계함",
};

interface ReactionListProps {
  title: string;
  reactions: TrustReaction[];
  mark: string;
  markClassName: string;
  srLabels: Record<ReactionStrength, string>;
}

function ReactionList({
  title,
  reactions,
  mark,
  markClassName,
  srLabels,
}: ReactionListProps) {
  if (reactions.length === 0) return null;
  return (
    <>
      <h4 className="mt-2 text-xs font-semibold text-muted">{title}</h4>
      <ul>
        {reactions.map((reaction) => (
          <li key={reaction.action} className="flex gap-2 text-xs text-parchment">
            <span aria-hidden="true" className={`tabular-nums ${markClassName}`}>
              {mark.repeat(reaction.strength)}
            </span>
            <span className="sr-only">{srLabels[reaction.strength]}</span>
            <span>{reaction.label}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

interface MemberDetailProps {
  profile: PersonalityProfile;
  history: TrustHistoryEntry[];
}

export function MemberDetail({ profile, history }: MemberDetailProps) {
  return (
    <div className="mt-2 rounded border border-edge px-2 py-2">
      <ReactionList
        title="좋아함"
        reactions={profile.likes}
        mark="▲"
        markClassName="text-trust-up"
        srLabels={LIKE_LABELS}
      />
      <ReactionList
        title="경계함"
        reactions={profile.guards}
        mark="▼"
        markClassName="text-trust-down"
        srLabels={GUARD_LABELS}
      />
      <h4 className="mt-2 text-xs font-semibold text-muted">최근 변화</h4>
      {history.length === 0 ? (
        <p className="text-xs text-muted">아직 기록이 없다.</p>
      ) : (
        <ul>
          {history.map((entry, index) => (
            <li
              key={`${entry.at}-${index}`}
              className="text-xs text-parchment"
            >
              <span
                aria-hidden="true"
                className={entry.delta >= 0 ? "text-trust-up" : "text-trust-down"}
              >
                {entry.delta >= 0 ? "▲" : "▼"}
              </span>
              <span className="sr-only">
                {entry.delta >= 0 ? "신뢰 상승 " : "신뢰 하락 "}
              </span>
              {Math.abs(entry.delta)} · {entry.summary} — {entry.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
