import type {
  AdviceOption,
  AdviceSource,
  AdviceUpgrade,
  AdviceOutcome,
  BossId,
  BossRuleId,
  ChoiceId,
  ClueId,
  EventEffectTag,
  EventId,
  NonMerchantSituationEvent,
} from "@/lib/domain";
import type { RuleId } from "@/lib/domain";

function ecology(ruleId: string): AdviceSource {
  return { kind: "ecology", ruleId: ruleId as RuleId };
}

function boss(bossRuleId: string): AdviceSource {
  return { kind: "boss", bossRuleId: bossRuleId as BossRuleId };
}

function advice(
  id: string,
  outcome: AdviceOutcome,
  label: string,
  line: string,
  resultText: string,
  effectTags: readonly EventEffectTag[],
  source?: AdviceSource,
): AdviceOption {
  return {
    id: id as ChoiceId,
    label,
    line,
    outcome,
    source,
    relation:
      outcome === "help"
        ? "consistent"
        : outcome === "harm"
          ? "contradictory"
          : "unrelated",
    effectTags,
    resultText,
  };
}

function ecologyAdvice(
  id: string,
  outcome: "help" | "harm",
  ruleId: string,
  label: string,
  line: string,
  resultText: string,
): AdviceOption {
  return advice(id, outcome, label, line, resultText, [outcome === "help" ? "support" : "sabotage"], ecology(ruleId));
}

function neutralAdvice(id: string, label: string, line: string, resultText: string): AdviceOption {
  return advice(id, "neutral", label, line, resultText, ["observe"]);
}

function spiderEvent(
  id: string,
  title: string,
  description: string,
  adviceOptions: readonly AdviceOption[],
  defaultResultText: string,
  extras: Partial<NonMerchantSituationEvent> = {},
): NonMerchantSituationEvent {
  const satisfiedConditionalRuleIds = [...new Set(
    adviceOptions.flatMap((option) =>
      option.source?.kind === "ecology" &&
      ["spider-brood-light", "spider-armor-vibration"].includes(option.source.ruleId)
        ? [option.source.ruleId]
        : [],
    ),
  )];
  return {
    id: id as EventId,
    kind: "monster",
    theme: "spider",
    title,
    description,
    advice: adviceOptions,
    defaultResultText,
    ...(satisfiedConditionalRuleIds.length > 0 ? { satisfiedConditionalRuleIds } : {}),
    ...extras,
  };
}

function bossAdvice(
  id: string,
  outcome: AdviceOutcome,
  bossRuleId: string | undefined,
  label: string,
  line: string,
  resultText: string,
): AdviceOption {
  return advice(
    id,
    outcome,
    label,
    line,
    resultText,
    [outcome === "harm" ? "sabotage" : "information"],
    bossRuleId === undefined ? undefined : boss(bossRuleId),
  );
}

function bossEvent(
  id: string,
  targetBossId: string,
  title: string,
  description: string,
  adviceOptions: readonly AdviceOption[],
  defaultResultText: string,
): NonMerchantSituationEvent {
  return {
    id: id as EventId,
    kind: "special",
    theme: "spider",
    targetBossId: targetBossId as BossId,
    title,
    description,
    advice: adviceOptions,
    defaultResultText,
  };
}

const SPIDER_MONSTER_EVENTS: readonly NonMerchantSituationEvent[] = [
  spiderEvent(
    "spider-fire-floor-torch",
    "떨어진 횃불",
    "동굴거미들이 좁은 길을 막고 있다. 바닥에 떨어진 횃불 가까이에 있던 거미 한 마리가 불빛을 피해 슬금슬금 뒤로 물러난다.",
    [
      ecologyAdvice("spider-fire-floor-torch-help", "help", "spider-fire", "횃불을 앞쪽 바닥에 던져 길을 벌리세요.", "불 가까이는 싫어하는 것 같아요. 앞으로 던져보죠.", "횃불이 바닥을 구르자 거미들이 양옆으로 물러나고 파티가 그 틈으로 빠져나간다."),
      ecologyAdvice("spider-fire-floor-torch-harm", "harm", "spider-fire", "불을 뒤로 치우고 그대로 밀고 나가세요.", "불빛 때문에 더 흥분할 수도 있어요. 치우는 게 나아요.", "불이 멀어지자 거미들이 다시 통로 한가운데로 몰려들어 파티의 움직임을 막는다."),
      neutralAdvice("spider-fire-floor-torch-neutral", "방패를 붙이고 천천히 전진하세요.", "급하게 움직이지 말고 방패부터 붙여요.", "파티가 방패를 맞대고 조금씩 전진해 큰 손해 없이 길을 지난다."),
    ],
    "파티가 짧게 거미들을 밀어내고 지나가지만 시간을 조금 더 쓴다.",
  ),
  spiderEvent(
    "spider-fire-web-nest",
    "거미줄 둥지",
    "두꺼운 거미줄이 통로 양쪽을 덮고 있다. 작은 불씨가 거미줄 가까이 떨어지자 그 주변에 있던 거미들이 자리를 옮긴다.",
    [
      ecologyAdvice("spider-fire-web-nest-help", "help", "spider-fire", "횃불을 거미줄 사이에 세워 길을 나누세요.", "불을 가운데 두면 가까이 오기 어렵겠어요.", "거미들이 불을 피해 양쪽으로 갈라지고 파티가 가운데 길을 지난다."),
      ecologyAdvice("spider-fire-web-nest-harm", "harm", "spider-fire", "불을 전부 끄고 한꺼번에 지나가세요.", "어두우면 거미들도 우리를 놓칠 거예요.", "불이 사라지자 거미들이 다시 길을 메우고 파티가 거미줄에 얽힌다."),
      neutralAdvice("spider-fire-web-nest-neutral", "긴 무기로 거미줄부터 걷어내세요.", "먼저 앞을 좀 치워두죠.", "파티가 시간을 들여 거미줄을 걷어내고 조심스럽게 지나간다."),
    ],
    "파티가 거미줄 일부를 잘라내며 천천히 통로를 지난다.",
  ),
  spiderEvent(
    "spider-vibration-pebble",
    "굴러간 자갈",
    "전사가 발밑의 자갈을 걷어찬다. 자갈이 바닥을 구르자 벽에 붙어 있던 동굴거미들이 일제히 그쪽으로 몸을 돌린다.",
    [
      ecologyAdvice("spider-vibration-pebble-help", "help", "spider-vibration", "발소리를 죽이고 천천히 움직이세요.", "방금 자갈 소리에 다 쳐다봤어요. 조용히 가죠.", "파티가 발걸음을 줄이자 거미들이 다른 쪽을 살피는 사이 무사히 지나간다."),
      ecologyAdvice("spider-vibration-pebble-harm", "harm", "spider-vibration", "벽을 세게 두드려 겁주세요.", "큰 소리를 내면 놀라서 도망갈지도 몰라요.", "벽을 타고 진동이 퍼지자 숨어 있던 동굴거미들까지 통로로 몰려나온다."),
      neutralAdvice("spider-vibration-pebble-neutral", "천장의 거미줄부터 잘라내세요.", "머리 위부터 안전하게 만들죠.", "파티가 거미줄을 치우며 천천히 이동한다."),
    ],
    "파티가 거미들과 짧게 맞서며 통로를 통과한다.",
    { revealsClue: "clue-spider-vibration-response" as ClueId },
  ),
  spiderEvent(
    "spider-vibration-stone-floor",
    "얇은 돌바닥",
    "통로 바닥에 얇은 돌판이 이어져 있다. 전사가 한 발을 올리자 돌판 아래에서 둔한 울림이 굴 안쪽까지 퍼진다.",
    [
      ecologyAdvice("spider-vibration-stone-floor-help", "help", "spider-vibration", "돌판을 최대한 조심해서 건너세요.", "바닥이 너무 잘 울려요. 발을 살살 디뎌요.", "파티가 걸음을 줄여 소리를 최소화하며 돌판을 건넌다."),
      ecologyAdvice("spider-vibration-stone-floor-harm", "harm", "spider-vibration", "돌판을 깨뜨리며 달려가세요.", "한 번에 크게 놀라게 하고 지나가면 돼요.", "돌판이 연달아 깨지며 큰 진동이 퍼지고 동굴거미들이 사방에서 달려든다."),
      neutralAdvice("spider-vibration-stone-floor-neutral", "방패를 앞세우고 이동하세요.", "뭐가 튀어나와도 막을 준비부터 해요.", "파티가 방패를 들고 조심스럽게 돌판을 지난다."),
    ],
    "파티가 발밑을 확인하며 천천히 건넌다.",
    {
      upgrades: [
        {
          clueId: "clue-spider-vibration-response" as ClueId,
          slotIndex: 0,
          replacement: ecologyAdvice("spider-vibration-stone-floor-help-upgraded", "help", "spider-vibration", "돌판을 밟지 말고 벽 가장자리의 흙길로 돌아가세요.", "아까 작은 자갈에도 바로 반응했어요. 아예 울리는 바닥을 피하죠.", "파티가 돌판을 피해 벽 가장자리로 돌아가 거미들의 눈치를 채지 않고 통과한다."),
        } satisfies AdviceUpgrade,
      ],
    },
  ),
  spiderEvent(
    "spider-carrion-carcass",
    "썩은 짐승",
    "통로 한가운데 오래된 짐승 시체가 놓여 있다. 바닥에 남은 작은 거미 발자국 대부분이 시체 쪽으로 모여 있다.",
    [
      ecologyAdvice("spider-carrion-carcass-help", "help", "spider-carrion", "시체를 다른 갈림길로 옮기고 지나가세요.", "발자국이 전부 저쪽으로 모였어요. 냄새도 같이 옮겨보죠.", "시체 냄새를 따라 시체거미들이 다른 길로 몰리고 통로가 비어진다."),
      ecologyAdvice("spider-carrion-carcass-harm", "harm", "spider-carrion", "시체 뒤에 숨어 냄새를 묻힌 채 지나가세요.", "우리 냄새를 가리면 못 찾을지도 몰라요.", "시체 냄새가 파티에 묻자 시체거미들이 오히려 파티를 따라붙는다."),
      neutralAdvice("spider-carrion-carcass-neutral", "반대쪽 벽에 붙어서 지나가세요.", "가까이만 안 가면 괜찮을 거예요.", "파티가 시체와 거리를 두고 천천히 지나간다."),
    ],
    "파티가 시체를 피해 멀찍이 돌아서 지나간다.",
    { revealsClue: "clue-spider-carrion-tracks" as ClueId },
  ),
  spiderEvent(
    "spider-shadow-dark-room",
    "빛이 닿지 않는 방",
    "횃불 끝자락의 어두운 구석에서 검은 거미 다리가 잠깐 보인다. 불빛이 그쪽을 비추자 모습이 곧바로 어둠 속으로 사라진다.",
    [
      ecologyAdvice("spider-shadow-dark-room-help", "help", "spider-shadow", "횃불을 나눠 들고 어두운 구석부터 비추세요.", "빛이 닿으니까 바로 숨었어요. 어두운 곳을 없애죠.", "방 안이 밝아지자 그림자거미들이 숨을 곳을 잃고 멀리 물러난다."),
      ecologyAdvice("spider-shadow-dark-room-harm", "harm", "spider-shadow", "횃불 하나만 남기고 어둠 속으로 들어가세요.", "불을 줄이면 우리가 덜 눈에 띌 거예요.", "어두운 구석이 늘어나자 그림자거미들이 파티 가까이 모습을 드러낸다."),
      neutralAdvice("spider-shadow-dark-room-neutral", "벽을 등지고 천천히 움직이세요.", "뒤에서 오는 것만 막아도 좀 낫겠어요.", "파티가 서로 등을 지키며 조심스럽게 방을 지난다."),
    ],
    "파티가 횃불을 모아 들고 천천히 방을 통과한다.",
  ),
  spiderEvent(
    "spider-brood-follow-light",
    "불빛을 쫓는 새끼들",
    "사제가 횃불을 옆으로 움직이자 새끼거미 떼가 도망치지 않고 불빛을 따라 우르르 움직인다.",
    [
      ecologyAdvice("spider-brood-follow-light-help", "help", "spider-brood-light", "횃불을 빈 갈림길에 던져 새끼들을 빼세요.", "저 작은 놈들은 불빛을 따라와요. 다른 길로 보내죠.", "새끼거미 떼가 횃불을 따라 빈 갈림길로 몰려가고 길이 열린다."),
      ecologyAdvice("spider-brood-follow-light-harm", "harm", "spider-brood-light", "횃불을 머리 위로 높이 들고 그대로 지나가세요.", "불을 높이 들면 가까이 못 올 거예요.", "새끼거미들이 불빛을 따라 파티 쪽으로 몰려들어 길을 덮는다."),
      neutralAdvice("spider-brood-follow-light-neutral", "방패로 앞을 밀면서 길을 만드세요.", "작으니까 밀어내면서 지나가죠.", "파티가 방패로 새끼거미들을 밀어내며 천천히 통과한다."),
    ],
    "파티가 무리를 피해 잠시 돌아간다.",
    { revealsClue: "clue-spider-brood-follows-light" as ClueId },
  ),
  spiderEvent(
    "spider-brood-armored-cross",
    "두 종류의 거미",
    "새끼거미들은 횃불 쪽으로 몰려든다. 그 옆의 철갑거미는 전사가 바닥을 세게 밟아도 거의 반응하지 않는다.",
    [
      ecologyAdvice("spider-brood-armored-cross-help", "help", "spider-brood-light", "횃불을 옆 갈림길에 던져 새끼들부터 떨어뜨리세요.", "아까처럼 작은 놈들은 불빛을 따라갈 거예요.", "새끼거미들이 횃불을 따라 빠져나가면서 통로가 한결 넓어진다."),
      ecologyAdvice("spider-brood-armored-cross-harm", "harm", "spider-armor-vibration", "바닥을 세게 두드려 철갑거미를 다른 쪽으로 유인하세요.", "저 큰 놈도 진동을 느끼면 따라오겠죠.", "큰 진동에도 철갑거미는 거의 움직이지 않고, 파티만 위치를 드러낸다."),
      neutralAdvice("spider-brood-armored-cross-neutral", "좁은 틈을 한 명씩 지나가세요.", "한꺼번에 엉키지 말고 한 명씩 가요.", "파티가 간격을 두고 천천히 통과한다."),
    ],
    "파티가 새끼거미를 밀어내며 철갑거미 옆을 돌아간다.",
    { requiresClue: "clue-spider-brood-follows-light" as ClueId },
  ),
  spiderEvent(
    "spider-armored-brood-cross",
    "길을 막은 철갑거미",
    "철갑거미 옆에서 큰 돌이 떨어져 굴 전체가 울리지만 철갑거미는 고개조차 돌리지 않는다. 뒤쪽에서는 새끼거미들이 횃불 쪽으로 몰려온다.",
    [
      ecologyAdvice("spider-armored-brood-cross-help", "help", "spider-armor-vibration", "발소리는 신경 쓰지 말고 철갑거미가 보는 쪽만 피하세요.", "저 큰 놈은 이렇게 울려도 꿈쩍도 안 해요. 눈만 피하면 돼요.", "파티가 속도를 늦추지 않고 철갑거미의 시야만 피해 지나간다."),
      ecologyAdvice("spider-armored-brood-cross-harm", "harm", "spider-brood-light", "횃불을 앞으로 내밀어 새끼거미를 쫓아내세요.", "불을 가까이 대면 작은 놈들이 물러나겠죠.", "새끼거미들이 오히려 횃불을 따라 파티 앞으로 몰려든다."),
      neutralAdvice("spider-armored-brood-cross-neutral", "방패를 위로 들고 붙어서 지나가세요.", "위에서 떨어지는 것만 막으면서 갑시다.", "파티가 방패를 맞대며 길을 지난다."),
    ],
    "파티가 철갑거미가 움직일 때까지 기다렸다가 지나간다.",
  ),
  spiderEvent(
    "spider-armored-sleeper",
    "잠든 철갑거미",
    "무거운 철갑거미가 통로를 막고 있다. 천장에서 떨어진 작은 돌이 등에 부딪혀도 별다른 반응이 없다.",
    [
      ecologyAdvice("spider-armored-sleeper-help", "help", "spider-armor-vibration", "발소리보다 놈의 시야를 피해 지나가세요.", "소리에는 둔한 것 같아요. 앞쪽만 피해서 갑시다.", "파티가 빠르게 움직여 철갑거미의 시야 밖으로 통과한다."),
      ecologyAdvice("spider-armored-sleeper-harm", "harm", "spider-armor-vibration", "숨소리도 내지 말고 아주 천천히 기어가세요.", "조금이라도 울리면 바로 깰 거예요.", "파티가 필요 이상으로 시간을 끄는 사이 철갑거미가 스스로 깨어 통로를 막는다."),
      neutralAdvice("spider-armored-sleeper-neutral", "한 명씩 거리를 두고 이동하세요.", "한꺼번에 붙지 말고 차례대로 가요.", "파티가 간격을 두고 조심스럽게 지나간다."),
    ],
    "파티가 철갑거미가 잠든 틈을 살펴 천천히 지나간다.",
  ),
  spiderEvent(
    "spider-carrion-shadow-cross",
    "시체가 있는 어두운 굴",
    "썩은 시체 주변에는 작은 거미 발자국이 가득하다. 그 뒤쪽은 횃불 빛도 닿지 않을 만큼 캄캄하다.",
    [
      ecologyAdvice("spider-carrion-shadow-cross-help", "help", "spider-carrion", "시체를 다른 갈림길로 옮겨 거미들을 그쪽으로 빼세요.", "아까도 냄새 쪽으로 몰렸어요. 먹잇감을 다른 길로 보내죠.", "시체 냄새를 따라 시체거미들이 다른 길로 이동하며 통로가 열린다."),
      ecologyAdvice("spider-carrion-shadow-cross-harm", "harm", "spider-shadow", "불을 끄고 어둠 속으로 숨어 지나가세요.", "빛이 없으면 우리도 잘 안 보일 거예요.", "불이 꺼지자 그림자거미들이 어둠 속에서 바로 파티 가까이 모습을 드러낸다."),
      neutralAdvice("spider-carrion-shadow-cross-neutral", "앞뒤 간격을 좁히고 천천히 이동하세요.", "흩어지지만 않으면 버틸 수 있어요.", "파티가 서로 붙어 천천히 굴을 지난다."),
    ],
    "파티가 불을 유지한 채 시체와 거리를 두고 돌아간다.",
    { requiresClue: "clue-spider-carrion-tracks" as ClueId },
  ),
  spiderEvent(
    "spider-shadow-carrion-cross",
    "꺼진 횃불과 썩은 냄새",
    "횃불이 갑자기 꺼진다. 안쪽은 완전히 캄캄하고 바닥에서는 심한 썩은 냄새가 올라온다.",
    [
      ecologyAdvice("spider-shadow-carrion-cross-help", "help", "spider-shadow", "횃불부터 다시 켜서 어두운 구석을 비추세요.", "어둠 속에 뭐가 숨어 있을지 몰라요. 먼저 밝히죠.", "불빛이 퍼지자 어둠 속에 있던 그림자거미들이 멀리 물러난다."),
      ecologyAdvice("spider-shadow-carrion-cross-harm", "harm", "spider-carrion", "시체 냄새를 옷에 묻혀 거미를 속이세요.", "우리 냄새를 가리면 그냥 지나갈 거예요.", "시체 냄새가 파티에 묻자 시체거미들이 냄새를 따라 몰려든다."),
      neutralAdvice("spider-shadow-carrion-cross-neutral", "벽을 손으로 짚으며 천천히 이동하세요.", "길만 놓치지 말고 천천히 가요.", "파티가 벽을 따라 더듬거리며 통로를 빠져나간다."),
    ],
    "파티가 예비 불씨를 찾아 횃불을 다시 켠 뒤 움직인다.",
  ),
  spiderEvent(
    "spider-fire-smoke-gap",
    "불길 앞의 동굴거미",
    "좁은 통로 앞을 동굴거미 한 마리가 막고 있다. 옆에는 아직 불씨가 남은 횃불통이 있고, 거미는 불씨가 튈 때마다 몸을 뒤로 뺀다.",
    [
      ecologyAdvice("spider-fire-smoke-gap-help", "help", "spider-fire", "불씨를 살려 통로 옆으로 밀어붙이라고 하세요.", "불 가까이는 싫어하는 것 같아요. 불씨를 이용해 길을 열죠.", "불길을 피해 거미가 벽 쪽으로 물러나며 길이 열린다."),
      ecologyAdvice("spider-fire-smoke-gap-harm", "harm", "spider-fire", "불씨를 끄고 어둠 속에서 천천히 다가가라고 하세요.", "빛이 사라지면 거미가 우리를 못 볼 거예요.", "불빛이 사라지자 거미가 통로 중앙으로 돌아와 파티를 막는다."),
      neutralAdvice("spider-fire-smoke-gap-neutral", "다른 길을 찾아보라고 하세요.", "괜히 부딪히지 말고 우회하죠.", "충돌은 피하지만 시간이 더 든다."),
    ],
    "파티가 거미를 피해 우회할 길을 찾느라 시간을 쓴다.",
  ),
  spiderEvent(
    "spider-brood-lantern-cluster",
    "고치방의 등불",
    "천장 고치 여러 개가 갓 찢어진 방이다. 바닥에는 손바닥만 한 새끼거미들이 흩어져 있고, 파티의 등불이 흔들릴 때마다 가까운 개체들이 빛 쪽으로 방향을 튼다.",
    [
      ecologyAdvice("spider-brood-lantern-cluster-help", "help", "spider-brood-light", "등불을 가리고 벽을 따라 조용히 빠져나가라고 하세요.", "빛이 줄면 새끼들이 흩어질 거예요.", "빛이 줄자 새끼거미 떼가 흩어져 길이 열린다."),
      ecologyAdvice("spider-brood-lantern-cluster-harm", "harm", "spider-brood-light", "횃불을 더 밝게 들어 거미들을 겁주라고 하세요.", "더 밝은 불이면 가까이 오지 못할 거예요.", "새끼거미들이 불빛 쪽으로 한꺼번에 몰려든다."),
      neutralAdvice("spider-brood-lantern-cluster-neutral", "고치방 밖에서 잠시 기다리라고 하세요.", "무리가 움직일 때까지 기다리죠.", "당장은 안전하지만 길이 막힌 채 시간이 흐른다."),
    ],
    "파티가 고치방 밖에서 새끼거미 무리가 흩어지기를 기다린다.",
  ),
  spiderEvent(
    "spider-vibration-loose-gravel",
    "자갈 깔린 바닥",
    "천장에 동굴거미 두 마리가 붙어 있다. 아래 바닥은 작은 자갈과 깨진 금속 조각으로 덮여 있어 평소처럼 걸으면 계속 소리가 나고 바닥이 울린다.",
    [
      ecologyAdvice("spider-vibration-loose-gravel-help", "help", "spider-vibration", "천천히 발을 디딜 자리를 골라 진동을 줄이라고 하세요.", "자갈이 계속 울리니 발을 놓을 곳을 골라야 해요.", "천장 거미들이 움직이지 않는 사이 통로를 빠져나간다."),
      ecologyAdvice("spider-vibration-loose-gravel-harm", "harm", "spider-vibration", "한 번에 뛰어 지나가라고 하세요.", "한꺼번에 지나가면 금방 끝날 거예요.", "자갈이 크게 튀며 진동이 퍼지고 거미들이 동시에 내려온다."),
      neutralAdvice("spider-vibration-loose-gravel-neutral", "자갈을 치우며 길을 만들라고 하세요.", "시간을 들여 바닥부터 정리하죠.", "안전해지지만 준비에 시간이 오래 걸린다."),
    ],
    "파티가 자갈을 치우며 조심스럽게 통로를 건넌다.",
  ),
  spiderEvent(
    "spider-armor-vibration-hammer",
    "움직이지 않는 철갑거미",
    "철갑거미 한 마리가 통로 벽에 붙어 있다. 파티가 조금 전 돌을 떨어뜨려 바닥이 크게 울렸는데도 거미는 고개조차 돌리지 않았다.",
    [
      ecologyAdvice("spider-armor-vibration-hammer-help", "help", "spider-armor-vibration", "진동에 반응하지 않으니 시야 밖으로 붙어 지나가라고 하세요.", "이렇게 울렸는데도 반응이 없어요. 눈만 피하면 돼요.", "거미가 눈치채지 못한 사이 파티가 통과한다."),
      ecologyAdvice("spider-armor-vibration-hammer-harm", "harm", "spider-armor-vibration", "바닥을 두드려 반대편으로 유인하라고 하세요.", "큰 소리면 움직일지도 몰라요.", "아무 반응도 없어 파티가 가까이 접근한 뒤에야 거미와 맞닥뜨린다."),
      neutralAdvice("spider-armor-vibration-hammer-neutral", "멀리서 계속 관찰하라고 하세요.", "움직임을 더 확인하고 결정하죠.", "위험은 늘지 않지만 진전도 없다."),
    ],
    "파티가 철갑거미의 반응을 더 살피며 통로 입구에 머문다.",
  ),
  spiderEvent(
    "spider-carrion-bloody-cloth",
    "썩은 냄새가 밴 천",
    "전투 뒤 피 묻은 천 조각을 짐에 묶어 두었다. 앞쪽 통로에서 시체거미 한 마리가 나타나더니 파티보다 천 조각 쪽으로 먼저 방향을 튼다.",
    [
      ecologyAdvice("spider-carrion-bloody-cloth-help", "help", "spider-carrion", "피 묻은 천을 멀리 던지고 반대쪽으로 지나가라고 하세요.", "거미가 천 냄새를 먼저 따라가고 있어요.", "시체거미가 냄새를 따라가며 길이 비어진다."),
      ecologyAdvice("spider-carrion-bloody-cloth-harm", "harm", "spider-carrion", "천을 짐 안쪽에 숨기고 그대로 지나가라고 하세요.", "냄새를 숨기면 우리를 못 찾을 거예요.", "냄새를 맡은 거미가 짐 쪽으로 달라붙는다."),
      neutralAdvice("spider-carrion-bloody-cloth-neutral", "천을 버리고 뒤로 물러나라고 하세요.", "미끼도 포기하고 거리를 벌리죠.", "위험은 줄지만 이동은 지연된다."),
    ],
    "파티가 피 묻은 천을 버리고 거미가 지나가기를 기다린다.",
  ),
  spiderEvent(
    "spider-shadow-light-edge",
    "사라지는 다리",
    "횃불 빛이 닿는 벽에는 아무것도 없지만, 불빛 경계 바로 밖 어둠 속에서 가느다란 다리 모양이 나타났다 사라진다.",
    [
      ecologyAdvice("spider-shadow-light-edge-help", "help", "spider-shadow", "빛의 범위를 넓혀 어둠을 줄이라고 하세요.", "빛의 끝에서만 다리가 보여요. 어둠을 없애야 해요.", "그림자거미의 은신 공간이 줄어 모습을 드러낸 채 뒤로 물러난다."),
      ecologyAdvice("spider-shadow-light-edge-harm", "harm", "spider-shadow", "횃불을 끄고 눈을 어둠에 익히자고 하세요.", "어둠에 익숙해지면 우리도 더 잘 움직일 수 있어요.", "방 전체가 어두워지자 여러 방향에서 움직임이 시작된다."),
      neutralAdvice("spider-shadow-light-edge-neutral", "현재 불빛 안에서 움직이지 말라고 하세요.", "확실한 곳에서 잠시 멈추죠.", "당장은 안전하지만 앞으로 나아가지 못한다."),
    ],
    "파티가 횃불이 닿는 범위 안에서 움직임을 멈춘다.",
  ),
  spiderEvent(
    "spider-special-carrion-dark-store",
    "검은 고치 저장소",
    "빛이 거의 들지 않는 방에 오래된 시체 고치가 여러 개 쌓여 있다. 썩은 냄새가 강하고, 벽 끝 어둠에서는 가끔 다리 윤곽이 움직인다.",
    [
      ecologyAdvice("spider-special-carrion-dark-store-help", "help", "spider-shadow", "불을 밝히고 고치와 거리를 둔 채 가장자리로 지나가라고 하세요.", "어둠과 시체 냄새를 함께 피해야 해요.", "어둠을 줄이고 시체 냄새 중심부를 피하면서 두 종류의 위험을 모두 낮춘다."),
      ecologyAdvice("spider-special-carrion-dark-store-harm", "harm", "spider-carrion", "고치 사이 어두운 틈으로 몸을 숨겨 지나가라고 하세요.", "고치 사이가 우리를 숨겨줄 거예요.", "시체 냄새와 어둠이 겹친 곳으로 들어가 거미들의 움직임이 한꺼번에 시작된다."),
      neutralAdvice("spider-special-carrion-dark-store-neutral", "방을 포기하고 돌아가라고 하세요.", "위험한 방은 우회하는 게 낫겠어요.", "위험은 피하지만 우회한다."),
    ],
    "파티가 고치방 입구에서 물러나 다른 통로를 찾는다.",
    { kind: "special" },
  ),
  spiderEvent(
    "spider-special-fire-shadow-lane",
    "횃불 하나뿐인 갈림방",
    "한쪽 통로에는 작은 거미 여러 마리가 불빛을 피해 물러나 있고, 다른 쪽은 완전히 어두워 가끔 검은 다리만 보인다. 파티에게 남은 횃불은 하나뿐이다.",
    [
      ecologyAdvice("spider-special-fire-shadow-lane-help", "help", "spider-shadow", "횃불을 어두운 통로 쪽에 두고 밝은 가장자리로 움직이라고 하세요.", "어둠을 줄이면서 거미에게 불을 가까이 두면 돼요.", "그림자거미의 은신을 막으면서 일반 거미도 불 가까이 오지 못한다."),
      ecologyAdvice("spider-special-fire-shadow-lane-harm", "harm", "spider-shadow", "횃불을 끄고 두 무리를 모두 자극하지 말자고 하세요.", "불을 끄면 아무도 우리를 못 볼 거예요.", "일반 거미는 조용해지지만 어둠 속 그림자거미가 활동하기 시작한다."),
      neutralAdvice("spider-special-fire-shadow-lane-neutral", "횃불을 들고 입구에서 상황만 더 보자고 하세요.", "한 번 더 확인한 뒤 움직이죠.", "안전하지만 이동이 지연된다."),
    ],
    "파티가 횃불을 지키며 갈림방 입구에서 상황을 관찰한다.",
    { kind: "special" },
  ),
  spiderEvent(
    "spider-special-vibration-carrion-floor",
    "끌린 시체와 울리는 판자",
    "통로 중앙에 오래된 시체가 놓여 있고 그 주변 바닥에는 비어 있는 나무판이 깔려 있다. 판자를 밟으면 아래가 울리고, 안쪽에서는 시체거미가 시체 냄새 쪽으로 움직이고 있다.",
    [
      ecologyAdvice("spider-special-vibration-carrion-floor-help", "help", "spider-vibration", "시체를 건드리지 말고 판자 가장자리를 골라 진동을 줄이며 지나가라고 하세요.", "냄새도 울림도 피하는 가장자리를 골라야 해요.", "시체거미의 관심과 동굴거미의 진동 감지를 모두 피한다."),
      ecologyAdvice("spider-special-vibration-carrion-floor-harm", "harm", "spider-vibration", "시체를 판자 위로 끌어 반대편에 던지라고 하세요.", "시체를 미끼로 던지면 길이 바로 열릴 거예요.", "썩은 냄새와 큰 진동이 동시에 퍼져 여러 거미가 반응한다."),
      neutralAdvice("spider-special-vibration-carrion-floor-neutral", "판자를 치우고 길을 만들라고 하세요.", "시간이 걸려도 바닥을 정리하죠.", "안전하지만 시간이 많이 든다."),
    ],
    "파티가 판자를 치우며 시체와 거리를 두고 통로를 만든다.",
    { kind: "special" },
  ),
  spiderEvent(
    "spider-special-fire-brood-trap",
    "새끼거미가 깨어난 둥지",
    "성체 거미 두 마리는 횃불을 보자 뒤로 물러나지만, 찢어진 고치 아래의 새끼거미 떼는 반대로 횃불 빛을 향해 조금씩 모여든다.",
    [
      ecologyAdvice("spider-special-fire-brood-trap-help", "help", "spider-brood-light", "횃불을 둥지 반대편에 내려놓고 파티는 빛에서 멀어지라고 하세요.", "성체는 불을 피하고 새끼는 빛을 따라가니 서로 반대로 이용하죠.", "성체는 불을 피하고 새끼들은 파티 대신 떨어진 불빛 쪽으로 몰린다."),
      ecologyAdvice("spider-special-fire-brood-trap-harm", "harm", "spider-brood-light", "횃불을 높이 들고 정면으로 밀어붙이라고 하세요.", "성체가 물러나니 빛을 앞세워 밀고 가면 돼요.", "성체는 물러나지만 새끼거미 떼가 파티 쪽 빛으로 몰려든다."),
      neutralAdvice("spider-special-fire-brood-trap-neutral", "불을 유지한 채 뒤로 물러나자고 하세요.", "둥지와 거리를 두고 다시 생각하죠.", "당장은 안전하지만 통과하지 못한다."),
    ],
    "파티가 불을 유지하며 둥지에서 물러난다.",
    { kind: "special" },
  ),
];

const SPIDER_BOSS_EVENTS: readonly NonMerchantSituationEvent[] = [
  bossEvent(
    "spider-boss-ragna-turning",
    "boss-spider-1",
    "라그나: 좁은 곳에서 생긴 흔적",
    "통로 벽 한쪽이 길게 긁혀 있다. 바닥에는 거대한 거미 발자국이 남아 있고, 방향이 꺾이는 곳마다 바위벽이 깨져 있다.",
    [
      bossAdvice("spider-boss-ragna-turning-help", "help", "boss-ragna-turning", "싸우게 되면 좁은 바위 사이로 끌고 가세요.", "저 큰 몸으로 좁은 데서 방향을 바꾸긴 힘들 것 같아요.", "파티는 라그나를 좁은 지형으로 끌어들이는 방법을 기억해둔다."),
      bossAdvice("spider-boss-ragna-turning-harm", "harm", "boss-ragna-turning", "넓은 곳에서 정면으로 상대하는 게 좋겠어요.", "덩치가 크니까 넓은 데서 마음껏 움직이게 두는 게 낫죠.", "파티는 라그나가 자유롭게 몸을 돌릴 수 있는 넓은 곳에서 맞서기로 한다."),
      bossAdvice("spider-boss-ragna-turning-neutral", "neutral", undefined, "방패를 앞에 모아서 버텨보세요.", "일단 큰 공격만 막아내면 될 거예요.", "파티는 방패를 모아 라그나의 공격을 버틸 준비를 한다."),
    ],
    "파티는 벽의 흔적을 확인하지만 특별한 결론은 내리지 않는다.",
  ),
  bossEvent(
    "spider-boss-ragna-crouch",
    "boss-spider-1",
    "라그나: 덮치기 직전",
    "바위틈 너머로 라그나가 작은 동물을 발견한다. 곧장 달려들지 않고 몸을 낮춘 뒤 잠깐 멈췄다가 한 번에 튀어나간다.",
    [
      bossAdvice("spider-boss-ragna-crouch-help", "help", "boss-ragna-crouch", "놈이 몸을 낮추면 바로 옆으로 피하세요.", "달려들기 전에 저 자세를 먼저 잡네요. 그때 피하면 돼요.", "파티는 라그나가 몸을 낮추는 순간을 공격 신호로 기억한다."),
      bossAdvice("spider-boss-ragna-crouch-harm", "harm", "boss-ragna-crouch", "몸을 낮출 때가 공격할 기회예요. 정면으로 파고드세요.", "움직임이 멈추는 순간이니까 바로 달려들죠.", "파티는 라그나가 뛰어들기 직전에 정면으로 맞붙기로 한다."),
      bossAdvice("spider-boss-ragna-crouch-neutral", "neutral", undefined, "공격이 시작되면 방패부터 들어요.", "뭘 하든 먼저 막을 준비부터 해요.", "파티는 라그나의 첫 공격을 방패로 받아낼 생각을 한다."),
    ],
    "파티는 라그나의 움직임을 잠깐 지켜보다 자리를 뜬다.",
  ),
  bossEvent(
    "spider-boss-morkan-cocoon",
    "boss-spider-2",
    "모르칸: 찢어진 고치",
    "사람만 한 빈 고치들이 벽에 매달려 있다. 대부분 같은 쪽이 얇게 찢겨 있고, 반대쪽에는 두꺼운 거미줄이 여러 겹 붙어 있다.",
    [
      bossAdvice("spider-boss-morkan-cocoon-help", "help", "boss-morkan-cocoon-side", "고치에 잡히면 얇은 쪽부터 찢으세요.", "전부 같은 쪽이 먼저 찢어졌어요. 거기가 약한 것 같아요.", "파티는 고치에 갇히면 얇은 면부터 빠져나오기로 기억한다."),
      bossAdvice("spider-boss-morkan-cocoon-harm", "harm", "boss-morkan-cocoon-side", "두꺼운 쪽이 약점일 거예요. 거길 힘껏 밀어요.", "줄이 많이 겹친 곳이 오히려 잘 뜯길 수도 있어요.", "파티는 가장 두꺼운 거미줄 쪽을 힘으로 뚫기로 한다."),
      bossAdvice("spider-boss-morkan-cocoon-neutral", "neutral", undefined, "잡히면 힘을 아끼면서 기회를 기다리세요.", "괜히 힘 빼지 말고 잠깐 기다리는 것도 방법이에요.", "파티는 고치에 잡힐 경우 침착하게 기회를 기다리기로 한다."),
    ],
    "파티는 빈 고치를 살펴본 뒤 더 안쪽으로 이동한다.",
  ),
  bossEvent(
    "spider-boss-morkan-spin",
    "boss-spider-2",
    "모르칸: 거미줄을 만드는 순간",
    "멀리 있는 모르칸이 벽 사이에 새 거미줄을 친다. 줄을 뽑는 동안 움직임이 눈에 띄게 느려지고, 거미줄이 완성되자 다시 빠르게 움직인다.",
    [
      bossAdvice("spider-boss-morkan-spin-help", "help", "boss-morkan-spin-pause", "거미줄을 만들기 시작할 때 공격하세요.", "줄을 만들 때는 거의 움직이지 못하네요. 그때 노리죠.", "파티는 모르칸이 거미줄을 만드는 순간을 공격 기회로 기억한다."),
      bossAdvice("spider-boss-morkan-spin-harm", "harm", "boss-morkan-spin-pause", "거미줄이 완성될 때까지 기다렸다가 달려드세요.", "끝까지 만들게 두고 움직임이 끝난 뒤 들어가는 게 안전해요.", "파티는 모르칸이 다시 자유롭게 움직이기 시작한 뒤 공격하기로 한다."),
      bossAdvice("spider-boss-morkan-spin-neutral", "neutral", undefined, "싸울 때 벽에서 너무 멀어지지 마세요.", "어디서 줄이 날아올지 모르니 벽 쪽이 나을 수도 있어요.", "파티는 벽 가까이에서 서로 위치를 확인하며 싸우기로 한다."),
    ],
    "파티는 모르칸이 거미줄을 만드는 모습을 지켜보다 이동한다.",
  ),
  bossEvent(
    "spider-boss-serina-web-hub",
    "boss-spider-3",
    "세리나: 한꺼번에 움직이는 줄",
    "통로 곳곳에 거미줄이 걸려 있다. 한 줄을 건드리자 멀리 떨어진 여러 줄까지 동시에 팽팽하게 당겨진다.",
    [
      bossAdvice("spider-boss-serina-web-hub-help", "help", "boss-serina-web-hub", "줄들이 만나는 곳부터 끊어놓으세요.", "여러 줄이 같이 움직여요. 가운데 연결된 곳부터 끊죠.", "파티는 여러 거미줄이 만나는 지점을 먼저 끊기로 기억한다."),
      bossAdvice("spider-boss-serina-web-hub-harm", "harm", "boss-serina-web-hub", "보이는 줄 하나를 잡고 세게 당겨버리세요.", "한 줄만 확 잡아당기면 나머지도 풀릴 거예요.", "파티는 눈앞의 거미줄을 힘껏 당겨 세리나의 줄을 한꺼번에 흔들기로 한다."),
      bossAdvice("spider-boss-serina-web-hub-neutral", "neutral", undefined, "거미줄에 닿지 않게 천천히 움직이세요.", "건드리지 않는 게 가장 안전하긴 해요.", "파티는 거미줄과 거리를 두고 조심스럽게 움직이기로 한다."),
    ],
    "파티는 연결된 줄들을 피해 통로를 돌아간다.",
  ),
  bossEvent(
    "spider-boss-serina-retreat",
    "boss-spider-3",
    "세리나: 먼저 막히는 뒤쪽 길",
    "작은 짐승 하나가 세리나의 영역 안으로 들어간다. 세리나는 바로 덮치지 않고 먼저 짐승 뒤쪽 통로를 거미줄로 막은 뒤 천천히 다가간다.",
    [
      bossAdvice("spider-boss-serina-retreat-help", "help", "boss-serina-block-retreat", "싸우기 전에 뒤로 빠질 길부터 확보하세요.", "저건 먹잇감 뒤쪽부터 막네요. 우리 퇴로를 먼저 만들어요.", "파티는 세리나와 싸우기 전에 빠져나갈 길부터 확보하기로 한다."),
      bossAdvice("spider-boss-serina-retreat-harm", "harm", "boss-serina-block-retreat", "놈이 공격하기 전에 최대한 깊숙이 파고드세요.", "뒤를 신경 쓸 시간 없이 바로 가까이 붙는 게 나아요.", "파티는 세리나 영역 안쪽까지 깊게 들어가 정면으로 맞붙기로 한다."),
      bossAdvice("spider-boss-serina-retreat-neutral", "neutral", undefined, "한쪽 벽을 등지고 싸우세요.", "사방을 볼 필요 없게 한쪽을 막고 싸우죠.", "파티는 한쪽 벽을 등지고 진형을 유지하기로 한다."),
    ],
    "파티는 세리나의 사냥 모습을 확인하고 조용히 물러난다.",
  ),
  bossEvent(
    "spider-boss-araksha-follow",
    "boss-spider-4",
    "아라크샤: 여왕을 따라 움직이는 무리",
    "멀리서 여왕 아라크샤가 몸을 오른쪽으로 돌린다. 주변에 흩어져 있던 작은 거미들도 잠시 뒤 같은 방향으로 한꺼번에 움직인다.",
    [
      bossAdvice("spider-boss-araksha-follow-help", "help", "boss-araksha-swarm-follow", "여왕이 움직이면 주변 거미들이 비운 쪽을 노리세요.", "작은 놈들이 여왕을 따라 움직여요. 비는 쪽이 생길 거예요.", "파티는 여왕이 방향을 바꾸는 순간 주변 무리가 빠진 공간을 이용하기로 한다."),
      bossAdvice("spider-boss-araksha-follow-harm", "harm", "boss-araksha-swarm-follow", "여왕이 방향을 바꿀 때 그쪽으로 같이 몰아붙이세요.", "한쪽으로 모일 때 같이 밀어붙이면 한 번에 처리할 수 있어요.", "파티는 여왕과 주변 거미들이 모이는 방향으로 함께 돌진하기로 한다."),
      bossAdvice("spider-boss-araksha-follow-neutral", "neutral", undefined, "작은 거미들은 가까이 오는 것만 막으세요.", "여왕만 보면서 가까운 놈들만 쳐내도 돼요.", "파티는 주변 거미가 너무 가까워질 때만 밀어내기로 한다."),
    ],
    "파티는 여왕과 주변 거미의 움직임을 잠시 지켜본다.",
  ),
  bossEvent(
    "spider-boss-araksha-summon",
    "boss-spider-4",
    "아라크샤: 먼저 몰려오는 거미들",
    "멀리서 아라크샤에게 돌멩이가 날아든다. 여왕은 직접 달려들지 않는다. 몸을 크게 일으키자 주변 구멍에서 거미들이 먼저 쏟아져 나온다.",
    [
      bossAdvice("spider-boss-araksha-summon-help", "help", "boss-araksha-summon-first", "여왕에게 달려들기 전에 주변 거미부터 떨어뜨려 놓으세요.", "여왕을 건드리면 작은 놈들이 먼저 나와요. 주변부터 정리하죠.", "파티는 아라크샤를 자극하기 전에 주변 거미와 거리를 벌리기로 한다."),
      bossAdvice("spider-boss-araksha-summon-harm", "harm", "boss-araksha-summon-first", "여왕을 건드리면 주변이 비게 될 거예요. 바로 달려드세요.", "작은 놈들이 움직이는 동안 여왕만 노리면 돼요.", "파티는 주변 거미가 몰려나오는 순간 여왕에게 바로 돌진하기로 한다."),
      bossAdvice("spider-boss-araksha-summon-neutral", "neutral", undefined, "여왕에게 가까이 갈 때 서로 떨어지지 마세요.", "누가 끌려가도 바로 도울 수 있게 붙어 있어요.", "파티는 서로 가까운 거리를 유지하며 보스전에 들어가기로 한다."),
    ],
    "파티는 주변 구멍의 움직임을 확인하고 경계를 높인다.",
  ),
];

export const SPIDER_EVENTS: readonly NonMerchantSituationEvent[] = [
  ...SPIDER_MONSTER_EVENTS,
  ...SPIDER_BOSS_EVENTS,
];
