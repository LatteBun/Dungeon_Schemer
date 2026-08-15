import { Panel } from "@/components/ui/Panel";
import type { BoardOfferId } from "@/lib/domain";
import type { BoardOfferView } from "./campaign-view-model";

const MAX_BOARD_OFFERS = 5;

interface BoardProps {
  offers: BoardOfferView[];
  selectedOfferId: BoardOfferId | null;
  onSelectOffer: (offerId: BoardOfferId) => void;
  onAcceptContract: (offerId: BoardOfferId) => void;
}

function statusText(offer: BoardOfferView): string {
  if (!offer.locked) {
    return "✓ 지원 가능";
  }
  if (offer.shortfall !== null) {
    return `× 지원 불가 · 명성 ${offer.shortfall} 부족`;
  }
  return "× 지원 불가";
}

function cardClassName(offer: BoardOfferView, selected: boolean): string {
  const base = "w-full rounded border px-3 py-2 text-left";
  if (offer.locked) {
    return `${base} border-dashed border-trust-down text-muted`;
  }
  if (selected) {
    return `${base} border-trust-up bg-edge text-parchment`;
  }
  return `${base} border-edge text-parchment hover:bg-edge`;
}

/** 왼쪽 공고 게시판. 잠긴 공고도 숨기지 않고 상태와 부족 명성을 함께 보여준다. */
export function Board({
  offers,
  selectedOfferId,
  onSelectOffer,
  onAcceptContract,
}: BoardProps) {
  const selected = offers.find((offer) => offer.offerId === selectedOfferId);
  const canAccept = selected !== undefined && !selected.locked;

  return (
    <Panel title={`원정 공고 · 최대 ${MAX_BOARD_OFFERS}개 비교`} aside={<span className="text-xs text-muted">지원 조건 / 보상</span>}>
      <ul className="flex flex-col gap-2">
        {offers.map((offer) => {
          const isSelected = offer.offerId === selectedOfferId;
          return (
            <li key={offer.offerId}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-disabled={offer.locked}
                onClick={() => onSelectOffer(offer.offerId)}
                className={cardClassName(offer, isSelected)}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {String(offer.order).padStart(2, "0")} {offer.dungeonLabel}
                    {offer.failureCount > 0 ? (
                      <span className="ml-1 text-xs text-trust-down">
                        실패 {offer.failureCount}회 상승
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`text-xs ${offer.locked ? "text-trust-down" : "text-trust-up"}`}
                  >
                    {statusText(offer)}
                  </span>
                </span>
                <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                  <span>필요 명성 {offer.requiredReputation}</span>
                  <span>
                    보상 명성 {offer.reputationReward} + {offer.goldReward}G
                  </span>
                  <span>지점 {offer.nodeCount}</span>
                </span>
                <span className="mt-1 block text-xs text-muted">
                  파티: {offer.partyLabel} · 생존 {offer.survivorCount} · 평균 신뢰{" "}
                  {offer.averageTrust}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={!canAccept}
        onClick={() => {
          if (selected !== undefined) {
            onAcceptContract(selected.offerId);
          }
        }}
        className="mt-3 w-full rounded border border-edge px-3 py-2 text-sm text-parchment enabled:hover:bg-edge disabled:opacity-40"
      >
        선택한 공고 계약하기 →
      </button>
    </Panel>
  );
}
