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
  RuleId,
} from "@/lib/domain";

function ecology(ruleId: string): AdviceSource {
  return { kind: "ecology", ruleId: ruleId as RuleId };
}

function boss(bossRuleId: string): AdviceSource {
  return { kind: "boss", bossRuleId: bossRuleId as BossRuleId };
}

function advice(id: string, outcome: AdviceOutcome, label: string, line: string, resultText: string, effectTags: readonly EventEffectTag[], source?: AdviceSource, bossDamageModifier?: number): AdviceOption {
  return {
    id: id as ChoiceId,
    label,
    line,
    outcome,
    source,
    relation: outcome === "help" ? "consistent" : outcome === "harm" ? "contradictory" : "unrelated",
    effectTags,
    bossDamageModifier,
    resultText,
  };
}

function bossAdvice(id: string, outcome: AdviceOutcome, bossRuleId: string | undefined, label: string, line: string, resultText: string): AdviceOption {
  const modifier = outcome === "help" ? -0.2 : outcome === "neutral" ? -0.1 : 0.25;
  return advice(id, outcome, label, line, resultText, [outcome === "harm" ? "sabotage" : "information"], bossRuleId === undefined ? undefined : boss(bossRuleId), modifier);
}

function ecologyAdvice(id: string, outcome: "help" | "harm", ruleId: string, label: string, line: string, resultText: string): AdviceOption {
  return advice(id, outcome, label, line, resultText, [outcome === "help" ? "support" : "sabotage"], ecology(ruleId));
}

function neutralAdvice(id: string, label: string, line: string, resultText: string): AdviceOption {
  return advice(id, "neutral", label, line, resultText, ["observe"]);
}

function graveyardEvent(id: string, title: string, description: string, adviceOptions: readonly AdviceOption[], defaultResultText: string, extras: Partial<NonMerchantSituationEvent> = {}): NonMerchantSituationEvent {
  return { id: id as EventId, kind: "monster", theme: "graveyard", title, description, advice: adviceOptions, defaultResultText, ...extras };
}

function bossEvent(id: string, targetBossId: string, title: string, description: string, adviceOptions: readonly AdviceOption[], defaultResultText: string): NonMerchantSituationEvent {
  return { id: id as EventId, kind: "special", theme: "graveyard", targetBossId: targetBossId as BossId, title, description, advice: adviceOptions, defaultResultText };
}

const GRAVEYARD_MONSTER_EVENTS: readonly NonMerchantSituationEvent[] = [
  graveyardEvent("graveyard-silence-zombie-bell", "무너진 종루 아래", "썩은 좀비 한 마리가 무너진 종루 아래를 서성인다. 작은 돌이 굴러가 종 조각에 부딪혀도 좀비는 잠깐 고개만 들 뿐 방향을 바꾸지 않는다.", [
    ecologyAdvice("graveyard-silence-zombie-bell-help", "help", "graveyard-silence", "괜히 큰 소리를 만들지 말고 조용히 옆길로 지나가세요.", "작은 소리에는 거의 반응 안 해요. 그냥 조용히 빠져나가죠.", "파티가 발걸음을 줄여 좀비의 주의를 끌지 않고 지나간다."),
    ecologyAdvice("graveyard-silence-zombie-bell-harm", "harm", "graveyard-silence", "종 조각을 세게 쳐서 좀비를 멀리 유인하세요.", "큰 소리를 내면 저쪽으로 따라가겠죠.", "소리에 둔한 좀비가 기대만큼 움직이지 않아 파티가 가까운 거리에서 마주친다."),
    neutralAdvice("graveyard-silence-zombie-bell-neutral", "묘비를 방패 삼아 천천히 이동하세요.", "반응을 모르겠으면 몸부터 가리죠.", "파티가 묘비 사이를 돌아 큰 충돌 없이 이동한다."),
  ], "파티가 좀비와 거리를 유지하며 천천히 지나간다.", { revealsClue: "clue-graveyard-zombie-sound" as ClueId }),
  graveyardEvent("graveyard-silence-rusted-chain", "녹슨 사슬", "통로에 녹슨 사슬이 늘어져 있다. 바람이 사슬을 살짝 흔들어 쇳소리가 나지만 벽 쪽의 썩은 좀비는 몸만 느리게 흔들 뿐 다가오지 않는다.", [
    ecologyAdvice("graveyard-silence-rusted-chain-help", "help", "graveyard-silence", "사슬을 건드리지 않게 천천히 옆으로 지나가세요.", "작은 소리는 넘기는 것 같아요. 더 크게 만들지만 않으면 돼요.", "파티가 사슬을 피해 조용히 통로를 지난다."),
    ecologyAdvice("graveyard-silence-rusted-chain-harm", "harm", "graveyard-silence", "사슬을 끌어 반대쪽으로 던져 좀비를 유인하세요.", "소리만 멀리 내면 따라갈 거예요.", "좀비는 둔하게 반응할 뿐 자리를 크게 벗어나지 않아 파티의 길을 그대로 막는다."),
    neutralAdvice("graveyard-silence-rusted-chain-neutral", "벽을 따라 한 줄로 이동하세요.", "사슬에서만 떨어져 가죠.", "파티가 시간을 들여 좁은 벽 쪽으로 통과한다."),
  ], "파티가 사슬을 밟지 않도록 조심하며 지나간다.", { upgrades: [{ clueId: "clue-graveyard-zombie-sound" as ClueId, slotIndex: 0, replacement: ecologyAdvice("graveyard-silence-rusted-chain-help-upgraded", "help", "graveyard-silence", "사슬을 바닥에 눌러 고정하고 그대로 지나가세요.", "아까 종소리에도 거의 반응 없었어요. 완전히 조용하게 만들 필요 없이 큰 소리만 막죠.", "파티가 최소한의 움직임으로 사슬 소리를 줄이고 빠르게 통로를 통과한다.") } satisfies AdviceUpgrade] }),
  graveyardEvent("graveyard-ghoul-bone-crunch", "뼈를 씹는 소리", "구울 한 마리가 시체 옆에 쭈그리고 앉아 뼈를 씹고 있다. 멀리서 작은 자갈 하나가 묘비에 닿자 구울이 즉시 고개를 들고 정확히 그쪽을 바라본다.", [
    ecologyAdvice("graveyard-ghoul-bone-crunch-help", "help", "graveyard-ghoul-sound", "아무것도 건드리지 말고 발을 끌지 않게 천천히 빠져나가세요.", "저건 아주 작은 소리도 바로 듣네요. 최대한 조용히 갑시다.", "파티가 장비를 붙잡고 소리를 줄여 구울의 시선을 피한다."),
    ecologyAdvice("graveyard-ghoul-bone-crunch-harm", "harm", "graveyard-ghoul-sound", "작은 돌을 여러 방향으로 던지며 지나가세요.", "소리가 많으면 어디를 봐야 할지 헷갈릴 거예요.", "구울이 연달아 나는 작은 소리를 따라 파티의 이동 방향까지 정확히 찾아낸다."),
    neutralAdvice("graveyard-ghoul-bone-crunch-neutral", "시체에서 최대한 멀리 붙어서 돌아가세요.", "먹는 데 집중할 때 거리를 벌리죠.", "파티가 큰 충돌 없이 멀리 우회한다."),
  ], "파티가 구울이 먹이에 집중하는 동안 조심스럽게 뒤로 물러난다."),
  graveyardEvent("graveyard-ghoul-dropped-coin", "떨어진 동전", "파티원의 주머니에서 동전 하나가 떨어져 돌바닥을 한 번 튕긴다. 멀리 있던 구울 두 마리가 동시에 움직임을 멈추고 동전이 떨어진 방향으로 얼굴을 돌린다.", [
    ecologyAdvice("graveyard-ghoul-dropped-coin-help", "help", "graveyard-ghoul-sound", "장비와 주머니를 단단히 묶고 그 자리에서 소리를 멈추세요.", "저 정도 소리도 들었어요. 더 흘리기 전에 전부 고정해요.", "추가 소리가 나지 않자 구울들이 방향을 잃고 파티가 빠져나간다."),
    ecologyAdvice("graveyard-ghoul-dropped-coin-harm", "harm", "graveyard-ghoul-sound", "달리면 소리가 한꺼번에 나서 방향을 못 잡을 거예요.", "지금 들킨 김에 전력으로 뛰죠.", "연속된 발소리를 따라 구울들이 정확히 파티를 추격한다."),
    neutralAdvice("graveyard-ghoul-dropped-coin-neutral", "방패를 뒤로 돌리고 천천히 후퇴하세요.", "쫓아오면 막을 준비부터 하죠.", "파티가 방어 자세로 거리를 벌린다."),
  ], "파티가 움직임을 멈추고 구울들의 시선이 풀리기를 기다린다."),
  graveyardEvent("graveyard-light-mage-lantern", "등불을 따라온 마법사", "꺼진 묘실 안에 해골 마법사가 서 있다. 복도 끝에서 등불 하나가 켜지자 마법사는 파티를 보지 못한 채 천천히 그 빛 쪽으로 걸어간다.", [
    ecologyAdvice("graveyard-light-mage-lantern-help", "help", "graveyard-light", "등불을 옆 통로에 두고 마법사를 그쪽으로 빼내세요.", "우리가 아니라 빛을 따라가고 있어요. 다른 길로 보내죠.", "해골 마법사가 등불을 따라 벗어나고 파티가 빈 묘실을 지난다."),
    ecologyAdvice("graveyard-light-mage-lantern-harm", "harm", "graveyard-light", "횃불을 모두 들고 밝게 비추며 정면으로 지나가세요.", "밝으면 먼저 보고 대응할 수 있어요.", "강한 빛에 이끌린 해골 마법사가 파티 바로 앞으로 다가와 공격한다."),
    neutralAdvice("graveyard-light-mage-lantern-neutral", "기둥을 사이에 두고 천천히 이동하세요.", "시야만 끊어도 조금 낫겠어요.", "파티가 기둥을 이용해 공격을 피하며 지나간다."),
  ], "파티가 등불을 낮추고 묘실 가장자리로 돌아간다.", { revealsClue: "clue-graveyard-mage-light" as ClueId }),
  graveyardEvent("graveyard-light-mage-two-candles", "두 갈래의 촛불", "갈림길 양쪽에 오래된 촛대가 있다. 한쪽 촛불이 우연히 켜지자 멀리 있던 해골 마법사가 몸을 돌려 그 통로로 천천히 다가간다.", [
    ecologyAdvice("graveyard-light-mage-two-candles-help", "help", "graveyard-light", "가지 않을 통로의 촛불만 켜고 반대쪽으로 빠지세요.", "아까도 빛을 따라갔어요. 이번엔 아예 잘못된 길로 보내죠.", "마법사가 미끼 촛불을 따라가고 파티가 반대 통로로 빠져나간다."),
    ecologyAdvice("graveyard-light-mage-two-candles-harm", "harm", "graveyard-light", "우리 쪽 촛불을 더 밝게 켜 길을 확인하세요.", "어두운 길에서 헤매는 것보단 밝은 게 낫죠.", "해골 마법사가 밝아진 파티 쪽으로 방향을 바꿔 곧장 다가온다."),
    neutralAdvice("graveyard-light-mage-two-candles-neutral", "촛불을 모두 끄고 잠깐 기다리세요.", "어느 쪽으로 갈지 모르겠으면 일단 빛부터 없애죠.", "마법사가 멈추고 파티도 시간을 들여 어둠 속에서 길을 찾는다."),
  ], "파티가 촛불에서 떨어져 마법사의 움직임을 지켜본다.", { requiresClue: "clue-graveyard-mage-light" as ClueId }),
  graveyardEvent("graveyard-archer-light-retreat", "빛을 피한 궁수", "스켈레톤 궁수가 묘비 뒤에서 활을 겨누고 있다. 횃불 빛이 얼굴까지 닿자 궁수는 화살을 쏘지 않고 곧바로 더 깊은 그림자 뒤로 물러난다.", [
    ecologyAdvice("graveyard-archer-light-retreat-help", "help", "graveyard-archer-light", "횃불을 넓게 비춰 궁수가 숨을 그림자를 한쪽으로 몰아주세요.", "빛이 닿으니까 바로 숨었어요. 숨을 곳을 정해주면 길을 비울 수 있어요.", "궁수가 선택된 그림자로 물러나고 파티가 반대쪽 통로를 지난다."),
    ecologyAdvice("graveyard-archer-light-retreat-harm", "harm", "graveyard-archer-light", "횃불을 끄고 어둠 속으로 접근하세요.", "우리도 안 보이면 활을 맞히기 어렵겠죠.", "그림자 속에 자리 잡은 궁수가 어두운 통로에서 파티를 향해 화살을 퍼붓는다."),
    neutralAdvice("graveyard-archer-light-retreat-neutral", "큰 방패를 세우고 시야에서 벗어나세요.", "빛보다 방패가 확실하죠.", "파티가 화살을 막으며 천천히 사각으로 이동한다."),
  ], "파티가 묘비를 이용해 궁수의 사선을 피한다.", { revealsClue: "clue-graveyard-archer-shadow" as ClueId }),
  graveyardEvent("graveyard-guard-intact-goods", "금화가 남은 관", "열린 석관 안에 오래된 금화와 장신구가 그대로 남아 있다. 바로 옆 벽에는 갑옷을 입은 스켈레톤 병사가 장식물처럼 꼿꼿이 서 있다.", [
    ecologyAdvice("graveyard-guard-intact-goods-help", "help", "graveyard-guard", "부장품이 남은 관에서 떨어져 지나가세요.", "저렇게 값나가는 게 그대로인데 아무도 안 지킨다고 보긴 어려워요.", "파티가 석관을 피하자 스켈레톤 병사는 움직이지 않는다."),
    ecologyAdvice("graveyard-guard-intact-goods-harm", "harm", "graveyard-guard", "보물이 남은 관 옆이 오히려 안전하니 그쪽에 붙어가세요.", "위험했으면 누가 벌써 다 가져갔겠죠.", "파티가 석관에 가까워지자 벽에 서 있던 스켈레톤 병사가 검을 뽑는다."),
    neutralAdvice("graveyard-guard-intact-goods-neutral", "관을 건드리지 말고 중앙 통로로 지나가세요.", "보물은 나중 문제고 길부터 지나가죠.", "파티가 중앙으로 조심스럽게 이동한다."),
  ], "파티가 석관과 병사 양쪽에서 거리를 두고 지나간다."),
  graveyardEvent("graveyard-desecration-stolen-necklace", "비어버린 목걸이 자리", "무덤 바닥에 끊어진 목걸이 줄이 떨어져 있고 석관 안 목 부분만 먼지가 닦여 있다. 근처의 스켈레톤 병사는 다른 무덤의 병사보다 빠르고 거칠게 주변을 두드리며 돌아다닌다.", [
    ecologyAdvice("graveyard-desecration-stolen-necklace-help", "help", "graveyard-desecration", "남은 부장품은 손대지 말고 바로 물러나세요.", "뭔가 없어지고 나서 저렇게 사나워진 것 같아요. 더 건드리면 안 돼요.", "파티가 추가로 무덤을 건드리지 않아 수호자의 분노를 더 키우지 않는다."),
    ecologyAdvice("graveyard-desecration-stolen-necklace-harm", "harm", "graveyard-desecration", "남은 장신구도 챙기고 빠르게 도망가세요.", "이미 화난 것 같으니 가져갈 수 있는 건 가져가죠.", "추가 도굴에 반응한 수호자가 더 거칠게 달려들어 파티를 몰아붙인다."),
    neutralAdvice("graveyard-desecration-stolen-necklace-neutral", "빈 석관 뒤로 돌아서 지나가세요.", "아무것도 더 건드리지 말고 길만 찾죠.", "파티가 자원을 포기하고 무덤 뒤로 돌아간다."),
  ], "파티가 흩어진 장신구를 그대로 두고 경계하며 이동한다."),
  graveyardEvent("graveyard-archer-guard-crossfire", "빛과 금빛 갑옷", "통로 끝의 스켈레톤 궁수에게 횃불 빛이 닿자 궁수가 오른쪽 그림자로 물러난다. 왼쪽에는 금화가 가득한 석관과 그 옆에 갑옷 입은 스켈레톤 병사가 서 있다.", [
    ecologyAdvice("graveyard-archer-guard-crossfire-help", "help", "graveyard-archer-light", "횃불을 오른쪽으로 비춰 궁수를 더 깊은 그림자에 묶고 중앙으로 지나가세요.", "빛을 싫어해 오른쪽으로 숨고 있어요. 그쪽에 계속 몰아두죠.", "궁수가 그림자 쪽에 머무는 사이 파티가 중앙 사각으로 이동한다."),
    ecologyAdvice("graveyard-archer-guard-crossfire-harm", "harm", "graveyard-guard", "보물이 있는 왼쪽 석관 뒤에 몸을 숨기세요.", "관이 크니까 화살 막기 좋겠어요.", "파티가 부장품이 남은 무덤에 다가가자 스켈레톤 병사가 깨어나 길을 막는다."),
    neutralAdvice("graveyard-archer-guard-crossfire-neutral", "입구에서 방패를 세우고 둘의 움직임을 더 보세요.", "둘 다 있는 곳에 바로 들어갈 필요는 없어요.", "파티가 시간을 쓰지만 안전하게 다음 움직임을 확인한다."),
  ], "파티가 화살 사선과 석관을 모두 피해 멀리 우회한다."),
  graveyardEvent("graveyard-guard-desecration-return", "돌려놓은 반지", "바닥에 떨어진 반지 하나를 지나가던 쥐가 밀어 석관 가까이 가져간다. 벽에 서 있던 스켈레톤 병사가 움직이다가 반지가 석관 안쪽으로 굴러 들어가자 다시 제자리로 돌아간다.", [
    ecologyAdvice("graveyard-guard-desecration-return-help", "help", "graveyard-guard", "부장품이 있는 석관과 거리를 두고 바깥쪽으로 지나가세요.", "저 병사는 관 주변을 지키는 것 같아요. 영역 밖으로 갑시다.", "파티가 수호 범위를 피해 스켈레톤 병사를 깨우지 않고 지나간다."),
    ecologyAdvice("graveyard-guard-desecration-return-harm", "harm", "graveyard-desecration", "반지를 다시 꺼내 반대쪽으로 던져 병사를 유인하세요.", "저 물건을 따라 움직이면 미끼로 쓰면 되겠네요.", "부장품을 다시 빼앗자 수호자가 거칠게 반응하며 파티에게 달려든다."),
    neutralAdvice("graveyard-guard-desecration-return-neutral", "석관 맞은편 벽을 따라 천천히 가세요.", "아무것도 건드리지 말고 거리만 유지하죠.", "파티가 조심스럽게 수호 구역을 벗어난다."),
  ], "파티가 반지와 석관을 그대로 두고 멀리 돌아간다."),
  graveyardEvent("graveyard-desecration-archer-shadow", "그림자 속 빈 무덤", "한쪽 무덤은 뚜껑이 열리고 부장품이 바닥에 흩어져 있다. 맞은편 횃불이 흔들릴 때마다 멀리 있던 스켈레톤 궁수가 빛을 피해 그 열린 무덤의 깊은 그림자 쪽으로 자리를 옮긴다.", [
    ecologyAdvice("graveyard-desecration-archer-shadow-help", "help", "graveyard-desecration", "흩어진 부장품은 그대로 두고 무덤에서 떨어진 중앙 길로 지나가세요.", "이미 뒤집힌 무덤을 더 건드리면 수호자만 더 사나워질 수 있어요.", "파티가 도굴 흔적을 건드리지 않아 주변 수호자의 분노를 키우지 않고 이동한다."),
    ecologyAdvice("graveyard-desecration-archer-shadow-harm", "harm", "graveyard-archer-light", "횃불을 끄면 궁수가 그림자에서 나올 테니 어둡게 만들고 접근하세요.", "아까 빛을 피해 숨었으니 빛이 없으면 오히려 밖으로 나오겠죠.", "궁수는 어두운 자리에서 그대로 사격 위치를 잡고 파티를 향해 화살을 퍼붓는다."),
    neutralAdvice("graveyard-desecration-archer-shadow-neutral", "무덤 반대편 묘비 뒤에서 궁수의 사선을 피해 돌아가세요.", "보물도 빛도 건드리지 말고 멀리 갑시다.", "파티가 먼 길을 택하지만 추가 위험을 피한다."),
  ], "파티가 열린 무덤과 궁수를 모두 피해 묘역 외곽으로 우회한다.", { requiresClue: "clue-graveyard-archer-shadow" as ClueId }),
  graveyardEvent("graveyard-silence-fallen-bell", "무심한 좀비", "쓰러진 작은 종을 건드려 금속 소리가 났지만, 멀리 서 있던 썩은 좀비는 고개조차 돌리지 않고 같은 방향만 보고 있다.", [
    ecologyAdvice("graveyard-silence-fallen-bell-help", "help", "graveyard-silence", "소리에 반응하지 않으니 거리를 유지한 채 지나가라고 하세요.", "저 좀비는 소리보다 눈앞을 보고 있어요.", "좀비가 눈치채지 못한 사이 통과한다."),
    ecologyAdvice("graveyard-silence-fallen-bell-harm", "harm", "graveyard-silence", "소리가 났으니 더 큰 소리로 반대편에 유인하자고 하세요.", "소리를 키우면 움직일지도 몰라요.", "좀비는 움직이지 않고 파티만 오래 머무르게 된다."),
    neutralAdvice("graveyard-silence-fallen-bell-neutral", "좀비가 떠날 때까지 기다리자고 하세요.", "움직일 때까지 지켜보죠.", "위험은 없지만 시간이 흐른다."),
  ], "파티가 좀비를 경계하며 멀리 돌아서 지나간다."),
  graveyardEvent("graveyard-ghoul-sound-small-bell", "바닥의 작은 방울", "통로에는 작은 장식 방울들이 떨어져 있다. 파티가 하나를 발끝으로 살짝 건드리자 멀리 시체더미 속 구울이 즉시 고개를 든다.", [
    ecologyAdvice("graveyard-ghoul-sound-small-bell-help", "help", "graveyard-ghoul-sound", "방울을 피해 발소리까지 최대한 줄이라고 하세요.", "작은 소리에도 바로 고개를 들었어요.", "구울이 다시 시체더미 쪽으로 시선을 돌린다."),
    ecologyAdvice("graveyard-ghoul-sound-small-bell-harm", "harm", "graveyard-ghoul-sound", "이 정도 작은 소리는 괜찮으니 빠르게 뛰자고 하세요.", "한 번 들킨 김에 빨리 지나가면 돼요.", "연달아 방울이 울리고 구울들이 통로로 달려온다."),
    neutralAdvice("graveyard-ghoul-sound-small-bell-neutral", "방울을 하나씩 치우자고 하세요.", "시간을 써서 소리 나는 물건부터 없애죠.", "안전해지지만 시간이 많이 든다."),
  ], "파티가 방울을 치우며 조용히 통로를 만든다."),
  graveyardEvent("graveyard-light-candle-mage", "촛불을 보는 해골", "해골 마법사가 어두운 제단 옆에 서 있다. 파티가 촛불 하나를 켜자 마법사는 파티가 아니라 촛불 쪽으로 먼저 몸을 돌린다.", [
    ecologyAdvice("graveyard-light-candle-mage-help", "help", "graveyard-light", "촛불을 파티 반대편에 두어 시선을 끌라고 하세요.", "마법사는 우리보다 촛불을 먼저 봤어요.", "마법사가 빛을 따라 움직이는 사이 지나간다."),
    ecologyAdvice("graveyard-light-candle-mage-harm", "harm", "graveyard-light", "빛을 모두 끄고 바로 접근하자고 하세요.", "어두우면 우리를 못 찾을 거예요.", "유인 수단을 잃고 마법사와 정면으로 마주친다."),
    neutralAdvice("graveyard-light-candle-mage-neutral", "현재 거리에서 관찰만 하자고 하세요.", "움직임을 더 확인하고 가죠.", "위험은 늘지 않지만 진행하지 못한다."),
  ], "파티가 촛불과 마법사의 움직임을 지켜본다."),
  graveyardEvent("graveyard-archer-light-column", "그림자로 물러난 궁수", "스켈레톤 궁수가 무너진 기둥 뒤에 서 있다. 횃불 빛이 닿자 궁수는 밝은 자리에서 물러나 더 깊은 그림자 뒤로 몸을 숨긴다.", [
    ecologyAdvice("graveyard-archer-light-column-help", "help", "graveyard-archer-light", "빛을 궁수 쪽으로 유지해 사격 위치를 제한하라고 하세요.", "빛을 피해서 그림자로만 움직이고 있어요.", "궁수가 그림자 뒤에 묶여 파티가 다른 길로 빠진다."),
    ecologyAdvice("graveyard-archer-light-column-harm", "harm", "graveyard-archer-light", "궁수를 잘 보려고 횃불을 거두고 어둠에 눈을 익히자고 하세요.", "불을 끄면 우리도 궁수를 더 잘 볼 수 있을 거예요.", "궁수가 그림자에서 더 자유롭게 자리를 옮긴다."),
    neutralAdvice("graveyard-archer-light-column-neutral", "엄폐물을 늘리며 천천히 이동하자고 하세요.", "빛과 상관없이 숨을 곳을 늘리죠.", "위험은 줄지만 시간이 든다."),
  ], "파티가 무너진 기둥을 엄폐물로 삼아 천천히 이동한다."),
  graveyardEvent("graveyard-guard-intact-offerings", "손대지 않은 부장품", "오래된 무덤인데도 칼과 동전, 장식품이 먼지만 쌓인 채 그대로 놓여 있다. 벽 틈에는 갑옷 조각 같은 흰 뼈가 서 있다.", [
    ecologyAdvice("graveyard-guard-intact-offerings-help", "help", "graveyard-guard", "부장품을 건드리지 말고 수호자가 있을 수 있다고 보라고 하세요.", "값나가는 물건이 그대로인 건 지키는 존재가 있다는 뜻일 수 있어요.", "파티가 매복을 피하며 무덤 가장자리로 지나간다."),
    ecologyAdvice("graveyard-guard-intact-offerings-harm", "harm", "graveyard-guard", "아무도 가져가지 않았으니 운이 좋다며 물건부터 챙기자고 하세요.", "아무도 안 가져갔으니 지금이 기회예요.", "정지해 있던 스켈레톤 병사가 움직인다."),
    neutralAdvice("graveyard-guard-intact-offerings-neutral", "무덤 자체를 지나치자고 하세요.", "보상과 위험을 모두 피하죠.", "위험과 보상을 모두 피한다."),
  ], "파티가 부장품을 그대로 두고 무덤 가장자리로 지나간다."),
  graveyardEvent("graveyard-desecration-open-chest", "빈 제단의 분노", "관 옆 보물함은 이미 열려 있고 안의 장식품 일부가 사라졌다. 근처 스켈레톤 병사의 자세가 다른 무덤보다 훨씬 공격적으로 앞으로 기울어 있다.", [
    ecologyAdvice("graveyard-desecration-open-chest-help", "help", "graveyard-desecration", "남은 물건은 건드리지 말고 바로 물러나라고 하세요.", "이미 훼손된 무덤을 더 자극하면 안 돼요.", "이미 훼손된 무덤을 더 자극하지 않고 빠져나온다."),
    ecologyAdvice("graveyard-desecration-open-chest-harm", "harm", "graveyard-desecration", "이미 털린 곳이니 남은 것도 가져가자고 하세요.", "이미 화난 곳이라도 남은 건 챙기죠.", "수호자가 더 사납게 달려든다."),
    neutralAdvice("graveyard-desecration-open-chest-neutral", "멀리서 상태만 기록하고 지나가자고 하세요.", "더 가까이 가지 말고 본 것만 남기죠.", "추가 위험 없이 정보를 남긴다."),
  ], "파티가 빈 보물함을 멀리서 기록하고 지나간다."),
  graveyardEvent("graveyard-special-guard-desecration-tomb", "온전한 왕의 무덤", "오래된 왕의 무덤인데 부장품이 거의 손대지 않은 채 남아 있다. 입구 양쪽에는 갑옷을 입은 스켈레톤 병사가 움직이지 않고 서 있다.", [
    ecologyAdvice("graveyard-special-guard-desecration-tomb-help", "help", "graveyard-desecration", "부장품을 그대로 두고 중앙을 피해 지나가라고 하세요.", "온전한 무덤을 건드리면 수호자가 움직일 수 있어요.", "수호자들을 자극하지 않고 통과한다."),
    ecologyAdvice("graveyard-special-guard-desecration-tomb-harm", "harm", "graveyard-desecration", "병사들이 멈춰 있으니 작은 장식품 하나만 가져가자고 하세요.", "움직이지 않는 지금 하나쯤 가져가도 되겠어요.", "도굴이 시작되자 두 수호자가 동시에 움직인다."),
    neutralAdvice("graveyard-special-guard-desecration-tomb-neutral", "무덤 안으로 들어가지 말자고 하세요.", "보물보다 안전이 먼저예요.", "위험과 보상을 모두 포기한다."),
  ], "파티가 무덤 입구를 피해 외곽으로 돌아간다.", { kind: "special" }),
  graveyardEvent("graveyard-special-sound-light-hall", "종소리와 횃불", "어두운 예배당 한쪽에는 구울이 시체더미를 뒤지고 있고 반대편에는 해골 마법사가 서 있다. 바닥에는 종줄이 떨어져 있고 파티에게 횃불 하나가 있다.", [
    ecologyAdvice("graveyard-special-sound-light-hall-help", "help", "graveyard-ghoul-sound", "종은 건드리지 말고 횃불을 마법사 반대편에 두어 길을 만들라고 하세요.", "구울은 소리를 듣고 마법사는 빛을 따라가니 서로 반대로 유도하죠.", "구울을 소리로 자극하지 않으면서 마법사의 위치만 빛으로 이동시킨다."),
    ecologyAdvice("graveyard-special-sound-light-hall-harm", "harm", "graveyard-ghoul-sound", "종을 울려 둘을 한쪽으로 몰자고 하세요.", "한꺼번에 소리를 내면 둘 다 몰아낼 수 있을 거예요.", "구울이 즉시 소리에 반응하고 마법사의 행동은 통제되지 않는다."),
    neutralAdvice("graveyard-special-sound-light-hall-neutral", "입구에서 두 적이 움직일 때까지 기다리자고 하세요.", "둘의 움직임을 더 보고 결정하죠.", "안전하지만 불확실하게 시간이 흐른다."),
  ], "파티가 예배당 입구에서 적들의 움직임을 관찰한다.", { kind: "special" }),
  graveyardEvent("graveyard-special-mage-archer-light", "하나의 불빛, 두 해골", "해골 마법사와 스켈레톤 궁수가 같은 복도에 있다. 횃불을 들자 마법사는 빛 쪽으로 다가오고 궁수는 반대로 그림자 깊숙이 물러난다.", [
    ecologyAdvice("graveyard-special-mage-archer-light-help", "help", "graveyard-light", "횃불을 빈 측면 통로에 두고 두 적의 위치를 갈라놓으라고 하세요.", "마법사는 빛으로, 궁수는 그림자로 움직여요. 서로 갈라놓죠.", "마법사는 빛을 따라가고 궁수는 반대 그림자로 물러나 중앙 통로가 열린다."),
    ecologyAdvice("graveyard-special-mage-archer-light-harm", "harm", "graveyard-archer-light", "빛을 꺼 둘 다 움직이지 못하게 하자고 하세요.", "어둡게 만들면 둘 다 멈출 거예요.", "마법사의 유인은 사라지고 궁수는 어둠 속에서 자유롭게 위치를 잡는다."),
    neutralAdvice("graveyard-special-mage-archer-light-neutral", "횃불을 그대로 유지하며 엄폐 뒤에서 기다리자고 하세요.", "위치를 바꾸지 말고 틈을 보죠.", "위치는 유지되지만 진전이 없다."),
  ], "파티가 엄폐 뒤에서 두 해골의 움직임을 지켜본다.", { kind: "special" }),
  graveyardEvent("graveyard-special-zombie-ghoul-sound-trap", "조용한 시체실", "시체실 앞쪽에는 썩은 좀비가 멍하니 서 있고, 뒤쪽 시체더미 사이에서는 구울의 손톱이 돌을 긁는 작은 소리가 난다. 좀비는 파티의 발소리에도 반응하지 않는다.", [
    ecologyAdvice("graveyard-special-zombie-ghoul-sound-trap-help", "help", "graveyard-ghoul-sound", "좀비 반응만 보고 안심하지 말고 최대한 조용히 지나가라고 하세요.", "좀비는 무시해도 구울은 작은 소리까지 듣고 있어요.", "좀비와 구울의 서로 다른 청각 반응을 모두 고려해 통과한다."),
    ecologyAdvice("graveyard-special-zombie-ghoul-sound-trap-harm", "harm", "graveyard-ghoul-sound", "좀비가 소리를 못 듣는 걸 확인했으니 빠르게 뛰자고 하세요.", "좀비가 반응하지 않으니 뛰어도 괜찮겠어요.", "좀비는 그대로지만 뒤쪽 구울들이 작은 소리에도 반응해 달려온다."),
    neutralAdvice("graveyard-special-zombie-ghoul-sound-trap-neutral", "시체실을 우회하자고 하세요.", "둘 다 피하는 길을 택하죠.", "위험은 피하지만 길이 길어진다."),
  ], "파티가 시체실을 피해 묘역 외곽으로 우회한다.", { kind: "special" }),
];

const GRAVEYARD_BOSS_EVENTS: readonly NonMerchantSituationEvent[] = [
  bossEvent("graveyard-boss-barkan-command-blade", "boss-graveyard-1", "검끝을 따라 움직이는 대열", "스켈레톤 장군이 검을 왼쪽으로 겨눈다. 잠시 뒤 왼쪽 대열의 해골들이 동시에 앞으로 나가고 오른쪽 대열은 그대로 서 있다.", [
    bossAdvice("graveyard-boss-barkan-command-blade-help", "help", "boss-barkan-command-blade", "장군의 검끝을 보고 다음 대열 움직임을 예측하라고 하세요.", "부하들이 검이 가리킨 쪽부터 움직여요. 장군 손을 보면 돼요.", "파티가 바르칸의 지휘 신호를 읽는 법을 기억한다."),
    bossAdvice("graveyard-boss-barkan-command-blade-harm", "harm", "boss-barkan-command-blade", "부하들은 각자 움직이니 장군은 무시하라고 하세요.", "해골마다 따로 움직이는 것 같아요. 장군을 볼 필요 없어요.", "파티가 바르칸의 지휘 신호를 무시하게 된다."),
    bossAdvice("graveyard-boss-barkan-command-blade-neutral", "neutral", undefined, "대열과 거리를 두고 한 줄씩 상대하라고 하세요.", "신호를 몰라도 한꺼번에 상대하지는 말죠.", "파티가 보수적인 대열 대응을 준비한다."),
  ], "파티는 검과 대열의 움직임을 연결할지 확신하지 못한다."),
  bossEvent("graveyard-boss-barkan-reform-line", "boss-graveyard-1", "끊긴 대열", "해골 하나가 쓰러지며 대열 중간이 비어진다. 바르칸은 앞의 적을 쫓다가 멈추고 뒤로 물러나 남은 해골들을 다시 줄 세운다.", [
    bossAdvice("graveyard-boss-barkan-reform-line-help", "help", "boss-barkan-reform-line", "부하 대열을 끊어 재정렬하는 순간을 만들라고 하세요.", "줄이 무너지면 공격보다 정렬부터 해요. 그 시간을 만들죠.", "파티가 바르칸의 지휘 우선순위를 이용할 준비를 한다."),
    bossAdvice("graveyard-boss-barkan-reform-line-harm", "harm", "boss-barkan-reform-line", "부하는 무시하고 장군만 계속 추격하라고 하세요.", "대열은 장식이에요. 장군을 놓치지 않는 게 중요해요.", "파티가 바르칸에게 재정비 시간을 쉽게 내주게 된다."),
    bossAdvice("graveyard-boss-barkan-reform-line-neutral", "neutral", undefined, "대열 바깥쪽부터 천천히 줄이라고 하세요.", "일단 수부터 줄이면 싸움이 편해질 거예요.", "파티가 일반적인 수적 우위 확보를 준비한다."),
  ], "파티는 바르칸이 대열을 중시한다는 정도만 기억한다."),
  bossEvent("graveyard-boss-morbian-staff-link", "boss-graveyard-2", "함께 깜빡이는 푸른 불", "리치의 지팡이 끝에 푸른 불빛이 켜져 있다. 움직이는 시체들의 눈도 같은 박자로 빛나다가 지팡이 불이 흔들리자 시체들이 동시에 비틀거린다.", [
    bossAdvice("graveyard-boss-morbian-staff-link-help", "help", "boss-morbian-staff-link", "시체보다 지팡이의 푸른 불을 먼저 방해하라고 하세요.", "저 시체들 움직임이 지팡이 불과 같이 움직여요. 연결된 쪽부터 끊죠.", "파티가 모르비안의 시체 조종 연결점을 기억한다."),
    bossAdvice("graveyard-boss-morbian-staff-link-harm", "harm", "boss-morbian-staff-link", "지팡이는 장식이니 시체만 계속 쓰러뜨리라고 하세요.", "마법사는 멀리 있고 당장 앞의 시체부터 없애야 해요.", "파티가 조종 원인을 무시하고 시체와 소모전을 벌이게 된다."),
    bossAdvice("graveyard-boss-morbian-staff-link-neutral", "neutral", undefined, "시체와 리치 사이에 장애물을 두라고 하세요.", "연결은 몰라도 한꺼번에 공격받지 않게 갈라놓죠.", "파티가 기본적인 전장 분리를 준비한다."),
  ], "파티는 푸른 불빛의 동조를 기억하지만 확신하지 못한다."),
  bossEvent("graveyard-boss-morbian-death-tell", "boss-graveyard-2", "한꺼번에 꺼진 촛불", "모르비안이 두 손을 모으자 방 안의 촛불과 떠다니던 혼불이 동시에 꺼진다. 잠시 뒤 검은 파동이 방 전체를 훑고 지나간다.", [
    bossAdvice("graveyard-boss-morbian-death-tell-help", "help", "boss-morbian-death-tell", "주변 불이 한꺼번에 꺼지면 큰 마법을 대비하라고 하세요.", "불이 꺼진 다음에 바로 큰 게 왔어요. 저게 신호예요.", "파티가 모르비안의 큰 주문 전조를 기억한다."),
    bossAdvice("graveyard-boss-morbian-death-tell-harm", "harm", "boss-morbian-death-tell", "불이 꺼지면 마법이 끝났다는 뜻이니 공격하라고 하세요.", "빛이 사라졌으니 주문이 끊긴 것 같아요. 그때 들어가죠.", "파티가 큰 주문 직전 앞으로 나서는 잘못된 대응을 준비한다."),
    bossAdvice("graveyard-boss-morbian-death-tell-neutral", "neutral", undefined, "리치가 주문을 모으면 서로 거리를 벌리라고 하세요.", "정확한 신호는 몰라도 큰 마법에는 흩어지는 게 낫죠.", "파티가 일반적인 광역 마법 대응을 준비한다."),
  ], "파티는 불이 꺼지는 현상을 수상하게 기억한다."),
  bossEvent("graveyard-boss-azrael-marked-prey", "boss-graveyard-3", "낫끝이 가리킨 사람", "사신이 낫끝으로 한 사람을 가리킨다. 그 사람 발밑에 검은 그림자가 붙고, 다른 사람이 더 가까이 다가가도 사신은 처음 가리킨 사람만 따라간다.", [
    bossAdvice("graveyard-boss-azrael-marked-prey-help", "help", "boss-azrael-marked-prey", "표식이 붙은 사람이 사신을 끌고 나머지가 움직이게 하라고 하세요.", "저 그림자 붙은 사람만 계속 쫓아요. 역할을 나누면 돼요.", "파티가 아즈라엘의 표적 고정을 이용할 준비를 한다."),
    bossAdvice("graveyard-boss-azrael-marked-prey-harm", "harm", "boss-azrael-marked-prey", "표식은 장식이니 가장 가까운 사람이 방패로 막으라고 하세요.", "가까운 사람부터 치겠죠. 그림자는 신경 쓰지 마요.", "파티가 아즈라엘의 고정 표적을 잘못 읽어 진형이 무너지게 된다."),
    bossAdvice("graveyard-boss-azrael-marked-prey-neutral", "neutral", undefined, "누가 노려지든 서로 너무 멀어지지 말라고 하세요.", "표적 원리는 몰라도 지원 거리는 유지하죠.", "파티가 기본적인 지원 간격을 준비한다."),
  ], "파티는 검은 표식을 경계하지만 활용법은 정하지 않는다."),
  bossEvent("graveyard-boss-azrael-scythe-mist", "boss-graveyard-3", "낫으로 모이는 안개", "사신 주변에 퍼져 있던 검은 안개가 갑자기 낫날 쪽으로 빨려 들어간다. 다음 순간 낫이 넓게 휘둘러지며 앞쪽을 한 번에 베어낸다.", [
    bossAdvice("graveyard-boss-azrael-scythe-mist-help", "help", "boss-azrael-scythe-mist", "안개가 낫으로 모이면 바로 옆이나 뒤로 빠지라고 하세요.", "안개가 모인 다음 넓게 베어요. 그때가 피할 신호예요.", "파티가 아즈라엘의 큰 횡베기 전조를 기억한다."),
    bossAdvice("graveyard-boss-azrael-scythe-mist-harm", "harm", "boss-azrael-scythe-mist", "안개가 걷히면 시야가 좋아지니 정면으로 들어가라고 하세요.", "앞이 보일 때 공격 기회예요. 바로 붙죠.", "파티가 큰 횡베기 직전에 정면으로 들어가는 대응을 준비한다."),
    bossAdvice("graveyard-boss-azrael-scythe-mist-neutral", "neutral", undefined, "낫 사거리 밖을 유지하라고 하세요.", "신호를 몰라도 낫 가까이는 위험해요.", "파티가 기본적인 거리 유지를 준비한다."),
  ], "파티는 안개의 움직임을 기억하지만 정확한 대응은 정하지 않는다."),
  bossEvent("graveyard-boss-valdrak-oath-boundary", "boss-graveyard-4", "넘지 못한 돌문", "검은 갑옷의 기사가 침입자를 쫓아 돌문까지 달려온다. 한 발을 문 밖으로 내딛으려다 멈추고 검을 떨군 채 결국 안쪽으로 한 걸음 물러난다.", [
    bossAdvice("graveyard-boss-valdrak-oath-boundary-help", "help", "boss-valdrak-oath-boundary", "돌문 바깥을 이용해 추격 거리를 끊으라고 하세요.", "저 문을 오래 못 넘어요. 경계를 이용하면 숨 돌릴 수 있어요.", "파티가 발드라크의 맹세 경계를 이용할 준비를 한다."),
    bossAdvice("graveyard-boss-valdrak-oath-boundary-harm", "harm", "boss-valdrak-oath-boundary", "문 밖에서도 계속 따라올 테니 경계는 신경 쓰지 말라고 하세요.", "잠깐 멈춘 것뿐이에요. 어디든 계속 쫓아올 거예요.", "파티가 발드라크의 행동 제약을 무시한다."),
    bossAdvice("graveyard-boss-valdrak-oath-boundary-neutral", "neutral", undefined, "좁은 문에서 한 번에 한 명씩 상대하라고 하세요.", "경계 원리는 몰라도 좁은 곳은 이용할 수 있어요.", "파티가 지형을 이용한 일반적인 방어를 준비한다."),
  ], "파티는 발드라크가 문 앞에서 멈췄다는 사실만 기억한다."),
  bossEvent("graveyard-boss-valdrak-tomb-priority", "boss-graveyard-4", "석관을 향한 기사", "발드라크가 앞의 상대와 검을 맞대고 있다. 다른 사람이 안쪽 석관에 다가가자 기사는 싸우던 상대를 그대로 두고 몸을 돌려 석관 앞을 막는다.", [
    bossAdvice("graveyard-boss-valdrak-tomb-priority-help", "help", "boss-valdrak-tomb-priority", "한 사람이 석관 쪽으로 움직여 기사의 시선을 돌리게 하라고 하세요.", "저 기사는 누구와 싸우는지보다 석관을 지키는 게 먼저예요.", "파티가 발드라크의 수호 우선순위를 이용할 준비를 한다."),
    bossAdvice("graveyard-boss-valdrak-tomb-priority-harm", "harm", "boss-valdrak-tomb-priority", "석관은 신경 쓰지 않으니 모두 기사에게만 붙으라고 하세요.", "전투 중엔 눈앞 상대만 보겠죠. 뒤쪽은 상관없어요.", "파티가 발드라크의 우선순위를 오해해 공격 흐름을 읽지 못한다."),
    bossAdvice("graveyard-boss-valdrak-tomb-priority-neutral", "neutral", undefined, "석관에서 떨어져 넓게 싸우라고 하세요.", "괜히 안쪽까지 들어가지 말고 공간부터 확보하죠.", "파티가 보수적인 전투 공간을 준비한다."),
  ], "파티는 발드라크가 석관을 중시한다는 정도만 기억한다."),
];

export const GRAVEYARD_EVENTS: readonly NonMerchantSituationEvent[] = [
  ...GRAVEYARD_MONSTER_EVENTS,
  ...GRAVEYARD_BOSS_EVENTS,
];
