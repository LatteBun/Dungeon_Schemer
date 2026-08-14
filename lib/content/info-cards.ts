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

/**
 * 정보 카드 풀은 주제 6종 × 진위 3종의 모든 조합에 2장씩, 모두 36장이다.
 *
 * 조합마다 1장이면 A·S급의 보스 보장 2회가 모든 시드에서 문자 그대로 같은 세
 * 장을 제시한다. 뽑을 것이 없기 때문이다. 2장이면 진위마다 둘 중 하나를 시드로
 * 고르므로 두 기회가 다를 확률이 7/8이 된다.
 *
 * 진위는 문장의 성격으로 구분한다. 진실은 확인 가능한 사실을, 거짓은 확신에 찬
 * 틀린 주장을, 중립은 양쪽 다 맞아서 판단을 파티에게 넘기는 말을 담는다. 중립은
 * 길잡이가 거짓말을 하지 않고도 아무 도움이 안 되게 말하는 수단이다.
 * docs/superpowers/specs/2026-08-15-sbh3821-info-card-expansion-design.md
 */
export const INFO_CARDS: readonly InfoCard[] = [
  card("card-truth-route-1", "truth", "route", "안전한 갈림길", "서쪽 길은 최근에 통과된 흔적이 있다."),
  card("card-truth-route-2", "truth", "route", "합류 지점", "두 갈래는 결국 같은 방에서 다시 만난다."),
  card("card-lie-route-1", "lie", "route", "거짓 지름길", "동쪽 문 너머가 항상 가장 빠른 길이다."),
  card("card-lie-route-2", "lie", "route", "막힌 길", "왼쪽은 이미 무너져서 갈 수 있는 길이 하나뿐이다."),
  card("card-neutral-route-1", "neutral", "route", "갈림길의 흔적", "두 갈림길 모두 누군가 지나간 흔적이 있다."),
  card("card-neutral-route-2", "neutral", "route", "비슷한 거리", "어느 쪽으로 가든 걸리는 시간은 비슷하다고 한다."),

  card("card-truth-event-1", "truth", "event", "함정의 이음새", "함정은 밟기 전에 바닥의 이음새로 알아볼 수 있다."),
  card("card-truth-event-2", "truth", "event", "봉인의 표식", "봉인된 물건은 손대기 전에 표식을 먼저 읽어야 한다."),
  card("card-lie-event-1", "lie", "event", "봉인된 사건", "봉인된 문은 아무 위험도 만들지 않는다."),
  card("card-lie-event-2", "lie", "event", "발동한 함정", "이 층의 함정은 모두 지난 원정대가 이미 밟았다."),
  card("card-neutral-event-1", "neutral", "event", "사건의 대가", "도움을 주면 얻는 것과 잃는 것이 함께 생긴다."),
  card("card-neutral-event-2", "neutral", "event", "같은 갈림", "지난 원정대도 여기서 같은 선택을 두고 갈렸다."),

  card("card-truth-monster-1", "truth", "monster", "고블린 습성", "고블린은 불빛이 강한 통로를 피한다."),
  card("card-truth-monster-2", "truth", "monster", "거미의 감각", "거미는 진동으로 먹이를 찾으니 발을 끌지 말아야 한다."),
  card("card-lie-monster-1", "lie", "monster", "도망친 개체", "무리에서 떨어진 개체는 절대 되돌아오지 않는다."),
  card("card-lie-monster-2", "lie", "monster", "괴물의 낮잠", "이 층의 괴물은 해가 떠 있는 동안 움직이지 않는다."),
  card("card-neutral-monster-1", "neutral", "monster", "괴물의 영역", "이 층에는 여러 종류의 괴물이 살고 있다."),
  card("card-neutral-monster-2", "neutral", "monster", "줄어든 수", "괴물의 수가 지난달보다 줄었다는 말이 있다."),

  card("card-truth-rest-1", "truth", "rest", "회복 장소", "마른 장작이 남은 방은 잠시 쉴 수 있다."),
  card("card-truth-rest-2", "truth", "rest", "물소리", "물이 흐르는 소리가 나는 쪽에서 식수를 얻을 수 있다."),
  card("card-lie-rest-1", "lie", "rest", "완전한 안전", "이 자리는 몇 시간이고 아무도 오지 않는다."),
  card("card-lie-rest-2", "lie", "rest", "저절로 낫는 상처", "여기서 자고 나면 상처가 저절로 아문다."),
  card("card-neutral-rest-1", "neutral", "rest", "쉼의 값", "몸을 회복하는 만큼 시간을 잃는다."),
  card("card-neutral-rest-2", "neutral", "rest", "뒤를 밟는 것", "쉬는 동안 뒤를 밟힌 원정대도, 그렇지 않은 원정대도 있었다."),

  card("card-truth-merchant-1", "truth", "merchant", "약초꾼의 값", "약초꾼의 치료제는 값을 치른 만큼의 효과가 있다."),
  card("card-truth-merchant-2", "truth", "merchant", "부풀린 값", "행상인은 값을 부풀리지만 물건 자체는 진짜다."),
  card("card-lie-merchant-1", "lie", "merchant", "상인의 보증", "그림자 상인의 모든 물건은 반드시 진품이다."),
  card("card-lie-merchant-2", "lie", "merchant", "다음 기회", "이 상인은 던전 밖에서도 만날 수 있으니 서두를 것 없다."),
  card("card-neutral-merchant-1", "neutral", "merchant", "거래의 조건", "상인은 정보와 물자를 교환할 준비가 되어 있다."),
  card("card-neutral-merchant-2", "neutral", "merchant", "흥정", "값은 흥정하기 나름이라고들 한다."),

  card("card-truth-boss-1", "truth", "boss", "보스 약점", "보스는 반복되는 소리에 반응한다."),
  card("card-truth-boss-2", "truth", "boss", "굳은 상처", "보스의 왼쪽은 오래전 상처로 굳어 잘 움직이지 않는다."),
  card("card-lie-boss-1", "lie", "boss", "보스 공격 방식", "보스는 같은 공격을 두 번 사용하지 않는다."),
  card("card-lie-boss-2", "lie", "boss", "무기를 든 자", "보스는 무기를 든 자를 마지막에 노린다."),
  card("card-neutral-boss-1", "neutral", "boss", "보스의 소문", "보스를 본 사람들의 말이 서로 엇갈린다."),
  card("card-neutral-boss-2", "neutral", "boss", "추격의 끝", "보스가 어디까지 쫓아오는지는 아무도 모른다."),
];
