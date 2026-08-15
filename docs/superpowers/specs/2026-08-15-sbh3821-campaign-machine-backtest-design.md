# 캠페인 전이 함수와 10,000시드 백테스트 설계

- 작성일: 2026-08-15
- 작성자: sbh3821
- 작업 ID: [C4](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)
- 상위 spec: [던전 15개 캠페인 게임 방향 개편](2026-08-13-sanghwan-yoo-game-direction-rework-design.md)
- 상위 plan: [게임 방향 개편 구현 계획](../plans/2026-08-13-sanghwan-yoo-game-direction-rework.md)의 **Task 10**과 **Task 8** 중 전이 함수 부분

## 문제

규칙은 다 있는데 **이어 붙이는 순서가 없다.**

`C1`이 게시판을, `E1`이 지도를, `E2`가 정보 판정을, `E3`이 사건과 보스전을,
`C3`이 정산을 만들었다. 그런데 게시판에서 공고를 고르고 지도를 걸어 보스를 만나고
정산까지 가는 흐름은 어디에도 없다. `lib/flow`에는 아직 단일 런 시절의
`run-machine.ts`만 있다.

상위 plan Task 10은 백테스트 전략이 `내부 state를 직접 수정하지 않고
transitionCampaign action만 호출한다`고 정했는데, 그 함수는 Task 8 소관이고
배정표는 Task 8을 `I1`에 넣었다. 그리고 `I1`은 `C4`를 선행으로 기다린다. plan의
지시와 의존성 그래프가 서로 맞지 않는다.

**`C4`가 전이 함수까지 만들기로 했다.** 백테스트 안에서만 순서를 짜면 `I1`이
`transitionCampaign`을 만들 때 같은 순서를 두 번 구현하게 되고, 둘이 어긋나는
순간 백테스트는 실제 게임이 아닌 것을 재게 된다. 측정 도구가 측정 대상과 다른
물건이 되는 것이 가장 나쁜 결과다.

`I1`은 Zustand 스토어와 화면을 이 위에 올리기만 하면 된다.

## 전이 함수

```ts
transitionCampaign(
  state: CampaignState,
  action: CampaignAction,
  context: CampaignMachineContext,
): CampaignState
```

### 행동과 단계

| 현재 단계 | 행동 | 다음 단계 |
| --- | --- | --- |
| `board` | `openBoard` | `board` (공고 갱신) |
| `board` | `acceptContract` | `map` |
| `map` | `selectNode` | `infoOpportunity` · `event` · `boss` |
| `infoOpportunity` | `chooseInfoCard` | `event` |
| `event` | `chooseEvent` | `map` · `settlement` |
| `boss` | `resolveBoss` | `settlement` |
| `settlement` | `applySettlement` | `board` · `ended` |

`selectNode`는 도착한 지점의 성격으로 갈린다. 정보 기회가 있으면
`infoOpportunity`, 없으면 `event`, 보스방이면 `boss`다.

`chooseEvent`는 전멸하면 남은 지점과 보스전을 건너뛰고 `settlement`로 간다. 상위
spec의 `사건 도중 전멸하면 남은 지점과 보스전을 건너뛰고 실패 정산으로 간다`를
그대로 옮긴 것이다.

`CAMPAIGN_PHASES`의 `contract`는 전이 함수가 쓰지 않는다. 계약 확인은 화면이
보여주는 단계이고 규칙에는 상태 변화가 없다. `U1`이 만든 확인 패널이 그 자리다.

### 잘못된 전이

현재 단계에서 허용되지 않은 행동은 `RuleError("INVALID_TRANSITION")`을 던지고
**상태를 전혀 바꾸지 않는다.** 검증을 상태를 만들기 전에 끝내므로 절반만 적용된
상태가 남지 않는다.

없는 공고·지점·카드·선택지를 가리키면 `UNKNOWN_ID`다. 현재 지점에서 갈 수 없는
지점을 고르는 것도 여기 포함한다.

### 난수 파생

전이는 상태를 인자로만 받으므로 난수를 상태에서 만들어야 한다. 모든 파생은
`state.seed`와 그 순간의 **안정된 식별자**를 함께 쓴다.

| 쓰임 | 파생 키 |
| --- | --- |
| 지도 생성 | `{seed}/{dungeonId}` → `map` |
| 정보 후보 | `{seed}/{dungeonId}/{nodeId}` → `card` |
| 개인 반응 | `{seed}/{dungeonId}/{nodeId}` → `card` · `trust` |
| 사건 효과 | `{seed}/{dungeonId}/{nodeId}` → `event` |
| 보스전 | `{seed}/{dungeonId}` → `boss` |
| 파티 재편 | `{seed}/{dungeonId}` → `regroup` |

호출 횟수가 아니라 식별자에서 파생하므로, 같은 시드로 같은 선택을 하면 중간에
무엇을 몇 번 했든 같은 결과가 나온다. 같은 던전을 두 번 도전하는 경우(전멸 후
등급 상승)에는 실패 횟수를 키에 넣어 두 번째 도전이 첫 번째와 같아지지 않게 한다.

### 문맥

```ts
interface CampaignMachineContext {
  readonly events: DungeonEventPools;
  readonly cards: readonly InfoCard[];
  readonly items: readonly ItemDef[];
  readonly bosses: readonly BossDef[];
}
```

콘텐츠 풀을 인자로 받는 이유는 규칙 모듈이 그렇게 하고 있기 때문이다. fixture
풀로 전이를 시험할 수 있고, 백테스트가 콘텐츠를 바꿔 가며 재볼 수 있다.

## 백테스트

```ts
simulateCampaign(seed: string, strategy: StrategyName): SimulationReport
runBacktest(options?: { seedCount?: number }): BacktestReport
simulateFixture(name: "baseline"): SimulationReport
```

### 전략

전략은 네 자리에서 고른다. 상태를 직접 바꾸지 않고 후보 중 하나를 고르기만 한다.

```ts
interface Strategy {
  chooseOffer(state, offers): BoardOfferId | null;
  chooseNode(state, expedition, candidates): NodeId;
  chooseCard(state, expedition, cardIds): CardId;
  chooseChoice(state, event, choiceIds): ChoiceId;
}
```

| 전략 | 성격 |
| --- | --- |
| `survivalFirst` | 낮은 등급 공고, 위험이 낮은 갈래, 진실 카드, 지원 행동 |
| `balanced` | 지원 가능한 가장 높은 등급, 중립 카드, 관망 위주 |
| `wipeGoldFirst` | 소지 골드가 많은 파티, 위험한 갈래, 거짓 카드, 방해 행동 |

`wipeGoldFirst`가 배신 전략이다. 파티를 죽여 유품을 챙기는 쪽이 실제로 승급으로
이어지는지가 이번 백테스트의 핵심 질문 중 하나다.

### 기준 시나리오

`simulateFixture("baseline")`은 무작위 시드가 아니라
[성장과 엔딩](../../systems/PROGRESSION_AND_ENDINGS.md)의 프로토타입 승급 속도
기준을 그대로 재현한다. 정산만 순서대로 적용해 checkpoint가 정확히 맞는지 본다.

| 구간 | 진행 | 도달 |
| --- | --- | --- |
| C→B | C급 3개 3명 생존 | 명성 30 · 누적 60 · **120점** |
| B→A | B급 2개 3명 생존 + C급 1개 2명 생존 | 명성 66 · 누적 142 · **274점** |
| A→S | S급 1개 2명 생존 | 명성 90 · 누적 190 · **370점** |

전략 시뮬레이션과 달리 이 fixture는 난수를 쓰지 않는다. 보상표가 바뀌면 여기서
먼저 깨진다.

### 보고서

`BacktestReport`는 합격·불합격을 판정하지 않는다. 상위 plan이 `전략별 목표 비율은
합격 조건이 아니라 후속 밸런스 조정 자료로 남긴다`고 정했다.

강제하는 것은 둘뿐이다.

- 생성 오류 0건
- 시작하자마자 진행 불가능한 시드 0건

나머지는 기록이다. 최초 B·A·S 도달 시점과 도달률, 네 엔딩 비율, 평균 HP·신뢰,
현재·누적 골드 분포, 던전 실패·등급 상승·보스 사망률이다.

### 밸런스 관찰 항목

배정표에 적어 둔 세 건을 이번 보고서가 잰다.

| 항목 | 재는 값 |
| --- | --- |
| 명성 음수 절벽 (C3) | 첫 전멸 뒤 `supportUnavailable`로 끝난 캠페인 비율, 종료 시점의 원정 횟수 |
| 보스전 전 HP 편차 (E3) | 보스방 도착 시 파티 평균 HP의 등급별 분포 |
| 정보 카드 노출 (F3) | 카드별 제시 횟수와 최다·최소 노출 |

특히 첫 번째가 크다. 명성이 음수가 되는 순간 모든 공고가 잠기므로
`wipeGoldFirst`가 시작하자마자 끝날 것으로 예상한다. 예상이 맞는지 숫자로 확인한다.

## 성능

10,000시드 × 3전략이면 30,000 캠페인이고 한 캠페인이 최대 15원정이다. 기본
`runBacktest()`는 테스트에서 도는 값이므로 시드 수를 인자로 받아 테스트는 작은
수로, 전체 보고서는 10,000으로 돌린다. 10,000시드 실행 시간을 재서 plan에 남긴다.

## 테스트 목록

- 허용된 전이가 단계를 정확히 옮긴다
- 잘못된 단계의 행동이 `INVALID_TRANSITION`을 던지고 상태를 바꾸지 않는다
- 없는 ID와 갈 수 없는 지점이 `UNKNOWN_ID`를 낸다
- 전멸이 남은 지점과 보스전을 건너뛰고 정산으로 간다
- 같은 시드와 같은 선택이 같은 최종 상태를 만든다
- 한 캠페인이 게시판에서 엔딩까지 끝까지 진행된다
- `simulateFixture("baseline")`의 checkpoint가 정확히 맞는다
- 세 전략이 모두 완주하거나 엔딩으로 끝난다
- 백테스트에서 생성 오류와 진행 불가 시드가 0건이다
- 밸런스 관찰 세 항목이 보고서에 담긴다

## 이번 범위에서 제외하는 것

| 항목 | 이유 |
| --- | --- |
| Zustand 스토어 | `I1`이 이 전이 함수 위에 올린다 |
| 화면 연결 | `I1`·`U2`·`U3`의 범위다 |
| 단일 런 코드 제거 | 화면이 아직 쓰고 있다. `I1`이 소비자를 옮긴 뒤 지운다 |
| 밸런스 상수 조정 | 보고서를 먼저 남긴다. 조정은 별도 커밋이다 |

## 관련 문서

- [성장과 엔딩](../../systems/PROGRESSION_AND_ENDINGS.md)
- [핵심 게임 루프](../../design/CORE_GAME_LOOP.md)
