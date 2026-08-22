# E3 사건 물질화 설계 2차 정정

## 이 문서의 지위

이 문서는 다음 두 E3 설계 문서를 코드베이스 대조 검토 결과에 맞춰 추가 정정한다.

- [`2026-08-22-lattebun-e3-event-materialization-design.md`](2026-08-22-lattebun-e3-event-materialization-design.md)
- [`2026-08-22-lattebun-e3-event-materialization-correction-design.md`](2026-08-22-lattebun-e3-event-materialization-correction-design.md)

세 문서가 충돌하면 **이 2차 정정 문서가 최우선**이다. 충돌하지 않는 기존 계약은 그대로 유지한다.

이번 정정은 두 문제를 해결한다.

1. 모든 EcologyProfile에 strong-link capacity 정적 검증을 적용할 때 현재 shipped 콘텐츠 중 3개 profile이 요구 수를 충족하지 못하는 문제
2. strong predecessor/follower에 필요한 공개 category를 순수 weighted random에 맡기면 유효한 콘텐츠에서도 특정 seed가 우연히 `INVALID_GENERATION`이 될 수 있는 문제

---

## 1. 추가 확인된 strong-link capacity 부족

1차 정정은 ★5 `graveyard-blighted-tomb`만 수정했지만, 모든 EcologyProfile을 검사하면 다음 세 profile도 현재 요구 수를 만족하지 못한다.

| EcologyProfile | 초기 위험도 | 필요한 strong 수 | 현재 가능한 수 | 원인 |
| --- | ---: | ---: | ---: | --- |
| `desert-burning-waste` | ★4 | 1 | 0 | 활성 규칙이 lizard/spirit/wind이고 기존 strong 쌍은 water 또는 mummy 기반 |
| `graveyard-grave-robber` | ★3 | 1 | 0 | mage strong에 필요한 `graveyard-light`가 없고 archer strong의 조건부 규칙도 없음 |
| `graveyard-hunters` | ★4 | 1 | 0 | archer predecessor는 가능하지만 follower에 필요한 `graveyard-desecration`이 없고 mage strong의 `graveyard-light`도 없음 |

이 세 profile은 정상 shipped 콘텐츠이므로, capacity 검증을 완화하지 않고 profile 데이터를 strong-link 계약과 일치시킨다.

---

## 2. 확정 수정: `desert-burning-waste`

### 기존

```ts
ecologyProfile(
  "desert",
  "desert-burning-waste",
  4,
  [
    "desert-lizard-heat",
    "desert-spirit-dry",
    "desert-wind-track",
  ],
  [
    "desert-lizard",
    "desert-spirit",
  ],
)
```

### 변경 후

```ts
ecologyProfile(
  "desert",
  "desert-burning-waste",
  4,
  [
    "desert-spirit-dry",
    "desert-mummy-silent",
    "desert-wind-track",
  ],
  [
    "desert-spirit",
    "desert-mummy",
  ],
)
```

### 이유

기존 `clue-desert-mummy-no-tracks` strong pair는 predecessor에서 `desert-mummy-silent`, follower에서 `desert-mummy-silent + desert-wind-track`을 사용한다.

따라서 변경 후 이 pair가 `isEventEligible()`를 통과하고 `desert-mummy`도 `activeMonsterIds`에 존재한다.

동시에 ★4 profile에는 조건부 규칙이 최소 하나 있어야 한다는 기존 theme validator를 유지하기 위해 `desert-spirit-dry`를 남긴다.

즉 strong-link를 살리기 위해 고위험도 조건부 규칙 계약을 깨지 않는다.

---

## 3. 확정 수정: `graveyard-grave-robber`

### 기존

```ts
ecologyProfile(
  "graveyard",
  "graveyard-grave-robber",
  3,
  [
    "graveyard-silence",
    "graveyard-guard",
    "graveyard-desecration",
  ],
  [
    "graveyard-zombie",
    "graveyard-soldier",
  ],
)
```

### 변경 후

```ts
ecologyProfile(
  "graveyard",
  "graveyard-grave-robber",
  3,
  [
    "graveyard-light",
    "graveyard-guard",
    "graveyard-desecration",
  ],
  [
    "graveyard-mage",
    "graveyard-soldier",
  ],
)
```

### 이유

★3 이하 EcologyProfile에는 조건부 규칙을 넣지 않는 기존 validator 계약이 있다.

따라서 조건부 `graveyard-archer-light` 기반 archer strong pair를 억지로 활성화하지 않고, 비조건부 `graveyard-light`만 요구하는 `clue-graveyard-mage-light` strong pair를 사용할 수 있도록 한다.

`graveyard-light`, `graveyard-guard`, `graveyard-desecration`은 모두 비조건부이므로 기존 저위험도 validator도 유지한다.

---

## 4. 확정 수정: `graveyard-hunters`

### 기존

```ts
ecologyProfile(
  "graveyard",
  "graveyard-hunters",
  4,
  [
    "graveyard-ghoul-sound",
    "graveyard-archer-light",
    "graveyard-guard",
  ],
  [
    "graveyard-ghoul",
    "graveyard-archer",
    "graveyard-soldier",
  ],
)
```

### 변경 후

```ts
ecologyProfile(
  "graveyard",
  "graveyard-hunters",
  4,
  [
    "graveyard-archer-light",
    "graveyard-guard",
    "graveyard-desecration",
  ],
  [
    "graveyard-archer",
    "graveyard-soldier",
  ],
)
```

### 이유

`clue-graveyard-archer-shadow` strong pair는 predecessor에서 `graveyard-archer-light`, follower에서 `graveyard-archer-light + graveyard-desecration`을 사용한다.

변경 후 pair 전체가 `isEventEligible()`를 통과하고 `graveyard-archer`도 활성 몬스터에 포함된다.

또한 `graveyard-archer-light`가 조건부 규칙이므로 ★4 이상의 profile은 조건부 규칙을 최소 하나 가져야 한다는 기존 validator도 만족한다.

---

## 5. ★5 묘지 수정은 1차 정정대로 유지

`graveyard-blighted-tomb`은 1차 정정의 변경을 그대로 적용한다.

```ts
ecologyProfile(
  "graveyard",
  "graveyard-blighted-tomb",
  5,
  [
    "graveyard-light",
    "graveyard-archer-light",
    "graveyard-desecration",
  ],
  [
    "graveyard-mage",
    "graveyard-archer",
  ],
)
```

이 profile에서는 서로 다른 두 strong ClueId를 사용할 수 있어야 한다.

- `clue-graveyard-mage-light`
- `clue-graveyard-archer-shadow`

★5 요구 수 `2`를 같은 ClueId 중복으로 채우는 것은 계속 금지한다.

---

## 6. profile capacity 정적 검증 최종 계약

모든 shipped EcologyProfile을 대상으로 다음을 검증한다.

```text
initialRiskLevel ★1~2
→ eligible strong ClueId >= 0

initialRiskLevel ★3~4
→ 서로 다른 eligible strong ClueId >= 1

initialRiskLevel ★5
→ 서로 다른 eligible strong ClueId >= 2
```

eligible strong set은 1차 정정의 정의를 유지한다.

- predecessor 후보 존재
- follower 후보 존재
- 양쪽 모두 `isEventEligible()` 통과
- monster event의 base/add enemy가 profile `activeMonsterIds`에 포함

이 검증은 `lib/content/themes.ts`의 shipped profile과 실제 event content를 함께 사용해야 한다. 단순히 theme 안에 `revealsClue/requiresClue` 문자열이 존재하는지만 세면 안 된다.

E3 구현 PR에서는 위 네 profile 수정과 capacity 테스트를 **같은 task**로 처리한다.

---

## 7. strong-link category는 랜덤 성공에 맡기지 않는다

### 7-1. 문제

현재 strong predecessor/follower 콘텐츠는 모두 `monster`지만, 설계상 strong event의 kind는 데이터가 소유한다.

원본의 base category 생성만 먼저 실행하면 다음과 같은 문제가 생길 수 있다.

```text
유효한 strong 콘텐츠 존재
+ 유효한 지도 존재
+ 우연히 monster category가 필요한 위치에 없음
→ strong plan 실패
→ INVALID_GENERATION
```

이 실패는 콘텐츠나 그래프가 잘못된 것이 아니라 순수 category RNG 결과 때문에 발생한다.

**정상 shipped 콘텐츠와 유효한 E1 지도에서는 category RNG 운만으로 원정 생성이 실패해서는 안 된다.**

---

## 8. category 생성 순서 정정

원정 준비의 category/role 계획은 다음 순서로 수행한다.

```text
1. 현재 EcologyProfile에서 사용할 strong ClueId 세트 선택
2. bossInfo cut의 구조적 위치 후보 계산
3. strong predecessor node와 최소 1개의 미래 follower-compatible node 구조 슬롯 확보
4. 예약 슬롯에 필요한 공개 category를 최초 할당
5. bossInfo cut을 special category로 최초 할당 또는 필요한 노드만 special로 확정
6. 아직 category가 없는 나머지 일반 노드만 40/20/15/25 weighted random + soft correction으로 채움
7. 전체 capacity / role / exact-once / 도달성 preflight
8. 지도 공개
```

중요한 점은 3~5단계가 **이미 생성된 category를 사후 변경하는 과정이 아니라 최초 category assignment의 일부**라는 것이다.

따라서 원본의 다음 원칙은 그대로 유지한다.

> 플레이어에게 지도가 공개된 뒤에는 공개 category를 어떤 이유로도 변경하지 않는다.

---

## 9. strong 구조 슬롯의 의미

strong link 하나를 준비할 때 EventId는 여전히 예약하지 않는다.

원정 시작 전에 정하는 것은 다음뿐이다.

```ts
interface StrongLinkPlan {
  readonly clueId: ClueId;
  readonly predecessorNodeId: NodeId;
  readonly predecessorCategory: EventKind;
  readonly followerCandidateNodeIds: readonly NodeId[];
  readonly followerCategory: EventKind;
}
```

구체 타입명은 구현에서 조정할 수 있다.

### predecessor

- 선택한 strong clue의 eligible predecessor event들이 공유하는 필요한 `kind`를 사용한다.
- predecessor node는 그 category로 최초 할당한다.
- bossInfo cut이나 다른 strong 역할과 겹치지 않는다.

### follower candidate

- predecessor 방문 뒤 도달 가능한 미래 노드 중 최소 하나를 구조적으로 확보한다.
- 해당 노드는 follower event의 필요한 category로 최초 할당한다.
- follower EventId 자체는 아직 정하지 않는다.

현재 shipped strong pair는 predecessor/follower 모두 `monster`이므로 실제 1차 구현에서는 `monster` 슬롯으로 나타난다.

---

## 10. follower 활성화와 후보 슬롯

기존 합의였던 **“선행을 실제 방문한 뒤 후속 기회를 활성화한다”**는 유지한다.

다만 category 보장 때문에 원정 시작 시 follower-compatible 구조 후보를 최소 하나 준비한다.

흐름은 다음과 같다.

```text
원정 준비
→ follower-compatible category node 후보 확보
→ 아직 strongFollower 역할은 비활성

predecessor를 실제 방문
→ clue 획득
→ 현재 위치에서 이후 도달 가능한 사전 확보 후보 중 하나를 결정적으로 선택
→ 그 노드만 active strongFollower 역할로 승격

플레이어가 해당 노드를 지나치지 않고 방문
→ matching requiresClue EventId를 방문 시 물질화
```

후속 역할 활성 전까지 후보 노드는 지도에서는 평범한 같은 category 노드로 보인다.

### 후보가 여러 개일 때

여러 follower-compatible 후보를 미리 둘 수 있다. predecessor 방문 시 그중 현재 위치에서 도달 가능한 후보 하나를 deterministic RNG로 선택한다.

선택 후에는 기존 계약대로 재배치하지 않는다.

- 선택된 follower node를 플레이어가 지나치면 strong link는 `missed`
- 다른 후보로 옮기지 않음

### predecessor를 방문하지 않았을 때

follower 후보는 strongFollower로 활성화되지 않는다.

그 노드를 방문하면 해당 category의 **normal pool 사건**을 방문 시 물질화한다.

따라서 방문하지 않은 predecessor 때문에 EventId가 소비되거나 strong follower 사건이 억지로 등장하지 않는다.

---

## 11. category 예약과 weighted random의 관계

기본 가중치 계약은 그대로다.

```text
monster  40
rest     20
merchant 15
special  25
```

하지만 이 비율은 **하드 예약 슬롯을 제외한 나머지 노드의 기본 분포 목표**다.

예약 슬롯은 다음 하드 요구를 먼저 만족한다.

- bossInfo exact-once cut의 `special`
- strong predecessor에 필요한 category
- follower-compatible future opportunity에 필요한 category

그 뒤 남은 노드가 weighted random + soft correction을 사용한다.

이 때문에 전체 원정의 실제 category 비율이 정확히 40/20/15/25일 필요는 없다.

soft correction의 global dominance 계산은 이미 예약된 category도 현재 분포에 포함해, 남은 랜덤 노드가 과도한 편중을 완화하도록 한다.

---

## 12. 예약 충돌과 선택 우선순위

하드 예약 역할끼리는 같은 노드를 공유하지 않는다.

금지:

```text
bossInfo + strongPredecessor
bossInfo + strongFollowerCandidate
strong set A predecessor + strong set B predecessor
strong set A follower candidate + strong set B reserved role
```

★5 두 strong set은 서로 다른 ClueId를 사용하고 최소한의 필요한 구조 슬롯도 서로 독립적으로 확보한다.

예약 위치 선택의 목표 우선순위는 다음과 같다.

1. 모든 계약을 만족하는가
2. bossInfo exact-once 보장을 만족하는가
3. strong predecessor 뒤에 follower-compatible 미래 노드가 존재하는가
4. 예약 역할끼리 노드가 겹치지 않는가
5. 기존 weighted distribution을 덜 왜곡하는가
6. 동률이면 attempt 전용 RNG로 결정

1~4는 하드 조건이고 5는 최적화 조건이다.

유효한 배치가 정말 존재하지 않을 때만 `INVALID_GENERATION`이다. 단순히 첫 랜덤 category 결과가 나빴다는 이유로 실패하지 않는다.

---

## 13. preflight 보강

attempt preflight는 이제 다음을 구분해서 검사한다.

### 구조 보장

- 요구 strong set 수만큼 predecessor 구조 슬롯 존재
- 각 predecessor 뒤에 follower-compatible category 후보 최소 1개 존재
- bossInfo cut과 strong 예약이 충돌하지 않음
- ★5 strong 두 세트가 서로 다른 ClueId와 독립 역할 슬롯을 가짐

### 콘텐츠 보장

- planned clue의 predecessor/follower EventId 후보가 현재 profile에서 실제 eligible
- monster event가 `activeMonsterIds`를 위반하지 않음
- 각 실제 경로의 normal EventId capacity가 충분함

### 결정성

동일한 `campaignSeed + dungeonId + attempt + map + profile`이면 다음이 동일해야 한다.

- selected strong ClueId
- predecessor node
- follower-compatible candidate node 집합
- 최초 공개 category map
- predecessor 방문 뒤 실제 활성 follower node

---

## 14. 테스트 추가

E3 구현 Plan은 최소 다음 테스트를 포함한다.

### EcologyProfile capacity

- `desert-burning-waste`가 ★4 strong >= 1을 만족
- `graveyard-grave-robber`가 ★3 strong >= 1을 만족
- `graveyard-hunters`가 ★4 strong >= 1을 만족
- `graveyard-blighted-tomb`가 서로 다른 strong ClueId >= 2를 만족
- 모든 shipped EcologyProfile을 순회해 위험도별 최소 strong 수 검증
- ★3 이하 profile에 조건부 규칙이 생기지 않음
- ★4 이상 profile에 조건부 규칙이 최소 1개 유지됨

### category 구조 예약

- strong 요구가 있는 원정에서 predecessor category가 반드시 확보됨
- predecessor 뒤에 follower-compatible category 노드가 최소 하나 확보됨
- 하드 예약 뒤 남은 노드만 weighted random으로 채워짐
- 지도 공개 후 category가 변경되지 않음
- predecessor 미방문 시 follower 후보가 normal event로 사용 가능
- predecessor 방문 시 사전 후보 중 도달 가능한 하나만 follower로 활성화
- 선택된 follower를 지나치면 다른 후보로 재배치하지 않음
- 여러 seed를 반복해도 **category RNG 부족만을 이유로** 정상 shipped profile이 `INVALID_GENERATION` 되지 않음

### role 충돌

- bossInfo와 strong 예약이 같은 노드를 쓰지 않음
- ★5의 두 strong set이 역할 노드를 공유하지 않음
- 실제로 구조 배치가 불가능한 합성 map에서는 `INVALID_GENERATION`

---

## 15. E3 Plan 반영 체크리스트

Plan 작성 전에 다음 네 profile 변경을 하나의 콘텐츠 정합성 task로 포함한다.

```text
desert-burning-waste
graveyard-grave-robber
graveyard-hunters
graveyard-blighted-tomb
```

그리고 category generation task는 다음 두 단계를 분리해 적는다.

```text
A. hard structural reservation
   - bossInfo
   - strong predecessor
   - follower-compatible opportunity

B. weighted fill
   - 아직 미지정인 나머지 노드
   - 40/20/15/25 + soft correction
```

EventId materialization은 이 변경과 무관하게 **방문 순간**에만 수행한다.

예약되는 것은 `role/category/node opportunity`이며 EventId가 아니다.

이 계약까지 반영한 뒤에야 E3 구현 Plan을 작성한다.
