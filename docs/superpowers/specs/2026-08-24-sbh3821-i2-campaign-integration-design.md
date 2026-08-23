# I2 캠페인 전체 통합 설계

## 1. 무엇을 만드나

인트로부터 엔딩까지를 **하나의 흐름**으로 잇는다. 지금은 화면 일곱이 각자
`/uN-test` 에서 고정 데이터로 돌고, `I1` 스토어는 만들어졌지만 아무 화면도
쓰지 않는다. 둘을 잇는 것이 이 작업이다.

완료 기준은 「인트로→게시판→탐험→정산→월드턴→다음 공고/엔딩이 **같은 시드로
재현**되고 전체 검증 통과」다.

## 2. 이미 있는 것

**규칙은 전부 끝났다.** `C7` 이 전이를, `I1` 이 스토어를 갖고 있다.

**화면도 끝났다.** 일곱 모두 props 로만 받고 콜백으로만 알린다. 화면 안에
캠페인 상태가 없다. 이 성질을 유지한다.

**어댑터도 절반은 있다.** `createU3BoardView(campaign, offers)`,
`createU4MapNodeViews`, `createU4PartyMemberViews`, `toAdviceViews`,
`createU6SettlementView` 가 이미 도메인 입력을 받는다.

## 3. 이 작업의 몫

| | 무엇 |
| --- | --- |
| 어댑터 | 스토어 상태에서 화면 View 를 만든다. 없는 것을 채운다 |
| 콜백 | 화면이 알리는 것을 액션으로 옮긴다 |
| 라우트 | `phase` 로 화면을 고르는 한 페이지 |
| 재현 검증 | 같은 시드·같은 조작이 같은 캠페인을 낸다 |

## 4. 없는 어댑터

세 자리가 비어 있다.

### 4.1 `ExpeditionState` 를 만드는 자리

`START_EXPEDITION` 이 완성된 `ExpeditionState` 를 받는다. 지도 생성, 공개 규칙
결정, 파티 확정이 그 앞에 있어야 한다. **지금 그 일을 하는 곳이 없다.**

**`C7` 에 넣는다.** `prepareFor` 가 사건 계획을 만들듯 원정 상태도 규칙이
만들어야 한다. 화면이 지도를 생성하고 공개 규칙을 정하면, 그것이 곧 화면 계층이
규칙 판단을 하는 것이다.

`START_EXPEDITION` 의 payload 는 바꾸지 않는다. 대신 규칙 계층이
`createExpeditionForOffer(campaign, offer)` 를 내주고 호출부가 그 결과를 넘긴다.
액션 모양을 바꾸면 기존 검사가 통째로 깨지는데, 얻는 것이 없다.

### 4.2 `U4MapNodeView` 의 `publicKindByNodeId`

`createU4MapNodeViews` 가 노드별 공개 분류를 입력으로 받는다. `E3` 의
`PreparedExpeditionEvents.nodePlans` 가 그 값을 갖고 있는데, 지금은 아무도
잇지 않는다. **숨은 `hiddenRole` 은 내보내지 않는다** — 공개되는 것은 `category`
뿐이다.

### 4.3 `U5ProgressView` 전체를 만드는 자리

조언 View 는 `toAdviceViews` 가 만들지만, 장면·상황·파티·결과를 묶는 어댑터가
없다. 프리뷰가 손으로 조립하고 있다.

## 5. 콜백을 액션으로

| 화면 | 콜백 | 액션 |
| --- | --- | --- |
| U2 | 게시판 진입 | `OPEN_BOARD` |
| U3 | `onSelectOffer` | `SELECT_CONTRACT` |
| U3 | `onContract` | `START_EXPEDITION` |
| U3 | `onOpenPromotion` · `onCancelPromotion` · `onConfirmPromotion` | `OPEN_PROMOTION` · `CANCEL_PROMOTION` · `PROMOTE_GUIDE` |
| U4 | `onMove` | `VISIT_NODE` |
| U5 | `onSelectAdvice(slot)` | `CHOOSE_ADVICE(adviceId)` |
| U5-2 | 보스방 도달 | `ENTER_BOSS` |
| U6 | 다음으로 | `COMPLETE_EXPEDITION` → `START_WORLD_TURN` → `COMPLETE_WORLD_TURN` |

`onSelectNextNode` 는 액션이 아니다. 고르기만 하고 아직 움직이지 않은 상태라
화면의 것이다.

### 5.1 슬롯과 조언 ID

`U5` 는 슬롯 번호만 알린다. **화면이 `ChoiceId` 를 알면 안 된다** — ID 가
`-help`/`-harm` 으로 끝나 정답이 새기 때문이다. 어댑터가 `adviceIdForSlot` 으로
옮긴다. 그 함수는 이미 있다.

## 6. 라우트

`/campaign` 하나를 둔다. `phase` 로 화면을 고르고, 화면은 자기가 무엇인지 모른다.

`/uN-test` 는 **그대로 둔다.** 화면 하나를 아홉 상태로 보는 자리는 통합 뒤에도
필요하다. 프리뷰 데이터도 건드리지 않는다.

## 7. 재현 검증

같은 시드에 같은 조작 순서를 넣으면 같은 캠페인이 나와야 한다. 조작을 액션
목록으로 적어 두 번 돌리고 결과를 비교한다.

**화면을 거치지 않고 스토어로 돌린다.** 렌더를 섞으면 무엇이 달라졌는지
가려진다. `I1` 이 스토어를 React 밖에 둔 이유가 여기서 살아난다.

한 판을 끝까지 도는 검사를 하나 둔다. 인트로에서 시작해 엔딩에 이를 때까지
액션을 넣고, 도중에 `rejected` 가 생기지 않는지 본다.

## 8. 다루지 않는 것

- 규칙·콘텐츠 변경
- 저장·복원
- 밸런스. `B1` 의 몫이다
- 접근성 전수 검증. `Q1` 의 몫이다
- 화면 컴포넌트의 구조. 어댑터와 콜백만 붙인다

## 9. 위험

**원정 안쪽이 가장 크다.** 지도에서 지점을 고르고, 진행 화면에서 조언을 고르고,
전투를 보고, 다시 지도로 돌아오는 왕복이 `phase` 하나(`expedition`) 안에서
일어난다. `phase` 만으로는 U4·U5·U5-2 를 가를 수 없다.

`ActiveExpeditionContext` 의 `pendingEvent` 가 그 답이다.

| 상태 | 화면 |
| --- | --- |
| `pendingEvent === null` · 보스방 아님 | U4 지도 |
| `pendingEvent !== null` | U5 진행 |
| `bossResult !== null` | U5-2 보스 재생 |

전투 재생이 끝나야 다음으로 갈 수 있다는 것도 화면의 몫이다. 규칙은 이미
결과를 다 냈고 재생은 표현이다.

## 10. 원정 로그는 `CampaignHistory` 에 쌓는다

`COMPLETE_EXPEDITION` 이 받는 `SettlementSnapshot` 의 `causeInputs` — 선택·반응·
피해 세 문장은 원정 중에 쌓아야 한다.

**새 그릇을 만들지 않는다. `C8-B` 가 이미 만들어 두었다.** `CampaignState.history`
가 `CampaignEvent[]` 를 담고, `toAdviceResolvedEventDraft` 가 사건·조언·수용
여부·개인 반응을 담는 draft 를 만들고, `appendCampaignEvent` 가 중복과 무결성을
검사하며 붙인다.

그런데 **아무도 부르지 않고 있다.** `C8-B` 가 「`I1` Store 적용과 `I2`/`U6` 소비는
후속 통합 책임」이라 적어 둔 그대로다.

`C7` 의 `CHOOSE_ADVICE`·`ENTER_BOSS` 안에서 붙인다. 전이가 일어날 때 규칙이
기록하므로 누락이 구조적으로 불가능하다. 스토어에서 `dispatch` 뒤에 붙이면
기록을 빠뜨릴 수 있고, 캠페인 기록을 화면 계층이 소유하게 된다.

덤으로 `U6` 엔딩의 「가장 큰 전환점」이 지금 `null` 인 것도 함께 채워진다.
`deriveTurningPoints` 와 `selectHighlightedTurningPoint` 가 이미 있다.

## 11. 선행 — C7 확장

위 둘은 `C7` 을 고쳐야 한다. `I2` 를 시작하기 전에 별도 작업으로 먼저 넣는다.
`C7` 담당이 다른 작업 중이라 구두 합의 후 `sbh3821` 이 대신 진행한다. 원정 안쪽
전이(#125)와 같은 이유다.
