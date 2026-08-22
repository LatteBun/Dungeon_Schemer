# E2 생태 추론·조언 판정 설계

## 이 문서의 지위

이 문서는 캠페인 개편 작업의 `E2 | 조언 판정`을 구현하기 위한 정식 설계다.

현재 공식 문서와 구현에는 E2 브레인스토밍 이전 규칙이 일부 남아 있다. 이번 설계에서는 다음을 최신 규칙으로 확정한다.

- 던전의 활성 생태 규칙 3개는 E2가 다시 뽑지 않는다. C1이 생태 패키지와 함께 확정한 `CampaignDungeon.activeRuleIds`를 그대로 사용한다.
- 활성 규칙 공개 수는 **현재 위험도** 기준으로 ★1~2는 3개, ★3~4는 2개, ★5는 1개다.
- 공개 우선순위는 던전마다 결정적으로 고정하고 위험도 상승 시 공개 집합이 이전 집합의 부분집합이 되게 한다.
- 게시판의 `공개 환경 특성`은 제거한다. 생태 추론 정보는 계약 뒤 던전 진입부터 시작한다.
- 조건부 생태 규칙은 활성 여부뿐 아니라 현재 사건에서 조건이 실제로 성립해야 조언 근거로 사용할 수 있다.
- 도움·방해·중립과 정합·모순 같은 내부 판정값은 선택 전후 모두 UI에 직접 공개하지 않는다.
- 현재 원정에서 확인한 공개 생태와 관찰 단서는 진행 기록에서 다시 볼 수 있다. 다만 숨은 규칙을 시스템이 자동으로 정답 처리하지 않는다.
- 즉시형 조언은 사건 결과가 나온 뒤 신뢰를 반영한다. 보스 지연형 조언은 결과 기반 신뢰를 보스전까지 미룬다.
- 보스 정보는 특정 노드가 아니라 Depth를 예약한다. 실제 사건 ID 선택과 전체 사건 중복 관리는 E3가 담당한다.
- 일반 사건 전체의 방문 시 물질화 여부는 E3 책임이다. E2는 일반 사건 ID를 미리 배치하지 않는다.

이 설계가 승인된 뒤 E2 구현에서 관련 공식 문서와 작업 배정표를 함께 갱신한다. `2026-08-19` 캠페인 개편 설계와 그 이전 정보 카드 설계는 역사적 설계 자료이며, 현재 규칙의 직접 근거로 사용하지 않는다.

---

## 1. 목표

E2의 목적은 플레이어가 읽은 생태와 현장 단서를 근거로 조언을 선택했을 때, 그 선택을 **재현 가능한 규칙 판정**으로 바꾸는 것이다.

E2는 다음을 보장한다.

1. 한 던전에서 참인 활성 규칙 3개는 재도전해도 바뀌지 않는다.
2. 현재 위험도가 높아질수록 직접 공개되는 규칙 수만 줄어든다.
3. 조건부 규칙은 현재 상황 조건이 성립한 사건에서만 판정 근거가 된다.
4. 한 사건의 조언 3개는 내부적으로 도움·방해·중립 한 개씩이지만 위치와 유형을 UI가 누설하지 않는다.
5. 살아 있는 파티원은 같은 조언에도 독립적으로 수용·의심·적발한다.
6. 한 명이라도 수용하면 행동은 한 번 실행되고, 아무도 수용하지 않으면 사건의 기본 결과로 간다.
7. 조언의 실제 결과가 드러난 뒤에만 결과 기반 신뢰가 움직인다.
8. 보스 정보는 모든 실제 경로에서 위험도에 맞는 1~2회가 보장된다.
9. 동일한 캠페인 상태와 선택은 동일한 공개 규칙, 조언 순서, 반응을 재현한다.
10. 플레이어는 결과의 원인을 이해할 수 있지만 내부 enum과 정확한 확률은 보지 않는다.

E2는 사건 풀 전체의 배치, 단서 연계, **사건 효과의 실제 적용**, merchant 결제·효과 적용, 보스 전투 계산, 화면 구현을 소유하지 않는다. E2의 `실행`은 조언을 적용할지 결정하는 판정값이며, HP·골드·상태를 바꾸는 명령이 아니다.

---

## 2. 시스템 책임 경계

| 영역 | 책임 |
| --- | --- |
| C1 | 던전 슬롯, 생태 패키지, `activeRuleIds` 3개, 출현 잡몹, 보스 확정 |
| E1 | `GeneratedMap.layers`, 초기 위험도 기준 6~8 일반 Depth와 논리 그래프 |
| **E2** | 규칙 공개, 사건 조언의 생태 적합성, 조언 순서, 파티원별 반응, 실행 여부, 신뢰 검증 시점, 보스 정보 Depth 계획 |
| E3 | 일반 사건 콘텐츠 선택, 실제 방문 사건 ID 중복 방지, 단서 누적, 약한·강한 연계, 조언 실행 결정에 따른 사건 효과·merchant 결제 적용, 방문 시 사건 물질화 |
| E4 | 턴 단위 보스전, 보스 조언 피해 보정 적용, 지연 기록 사후 검증 |
| C6 | 신뢰 0 누적 2~4명에 따른 캠페인 수용·적발 추가 보정 |
| U5 | 진행 화면, 행동/조언과 진행 기록 전환, 플레이어용 결과 피드백 |
| B1 | 확률·피해·신뢰 상수의 백테스트 재조정 |

### 2-1. E2와 E3의 물질화 경계

E2는 `어느 Depth가 보스 정보 기회인가`를 결정한다. **어떤 보스 정보 사건 ID를 실제로 사용할지는 E3가 방문 순간 선택한다.**

이렇게 나누는 이유는 한 원정의 실제 방문 사건 ID 중복 금지와 강한 연계 사건 배치를 E3가 한 곳에서 관리해야 하기 때문이다.

따라서 흐름은 다음과 같다.

```text
E2: BossInfoDepthPlan 생성
        ↓
E3: 현재 Depth 방문
        ↓
보스 정보 예약 Depth인가?
  ├─ 아니오 → 일반 사건 후보에서 물질화
  └─ 예     → 현재 보스용 정보 사건 후보에서 물질화
        ↓
E2: 물질화된 사건의 조언 판정
```

E3의 강한 연계 Depth는 E2의 보스 정보 예약 Depth와 겹치지 않는다. 한 Depth에서 서로 다른 두 보장 사건이 같은 방문 노드를 요구하는 충돌을 허용하지 않는다.

### 2-2. E2의 실행 판정과 E3 효과 적용 계약

현재 일반 `SituationEvent`는 `effectTags`와 결과 문구를 가질 뿐, HP·골드·상태를 직접 바꾸는 공통 효과 payload를 갖지 않는다. 이 payload를 E2에 새로 만들지 않는다. merchant의 구체 효과와 결제도 이미 E3 책임이다.

따라서 한 일반 사건의 순서는 다음으로 고정한다.

```text
E2: 조언 순서·파티원 반응·executed 판정
        ↓
E3: executed면 선택 조언 효과를 정확히 한 번 적용,
    false면 사건 기본 결과를 적용
        ↓
E2: 실제 결과가 나온 뒤 즉시 신뢰 행동을 확정
        ↓
U5: 결과 문구·변화·신뢰 이유만 표시
```

- `AdviceResolution.executed`는 효과 적용 권한이 아니라 **한 번 적용해야 한다는 결정**이다.
- E3는 `executed === true`인 같은 resolution을 두 번 적용하면 안 되며, merchant는 기존 결제·pending 효과 계약을 그대로 사용한다.
- E3가 E2에 돌려주는 결과에는 실행 여부와 사람이 읽는 결과 문구·실제 변화만 담고 `outcome`, `relation`, `source`, 확률을 넣지 않는다.
- 즉시 신뢰는 E3가 효과 적용을 끝낸 뒤 E2의 후속 판정 함수가 만든다. 효과 적용 전 신뢰를 움직이거나 E2가 일반 사건의 효과를 직접 추론하지 않는다.

### 2-3. 보스 정보와 강한 연계 예약 계약

E2는 `BossInfoDepthPlan`만 만들고, E3는 이를 입력으로 받아 `StrongLinkDepthPlan`을 만든다. 두 계획을 함께 검증하는 예약 검증 함수는 E3 경계에 둔다. 즉 E2가 아직 존재하지 않는 E3 강한 연계 계획을 추측하거나 검증하지 않는다.

개념 계약은 다음과 같다.

```ts
interface BossInfoDepthPlan {
  reservedDepths: readonly number[];
}

interface StrongLinkDepthPlan {
  reservedDepths: readonly number[];
}
```

E3는 `BossInfoDepthPlan.reservedDepths`를 제외해 강한 연계 Depth를 고르고, 합집합의 수·중복·Depth 범위를 검증한다. 충돌 또는 수량 부족은 E3 계획 생성에서 `RuleError("INVALID_GENERATION", ...)`로 실패한다.

---

## 3. 게시판 공개 환경 특성 제거

### 3-1. 플레이 단계별 정보 역할

게시판의 질문은 `어디에 누구와 들어갈 것인가`다. 생태 추론은 계약 뒤 시작한다.

게시판과 계약 상세가 보여주는 것은 다음으로 제한한다.

- 던전 이름
- 현재 위험도
- 진입 가능 여부와 잠금 사유
- 계약 보상
- 출전 파티 3인의 직업·성격·HP·신뢰·소지 골드
- 생존 인원별 계약 결과

`진동 경계`, `어둠 잠복`, `열기 노출` 같은 `공개 환경 특성`은 표시하지 않는다.

### 3-2. 도메인에서도 제거한다

UI에서만 감추고 사용하지 않는 계약을 남기지 않는다. 다음 계약을 제거한다.

- `PublicEnvironmentTagId`
- `PublicEnvironmentTag`
- `EnvironmentTagDefinition`
- `ThemeContent.publicEnvironmentTags`
- `EcologyProfile.publicEnvironmentTagId`
- `BoardOffer.publicEnvironmentTag`
- 테마 콘텐츠의 공개 환경 특성 데이터와 해당 검증 규칙
- `createBoardOffers()`의 공개 환경 특성 조회
- U3 게시판 모델과 화면의 환경 특성 표시

생태 패키지는 이후 `초기 위험도 + 활성 규칙 3개 + 출현 잡몹`만 묶는다.

---

## 4. 활성 생태 규칙과 공개

### 4-1. 활성 규칙은 C1의 입력이다

`CampaignDungeon.activeRuleIds`는 정확히 3개여야 하며 해당 던전 테마에 속해야 한다.

E2는 이를 변경하거나 다시 추첨하지 않는다.

```text
C1
생태 패키지 배정
→ activeRuleIds 3개
→ activeMonsterIds
→ bossId

E2
activeRuleIds 읽기
→ 공개 우선순위 계산
→ 현재 위험도만큼 공개
```

재도전으로 `riskLevel`이 올라가도 `activeRuleIds`, `activeMonsterIds`, `ecologyProfileId`, `bossId`는 유지한다.

### 4-2. 현재 위험도별 공개 수

| 현재 `riskLevel` | 공개 규칙 수 |
| --- | ---: |
| ★1 | 3 |
| ★2 | 3 |
| ★3 | 2 |
| ★4 | 2 |
| ★5 | 1 |

지도 Depth와 보스 선택은 계속 `initialRiskLevel`을 따른다. 규칙 공개 난이도만 현재 `riskLevel`을 따른다.

### 4-3. 공개 우선순위

활성 규칙 3개는 던전마다 **하나의 고정 공개 우선순위**를 가진다.

구현 계약은 다음과 같다.

1. `activeRuleIds`를 ID 기준으로 정렬해 입력 순서의 영향을 없앤다.
2. `campaignSeed + dungeonId`에서 독립된 ecology RNG를 만든다.
3. 세 ID를 한 번 결정적으로 섞어 `rulePriority`를 만든다.
4. 현재 위험도 공개 수만큼 앞에서 잘라 `disclosedRuleIds`를 만든다.

예:

```text
rulePriority = [C, A, B]

★1~2 → [C, A, B]
★3~4 → [C, A]
★5   → [C]
```

따라서 위험도가 올라갈 때 이미 공개된 규칙이 무작위로 교체되지 않고 **점진적으로 사라진다.**

`attempt`는 공개 우선순위 입력에 넣지 않는다. 재도전은 지도와 사건을 다시 만들지만 던전 자체의 답사 지식 우선순위까지 바꾸지 않는다.

### 4-4. 재도전과 기억

새 원정이나 재도전을 시작하면 시스템이 보관하는 현재 원정의 관찰 기록은 초기화한다.

다만 다음은 유지된다.

- 활성 규칙 3개
- 공개 우선순위
- 현재 위험도에 따라 다시 계산한 공개 규칙
- 플레이어 자신의 실제 기억

게임은 플레이어가 이전 실패에서 배운 내용을 기억해 재도전에 활용하는 것을 막지 않는다.

---

## 5. 관찰 단서와 진행 기록 계약

숨겨진 활성 규칙은 원정 중 다음 세 종류의 근거로 추론한다.

- 환경과 상황 묘사
- 사건에서 관찰한 행동·흔적
- 선택 뒤 실제 결과

게임은 관찰 사실을 기록할 수 있지만 `이 단서는 곧 숨은 규칙 B의 정답이다`라고 자동 결론을 내려서는 안 된다.

### 5-1. 플레이어가 다시 볼 수 있는 것

U5 진행 화면의 좌하단 플레이어 콘솔은 다음 두 모드를 가진다.

```text
[행동 / 조언] [진행 기록]
```

`진행 기록`은 현재 원정의 시간 순 기록을 보여주고 최소 다음 필터를 지원한다.

```text
[전체] [단서] [전투] [생태]
```

`생태`에서는 두 범주를 시각적으로 분리한다.

- **확인된 생태**: E2가 현재 위험도에 따라 직접 공개한 규칙 문장
- **관찰 단서**: 원정 중 실제로 본 사실과 결과

관찰 단서는 숨은 규칙 문장으로 자동 승격되지 않는다.

### 5-2. 소유권

E2는 공개 규칙과 조언 판정 결과를 제공한다. E3는 사건에서 얻은 단서를 누적하고, E4는 전투 기록을 제공한다. U5가 이를 하나의 진행 기록 UI로 합친다.

E2가 전체 로그 저장소나 전투 로그를 새로 만들지는 않는다.

---

## 6. 조건부 생태 규칙

현재 `EcologyRule.conditional`은 조건부 여부만 말하고 `이 사건에서 조건이 성립했는가`를 표현하지 못한다. E2에서는 사건 데이터에 기계가 판정할 수 있는 명시적 계약을 추가한다.

### 6-1. 사건의 조건 성립 선언

일반 `SituationEvent`에 다음 의미의 필드를 추가한다.

```ts
satisfiedConditionalRuleIds?: readonly RuleId[]
```

이 배열은 **현재 장면에서 조건이 실제로 성립한 조건부 생태 규칙**만 담는다.

예:

```text
규칙
철갑거미는 진동을 느끼면 몸을 들어 배 아래가 노출된다.

상황
무너진 돌기둥이 바닥을 계속 울리고 있고
철갑거미가 몸을 높이 세우고 있다.

satisfiedConditionalRuleIds = ["spider-armor-vibration"]
```

### 6-2. 조언 적합성

생태 규칙을 참조하는 조언은 다음을 모두 만족해야 제시 가능한 사건에 속한다.

1. 참조 규칙이 현재 던전의 `activeRuleIds`에 있다.
2. 참조 규칙이 비조건부라면 추가 조건이 없다.
3. 참조 규칙이 조건부라면 사건의 `satisfiedConditionalRuleIds`에 그 ID가 있다.

조건부 규칙이 활성이더라도 현재 조건이 성립하지 않으면 그 규칙을 참조하는 도움·방해 조언을 제시하지 않는다.

다만 실행 시 조언 하나를 조용히 제거하지 않는다. 한 사건은 항상 조언 3개를 유지해야 하므로, **사건 전체가 현재 던전에 부적합한 후보**가 된다. E3가 다른 적합 사건을 물질화한다.

부적합 사건이 E2 판정까지 들어오면 `RuleError("INVALID_GENERATION", ...)`로 실패한다.

### 6-3. 콘텐츠 검증

검증기는 다음도 확인한다.

- `satisfiedConditionalRuleIds`의 ID가 실제로 존재한다.
- 사건 테마와 같은 테마의 규칙이다.
- `conditional === true`인 규칙만 배열에 들어간다.
- 조건부 규칙을 참조하는 조언은 해당 사건에서 조건 성립 선언이 있다.

자연어 묘사를 런타임에서 파싱해 조건을 추측하지 않는다.

---

## 7. 조언 유형 판정과 공개 경계

### 7-1. 테마 전용 사건

생태 규칙을 참조하는 조언은 현재 활성 규칙과의 관계로 판정한다.

| `EcologyRelation` | 내부 `AdviceOutcome` |
| --- | --- |
| `consistent` | `help` |
| `contradictory` | `harm` |
| `unrelated` | `neutral` |

테마 전용 사건에서 `consistent`와 `contradictory`는 반드시 활성 생태 규칙을 참조한다. `neutral`은 생태 규칙을 참조하지 않는다.

콘텐츠의 `outcome`과 `relation`이 위 표와 다르면 생성 오류다. E2는 콘텐츠의 `outcome`을 플레이어에게 공개할 라벨로 사용하지 않는다.

### 7-2. 공용 사건

`rest`, `merchant`, 공용 `special`은 생태 규칙을 참조하지 않는다. 이 경우 콘텐츠가 도움·방해·중립을 직접 선언하고, 플레이어는 장면에 적힌 관찰 가능한 사실로 판단한다.

공용 사건의 세 조언은 `relation === "unrelated"`이고 생태 source를 갖지 않는다.

### 7-3. 보스 정보 사건

보스 정보 사건은 생태 규칙이 아니라 현재 `bossId`의 전용 `BossRule`을 참조한다.

- help와 harm은 현재 대상 보스의 특징을 참조한다.
- neutral은 보스 특징 source를 갖지 않는다.
- 현재 던전의 `bossId`와 다른 보스 정보 사건은 사용할 수 없다.

보스 정보의 내부 outcome은 보스 피해 보정과 사후 검증에 사용한다.

---

## 8. 조언 3개의 결정적 셔플

콘텐츠 배열의 저장 순서는 플레이 힌트가 되어서는 안 된다.

각 사건을 보여줄 때 조언 3개를 결정적으로 섞는다.

셔플 입력에는 최소 다음을 포함한다.

- campaign seed
- dungeon id
- attempt
- depth
- event id

조언 순서용 RNG는 파티 반응 RNG와 독립시킨다. 조언 순서를 섞는 호출 수가 반응 확률 결과를 바꾸면 안 된다.

동일한 입력이면 같은 순서를 보여주고, 다른 사건이나 다른 attempt에서는 순서가 달라질 수 있다.

### 8-1. 플레이어용 선택 데이터

U5에 넘기는 선택 전 데이터는 내부 판정 정보를 제거한 별도 표현을 사용한다.

최소 공개 필드는 다음이다.

```ts
interface PresentedAdviceOption {
  id: ChoiceId;
  label: string;
  line: string;
  goldCost?: number;
}
```

UI에 직접 넘기지 않는 값:

- `outcome`
- `relation`
- `source`
- `bossDamageModifier`
- 수용 확률
- 적발 확률
- 예상 신뢰 변화량

merchant 비용처럼 플레이어가 선택 전에 알아야 하는 실제 비용은 예외적으로 공개한다.

### 8-2. 선택 뒤에도 유형 라벨은 공개하지 않는다

결과 화면에도 다음과 같은 정답 문구를 만들지 않는다.

```text
도움 조언이었습니다
방해 조언이었습니다
consistent
contradictory
```

대신 다음 인과를 보여준다.

```text
선택한 말
→ 파티원별 수용 / 의심 / 적발
→ 실제 사건 결과
→ HP · 골드 · 상태 변화
→ 신뢰 변화와 사람이 읽는 이유
```

적발은 `조언의 모순을 눈치챘다` 같은 세계 안의 반응으로 보여줄 수 있다. 내부 enum 이름을 정답표처럼 보여주지는 않는다.

---

## 9. 파티원별 반응 확률

### 9-1. 기본 확률

| 내부 유형 | 수용 | 적발 | 의심 |
| --- | ---: | ---: | --- |
| 도움 | 70% | 0% | 나머지 |
| 중립 | 55% | 0% | 나머지 |
| 방해 | 45% | 15% | 나머지 |

`exposed`는 방해에서만 나온다.

### 9-2. 신뢰 구간 보정

| 현재 개인 신뢰 | 수용 보정 | 방해 적발 보정 |
| --- | ---: | ---: |
| 0~33 | -20 | +15 |
| 34~66 | 0 | 0 |
| 67~100 | +15 | -10 |

원정이 시작된 뒤 E2의 반응 대상은 **현재 살아 있는 파티원**이다. 신뢰 0으로 떨어졌더라도 아직 원정 중 살아 있다면 현재 파티 구성원이며, 이후 출전 금지와 엔딩 판정은 C6·캠페인 전이가 처리한다.

### 9-3. 성격 보정

| 성격 | 수용 보정 | 방해 적발 보정 |
| --- | --- | ---: |
| 의심 많음 | -20 | +20 |
| 정의로움 | 도움 +15 / 방해 -10 / 중립 0 | +15 |
| 탐욕스러움 | +10 | -5 |
| 신중함 | -10 | +10 |
| 충동적 | +15 | -10 |

### 9-4. C6 캠페인 보정

E2 판정 함수는 C6가 나중에 공급할 캠페인 상태 보정을 받을 수 있어야 한다.

E2 구현 시 기본값은 0이다. E2가 신뢰 0 누적 인원을 직접 계산해 C6 책임을 선행 구현하지 않는다.

### 9-5. 계산 순서와 clamp

도움·중립:

```text
base accept
+ trust modifier
+ personality modifier
+ campaign modifier
→ 5~95 clamp
→ 나머지 suspected
```

방해:

```text
base expose
+ trust expose modifier
+ personality expose modifier
+ campaign expose modifier
→ expose 5~80 clamp

base accept
+ trust accept modifier
+ personality accept modifier
+ campaign accept modifier
→ accept 5 ~ (95 - expose) clamp

나머지 suspected
```

확률 값은 내부 계산값이며 UI에는 표시하지 않는다.

### 9-6. 독립 판정과 RNG

살아 있는 파티원마다 `card` 난수로 1~100 정수 하나를 사용한다.

멤버 순서 변경이 다른 멤버의 결과를 흔들지 않도록 반응 RNG 입력에는 `characterId`까지 포함한다.

최소 입력:

```text
campaignSeed
+ dungeonId
+ attempt
+ depth
+ eventId
+ adviceId
+ characterId
+ card stream
```

방해의 1~100 구간은 다음 순서다.

```text
1 ... exposed        → exposed
다음 accept 구간     → accepted
나머지               → suspected
```

도움·중립은 accepted 구간 뒤가 suspected다.

---

## 10. 행동 실행 규칙

모든 살아 있는 파티원의 반응을 먼저 확정한 뒤 파티 행동 하나를 결정한다.

### 10-1. 한 명 이상 수용

한 명이라도 `accepted`면 조언은 **한 번 실행**된다.

- 수용한 파티원 중 누가 실제 행동을 하는지는 연출 정보일 뿐 결과를 여러 번 적용하지 않는다.
- E2는 `executed: true`를 반환하고, E3가 즉시형 사건 효과를 파티 전체에 **한 번만** 적용한다.
- 의심한 파티원은 실행에 참여하지 않았지만 파티 전체 결과는 함께 받는다.
- 한 명이 harm을 `exposed`했더라도 다른 한 명이 `accepted`했다면 실행을 취소하지 않는다.

즉 적발은 거부권이 아니다.

### 10-2. 아무도 수용하지 않음

`accepted`가 0명이면 E2는 `executed: false`를 반환하고, E3가 `event.defaultResultText`와 사건의 기본 결과를 사용한다.

E3는 조언 자체의 효과를 적용하지 않는다.

---

## 11. 즉시형 신뢰 검증

신뢰는 조언을 클릭한 순간이 아니라 **결과의 의미가 확인된 뒤** 움직인다.

### 11-1. 한 명 이상 수용해서 실행된 경우

| 반응과 내부 outcome | 결과 뒤 신뢰 행동 |
| --- | --- |
| accepted + help | 수용한 인물에게 `adviceHelped` |
| accepted + harm | 수용한 인물에게 `adviceHarmed` |
| accepted + neutral | 없음 |
| suspected | 없음 |
| exposed + harm | `adviceHarmed` 후 `deceptionExposed` |

`exposed`한 사람이 있어도 다른 사람이 수용해 실행됐다면 파티 전체 사건 결과는 그대로 발생한다.

### 11-2. 아무도 수용하지 않은 경우

기본 결과가 나온 뒤 의심이 옳았는지를 검증한다.

| 선택한 내부 outcome | suspected 인물의 신뢰 행동 |
| --- | --- |
| help | `suspicionWasCostly` |
| harm | `suspicionWasCorrect` |
| neutral | 없음 |

harm을 즉시 `exposed`한 인물은 실행 여부와 무관하게 `adviceHarmed`와 `deceptionExposed`를 받는다.

### 11-3. `deceptionAccepted` 제거

기존 신뢰 규칙의 `deceptionAccepted`는 `방해 조언이 믿어졌다는 이유만으로 결과 전에 신뢰를 올린다`는 옛 정보 카드 흐름의 잔재다.

이번 E2에서는 사용하지 않고 제거한다.

대신 조언 결과용 공통 행동을 신뢰 규칙에 정식으로 둔다.

| 행동 | 의심 많음 | 정의로움 | 탐욕스러움 | 신중함 | 충동적 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `adviceHelped` | +2 | +3 | +2 | +3 | +4 |
| `adviceHarmed` | -4 | -3 | -3 | -4 | -2 |

기존 `deceptionExposed`, `suspicionWasCostly`, `suspicionWasCorrect` 값은 유지한다.

모든 신뢰 행동은 기존 `evaluateTrust()`의 ±20% 난수 변동과 0~100 clamp를 그대로 사용한다. 하나의 사건에서 두 행동이 연속 적용되면 위 표의 순서대로 각각 기록해 플레이어가 원인 사슬을 볼 수 있게 한다.

---

## 12. 보스 지연형 조언

### 12-1. 보스 정보 보장 횟수

| 현재 `riskLevel` | 보스 정보 Depth 수 |
| --- | ---: |
| ★1 | 1 |
| ★2 | 1 |
| ★3 | 2 |
| ★4 | 2 |
| ★5 | 2 |

Depth 수 자체는 `initialRiskLevel`로 만든 E1 지도를 사용하고, 보스 정보 횟수는 현재 `riskLevel`을 따른다.

### 12-2. Depth 예약 구간

보스 정보가 시작 직후 또는 보스 직전에 몰리지 않게 첫 일반 Depth와 마지막 일반 Depth는 예약하지 않는다.

일반 Depth 수를 `N`이라 한다.

1회인 경우:

```text
후반 후보 = floor(N / 2) + 1 ... N - 1
→ 하나 결정적 선택
```

2회인 경우:

```text
전반~중반 후보 = 2 ... floor(N / 2)
후반 후보       = floor(N / 2) + 1 ... N - 1
→ 각 구간에서 하나씩 결정적 선택
```

예:

```text
N = 6, 1회 → D4~D5 중 1곳
N = 7, 2회 → D2~D3 중 1곳 + D4~D6 중 1곳
N = 8, 2회 → D2~D4 중 1곳 + D5~D7 중 1곳
```

슬롯 선택은 `campaignSeed + dungeonId + attempt + currentRiskLevel`과 독립된 event RNG 입력으로 재현한다.

재도전하면 attempt와 현재 위험도가 달라질 수 있으므로 슬롯 위치도 달라질 수 있다.

### 12-3. 모든 경로 보장

E1 지도는 정상 경로가 모든 일반 Depth를 정확히 하나씩 통과한다. 따라서 특정 **Depth**를 보스 정보로 예약하면 어느 갈래를 택해도 그 Depth를 한 번 방문한다.

특정 노드를 공통 지점으로 만들 필요가 없다.

### 12-4. E3 예약 충돌 금지

E3가 `BossInfoDepthPlan`을 입력으로 받을 때 강한 연계 Depth는 그 예약 Depth를 제외해 고른다.

- ★3: 보스 정보 2 + 강한 연계 2 Depth
- ★4: 보스 정보 2 + 강한 연계 2 Depth
- ★5: 보스 정보 2 + 강한 연계 4 Depth

★5의 8 Depth에서도 첫·마지막을 제외한 6개 내부 Depth로 정확히 6개 예약을 수용할 수 있다.

E3의 예약 계획 생성은 합집합에 중복이 있거나 요구 수를 채울 수 없으면 보장 수를 줄이지 않고 `RuleError("INVALID_GENERATION", ...)`를 반환한다. E2는 자신의 보스 정보 예약 수·범위만 검증한다.

### 12-5. 선택 시 반응과 기록

보스 정보도 일반 조언과 같은 확률표로 파티원별 반응을 판정한다.

- accepted: 해당 인물에게 보스 피해 modifier를 지연 기록으로 저장
- suspected: modifier 0으로 지연 검증 기록 저장
- exposed harm: modifier 0, 즉시 `adviceHarmed` + `deceptionExposed`, 결과 기반 지연 검증은 하지 않음

accepted와 suspected의 **결과 기반 신뢰 변화는 선택 시 적용하지 않는다.**

### 12-6. `InfoRecord` 의미 갱신

현재 `InfoRecord`는 지연형 조언 전체를 표현하도록 의미를 넓힌다.

`pendingVerification`은 `보스전 뒤 결과 기반 신뢰 검증이 남아 있는가`를 뜻한다.

- accepted help → `true`
- accepted harm → `true`
- accepted neutral → `false`
- suspected help → `true`
- suspected harm → `true`
- suspected neutral → `false`
- exposed harm → 즉시 처리하므로 `false`

보스 피해 modifier:

| 반응과 outcome | 개인 피해 보정 |
| --- | ---: |
| accepted help | -20% |
| accepted neutral | -10% |
| accepted harm | +25% |
| suspected | 0% |
| exposed | 0% |

합산 상한은 E4가 기존 계약대로 피해 감소 -30%, 피해 증가 +50%를 적용한다.

### 12-7. E4 사후 검증 계약

보스전 뒤 E4는 pending 기록을 다음처럼 신뢰 행동으로 바꾼다.

| 기록 | 전투 뒤 신뢰 행동 |
| --- | --- |
| accepted help | `adviceHelped` |
| accepted harm | `adviceHarmed` |
| suspected help | `suspicionWasCostly` |
| suspected harm | `suspicionWasCorrect` |
| neutral | 없음 |

보스전에서 harm이 실제로 나쁜 결과를 냈다는 사실만으로 `deceptionExposed`를 추가하지 않는다. 적발되지 않은 방해는 파티에게 `고의가 드러난 배신`이 아니라 `틀린 조언`으로 남는다.

---

## 13. 결과 데이터와 UI 경계

E2 내부 결과에는 판정과 후속 시스템을 위해 `outcome`, reaction, delayed record가 필요하다. U5가 그대로 받으면 내부 정답이 새어 나가므로 **내부 결과와 플레이어 피드백을 분리**한다.

개념적으로 다음 두 층을 둔다.

```ts
interface AdviceResolution {
  adviceId: ChoiceId;
  outcome: AdviceOutcome;          // 내부 전용
  reactions: readonly MemberReaction[];
  executed: boolean;
  delayedRecords: readonly InfoRecord[];
  trustChanges: readonly TrustChange[];
}

interface AdviceFeedback {
  selectedAdviceId: ChoiceId;
  reactions: readonly VisibleMemberReaction[];
  resultText: string;
  trustChanges: readonly TrustChange[];
}
```

`AdviceFeedback`에는 `outcome`, `relation`, `source`, 확률, boss modifier를 넣지 않는다.

U5는 세계 안의 결과 문구와 신뢰 변화 이유로 인과를 설명한다.

---

## 14. 오류 처리

다음은 조용히 보정하거나 다시 뽑지 않고 `RuleError("INVALID_GENERATION", ...)`를 반환한다.

- `activeRuleIds`가 정확히 3개가 아님
- 활성 규칙이 던전 테마에 존재하지 않음
- 테마 전용 조언이 비활성 규칙을 참조함
- 조건부 규칙 조언인데 현재 사건에 조건 성립 선언이 없음
- 조건 성립 배열에 존재하지 않거나 비조건부인 규칙이 들어감
- 테마 조언의 `outcome`과 `relation` 계약이 어긋남
- 보스 정보 사건이 현재 보스가 아닌 다른 보스 특징을 참조함
- E2 보스 정보 Depth 예약 수·범위를 만족할 수 없음
- 한 사건의 조언 3개 불변식이 깨짐

플레이 중 살아 있는 파티원이 0명이면 E2의 다음 조언 기회가 아니라 원정 종료 전이가 먼저 일어나야 한다. 그런 상태에서 조언 판정을 호출하면 `INVALID_STATE`다.

E3는 별도로 `BossInfoDepthPlan`과 강한 연계 Depth 계획의 중복·범위·요구 수를 검사한다. 이 교차 계획 오류도 `INVALID_GENERATION`이다.

---

## 15. 검증 전략

### 15-1. 규칙 공개

- 같은 seed + dungeon은 같은 공개 우선순위를 만든다.
- attempt가 바뀌어도 공개 우선순위는 바뀌지 않는다.
- ★1~2는 3개, ★3~4는 2개, ★5는 1개다.
- ★5 공개 집합은 ★3~4 집합의 부분집합이고, ★3~4는 ★1~2의 부분집합이다.
- 재도전으로 위험도가 올라도 `activeRuleIds`는 바뀌지 않는다.

### 15-2. 공개 환경 특성 제거

- `BoardOffer`에 환경 특성 필드가 없다.
- `createBoardOffers()`가 테마의 공개 환경 특성을 조회하지 않는다.
- ThemeContent와 EcologyProfile에 공개 환경 특성 계약이 없다.
- U3 게시판 화면과 테스트가 환경 특성을 요구하지 않는다.

### 15-3. 조건부 규칙

- 활성 + 조건 성립 → 사건 사용 가능.
- 활성 + 조건 불성립 → 사건 후보 제외.
- 비활성 규칙 참조 → 사건 후보 제외 또는 런타임 방어에서 생성 오류.
- 공용 사건과 보스 정보는 생태 조건 검사를 잘못 받지 않는다.
- 잘못된 `satisfiedConditionalRuleIds`는 콘텐츠 검증에서 거부한다.

### 15-4. 조언 순서와 정보 은닉

- 같은 입력은 같은 조언 순서를 만든다.
- 셔플 뒤에도 내부 outcome 3종이 정확히 한 개씩 존재한다.
- 선택 전 presentation 모델에 outcome/relation/source/probability가 없다.
- 선택 후 feedback에도 outcome/relation 정답 라벨이 없다.

### 15-5. 반응 확률

경계값을 포함해 다음을 단위 테스트한다.

- help/neutral accept 5~95 clamp
- harm expose 5~80 clamp
- harm accept 최대 `95 - expose`
- 정의로움의 중립 수용 보정 0
- exposed가 harm에서만 발생
- 같은 인물·같은 입력은 같은 반응
- 한 인물의 추가/제거가 다른 characterId의 RNG 결과를 바꾸지 않음
- C6 캠페인 modifier 0 입력에서 현재 확률표와 동일

### 15-6. 실행과 즉시 신뢰

- 1명 accepted면 1회 실행.
- 2~3명 accepted여도 사건 효과는 한 번만 적용.
- exposed와 accepted가 동시에 있어도 실행.
- accepted 0이면 기본 결과.
- E2는 효과를 적용하지 않고 `executed`만 반환하며, E3는 `executed`인 사건 효과를 한 번만 적용.
- `executed === false`면 E3가 조언 효과 없이 기본 결과만 적용.
- accepted help → 수용자에게만 `adviceHelped`.
- accepted harm → 수용자에게만 `adviceHarmed`.
- executed 상태의 suspected는 즉시 신뢰 변화 없음.
- 전원 미수용 help → suspected에 `suspicionWasCostly`.
- 전원 미수용 harm → suspected에 `suspicionWasCorrect`.
- exposed harm → `adviceHarmed` + `deceptionExposed`.
- neutral은 조언 결과 자체로 신뢰를 바꾸지 않음.

### 15-7. 보스 정보 Depth

- ★1~2는 예약 1개, ★3~5는 2개.
- 첫·마지막 일반 Depth를 예약하지 않음.
- 2개 예약은 서로 다른 전반/후반 구간에 있음.
- 동일 입력은 동일 슬롯.
- attempt가 달라지면 새 슬롯을 선택할 수 있음.
- 모든 Entry→Boss 경로가 예약 Depth를 정확히 횟수만큼 통과함.
- E3 계획 생성은 E2 예약을 입력으로 받아 강한 연계 예약과 겹치지 않음.
- 두 계획을 합쳐 요구 수 또는 내부 Depth 범위를 만족하지 못하면 E3가 `INVALID_GENERATION`.

### 15-8. 지연 검증

- accepted help/harm과 suspected help/harm만 `pendingVerification`.
- accepted neutral은 modifier만 적용하고 신뢰 검증 없음.
- exposed harm은 즉시 처리되고 보스전에서 중복 신뢰 처리하지 않음.
- E4가 accepted help/harm을 `adviceHelped/adviceHarmed`로 검증.
- E4가 suspected help/harm을 `suspicionWasCostly/Correct`로 검증.
- accepted harm이 자동으로 `deceptionExposed`가 되지 않음.

---

## 16. 공식 문서 정합화

E2 구현과 같은 변경 단위에서 다음 공식 문서를 갱신한다.

### `docs/GAME_PRINCIPLES.md`

- 게시판에서 답사 생태 규칙을 보여준다는 표현 제거.
- `정보 카드의 진위` 같은 옛 카드 용어를 조언 내부 유형으로 정리.
- 내부 조언 유형은 선택 전후 직접 공개하지 않는다는 원칙 명시.

### `docs/design/GAME_OVERVIEW.md`

- 직접 `아이템 사용` 표현 제거. 상인 사건의 골드 개입만 유지.
- 생태 추론은 던전 진입 뒤 시작한다고 정리.

### `docs/design/CORE_GAME_LOOP.md`

- 게시판·계약의 공개 환경 특성과 답사 규칙 표시 제거.
- E2 3/2/1 공개를 원정 시작 규칙으로 추가.
- 일반 사건 ID 물질화는 E3 책임으로 정리.

### `docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md`

- 공개 환경 특성 섹션과 데이터 계약 제거.
- 활성 규칙은 C1 생태 패키지가 확정하고 E2는 소비한다고 명확히 함.
- `규칙별 중립 2개`라는 오래된 표현을 제거하고, 규칙별 help/harm + 테마 전체 neutral 공급 계약으로 통일.
- 조건부 규칙의 사건별 조건 성립 계약 추가.

### `docs/systems/INFORMATION_AND_DECEPTION.md`

- 이번 설계의 E2 규칙을 기준 문서로 반영.
- `단서 목록을 상시 표시하지 않는다` 규칙 폐기.
- 선택 뒤 정합·모순 정답을 직접 보여준다는 표현 폐기.
- 즉시/지연 신뢰 검증 시점과 `deceptionAccepted` 제거 반영.

### `docs/systems/CHARACTERS_AND_TRUST.md`

- `adviceHelped`, `adviceHarmed`를 실제 `TRUST_ACTIONS` 계약과 일치시킴.
- `deceptionAccepted` 제거.
- `카드 수용`, `거짓 적발` 같은 옛 용어를 `조언 수용`, `방해 적발`로 정리.

### `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`

- 공개 정보에서 환경 특성 제거.
- 3/2/1 공개와 재도전 부분집합 규칙 반영.
- 보스 정보 Depth는 E2가 예약하고 실제 사건 ID는 E3가 방문 시 선택한다고 책임 분리.
- 일반 사건 전체의 실제 물질화는 E3로 둠.

### `docs/experience/SCREEN_LAYOUT.md`

- 게시판의 환경 특성 표시 제거.
- 진행 하단을 `행동 / 조언`과 `진행 기록`으로 전환 가능한 플레이어 콘솔로 갱신.
- 공개 생태와 관찰 단서를 같은 진행 화면에서 다시 확인 가능하게 함.

### `docs/experience/ONBOARDING_AND_INTERFACE.md`

- 게시판 환경 특성 제거.
- 선택 뒤 활성 규칙 정합·모순을 정답처럼 공개한다는 표현 제거.
- 결과·반응·신뢰 이유로 학습하게 하는 피드백으로 교체.

### `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

- C2·U3 완료 기준에서 공개 환경 특성 제거.
- E2 완료 기준을 `C1 activeRuleIds 소비 + 3/2/1 공개 + 조건부 규칙 + 독립 반응 + 실행 + 보스 Depth 계획`으로 갱신.
- E3는 E2의 보스 정보 예약 Depth를 소비하고 충돌을 피하도록 직접 선행 관계를 반영.
- U5 완료 기준에 진행 기록/생태·단서 확인과 내부 유형 비공개를 반영.

`docs/superpowers/specs/2026-08-19-lattebun-campaign-rework-design.md`는 내용을 현재 값으로 계속 덮어쓰는 대신, 최신 공식 문서와 후속 E1/E2 설계로 대체되었다는 상태 문구를 추가해 역사적 설계라는 점을 분명히 한다.

---

## 17. 완료 기준

E2는 다음이 모두 성립할 때 완료다.

1. C1의 활성 규칙 3개를 재추첨하지 않고 사용한다.
2. 현재 위험도로 3/2/1개를 결정적으로 공개하며 위험도 상승 시 부분집합이 유지된다.
3. 게시판 공개 환경 특성 계약이 도메인·콘텐츠·C2·U3에서 제거된다.
4. 조건부 규칙은 사건의 명시적 조건 성립 데이터가 있을 때만 조언 근거가 된다.
5. 조언 3개가 결정적으로 셔플되고 내부 유형·관계·확률이 UI 계약에서 제거된다.
6. 살아 있는 파티원별 수용·의심·적발 확률표와 clamp가 동작한다.
7. 한 명이라도 수용하면 E2가 한 번 실행할 결정을 반환하고 E3가 효과를 한 번 적용하며, 아무도 수용하지 않으면 E3가 기본 결과를 사용한다.
8. 즉시형 결과 뒤 신뢰 행동이 이 설계의 인과 순서대로 적용된다.
9. `adviceHelped/adviceHarmed`가 실제 신뢰 규칙에 존재하고 `deceptionAccepted`가 E2 흐름에서 제거된다.
10. 보스 정보 Depth가 ★1~2 1회, ★3~5 2회 보장되고 E3 강한 연계 예약과 충돌하지 않는다.
11. 보스 지연 기록이 E4에서 결과 기반으로 검증할 수 있는 계약을 가진다.
12. 원정 중 공개 생태와 관찰 단서를 다시 볼 수 있는 U5 입력 계약이 있고 숨은 규칙을 자동 공개하지 않는다.
13. 같은 시드·상태·선택에서 공개 규칙, 조언 순서, 파티 반응이 재현된다.
14. 잘못된 생성 계약은 조용히 재추첨하지 않고 `RuleError`로 실패한다.
15. 관련 공식 문서와 작업 배정표가 같은 변경 단위에서 최신 규칙으로 정리된다.

---

## 관련 문서

- [게임 원칙](../../GAME_PRINCIPLES.md)
- [핵심 게임 루프](../../design/CORE_GAME_LOOP.md)
- [캐릭터와 신뢰](../../systems/CHARACTERS_AND_TRUST.md)
- [정보와 기만](../../systems/INFORMATION_AND_DECEPTION.md)
- [던전 테마와 생태](../../systems/DUNGEON_THEMES_AND_ECOLOGY.md)
- [던전 이벤트와 보스](../../systems/DUNGEON_EVENTS_AND_BOSSES.md)
- [화면 규격](../../experience/SCREEN_LAYOUT.md)
- [온보딩과 인터페이스](../../experience/ONBOARDING_AND_INTERFACE.md)
- [캠페인 개편 작업 배정표](../../technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)
- [E1 위험도별 지도 생성 설계](2026-08-22-lattebun-e1-risk-map-generation-design.md)
