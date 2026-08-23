# E4 보스전 어댑터·보스 정보 전투 특성 설계

## 문서 지위

이 문서는 E4 `턴 단위 보스전`의 구현 계약이다.

2026-08-22 Brainstorming에서 승인한 다음 결정을 정식화한다.

- 일반전과 보스전은 E3의 **하나의 공통 `BattleEngine`**을 사용한다.
- 보스는 기존 `BossRule` 두 개를 각각 하나의 정적 전투 특성으로 가진다.
- 보스 특성은 공용 카탈로그에서 고르며, 실제 전투 계산 축은 `targetWeight`, `incomingDamage`, `outgoingDamage` 세 종류로 제한한다.
- bossInfo 효과는 조언을 수용한 캐릭터 개인에게만 적용한다.
- 도움·방해 정보는 서로 반대 방향의 수치 보정을 만들고, neutral은 전투 보정을 만들지 않는다.
- 여러 bossInfo는 독립적으로 누적한다.
- E4가 확정한 bossInfo 효과는 U5-2에서 별도 계산 없이 시각적으로 재생한다.
- 보스전 중 사망한 캐릭터에게는 지연형 신뢰 변화를 적용하지 않는다.
- 누적 고발 인원은 **살아 있으면서 `trust === 0`인 캐릭터만** 센다.

이 문서는 구현 Plan이 아니다. 파일·작업 순서·커밋 단위는 후속 `writing-plans` 단계에서 정한다.

---

## 1. 기준 문서와 우선순위

E4는 현재 공식 설정집과 E3의 최신 설계를 함께 소비한다.

E3 계약끼리 충돌할 때 우선순위는 다음과 같다.

1. `2026-08-22-lattebun-e3-event-materialization-correction-2-design.md`
2. `2026-08-22-lattebun-e3-event-materialization-correction-design.md`
3. `2026-08-22-lattebun-e3-event-materialization-design.md`
4. 현재 공식 `docs/design`, `docs/systems` 문서
5. `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

따라서 작업 배정표나 기존 E2 설명에 남아 있는 **BossInfo Depth 예약** 표현보다 최신 E3의 **hidden `special` exact-once vertex cut** 계약이 우선한다.

E4는 bossInfo 기회가 어느 노드에 놓이는지, 어떤 `SituationEvent`가 물질화되는지, strong-link가 어떻게 활성화되는지를 다시 결정하지 않는다. 그 결과만 소비한다.

---

## 2. 목적과 책임

E4는 보스만을 위한 두 번째 전투 시스템이 아니라 **보스 입력 어댑터 + 사후 검증 계층**이다.

책임은 다음과 같다.

1. 현재 던전의 `BossDef`를 공통 `BattleEngine` 입력으로 변환한다.
2. `BossRule`을 공용 정적 `BossTrait`에 연결한다.
3. 현재 원정의 bossInfo 기록을 캐릭터별 전투 modifier로 변환한다.
4. 남아 있는 merchant `nextBattle` 효과를 보스전에 합성하고 소비한다.
5. 현재 위험도의 보스 HP·공격 scaling을 적용한다.
6. 공통 `BattleEngine`을 한 번 실행해 결정적인 `BattleResolution`과 action record를 얻는다.
7. bossInfo가 적용된 사실을 U5-2가 재생할 수 있는 presentation cue로 남긴다.
8. 보스전 뒤 bossInfo의 지연 검증 결과를 만든다.
9. 보스 승리/전멸과 생존자 목록을 후속 C4 정산이 소비할 원정 결과로 연결한다.

전체 흐름은 다음과 같다.

```text
BossDef
+ current risk
+ expedition InfoRecord[]
+ pending merchant nextBattle
        |
        v
Boss Battle Adapter
        |
        v
common BattleEngine
        |
        +--> deterministic action records
        +--> BossInfoPresentationCue[]
        |
        v
BattleResolution
        |
        v
bossInfo post-verification
        |
        v
BossResult / ExpeditionResult
        |
        v
C4 settlement
```

기존 `resolveBossFight` 같은 API를 유지할 필요가 있다면 내부에서 공통 `BattleEngine`을 호출하는 wrapper/adapter로만 남긴다. 별도 공격 루프를 소유해서는 안 된다.

---

## 3. 비목표

E4 범위에는 다음을 넣지 않는다.

- 별도의 보스 전용 `BattleEngine`
- 보스 페이즈
- HP 구간별 패턴 전환
- 남은 HP가 낮은 용사를 실시간으로 추적하는 AI
- 공격한 용사에게 어그로를 쌓는 시스템
- N턴마다 발동하는 특수기
- 상태이상·버프·디버프 지속시간 시스템
- 직업별 액티브 스킬과 고급 전투 AI
- 특정 BossId에서만 실행하는 임의 전용 combat callback
- bossInfo가 보스 행동을 완전히 봉쇄하거나 턴을 삭제하는 효과
- B1 이전의 임시 배율·상한 이외의 밸런스 조정
- 다프레임 보스 애니메이션, 대형 전용 VFX, 컷신, 복잡한 카메라

E4는 아래의 임시 배율·상한과 위험도 scaling 공식을 구현한다. 이는 플레이 가능한 기준값일 뿐 최종 밸런스가 아니며, B1은 백테스트 결과에 따라 이 값을 중앙 카탈로그에서 조정한다. 사건 콘텐츠에는 배율을 다시 넣지 않는다.

---

## 4. 보스 정적 특성 모델

### 4.1 보스당 기존 `BossRule` 두 개를 그대로 사용한다

모든 shipped 보스는 이미 보스 정보 사건이 참조하는 `BossRule` 두 개를 가진다.

E4는 별도의 설정 문장을 새로 만들지 않고 다음 1:1 계약을 추가한다.

```text
BossRule #1 <-> BossTrait #1
BossRule #2 <-> BossTrait #2
```

각 `BossRuleId`는 정확히 하나의 `BossTraitId`에 연결되어야 한다.

한 보스가 가진 두 trait는 **가능하면 서로 다른 전투 축**을 사용한다. 다만 이는 콘텐츠 품질 원칙이지 validator의 하드 제약은 아니다. 설정과 어울리지 않는 축을 억지로 배정하는 것보다 기존 `BossRule` 의미를 보존하는 것이 우선이다.

### 4.2 허용되는 전투 계산 축은 세 개뿐이다

캐릭터별 보스전 modifier는 개념적으로 다음 세 값만 가진다.

```ts
interface CharacterBossModifiers {
  readonly targetWeightMultiplier: number;
  readonly incomingDamageMultiplier: number;
  readonly outgoingDamageMultiplier: number;
}
```

기본값은 모두 `1.0`이다.

- `targetWeightMultiplier`: 보스가 해당 캐릭터를 대상으로 선택할 **정적 가중치**
- `incomingDamageMultiplier`: 해당 캐릭터가 보스 공격으로 받는 피해 배율
- `outgoingDamageMultiplier`: 해당 캐릭터가 보스에게 주는 피해 배율

이 세 축 밖의 효과가 필요하면 E4 구현에서 즉흥적으로 추가하지 않고 별도 설계 변경으로 다룬다.

### 4.3 E4 임시 modifier 값과 B1 이관

E4는 모든 `BossTrait` 축에 다음 공통 임시값을 적용한다. `help`와 `harm`이 같은 축에서 정확히 반대 방향이 되도록 한 값이며, trait별 수치를 콘텐츠에 복사하지 않는다.

| outcome | `targetWeight` / `incomingDamage` | `outgoingDamage` |
| --- | ---: | ---: |
| `accepted + help` | `× 0.80` | `× 1.25` |
| `accepted + harm` | `× 1.25` | `× 0.80` |

동일 캐릭터의 같은 축 효과와 해당 축에 적용 가능한 merchant 효과를 정해진 순서로 곱한 뒤, 최종 multiplier는 `0.70..1.50`으로 clamp한다. `neutral`·`suspected`·`exposed`는 이 계산에 참여하지 않는다.

이 수치와 상한은 E4의 임시 상수로 공용 trait/modifier 카탈로그 한 곳에만 둔다. B1은 해당 카탈로그와 백테스트 기대치를 함께 갱신하며, `BossRule`·사건 콘텐츠·UI에 별도 수치를 추가하지 않는다.

---

## 5. 공용 BossTrait 카탈로그

콘텐츠 표현은 다양하게 유지하되 실제 계산 종류는 제한한다.

| Trait | 의미 | 전투 축 |
| --- | --- | --- |
| `TARGET_COMMITMENT` | 특정 상대·방향·목표를 집요하게 노리는 습성 | `targetWeight` |
| `PURSUIT_LIMIT` | 방향 전환·추격에 구조적인 한계가 있음 | `targetWeight` |
| `ATTACK_TELEGRAPH` | 강한 공격 전에 읽을 수 있는 전조가 있음 | `incomingDamage` |
| `AMBUSH_TELEGRAPH` | 매복 위치·출현 방향을 미리 읽을 수 있음 | `incomingDamage` |
| `RECOVERY_WINDOW` | 행동 직후 공격 가능한 빈틈이 생김 | `outgoingDamage` |
| `STRUCTURAL_WEAKNESS` | 신체·갑옷·구조에 공략 가능한 약점이 있음 | `outgoingDamage` |
| `CONTROL_DEPENDENCY` | 부하·거미줄·지팡이 등 통제 수단에 의존함 | `outgoingDamage` |
| `DISTRACTION_WINDOW` | 전투 중 다른 목표를 우선해 빈틈이 생김 | `outgoingDamage` |

공용 trait 이름은 내부 데이터다. 플레이어에게 `ATTACK_TELEGRAPH`, `HELP`, `HARM`, `정답`, `오답` 같은 시스템 라벨을 직접 표시하지 않는다.

같은 trait를 사용하는 보스라도 `BossRule.text`와 presentation 문구는 보스 설정에 맞게 다르게 작성한다.

---

## 6. shipped 보스 12종 · 24개 BossRule 매핑

### 6.1 거미굴

| 보스 | `BossRuleId` | 기존 의미 | Trait |
| --- | --- | --- | --- |
| 거대거미 라그나 | `boss-ragna-turning` | 큰 몸 때문에 급하게 방향을 바꾸기 어렵다 | `PURSUIT_LIMIT` |
| 거대거미 라그나 | `boss-ragna-crouch` | 큰 공격 직전에 몸을 낮춘다 | `ATTACK_TELEGRAPH` |
| 고치관리자 모르칸 | `boss-morkan-cocoon-side` | 고치 한쪽 면이 더 얇다 | `STRUCTURAL_WEAKNESS` |
| 고치관리자 모르칸 | `boss-morkan-spin-pause` | 새 거미줄을 만들 때 잠깐 움직임이 둔해진다 | `RECOVERY_WINDOW` |
| 아라크네 세리나 | `boss-serina-web-hub` | 여러 거미줄을 한꺼번에 당긴다 | `CONTROL_DEPENDENCY` |
| 아라크네 세리나 | `boss-serina-block-retreat` | 공격 전에 상대의 퇴로부터 막는다 | `ATTACK_TELEGRAPH` |
| 거미여왕 아라크샤 | `boss-araksha-swarm-follow` | 주변 새끼거미가 여왕의 움직임을 따라 움직인다 | `ATTACK_TELEGRAPH` |
| 거미여왕 아라크샤 | `boss-araksha-summon-first` | 직접 달려들기 전에 주변 거미를 먼저 불러들인다 | `DISTRACTION_WINDOW` |

### 6.2 사막

| 보스 | `BossRuleId` | 기존 의미 | Trait |
| --- | --- | --- | --- |
| 거대 전갈 자카르 | `boss-zakar-burrow-trace` | 모래 위 꼬리 자국으로 매복 위치가 드러난다 | `AMBUSH_TELEGRAPH` |
| 거대 전갈 자카르 | `boss-zakar-emerge-gap` | 모래에서 튀어나온 직후 잠깐 멈춘다 | `RECOVERY_WINDOW` |
| 샌드웜 카르둠 | `boss-kardum-sand-ridge` | 몸보다 앞쪽의 모래가 먼저 솟아오른다 | `AMBUSH_TELEGRAPH` |
| 샌드웜 카르둠 | `boss-kardum-landing-pause` | 크게 뛰쳐나온 뒤 다시 파고들기까지 시간이 걸린다 | `RECOVERY_WINDOW` |
| 모래거신 오벨론 | `boss-obelon-leg-collapse` | 다리 돌 배열이 흐트러지면 균형을 잃는다 | `STRUCTURAL_WEAKNESS` |
| 모래거신 오벨론 | `boss-obelon-rebuild-stones` | 떨어진 돌들이 다시 오벨론 쪽으로 끌려간다 | `ATTACK_TELEGRAPH` |
| 스핑크스 네프리스 | `boss-nephris-question-still` | 질문 후 답을 들을 때까지 먼저 움직이지 않는다 | `DISTRACTION_WINDOW` |
| 스핑크스 네프리스 | `boss-nephris-wrong-answer-tell` | 공격 직전 목 장식과 눈이 먼저 빛난다 | `ATTACK_TELEGRAPH` |

### 6.3 묘지

| 보스 | `BossRuleId` | 기존 의미 | Trait |
| --- | --- | --- | --- |
| 스켈레톤 장군 바르칸 | `boss-barkan-command-blade` | 검으로 가리킨 방향으로 부하가 먼저 움직인다 | `TARGET_COMMITMENT` |
| 스켈레톤 장군 바르칸 | `boss-barkan-reform-line` | 진형이 무너지면 공격보다 대열을 다시 세운다 | `DISTRACTION_WINDOW` |
| 리치 모르비안 | `boss-morbian-staff-link` | 시체 조종 중 지팡이 불빛과 시체의 눈이 연결되어 깜빡인다 | `CONTROL_DEPENDENCY` |
| 리치 모르비안 | `boss-morbian-death-tell` | 큰 죽음 마법 직전 주변 촛불과 혼불이 꺼진다 | `ATTACK_TELEGRAPH` |
| 사신 아즈라엘 | `boss-azrael-marked-prey` | 한 사람을 지정한 뒤 그 사람을 집요하게 쫓는다 | `TARGET_COMMITMENT` |
| 사신 아즈라엘 | `boss-azrael-scythe-mist` | 큰 횡베기 직전 검은 안개가 낫날로 빨려 들어간다 | `ATTACK_TELEGRAPH` |
| 데스나이트 발드라크 | `boss-valdrak-oath-boundary` | 돌문 경계를 넘어 오래 추격하지 못한다 | `PURSUIT_LIMIT` |
| 데스나이트 발드라크 | `boss-valdrak-tomb-priority` | 석관 접근자가 있으면 현재 상대보다 석관 수호를 우선한다 | `DISTRACTION_WINDOW` |

validator는 shipped 보스 12종의 모든 `BossRuleId`가 정확히 하나의 trait mapping을 가지는지 검증한다.

---

## 7. BossInfo -> 개인 modifier 계약

bossInfo는 파티 전체 버프가 아니다. **그 조언을 수용한 살아 있는 캐릭터 개인에게만** 전투 modifier를 준다.

### 7.1 `accepted + help`

trait 축에 유리한 방향의 modifier를 적용한다.

```text
targetWeight      -> 1.0보다 작게
incomingDamage    -> 1.0보다 작게
outgoingDamage    -> 1.0보다 크게
```

### 7.2 `accepted + harm`

같은 축에 불리한 방향의 modifier를 적용한다.

```text
targetWeight      -> 1.0보다 크게
incomingDamage    -> 1.0보다 크게
outgoingDamage    -> 1.0보다 작게
```

### 7.3 `suspected`

전투 modifier를 적용하지 않는다.

다만 해당 정보가 참/거짓이었는지는 보스전 뒤 사후 검증 대상이 될 수 있다.

### 7.4 `exposed`

전투 modifier를 적용하지 않는다.

E2에서 즉시 `adviceHarmed + deceptionExposed` 처리가 끝난 기록이므로 E4에서 지연 신뢰를 중복 처리하지 않는다.

### 7.5 `neutral`

전투 modifier도, 결과 기반 bossInfo 사후 신뢰 검증도 만들지 않는다.

E4는 4.3절의 임시 배율과 clamp를 자동 테스트로 고정한다. B1이 수치를 조정할 때에는 해당 기대값을 함께 갱신한다.

---

## 8. 복수 BossInfo와 modifier 합성

현재 위험도에 따라 보스 정보 기회를 여러 번 경험할 수 있다. 서로 다른 bossInfo는 독립적으로 유지한다.

한 캐릭터가 두 유효 정보를 모두 수용했다면 두 효과가 모두 적용된다.

개념적인 합성은 다음과 같다.

```text
finalAxisMultiplier
= base(1.0)
× acceptedBossInfoModifierA
× acceptedBossInfoModifierB
× applicableMerchantModifier
```

가능하면 한 보스의 두 trait를 서로 다른 축에 배정해 체감 차이를 만든다. 그러나 동일 축이 겹쳐도 계산은 결정적으로 누적할 수 있어야 한다.

E4의 임시 상·하한은 4.3절의 `0.70..1.50`이다. B1은 이를 중앙 카탈로그에서 조정할 수 있다.

---

## 9. `InfoRecord` 계약 보완

현재 `InfoRecord`의 단일 `modifier: number`만으로는 어떤 보스 규칙과 어떤 계산 축에 대한 정보인지 표현할 수 없다.

E4가 필요로 하는 핵심 식별자는 `BossRuleId`다.

개념적으로 지연 기록은 다음 정보를 보존해야 한다.

```ts
interface InfoRecord {
  readonly eventId: EventId;
  readonly adviceId: ChoiceId;
  readonly outcome: AdviceOutcome;
  readonly characterId: CharacterId;
  readonly reaction: InfoReaction;
  readonly bossRuleId: BossRuleId;
  readonly pendingVerification: boolean;
}
```

구체 필드 배치는 구현 Plan에서 현재 콘텐츠 타입과 맞춰 정리할 수 있지만 다음 의미 계약은 바꾸지 않는다.

```text
BossRuleId
-> BossTrait
-> axis
-> advice outcome(help/harm)
-> E4 modifier
```

최종 수치 modifier를 사건 콘텐츠에 박아 넣지 않는다. 그래야 B1에서 trait 효과를 조정할 때 수십 개의 bossInfo 사건 데이터를 함께 수정하지 않아도 된다.

### 9.1 `suspected` 기록 보존

사후 계약에는 다음 두 검증이 존재한다.

- `suspected + help -> suspicionWasCostly`
- `suspected + harm -> suspicionWasCorrect`

따라서 현재 코드 주석처럼 `InfoRecord`를 단순히 **수용한 지연형 조언만 보관하는 타입**으로 해석해서는 안 된다.

E4에 전달되는 지연 기록은 보스전 뒤 검증이 필요한 `accepted`와 `suspected`의 사실을 모두 재현할 수 있어야 한다. 구체적으로 하나의 `InfoRecord` 타입을 확장할지, 별도 delayed-verification record로 분리할지는 구현 Plan에서 기존 E2 코드를 대조해 결정하되 이 정보 손실은 허용하지 않는다.

---

## 10. E3 `BattleEngine` 의존성

E4는 보스 타겟 선택용 RNG 루프를 별도로 만들지 않는다.

공통 `BattleEngine`은 전투 시작 전에 확정된 **캐릭터별 static target weight** 또는 이에 동등한 입력을 소비할 수 있어야 한다.

예:

```text
hero-A targetWeight 0.8
hero-B targetWeight 1.0
hero-C targetWeight 1.3
```

이 값은 전투 시작 뒤에는 바뀌지 않는다.

금지되는 예:

```text
HP가 30% 아래로 내려감 -> targetWeight 변경
3턴 경과 -> targetWeight 변경
누군가 공격함 -> 어그로 상승
보스 HP 절반 이하 -> 타겟 성향 전환
```

최종 E3 `BattleEngine` 인터페이스에 static per-member target weight가 없다면 이는 **E3 dependency**다.

E4 구현자는 해당 기능을 보스 어댑터 내부의 별도 타겟 시스템으로 우회하지 않는다. E3 공통 엔진의 입력 계약을 보완한 뒤 같은 엔진을 일반전·보스전이 함께 사용하게 해야 한다.

---

## 11. 보스전 입력 조립 순서

E4는 동일 입력에 대해 항상 같은 순서로 보스 전투 입력을 만든다.

```text
1. CampaignDungeon.bossId로 BossDef 조회
2. BossDef를 공통 enemy/encounter 입력으로 변환
3. 현재 riskLevel의 보스 HP/공격 scaling 적용
4. 남아 있는 merchant nextBattle 효과 적용
5. 살아 있는 참가 캐릭터별 accepted bossInfo modifier 적용
6. 최종 targetWeight / incomingDamage / outgoingDamage 입력 확정
7. 공통 BattleEngine 실행
8. merchant pending은 이 보스전을 next battle로 소비
```

곱셈 자체가 교환 가능해도 로그·검증·재현을 위해 합성 순서는 고정한다.

`avoidCombat`처럼 전투 자체를 생략하는 일반전 전용 의미가 merchant 계약에 존재한다면 보스전에 그대로 허용한다고 추정하지 않는다. E3 최종 `NextBattleMerchantEffect` 계약을 확인해 보스전에서 허용되는 효과만 명시적으로 변환한다. 보스전을 건너뛰는 새 의미를 E4가 임의로 추가하지 않는다.

### 11.1 재도전 위험도 scaling

보스 종류는 `initialRiskLevel`로 한 번 선택한 뒤 재도전해도 바꾸지 않는다. HP와 공격력은 현재 위험도로만 다음처럼 계산한다.

```text
riskIncrease = currentRiskLevel - initialRiskLevel
bossScale = 1 + (riskIncrease × 0.10)

bossMaxHp = round(BossDef.maxHp × bossScale)
bossBaseDamage = round(BossDef.baseDamage × bossScale)
```

`riskIncrease`는 `0..4` 범위다. ★5에서 위험도가 더 오르지 않으므로 실패 횟수나 attempt 수를 직접 scaling 입력으로 쓰지 않는다. 따라서 ★5 도달 뒤 재도전해도 보스 수치가 계속 상승하지 않는다.

---

## 12. 공통 BattleEngine 결과와 승패

보스전 승패는 `BattleEngine`의 확정 결과에서 파생한다.

### 12.1 클리어

보스가 사망하고 살아 있는 파티원이 한 명 이상 남으면:

```text
status = cleared
survivorIds = battle end의 모든 생존 CharacterId
```

생존자가 1명이어도 던전은 클리어다.

### 12.2 전멸

살아 있는 파티원이 0명이면:

```text
status = wiped
survivorIds = []
```

### 12.3 `roundLimit` 진단 경계

공통 `BattleEngine`의 50턴 안전장치가 `termination = "roundLimit"`을 반환하면 E4는 이를 `cleared`나 `wiped`로 투영하지 않는다. 생존자가 남아 있더라도 `wiped + survivorIds` 같은 모순된 정산 상태를 만들지 않는다.

E4는 `BossResult`와 C4 정산 입력을 만들기 전에 다음 정보를 담은 `RuleError("INVALID_GENERATION", ...)`로 중단한다.

- `bossId`
- `termination = "roundLimit"`
- `rounds = 50`
- 당시 살아 있던 파티원 ID
- 당시 살아 있던 적 ID

일반전의 `BattleEngine` round-limit 결과 표현은 변경하지 않는다. 이 경계는 보스 어댑터가 캠페인 정산에 넘기는 결과에만 적용한다.

### 12.4 E4가 하지 않는 정산

E4는 다음 캠페인 경제를 계산하지 않는다.

- 클리어 명성
- 클리어 골드
- 생존 3/2/1명 보상 비율
- 전멸 명성 손실
- 사망자 유품 골드 회수
- 던전 위험도 +1
- ★5 위험도 상한 처리
- 월드턴
- 승급
- 엔딩 최종 판정

이는 C4 이후 계층의 책임이다.

특히 전멸 명성 손실은 **상승 전/계약 시점 위험도**로 계산하므로 E4가 먼저 `CampaignDungeon.riskLevel`을 변경해서는 안 된다.

---

## 13. BossInfo 실제 적용 기록

bossInfo를 들고 있었다는 이유만으로 전투 효과가 적용된 것으로 간주하지 않는다.

### 13.1 accepted 기록

다음 조건을 모두 만족한 accepted record만 modifier 입력으로 소비한다.

- 현재 던전의 `bossId`와 정보의 대상 보스가 일치한다.
- `bossRuleId`가 현재 `BossDef.rules`에 존재한다.
- 해당 캐릭터가 보스전 시작 시 살아 있고 전투 참가자다.
- reaction이 `accepted`다.
- outcome이 `help` 또는 `harm`이다.

전투 입력에 modifier가 들어갔다면 해당 정보는 **applied**로 기록한다.

`targetWeight` 효과는 실제 공격 대상으로 뽑혔는지와 관계없이 target selection 계산에 그 weight가 입력된 순간 적용된 것으로 본다. "그 modifier가 없었으면 다른 대상을 뽑았는가" 같은 counterfactual 재시뮬레이션은 하지 않는다.

### 13.2 suspected 기록

suspected는 전투 modifier를 만들지 않지만 보스가 어떤 실제 `BossRule`을 가졌는지 확인 가능한 정보이므로 보스전 완료 뒤 truth/falsity 사후 검증 대상이 될 수 있다.

### 13.3 보스방 전에 사망한 캐릭터

이미 사망해 전투에 참가하지 않은 캐릭터의 accepted 정보는 applied가 아니다. 해당 캐릭터에 대한 전투 modifier도 생성하지 않는다.

---

## 14. BossInfo 사후 검증

보스전 완료 후 지연 기록을 각각 독립적으로 검증한다.

| reaction | outcome | 사후 결과 |
| --- | --- | --- |
| `accepted` | `help` | `adviceHelped` |
| `accepted` | `harm` | `adviceHarmed` |
| `suspected` | `help` | `suspicionWasCostly` |
| `suspected` | `harm` | `suspicionWasCorrect` |
| `exposed` | `harm` | 없음 — 이미 즉시 처리 완료 |
| any | `neutral` | 결과 기반 지연 검증 없음 |

### 14.1 accepted 검증 조건

`accepted + help/harm`은 해당 정보가 그 캐릭터의 실제 보스전 입력에 **applied**되었을 때만 사후 결과를 만든다.

### 14.2 suspected 검증 조건

suspected는 의도적으로 modifier를 적용하지 않은 상태이므로 `applied`를 요구하지 않는다. 대신 다음을 요구한다.

- 캐릭터가 보스전 시작 시 살아 있는 참가자였다.
- 현재 보스와 `bossRuleId`의 대상이 일치한다.
- 해당 정보가 실제 보스의 특징에 대한 help/harm 기록이다.
- 아직 지연 검증되지 않았다.

이 조건을 만족하면 보스전 완료 후 `suspicionWasCostly` 또는 `suspicionWasCorrect`를 만든다.

### 14.3 중복 검증 금지

한 delayed record는 최대 한 번만 사후 검증한다.

즉시 `exposed` 처리된 방해 정보는 같은 원정에서 `adviceHarmed`를 다시 발생시키지 않는다.

---

## 15. 사망 캐릭터의 지연 신뢰 변화

이번 E4 설계에서 다음 규칙을 확정한다.

> **보스전 종료 시 사망한 캐릭터에게는 bossInfo 지연 신뢰 변화를 적용하지 않는다.**

전투 중 해당 정보가 실제로 적용되었거나 의심 결과가 검증 가능해도, 전투 종료 시 `alive === false`라면 영구 `trust` 값은 변경하지 않는다.

전투 action record나 원인 설명용 verification metadata를 남기는 것은 허용하지만, campaign character state의 trust delta는 `0`이다.

예:

```text
accepted harmful bossInfo
-> 실제 불리한 modifier 적용
-> 캐릭터가 보스전 중 사망
-> 전투 기록에는 원인 보존 가능
-> 영구 trust 변화 없음
```

이 규칙은 보스전 정보뿐 아니라 후속 C6/C7에서 동일한 생존 기준을 해석할 수 있도록 공식 문서에도 반영해야 한다.

---

## 16. 누적 고발의 생존 기준

이번 설계에서 누적 고발 인원 정의를 다음으로 보완한다.

```text
count(character where character.alive === true && character.trust === 0)
```

따라서:

- `alive && trust === 0` -> 누적 고발 인원에 포함
- `dead && trust === 0` -> 포함하지 않음
- 살아 있을 때 trust 0이었던 캐릭터가 나중에 사망 -> 누적 고발 인원에서 제외

`누적 고발` 엔딩의 5명 조건 역시 **살아 있는 trust-0 캐릭터 5명**을 뜻한다.

전멸처럼 생존 파티원이 0명일 때 `불신의 대가`가 성립하지 않는 기존 공식 규칙은 그대로 유지한다.

C6 구현과 `CHARACTERS_AND_TRUST.md`, `PROGRESSION_AND_ENDINGS.md`는 이 새 정의를 동일하게 사용해야 한다.

---

## 17. U5-2 보스 정보 시각화 계약

보스 정보 시각 효과는 새 규칙이 아니라 **E4가 이미 확정한 결과의 표현**이다.

U5-2는 다음을 다시 계산하지 않는다.

- RNG
- 타겟 선택
- 피해량
- HP
- bossInfo help/harm 판정
- 신뢰
- 적용된 modifier

E4/E3가 남긴 결정적 action record와 presentation cue를 순서대로 재생한다.

### 17.1 전투 시작 — 정보 보유 표시

보스전 시작 시 실제 accepted bossInfo를 들고 전투에 참여하는 캐릭터에게만 짧은 표시를 줄 수 있다.

예시 표현:

- `움직임을 읽고 있음`
- `약점을 기억하고 있음`
- `추적 습성을 경계 중`

파티 전체 버프처럼 표시하지 않는다.

### 17.2 실제 적용 순간 — 결과 피드백

| 축 | 유리한 표현 예 | 불리한 표현 예 |
| --- | --- | --- |
| `targetWeight` | `추적 회피`, `움직임 간파` | `표적 노출`, `유인당함` |
| `incomingDamage` | `공격 예측`, `전조 간파` | `오판`, `대응 실패` |
| `outgoingDamage` | `약점 포착`, `빈틈 발견` | `헛짚음`, `잘못된 타이밍` |

이는 예시 문구다. 실제 표시 문구는 각 `BossRule`의 설정과 자연스럽게 연결할 수 있다.

내부 시스템 용어인 `help`, `harm`, `consistent`, `contradictory`, `정답`, `오답`을 정답표처럼 노출하지 않는다.

---

## 18. Presentation Cue

E4 결과에는 U5-2가 재생할 수 있는 결정적 정보가 필요하다.

개념 계약은 다음과 같다.

```ts
interface BossInfoPresentationCue {
  readonly bossRuleId: BossRuleId;
  readonly characterId: CharacterId;
  readonly timing: "battleStart" | "beforeTarget" | "beforeDamage" | "afterDamage";
  readonly axis: "targetWeight" | "incomingDamage" | "outgoingDamage";
  readonly direction: "beneficial" | "harmful";
  readonly presentationKey: string;
}
```

정확한 타입 위치와 timing enum 이름은 구현 Plan에서 E3 action record 형태에 맞출 수 있지만, **UI가 원래 규칙을 다시 읽어 cue를 생성해서는 안 된다**는 책임 경계는 바뀌지 않는다.

한 action에서 여러 bossInfo·merchant 효과가 동시에 계산되어도 BossInfo 텍스트 이펙트는 기본적으로 최대 1개만 노출한다. 내부 계산은 모두 유지한다.

cue 우선순위도 결정적이어야 하며 입력 배열 순서나 object iteration 우연에 의존하지 않는다.

---

## 19. 자동 전투 표현 범위

E4가 U5-2에 제공하는 것은 기존 프로토타입 자동 전투 연출 범위 안에 있어야 한다.

포함:

- 캐릭터별 bossInfo 보유 표시
- 짧은 텍스트
- 작은 아이콘·플래시·강조
- 도움/방해 방향을 구분하는 짧은 피드백
- 기존 `Idle -> Attack Lunge -> Hit Shake -> Damage Number -> HP Bar` 재생과의 결합

제외:

- 보스 특징마다 별도 대형 VFX
- 전용 컷신
- 다프레임 캐릭터·보스 스프라이트 시스템
- Spine / Live2D
- 검격·화살·마법별 전용 이펙트 세트
- 복잡한 카메라 연출

애니메이션 속도, 프레임 드롭, 스킵 여부는 게임 상태를 바꾸지 않는다.

---

## 20. 결과 모델과 후속 계층 경계

보스전 자체의 사실과 캠페인 정산 결과를 분리한다.

### `BossResult`

다음과 같은 **전투 사실**을 소유한다.

- 공통 BattleEngine action records 또는 이를 참조할 결과
- 보스전 승/패
- `survivorIds`
- bossInfo 적용·presentation·사후검증 근거

### `ExpeditionResult`

후속 정산이 소비할 원정 결론을 소유한다.

- `cleared` / `wiped`
- `survivorIds`
- 정산에 필요한 기존 결과 데이터

E4는 C4의 보상 수치를 `BossResult`에 섞지 않는다.

---

## 21. Retry와 상태 수명

E3의 시도 단위 reset 계약을 그대로 따른다.

재도전 시 다음은 새 attempt에서 다시 준비된다.

- 현재 attempt의 node/event materialization
- 현재 attempt에서 얻은 bossInfo delayed records
- strong follower activation
- merchant pending nextBattle
- bossInfo presentation state

반면 다음 던전 콘텐츠 정체성은 유지된다.

- `activeRuleIds`
- `activeMonsterIds`
- `ecologyProfileId`
- `bossId`
- 초기 위험도로 결정된 보스 종류

현재 위험도는 실패 후 상승할 수 있고 E4는 새 attempt의 보스 HP·공격 scaling에 현재 값을 사용한다.

재도전이 보스를 다른 종류로 다시 뽑게 해서는 안 된다.

---

## 22. 결정성

동일한 도메인 입력은 동일한 보스전 결과를 만든다.

결정성 입력에는 최소 다음이 포함된다.

```text
campaign seed / battle seed derivation
expedition attempt identity
dungeonId
bossId
current riskLevel
party combat state
relevant InfoRecord[]
pending merchant effect
```

동일 입력은 다음을 동일하게 만든다.

- Boss Adapter 최종 입력
- target selection
- damage
- 사망 순서
- BattleResolution
- action record 순서와 값
- applied bossInfo 목록
- BossInfoPresentationCue 순서와 값
- 사후 verification 결과

U5-2의 재생 속도나 skip은 이 결정성 입력이 아니다.

---

## 23. 오류 처리

콘텐츠·입력 계약이 깨지면 조용히 보정을 생략하거나 다른 trait로 대체하지 않는다.

다음은 생성/규칙 오류다.

- shipped `BossDef`가 `BossRule`을 정확히 2개 가지지 않음
- `BossRuleId`가 중복됨
- shipped `BossRuleId`에 trait mapping이 없음
- 하나의 `BossRuleId`가 둘 이상의 trait에 연결됨
- trait가 허용된 세 계산 축 이외의 효과를 요구함
- bossInfo의 대상 보스가 현재 `bossId`와 다름
- bossInfo가 현재 `BossDef.rules`에 없는 `BossRuleId`를 가리킴
- 존재하지 않는 `CharacterId` 또는 보스전 참가자가 아닌 캐릭터에게 전투 modifier 적용을 시도함
- 같은 delayed record를 두 번 소비·검증함
- `targetWeight` trait가 존재하지만 공통 BattleEngine이 필요한 정적 target-weight 입력을 지원하지 않음
- merchant effect를 보스전 의미로 안전하게 변환할 수 없음

가능한 기존 오류 체계 안에서는 `RuleError("INVALID_GENERATION", ...)` 또는 계약에 맞는 더 구체적인 `RuleError`를 사용한다.

특히 다음 silent fallback은 금지한다.

```text
targetWeight 기능이 없으니 해당 bossInfo만 무시하고 전투 계속
알 수 없는 BossRule이면 기본 incomingDamage modifier로 대체
잘못된 bossId 정보면 현재 보스 정보로 간주
merchant 변환 실패면 효과만 버리고 전투 계속
```

---

## 24. 테스트 계약

E4 구현은 최소 다음을 자동 검증한다.

### 24.1 공통 전투 코어

1. 보스전이 E3 공통 `BattleEngine`을 사용한다.
2. 기존 `resolveBossFight`가 남더라도 별도 공격 루프가 없다.
3. 같은 전투 입력은 같은 action record를 만든다.

### 24.2 trait 콘텐츠

4. 테마 3종 × 보스 4종 = 12개 보스가 모두 존재한다.
5. 각 shipped 보스는 정확히 2개의 `BossRule`을 가진다.
6. 24개 shipped `BossRuleId`가 모두 정확히 하나의 trait에 매핑된다.
7. 모든 trait는 세 허용 축 중 하나만 사용한다.

### 24.3 개인 적용

8. A만 정보를 수용하면 B/C의 modifier는 기본값을 유지한다.
9. `accepted + help`은 항상 유리한 방향이다.
10. `accepted + harm`은 항상 불리한 방향이다.
11. neutral은 전투 modifier를 만들지 않는다.
12. suspected와 exposed는 전투 modifier를 만들지 않는다.
13. 동일 캐릭터가 두 정보를 수용하면 두 modifier가 독립적으로 누적된다.
14. 캐릭터별 modifier가 다른 캐릭터에게 새지 않는다.

### 24.4 targetWeight

15. static target weight가 target selection에 실제 입력된다.
16. HP·턴·어그로 변화로 target weight가 동적으로 바뀌지 않는다.
17. 같은 seed와 weight 입력은 같은 target sequence를 만든다.

### 24.5 merchant 합성

18. 남아 있는 `nextBattle` 효과가 보스전에서 허용된 의미로 한 번 적용된다.
19. bossInfo와 merchant가 함께 있어도 합성 순서와 결과가 결정적이다.
20. 보스전이 next battle을 소비한 뒤 pending effect가 남지 않는다.

### 24.6 사후 검증

21. applied `accepted + help`은 `adviceHelped`가 된다.
22. applied `accepted + harm`은 `adviceHarmed`가 된다.
23. `suspected + help`은 참가·대상 조건을 만족하면 `suspicionWasCostly`가 된다.
24. `suspected + harm`은 참가·대상 조건을 만족하면 `suspicionWasCorrect`가 된다.
25. exposed 기록은 중복 검증되지 않는다.
26. neutral은 결과 기반 지연 검증되지 않는다.
27. 하나의 delayed record는 최대 한 번만 검증된다.

### 24.7 사망과 신뢰

28. 보스전 종료 시 사망한 캐릭터에게 지연형 trust delta가 적용되지 않는다.
29. 살아남은 캐릭터는 정상적으로 지연형 trust delta를 받을 수 있다.
30. `dead && trust === 0` 캐릭터는 누적 고발 인원에서 제외된다.
31. `alive && trust === 0` 캐릭터만 누적 고발 인원에 포함된다.
32. 살아 있던 trust-0 캐릭터가 사망하면 누적 고발 인원 수가 감소한다.

### 24.8 승패와 책임 경계

33. 보스 사망 + 생존자 1명 이상이면 `cleared`다.
34. 생존자 0명이면 `wiped`다.
35. E4가 명성·골드·위험도·월드턴을 직접 변경하지 않는다.
36. C4가 사용할 생존자와 상태 정보는 손실 없이 전달된다.

### 24.9 presentation

37. bossInfo 적용 사실이 결정적인 presentation cue로 남는다.
38. UI를 실행하지 않아도 도메인 전투 결과와 trust verification 결과가 완전히 확정된다.
39. 한 action에 여러 효과가 있어도 cue 노출 우선순위가 결정적이다.
40. 동일 입력은 cue 배열까지 동일하다.
41. UI replay가 피해·RNG·신뢰를 재계산하지 않아도 전체 장면을 재생할 수 있다.

---

## 25. 공식 문서·기존 타입 정합성 수정 대상

E4 구현 Plan에는 코드와 함께 다음 문서/주석의 정합성 수정 작업을 포함한다.

### `docs/systems/INFORMATION_AND_DECEPTION.md`

- bossInfo를 단순 단일 피해 modifier로 설명하는 부분을 세 축 기반 개인 modifier 계약으로 갱신
- `accepted`뿐 아니라 `suspected` 사후 검증에 필요한 기록 보존 계약 명확화
- 사망자는 보스전 뒤 지연 trust 변화 없음 명시

### `docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md`

- `BossRule` 두 개가 각각 정적 BossTrait 하나와 연결됨을 명시
- 보스 정보 사건이 `BossRuleId`를 통해 전투 trait까지 이어지는 계약 명시

### `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`

- E4가 공통 BattleEngine adapter라는 책임 명시
- static target weight / incoming / outgoing 세 축 명시
- U5-2 presentation cue가 계산 결과를 재생만 한다는 계약 반영
- 최신 E3의 bossInfo cut 계약과 충돌하는 구형 Depth 표현 제거

### `docs/systems/CHARACTERS_AND_TRUST.md`

- 누적 고발 인원은 살아 있는 trust-0 캐릭터만 계산
- 죽은 trust-0 캐릭터는 누적 고발에서 제외
- 사망 시 기존 누적 고발 인원에서도 빠짐

### `docs/systems/PROGRESSION_AND_ENDINGS.md`

- `누적 고발` 5명 조건을 살아 있는 trust-0 캐릭터 5명으로 명확화

### `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

- E2의 구형 `보스 정보 Depth` 표현을 최신 E3 cut 계약에 맞게 정리
- E4 완료 기준에 BossTrait·개인 modifier·사후 검증·presentation cue 책임 반영

### 현재 도메인 타입/주석

- `InfoRecord.modifier: number` 단일 보정 중심 계약
- `InfoRecord`를 accepted-only처럼 설명하는 주석
- 구형 `BossTurnRecord`가 E3 공통 action record와 중복되는 경우의 호환 wrapper/이관 계약
- 누적 trust-0 계산에서 alive 조건이 빠진 코드·테스트·주석

문서 수정은 새 규칙을 추가하는 작업이 아니라 **이번 승인 Spec과 현재 공식 문서를 일치시키는 작업**이다.

---

## 26. 수용 기준

E4가 완료되었다고 판단하려면 다음이 모두 참이어야 한다.

1. 보스전이 E3 공통 `BattleEngine`에서 계산된다.
2. shipped 보스 12종의 24개 `BossRule`이 공용 BossTrait에 1:1 연결된다.
3. 보스별 예외 attack loop나 dynamic boss AI가 없다.
4. bossInfo는 `BossRuleId -> BossTrait -> axis`를 통해 개인 modifier가 된다.
5. accepted help/harm은 수용한 캐릭터에게만 유리/불리하게 적용된다.
6. neutral·suspected·exposed는 전투 modifier를 만들지 않는다.
7. 여러 bossInfo와 merchant nextBattle이 결정적으로 합성된다.
8. static target weight가 필요하면 E3 공통 엔진 계약으로 제공되며 E4 전용 타겟 시스템이 없다.
9. 보스전 결과와 action records가 deterministic하다.
10. bossInfo presentation cue도 deterministic하며 U5-2가 재계산 없이 재생할 수 있다.
11. accepted/suspected bossInfo의 사후 검증이 중복 없이 동작한다.
12. 보스전 종료 시 사망한 캐릭터의 영구 신뢰는 지연 검증으로 변하지 않는다.
13. 누적 고발은 살아 있는 trust-0 캐릭터만 센다.
14. 생존자 1명 이상으로 보스를 쓰러뜨리면 cleared, 전멸하면 wiped다.
15. E4가 C4의 명성·골드·위험도 정산 책임을 침범하지 않는다.
16. 관련 공식 문서와 타입 주석이 이 Spec과 일치한다.
17. E4 테스트가 위 24절의 계약을 자동 검증한다.

이 기준을 만족하면 E4는 C4와 U5-2가 안전하게 소비할 수 있는 완료 상태다.
