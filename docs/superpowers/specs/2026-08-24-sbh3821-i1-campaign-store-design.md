# I1 상태 머신·스토어 설계

## 1. 무엇을 만드나

C7 `transitionCampaign` 을 호출하고, 영속 `CampaignState` 와 분리된 세션
`CampaignTransitionContext` 를 스토어에 보관하며, 화면 일곱에 결과를 공급한다.

### 1.1 이미 있는 것

**C7 이 순수 리듀서를 끝냈다.** 이 작업이 규칙을 새로 쓰지 않는다.

```ts
transitionCampaign(campaign, context, action): CampaignTransitionResult
```

액션 열한 개가 정의돼 있다 — `OPEN_BOARD` `SELECT_CONTRACT` `CANCEL_CONTRACT`
`START_EXPEDITION` `COMPLETE_EXPEDITION` `START_WORLD_TURN` `COMPLETE_WORLD_TURN`
`OPEN_PROMOTION` `CANCEL_PROMOTION` `PROMOTE_GUIDE` `APPLY_TRUST_BATCH`.

잘못된 전이는 `RuleError("INVALID_TRANSITION")` 을 던진다. 그 판단도 C7 이
이미 한다.

### 1.2 이 작업의 몫

- 상태를 들고 있는 것
- 액션을 받아 C7 에 넘기고, 던지면 상태를 지키는 것
- 화면 일곱이 읽을 모양으로 내주는 것
- **뒤로가기가 되살린 낡은 화면을 거부하는 것**

## 2. 다루지 않는 것

규칙·콘텐츠·화면 컴포넌트를 바꾸지 않는다. 저장·복원은 범위 밖이다. 프리뷰
`*-preview-data.ts` 도 그대로 둔다 — 화면 검증용이고 스토어와 별개다.

전체 흐름이 같은 시드로 재현되는지는 `I2` 가 본다.

## 3. 두 상태를 나누는 이유

| | 무엇 | 수명 |
| --- | --- | --- |
| `CampaignState` | 캠페인의 진실. 시드·풀·던전·명성·통계 | 캠페인 전체 |
| `CampaignTransitionContext` | 지금 고른 공고, 진행 중인 원정 | 그 순간 |

C7 이 이미 둘을 나눠 받는다. 스토어도 나눠 들고, **화면은 둘 다 직접 만지지
않는다.**

## 4. 스토어 모양

```ts
interface CampaignStore {
  readonly campaign: CampaignState;
  readonly context: CampaignTransitionContext;
  /** 마지막 전이가 낸 것. 화면이 정산·엔딩을 그릴 때 쓴다. */
  readonly last: CampaignTransitionResult | null;
  /** 거부된 전이. 화면이 왜 안 되는지 말할 수 있게 남긴다. */
  readonly rejected: { readonly type: string; readonly reason: string } | null;
  dispatch(action: CampaignTransition): void;
}
```

`dispatch` 는 **던지지 않는다.** C7 이 던지면 잡아서 `rejected` 에 담고 상태를
그대로 둔다. 잘못된 조작 하나가 캠페인을 깨뜨리면 안 된다.

## 5. 뒤로가기 — I1 이 반드시 다뤄야 하는 것

[세션 저장 검토](../../technical/SESSION_PERSISTENCE_REVIEW.md) 가 측정해 둔
문제다. 브라우저가 bfcache 로 문서를 통째로 되살리므로 `useState` 값이 전부
남는다. 지금은 화면이 서로 이어지지 않아 드러나지 않지만, 이 작업이 흐름을
붙이는 순간 함정이 된다.

계약을 맺고 지도로 갔다가 뒤로 가면 게시판이 `계약 전` 모습으로 되살아나 같은
공고를 다시 계약할 수 있다.

**두 겹으로 막는다.**

1. `phase` 가 화면을 정한다. 화면이 스스로 "나는 게시판이다" 라고 우기지 못한다.
   되살아난 화면도 다시 그릴 때 현재 `phase` 를 본다.
2. `pageshow` 의 `persisted` 가 참이면 스토어를 다시 읽어 그린다.

그래도 새어 나오는 조작은 C7 이 `INVALID_TRANSITION` 으로 거부한다. **세 겹이다.**

## 6. 화면에 공급하는 방식

화면은 이미 View 타입만 안다. 스토어는 그 View 를 만드는 함수를 부른다.

```
CampaignState + Context  →  [화면별 어댑터]  →  View  →  화면
```

어댑터는 이미 대부분 있다 — `createU6SettlementView`, `toAdviceViews`,
`u3-board-model`, `u4-dungeon-map-model` 이 그 자리다. `I2` 가 원정 안쪽을 이을
때 나머지를 채운다.

이 작업은 **`phase` 마다 어느 화면을 그릴지**까지만 정한다.

| `phase` | 화면 |
| --- | --- |
| `intro` | U2 |
| `board` · `contract` | U3 |
| `expedition` | U4 · U5 · U5-2 |
| `settlement` · `worldTurn` | U6 |
| `ended` | U6 엔딩 |

## 7. 검증

- 액션 열한 개가 각각 옳은 `phase` 에서만 통과한다
- 거부된 전이가 상태를 바꾸지 않는다
- `phase` 가 화면을 정한다. 같은 `phase` 에 두 화면이 겹치지 않는다
- 같은 시드로 같은 액션 순서를 넣으면 같은 상태가 나온다
- `dispatch` 가 던지지 않는다

## 8. 정하지 않은 것

스토어를 무엇으로 만들지. Zustand 5.0.14 가 이미 의존성에 있고
`DEVELOPMENT_ENVIRONMENT.md` 도 그것을 적어 두었으나, 지금 저장소에서 쓰는 곳이
없다. C7 이 순수 리듀서라 `useReducer` 로도 성립한다.

**Zustand 를 쓴다.** 이유는 화면 일곱이 같은 상태를 읽어야 하는데 `useReducer`
로는 그 상태를 어딘가에서 아래로 내려보내야 하고, 그 통로가 곧 또 하나의 구조가
되기 때문이다. 이미 있는 의존성이라 새로 늘리는 것도 아니다.
