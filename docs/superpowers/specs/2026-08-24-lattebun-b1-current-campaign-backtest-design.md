# B1 현행 캠페인 백테스트 설계

- 작성일: 2026-08-24
- 작성자: lattebun
- 작성 도구: Codex
- 대상 작업: `B1`
- 기준 브랜치: `main`
- 기준 커밋: `6347654` (PR #130 병합)

## 1. 문서의 지위

이 문서는 캠페인 전체 통합 뒤의 실제 게임을 측정하는 **B1-A 진단 단계**를
설계한다. 2026-08-17의 구 밸런스 설계와 백테스트는 정보 카드·승급 점수·던전
등급 모델을 전제로 하므로 현행 캠페인의 구현 근거가 아니다.

B1은 두 단계로 진행한다.

1. **B1-A 현행 진단:** 실제 Store와 규칙을 바꾸지 않고 여섯 전략 조합을 측정한다.
2. **B1-B 조건부 재설계:** B1-A가 승인된 기준을 통과하지 못할 때만 별도
   brainstorming·spec·plan으로 연다.

이 문서는 B1-B의 변경안을 미리 정하지 않는다. B1-B에서는 필요하면 보상·전투·
신뢰·승급·편성·엔딩뿐 아니라 프로토타입 고정 범위도 검토할 수 있지만, B1-A
보고서와 사용자 승인이 먼저다.

## 2. 배경

I2가 인트로부터 엔딩까지 캠페인 한 판을 실제 Store 위에서 연결했다. 현재 자동
순회 기록은 150시드가 모두 엔딩에 도달했지만 `exhausted` 148 · `unemployed` 2로
인력 소진에 크게 쏠렸다.

기존 `BACKTEST_REPORT.md`는 현행 게임을 측정하지 않는다.

- `survivalFirst`·`balanced`·`wipeGoldFirst` 3전략만 있고 추론 정확도 축이 없다.
- `card-truth-*` 같은 제거된 정보 카드 모델을 센다.
- 현재 `vitest.backtest.config.ts`가 찾는 `*.run.ts` 실행 파일도 없다.
- 현재 캠페인의 E1~E4·C4~C8·I1 Store 흐름을 소비하지 않는다.

따라서 B1-A의 첫 책임은 숫자를 조정하는 것이 아니라, 실제 캠페인을 재현 가능하게
측정하고 전략·정확도·게임 결과의 인과를 읽을 수 있는 기준선을 만드는 것이다.

## 3. 목표와 비목표

### 3.1 목표

- 실제 `createCampaignStore`와 프로덕션 전이 액션으로 캠페인을 끝까지 실행한다.
- 생존·기회주의적 균형·선별적 배신 3전략을 플레이어 공개 정보만으로 구현한다.
- 각 전략을 추론 정확도 0.4와 0.7에서 같은 시드로 비교한다.
- 오류·거부·정체·비결정성을 숨기지 않고 재현 시드와 함께 보고한다.
- calibration 결과로 합격 수치를 사용자와 합의한 뒤 별도 holdout으로 판정한다.
- 결과가 기준을 통과하면 B1을 완료하고, 실패하면 B1-B가 필요한 근거를 남긴다.

### 3.2 비목표

- B1-A에서 게임 규칙·상수·콘텐츠·화면을 조정하지 않는다.
- 백테스트 전용 간이 전투·정산·엔딩 규칙을 만들지 않는다.
- 숨은 정답·미방문 사건·미래 난수를 전략에 노출하지 않는다.
- 단서 문장을 해석하거나 학습하는 새 규칙 학습 시스템을 만들지 않는다.
- calibration 결과를 본 같은 시드에 맞춰 최종 합격을 선언하지 않는다.
- 원시 캠페인 12,000개의 전체 상태나 행동 기록을 저장소에 커밋하지 않는다.

## 4. 확정한 원칙

### 4.1 배신은 정상 완주 가능한 고위험 전략이다

선별적 배신은 무조건 전멸시키는 전략이 아니다. 공개된 인력·직업 균형·HP·신뢰·
소지 골드·던전 위험도를 보고 감당 가능한 원정에서만 유품을 노린다. 잘 운영하면
15개 던전 정상 완주가 가능해야 하며, 완주율은 생존 전략보다 낮아도 0에 수렴해서는
안 된다.

### 4.2 추론 정확도는 선택 단위 정답률이다

전략은 각 조언 기회에서 `help`·`neutral`·`harm` 의도 하나를 낸다. 정확도 선택기는
0.4 또는 0.7 확률로 그 의도와 같은 내부 결과의 조언을 고른다. 실패하면 나머지 두
결과 중 하나를 결정적으로 고른다.

전략은 내부 결과를 읽지 않는다. 정확도 선택기만 조언을 실제 ID로 바꾸는 순간에
내부 결과를 본다.

### 4.3 같은 시드끼리 비교한다

한 번호의 캠페인 시드는 여섯 조합이 공유한다. 전략용 난수는 게임 RNG와 분리된
`backtest` 전용 스트림에서 소비한다. 전략이나 정확도를 바꿔도 캠페인 RNG를 추가로
소비하지 않는다.

### 4.4 측정과 재설계를 분리한다

B1-A에서 먼저 현행 규칙의 결과를 측정한다. 실패 지표를 보았다는 이유로 같은
변경 단위에서 게임 규칙을 즉시 고치지 않는다. B1-B가 필요하면 보고서 승인 뒤
별도 설계로 진행한다.

## 5. 아키텍처

```text
StrategyPolicy
  │ 공개 decision view → 행동 의도
  ▼
AccuracySelector
  │ 조언 선택 순간에만 내부 outcome → AdviceId
  ▼
HeadlessCampaignDriver
  │ 실제 CampaignTransition
  ▼
Campaign Store → C7 → E1~E4 → C4~C8
  │
  ▼
CampaignRunResult → MetricsAggregator → BacktestReport → Markdown
```

### 5.1 `campaign-driver`

`createCampaignStore(seed)`로 실제 Store를 만든다. phase와 원정 문맥을 읽어 다음
결정 view를 전략에 전달하고, 전략 결과를 실제 액션으로 dispatch한다.

driver는 규칙을 계산하지 않는다. 다음 프로덕션 API를 그대로 사용한다.

- `createCampaignStore`
- `createExpeditionForOffer`
- `createSettlementSnapshotFor`
- `getGuidePromotionEligibility`
- Store가 호출하는 `transitionCampaign`과 C8 통계 누적

기존 `lib/store/campaign-full-run.test.ts`의 반복 루프는 이 driver를 사용하도록
옮긴다. 통합 회귀와 백테스트가 캠페인을 진행하는 방식이 갈라지지 않게 한다.

### 5.2 `strategy`

전략은 decision view를 받아 다음 중 하나를 반환한다.

- 공고 ID
- 승급 대기 또는 승급 방식
- 다음 공개 노드 ID
- 조언 의도 `help | neutral | harm`

전략이 임의의 `CampaignTransition`을 직접 만들게 하지 않는다. driver가 전략의
좁은 결정을 유효한 프로덕션 액션으로 바꾼다.

### 5.3 `accuracy-selector`

조언 의도와 실제 세 조언을 받아 `AdviceId`를 반환한다. 내부 결과를 읽는 유일한
경계다. 전략용 난수는 다음 입력으로 결정한다.

```text
campaign seed
+ strategy id
+ accuracy id
+ expedition id
+ decision index
```

이 입력에는 게임 RNG 상태를 넣거나 소비하지 않는다.

### 5.4 `metrics`와 `report`

driver가 캠페인 한 판의 구조화된 결과를 반환하고, 집계기가 조합별·paired 비교별
통계를 만든다. Markdown 생성기는 집계 객체만 소비한다. 측정과 표현을 분리해 같은
통계를 테스트와 보고서가 공유한다.

## 6. 공개 정보 경계

전략에는 거대한 `CampaignState`를 그대로 넘기지 않는다. 결정별 읽기 전용 view를
만든다.

### 6.1 게시판 view

- 현재 등급·명성·현재 골드·누적 골드
- 남은 던전 수와 공개된 던전 이름·테마·현재 위험도·보상·잠금 사유
- 공고별 출전 3인의 ID·직업·성격·HP·최대 HP·신뢰·소지 골드·중상 여부
- 캠페인 풀의 생존·신뢰·중상·직업별 인원
- 현재 승급 가능 방식과 비용

### 6.2 지도 view

- 현재 위치·방문한 위치·선택 가능한 다음 노드
- UI가 공개하는 노드 category와 보스 위치
- 현재 파티의 공개 상태·현재 골드·pending merchant 유무
- 공개 생태 규칙과 지금까지 얻은 관찰 단서

`bossInfo`·`strongPredecessor`·`strongFollower` 같은 숨은 역할은 제외한다.

### 6.3 조언 의도 view

- 사건 category·제목·상황 묘사
- 화면에 표시되는 조언 문구와 비용
- 현재 파티 공개 상태·현재 골드·pending merchant 유무
- 공개 생태 규칙·관찰 단서·진행 기록
- 해당 원정을 배신 대상으로 잠갔는지 여부

내부 `outcome`, 생태 relation, 적용될 effect, 수용·적발 난수, 미래 전투 결과는
포함하지 않는다.

TypeScript 타입과 런타임 projection 테스트가 이 경계를 함께 지킨다.

## 7. 전략 정의

세 전략은 모두 결정적이다. 비교기의 마지막 동률만 전용 전략 스트림으로 푼다.

### 7.1 생존형 `survival`

목적은 정상 완주와 인력 보존이다.

- 공고: 현재 위험도 오름차순 → 파티 최소 HP 비율 내림차순 → 파티 최소 신뢰
  내림차순 → 결정적 동률 순서
- 경로 category 우선순위: `rest → merchant → special → monster → boss`
- 조언 의도: `help`
- 승급: 명성 승급은 즉시 사용한다. 골드 승급은 현재 등급으로 진입 가능한 미클리어
  던전이 1개 이하이고 그 승급이 남은 던전을 실제로 열 때만 사용한다. 마지막
  진입 가능 던전을 계약하기 전에 다음 구간을 열 기회를 남긴다

### 7.2 기회주의적 균형형 `opportunist`

목적은 의도적 전멸 없이 보상과 캠페인 진도를 앞당기는 것이다.

- 공고: 현재 위험도 내림차순 → 명성 보상 내림차순 → 골드 보상 내림차순 → 파티
  최소 HP 비율 내림차순 → 결정적 동률 순서
- 경로 category 우선순위: `special → merchant → rest → monster → boss`
- 조언 의도: 기본 `help`. 다음 골드 승급이 남아 있고 merchant에서 현재 골드가
  그 승급 비용과 공식 merchant 콘텐츠의 최대 비용을 함께 감당하지 못하면
  `neutral`. 이미 S라 다음 승급이 없으면 이 reserve 조건을 적용하지 않는다
- 승급: 명성 승급을 우선한다. 골드 승급은 새 위험도 던전을 열고, 지불 뒤에도 공식
  merchant 콘텐츠의 최대 비용만큼 남을 때 사용한다

merchant 최대 비용은 백테스트 숫자로 복사하지 않고 공식 콘텐츠에서 파생한다.

### 7.3 선별적 배신형 `selectiveBetrayal`

목적은 일부 원정의 유품 골드를 얻으면서 정상 완주 가능성을 유지하는 것이다.

공고를 고를 때 현재 파티 전멸을 가정한다. 파티를 제외한 공개 캐릭터 풀에서 다음
두 capacity를 계산한다.

- `normalCapacity`: 생존·신뢰 > 0·중상 아님인 캐릭터로 만들 수 있는 서로 겹치지
  않는 3직업 파티의 최대 수
- `emergencyCapacity`: 생존·신뢰 > 0인 중상자까지 포함한 같은 최대 수

배신 후보는 다음을 모두 만족한다.

1. 전멸 뒤 `emergencyCapacity >= 1`
2. 남은 던전이 3개보다 많으면 `normalCapacity >= 2`
3. 파티 소지 골드 합계가 현재 진입 가능한 공고 파티 합계의 중앙값 이상

남은 던전이 3개 이하면 정상 capacity 두 파티 조건을 풀고 응급 한 파티 하한까지
위험을 허용한다.

후보가 있으면 파티 소지 골드 합계 내림차순 → 위험도 내림차순 → 결정적 동률
순서로 하나를 고르고, 그 원정을 배신 모드로 잠근다. 후보가 없으면 생존형 공고
정책과 조언 의도로 돌아간다. 원정 도중 결과를 보고 배신 모드를 켜거나 끄지 않는다.

- 배신 모드 경로: `monster → special → merchant → rest → boss`
- 배신 모드 조언 의도: `harm`
- 비배신 모드: 생존형 경로와 `help`
- 승급: 명성 승급을 우선한다. 명성이 부족하고 현재 등급으로 진입 가능한 미클리어
  던전이 1개 이하일 때 유품 골드로 새 위험도를 여는 승급을 사용한다

## 8. 정확도 선택

모든 공식 사건은 help·harm·neutral을 하나씩 공급한다. 선택기는 다음 순서로
동작한다.

1. 전략 스트림에서 `[0, 1)` 값을 하나 만든다.
2. 값이 accuracy보다 작으면 의도와 같은 outcome을 고른다.
3. 아니면 나머지 두 outcome을 두 번째 결정값으로 고른다.
4. 선택한 option의 실제 `AdviceId`를 driver에 돌려준다.

정확도 실패가 항상 정반대 결과를 뜻하지 않는다. help 의도 실패는 neutral 또는
harm이고, harm 의도 실패는 neutral 또는 help다. 이 구조로 0.4와 0.7은 정답 라벨을
UI에 노출하지 않으면서 선택 품질만 바꾼다.

## 9. driver 상태 전이

driver는 최대 800 action 안에서 다음 순서를 반복한다.

```text
intro       → OPEN_BOARD
board       → 승급 결정 또는 공고 선택
contract    → START_EXPEDITION
expedition  → VISIT_NODE / CHOOSE_ADVICE / ENTER_BOSS
종료 원정   → COMPLETE_EXPEDITION
settlement  → START_WORLD_TURN
worldTurn   → COMPLETE_WORLD_TURN
ended       → 결과 반환
```

화면 callback을 부르지는 않지만 화면이 부르는 것과 같은 액션과 helper를 쓴다.
phase보다 원정 문맥을 먼저 보고 정산을 중복 처리하지 않는다. 보스 노드는 먼저
방문한 뒤 `ENTER_BOSS`를 보낸다.

전략의 선택이 현재 view 후보에 없으면 `strategyInvalidDecision`이다. Store가 액션을
거부하면 `rejectedTransition`이다. 어느 쪽도 다른 선택으로 대체하지 않는다.

## 10. 실행 모드와 시드

### 10.1 단위·회귀

소수 고정 시드만 `pnpm test`에 포함한다. driver·전략·통계·보고서 계약을 빠르게
검사하며 밸런스 합격을 선언하지 않는다.

### 10.2 calibration

```text
pnpm backtest:quick
```

3전략 × 2정확도 × 조합당 200시드, 총 1,200캠페인이다. 시드 namespace는
`b1-calibration-v1`이다.

calibration은 다음 두 목적만 가진다.

- 전략이 합의한 행동을 실제로 하는지 확인
- 완주율 구간·최소 효과 크기·엔딩 쏠림 상한의 승인안을 만들기

게임 규칙은 바꾸지 않는다. 전략 구현이 설계와 다른 경우만 고친다. 전략 정책
자체를 바꿔야 하면 변경 근거와 전후 분포를 제시하고 사용자 승인을 받는다.

### 10.3 holdout

```text
pnpm backtest
```

3전략 × 2정확도 × 조합당 2,000시드, 총 12,000캠페인이다. 시드 namespace는
`b1-holdout-v1`이다.

holdout 전에 calibration으로 합의한 수치를 이 spec과 공식 설정집에 기록하고
사용자 승인을 받는다. holdout 결과를 본 뒤 같은 결과에 맞춰 합격선을 옮기지 않는다.
기준이 부당하다는 새 근거가 생기면 기준 변경을 별도로 승인받고 namespace 버전을
올려 새로운 holdout으로 다시 검증한다.

## 11. 고정 게이트와 calibration 게이트

### 11.1 지금 고정하는 게이트

- 생성 오류 0건
- 거부 전이 0건
- 전략의 유효하지 않은 결정 0건
- 800 action 진행 한도 초과 0건
- 같은 시드·전략·정확도의 비결정적 결과 0건
- 관측한 조언 의도 적중률의 Wilson 99.9% 신뢰구간이 설정한 0.4 또는 0.7을 포함.
  정상 표본 변동을 기능 실패로 오인하지 않도록 결과 지표의 95%보다 넓게 잡는다
- 각 전략·정확도 조합의 S 도달률이 100% 미만
- 정확도 0.7 선별적 배신에서 정상 완주가 1건 이상
- 0.4와 0.7의 paired 결과 차이가 통계적 차이와 플레이상 실질 차이를 함께 가짐

마지막 항목의 실질 차이 최솟값은 calibration 승인값을 사용한다.

### 11.2 calibration 뒤 고정하는 게이트

- 정확도 0.7의 전략별 정상 완주율 구간
- 전략별 정확도 효과의 최소 크기
- 한 조기 엔딩으로의 최대 허용 쏠림
- 생존 인력·유품 골드로 확인하는 전략 분리의 최소 크기
- 선별적 배신의 최소 배신 시도 비율

초기 가설은 생존 완주율이 가장 높고, 균형형이 중간이며, 배신형이 가장 낮되 0이
아닌 분포다. 이 가설은 calibration을 해석하는 출발점이지 holdout 합격선이 아니다.

## 12. 지표와 통계

### 12.1 캠페인 결과

- 정상 완주 여부와 최종 C·B·A·S 등급
- 엔딩 종류
- 총 원정·클리어·전멸·사망
- 남은 생존·출전 가능·신뢰 0·중상 인원
- 현재 명성·현재 골드·누적 획득 골드·유품 골드
- 평균·중앙값 신뢰와 HP 비율
- 명성 승급·골드 승급 횟수와 최초 B·A·S 도달 원정

유품 골드는 정산 이벤트에서 전멸 사망자의 소지 골드 합계를 누적해 별도 측정한다.
현재 골드나 누적 골드에서 역산하지 않는다.

### 12.2 전략 행동

- 공고·경로 category 선택 횟수
- help·neutral·harm 의도와 실제 선택
- 배신 후보·배신 모드·실제 전멸 횟수
- 조언 수용·의심·적발
- merchant 지출과 효과 소비

### 12.3 통계 방법

- 단일 결과 비율: Wilson 95% 신뢰구간
- 정확도 선택기 적중률 검정: Wilson 99.9% 신뢰구간
- 연속·순서형 지표: 평균과 중앙값, 표본 표준편차
- 같은 시드 비교: 시드별 차이의 평균과 `1.96 × 표준오차` 95% 신뢰구간
- 통계적 차이: paired 차이 신뢰구간이 0을 제외
- 실질적 차이: calibration 뒤 승인한 최소 효과 크기 충족

외부 통계 라이브러리를 추가하지 않는다. 보고서가 사용하는 수식은 작은 고정
fixture로 손계산 값과 대조한다.

## 13. 오류 처리

다음 실패 종류를 구분한다.

| 종류 | 의미 |
| --- | --- |
| `generationError` | 캠페인·지도·사건 생성 실패 |
| `rejectedTransition` | Store가 전략 액션을 거부 |
| `strategyInvalidDecision` | 전략이 공개 후보 밖의 행동을 반환 |
| `stalledCampaign` | 엔딩이 아닌데 진행 가능한 행동이 없음 |
| `stepLimitExceeded` | 800 action 안에 엔딩 미도달 |
| `nonDeterministicResult` | 같은 입력 재실행 결과 불일치 |
| `aggregationError` | 누락·비유한 수·분모 0 등 집계 실패 |

실패가 하나 나도 다른 시드를 계속 실행해 총개수와 대표 재현 시드를 모은다.
자동 retry나 조용한 대체 선택은 없다. 오류가 있으면 보고서는 `FAIL`로 생성하고
명령은 종료 코드 1을 반환한다.

## 14. 보고서 계약

`docs/technical/BACKTEST_REPORT.md`는 생성기가 쓰는 산출물이며 손으로 고치지 않는다.
같은 코드·설정·시드에서 byte-for-byte 같아야 한다.

보고서에는 다음을 넣는다.

- 측정 대상 소스 커밋과 백테스트 계약 버전. 보고서 파일 자체를 더하는 커밋이
  아니라 실행기가 읽은 소스 revision을 기록한다
- 전략 정의·정확도·시드 namespace·표본 수
- 고정 게이트와 calibration 승인 게이트
- 조합별 지표와 95% 신뢰구간
- 같은 시드 기준 0.4↔0.7, 전략↔전략 paired 차이
- 오류 개수와 대표 재현 시드
- 각 기준의 PASS/FAIL
- B1-B 필요 여부와 실패 지표

실행 시간은 콘솔에만 출력한다. 보고서에 넣으면 같은 결과도 매번 diff가 생기므로
제외한다. 원시 실행 기록은 커밋하지 않고 대표 실패·전환점만 남긴다.

## 15. 테스트 전략

### 15.1 공개 경계

- decision view에 숨은 조언 outcome·relation·effect가 없음
- 지도의 숨은 역할과 미방문 사건이 없음
- projection 결과가 원본을 변경하지 않음

### 15.2 정확도 선택기

- 같은 입력은 같은 AdviceId
- 0.4·0.7 관측률의 Wilson 99.9% 신뢰구간이 목표값을 포함
- 정확도 변경이 게임 RNG 결과를 추가 소비하지 않음
- 실패 선택이 나머지 두 outcome에 결정적으로 분포

### 15.3 전략

- 세 전략의 공고·경로·조언·승급 정책
- 배신의 normal/emergency capacity 경계
- 중앙값 유품 조건과 마지막 3개 던전 완화
- 후보가 없을 때 생존형 fallback
- 원정 중 배신 모드 불변

### 15.4 driver

- 기존 I2 고정 시드와 같은 엔딩·통계
- 지도 방문 뒤 보스 진입 순서
- 정산 중복 없음
- 잘못된 전략·거부 전이·정체·step limit 분류
- 같은 입력의 전체 결과 동일

### 15.5 집계·보고서

- 손계산 fixture와 평균·비율·Wilson·paired 차이 일치
- calibration은 밸런스 합격을 선언하지 않음
- holdout만 승인 기준을 판정
- 오류 보고서가 FAIL·개수·재현 시드를 포함
- 같은 집계 객체의 Markdown이 byte-for-byte 동일

12,000캠페인 실행은 `pnpm test`에 넣지 않는다.

## 16. 파일 영향

### 새 파일

```text
lib/backtest/public-state.ts
lib/backtest/accuracy-selector.ts
lib/backtest/strategies.ts
lib/backtest/campaign-driver.ts
lib/backtest/metrics.ts
lib/backtest/report.ts
lib/backtest/backtest.run.ts
lib/backtest/*.test.ts
```

구현 중 책임이 명확하면 테스트 파일은 각 모듈 옆에 둔다. 한 파일이 전략·실행·
통계·Markdown 생성을 함께 소유하지 않는다.

### 수정 파일

```text
lib/store/campaign-full-run.test.ts
package.json
vitest.backtest.config.ts
docs/technical/BACKTEST_REPORT.md
docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
docs/systems/PROGRESSION_AND_ENDINGS.md
docs/README.md
```

`package.json`은 `backtest:quick`과 `backtest` 명령을 제공한다. 기존 backtest config는
`*.run.ts` 전용이라는 경계를 유지한다.

## 17. 문서와 작업 상태

배정표에는 조건부 B1-B 행을 미리 만들지 않는다. B1 행 안에 B1-A와 조건부 B1-B
절차를 기록하고 Q1은 B1이 끝날 때까지 막는다.

- B1-A holdout 통과: 보고서를 동봉하고 B1을 완료 처리
- B1-A holdout 실패: B1을 미완료로 유지하고 보고서 승인 뒤 B1-B spec 작성
- B1-B 완료: 새로운 namespace holdout을 통과한 뒤 B1 완료 처리

calibration 승인 수치를 반영할 때 이 spec과 `PROGRESSION_AND_ENDINGS.md`를 함께
갱신한다. 게임 규칙이 바뀌는 B1-B에서는 `GAME_PRINCIPLES.md`부터 관련 시스템
문서까지 변경 범위에 맞춰 다시 검토한다.

## 18. 완료 조건

B1-A 구현 단계의 완료 조건은 다음과 같다.

- 공개 정보 경계와 세 전략이 테스트로 고정됨
- 실제 Store 기반 driver가 기존 I2 회귀를 대체하지 않고 재사용함
- `pnpm backtest:quick`이 1,200캠페인 calibration 결과를 재현함
- calibration 결과와 합격 수치안이 사용자 승인을 받음
- 승인 수치가 spec과 공식 설정집에 반영됨
- `pnpm backtest`가 별도 12,000캠페인 holdout 보고서를 재현함
- 고정 게이트와 승인 게이트의 개별 판정이 보고서에 있음
- lint·typecheck·test·build 통과
- holdout 통과 시 B1 완료, 실패 시 승인된 보고서를 근거로 B1-B 진입

## 관련 문서

- [게임 원칙](../../GAME_PRINCIPLES.md)
- [핵심 게임 루프](../../design/CORE_GAME_LOOP.md)
- [정보와 기만](../../systems/INFORMATION_AND_DECEPTION.md)
- [캐릭터와 신뢰](../../systems/CHARACTERS_AND_TRUST.md)
- [캐릭터 풀과 월드턴](../../systems/CHARACTER_POOL_AND_WORLDTURN.md)
- [던전 이벤트와 보스](../../systems/DUNGEON_EVENTS_AND_BOSSES.md)
- [성장과 엔딩](../../systems/PROGRESSION_AND_ENDINGS.md)
- [캠페인 개편 작업 배정표](../../technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)
- [현재 백테스트 보고서](../../technical/BACKTEST_REPORT.md)
