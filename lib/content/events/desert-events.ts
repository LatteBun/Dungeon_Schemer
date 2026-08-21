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
  RuleId,
  SituationEvent,
} from "@/lib/domain";

function ecology(ruleId: string): AdviceSource {
  return { kind: "ecology", ruleId: ruleId as RuleId };
}

function boss(bossRuleId: string): AdviceSource {
  return { kind: "boss", bossRuleId: bossRuleId as BossRuleId };
}

function advice(id: string, outcome: AdviceOutcome, label: string, line: string, resultText: string, effectTags: readonly EventEffectTag[], source?: AdviceSource, bossDamageModifier?: number): AdviceOption {
  return { id: id as ChoiceId, label, line, outcome, source, relation: outcome === "help" ? "consistent" : outcome === "harm" ? "contradictory" : "unrelated", effectTags, bossDamageModifier, resultText };
}

function ecologyAdvice(id: string, outcome: "help" | "harm", ruleId: string, label: string, line: string, resultText: string): AdviceOption {
  return advice(id, outcome, label, line, resultText, [outcome === "help" ? "support" : "sabotage"], ecology(ruleId));
}

function neutralAdvice(id: string, label: string, line: string, resultText: string): AdviceOption {
  return advice(id, "neutral", label, line, resultText, ["observe"]);
}

function desertEvent(id: string, title: string, description: string, adviceOptions: readonly AdviceOption[], defaultResultText: string, extras: Partial<SituationEvent> = {}): SituationEvent {
  return { id: id as EventId, kind: "monster", theme: "desert", title, description, advice: adviceOptions, defaultResultText, ...extras };
}

function bossAdvice(id: string, outcome: AdviceOutcome, bossRuleId: string | undefined, label: string, line: string, resultText: string): AdviceOption {
  const modifier = outcome === "help" ? -0.2 : outcome === "neutral" ? -0.1 : 0.25;
  return advice(id, outcome, label, line, resultText, [outcome === "harm" ? "sabotage" : "information"], bossRuleId === undefined ? undefined : boss(bossRuleId), modifier);
}

function bossEvent(id: string, targetBossId: string, title: string, description: string, adviceOptions: readonly AdviceOption[], defaultResultText: string): SituationEvent {
  return { id: id as EventId, kind: "special", theme: "desert", targetBossId: targetBossId as BossId, title, description, advice: adviceOptions, defaultResultText };
}

const DESERT_MONSTER_EVENTS: readonly SituationEvent[] = [
  desertEvent("desert-heat-moving-shadow", "움직이는 그늘", "한낮의 햇빛이 폐허를 달구고 있다. 무너진 기둥 아래 좁은 그늘 속에서 가느다란 비늘 자국이 움직이다가 햇빛이 닿는 경계 바로 앞에서 멈춘다.", [
    ecologyAdvice("desert-heat-moving-shadow-help", "help", "desert-heat", "그늘을 피해 햇빛이 드는 쪽으로 돌아가세요.", "저 자국, 밝은 쪽으로는 안 나오네요. 조금 덥더라도 밖으로 돌아가죠.", "파티가 뜨거운 모래로 돌아가는 동안 그늘 속 코브라는 모습을 드러내지 않는다."),
    ecologyAdvice("desert-heat-moving-shadow-harm", "harm", "desert-heat", "그늘을 따라 빠르게 지나가세요.", "햇빛보다는 저쪽이 걷기 편하겠어요.", "파티가 그늘로 들어서자 돌 틈에서 코브라들이 몸을 일으킨다."),
    neutralAdvice("desert-heat-moving-shadow-neutral", "방패를 낮게 들고 천천히 움직이세요.", "뭐가 튀어나올지 모르니 발밑부터 보죠.", "파티가 주변을 확인하며 큰 충돌 없이 폐허를 지난다."),
  ], "파티가 그늘과 거리를 두며 조심스럽게 폐허를 지나간다.", { revealsClue: "clue-desert-cobra-shade" as ClueId }),
  desertEvent("desert-heat-torn-canopy", "천막 아래의 흔적", "찢어진 천막 하나가 바람에 흔들린다. 천막이 만든 그늘 안쪽에는 길게 끌린 자국이 여러 개 있지만, 바로 옆 햇빛 아래의 모래는 깨끗하다.", [
    ecologyAdvice("desert-heat-torn-canopy-help", "help", "desert-heat", "천막에서 떨어진 밝은 쪽으로 지나가세요.", "저 흔적이 전부 그늘 안에만 있어요. 가까이 갈 이유가 없어요.", "파티가 햇빛 아래로 크게 돌아 코브라의 영역을 피한다."),
    ecologyAdvice("desert-heat-torn-canopy-harm", "harm", "desert-heat", "천막 밑에서 잠깐 쉬었다 가세요.", "여기만큼 시원한 곳도 없잖아요.", "파티가 그늘에 들어서자 천막 아래 모래에서 코브라가 튀어나온다."),
    neutralAdvice("desert-heat-torn-canopy-neutral", "천막을 걷어내고 주변부터 살펴보세요.", "가려진 게 많으니 그냥 치워버리죠.", "파티가 천막을 걷어내느라 시간을 쓰지만 주변 시야는 넓어진다."),
  ], "파티가 천막 주변을 멀찍이 돌아간다.", { upgrades: [{ clueId: "clue-desert-cobra-shade" as ClueId, slotIndex: 0, replacement: ecologyAdvice("desert-heat-torn-canopy-help-upgraded", "help", "desert-heat", "천막 자체를 피해 햇빛 쪽 바위 능선으로 돌아가세요.", "아까도 비늘 자국이 그늘 끝에서 멈췄어요. 이번에도 그늘 자체를 피하죠.", "파티가 코브라가 숨을 만한 그늘을 완전히 벗어난 바위 능선으로 안전하게 우회한다.") } satisfies AdviceUpgrade] }),
  desertEvent("desert-lizard-heated-rock", "달궈진 바위", "햇볕에 달궈진 검은 바위 위에서 모래도마뱀 몇 마리가 몸을 납작하게 붙이고 있다. 구름이 해를 가리자 녀석들의 움직임이 눈에 띄게 느려진다.", [
    ecologyAdvice("desert-lizard-heated-rock-help", "help", "desert-lizard-heat", "구름이 해를 가린 사이 지나가세요.", "햇빛이 사라지니까 갑자기 느려졌어요. 지금 움직이죠.", "도마뱀들이 둔해진 사이 파티가 바위 지대를 빠져나간다."),
    ecologyAdvice("desert-lizard-heated-rock-harm", "harm", "desert-lizard-heat", "햇빛이 강한 바위 위로 바로 올라가세요.", "뜨거우면 저 녀석들도 오래 버티진 못하겠죠.", "달궈진 바위 위에서 활발해진 도마뱀들이 파티 주위를 빠르게 에워싼다."),
    neutralAdvice("desert-lizard-heated-rock-neutral", "긴 막대로 앞쪽 돌틈을 확인하세요.", "숨어 있는 게 더 있는지만 보고 가죠.", "파티가 돌틈을 확인하며 천천히 이동한다."),
  ], "파티가 바위 지대를 우회하면서 예상보다 많은 시간을 쓴다."),
  desertEvent("desert-lizard-sunrise-slope", "햇볕을 기다리는 무리", "모래 언덕 한쪽은 절벽 그림자에 가려져 있고 반대쪽은 햇빛을 받고 있다. 그늘에 있던 모래도마뱀들이 햇빛이 퍼지기 시작하자 하나둘 밝은 비탈로 몰려간다.", [
    ecologyAdvice("desert-lizard-sunrise-slope-help", "help", "desert-lizard-heat", "도마뱀이 빠져나간 그늘 쪽으로 움직이세요.", "전부 따뜻한 쪽으로 가고 있어요. 빈 쪽을 쓰죠.", "파티가 도마뱀들이 떠난 그늘을 따라 안전하게 언덕을 지난다."),
    ecologyAdvice("desert-lizard-sunrise-slope-harm", "harm", "desert-lizard-heat", "햇빛 쪽이 잘 보이니 밝은 비탈로 가세요.", "숨을 곳 없는 쪽이 차라리 안전해 보여요.", "파티가 활발해진 모래도마뱀 무리 한가운데로 들어선다."),
    neutralAdvice("desert-lizard-sunrise-slope-neutral", "언덕 아래 평지로 크게 돌아가세요.", "어느 쪽이든 찜찜하니 그냥 멀리 갑시다.", "큰 충돌은 피하지만 이동 거리가 길어진다."),
  ], "파티가 도마뱀 무리가 흩어질 때까지 기다렸다가 움직인다."),
  desertEvent("desert-water-damp-well", "젖은 우물가", "말라붙은 우물 아래에 물이 조금 남아 있다. 젖은 모래 주변에는 손가락만 한 둥근 구멍들이 여러 개 뚫려 있고, 마른 쪽에는 그런 구멍이 보이지 않는다.", [
    ecologyAdvice("desert-water-damp-well-help", "help", "desert-water", "우물에서 멀리 떨어진 마른 모래로 돌아가세요.", "젖은 곳에만 구멍이 몰려 있어요. 가까이 가지 않는 게 좋겠어요.", "파티가 우물을 크게 우회하고 모래 속 전갈들은 모습을 드러내지 않는다."),
    ecologyAdvice("desert-water-damp-well-harm", "harm", "desert-water", "우물 가장자리를 따라가세요.", "젖은 모래 쪽이 단단해서 걷기 편할 거예요.", "파티가 우물에 가까워지자 작은 구멍마다 전갈들이 기어 나온다."),
    neutralAdvice("desert-water-damp-well-neutral", "우물물을 조금 챙기고 바로 떠나세요.", "오래 머물지만 않으면 괜찮을 것 같아요.", "파티가 짧게 물을 챙기는 동안 주변을 경계하며 움직인다."),
  ], "파티가 우물과 거리를 두고 모래 언덕 쪽으로 돌아간다.", { revealsClue: "clue-desert-scorpion-damp-burrow" as ClueId }),
  desertEvent("desert-water-leaking-cargo", "새어 나온 물", "버려진 짐수레 옆에서 깨진 물통 하나가 계속 물을 흘리고 있다. 물이 스며든 모래를 중심으로 작은 구멍들이 원을 그리듯 늘어서 있다.", [
    ecologyAdvice("desert-water-leaking-cargo-help", "help", "desert-water", "물통을 건드리지 말고 젖은 모래 밖으로 크게 돌아가세요.", "우물에서도 이런 구멍이 젖은 곳에 몰려 있었어요. 여기에도 들어가면 안 돼요.", "파티가 젖은 범위를 피해 이동하자 전갈들은 모래 아래에 그대로 남는다."),
    ecologyAdvice("desert-water-leaking-cargo-harm", "harm", "desert-water", "남은 물을 챙긴 뒤 수레 뒤로 지나가세요.", "마실 물은 귀하니까 이것만 가져가죠.", "물통을 움직이는 순간 젖은 모래 아래에서 전갈들이 연달아 솟아난다."),
    neutralAdvice("desert-water-leaking-cargo-neutral", "수레를 밀어서 길부터 넓히세요.", "좁아서 위험해 보이니 공간부터 만들죠.", "파티가 수레를 치우며 경계하지만 상당한 시간을 소비한다."),
  ], "파티가 수레와 젖은 모래를 피해 먼 쪽으로 우회한다.", { requiresClue: "clue-desert-scorpion-damp-burrow" as ClueId }),
  desertEvent("desert-spirit-dry-altar", "바싹 마른 제단", "폐허 제단 앞 모래는 갈라질 만큼 말라 있다. 물주머니에서 떨어진 한 방울이 스며든 자리만 모래가 어둡게 변했고, 그 선을 따라오던 희미한 모래 형체가 그 앞에서 멈춘다.", [
    ecologyAdvice("desert-spirit-dry-altar-help", "help", "desert-spirit-dry", "앞쪽 모래에 물을 조금 뿌리며 지나가세요.", "저 형체가 젖은 자리 앞에서 멈췄어요. 길을 만들어보죠.", "젖은 모래 띠가 생기자 모래정령이 가까이 오지 못하고 파티가 통과한다."),
    ecologyAdvice("desert-spirit-dry-altar-harm", "harm", "desert-spirit-dry", "물을 아끼고 가장 마른 제단 위로 올라가세요.", "단단한 곳이니 발도 덜 빠질 거예요.", "완전히 마른 제단 위에서 모래정령의 형체가 선명해지며 파티를 덮친다."),
    neutralAdvice("desert-spirit-dry-altar-neutral", "제단 옆 돌담을 따라 천천히 가세요.", "일단 벽을 끼고 움직이면 한쪽은 막을 수 있어요.", "파티가 돌담을 따라 조심스럽게 빠져나간다."),
  ], "파티가 제단을 멀리 돌아가며 수분과 시간을 조금 더 쓴다."),
  desertEvent("desert-mummy-silent-tomb", "발자국 없는 무덤문", "모래에 파묻힌 무덤문 앞에는 사람 발자국이 하나도 없다. 그런데 문 아래 먼지 위에 낡은 붕대 조각이 끌린 가느다란 자국만 안쪽으로 이어진다.", [
    ecologyAdvice("desert-mummy-silent-tomb-help", "help", "desert-mummy-silent", "발자국이 없어도 문 바로 앞은 피하세요.", "발은 안 찍혔는데 붕대만 끌렸어요. 뭔가 그냥 미끄러져 다니는 것 같아요.", "파티가 무덤문에서 떨어져 움직이고 안쪽의 미이라와 마주치지 않는다."),
    ecologyAdvice("desert-mummy-silent-tomb-harm", "harm", "desert-mummy-silent", "발자국 없는 문이니 바로 들어가세요.", "아무도 드나든 흔적이 없어요. 비어 있겠죠.", "파티가 문을 열자 바로 뒤에 서 있던 미이라가 소리 없이 덮친다."),
    neutralAdvice("desert-mummy-silent-tomb-neutral", "문을 두드리고 안쪽 반응을 기다리세요.", "뭐가 있든 먼저 확인하고 들어가죠.", "뚜렷한 반응은 없지만 파티가 경계한 채 문을 지난다."),
  ], "파티가 무덤 입구를 지나치고 바깥길로 돌아간다.", { revealsClue: "clue-desert-mummy-no-tracks" as ClueId }),
  desertEvent("desert-wind-track-erasure", "사라지는 행렬", "모래 위에 여러 사람의 발자국이 길게 이어져 있다. 강한 바람이 한 번 지나가자 앞쪽 자국부터 빠르게 흐려지고, 몇 걸음 뒤에는 처음부터 아무도 지나지 않은 것처럼 평평해진다.", [
    ecologyAdvice("desert-wind-track-erasure-help", "help", "desert-wind-track", "발자국 대신 바위에 남은 긁힌 표시를 따라가세요.", "모래 자국은 금방 없어져요. 바람에 안 지워지는 걸 봐야 해요.", "파티가 고정된 바위 흔적을 기준으로 길을 잃지 않고 이동한다."),
    ecologyAdvice("desert-wind-track-erasure-harm", "harm", "desert-wind-track", "발자국이 끊긴 곳부터는 아무도 지나지 않은 길이에요.", "흔적이 없으니 그쪽이 더 안전하겠죠.", "바람에 지워진 흔적을 빈 길로 착각해 파티가 몬스터가 지나간 길로 들어선다."),
    neutralAdvice("desert-wind-track-erasure-neutral", "높은 곳에 올라가 주변 지형부터 확인하세요.", "흔적 말고 길 모양을 보는 게 낫겠어요.", "파티가 시간을 들여 언덕 위에서 방향을 다시 잡는다."),
  ], "파티가 발자국을 포기하고 지형을 기준으로 천천히 이동한다."),
  desertEvent("desert-dry-wind-boundary", "물 한 방울의 경계", "바람이 훑고 간 마른 광장에는 희미한 발자국이 중간에서 끊겨 있다. 옆에서 새는 물주머니가 모래를 적시자 바닥에서 일렁이던 모래 형체가 젖은 경계 바깥으로 물러난다.", [
    ecologyAdvice("desert-dry-wind-boundary-help", "help", "desert-spirit-dry", "물을 조금씩 뿌려 젖은 길을 만들며 건너세요.", "저 형체가 젖은 모래를 피하고 있어요. 길을 이어보죠.", "파티가 젖은 선을 이어 만들며 모래정령의 영역을 가로지른다."),
    ecologyAdvice("desert-dry-wind-boundary-harm", "harm", "desert-wind-track", "발자국이 끊긴 쪽은 아무것도 안 지나간 곳이니 그쪽으로 가세요.", "저기부터 흔적이 없어요. 빈 길 같아요.", "바람이 흔적을 지운 방향으로 들어간 파티가 숨어 있던 몬스터와 맞닥뜨린다."),
    neutralAdvice("desert-dry-wind-boundary-neutral", "광장 가장자리를 따라 크게 우회하세요.", "가운데가 수상하니 그냥 가장자리로 갑시다.", "파티가 안전한 대신 먼 길을 택한다."),
  ], "파티가 광장을 피해 폐허 뒤편으로 돌아간다."),
  desertEvent("desert-mummy-dry-chamber", "조용한 석실", "작은 석실 앞 모래에는 발자국이 없지만 문틀에 걸린 붕대 끝이 안쪽으로 천천히 끌려 들어간다. 반대편의 완전히 마른 빈 방에서는 모래 먼지가 사람 모양으로 잠깐 솟았다 사라진다.", [
    ecologyAdvice("desert-mummy-dry-chamber-help", "help", "desert-mummy-silent", "발자국 없는 석실도 비었다고 보지 말고 붕대가 움직이는 문을 피하세요.", "발자국보다 저 붕대가 더 확실해요. 저쪽은 피하죠.", "파티가 미이라가 있는 석실을 피해 다른 통로로 이동한다."),
    ecologyAdvice("desert-mummy-dry-chamber-harm", "harm", "desert-spirit-dry", "아무것도 젖지 않은 마른 방에서 쉬세요.", "물기 없는 방이면 벌레도 없을 거예요.", "완전히 마른 방에 들어서자 모래정령이 선명한 형체를 이루며 덮친다."),
    neutralAdvice("desert-mummy-dry-chamber-neutral", "두 방 모두 지나치고 복도로 계속 가세요.", "둘 다 수상하니 굳이 들어갈 필요 없어요.", "파티가 자원을 얻지 못하지만 큰 충돌도 피한다."),
  ], "파티가 두 석실을 건드리지 않고 복도를 지난다."),
  desertEvent("desert-wind-mummy-courtyard", "바람이 훑은 묘역", "바람이 센 묘역의 모래에는 어디에도 발자국이 남아 있지 않다. 무덤문 아래에는 모래 대신 무거운 돌가루가 쌓여 있고, 그 위로 낡은 붕대가 스친 가느다란 선 하나만 남아 있다.", [
    ecologyAdvice("desert-wind-mummy-courtyard-help", "help", "desert-wind-track", "모래 흔적은 버리고 바람에 잘 안 날리는 돌가루 자국을 따라 움직이세요.", "모래 발자국은 지워져도 저 돌가루 흔적은 남았어요. 고정된 흔적만 믿죠.", "파티가 바람에 지워지지 않은 흔적을 기준으로 미이라가 드나드는 문을 피해 간다."),
    ecologyAdvice("desert-wind-mummy-courtyard-harm", "harm", "desert-mummy-silent", "발자국 없는 무덤문 바로 앞이 가장 안전해요.", "아까와 달리 여기엔 정말 발자국이 하나도 없어요. 아무것도 없겠죠.", "발자국을 남기지 않는 미이라가 문 뒤에서 나와 파티를 덮친다."),
    neutralAdvice("desert-wind-mummy-courtyard-neutral", "바람이 약해질 때까지 돌담 뒤에서 기다리세요.", "지금은 뭐가 지나갔는지 보기 어려워요. 잠깐 기다리죠.", "파티가 시간을 쓰지만 바람이 잦아든 뒤 더 조심스럽게 움직인다."),
  ], "파티가 묘역 바깥 돌길로 크게 우회한다.", { requiresClue: "clue-desert-mummy-no-tracks" as ClueId }),
];

const DESERT_BOSS_EVENTS: readonly SituationEvent[] = [
  bossEvent("desert-boss-zakar-burrow-trace", "boss-desert-1", "모래 위의 가는 선", "넓은 모래밭은 평평해 보이지만 한가운데에 가느다란 선이 길게 이어져 있다. 선 끝의 모래만 일정한 간격으로 살짝 솟았다 내려간다.", [
    bossAdvice("desert-boss-zakar-burrow-trace-help", "help", "boss-zakar-burrow-trace", "가는 선의 끝을 피해서 움직이라고 알려주세요.", "저 선 밑에 큰 게 숨어 움직이는 것 같아요.", "파티가 자카르의 매복 위치를 읽는 방법을 기억한다."), bossAdvice("desert-boss-zakar-burrow-trace-harm", "harm", "boss-zakar-burrow-trace", "선은 바람 자국이니 가장 평평한 끝부분으로 가라고 하세요.", "바람이 만든 흔적 같아요. 신경 쓰지 않아도 돼요.", "파티가 자카르의 매복 흔적을 자연 현상으로 오해한다."), bossAdvice("desert-boss-zakar-burrow-trace-neutral", "neutral", undefined, "긴 무기로 앞 모래를 확인하며 가라고 하세요.", "모래 아래 뭐가 있는지만 조심하죠.", "파티가 특별한 약점은 모르지만 매복을 경계하게 된다."),
  ], "파티는 선을 피해 넓게 돌아가지만 그 의미까지는 알아내지 못한다."),
  bossEvent("desert-boss-zakar-emerge-gap", "boss-desert-1", "솟구친 뒤의 멈춤", "멀리서 거대한 전갈이 모래를 뚫고 튀어나온다. 집게와 다리를 크게 벌린 채 몇 순간 굳어 있다가 그제야 몸을 돌린다.", [
    bossAdvice("desert-boss-zakar-emerge-gap-help", "help", "boss-zakar-emerge-gap", "튀어나온 직후가 빈틈이라고 알려주세요.", "나오자마자 바로 움직이진 못해요. 그 순간을 쓰죠.", "파티가 자카르의 출현 직후 빈틈을 기억한다."), bossAdvice("desert-boss-zakar-emerge-gap-harm", "harm", "boss-zakar-emerge-gap", "튀어나오는 순간에는 무조건 거리를 벌리라고 하세요.", "저때가 제일 위험해 보여요. 등을 돌리고 빠져야 해요.", "파티가 자카르가 멈추는 순간을 놓치는 전술을 준비한다."), bossAdvice("desert-boss-zakar-emerge-gap-neutral", "neutral", undefined, "집게 사거리 밖을 유지하라고 하세요.", "틈을 모르겠으면 일단 거리부터 지켜요.", "파티가 보수적인 간격을 유지할 준비를 한다."),
  ], "파티는 전갈의 움직임을 기억하지만 확실한 대응법은 정하지 않는다."),
  bossEvent("desert-boss-kardum-sand-ridge", "boss-desert-2", "앞서 솟는 모래", "모래 아래의 거대한 물체가 빠르게 다가온다. 실제 몸이 지나오기 전에 몇 걸음 앞의 모래가 길게 부풀어 오르고, 잠시 뒤 그 뒤쪽에서 샌드웜의 등이 스친다.", [
    bossAdvice("desert-boss-kardum-sand-ridge-help", "help", "boss-kardum-sand-ridge", "솟아오르는 모래보다 뒤쪽이 아니라 앞선을 보고 피하라고 하세요.", "몸보다 앞의 모래가 먼저 알려줘요. 저 솟는 선을 보면 돼요.", "파티가 카르둠의 진로를 미리 읽는 법을 기억한다."), bossAdvice("desert-boss-kardum-sand-ridge-harm", "harm", "boss-kardum-sand-ridge", "몸이 보인 뒤에 방향을 정하라고 하세요.", "모래만 보고 움직이면 헷갈려요. 본체가 나올 때 피하죠.", "파티가 카르둠의 전조를 무시하고 늦게 대응하게 된다."), bossAdvice("desert-boss-kardum-sand-ridge-neutral", "neutral", undefined, "넓게 흩어져 서라고 하세요.", "어디서 나올지 모르니 한곳에 모이지 말죠.", "파티가 일반적인 분산 대응을 준비한다."),
  ], "파티는 솟는 모래를 수상하게 여기지만 정확한 의미는 확정하지 않는다."),
  bossEvent("desert-boss-kardum-landing-pause", "boss-desert-2", "모래 밖의 거대한 몸", "샌드웜이 크게 뛰쳐나와 바닥에 떨어진다. 거대한 몸이 몇 차례 꿈틀거리지만 바로 모래 속으로 파고들지 못하고 한동안 표면에 남아 있다.", [
    bossAdvice("desert-boss-kardum-landing-pause-help", "help", "boss-kardum-landing-pause", "큰 도약 뒤 표면에 남은 순간을 노리라고 하세요.", "저렇게 떨어지고 나면 바로 숨지 못해요. 그때 몰아붙이죠.", "파티가 카르둠이 노출되는 시간을 활용할 준비를 한다."), bossAdvice("desert-boss-kardum-landing-pause-harm", "harm", "boss-kardum-landing-pause", "땅에 떨어진 직후에는 가까이 가지 말라고 하세요.", "저때가 다시 튀어오르기 제일 쉬울 거예요.", "파티가 카르둠의 노출 시간을 스스로 버리는 전술을 세운다."), bossAdvice("desert-boss-kardum-landing-pause-neutral", "neutral", undefined, "도약 궤적에서만 벗어나라고 하세요.", "공격 타이밍은 몰라도 떨어지는 자리부터 피하죠.", "파티가 기본적인 회피 동선을 준비한다."),
  ], "파티는 거대한 도약을 경계하는 정도로만 기억한다."),
  bossEvent("desert-boss-obelon-leg-collapse", "boss-desert-3", "무너진 발목", "돌거인이 무너진 계단을 밟는다. 발목에서 작은 돌 몇 개가 빠지자 거대한 상체가 한쪽으로 크게 기울고 손으로 바닥을 짚어 겨우 버틴다.", [
    bossAdvice("desert-boss-obelon-leg-collapse-help", "help", "boss-obelon-leg-collapse", "다리의 돌 배열을 흐트러뜨리라고 알려주세요.", "몸통보다 발목이 무너지니까 균형을 못 잡아요.", "파티가 오벨론의 균형을 무너뜨릴 지점을 기억한다."), bossAdvice("desert-boss-obelon-leg-collapse-harm", "harm", "boss-obelon-leg-collapse", "작은 돌은 무시하고 몸통 중앙만 노리라고 하세요.", "저 정도 돌 몇 개는 의미 없어요. 큰 몸통을 쳐야 해요.", "파티가 오벨론의 구조적 약점을 무시한다."), bossAdvice("desert-boss-obelon-leg-collapse-neutral", "neutral", undefined, "거인의 정면을 피해 측면에서 싸우라고 하세요.", "약점은 몰라도 정면은 피하는 게 낫겠어요.", "파티가 안전한 위치 선정만 준비한다."),
  ], "파티는 오벨론이 균형을 잃는 장면을 기억한다."),
  bossEvent("desert-boss-obelon-rebuild-stones", "boss-desert-3", "돌아오는 돌조각", "돌거인의 몸에서 떨어진 조각들이 바닥에 멈춰 있다. 잠시 뒤 조각들이 떨리기 시작하더니 하나둘 거인의 몸 쪽으로 굴러가 다시 붙는다.", [
    bossAdvice("desert-boss-obelon-rebuild-stones-help", "help", "boss-obelon-rebuild-stones", "떨어진 돌이 돌아가기 전에 멀리 치우라고 하세요.", "부순 걸 그대로 두면 다시 붙어요. 돌부터 멀리 보내야 해요.", "파티가 오벨론의 재구성을 늦출 방법을 기억한다."), bossAdvice("desert-boss-obelon-rebuild-stones-harm", "harm", "boss-obelon-rebuild-stones", "떨어진 돌은 신경 쓰지 말고 계속 몸만 공격하라고 하세요.", "바닥 돌까지 챙길 시간 없어요. 본체만 때리죠.", "파티가 오벨론의 재구성을 방치하게 된다."), bossAdvice("desert-boss-obelon-rebuild-stones-neutral", "neutral", undefined, "돌이 날아올 수 있으니 바닥도 살피라고 하세요.", "뭐가 움직일지 모르니 발밑은 계속 봐요.", "파티가 재구성 원리는 모르지만 움직이는 파편을 경계한다."),
  ], "파티는 돌이 되돌아가는 현상을 기억하지만 활용법은 정하지 않는다."),
  bossEvent("desert-boss-nephris-question-still", "boss-desert-4", "답을 기다리는 수호자", "스핑크스가 길을 막고 수수께끼를 던진다. 앞의 작은 짐승이 겁에 질려 이리저리 움직이지만 대답이 나오기 전까지 네프리스는 앞발 하나 움직이지 않는다.", [
    bossAdvice("desert-boss-nephris-question-still-help", "help", "boss-nephris-question-still", "질문이 끝난 뒤 답하기 전 시간을 정비에 쓰라고 하세요.", "대답 전에는 먼저 안 움직여요. 그 시간을 그냥 버리지 맙시다.", "파티가 네프리스의 질문 시간을 준비 시간으로 활용한다."), bossAdvice("desert-boss-nephris-question-still-harm", "harm", "boss-nephris-question-still", "질문이 나오면 바로 공격해서 선수를 치라고 하세요.", "가만히 있을 때 먼저 쳐야죠. 기다릴 이유가 없어요.", "파티가 네프리스의 행동 규칙을 오해한 채 성급한 대응을 준비한다."), bossAdvice("desert-boss-nephris-question-still-neutral", "neutral", undefined, "답을 정하기 전 서로 신호만 맞추라고 하세요.", "정답은 몰라도 누가 말할지는 정해두죠.", "파티가 기본적인 협동 준비를 한다."),
  ], "파티는 네프리스가 기다린다는 사실만 기억한다."),
  bossEvent("desert-boss-nephris-wrong-answer-tell", "boss-desert-4", "번쩍이는 목장식", "누군가 답을 외치자 네프리스가 잠깐 고개를 기울인다. 목의 금빛 장식과 두 눈이 동시에 번쩍이고, 그제야 앞발을 들어 공격 자세를 취한다.", [
    bossAdvice("desert-boss-nephris-wrong-answer-tell-help", "help", "boss-nephris-wrong-answer-tell", "목장식과 눈이 빛나면 바로 방어 자세를 잡으라고 하세요.", "빛나는 순간이 공격 직전이에요. 그때 대비하면 돼요.", "파티가 네프리스의 공격 전조를 읽는 법을 기억한다."), bossAdvice("desert-boss-nephris-wrong-answer-tell-harm", "harm", "boss-nephris-wrong-answer-tell", "빛은 정답 신호이니 그때 공격을 멈추라고 하세요.", "저렇게 빛나는 건 답을 인정했다는 뜻 같아요.", "파티가 네프리스의 공격 전조를 안전 신호로 오해한다."), bossAdvice("desert-boss-nephris-wrong-answer-tell-neutral", "neutral", undefined, "답을 말한 사람 뒤로 방패를 붙이라고 하세요.", "무슨 뜻이든 대답 뒤에는 방어부터 해두죠.", "파티가 전조의 의미는 모르지만 보수적으로 대비한다."),
  ], "파티는 빛나는 장식을 수상하게 여기지만 해석을 확정하지 않는다."),
];

export const DESERT_EVENTS: readonly SituationEvent[] = [
  ...DESERT_MONSTER_EVENTS,
  ...DESERT_BOSS_EVENTS,
];
