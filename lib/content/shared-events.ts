import type {
  AdviceOption,
  AdviceOutcome,
  ChoiceId,
  EventEffectTag,
  EventId,
  EventKind,
  SituationEvent,
} from "@/lib/domain";

function advice(
  id: string,
  outcome: AdviceOutcome,
  label: string,
  line: string,
  resultText: string,
  effectTags: readonly EventEffectTag[],
): AdviceOption {
  return {
    id: id as ChoiceId,
    label,
    line,
    outcome,
    relation: "unrelated",
    effectTags,
    resultText,
  };
}

function sharedEvent(
  id: string,
  kind: EventKind,
  title: string,
  description: string,
  advices: readonly AdviceOption[],
  defaultResultText: string,
): SituationEvent {
  return {
    id: id as EventId,
    kind,
    title,
    description,
    advice: advices,
    defaultResultText,
  };
}

/**
 * 공용 사건. 생태 규칙을 참조하지 않으므로 모든 테마의 던전에 나온다.
 *
 * 유형은 콘텐츠가 직접 선언하고, 판단의 근거는 상황 묘사의 관찰 가능한 사실이
 * 진다. 묘사에는 사실을 적고 결론을 적지 않는다. `상인이 자꾸 뒤를 돌아본다`는
 * 사실이고 `이 상인은 도둑이다`는 결론이다.
 * docs/superpowers/specs/2026-08-20-lattebun-f3-1-advice-content-contract-design.md
 */
const REST_EVENTS: readonly SituationEvent[] = [
  sharedEvent(
    "shared-rest-wound",
    "rest",
    "벌어진 상처",
    "전사의 상처가 다시 벌어졌다. 감아둔 천은 이미 검게 젖었고, 물통은 절반이 비어 있다.",
    [
      advice(
        "shared-rest-wound-a",
        "help",
        "마른 천을 찢어 새로 감으라고 하세요",
        "젖은 천은 상처에 안 좋다고 들었어!",
        "마른 천으로 다시 감자 배어나오던 피가 멎는다.",
        ["support"],
      ),
      advice(
        "shared-rest-wound-b",
        "harm",
        "남은 물을 상처에 부어 씻으라고 하세요",
        "깨끗이 씻어내면 낫지 않을까!",
        "물통이 바닥을 드러낸다. 젖은 천은 그대로고, 남은 길에 마실 물이 없다.",
        ["sabotage"],
      ),
      advice(
        "shared-rest-wound-c",
        "neutral",
        "잠시 앉아 쉬라고 하세요",
        "일단 좀 앉아 있어!",
        "숨은 돌렸지만 상처는 그대로다.",
        ["rest"],
      ),
    ],
    "전사가 알아서 천을 고쳐 감는다. 시간이 조금 지난다.",
  ),
  sharedEvent(
    "shared-rest-fire",
    "rest",
    "마른 장작",
    "불을 피울 만한 마른 장작이 쌓여 있다. 통로 안쪽에서 바람이 꾸준히 불어 나온다.",
    [
      advice(
        "shared-rest-fire-a",
        "help",
        "바람이 나오는 쪽을 등지고 불을 피우라고 하세요",
        "연기가 안으로 들어가면 곤란하잖아!",
        "연기가 통로 밖으로 빠진다. 파티가 온기를 쬐고 체온을 회복한다.",
        ["rest"],
      ),
      advice(
        "shared-rest-fire-b",
        "harm",
        "통로 한가운데에 불을 피우라고 하세요",
        "가운데가 제일 따뜻하지!",
        "바람이 연기를 안쪽으로 밀어 넣는다. 파티가 기침을 하고, 안쪽 어딘가에서 무언가 움직이는 소리가 난다.",
        ["sabotage"],
      ),
      advice(
        "shared-rest-fire-c",
        "neutral",
        "불 없이 그냥 쉬라고 하세요",
        "불은 위험할 수도 있으니까!",
        "어둠 속에서 잠시 쉰다. 춥지만 아무 일도 없다.",
        ["rest"],
      ),
    ],
    "파티가 장작을 그냥 지나친다.",
  ),
  sharedEvent(
    "shared-rest-ration",
    "rest",
    "마지막 이틀치",
    "식량이 이틀치 남았다. 도적은 아까부터 자기 몫을 조금씩 아껴 주머니에 넣고 있다.",
    [
      advice(
        "shared-rest-ration-a",
        "help",
        "오늘 몫만 꺼내 나누라고 하세요",
        "내일 것도 있어야 하잖아!",
        "각자 한 끼씩 나눈다. 내일 몫이 그대로 남는다.",
        ["support"],
      ),
      advice(
        "shared-rest-ration-b",
        "harm",
        "오늘 다 먹고 힘을 내라고 하세요",
        "잘 먹어야 잘 싸우지!",
        "배는 불렀다. 다음 날 아무도 먹을 것이 없어 파티 전원이 힘을 쓰지 못한다.",
        ["sabotage"],
      ),
      advice(
        "shared-rest-ration-c",
        "neutral",
        "각자 알아서 먹으라고 하세요",
        "알아서들 하겠지!",
        "도적은 아꼈고 나머지는 먹었다. 총량은 그대로다.",
        ["observe"],
      ),
    ],
    "파티가 각자 조금씩 꺼내 먹는다.",
  ),
  sharedEvent(
    "shared-rest-watch",
    "rest",
    "불침번",
    "셋 다 지쳐 있다. 성직자는 앉은 채로 고개가 자꾸 앞으로 꺾인다.",
    [
      advice(
        "shared-rest-watch-a",
        "help",
        "가장 멀쩡한 사람에게 불침번을 맡기라고 하세요",
        "제일 쌩쌩한 사람이 서야지!",
        "깨어 있는 눈이 하나 남는다. 파티가 방해 없이 회복한다.",
        ["support"],
      ),
      advice(
        "shared-rest-watch-b",
        "harm",
        "성직자에게 불침번을 맡기라고 하세요",
        "성직자는 기도하면서 깨어 있을 수 있잖아!",
        "성직자가 곧 잠든다. 아무도 깨어 있지 않은 사이 짐이 헤집어졌다.",
        ["sabotage"],
      ),
      advice(
        "shared-rest-watch-c",
        "neutral",
        "돌아가며 짧게 서라고 하세요",
        "조금씩 나눠서 서면 되지!",
        "셋 다 선잠을 잤다. 아무 일도 없었지만 피로가 덜 풀렸다.",
        ["rest"],
      ),
    ],
    "파티가 알아서 순번을 정한다.",
  ),
  sharedEvent(
    "shared-rest-water",
    "rest",
    "고인 물",
    "벽을 타고 흘러내린 물이 바닥 웅덩이에 고여 있다. 고인 자리에는 벌레 몇 마리가 떠 있고, 벽에서는 아직 물이 흐른다.",
    [
      advice(
        "shared-rest-water-a",
        "help",
        "벽에서 흐르는 물을 받으라고 하세요",
        "흐르는 물이 낫지 않겠어?",
        "흐르는 물을 받아 물통을 채운다. 맛이 나쁘지 않다.",
        ["support"],
      ),
      advice(
        "shared-rest-water-b",
        "harm",
        "웅덩이 물을 그대로 뜨라고 하세요",
        "여기가 뜨기 편하잖아!",
        "고인 물을 마신 파티원들이 얼마 지나지 않아 배를 움켜쥔다.",
        ["sabotage"],
      ),
      advice(
        "shared-rest-water-c",
        "neutral",
        "물은 건드리지 말라고 하세요",
        "괜히 탈 나면 곤란하니까!",
        "물통은 그대로다. 아무 일도 없다.",
        ["observe"],
      ),
    ],
    "파티가 물을 살펴보다 그냥 지나친다.",
  ),
];

const MERCHANT_EVENTS: readonly SituationEvent[] = [
  sharedEvent(
    "shared-merchant-potion",
    "merchant",
    "젖은 흙이 묻은 병",
    "상인이 물약을 판다. 병 바닥에 젖은 흙이 말라붙어 있고, 상인은 물건을 건넬 때마다 자꾸 뒤를 돌아본다.",
    [
      advice(
        "shared-merchant-potion-a",
        "help",
        "물약은 두고 식량만 값을 깎아 사라고 하세요",
        "먹을 것부터 챙기는 게 낫지!",
        "값을 깎아 식량을 산다. 골드가 덜 나갔다.",
        ["trade"],
      ),
      advice(
        "shared-merchant-potion-b",
        "harm",
        "물약을 사서 부상자에게 먹이라고 하세요",
        "약이 있으면 먹여야지!",
        "병을 비운 부상자가 곧 토한다. 오래 묻혀 있던 물약이었다.",
        ["sabotage"],
      ),
      advice(
        "shared-merchant-potion-c",
        "neutral",
        "거래를 거절하라고 하세요",
        "지금은 됐어!",
        "상인이 어깨를 으쓱하고 짐을 챙긴다.",
        ["observe"],
      ),
    ],
    "파티가 값을 흥정하다 그냥 돌아선다.",
  ),
  sharedEvent(
    "shared-merchant-scale",
    "merchant",
    "저울",
    "상인이 값을 저울로 단다. 저울 한쪽 접시 밑에 검은 자국이 눌어붙어 있고, 그쪽만 유난히 빨리 내려앉는다.",
    [
      advice(
        "shared-merchant-scale-a",
        "help",
        "접시를 바꿔 다시 달아보라고 하세요",
        "양쪽 바꿔서 재보면 되잖아!",
        "접시를 바꾸자 무게가 달라진다. 상인이 말없이 값을 낮춘다.",
        ["trade"],
      ),
      advice(
        "shared-merchant-scale-b",
        "harm",
        "상인의 저울을 믿고 값을 치르라고 하세요",
        "저울이 거짓말하겠어?",
        "무거운 쪽 접시에 납이 붙어 있었다. 파티가 실제보다 많은 골드를 냈다.",
        ["sabotage"],
      ),
      advice(
        "shared-merchant-scale-c",
        "neutral",
        "흥정하지 말고 부른 값에 사라고 하세요",
        "그냥 빨리 끝내자!",
        "값을 그대로 치른다. 시간은 벌었다.",
        ["trade"],
      ),
    ],
    "파티가 저울을 힐끔 보고 거래를 접는다.",
  ),
  sharedEvent(
    "shared-merchant-credit",
    "merchant",
    "외상 계약",
    "상인이 지금 돈이 없어도 된다며 종이를 내민다. 아래쪽 몇 줄은 위쪽보다 글씨가 눈에 띄게 작다.",
    [
      advice(
        "shared-merchant-credit-a",
        "help",
        "작은 글씨를 소리 내어 읽어달라고 하세요",
        "이 밑에 뭐라고 쓴 건지 좀 읽어줘!",
        "상인이 머뭇거리다 조항을 읽는다. 파티가 서명을 미룬다.",
        ["information"],
      ),
      advice(
        "shared-merchant-credit-b",
        "harm",
        "서명하고 물건을 받으라고 하세요",
        "지금 안 내도 된다잖아!",
        "작은 글씨는 이자 조항이었다. 갚아야 할 골드가 불어난다.",
        ["sabotage"],
      ),
      advice(
        "shared-merchant-credit-c",
        "neutral",
        "다음에 오겠다고 하세요",
        "다음에 보자고!",
        "상인이 종이를 접는다. 아무것도 얻지 못했다.",
        ["observe"],
      ),
    ],
    "파티가 종이를 들여다보다 돌려준다.",
  ),
  sharedEvent(
    "shared-merchant-scout",
    "merchant",
    "앞길을 안다는 자",
    "앞쪽 길을 잘 안다며 값을 부르는 자가 있다. 던전 안쪽은 온통 젖은 진흙인데 그의 신발은 깨끗하다.",
    [
      advice(
        "shared-merchant-scout-a",
        "help",
        "값을 치르기 전에 무엇을 봤는지 먼저 말해보라고 하세요",
        "먼저 좀 들어보고 결정하자!",
        "그가 얼버무린다. 파티가 골드를 아꼈다.",
        ["information"],
      ),
      advice(
        "shared-merchant-scout-b",
        "harm",
        "값을 치르고 앞길 이야기를 사라고 하세요",
        "정보가 있으면 사야지!",
        "그가 말한 길은 실제와 달랐다. 파티가 헛걸음하고 골드도 잃었다.",
        ["sabotage"],
      ),
      advice(
        "shared-merchant-scout-c",
        "neutral",
        "그냥 지나치라고 하세요",
        "우리끼리 가자!",
        "그가 뒤에서 뭐라고 외치지만 파티는 돌아보지 않는다.",
        ["observe"],
      ),
    ],
    "파티가 값이 비싸다며 손을 젓는다.",
  ),
  sharedEvent(
    "shared-merchant-barter",
    "merchant",
    "이름표",
    "상인이 물자와 바꾸자며 파티의 짐을 살핀다. 파티가 챙겨 나온 유품에는 아직 주인의 이름표가 달려 있다.",
    [
      advice(
        "shared-merchant-barter-a",
        "help",
        "유품 말고 여분의 무기를 내주라고 하세요",
        "무기는 남으니까 그걸 주자!",
        "여분 무기와 물자를 바꾼다. 유품은 그대로 남았다.",
        ["trade"],
      ),
      advice(
        "shared-merchant-barter-b",
        "harm",
        "유품을 이름표째 넘기라고 하세요",
        "어차피 주인은 없잖아!",
        "이름표가 달린 유품이 시장에 돌았다. 길드에 소문이 들어가 명성이 깎인다.",
        ["sabotage"],
      ),
      advice(
        "shared-merchant-barter-c",
        "neutral",
        "교환하지 말라고 하세요",
        "지금은 바꿀 게 없어!",
        "상인이 짐을 다시 묶는다.",
        ["observe"],
      ),
    ],
    "파티가 짐을 뒤적이다 그만둔다.",
  ),
];

export const SHARED_EVENTS: readonly SituationEvent[] = [
  ...REST_EVENTS,
  ...MERCHANT_EVENTS,
];
