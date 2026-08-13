import type { CardId, InfoCard } from "@/lib/domain";

/** 진실·거짓·중립 셋이 모두 있다. 선택 패널이 세 유형을 보여줘야 한다. */
export const MOCK_CARDS: InfoCard[] = [
  { id: "card-boss-weakness" as CardId, truthType: "truth", subject: "boss", topic: "보스 약점", text: "리치의 관은 옥좌 뒤에 있다. 관을 깨면 되살아나지 못한다." },
  { id: "card-empty-path" as CardId, truthType: "lie", subject: "route", topic: "앞길의 위험", text: "왼쪽 길은 비어 있다. 아무것도 없으니 지름길로 쓸 수 있다." },
  { id: "card-merchant-rumor" as CardId, truthType: "neutral", subject: "merchant", topic: "던전 소문", text: "이 층에서 상인을 봤다는 말이 있다. 사실인지는 모른다." },
];
