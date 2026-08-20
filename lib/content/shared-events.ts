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

export const SHARED_EVENTS: readonly SituationEvent[] = [...REST_EVENTS];
