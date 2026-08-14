import type { ChoiceId, DungeonEvent, PartyMember } from "@/lib/domain";

interface ChoiceListProps {
  event: DungeonEvent;
  party: PartyMember[];
  /** 선택지를 고르면 호출된다. 없으면 목록만 보여준다. */
  onChoose?: (choiceId: ChoiceId) => void;
  /** 보스전처럼 아직 고를 수 없는 상태다. */
  disabled?: boolean;
}

/**
 * 이벤트 설명과 선택지 목록이다. 각 선택지는 대상·예상 이득·알려진
 * 위험을 함께 보여준다. 정보 카드 패널은 카드 판정과 함께 선택·카드 패널
 * 작업이 붙인다.
 */
export function ChoiceList({ event, party, onChoose, disabled }: ChoiceListProps) {
  const nameByMemberId = new Map(party.map((member) => [member.id, member.name]));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm text-parchment">{event.title}</h3>
        <p className="mt-1 text-sm text-muted">{event.description}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {event.choices.map((choice) => {
          const targetLabel =
            choice.target === undefined
              ? "파티 전체"
              : choice.target.kind === "boss"
                ? "보스"
                : (nameByMemberId.get(choice.target.id) ?? "알 수 없는 대상");
          return (
            <li key={choice.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChoose?.(choice.id)}
                className={`w-full rounded border border-edge px-3 py-2 text-left ${
                  disabled ? "cursor-not-allowed opacity-60" : "hover:bg-edge"
                }`}
              >
                <span className="block text-sm text-parchment">{choice.label}</span>
                <span className="mt-1 block text-xs text-muted">
                  대상 {targetLabel}
                </span>
                <span className="mt-1 block text-xs text-trust-up">
                  <span aria-hidden="true">＋</span>
                  <span className="sr-only">예상 이득 </span>
                  {choice.expectedGain}
                </span>
                <span className="mt-1 block text-xs text-trust-down">
                  <span aria-hidden="true">！</span>
                  <span className="sr-only">알려진 위험 </span>
                  {choice.knownRisk}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
