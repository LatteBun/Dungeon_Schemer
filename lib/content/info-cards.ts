import type { CardId, InfoCard } from "@/lib/domain";

function card(
  id: string,
  truthType: InfoCard["truthType"],
  subject: InfoCard["subject"],
  topic: string,
  text: string,
): InfoCard {
  return { id: id as CardId, truthType, subject, topic, text };
}

export const INFO_CARDS: readonly InfoCard[] = [
  card("card-truth-route", "truth", "route", "안전한 갈림길", "서쪽 길은 최근에 통과된 흔적이 있다."),
  card("card-truth-monster", "truth", "monster", "고블린 습성", "고블린은 불빛이 강한 통로를 피한다."),
  card("card-truth-boss", "truth", "boss", "보스 약점", "보스는 반복되는 소리에 반응한다."),
  card("card-truth-rest", "truth", "rest", "회복 장소", "마른 장작이 남은 방은 잠시 쉴 수 있다."),
  card("card-lie-route", "lie", "route", "거짓 지름길", "동쪽 문 너머가 항상 가장 빠른 길이다."),
  card("card-lie-event", "lie", "event", "봉인된 사건", "봉인된 문은 아무 위험도 만들지 않는다."),
  card("card-lie-boss", "lie", "boss", "보스 공격 방식", "보스는 같은 공격을 두 번 사용하지 않는다."),
  card("card-lie-merchant", "lie", "merchant", "상인의 보증", "그림자 상인의 모든 물건은 반드시 진품이다."),
  card("card-neutral-route", "neutral", "route", "갈림길의 흔적", "두 갈림길 모두 누군가 지나간 흔적이 있다."),
  card("card-neutral-event", "neutral", "event", "사건의 대가", "도움을 주면 얻는 것과 잃는 것이 함께 생긴다."),
  card("card-neutral-monster", "neutral", "monster", "괴물의 영역", "이 층에는 여러 종류의 괴물이 살고 있다."),
  card("card-neutral-merchant", "neutral", "merchant", "거래의 조건", "상인은 정보와 물자를 교환할 준비가 되어 있다."),
];
