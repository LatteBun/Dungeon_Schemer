import type { DungeonEvent, InfoCard, PartyMember } from "@/lib/domain";
import { TRUTH_TYPE_LABELS } from "./labels";

interface ChoiceListProps { event: DungeonEvent; party: PartyMember[]; cards: InfoCard[] }

export function ChoiceList({ event, party, cards }: ChoiceListProps) {
  const nameByMemberId = new Map(party.map((member) => [member.id, member.name]));
  return <div className="flex flex-col gap-4">
    <div><h3 className="text-sm text-parchment">{event.title}</h3><p className="mt-1 text-sm text-muted">{event.description}</p></div>
    <ul className="grid gap-2 sm:grid-cols-2">{event.choices.map((choice) => {
      const targetLabel = choice.target === undefined ? "파티 전체" : choice.target.kind === "boss" ? "보스" : (nameByMemberId.get(choice.target.id) ?? "알 수 없는 대상");
      return <li key={choice.id}><button type="button" className="w-full rounded border border-edge px-3 py-2 text-left hover:bg-edge">
        <span className="block text-sm text-parchment">{choice.label}</span><span className="mt-1 block text-xs text-muted">대상 {targetLabel}</span>
        <span className="mt-1 block text-xs text-trust-up"><span aria-hidden="true">＋</span><span className="sr-only">예상 이득 </span>{choice.expectedGain}</span>
        <span className="mt-1 block text-xs text-trust-down"><span aria-hidden="true">！</span><span className="sr-only">알려진 위험 </span>{choice.knownRisk}</span>
      </button></li>;
    })}</ul>
    <div><h4 className="text-xs font-semibold tracking-wide text-muted">건넬 수 있는 정보</h4><ul className="mt-2 grid gap-2 sm:grid-cols-3">{cards.map((card) => <li key={card.id}><button type="button" className="h-full w-full rounded border border-edge px-3 py-2 text-left hover:bg-edge"><span className="block text-xs text-muted">[{TRUTH_TYPE_LABELS[card.truthType]}] {card.topic}</span><span className="mt-1 block text-sm text-parchment">{card.text}</span></button></li>)}</ul></div>
  </div>;
}
