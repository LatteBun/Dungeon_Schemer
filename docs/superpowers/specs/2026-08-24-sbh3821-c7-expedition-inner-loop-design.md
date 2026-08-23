# C7 원정 안쪽 전이 설계

## 1. 왜 필요한가

`C7 transitionCampaign` 은 액션 열한 개를 다룬다. 그중 원정에 관한 것은 셋뿐이다.

```
START_EXPEDITION · COMPLETE_EXPEDITION · APPLY_TRUST_BATCH
```

**원정을 시작하고 끝내는 것만 있고 그 사이가 없다.** 지점을 고르고, 상황을
보고, 조언을 고르고, 전투가 벌어지고, 보스방에 이르는 흐름을 전이시킬 액션이
없다. `ActiveExpeditionContext` 가 `ExpeditionState` 를 들고 있지만 그것을
전진시키는 주체가 정해져 있지 않다.

`I1` 스토어가 그 자리를 대신할 수는 있다. 그러면 **화면 계층이 규칙 판단을
하게 된다.** 어느 지점으로 갈 수 있는지, 조언을 어떤 순서로 적용하는지는
규칙의 몫이다. 그래서 여기서 만든다.

## 2. 문서가 이미 정한 흐름

`docs/diagram/expedition-sequence.md` 가 순서를 못박고 있다.

```
지점 선택 → 연결·미방문 검증 → 상황 묘사와 조언 3개
  → 조언 선택 → 살아 있는 파티원별 독립 판정 → 사건 결과 처리
  → 전멸이면 남은 경로·보스 생략, 아니면 지도 복귀
  → 보스방 도달이면 턴 전투 → 사후 검증 → 정산 입력
```

이 설계는 그 순서를 액션으로 옮기기만 한다. **새 규칙을 만들지 않는다.**

## 3. 보관되지 않는 상태 하나

`PreparedExpeditionEvents` 가 어디에도 남지 않는다.

`prepareExpeditionEvents` 가 노드 계획·강한 연계·사용한 사건·보유 단서·물질화
기록을 담아 돌려주는데, `ExpeditionState` 에 그 자리가 없다. 지금은
`materializeNodeEvent` 가 돌려주는 `state` 를 호출부가 들고 있을 뿐이다.

**`ActiveExpeditionContext` 에 둔다.** 그것이 「지금 벌어지는 일」을 담는 자리이고,
`C7` 이 이미 세션 맥락으로 나눠 두었기 때문이다. `ExpeditionState` 에 넣으면
영속 대상이 부풀고, [세션 저장 검토](../../technical/SESSION_PERSISTENCE_REVIEW.md)
가 정리한 저장 목록이 무거워진다.

## 4. 더할 액션

```ts
| { type: "VISIT_NODE"; nodeId: NodeId }
| { type: "CHOOSE_ADVICE"; adviceId: ChoiceId }
| { type: "ENTER_BOSS" }
```

셋뿐이다. 나머지는 이미 있다.

### 4.1 `VISIT_NODE`

지금 노드에서 이어지고 아직 방문하지 않은 지점만 받는다. 그 밖이면
`INVALID_TRANSITION` 이다. 통과하면 `materializeNodeEvent` 로 사건을 확정하고
`currentNodeId`·`visitedNodeIds` 를 옮긴다. 단서가 드러나면
`activateStrongFollower` 로 후속 기회를 연다.

**사건만 확정하고 조언은 아직 고르지 않는다.** 화면이 상황 묘사와 조언 셋을
보여줄 틈이 필요하다.

### 4.2 `CHOOSE_ADVICE`

그 사건의 조언이 아니면 거부한다. 통과하면 문서가 정한 순서를 그대로 탄다.

```
decideImmediateAdvice        살아 있는 파티원별 독립 판정
  → applyEventChoice          사건 결과 처리
  → resolveMonsterEventBattle 몬스터 사건이면 전투
  → finalizeImmediateAdviceTrust  결과를 아는 시점에 신뢰 검증
```

보스 정보 사건은 `resolveBossInfoAdvice` 로 갈라져 지연 기록을 `infoRecords` 에
쌓는다. 즉시 신뢰를 확정하지 않는다.

**전멸하면 남은 경로와 보스를 건너뛰고 원정을 끝낸다.** 문서가 그렇게 정한다.

### 4.3 `ENTER_BOSS`

보스 노드에 이르렀을 때만 받는다. `resolveBossBattle` 이 턴 기록과 사후 검증을
낸다. 그 결과로 `bossResult` 와 `result` 를 채우고 원정을 닫는다.

이미 `COMPLETE_EXPEDITION` 이 정산을 받으므로, 여기서는 정산하지 않는다.
**보스전 결과까지만 만들고 정산 입력을 준비한다.**

## 5. 다루지 않는 것

- 정산·월드턴·승급·엔딩. 이미 `C7` 에 있다
- 규칙 계산 자체. `E1`~`E4` 를 부르기만 한다
- 화면. `I1` 의 몫이다
- 저장·복원

## 6. 검증

- 이어지지 않은 지점, 이미 방문한 지점, 다른 사건의 조언을 거부한다
- 거부된 전이가 상태를 바꾸지 않는다
- 같은 시드에 같은 액션 순서를 넣으면 같은 `ExpeditionState` 가 나온다
- 전멸하면 남은 경로와 보스전이 건너뛰어진다
- 보스 정보를 수용한 파티원만 보스전 modifier 를 받는다
- `PreparedExpeditionEvents` 가 방문 사이에 이어진다. 같은 사건이 두 번 나오지 않는다

## 7. 정하지 않은 것

`VISIT_NODE` 가 사건 확정까지 하는 것이 맞는지. 지점 이동과 사건 확정을 둘로
나눌 수도 있다. 다만 문서의 순서가 「지점 선택 → 검증 → 상황 묘사」로 이어져
있어 하나로 두었다. 화면이 둘 사이에 무언가를 넣어야 한다면 그때 나눈다.
