# E3 사건 물질화 설계 정정

## 이 문서의 지위

이 문서는 [`2026-08-22-lattebun-e3-event-materialization-design.md`](2026-08-22-lattebun-e3-event-materialization-design.md)의 코드베이스 대조 검토에서 발견된 **구현 불가능 계약과 모호한 Encounter 계약을 정정**한다.

원본 E3 Spec과 이 문서가 충돌하면 **이 문서가 우선한다.** 나머지 원본 계약은 그대로 유지한다.

이 정정은 구현 Plan 작성 전에 반드시 반영해야 한다.

---

## 1. 정정 배경: 초기 ★5 묘지 강한 연계 용량 부족

원본 E3 Spec은 초기 위험도별 strong-link opportunity를 다음처럼 하드 보장한다.

| 초기 위험도 | 강한 연계 기회 |
| --- | ---: |
| ★1~2 | 0 |
| ★3~4 | 1 |
| ★5 | 2 |

★5에서는 **서로 다른 `ClueId` 2개**를 준비해야 하며, 요구 수를 줄이는 fallback은 허용하지 않는다.

현재 ★5 묘지 EcologyProfile `graveyard-blighted-tomb`은 다음 활성 규칙과 몬스터를 사용한다.

```text
activeRuleIds
- graveyard-ghoul-sound
- graveyard-archer-light
- graveyard-desecration

activeMonsterIds
- graveyard-ghoul
- graveyard-archer
```

현재 묘지 strong-link 후보는 최소 다음 두 세트다.

```text
clue-graveyard-mage-light
- predecessor: graveyard-light 기반
- follower:    graveyard-light 기반
- 등장 몬스터: graveyard-mage

clue-graveyard-archer-shadow
- predecessor: graveyard-archer-light 기반
- follower:    graveyard-archer-light + graveyard-desecration 기반
- 등장 몬스터: graveyard-archer
```

따라서 현재 ★5 profile에서는 `clue-graveyard-mage-light` 세트가 `isEventEligible()`와 `activeMonsterIds` 조건을 통과할 수 없고, 서로 다른 strong ClueId 2개 보장이 성립하지 않는다.

원본 Spec의 `요구 수 부족 → INVALID_GENERATION` 계약을 그대로 구현하면 ★5 묘지 던전은 정상 콘텐츠에서도 생성 실패한다.

---

## 2. 확정 수정: ★5 묘지 EcologyProfile 교체

새 strong-link 콘텐츠를 추가하는 대신 기존 두 연계 세트를 모두 사용할 수 있도록 `graveyard-blighted-tomb`의 생태 패키지를 수정한다.

### 기존

```ts
ecologyProfile(
  "graveyard",
  "graveyard-blighted-tomb",
  5,
  [
    "graveyard-ghoul-sound",
    "graveyard-archer-light",
    "graveyard-desecration",
  ],
  [
    "graveyard-ghoul",
    "graveyard-archer",
  ],
)
```

### 변경 후

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

즉 다음을 교체한다.

```text
graveyard-ghoul-sound → graveyard-light
graveyard-ghoul       → graveyard-mage
```

`graveyard-archer-light`와 `graveyard-desecration`, `graveyard-archer`는 유지한다.

### 설계 의미

이 변경은 단순한 validator 회피가 아니다.

★5 묘지에서는 다음 세 규칙을 동시에 추론하게 된다.

- 해골 마법사는 빛을 향해 다가온다.
- 스켈레톤 궁수는 빛에 노출되면 그림자로 숨는다.
- 매장물을 훔치면 수호자가 더 사납게 반응한다.

같은 `빛`이라는 환경 정보에 몬스터 종류별로 반대 반응이 존재해 고위험 던전의 추론 난이도와도 맞는다.

### 필요한 수정 위치

E3 구현 PR은 최소 다음을 함께 수정한다.

- `lib/content/themes.ts`
- 해당 profile을 검증하는 theme/content 테스트
- 필요하면 `docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md`의 profile 예시 또는 활성 규칙 설명

---

## 3. Strong-link capacity는 모든 EcologyProfile을 기준으로 검증한다

원본 Spec 14절의 preflight는 단순히 테마 전체에 strong predecessor/follower가 존재하는지만 확인해서는 안 된다.

**각 EcologyProfile이 자기 `activeRuleIds`와 `activeMonsterIds`를 적용한 뒤에도 초기 위험도에서 요구되는 strong-link 수를 만족하는지** 정적으로 검증해야 한다.

### 3-1. 필요한 strong clue 수

각 profile에서 실제 E2 eligibility와 monster compatibility를 통과하는 strong clue를 센다.

```text
initialRiskLevel ★1~2
→ 0개 이상

initialRiskLevel ★3~4
→ 서로 다른 eligible strong ClueId >= 1

initialRiskLevel ★5
→ 서로 다른 eligible strong ClueId >= 2
```

★5의 두 세트는 동일한 ClueId를 두 번 세어 충족할 수 없다.

### 3-2. eligible strong set의 정의

`clueId` 하나가 현재 EcologyProfile에서 usable strong set이 되려면 최소 다음을 모두 만족해야 한다.

1. `revealsClue === clueId`인 predecessor 후보가 1개 이상 있다.
2. `requiresClue === clueId`인 follower 후보가 1개 이상 있다.
3. predecessor와 follower 모두 현재 던전에서 E2 `isEventEligible()`를 통과한다.
4. monster 사건이면 base Encounter와 가능한 add-enemy가 모두 profile의 `activeMonsterIds` 안에 있다.
5. predecessor와 follower의 공개 category를 실제 지도에 배치할 수 있다.

5번의 그래프/노드 도달성은 attempt 준비 validator가 검증하고, 1~4번의 **콘텐츠 공급 가능성은 theme/content 정적 테스트**에서도 잡는다.

### 3-3. 실패 정책

정상 shipped EcologyProfile이 위 용량 계약을 만족하지 않으면 테스트 실패다.

런타임에서 외부/손상 콘텐츠가 같은 문제를 만들면 기존 원본 계약대로:

```text
RuleError("INVALID_GENERATION", ...)
```

을 반환한다.

요구 strong-link 수를 2→1처럼 조용히 줄이지 않는다.

---

## 4. EncounterDefinition의 MonsterId 유일성

원본 Spec의 다음 타입만으로는 같은 `MonsterId`가 여러 group에 반복될 수 있고 add/remove가 어느 group에 적용되는지 모호하다.

```ts
interface EncounterEnemyGroup {
  readonly monsterId: MonsterId;
  readonly count: number;
}
```

이를 다음 계약으로 보강한다.

> **한 `EncounterDefinition` 안에서 `MonsterId`는 정확히 한 group에만 등장할 수 있다.**

### 허용

```ts
enemies: [
  { monsterId: "graveyard-mage", count: 2 },
  { monsterId: "graveyard-archer", count: 1 },
]
```

### 금지

```ts
enemies: [
  { monsterId: "graveyard-mage", count: 1 },
  { monsterId: "graveyard-mage", count: 2 },
]
```

중복 MonsterId는 validator에서 콘텐츠 오류로 거부한다. 런타임에서 임의 병합해 조용히 복구하지 않는다.

`addEnemies`와 `removeEnemies` 배열 내부에서도 각각 MonsterId는 한 번만 선언할 수 있다.

같은 modifier에서 동일 MonsterId를 `addEnemies`와 `removeEnemies` 양쪽에 동시에 선언하는 기존 금지 규칙은 유지한다.

---

## 5. add/remove 적용 순서와 그룹 순서

Encounter modifier는 개념적으로 `MonsterId → count`를 수정하지만, 실제 전투의 적 순서는 콘텐츠가 예측 가능해야 한다.

다음 순서로 적용한다.

### 5-1. remove

먼저 `removeEnemies`를 적용한다.

```text
currentCount -= removeCount
```

- 대상 MonsterId가 base Encounter에 없으면 `INVALID_GENERATION`
- `removeCount > currentCount`면 `INVALID_GENERATION`
- 결과가 `0`이면 해당 group을 Encounter에서 제거한다.
- 양수면 원래 group 위치에서 count만 감소한다.

### 5-2. add

그 다음 `addEnemies`를 적용한다.

- 이미 남아 있는 MonsterId면 기존 group 위치에서 count를 증가시킨다.
- 현재 Encounter에 없는 MonsterId면 `addEnemies` 선언 순서대로 Encounter **뒤쪽에 새 group**을 추가한다.

따라서 modifier 적용 뒤에도 Encounter당 MonsterId 유일성이 유지된다.

### 5-3. avoidCombat

`avoidCombat: true`면 add/remove/multiplier와 함께 사용할 수 없다는 원본 계약을 유지한다.

BattleEngine은 실행되지 않으며 merchant `pendingNextBattleEffect`도 소비하지 않는다.

---

## 6. Encounter의 전투 instance 생성

Encounter group은 콘텐츠 표현이고 BattleEngine에서는 개별 적 instance로 펼친다.

예:

```ts
[
  { monsterId: "graveyard-mage", count: 2 },
  { monsterId: "graveyard-archer", count: 1 },
]
```

은 안정적으로 다음 순서의 combatant가 된다.

```text
graveyard-mage#1
graveyard-mage#2
graveyard-archer#1
```

instance 번호는 최종 Encounter group 순서와 각 group 내부 index로 정한다.

용사는 원본 Spec대로 이 **최종 instance 순서에서 가장 앞의 살아 있는 적**을 집중 공격한다.

동일 입력에서 modifier 적용 결과와 instance 순서가 항상 같아야 한다.

---

## 7. 원정 preflight와 런타임 검증의 역할 분리

### 콘텐츠 정적 검증

다음을 코드 리뷰나 특정 seed 실행에 맡기지 않고 테스트한다.

- 모든 EcologyProfile의 strong clue 공급 용량
- Encounter base group의 MonsterId 중복 없음
- add/remove 각 배열 내부 MonsterId 중복 없음
- 같은 modifier에서 add/remove 동일 MonsterId 중복 없음
- base/add monster가 해당 사건의 가능한 theme/profile과 구조적으로 호환됨

### attempt preflight

실제 던전/profile/map가 정해진 뒤 다음을 검증한다.

- 현재 profile에서 요구 strong clue 수를 실제로 선택 가능
- 각 planned predecessor 뒤에 category-compatible follower opportunity가 최소 1개 존재
- bossInfo cut/strong role 충돌 없음
- 실제 경로에서 EventId 용량 부족이 생기지 않음

### 방문 시 방어 검증

준비 validator가 놓친 손상 상태가 들어와도 다음을 조용히 복구하지 않는다.

- 후보 EventId 0개
- activeMonsterIds 밖의 enemy
- Encounter MonsterId 중복
- remove underflow
- role 충돌

모두 `INVALID_GENERATION`으로 실패한다.

---

## 8. E3 Plan에 반드시 포함할 문서 정합성 작업

코드베이스 대조 당시 아래 활성 문서/주석에는 아직 E2 Depth 예약 또는 구 event-category 계약이 남아 있다.

E3 구현 Plan에서 별도 task로 누락하지 않는다.

- `docs/design/CORE_GAME_LOOP.md`
- `docs/systems/INFORMATION_AND_DECEPTION.md`
- `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- `lib/domain/content.ts`의 `EventKind` 주석
- 이벤트/콘텐츠 공급 validator의 `모든 경로 네 분류` 구계약 주석 또는 테스트

특히 다음 문구/타입을 검색해 잔존 여부를 확인한다.

```text
BossInfoDepthPlan
planBossInfoDepths
보스 정보 Depth
강한 연계 Depth
모든 가능한 실제 경로에는 네 분류
모든 경로에 각각 한 번 이상
```

원본 E3 Spec 16절의 Superseded / Required Changes는 이 정정 이후에도 유효하다.

---

## 9. 기존 테스트 기준선 처리

코드베이스 검토 당시:

- `pnpm typecheck`는 통과했다.
- 전체 테스트에는 E3 코드와 직접 무관한 기존 문서 정합성 실패가 존재했다.

E3 Plan은 이를 "원래 실패하니 무시"하지 않는다. E3가 해당 문서를 실제로 수정하는 범위와 겹치므로 **E3 완료 시 최종 기준선에서는 관련 문서 정합성 테스트까지 통과**해야 한다.

다만 구현 전 Red test를 만들 때는 기존 실패와 E3 때문에 새로 생긴 실패를 구분해서 기록한다.

---

## 10. 추가 acceptance criteria

원본 E3 Spec 18~19절의 acceptance criteria에 다음을 추가한다.

### EcologyProfile / strong link

- `graveyard-blighted-tomb`의 활성 규칙은 `graveyard-light / graveyard-archer-light / graveyard-desecration`이다.
- `graveyard-blighted-tomb`의 활성 몬스터는 `graveyard-mage / graveyard-archer`다.
- 모든 EcologyProfile이 자기 초기 위험도에 필요한 서로 다른 eligible strong ClueId 수를 만족한다.
- ★5 profile은 동일 ClueId 재사용 없이 2세트를 준비할 수 있다.
- strong capacity validator는 `isEventEligible()`와 `activeMonsterIds` 호환을 모두 반영한다.

### Encounter

- 한 Encounter에서 같은 MonsterId를 두 group으로 선언하면 실패한다.
- `addEnemies` 또는 `removeEnemies` 내부 중복 MonsterId는 실패한다.
- add/remove 양쪽에 동일 MonsterId를 동시에 선언하면 실패한다.
- 존재하지 않는 MonsterId 제거는 실패한다.
- remove underflow는 실패한다.
- remove로 count가 0이 되면 group이 사라진다.
- 기존 MonsterId add는 원래 위치에서 count만 증가한다.
- 새 MonsterId add는 modifier 선언 순서대로 Encounter 뒤에 추가된다.
- 최종 Encounter를 개별 combatant로 펼친 순서가 deterministic하다.

### 문서

- 구 BossInfo Depth 계약이 활성 공식 문서와 코드 주석에서 제거된다.
- 강한 연계를 모든 경로/Depth 슬롯으로 보장한다는 구 문구가 제거된다.
- 네 category를 모든 실제 경로에 한 번씩 강제한다는 구 문구가 제거된다.
- E3 완료 시 관련 문서 정합성 테스트가 통과한다.

---

## 11. Plan 작성 시 해석 금지 항목

이 정정 이후 Plan 작성자는 다음을 임의로 다시 선택하지 않는다.

- ★5 strong-link 수를 2→1로 낮추지 않는다.
- ★5 묘지 문제를 해결하기 위해 새 strong-link 콘텐츠를 추가하지 않는다.
- `graveyard-blighted-tomb`은 이 문서의 profile 교체안을 사용한다.
- Encounter 중복 MonsterId를 런타임에서 자동 병합하지 않는다.
- remove underflow를 0으로 clamp하지 않는다.
- strong-link capacity는 theme 전체가 아니라 **각 EcologyProfile** 기준으로 검증한다.

이 정정까지 포함한 E3 Spec을 기준으로 다음 단계의 Superpowers `writing-plans`를 작성한다.
