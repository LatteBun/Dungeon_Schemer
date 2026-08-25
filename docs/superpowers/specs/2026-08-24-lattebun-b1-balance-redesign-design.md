# B1-B 캠페인 생존 밸런스 재설계

- 작성일: 2026-08-24
- 작성자: lattebun
- 작성 도구: Codex
- 대상 작업: `B1-B`
- 기준 브랜치: `feat/b1-current-campaign-backtest`
- 기준 커밋: `cc1587d`

## 1. 문서의 지위

이 문서는 B1-A 현행 캠페인 calibration이 발견한 전 조합 정상 완주율 0%를
해소하기 위한 B1-B 규칙 변경과 재측정 절차를 설계한다.

B1-A의 실제 Store driver, 공개 정보 전략, 정확도 선택기와 보고서 생성 구조는
재사용한다. B1-B는 백테스트 전용 간이 규칙을 만들지 않고 프로덕션 캠페인 규칙을
고친 뒤 같은 driver로 결과를 측정한다.

이 설계는 사용자와 section별로 합의한 다음 내용을 반영한다.

- 초기 30명과 캠페인 중 영입 없음 유지
- 전투 결과는 클리어 또는 전멸이며 후퇴 없음
- 생존과 선별적 배신 모두 정상 완주 가능한 전략
- 합격 수치는 calibration 중 근거가 생기면 사용자 승인으로 조정 가능
- 승급·보상은 첫 생존 분포를 맞추는 동안 유지

## 2. 배경과 원인

B1-A는 3전략 × 정확도 0.4·0.7 × 조합당 200시드, 총 1,200캠페인을 실제
Store에서 실행했다.

- 오류·거부·정지·비결정성: 0건
- 여섯 조합 정상 완주율: 모두 0%
- 여섯 조합 S 도달률: 모두 0%
- 조언 적중률: 설정한 0.4·0.7 구간과 일치
- 정확도에 따른 완주 결과 차이: 0

대표 생존형 정확도 0.7 캠페인은 13회 원정에서 4회 클리어, 9회 전멸 뒤 초기
30명을 모두 잃고 `exhausted`로 끝났다. 집계 오류가 아니라 실제 캠페인 규칙의
결과다.

현재 실패는 한 수치가 아니라 서로 강화하는 네 축에서 생긴다.

1. 실패 뒤 현재 위험도 상승과 함께 일반 몬스터·보스 전투력도 10%씩 오른다.
2. 같은 실패가 공개 정보를 줄여 다음 판단도 어렵게 만든다.
3. 비출전 인원도 월드턴마다 최대 HP의 10~20%를 잃고 휴식은 15%만 회복한다.
4. 도움·방해 조언의 차이가 유한 인력 소진 전에 캠페인 결과 차이로 누적되지 않는다.

위험도와 보상·정보의 긴장은 유지하되, 재도전이 전투력까지 올리는 죽음의 나선은
끊고 조언 정확도가 전투 생존으로 이어지게 해야 한다.

## 3. 목표와 비목표

### 3.1 목표

- 재도전 전투 scaling을 제거해 실패 뒤에도 회복 가능한 다음 시도를 만든다.
- 월드턴의 비전투 HP 소모를 줄여 유한한 30명이 캠페인 후반까지 남게 한다.
- 테마 개성을 보존하면서 보스 기본 전투력을 공통 위험도 단계로 조정한다.
- 도움·방해 조언을 원정 단위 전투 압력으로 누적해 정확도와 전략 차이를 만든다.
- 승인된 완주율과 전멸 분포를 calibration에서 맞춘 뒤 독립 holdout으로 검증한다.
- 수치 원인을 한 공통 설정에서 추적하고 결정성을 유지한다.

### 3.2 비목표

- 캐릭터 영입·부활·후퇴 결과를 추가하지 않는다.
- 초기 캐릭터 30명, 3인·3직업 파티, 던전 15개를 바꾸지 않는다.
- 전멸 정산, 위험도 상승, 보상 증가, 공개 생태 감소를 제거하지 않는다.
- 승급 요구치, 계약 보상, 엔딩 판정 순서를 첫 calibration 전에 조정하지 않는다.
- 신뢰 반응 확률과 개인 성격 보정을 바꾸지 않는다.
- 테마별 사건 문구나 보스 특징을 대량 수정하지 않는다.
- B1-B를 새 난이도 선택 UI나 플레이어 능력치 성장 작업으로 넓히지 않는다.

## 4. 검토한 접근

### 4.1 전투 수치만 낮추기

보스와 몬스터 HP·피해만 낮추는 가장 작은 변경이다. 즉시 완주율은 오를 수 있지만
월드턴 소진과 재도전 죽음의 나선이 남고, 정확도 0.4와 0.7이 비슷하게 쉬워질
가능성이 크다.

### 4.2 조언 효과만 키우기

정확도 차이는 커지지만 원정 밖에서 계속 발생하는 월드턴 피해와 재도전 scaling을
상쇄하려면 조언 한 번의 효과가 지나치게 커진다. 한 번의 오답이 즉시 전멸하는
구조가 되기 쉽다.

### 4.3 혼합 조정 — 선택

재도전 scaling 제거, 월드턴 완화, 공통 보스 보정으로 생존 기반을 회복하고
조언 압력으로 전략·정확도 차이를 만든다. 각 축을 공통 설정으로 분리해 작은
calibration에서 원인을 보며 순차 조정할 수 있다.

## 5. 공통 밸런스 설정

새 `lib/balance/campaign-balance.ts`는 숫자와 불변 데이터만 소유하는 하위 의존성
모듈이다. domain·rules·store를 import하지 않으며, 각 규칙 계층이 이 설정을
읽는다. 콘텐츠 문구와 사건별 의미는 이 파일로 옮기지 않는다.

초기 설정은 다음과 같다.

```text
worldTurn
  restRecoveryRatio: 0.20
  backgroundLossPercent: 5..10

bossBaseStatMultiplierByInitialRisk
  ★1: 0.80
  ★2: 0.80
  ★3: 0.80
  ★4: 0.80
  ★5: 0.80

advicePressure combat multiplier
  0: incoming 1.00 / outgoing 1.00
  1: incoming 1.05 / outgoing 1.00
  2: incoming 1.15 / outgoing 0.90
  3: incoming 1.30 / outgoing 0.80
```

승인된 calibration 조정 범위는 다음과 같다.

- 휴식 회복률: `0.20~0.25`
- 백그라운드 손실: `5~10%` 고정 범위
- 위험도 단계별 보스 HP·피해 배율: `0.75~0.85`
- 조언 압력 배율: 첫 구조 검증 뒤 목표 분포에 맞춰 조정하되 1단계는 경미하고
  2단계부터 뚜렷하며 3단계가 가장 위험하다는 단조성은 유지

보스 정보의 개인별 target/incoming/outgoing multiplier와 clamp도 같은 공통 설정의
조언 구역으로 이동한다. 첫 실행에서는 현행 `0.80/1.25`, clamp `0.70..1.50`을
유지한다. 지표가 보스 정보 효과 부족이나 과잉을 가리킬 때만 조정한다.

설정은 런타임 옵션이나 사용자 입력이 아니다. calibration마다 코드 revision에
고정해 같은 revision·시드가 같은 결과를 내게 한다.

## 6. 재도전과 보스 규칙

### 6.1 일반 몬스터

`retryCombatMultiplier`의 `1 + retrySteps × 0.1` 적용을 제거한다. 사건 고유
encounter, 조언 modifier와 merchant effect는 그대로 합성한다. 호환성을 위해
driver와 전이의 `retrySteps` 입력을 바로 제거하지 않아도 되지만 전투 능력치에는
영향을 주지 않아야 한다.

### 6.2 보스

`currentRiskLevel - initialRiskLevel`의 `+10%` HP·기본 피해 scaling을 제거한다.
대신 보스 원본 HP·피해에 던전 **초기 위험도**의 공통 배율을 한 번 적용하고
`max(1, round(...))`로 정수화한다.

위험도 단계마다 독립 키를 두되 첫 calibration은 모두 0.80으로 시작한다. 이후
특정 위험도에서만 병목이 확인되면 `0.75~0.85` 안에서 그 단계만 조정한다. 테마별
별도 배율은 두지 않아 같은 위험도 보스가 동일한 규칙을 받는다. 원본 BossDef,
BossRule, 표적 성향과 보스 정보 축은 유지한다.

### 6.3 실패 뒤 유지되는 것

전멸 뒤 던전 현재 위험도 +1과 ★5 상한은 유지한다. 오른 현재 위험도는 다음에
계속 영향을 준다.

- 더 높은 계약 보상과 명성 손실
- 줄어든 공개 생태 규칙 수
- 보스 정보 cut 수
- 새 attempt의 지도·사건 물질화

전투력만 재도전 횟수와 분리한다. 플레이어는 더 큰 보상과 더 적은 직접 정보를
감수하지만, 같은 실패 때문에 적이 계속 강해지는 이중 처벌은 받지 않는다.

## 7. 원정 조언 압력

### 7.1 상태 계약

`ExpeditionState`에 `advicePressure: 0 | 1 | 2 | 3`을 추가한다. 원정과 재도전을
시작할 때 0이며 캠페인의 다음 원정으로 이월하지 않는다.

순수 함수 `advanceAdvicePressure(current, decision)`은 다음을 적용한다.

| 판정 | 변화 |
| --- | ---: |
| `executed && outcome === "harm"` | +1, 최대 3 |
| `executed && outcome === "help"` | -1, 최소 0 |
| neutral 또는 `executed === false` | 0 |

한 명이 방해를 적발했더라도 다른 한 명이 수용해 `executed`가 참이면 압력은 오른다.
아무도 수용하지 않은 조언은 기본 결과로 흘러가므로 압력을 바꾸지 않는다.

### 7.2 적용 순서

```text
조언 선택
→ E2 개인 반응과 executed 판정
→ advicePressure 갱신
→ 사건 고유 즉시 효과 또는 encounter modifier 적용
→ 현재 전투에 갱신된 pressure multiplier 합성
→ 결과·신뢰·진행 기록 반영
```

몬스터 사건의 방해가 처음 수용되면 현재 전투에는 1단계의 작은 불리함만 더해진다.
두세 번 누적되면 이후 일반 전투와 보스전 모두 위험해진다. 도움 조언은 현재 전투
전에 한 단계를 낮추므로 회복 경로가 있다.

전투 합성은 다음 의미를 지킨다.

- outgoing: 파티가 적에게 가하는 피해 multiplier
- incoming: 적이 파티에게 가하는 피해 multiplier
- 일반 전투: 사건 modifier × merchant modifier × pressure modifier
- 보스전: 개인별 보스 정보 modifier × merchant modifier × pressure modifier

압력은 적 수나 targetWeight를 직접 바꾸지 않는다. 적 추가·제거·전투 회피는
사건 콘텐츠의 의미를 유지한다. 도움 조언은 기존 전투 회피·적 감소·피해 우위에
압력 감소를 더하고, 방해 조언은 기존 해로운 효과에 누적 위험을 더한다.

### 7.3 공개 경계

`advicePressure`는 내부 outcome에서 파생되므로 전략의 공개 decision view와 UI에
숫자로 노출하지 않는다. 백테스트 driver는 캠페인 결과 집계를 위해서만 최고치와
보스 진입 값을 읽는다. 플레이어는 사건 결과와 전투 기록에서 영향을 확인하며
진행 기록은 help/harm 내부 라벨을 새로 공개하지 않는다.

## 8. 월드턴

강제 휴식 기준 50%, 중상 기준 20%, 회복 최소 2, 백그라운드 HP 하한 1, 골드
5~15는 유지한다.

- 휴식 회복률은 0.15에서 0.20으로 시작한다.
- 백그라운드 피해 난수는 최대 HP의 10~20%에서 5~10%로 바꾼다.
- 휴식 회복률만 calibration에서 0.25까지 올릴 수 있다.
- 모든 난수는 기존 worldturn RNG를 그대로 사용한다.

월드턴 완화는 캐릭터를 새로 만들거나 사망을 되돌리지 않는다. 출전하지 않은
인력이 플레이어가 개입할 수 없는 곳에서 지나치게 빨리 소진되는 속도만 낮춘다.

## 9. 승급·보상·엔딩

첫 B1-B calibration에서는 다음을 바꾸지 않는다.

- 시작 명성 30·골드 10
- 위험도별 명성·골드 보상과 전멸 명성 손실
- 무료 승급 60/120/200, 골드 승급 150/320/600
- 수동 승급과 강등 없음
- 엔딩 5종과 판정 순서

완주 캠페인의 최종 C/B/A/S 분포, 최초 승급 시점과 자원 분포는 관찰한다. 생존·
완주 목표를 만족한 뒤에도 승급 경로가 의도와 크게 다를 때만 별도 승인으로 이
축을 조정한다.

## 10. 백테스트 절차

### 10.1 단계

1. **구조 검증:** 조합당 50시드로 오류, 정지, 결정성, 압력 분포와 극단적
   전멸을 확인한다.
2. **1차 보정:** 조합당 100시드로 위험도별 보스 병목과 월드턴 소진을 조정한다.
3. **최종 calibration:** 조합당 200시드로 승인된 완주율·전멸 기준을 판정한다.
4. **기준 동결:** 설정과 gate를 spec·공식 문서·코드에 고정하고 사용자 승인을
   받는다.
5. **holdout:** 조합당 2,000개의 사용하지 않은 시드로 한 번 판정한다.

calibration namespace는 `b1b-calibration-v1`, 첫 holdout은
`b1b-holdout-v1`이다. holdout을 본 뒤 설정이나 합격선을 바꾸면 해당 namespace는
폐기하고 버전을 올린 새 holdout만 최종 판정에 사용한다.

보고서는 단계별 표본 수와 namespace를 항상 표시한다.

### 10.2 정상 완주율 gate

| 전략 | 정확도 0.7 | 정확도 0.4 |
| --- | ---: | ---: |
| 생존 | 60~80% | 30~40% |
| 기회주의적 균형 | 40~60% | 20~30% |
| 선별적 배신 | 20~40% | 5~15% |

표의 경계는 포함한다. 표본 정상 완주율 자체를 판정값으로 사용하고 Wilson 95%
구간은 불확실성 설명을 위해 함께 보고한다.

### 10.3 전멸 gate와 관찰 지표

- 완주한 생존 정확도 0.7: 평균 전멸 2~3회
- 완주한 생존 정확도 0.4: 평균 전멸 3~4회
- 완주한 선별적 배신 정확도 0.4·0.7: 각각 평균 전멸 3~4회
- 완주 캠페인의 전멸 5회 이상 비율: 위험 구간으로 별도 보고하고 holdout 전 검토
- 기회주의적 균형의 전멸 횟수: 첫 calibration 관찰 지표
- 엔딩·최종 등급·남은 인원·보스 진입 HP: 첫 calibration 관찰 지표

전멸 5회 이상 비율에는 아직 임의 상한을 두지 않는다. 평균 gate를 만족해도 이
구간이 두꺼우면 대표 시드를 검토하고 holdout 전에 사용자가 수용 여부나 상한을
승인한다.

### 10.4 고정 무결성 gate

- 생성 오류 0건
- 거부 전이와 전략의 유효하지 않은 결정 0건
- 진행 한도 초과와 정지 0건
- 같은 입력의 비결정적 결과 0건
- 조언 적중률의 Wilson 99.9% 구간이 설정한 0.4·0.7 포함
- 모든 조합의 S 도달률 100% 미만
- 유한하지 않은 수, 분모 0, 누락 지표를 집계 오류로 처리

## 11. 지표와 보고서

기존 `CampaignRunResult`와 집계에 다음을 추가한다.

- 원정별 시작·최고·보스 진입·종료 조언 압력
- 보스 진입 시 생존 인원, 총 현재 HP와 총 최대 HP
- 완료 캠페인과 미완료 캠페인을 구분한 전멸 횟수
- 전멸 5회 이상 캠페인 수와 비율
- 위험도·테마별 보스 진입, 클리어, 전멸
- 종료 원인과 최종 C/B/A/S 분포

정확도와 전략에는 압력을 노출하지 않는다. driver가 실행 뒤 결과를 구조화하고,
집계기가 조합별 수치와 paired 비교를 만든 뒤 Markdown 생성기가 표시한다.

보고서에는 설정 revision 또는 각 조정값을 포함해 숫자의 원인을 재현할 수 있게
한다. 원시 12,000캠페인 상태는 커밋하지 않고 오류·위험 구간·경계 실패의 대표
시드만 남긴다.

## 12. 오류 처리

- `advicePressure`가 정수 0~3이 아니면 `RuleError("INVALID_STATE", ...)`
- 밸런스 설정이 유한하지 않거나 범위·단조성 불변식을 어기면 테스트와 실행 시작
  검증에서 `RuleError("INVALID_GENERATION", ...)`
- 보스 위험도 키가 없거나 원본 HP·피해가 양의 정수가 아니면 조용히 대체하지 않고
  오류로 중단하며, 유효한 배율 결과만 `max(1, round(...))`로 정수화
- 개별 캠페인 오류는 B1-A와 같이 다른 시드를 계속 실행하고 종류·개수·대표 시드를
  보고
- 자동 retry, 시드 교체, 다른 전략 행동으로의 fallback은 만들지 않음

압력 합성 뒤의 multiplier도 유한성과 양수를 검증한다. BattleEngine의 50턴
roundLimit 처리와 Store 거부 계약은 바꾸지 않는다.

## 13. 테스트 전략

### 13.1 공통 설정

- 초기값과 승인 범위
- 위험도 1~5 키 완전성
- 조언 압력 단계의 단조성
- 모든 multiplier의 유한·양수 불변식

### 13.2 조언 압력

- 0에서 help, 3에서 harm의 clamp
- executed help/harm과 neutral·미실행 전이
- 적발과 수용이 함께 있는 executed harm
- 새 원정·재도전의 0 초기화와 캠페인 간 비이월
- 현재 몬스터 전투와 이후 보스전에 같은 압력이 적용됨
- 공개 strategy view에 압력이 없음

### 13.3 전투와 월드턴

- 일반 전투 결과가 retrySteps에 따라 달라지지 않음
- 보스 수치가 현재 위험도 차이에 따라 오르지 않음
- 같은 초기 위험도의 세 테마 보스에 같은 단계 배율 적용
- 보스 고유 특징·targetWeight 보존
- event·merchant·boss info·pressure multiplier 합성
- 월드턴 5%·10% 경계, 휴식 20%, HP 하한과 결정성

### 13.4 통합과 백테스트

- 실제 Store에서 전멸→재도전→완주와 인력 소진 경로
- 기존 B1-A 고정 시드가 새 규칙에서도 결정적으로 끝남
- 새 지표의 손계산 fixture와 Markdown 결정성
- 단계별 표본 수·namespace 분리
- calibration만 수치를 조정하고 holdout은 동결 gate만 판정
- 여섯 조합 완주율·전멸 gate의 경계값 포함 판정

## 14. 파일 영향

### 새 파일

```text
lib/balance/campaign-balance.ts
lib/balance/campaign-balance.test.ts
lib/rules/advice-pressure.ts
lib/rules/advice-pressure.test.ts
```

### 주요 수정 파일

```text
lib/domain/expedition.ts
lib/domain/worldturn.ts
lib/content/boss-traits.ts
lib/rules/expedition-events.ts
lib/rules/boss-battle-adapter.ts
lib/rules/campaign-transition.ts
lib/backtest/campaign-driver.ts
lib/backtest/metrics.ts
lib/backtest/report.ts
lib/backtest/backtest.run.ts
lib/**/*.test.ts
package.json
docs/technical/BACKTEST_REPORT.md
docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
docs/systems/CHARACTER_POOL_AND_WORLDTURN.md
docs/systems/INFORMATION_AND_DECEPTION.md
docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md
docs/systems/PROGRESSION_AND_ENDINGS.md
docs/README.md
```

구현 중 실제 책임 경계상 파일명이 달라질 수 있지만 공통 설정, 압력 순수 규칙,
프로덕션 전투, 백테스트 집계를 한 파일에 합치지 않는다.

## 15. 문서와 작업 상태

`GAME_PRINCIPLES.md`의 고블린 길잡이 역할, 유한 인력, 생존·배신의 유효성,
15개 던전 정상 완주와 모든 최종 등급의 유효성은 바뀌지 않아 본문을 수정하지
않는다.

B1은 B1-A 진단이 끝났지만 B1-B와 독립 holdout이 남아 진행 중이다. 배정표에서
B1을 완료 처리하지 않고 Q1의 선행을 유지한다. B1-B holdout이 모든 gate를
통과하고 보고서가 승인된 뒤에만 B1을 완료한다.

## 16. 완료 조건

- 공통 밸런스 설정과 조언 압력이 단위 테스트로 고정됨
- 재도전이 일반 몬스터·보스 전투력을 더 올리지 않음
- 월드턴과 보스 공통 보정이 공식 문서와 일치함
- 실제 Store 구조 검증과 1차 보정이 오류 없이 끝남
- 조합당 200시드 calibration이 승인된 완주율·전멸 gate를 만족함
- 전멸 5회 이상 위험 구간과 관찰 지표가 사용자 검토를 받음
- 최종 설정과 gate가 코드·spec·공식 설정집에 동결됨
- 조합당 2,000시드의 새 holdout이 모든 고정·승인 gate를 통과함
- lint·typecheck·전체 test·build 통과
- 최종 보고서와 함께 B1이 완료 처리되고 Q1 선행이 해제됨

## 관련 문서

- [게임 원칙](../../GAME_PRINCIPLES.md)
- [B1 현행 캠페인 백테스트 설계](2026-08-24-lattebun-b1-current-campaign-backtest-design.md)
- [정보와 기만](../../systems/INFORMATION_AND_DECEPTION.md)
- [캐릭터 풀과 월드턴](../../systems/CHARACTER_POOL_AND_WORLDTURN.md)
- [던전 이벤트와 보스](../../systems/DUNGEON_EVENTS_AND_BOSSES.md)
- [던전 테마와 생태](../../systems/DUNGEON_THEMES_AND_ECOLOGY.md)
- [성장과 엔딩](../../systems/PROGRESSION_AND_ENDINGS.md)
- [B1-A calibration 보고서](../../technical/BACKTEST_REPORT.md)
- [캠페인 개편 작업 배정표](../../technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)
