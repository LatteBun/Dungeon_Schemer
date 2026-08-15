# 용사 대상 정보 판정 설계

- 작성일: 2026-08-15
- 작성자: sbh3821
- 작업 ID: [E2](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)
- 상위 spec: [던전 15개 캠페인 게임 방향 개편](2026-08-13-sanghwan-yoo-game-direction-rework-design.md)의 `정보 카드와 개인 반응`
- 상위 plan: [게임 방향 개편 구현 계획](../plans/2026-08-13-sanghwan-yoo-game-direction-rework.md)의 **Task 6** 중 정보 카드 부분
- 앞선 작업: [등급별 대칭 지도와 정보 기회 생성](2026-08-15-sbh3821-grade-map-generation-design.md)

## 문제

`E1`은 어느 지점에 정보 기회가 있고 어디서 보스 관련 정보를 보장하는지까지만
지도에 남겼다. 실제로 그 지점에 도착했을 때 무엇을 제시하고 파티원이 어떻게
반응하는지는 정해져 있지 않다. 지금 `lib/rules/info.ts`는 단일 런 시절 계약이라
두 가지가 새 규칙과 어긋난다.

- `audience: "boss"` 분기가 남아 있다. 보스는 카드 수신자가 아니다.
- 반응 결과를 탐험 상태에 남길 자리가 없다. 보스전과 사후 검증이 읽을 기록이 없다.

## 카드 후보 제시

`PendingInfo`는 도착한 지점에서 고를 수 있는 카드 후보다. 지점의 성격에 따라
후보 풀이 갈린다.

| 지점 | 후보 풀 | 제시 수 |
| --- | --- | ---: |
| 보스 보장 지점 | 보스 주제 카드만 | 진실·거짓·중립 중 존재하는 것 |
| 그 밖의 정보 지점 | 보스 주제가 아닌 카드만 | 진실·거짓·중립 각 1장 |

보장 지점에서 보스 카드만 제시하는 것은 무엇을 고르든 보스 정보가 전달되게
하려는 것이다. 보장이 `기회가 있었다`가 아니라 `전달됐다`를 뜻하게 된다.

일반 지점에서 보스 주제를 **제외**하는 이유는 `E1`이 경로마다 고정한 보스 보장
수를 실제 전달 수와 같게 유지하기 위해서다. 일반 지점에서도 보스 카드가 나올 수
있으면 지도가 선언한 값이 실제를 설명하지 못한다.

후보가 2장 미만이면 고르는 행위가 확인 버튼과 같아지므로
`RuleError("INVALID_GENERATION")`을 던진다.

### 콘텐츠 공백

F2가 채운 정보 카드 12장 중 보스 주제는 `card-truth-boss`와 `card-lie-boss`
둘뿐이고 **중립 보스 카드가 없다**. 이 때문에 다음 두 가지가 따라온다.

- 보장 지점의 제시 카드는 진실·거짓 2장이고 중립으로 빠질 길이 없다.
- 상위 spec의 `수용한 중립 보스 정보 -10%` 보정이 한 번도 발생하지 않는다.

규칙은 중립 보스 카드가 생기면 그대로 동작하도록 짠다. 공백 자체는 콘텐츠
작업으로 따로 기록한다. A·S급은 경로마다 보장이 2회라 같은 두 장을 두 번 만난다.
카드 중복 금지는 사건에만 걸린 규칙이므로 지금은 허용한다.

## 개인별 반응

카드는 **살아 있는 파티원 전원**에게 전달되고 각자 독립으로 판정한다. 기존
확률표와 성격·신뢰 보정을 그대로 쓴다. 결과는 `accepted`, `suspected`,
`exposed` 셋뿐이다.

수신자를 파티로 못박으므로 `InfoAudience`, `BossInfoCardOptions`,
`BossInfoCardEvaluation`과 `evaluateInfoCard`의 보스 분기를 제거한다. 보스 관련
여부는 이제 `InfoCard.subject`로만 표현한다.

판정 함수는 인물 타입을 제네릭으로 받는다.

```ts
evaluatePartyInfoCard<M extends PartyMember>(options: {
  card: InfoCard;
  party: readonly M[];
  cardRng: Rng;
  trustRng: Rng;
}): PartyInfoCardEvaluation<M>
```

`CampaignMember`를 넣으면 HP·소지 골드·기억이 결과에서도 그대로 남는다. 못박으면
호출자가 매번 단언으로 되돌려야 하고, 그 단언이 실제로 필드를 잃은 자리를
가려버린다. `evaluateTrust`도 같은 이유로 제네릭으로 바꾼다. 판정 규칙은 그대로다.

## 보스 피해 보정

수용한 **보스 주제** 카드만 보정을 만든다. 다른 주제이거나 의심·적발이면 0이다.

| 반응한 카드 | 보정 |
| --- | ---: |
| 수용한 진실 | -0.20 |
| 수용한 중립 | -0.10 |
| 수용한 거짓 | +0.25 |
| 의심·즉시 적발 | 0 |

여러 장의 합산과 `-30%~+50%` 제한은 보스전이 할 일이므로 `E3`에 넘긴다. `E2`는
카드 한 장에 대한 보정만 기록한다. 합산을 여기서 하면 아직 만나지 않은 카드까지
포함한 값을 미리 만들게 된다.

## 탐험 기록

`ExpeditionState`에 `infoRecords: InfoRecord[]`를 더한다.

```ts
interface InfoRecord {
  cardId: CardId;
  subject: InfoSubject;
  memberId: MemberId;
  reaction: InfoReaction;
  modifier: number;
  pendingVerification: boolean;
}
```

기록을 남기는 이유는 보스전과 사후 검증이 **누가 무엇을 믿었는지**를 알아야 하기
때문이다. 정산이 나중에 앞뒤 상태를 비교해도 신뢰가 왜 움직였는지는 복원할 수
없다. `pendingVerification`은 수용된 거짓이며 보스전 뒤 `deceptionExposed`로
검증할 대상을 가리킨다.

`applyInfoRecord(expedition, record)`는 기록과 탐험 로그를 덧붙이기만 한다.
`pendingInfo`를 지우는 것은 단계 전이의 몫이라 `Task 8`에 남긴다. 한 번의 정보
기회가 파티원 수만큼 기록을 만들기 때문에, 마지막 기록이 어느 것인지 판정 함수가
알 수 없다.

## 검증 하네스

`/info-card-test`에서 보스 수신 라디오를 없애고 파티 반응 확인 기능만 남긴다.
`lib/dev-tools/test-snapshots.ts`의 보스 분기도 함께 지운다. 상위 plan Task 10이
`보스 수신자 test helper는 Task 6에서 제거한다`고 적어 둔 부분이다.

## 테스트 목록

- 살아 있는 파티원 수만큼 결과가 나오고 죽은 인물은 빠진다
- 같은 카드라도 성격·신뢰에 따라 반응이 갈린다
- 수용한 거짓은 `pendingVerification`, 의심은 `pendingSuspicionEvaluation`
- 보스 주제 수용만 보정을 만들고 진실·중립·거짓 값이 표와 같다
- 보장 지점은 보스 카드만, 일반 지점은 보스가 아닌 카드만 제시한다
- 후보가 2장 미만이면 구조화된 오류를 낸다
- `applyInfoRecord`가 기록과 로그를 덧붙이고 원본을 바꾸지 않는다
- 같은 시드가 같은 반응을 재현한다
- 등급별 경로에서 실제 전달된 보스 정보 수가 `E1` 보장과 같다

## 이번 범위에서 제외하는 것

| 항목 | 이유 |
| --- | --- |
| 사건 행동 처리 | `E3`의 범위다. 정보 기회는 사건 행동을 대신하지 않는다 |
| 보정 합산과 `-30%~+50%` 제한 | 보스전 입력이므로 `E3`에서 한 번에 한다 |
| 미검증 기록의 사후 검증 | 보스전 뒤에 판정하므로 `E3`이 한다 |
| `pendingInfo` 비우기 | 단계 전이의 몫이라 `Task 8`이 한다 |
| 중립 보스 카드 추가 | F2 콘텐츠 범위라 별도 작업으로 기록한다 |

## 관련 문서

- [정보와 기만](../../systems/INFORMATION_AND_DECEPTION.md)
- [파티와 신뢰](../../systems/PARTY_AND_TRUST.md)
