# E3 사건 물질화·단서 연계·공통 자동전투 설계

## 이 문서의 지위

이 문서는 캠페인 개편 작업의 `E3 | 사건·단서·연계`를 구현하기 위한 정식 설계다.

E3 브레인스토밍에서 기존 E1·E2 계약 일부를 의도적으로 바꾸었고, 일반 몬스터 사건을 실제 자동전투로 확장하면서 기존 보스 전용 전투 루프도 공통 전투 코어로 재편하기로 합의했다. 따라서 현재 공식 문서와 과거 Superpowers 설계에서 이 문서와 충돌하는 항목은 아래 「16. 폐기·대체 계약과 필수 수정 지점」을 따른다.

이 문서의 핵심 변경은 다음과 같다.

- 일반 노드의 공개 정보는 **사건 제목이나 실제 사건 ID가 아니라 `monster / rest / merchant / special` 분류 아이콘**이다.
- 모든 실제 경로에 네 분류를 각각 최소 한 번 넣는 하드 보장은 제거한다.
- 노드 분류는 원정 시작 전에 확정하지만 실제 `SituationEvent.id`는 **노드 방문 순간** 물질화한다.
- 보스 정보는 E2의 Depth 예약이 아니라 E3가 만드는 **숨은 `special` exact-once vertex cut**으로 보장한다.
- 강한 연계는 모든 경로에서 강제로 체험시키지 않는다. `ClueId + 선행 기회`를 준비하고, 선행을 실제 방문한 뒤 후속 기회를 활성화한다.
- 비전투 사건은 구체 HP 효과를, 몬스터 사건은 구체 Encounter와 Encounter modifier를 가진다.
- 일반 몬스터 사건도 실제 자동전투를 수행한다.
- 일반전과 보스전은 **하나의 공통 `BattleEngine`**을 사용한다. E3는 공통 코어와 일반전 어댑터를 소유하고 E4는 보스 어댑터와 보스 정보 사후 검증을 소유한다.
- 재도전으로 현재 위험도가 오르면 적 수를 자동으로 늘리지 않고 일반 몬스터와 보스의 HP·공격력을 강화한다.

과거 `2026-08-17` 보스전 설계, E2의 `BossInfoDepthPlan`, 현재 공식 문서의 강한 연계 Depth 예약, 모든 경로 4분류 보장은 역사적 근거로 남을 수 있으나 현재 구현 계약으로 사용하지 않는다.

---

## 1. 목표

E3의 목적은 E1이 만든 논리 지도와 E2의 조언 판정을 받아, 한 원정에서 실제로 경험하는 **사건·단서·연계·일반 전투 결과를 재현 가능하게 확정**하는 것이다.

E3는 다음을 보장한다.

1. 플레이어는 원정 시작부터 모든 일반 노드의 분류를 보고 경로를 계획할 수 있다.
2. 실제 사건 내용은 방문하기 전까지 알 수 없다.
3. 같은 EventId는 한 attempt에서 두 번 물질화되지 않는다.
4. 방문하지 않은 갈림길은 EventId를 예약하거나 소비하지 않는다.
5. 현재 위험도에 맞는 보스 정보 사건을 모든 Entry→Boss 경로에서 정확히 1~2회 경험한다.
6. 강한 연계는 위험도별 기회를 준비하지만 실제 체험은 플레이어의 경로 선택에 달려 있다.
7. 단서는 상황을 관찰한 시점에 얻고, 새 단서가 현재 사건을 소급 강화하지 않는다.
8. 아무도 조언을 수용하지 않으면 사건의 기본 결과를 사용한다.
9. 몬스터 사건은 실제 Encounter를 만들고 조언에 따라 적 추가·제거·전투 회피·피해 배율이 바뀔 수 있다.
10. 일반 몬스터와 보스는 같은 전투 코어에서 공격·피격·사망·턴 기록을 계산한다.
11. 전투 결과 기록은 U5-2가 RNG나 규칙 재계산 없이 그대로 재생할 수 있다.
12. 콘텐츠 부족이나 불가능한 예약은 조용히 다른 규칙으로 바꾸지 않고 `RuleError("INVALID_GENERATION", ...)`로 실패한다.

### 1-1. 비목표

이번 E3에서 다음은 만들지 않는다.

- 길잡이의 직접 전투 조작
- 명중·회피·치명타·방어력
- 독·기절·화상 등 지속 상태이상
- 직업별 액티브 스킬과 전투 AI
- 적의 HP 상태에 따라 타겟 성향이 실시간으로 바뀌는 동적 AI
- 캐릭터별 다프레임 전투 스프라이트와 복잡한 카메라 연출
- 정확한 전투 밸런스 수치 확정

정확한 배율과 피해 수치는 B1에서 조정한다. E3는 **구조와 계산 위치**를 확정한다.

---

## 2. 시스템 책임 경계

| 영역 | 책임 |
| --- | --- |
| C1 | `CampaignDungeon`, `activeRuleIds`, `activeMonsterIds`, `bossId`, 초기/현재 위험도 |
| E1 | attempt별 `GeneratedMap` 논리 DAG. 초기 위험도로 Depth 수를 고정하고 재도전 시 연결을 다시 생성 |
| E2 | 공개 생태, 조언 셔플, 파티원별 수용·의심·적발, `executed`, 즉시/지연 신뢰 판정 |
| **E3** | 노드 분류, 숨은 역할, bossInfo cut, 강한/약한 연계, 방문 시 EventId 물질화, 단서, 일반 사건 효과, merchant 전투 연결, 공통 BattleEngine, 일반 몬스터 전투 |
| E4 | 현재 보스를 공통 BattleEngine 입력으로 변환, 보스 정보 modifier 적용, 지연 신뢰 사후 검증, 보스 승패를 원정 결과로 연결 |
| U4 | E3가 확정한 공개 노드 분류만 지도에 표시 |
| U5 | 상황·조언·반응·결과·진행 기록 표시 |
| U5-2 | E3/E4의 확정 전투 action record를 순차 재생. 규칙 재계산 금지 |
| B1 | 분류 soft correction 계수, 재도전 전투 배율, 몬스터/보스 HP·공격력 등 수치 조정 |

### 2-1. 공통 BattleEngine의 소유권

공통 전투 코어는 E3에서 처음 필요해지므로 E3가 만든다. 다만 보스 전용 의미를 E3가 흡수하지 않는다.

```text
E3 일반전
SituationEvent.encounter
→ EncounterModifier
→ MonsterDef
→ BattleEngine
→ BattleResolution

E4 보스전
BossDef
+ 보스 정보 기록
+ 남은 merchant nextBattle
→ Boss encounter adapter
→ 같은 BattleEngine
→ BattleResolution
→ 보스 정보 사후 검증
```

E4가 별도의 두 번째 공격 루프를 구현하면 이 설계를 위반한다. 기존 `resolveBossFight` API를 유지할 필요가 있으면 **공통 BattleEngine을 호출하는 adapter/wrapper**로 남긴다.

---

## 3. attempt 준비 상태

E1은 실패 후 새 attempt에서 논리 지도를 다시 생성한다. 따라서 E3 준비 상태도 매 attempt 새로 만든다.

개념 상태는 다음 정보를 가진다.

```ts
interface PreparedExpeditionEvents {
  readonly nodePlans: ReadonlyMap<NodeId, PreparedNodePlan>;
  readonly bossInfoCuts: readonly BossInfoCut[];
  readonly strongLinks: readonly StrongLinkPlan[];
  readonly usedEventIds: ReadonlySet<EventId>;
  readonly heldClueIds: ReadonlySet<ClueId>;
  readonly pendingNextBattleEffect?: NextBattleMerchantEffect;
}

interface PreparedNodePlan {
  readonly nodeId: NodeId;
  readonly category: EventKind;
  readonly hiddenRole: "normal" | "bossInfo" | "strongPredecessor";
}
```

활성화된 `strongFollower`는 선행 방문 뒤 미래의 아직 방문하지 않은 노드 하나에 추가되는 attempt 내부의 숨은 역할이다. 공개 `category`는 이때 바뀌지 않는다.

### 3-1. attempt 수명

새 attempt가 시작되면 다음은 초기화한다.

- 노드 분류와 숨은 역할 계획
- `usedEventIds`
- 현재 원정에서 얻은 `heldClueIds`
- strong follower 활성 상태
- merchant `pendingNextBattleEffect`

다음은 C1/E1 계약에 따라 유지하거나 다시 만든다.

- `activeRuleIds`, `activeMonsterIds`, `ecologyProfileId`, `bossId`: 던전에 고정
- `riskLevel`: 실패 후 상승 가능
- 논리 지도: E1이 attempt별 재생성

이전 attempt에서 본 EventId는 새 attempt에서 다시 나올 수 있다.

---

## 4. 노드 분류 생성과 공개 정보

### 4-1. 공개 분류

일반 노드 하나는 원정 시작 전에 정확히 하나의 분류를 가진다.

| 분류 | 지도 표시 |
| --- | --- |
| `monster` | 몬스터 아이콘 |
| `rest` | 모닥불 |
| `merchant` | 상인/골드 아이콘 |
| `special` | `?` |
| Boss | 보스 전용 아이콘 |

플레이어가 지도에서 미리 보는 것은 **분류뿐**이다.

방문 전에는 다음을 공개하지 않는다.

- EventId
- 사건 제목
- 사건 설명
- 실제 등장 몬스터 수와 종류
- 조언 문구
- 단서 포함 여부
- bossInfo 여부
- strong-link 역할 여부
- 도움/방해/중립 내부 정답

던전 전체의 현재 위험도와 E2가 공개한 생태 규칙은 별도 정보로 계속 볼 수 있다.

### 4-2. 분류는 원정 중 고정

bossInfo 예약과 strong-link 계획까지 끝난 뒤 플레이어에게 지도를 공개한다. 그 이후에는 어떤 이유로도 공개 분류를 바꾸지 않는다.

특히 단서를 얻었다고 `?`가 `monster`로 바뀌거나, 후속 연계를 만들기 위해 `rest`를 `monster`로 바꾸는 방식은 금지한다.

### 4-3. 기본 가중치

일반 노드의 기본 분류 가중치는 다음으로 확정한다.

| 분류 | 기본 가중치 |
| --- | ---: |
| monster | 40 |
| rest | 20 |
| merchant | 15 |
| special | 25 |

현재 위험도에 따라 이 기본 비율을 별도로 바꾸지 않는다. 위험도는 생태 추론과 전투 강도에서 이미 작동한다.

### 4-4. soft correction

분류 생성은 고정 개수를 먼저 할당하지 않고 **weighted random + soft correction**으로 한다.

개념적으로 최종 가중치는 다음 요소를 곱한다.

```text
finalWeight
= baseWeight
× routeRepeatPenalty
× sameDepthPenalty
× globalDominancePenalty
```

세 correction은 다음 계약을 지킨다.

- 모두 `0 < factor <= 1`이다. 콘텐츠 용량 때문에 불가능한 경우를 제외하면 단순 다양성 이유로 어떤 분류도 확률 0이 되지 않는다.
- 현재 노드까지 들어오는 경로 중 같은 분류의 연속 길이가 길수록 `routeRepeatPenalty`가 작아진다.
- 같은 분류가 2개 연속인 경로 뒤에 같은 분류를 다시 붙이는 가중치는 1개 연속 뒤보다 반드시 더 작다.
- 같은 Depth에서 이미 같은 분류가 여러 번 나왔을수록 `sameDepthPenalty`가 작아진다.
- 지금까지 배치된 전체 노드에서 특정 분류의 비중이 기본 가중치가 암시하는 비중보다 과도하게 높을 때만 `globalDominancePenalty`를 적용한다.
- 같은 분류 3회 이상 연속, 한 Depth 전체 동일 분류는 **허용**한다. 단지 덜 자주 나오게 한다.

정확한 penalty 계수는 B1 tuning 값이다. E3 구현은 계수를 이름 있는 상수/설정으로 분리하고, 테스트에서 특정 퍼센트 자체를 게임 계약으로 고정하지 않는다.

### 4-5. 하드 제약은 콘텐츠 가능성에만 사용

과거의 `모든 경로에 4분류 각각 최소 1회` 규칙은 삭제한다.

분류 가중치를 0으로 만들 수 있는 하드 사유는 다음과 같은 **실제 생성 불가능성**뿐이다.

- 해당 분류의 일반 사건 풀이 현재 던전에서 부족해 실제 경로의 EventId 중복 금지를 지킬 수 없음
- 이미 확정된 예약 역할과 충돌함
- 콘텐츠 validator가 금지한 상태를 만들게 됨

분류 다양성 자체는 `INVALID_GENERATION` 사유가 아니다.

---

## 5. 보스 정보: 숨은 exact-once cut

### 5-1. 횟수는 현재 위험도 기준

| 현재 `riskLevel` | 실제 한 경로에서 만나는 bossInfo |
| --- | ---: |
| ★1~2 | 정확히 1회 |
| ★3~5 | 정확히 2회 |

실패로 ★2가 ★3이 되면 새 attempt에서는 같은 보스를 상대로 bossInfo 보장이 1회에서 2회로 늘어난다.

### 5-2. bossInfo는 `special` 전용

보스 정보 사건은 항상 `kind: "special"`이고 `targetBossId`가 현재 `CampaignDungeon.bossId`와 같아야 한다.

지도에서는 일반 `special`과 완전히 같은 `?`로 표시한다. `?★`, 보스 아이콘, 별도 테두리처럼 정체를 암시하는 표현을 추가하지 않는다.

### 5-3. exact-once cut 정의

`BossInfoCut.nodeIds`는 다음 성질을 만족해야 한다.

> 모든 합법적인 Entry→Boss 경로가 그 집합의 노드를 **정확히 하나** 지난다.

단순히 "최소 한 번"이 아니다. 한 경로가 같은 cut의 두 노드를 지날 수 있는 후보는 사용하지 않는다.

검증기는 각 Entry→Boss 경로의 cut 교차 횟수의 최솟값과 최댓값이 모두 `1`인지 확인한다. 구현은 경로 전체 열거 대신 DAG DP를 사용할 수 있다.

### 5-4. 1회/2회 검색 구간

첫 일반 Depth와 마지막 일반 Depth는 bossInfo cut에서 제외한다.

일반 Depth 수를 `L`, 중간을 `M = floor(L / 2)`라 할 때:

- 1회: 중후반 구간 `M+1 ... L-1` 안에서 exact-once cut 하나를 찾는다.
- 2회: 전반~중반 구간 `2 ... M`에서 첫 cut, 후반 구간 `M+1 ... L-1`에서 두 번째 cut을 각각 찾는다.

두 cut은 노드를 공유하지 않는다. 구간이 분리되어 있으므로 모든 실제 경로는 첫 cut을 정확히 한 번 지난 뒤 두 번째 cut을 정확히 한 번 지나며, 총 2회를 보장한다.

### 5-5. 후보 우선순위와 fallback

각 구간에서 후보를 다음 순서로 선호한다.

1. 한 Depth 전체를 그대로 사용하는 형태가 아닌 exact-once cut
2. 이미 `special`인 노드를 많이 사용해 category 변경 수가 적은 cut
3. 필요한 노드 수가 적은 cut
4. 동일 점수면 attempt 전용 `event` RNG로 결정

선택된 cut의 노드가 `special`이 아니면 **지도 공개 전 준비 단계에서만** 해당 노드를 `special`로 변경할 수 있다.

좋은 mixed-depth/부분 cut을 찾지 못하면 최후 fallback으로 적합한 일반 Depth 하나의 **전체 노드**를 cut으로 사용한다. 층형 DAG에서 한 경로는 한 Depth의 노드를 정확히 하나 지나므로 이 fallback은 exact-once를 자동 보장한다.

fallback에서도 변경 수가 가장 적은 Depth를 우선하고 동률은 시드로 정한다.

전체 Depth가 `?`가 되는 것은 정상 목표가 아니라 bossInfo 보장을 깨지 않기 위한 최후 안전장치다.

### 5-6. 숨은 역할

선택된 cut의 모든 노드는 내부적으로 `bossInfo` 역할을 가진다.

실제 EventId는 아직 정하지 않는다. 플레이어가 그 cut에서 실제 선택한 노드를 방문할 때만 현재 보스용 bossInfo 사건을 물질화한다.

---

## 6. 강한 연계

### 6-1. 위험도별 준비 수

강한 연계 세트 수는 **초기 위험도** 기준이다.

| 초기 위험도 | 강한 연계 기회 |
| --- | ---: |
| ★1~2 | 0 |
| ★3~4 | 1 |
| ★5 | 2 |

이 숫자는 모든 경로에서 반드시 체험하는 횟수가 아니라 **지도에 준비하는 연계 기회 수**다.

### 6-2. 강한 단서의 식별

현재 콘텐츠에서 `requiresClue`가 존재하는 ClueId를 strong clue로 본다.

- `requiresClue === clueId`인 사건: strong follower 전용 사건
- `revealsClue === clueId`이고 해당 clueId가 strong clue인 사건: strong predecessor 전용 사건
- `revealsClue`가 있지만 어떤 strong follower도 요구하지 않는 clue: 약한 연계/AdviceUpgrade용 일반 단서

strong predecessor와 strong follower 전용 사건은 일반 random pool에서 제외한다.

### 6-3. 원정 시작 시 계획

원정 준비 시 strong link 하나마다 다음을 정한다.

```ts
interface StrongLinkPlan {
  readonly clueId: ClueId;
  readonly predecessorNodeId: NodeId;
  readonly followerOpportunityNodeId?: NodeId;
  readonly state: "prepared" | "activated" | "missed" | "completed";
}
```

이때 실제 predecessor EventId와 follower EventId는 정하지 않는다.

계획 규칙:

- ★5의 두 세트는 서로 다른 ClueId를 사용한다.
- predecessor node는 bossInfo cut, 다른 strong link 역할과 겹치지 않는다.
- predecessor node의 공개 category와 `revealsClue === clueId` 후보 사건의 kind가 맞아야 한다.
- strong link를 만들기 위해 공개 category를 변경하지 않는다.
- predecessor보다 뒤에서 도달 가능한 노드 중 follower 후보 사건의 kind와 맞는 노드가 최소 하나 존재해야 한다.

조건을 만족하는 세트를 요구 수만큼 준비할 수 없으면 보장 수를 줄이지 않고 `INVALID_GENERATION`이다.

### 6-4. predecessor 방문

플레이어가 predecessor node를 실제 방문하면:

1. 그 노드 category와 planned clueId에 맞는 predecessor 사건을 방문 순간 물질화한다.
2. 상황 설명이 공개되는 즉시 `revealsClue`를 획득한다.
3. 현재 위치에서 이후 도달 가능하고 아직 방문하지 않았으며 예약 충돌이 없고 follower 사건 category와 맞는 노드 후보를 찾는다.
4. 후보 중 하나를 attempt RNG로 결정해 `followerOpportunityNodeId`로 활성화한다.

활성화 시 공개 category는 바뀌지 않는다.

### 6-5. 후속 기회는 재배치하지 않는다

활성화된 follower node를 실제 방문하면 matching `requiresClue` 사건을 물질화하고 세트를 `completed`로 만든다.

플레이어가 다른 경로를 선택해 그 노드가 더 이상 도달 불가능해지면 `missed`다. 다른 노드에 follower를 옮기지 않는다.

따라서 strong link는 다음 의미를 가진다.

> 선행을 발견하면 후속을 만날 수 있는 기회가 생기지만, 플레이어의 이후 경로 선택이 그 이야기를 놓치게 할 수 있다.

---

## 7. 방문 시 EventId 물질화

### 7-1. 공통 순서

노드 방문 시 다음 우선순위로 role-specific pool을 정한다.

1. `bossInfo`
2. 활성화된 `strongFollower`
3. `strongPredecessor`
4. `normal`

정상 준비 상태에서는 역할 중복이 없어야 하며, 이 우선순위는 손상된 상태를 조용히 덮기 위한 규칙이 아니다. 역할 충돌은 준비 validator에서 실패한다.

### 7-2. 공통 후보 필터

모든 후보는 다음을 만족해야 한다.

- `event.kind === node.category`
- 이미 `usedEventIds`에 없음
- 테마/활성 생태/조건부 규칙이 E2의 `isEventEligible` 계약을 만족
- 현재 역할의 boss/clue 조건을 만족
- monster 사건이면 encounter의 모든 MonsterId가 현재 던전 `activeMonsterIds`와 호환

role별 추가 규칙:

#### bossInfo

- `targetBossId === dungeon.bossId`
- 일반 pool에서 제외

#### strongFollower

- `requiresClue === plannedClueId`
- pre-visit held clue에 해당 clueId가 존재
- 일반 pool에서 제외

#### strongPredecessor

- `revealsClue === plannedClueId`
- plannedClueId가 strong clue
- 일반 pool에서 제외

#### normal

다음을 제외한다.

- `targetBossId`가 있는 사건
- `requiresClue`가 있는 사건
- strong clue를 `revealsClue`하는 predecessor 전용 사건

약한 연계 단서를 주거나 `upgrades`를 가진 사건은 normal pool에 남는다.

### 7-3. 최종 선택은 균등

필터 뒤 남은 EventId 사이에는 추가 가중치를 주지 않는다.

- 생태 규칙별 가중치 없음
- 특정 EventId 희귀도 없음
- clue를 주는 사건 가중치 없음

후보를 stable EventId 순서로 정규화한 뒤 `campaignSeed + dungeonId + attempt + nodeId + hiddenRole`에서 파생한 `event` RNG로 균등 선택한다.

선택 즉시 `usedEventIds`에 기록한다.

### 7-4. 런타임 후보 0개

최종 후보가 0개면 다른 category로 바꾸거나 이미 쓴 EventId를 재사용하지 않는다.

```text
RuleError("INVALID_GENERATION", ...)
```

를 반환한다.

다만 정상 콘텐츠에서는 플레이 도중 처음 발견되지 않도록 원정 준비 시 capacity preflight를 수행한다. 자세한 내용은 14절을 따른다.

---

## 8. 단서 획득과 약한 연계

### 8-1. pre-visit snapshot

노드 방문을 시작할 때 `heldClueIds`를 snapshot한다.

이 snapshot만 다음에 사용한다.

- strong follower 물질화 자격
- 현재 사건의 AdviceUpgrade 적용

현재 사건에서 새로 얻을 clue는 현재 사건의 기계적 강화에 사용하지 않는다.

### 8-2. AdviceUpgrade 적용 순서

1. pre-visit clue snapshot을 만든다.
2. 사건을 물질화한다.
3. `upgrades[]`를 콘텐츠 선언 순서대로 본다.
4. 보유 clue와 처음 일치하는 upgrade **하나만** 적용한다.
5. 해당 `slotIndex`의 조언을 replacement로 바꾼다.
6. 그 후 E2가 조언 3개를 시드 기반으로 셔플해 플레이어에게 보여준다.

한 사건에 여러 upgrade 선언이 있어도 한 방문에서 적용되는 것은 최대 하나다. 별도 `priority` 필드는 추가하지 않는다.

clue는 upgrade에 사용해도 소비하지 않는다.

### 8-3. clue 획득 시점

사건의 상황 설명을 플레이어에게 공개한 직후 `revealsClue`가 있으면 즉시 획득한다.

```text
pre-visit clue snapshot
→ 사건 물질화 / 기존 clue로 upgrade
→ 상황 설명 공개
→ revealsClue 즉시 획득 + 진행 기록
→ 조언 표시/선택
→ 반응/효과/결과
```

따라서:

- 조언이 수용됐는지는 clue 획득에 영향을 주지 않는다.
- 도움/방해/중립 결과가 clue 획득을 취소하지 않는다.
- 새 clue는 플레이어가 현재 조언을 추론하는 정보로 읽을 수 있지만, 현재 사건의 AdviceUpgrade를 소급 발동시키지는 않는다.
- attempt가 끝나면 현재 원정 clue 상태는 초기화한다.

숨은 생태 규칙을 clue 획득만으로 시스템이 `확정 정답`으로 승격하지 않는다.

---

## 9. 일반 사건 효과 데이터 계약

현재 `effectTags`는 의미/검증 태그이지 실제 HP와 전투 결과를 계산하는 수치 payload가 아니다. E3는 구체 효과를 별도로 도입한다.

### 9-1. 비전투 즉시 효과

```ts
interface ImmediateEventEffect {
  readonly hpDeltaPerMember: number;
}
```

`rest`와 일반 `special`의 각 조언 결과 및 default 결과는 이 효과를 사용할 수 있다.

- 양수: 현재 살아 있는 파티원 모두 회복
- 음수: 현재 살아 있는 파티원 모두 피해
- 0: 수치 변화 없음
- 결과 HP는 `0 ... class.maxHp`로 clamp
- HP가 0이면 해당 캐릭터는 즉시 사망
- 적용 결과 전멸하면 남은 노드와 보스전을 건너뛰고 실패 흐름으로 간다.

### 9-2. monster effect는 Encounter를 바꾼다

monster 사건은 직접 `HP -10`처럼 결과를 미리 계산하지 않는다. 기본 Encounter를 가지고, 조언은 Encounter를 수정한다.

```ts
interface EncounterEnemyGroup {
  readonly monsterId: MonsterId;
  readonly count: number; // >= 1
}

interface EncounterDefinition {
  readonly enemies: readonly EncounterEnemyGroup[];
}

type EncounterModifier =
  | {
      readonly avoidCombat: true;
    }
  | {
      readonly avoidCombat?: false;
      readonly addEnemies?: readonly EncounterEnemyGroup[];
      readonly removeEnemies?: readonly EncounterEnemyGroup[];
      readonly partyDamageMultiplier?: number;
      readonly incomingDamageMultiplier?: number;
    };
```

`partyDamageMultiplier`는 용사들이 적에게 주는 피해, `incomingDamageMultiplier`는 적이 파티에 주는 피해를 뜻한다. 기존 merchant `NextBattleMerchantEffect`와 같은 의미의 이름을 사용한다.

### 9-3. monster modifier 검증

- `EncounterDefinition.enemies`의 모든 MonsterId는 현재 `activeMonsterIds`에 있어야 한다.
- `addEnemies`의 MonsterId도 모두 `activeMonsterIds`에 있어야 한다.
- 같은 enemy group의 count는 양의 정수다.
- 한 modifier 안에서 같은 MonsterId를 add와 remove에 동시에 넣지 않는다.
- remove 수가 현재 encounter 수보다 많으면 조용히 0으로 clamp하지 않고 콘텐츠 오류로 본다.
- `avoidCombat: true`는 다른 add/remove/multiplier와 함께 쓰지 않는다.
- multiplier는 음수가 될 수 없다.

### 9-4. E2 executed와 효과 적용

E2 계약을 그대로 사용한다.

```text
한 명 이상 accepted
→ decision.executed === true
→ 선택 조언 효과를 정확히 한 번 적용

accepted 0명
→ decision.executed === false
→ 사건 default 효과를 적용
```

exposed가 존재해도 accepted가 한 명 이상이면 행동은 실행된다. exposed 멤버가 실행 자체를 취소하지 않는다.

비전투 사건은 `defaultEffect`, monster 사건은 `defaultEncounterModifier`를 가진다. 기본 monster 결과가 아무 수정도 없는 기본 encounter라면 빈 modifier를 명시적으로 사용할 수 있다.

bossInfo는 이 즉시 효과 계약의 예외다. bossInfo의 기계적 효과는 E4까지 지연한다.

merchant는 기존 `merchantEffect` 계약을 유지하며 별도 절에서 다룬다.

---

## 10. monster 사건과 실제 Encounter

### 10-1. 사건이 기본 Encounter를 직접 정의

monster 사건은 상황 문구와 일치하는 적 구성을 콘텐츠가 직접 정한다.

예:

```text
"굴러간 자갈에 동굴거미가 반응했다"
기본 Encounter: 동굴거미 ×2

도움 → avoidCombat
중립 → 변경 없음, 동굴거미 ×2
방해 → 동굴거미 +2, 총 ×4
```

위험도나 공통 시스템이 사건의 적 숫자를 임의로 +1/+2하지 않는다. "숨어 있던 거미가 더 나온다" 같은 사건의 의미는 조언 modifier가 소유한다.

### 10-2. Encounter 순서

`EncounterDefinition.enemies`의 선언 순서는 전투에서 적의 전열 순서다.

같은 MonsterId count가 2 이상이면 안정적인 instance ID를 만들어 선언 순서대로 배치한다.

용사들은 항상 **가장 앞의 살아 있는 적부터 집중 공격**한다.

---

## 11. 공통 BattleEngine

### 11-1. 최소 적 전투 데이터

`MonsterDef`에 다음을 추가한다.

```ts
interface MonsterDef {
  // existing fields...
  readonly maxHp: number;
  readonly baseDamage: number;
  readonly targetWeightMultipliers?: Partial<Record<ClassId, number>>;
}
```

`BossDef`도 같은 target 성향 필드를 가질 수 있다.

- `maxHp`, `baseDamage`는 양의 정수
- target multiplier를 생략하면 모든 직업 `1`
- 명시한 target multiplier는 `> 0`

일반 잡몹 대부분은 modifier를 생략한다. 일부 특수 몬스터와 보스만 고유 타겟 성향을 가진다.

### 11-2. 최종 피격 가중치

적 하나가 파티원을 공격할 때:

```text
finalTargetWeight
= ClassDef.hitWeight
× enemy.targetWeightMultipliers[classId] (기본 1)
```

예를 들어 전사 기본 `hitWeight 3`, 마법사 `1`인 상태에서 어떤 보스가 전사 `0.5`, 마법사 `3`을 가지면 그 보스는 평소와 달리 마법사를 적극적으로 노릴 수 있다.

현재 HP가 낮은 대상을 더 노리는 등 동적 target policy는 이번 범위 밖이다.

### 11-3. 한 라운드 순서

공통 전투는 다음 순서를 고정한다.

```text
Round 시작
→ 살아 있는 용사들이 파티 입력 순서대로 1회씩 공격
   → 각 공격은 가장 앞의 살아 있는 적을 공격
   → 적 HP 0이면 즉시 사망
   → 모든 적 사망 시 victory, 적 phase 없음
→ 살아 있는 적들이 encounter 순서대로 1회씩 공격
   → 각 적이 finalTargetWeight로 살아 있는 파티원 한 명 선택
   → 파티원 HP 0이면 즉시 사망
   → 파티 전멸 시 wipe
→ 다음 Round
```

죽은 용사와 죽은 적은 이후 행동하지 않는다.

명중/회피/치명타 RNG는 없다. 적의 대상 선택만 weighted RNG를 소비한다.

### 11-4. 피해

파티 기본 공격력은 현재 `ClassDef.attack`을 사용한다.

```text
partyDamage
= round(class.attack × effectivePartyDamageMultiplier)

enemyDamage
= round(riskScaledBaseDamage × effectiveIncomingDamageMultiplier × perMemberBossInfoMultiplier)
```

일반전에서는 `perMemberBossInfoMultiplier = 1`이다. 보스전에서만 E4가 대상 멤버의 보스 정보 기록을 변환해 제공한다.

피해는 0 미만이 될 수 없다.

### 11-5. modifier 합성

monster 사건 modifier와 merchant nextBattle 효과가 함께 존재하면 같은 축의 multiplier는 곱한다.

```text
effectivePartyDamageMultiplier
= eventPartyMultiplier × merchantPartyMultiplier

effectiveIncomingDamageMultiplier
= eventIncomingMultiplier × merchantIncomingMultiplier
```

없는 값은 `1`이다.

### 11-6. 재현 가능한 target RNG

BattleEngine은 전투 하나당 독립 `battle` RNG를 사용한다.

seed에는 최소한 다음 identity가 들어간다.

- campaignSeed
- dungeonId
- attempt
- battle nodeId
- materialized eventId 또는 bossId

각 살아 있는 적의 공격마다 weighted target pick을 한 번 소비한다.

같은 입력 상태와 같은 seed면 같은 대상·같은 사망 순서·같은 action record가 나온다.

### 11-7. 공통 결과 기록

U5-2가 일반전과 보스전을 같은 방식으로 재생할 수 있도록 공통 action record를 만든다.

개념 계약:

```ts
interface BattleActionRecord {
  readonly round: number;
  readonly actorSide: "party" | "enemy";
  readonly actorId: string;
  readonly targetSide: "party" | "enemy";
  readonly targetId: string;
  readonly damage: number;
  readonly targetHpBefore: number;
  readonly targetHpAfter: number;
  readonly defeated: boolean;
}

interface BattleResolution {
  readonly outcome: "victory" | "wipe";
  readonly rounds: number;
  readonly actions: readonly BattleActionRecord[];
  readonly partyHpAfter: Readonly<Record<MemberId, number>>;
  readonly enemyHpAfter: Readonly<Record<string, number>>;
  readonly termination: "defeatedEnemies" | "partyWipe" | "roundLimit";
}
```

구체 타입명은 구현 시 기존 도메인과 충돌하지 않게 조정할 수 있지만 다음 정보는 잃지 않는다.

- 누가
- 누구를
- 몇 번째 라운드에
- 얼마만큼 공격했고
- HP가 몇에서 몇이 되었으며
- 그 행동으로 사망했는지

화면은 이 기록을 읽기만 한다.

### 11-8. 안전 상한

기존 보스전의 무한루프 안전장치를 공통 코어에도 유지한다.

- 최대 50 round
- 정상 양의 공격력 콘텐츠에서는 도달하지 않아야 한다.
- 상한에 닿으면 `wipe`와 `termination: "roundLimit"`을 반환하고 진단 가능한 기록을 남긴다.

B1/Q1은 roundLimit 발생 seed가 정상 콘텐츠에서 없는지 확인한다.

---

## 12. 재도전과 현재 위험도 전투 강화

지도 Depth, bossId, ecology profile은 초기 위험도 계약을 따른다. 전투 강도는 **현재 위험도와 초기 위험도의 차이**를 추가로 사용한다.

```text
retrySteps = riskLevel - initialRiskLevel
retryCombatMultiplier(0) = 1
```

`retryCombatMultiplier(n)`은 n이 커질수록 단조 증가한다.

일반 몬스터와 보스 모두:

```text
scaledEnemyMaxHp
= max(1, round(baseMaxHp × retryCombatMultiplier(retrySteps)))

scaledEnemyBaseDamage
= max(1, round(baseDamage × retryCombatMultiplier(retrySteps)))
```

같은 multiplier 함수를 HP와 공격력에 사용한다.

다음은 위험도 상승 때문에 자동 변경하지 않는다.

- Encounter의 적 종류
- Encounter의 적 수
- bossId
- 지도 Depth 수

정확한 `retryCombatMultiplier` 수치는 B1 tuning 계약이다. E3 구현은 한 곳의 이름 있는 상수/테이블로 분리하고, E3 단위 테스트는 정확한 +10% 같은 수치가 아니라 `0단계=1`, 이후 단조 증가, HP·공격력 동시 적용을 검증한다.

---

## 13. merchant와 다음 전투 효과

기존 merchant 계약을 유지한다.

- neutral: `거래하지 않는다`, 0G
- 유료 2개: help/harm지만 플레이어에게 의도를 표시하지 않음
- 가격은 선택 전에 공개
- 골드 부족 선택지는 보이지만 비활성
- 가격으로 help/harm을 추론할 수 없도록 콘텐츠 가격대를 관리
- nextBattle pending은 최대 1개
- pending이 있어도 immediate merchant 선택은 가능
- 새 nextBattle 효과는 기존 pending을 덮어쓰거나 stack하지 않음
- 원정 종료/전멸/정산 시 남은 pending 폐기

### 13-1. 실제 전투에서만 소비

pending nextBattle 효과는 다음 **실제 BattleEngine 실행**에서 소비한다.

우선순위:

1. 다음 `monster` 사건에서 실제 전투가 발생하면 소비
2. 이후 monster 전투가 없으면 Boss 전투에서 소비

monster 사건이 `avoidCombat: true`가 되어 BattleEngine을 실행하지 않았다면 pending을 소비하지 않는다.

소비한 pending은 해당 전투의 modifier에 한 번만 합성하고 즉시 제거한다.

---

## 14. 생성 전 검증·결정성·오류 처리

### 14-1. preflight capacity validator

EventId를 실제 노드에 미리 예약하지 않으면서도 런타임 pool 고갈을 막기 위해, 지도 공개 전에 콘텐츠 용량을 검증한다.

최소 검증 항목:

- 현재 던전에서 E2 eligibility를 통과하는 normal event를 kind별로 센다.
- 각 합법 경로에서 normal role로 방문할 수 있는 kind별 최대 개수가 해당 pool의 서로 다른 EventId 수를 넘지 않는지 확인한다.
- 현재 보스용 서로 다른 bossInfo EventId가 현재 위험도의 보장 횟수 이상인지 확인한다.
- planned strong clue마다 predecessor 후보와 follower 후보가 각각 최소 1개인지 확인한다.
- ★5의 두 strong plan이 EventId/ClueId 역할 충돌 없이 성립하는지 확인한다.
- 모든 monster 후보의 base/add enemy가 `activeMonsterIds`와 호환되는지 확인한다.

이 검증은 EventId를 실제 노드에 배정하지 않는다. **가능성만 검증**한다.

분류 생성 중 특정 kind를 더 배치하면 콘텐츠 용량을 확실히 초과하는 상태가 되는 경우 그 kind만 구조적 이유로 hard-exclude할 수 있다. 이는 다양성 강제가 아니라 EventId 중복 금지의 필요조건이다.

### 14-2. 결정성

다음은 같은 입력에서 동일해야 한다.

- 노드 분류
- bossInfo cut
- strong clue와 predecessor node
- predecessor 방문 뒤 follower opportunity node
- 방문 EventId
- AdviceUpgrade 선택
- BattleEngine target 선택과 action record

서로 다른 판단 단계가 같은 RNG 소비 순서에 의존하지 않게 `event`, `battle` 등 파생 stream을 분리한다.

### 14-3. 조용한 재추첨 금지

아래 상황에서 다른 규칙으로 몰래 대체하지 않는다.

- bossInfo exact-once cut 생성 실패
- strong link 요구 수 부족
- role 충돌
- 콘텐츠 용량 부족
- 방문 후보 0개
- activeMonsterIds 밖의 적 사용
- remove enemy underflow
- 중복 EventId 필요 상태

모두 `RuleError("INVALID_GENERATION", ...)`로 진단한다.

---

## 15. UI와 진행 기록 계약

E3는 화면을 구현하지 않지만 U4/U5/U5-2가 소비할 공개 데이터를 명확히 구분한다.

### 지도

보여준다:

- 경로
- `monster / rest / merchant / special / boss` 시각 분류
- 방문/현재/도달 가능 상태

숨긴다:

- 실제 EventId와 제목
- bossInfo/strong 역할
- clue 존재 여부
- Encounter 상세

### 상황 공개 후

보여줄 수 있다:

- 사건 제목·description
- 상황 공개로 새로 얻은 clue
- 조언 3개
- merchant 가격/비활성 사유

### 결과 후

보여준다:

- 파티원별 accepted/suspected/exposed 반응
- 실제 사건 결과 문구
- HP 변화
- 전투가 있었다면 확정 BattleResolution replay
- 신뢰 변화와 이유
- clue/생태 진행 기록

`help/harm/neutral`, `consistent/contradictory/unrelated`, 내부 확률은 선택 전후 모두 직접 표시하지 않는다.

진행 기록의 `생태` 영역은 공개/확인된 규칙과 관찰 clue를 구분한다. clue가 숨은 규칙의 정답을 자동 해금하지 않는다.

---

## 16. 폐기·대체 계약과 필수 수정 지점

이 절은 구현 때 "새 규칙을 추가했지만 오래된 계약도 남아서 둘 다 작동하는" 상태를 막기 위한 필수 체크리스트다.

### 16-1. `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`

현재 내용 중 다음을 교체한다.

| 기존 계약 | 새 계약 |
| --- | --- |
| 모든 경로에 monster/rest/merchant/special 각각 최소 1회 | 삭제. 40/20/15/25 weighted random + soft correction |
| 지점의 공개 역할·대략적 위험 성격 | 공개 category만. EventId/제목/위험 상세는 방문 전 숨김 |
| E2가 BossInfo Depth 예약 | E3가 hidden exact-once bossInfo cut 예약 |
| 강한 연계를 서로 다른 Depth 슬롯에 예약해 실제 경로에서 경험 | `ClueId + predecessor opportunity`, 체험 비보장, 방문 후 follower 활성화 |
| 일반 사건 효과를 추상 결과로 처리 | 비전투 HP payload + monster Encounter/Modifier |
| 일반 몬스터 장면은 E3 결과만 소비 | E3가 실제 공통 BattleEngine 결과/action record까지 생성 |
| 보스 전용 턴 루프 | E4가 공통 BattleEngine을 사용하는 adapter |

자동 전투 표현의 `화면은 결과를 재계산하지 않는다` 원칙은 유지한다.

### 16-2. `docs/systems/INFORMATION_AND_DECEPTION.md`

- bossInfo의 위치 보장을 Depth가 아닌 E3 cut 기준으로 바꾼다.
- 별도 `정보 전달 기회`나 옛 InfoCard 단계가 남아 있다면 현재 SituationEvent 조언 3개 구조로 교체한다.
- 보스 정보는 `special` 사건의 지연형 조언이고 지도에서 별도 표시하지 않는다고 명시한다.
- 즉시형과 보스 지연형 신뢰 시점은 E2 현재 계약을 유지한다.

### 16-3. `docs/design/CORE_GAME_LOOP.md`

던전 진행을 다음 흐름에 맞춘다.

```text
지도 category 선택
→ 방문 EventId 물질화
→ pre-visit clue로 upgrade
→ 상황 공개 / revealsClue 획득
→ 조언 선택 / E2 반응
→ E3 효과 적용
→ monster면 실제 공통 자동전투
→ 결과/신뢰/기록
→ 다음 지도
```

별도 `infoOpportunity` 단계를 다시 두지 않는다.

### 16-4. `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

E3/E4/U5-2 책임과 완료 기준을 갱신한다.

- E3: category/cut/materialization/clue/effect + 공통 BattleEngine + 일반전
- E4: boss adapter + boss info modifier/지연 신뢰 검증 + 원정 승패 연결
- U5-2: 일반전/보스전 모두 공통 action record replay

`E2가 보스 정보 Depth 계획을 완료했다`는 설명은 제거한다.

### 16-5. `lib/domain/content.ts`

- `EventKind` 주석의 `모든 경로에 각각 한 번 이상` 문구 제거
- 비전투 concrete effect와 monster encounter/effect 계약 추가
- merchant 기존 타입은 호환 유지
- strong 전용/normal pool 식별이 `requiresClue`와 strong ClueId 계약으로 가능하도록 validator 보강

### 16-6. `lib/domain/dungeon.ts`

- `MonsterDef.maxHp`
- `MonsterDef.baseDamage`
- `MonsterDef.targetWeightMultipliers`
- `BossDef.targetWeightMultipliers`

을 추가한다.

`CampaignDungeon`의 `initialRiskLevel / riskLevel / activeMonsterIds / bossId` 분리는 유지한다.

### 16-7. `lib/rules/advice-evaluation.ts`

E2의 아래 책임은 유지한다.

- 공개 규칙
- event eligibility
- 조언 셔플
- 반응 확률
- `executed`
- 즉시 신뢰
- 보스 정보 delayed record와 exposed 즉시 신뢰

다음은 E3로 이동/삭제한다.

- `BossInfoDepthPlan`
- `planBossInfoDepths()`

`resolveBossInfoAdvice()`의 현재 bossId 검증과 delayed trust 동작은 유지한다.

### 16-8. 과거 보스전 설계/구현

`docs/superpowers/specs/2026-08-17-sbh3821-turn-based-boss-fight-design.md`의 다음 핵심은 공통 BattleEngine으로 흡수한다.

유지:

- 파티가 먼저 공격
- 파티원 개별 공격 기록
- `ClassDef.attack`
- `hitWeight` 기반 적 target 선택
- 50턴 안전장치
- 화면이 전투 기록을 재생

대체:

- 보스만 존재하는 단일 적 전용 loop
- `BossResolution`만을 유일한 전투 replay 데이터로 보는 구조

필요하면 기존 `BossResolution`은 E4 adapter의 호환 DTO로 유지할 수 있지만 전투 계산 자체를 복제하지 않는다.

### 16-9. U4/U5/U5-2 문서

- U4는 EventId/제목이 아니라 category만 선공개
- U5의 행동/조언 화면은 방문 물질화 뒤 나타남
- 진행 기록은 clue와 전투 action/result를 보관
- U5-2는 일반/보스 모두 공통 action record를 받아 정적 PNG + Framer Motion으로 재생

---

## 17. E2 선행 상태

과거 E2 코드 리뷰에서 지적됐던 다음 문제는 현재 `main`에서 이미 수정된 상태를 전제로 한다.

- help/neutral/harm 기본 수용률 + trust band + personality modifier
- harm 전원 의심 시 `suspicionWasCorrect`
- bossInfo accepted/suspected 신뢰를 보스전까지 지연
- exposed harmful bossInfo만 즉시 큰 신뢰 패널티
- bossInfo `targetBossId === dungeon.bossId` 검증
- 조건부 규칙을 advice가 스스로 성립시키지 않도록 별도 선언 계약 사용

E3는 이 문제를 다시 다른 공식으로 구현하지 않는다.

E3 구현 시작 시 확인할 선행 조건은 **E2 P0 수정 자체가 아니라 E2의 Depth 예약 책임을 제거하고 새 E3 cut 계약으로 연결하는 것**이다.

---

## 18. 테스트와 합격 기준

### 18-1. category 생성

- 같은 입력으로 같은 category map 생성
- base weight 40/20/15/25 사용
- 3연속/한 Depth 동일 category가 유효 상태임
- soft correction이 반복/Depth 중복/전체 과점에 대해 가중치를 감소시킴
- 네 분류가 모두 없는 실제 경로도 category 다양성 이유만으로 실패하지 않음
- 공개 뒤 category가 변하지 않음

### 18-2. bossInfo cut

- 모든 E1 템플릿과 다수 seed에서 각 cut의 path intersection min/max가 정확히 1
- ★1~2 실제 모든 경로 bossInfo 정확히 1
- ★3~5 실제 모든 경로 bossInfo 정확히 2
- 두 cut은 순서와 구간이 분리됨
- mixed/부분 cut 우선, 불가능 시 전체 Depth fallback
- cut의 non-special 노드는 공개 전 special로 변경
- 지도에서는 bossInfo와 일반 special을 구분할 수 없음

### 18-3. strong linkage

- 초기 ★1~2 = 0, ★3~4 = 1, ★5 = 2 plan
- ★5는 서로 다른 clueId
- bossInfo/다른 strong role과 노드 중복 없음
- predecessor 미방문이면 follower 미활성
- predecessor 상황 공개 즉시 clue 획득
- 활성화 시 이후 reachable category-compatible node 하나 지정
- follower를 우회하면 재배치하지 않고 missed
- follower 방문 시 matching requiresClue EventId 물질화

### 18-4. EventId 물질화

- 방문하지 않은 노드는 EventId를 소비하지 않음
- 같은 attempt에서 동일 EventId 중복 없음
- 새 attempt에서는 이전 EventId 재사용 가능
- bossInfo/strong 전용 사건이 normal pool에 나오지 않음
- weak clue/upgrade 사건은 normal pool에 남음
- 최종 후보는 균등 선택
- 후보 0개에서 category 변경/재사용 없이 INVALID_GENERATION

### 18-5. clue/upgrade

- pre-visit clue만 현재 upgrade에 사용
- `upgrades[]` 첫 matching entry 하나만 적용
- revealsClue는 description 공개 직후 획득
- 현재 사건이 방금 준 clue로 자기 자신을 upgrade하지 않음
- clue는 upgrade에 사용해도 유지
- retry에서 clue 초기화

### 18-6. 사건 효과

- accepted 1명 이상이면 선택 효과 정확히 1회
- exposed가 함께 있어도 accepted가 있으면 실행
- accepted 0명이면 default 효과
- HP delta가 살아 있는 멤버에 적용되고 clamp/사망 처리
- monster modifier add/remove/avoid/multiplier 정확히 적용
- activeMonsterIds 밖의 monster를 거부
- remove underflow를 거부

### 18-7. BattleEngine

- 파티 phase → 적 phase 순서
- 용사는 encounter 앞의 살아 있는 적 집중 공격
- 파티 공격 도중 모든 적이 죽으면 적 phase 없음
- 적은 살아 있는 파티원만 weighted target
- 기본 hitWeight와 적별 target multiplier가 곱해짐
- 일부 일반 몬스터와 보스가 서로 다른 target 성향 사용 가능
- same input/seed에서 같은 target/record
- dead combatant는 이후 행동하지 않음
- event/merchant multiplier가 곱으로 합성
- risk retry multiplier가 일반 몬스터와 보스 HP/공격력 모두에 적용
- 위험도 상승이 enemy count를 자동 변경하지 않음
- 50 round cap 동작
- action record만으로 U5-2 replay 가능

### 18-8. merchant

- pending 최대 1개
- immediate 선택은 pending이 있어도 가능
- 새 nextBattle은 stack/overwrite 불가
- avoidCombat monster는 pending을 소비하지 않음
- 다음 실제 monster combat에서 소비
- monster combat이 없으면 boss에서 소비
- 원정 종료/전멸 시 폐기

### 18-9. 문서 정합성

구현 PR에서 최소 다음을 검색해 구 계약 잔존을 확인한다.

- `모든 가능한 실제 경로에는 네 분류`
- `BossInfoDepthPlan`
- `보스 정보 Depth`
- `강한 연계 Depth`
- 지도에서 사건 제목 선공개
- 보스만의 별도 전투 계산 loop

현재 계약과 충돌하는 활성 공식 문서/주석/배정표 문구가 남아 있으면 E3 완료로 보지 않는다.

---

## 19. 완료 정의

E3 완료는 단순히 EventId 하나를 뽑아 화면에 보여주는 상태가 아니다.

다음을 모두 만족해야 한다.

1. E1 map에 공개 category와 숨은 role을 준비한다.
2. 현재 위험도 bossInfo exact-once 보장을 모든 경로에서 검증한다.
3. 초기 위험도 strong-link opportunity 수를 준비한다.
4. 방문 시 EventId를 중복 없이 결정적으로 물질화한다.
5. clue/AdviceUpgrade timing이 계약대로 동작한다.
6. 비전투 effect와 monster Encounter modifier를 실제 상태에 적용한다.
7. 일반 monster battle을 공통 BattleEngine으로 실제 계산한다.
8. E4가 별도 loop 없이 같은 BattleEngine을 사용할 수 있는 adapter 경계를 제공한다.
9. merchant pending이 실제 다음 전투와 연결된다.
10. U5/U5-2가 원인과 전투를 재계산 없이 설명할 수 있는 결과 데이터를 제공한다.
11. 관련 공식 문서·도메인 주석·작업 배정표에서 이 문서가 폐기한 구 계약을 제거한다.
12. 결정성·용량·cut·연계·전투 테스트가 통과한다.

이 Spec 승인 뒤 다음 단계는 Superpowers `writing-plans`로 구현 계획을 작성하는 것이다.
