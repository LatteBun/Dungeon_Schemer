# B1-C 캠페인 손실 원인 판정·보정 설계

> 작성자: LatteBun  
> 작성 도구: Codex  
> 대상 작업: `B1-C`  
> 상태: 사용자 설계 승인 완료 · 구현 계획 작성 전

## 1. 문제와 결정

B1 위험도별 첫 시도 클리어율 보정의 200시드 calibration에서
`opportunist@0.7`은 ★1~★3 목표를 충족했지만 ★4는 `0.2979`로 목표
`0.35~0.45`보다 낮았다. ★5는 `15` 표본이라 최소 `30`에 미달했다. 동시에 기존
B1-B 완주율·완주 전멸·정확도 gate도 실패했다.

원정 funnel은 보스 진입률이 거의 100%이고 보스 진입 평균 HP 비율도
`0.7783~0.9431`이었다. 따라서 일반 구간에서 이미 소진된 파티를 보스 배율로
보정한다는 가설은 지지되지 않는다. 다만 보스 전멸이 캠페인 전체에서 얼마나
캐릭터 풀·중상·승급·고위험 던전 접근을 막는지, 월드턴과 일반 전투가 얼마나
기여하는지는 현재 trace만으로 판정할 수 없다.

B1-C는 실제 Campaign Store 실행에 손실 원장을 추가한다. 200시드 결과로 지배
손실 원인 하나를 판정하고, 승인된 안전 범위 안에서 해당 축 하나만 조정한다.
그 뒤 같은 200시드 calibration으로 위험도 곡선과 기존 B1-B gate를 함께
재판정한다. 여러 축을 함께 탐색해 우연히 통과하는 후보는 만들지 않는다.

## 2. 목표와 비목표

### 목표

- 원정 일반 구간, 보스전, 월드턴, 신뢰 손실, 캠페인 종료가 캐릭터 자원에 남긴
  손실을 재현 가능한 동일 분류로 기록한다.
- `opportunist@0.7` 200시드에서 손실의 지배 원인을 데이터로 판정한다.
- 판정된 원인에 대응하는 밸런스 축 하나만 조정하고, 기존 B1-B와 위험도별
  첫 시도 클리어율 gate를 동시에 통과하는지 판정한다.
- 수치·revision·trace·집계·보고서가 같은 시드·전략·정확도에서 결정적이다.

### 비목표

- 테마·개별 보스·개별 캐릭터·재도전 횟수별 특례 배율을 만들지 않는다.
- 전략이 숨은 조언 정답이나 비공개 상태를 읽게 하지 않는다.
- 손실이 섞였다는 이유로 여러 수치를 동시에 바꾸거나 acceptance 범위를
  완화하지 않는다.
- holdout을 실행하거나 `B1B_HOLDOUT_APPROVED`를 바꾸지 않는다. 최종
  calibration과 설정 revision은 별도 사용자 승인을 받은 뒤에만 holdout으로 간다.

## 3. 손실 원장 계약

### 3.1 원시 trace

`CampaignRunTrace`는 기존 `balanceExpeditions`를 유지하고 다음 읽기 전용
`depletion` 원장을 추가한다. 실제 전이 전후의 pool과 expedition 상태 차이를
드라이버가 기록하며, metrics가 화면 문구나 history 문자열을 다시 해석하지 않는다.

```ts
type DepletionSource =
  | "expedition-general"
  | "expedition-boss"
  | "world-turn-background"
  | "world-turn-rest";

interface DepletionTraceEntry {
  readonly source: DepletionSource;
  readonly worldTurn: number;
  readonly expeditionId: string | null;
  readonly dungeonId: DungeonId | null;
  readonly initialRiskLevel: RiskLevel | null;
  readonly attemptNumber: number | null;
  readonly hpLost: number;
  readonly hpRecovered: number;
  readonly deaths: number;
  readonly seriousInjuriesStarted: number;
  readonly seriousInjuriesCleared: number;
  readonly trustZeroed: number;
}

type CampaignTerminationReason =
  | "completed"
  | "pool-exhausted"
  | "no-eligible-party"
  | "distrust"
  | "denounced"
  | "run-error";
```

- 일반 사건의 직접 피해와 `monster` 전투 피해는 `expedition-general`이다.
- 보스전 행동 기록에서 파티가 받은 피해와 보스전 중 사망은
  `expedition-boss`다.
- 백그라운드 원정의 HP 감소는 `world-turn-background`, 강제·일반 휴식의 회복은
  `world-turn-rest`다. 월드턴은 사망을 만들지 않는다는 공식 규칙을 검증한다.
- `hpLost`와 `hpRecovered`는 모두 0 이상 정수다. 사망은 HP 손실로 이중 계산하지
  않으며 각각 보고한다. 사망·신뢰 0·중상은 각 전이에서 새로 발생 또는 해제된
  인원만 센다.
- 일반/보스 원정 trace에는 그 원정의 `dungeonId`, 초기 위험도, attempt를 붙이고,
  월드턴 trace에는 이 세 값을 `null`로 둔다. 이로써 첫 시도 위험도 funnel과
  캠페인 전체 손실을 둘 다 drill-down할 수 있다.
- 원정이 `interrupted`로 끝나도 그 시점까지 확정된 손실 entry는 보존한다. 드라이버
  오류는 만들어진 entry를 지우지 않고 최종 종료 사유만 `run-error`로 표시한다.

### 3.2 집계와 불변식

조합별 metrics는 source별 `hpLost`, `hpRecovered`, deaths, 새 중상, 신뢰 0,
원정 전멸 및 캠페인 종료 사유 수를 제공한다. `opportunist@0.7`에는 초기 위험도와
테마별 첫 시도 손실 drill-down도 제공한다.

다음은 집계 오류로 즉시 실패한다.

- source가 원정인데 원정 식별 정보가 없거나, 월드턴인데 원정 식별 정보가 있다.
- 음수·비정수 HP, 사망, 중상, 신뢰 손실 count가 있다.
- `world-turn-background`에 사망이 있다.
- 한 원정 entry의 초기 위험도·attempt가 해당 `balanceExpeditions` trace와 다르다.
- 최종 캠페인 pool의 사망·신뢰 0·중상 변화가 원장 합계와 모순된다.
- 종료된 run에 종료 사유가 없거나, 종료 사유가 둘 이상이다.

## 4. 지배 원인 판정

각 전략·정확도 조합은 모두 보고하지만, 수치 보정의 판정 기준은
`opportunist@0.7`, calibration 200시드다.

1. `expedition-general`, `expedition-boss`, `world-turn-background`의
   `hpLost` 비중과 deaths 비중을 계산한다. `world-turn-rest`는 회복이라 손실
   원인의 분모에 넣지 않는다.
2. 원정 전멸과 캠페인 종료 사유의 최다 발생 source를 함께 기록한다.
3. 한 source가 원정 사망의 60% 이상이거나, 원정 사망이 0일 때는 누적 HP 손실의
   60% 이상이면서 캠페인 종료의 최다 원인과 일치하면 `dominant`다.
4. 60%를 만족하는 source가 없거나 HP 손실 지배자와 종료 지배자가 충돌하면
   `mixed`다. mixed 결과에서는 밸런스 값을 바꾸지 않고 별도 설계 대상으로
   보고한다.

`pool-exhausted`와 `no-eligible-party`는 직접 피해 source가 아니라 종료 결과다.
원장은 각각 직전의 사망·신뢰 0·중상 분포를 같이 보고해 어떤 source가 종료에
선행했는지 설명한다. `distrust`와 `denounced`는 조언·신뢰 축의 종료이므로
직접 피해 우세 판정을 덮어쓰지 않고 별도 경고로 남긴다.

## 5. 단일 축 보정 규칙

| 판정 | 조정 가능한 유일한 축 | 금지하는 동시 변경 |
| --- | --- | --- |
| `expedition-boss` dominant | 초기 위험도별 보스 HP·기본 피해 공통 배율 | 일반 몬스터, 월드턴, 조언 압력, 상인, 보상 |
| `expedition-general` dominant | 일반 몬스터의 공통 HP·기본 피해 배율 | 보스, 월드턴, 조언 압력, 상인, 보상 |
| `world-turn-background` dominant | `restRecoveryRatio` `0.20~0.25` | 백그라운드 피해 5~10%, 전투, 조언 압력, 상인, 보상 |
| `mixed` 또는 신뢰 종료 경고 | 없음 | 모든 밸런스 값 |

보스 후보는 이미 승인된 `0.20~1.20`, `0.025` 격자를 유지한다. 월드턴 회복은
공식 문서가 정한 `0.20~0.25`만 사용한다. 일반 몬스터 공통 배율의 세부 범위와
격자는 B1-C 구현 계획에서 기존 콘텐츠 검증 범위를 읽어 명시하며, 보스·테마·재도전
특례를 만들지 않는다.

조정은 50시드 구조 확인, 100시드 방향 확인, 200시드 최종 calibration 순서다.
200시드에서 source 판정이 후보마다 바뀌면 후보를 채택하지 않는다. 후보 하나가
선택되면 다른 축을 만지지 않고 최종 gate를 실행한다.

## 6. Gate와 보고서

200시드 최종 calibration에서 다음을 모두 강제한다.

- `opportunist@0.7` 초기 위험도 첫 시도 클리어율: ★1 `0.80~0.90`, ★2
  `0.65~0.75`, ★3 `0.50~0.60`, ★4 `0.35~0.45`, ★5 `0.20~0.30`; 각 표본 30 이상,
  엄격한 내림차순.
- 기존 B1-B 각 조합의 완주율, 완료 캠페인 전멸 평균, 정확도 Wilson interval,
  모든 전략 S등급 방지, 배신 전략 완주 가능성, run error 0.
- 원장 불변식, source 합계, 종료 사유 합계, 같은 실행 입력의 trace·보고서 결정성.

보고서는 기존 funnel 앞에 다음을 추가한다.

1. source별 HP 손실·회복·사망·중상·신뢰 0 표
2. 종료 사유와 직전 풀 상태 표
3. `opportunist@0.7` 위험도·테마별 첫 시도 손실 표
4. dominant/mixed 판정과 근거 비율
5. 바꾼 단일 축, 이전/이후 revision, 50·100·200시드 결과 및 모든 gate

기존 `BACKTEST_REPORT.md` 생성 규칙을 유지한다. 결과 보고서는 생성물이며,
고정 문서나 source 코드와 섞어 커밋하지 않는다.

## 7. 테스트와 검증

- 손계산 fixture로 일반·보스·월드턴 손실, 회복, 사망, 중상, 신뢰 0과 종료 사유를
  정확히 집계한다.
- 보스전과 일반 전투의 피해가 서로 바뀌지 않고, 월드턴은 사망 0을 유지한다.
- interrupted 및 run-error trace가 이미 확정된 손실을 보존한다.
- 잘못된 source/식별자/음수 값/원장-최종 상태 모순을 명시적으로 실패시킨다.
- 60% 경계, 동률, source 충돌, 사망 0 HP 손실 우세, mixed의 무변경을 단위
  테스트한다.
- 지배 source마다 허용된 설정만 읽고 다른 설정은 byte-for-byte 유지됨을
  통합 테스트한다.
- 3전략 × 2정확도 × 50/100/200시드 실제 Store 실행에서 trace와 보고서의
  결정성을 확인한다.

## 8. 문서와 경계

이번 설계는 게임 원칙을 바꾸지 않는다. 실제 채택된 회복률 또는 전투 공통 배율은
구현과 같은 변경에서 `CHARACTER_POOL_AND_WORLDTURN.md` 또는
`DUNGEON_EVENTS_AND_BOSSES.md`에 함께 고정한다. 손실 원장은 백테스트·검증
계층의 관찰 도구이며 플레이어에게 숨은 정답이나 새 UI를 노출하지 않는다.

## 9. 완료 기준

다음이 모두 충족되어야 B1-C calibration을 완료로 판단한다.

1. 실제 Store backtest가 손실 원장과 종료 원인을 결정적으로 생성한다.
2. 200시드에서 dominant 또는 mixed 판정이 근거 수치와 함께 보고된다.
3. dominant일 때만 한 축의 안전한 후보를 선택하며, mixed일 때는 수치를 바꾸지
   않는다.
4. 조정 후 모든 위험도별·기존 B1-B·무결성 gate를 통과하거나, 통과하지 못한
   경우 값 변경을 숨기지 않고 실패 원인과 다음 별도 설계 경계를 보고한다.
5. holdout은 사용자 승인 전까지 실행되지 않는다.
