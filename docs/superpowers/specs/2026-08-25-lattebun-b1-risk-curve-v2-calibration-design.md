# B1 위험도 곡선 v2 보정 설계

- 작성자: LatteBun
- 작성 도구: Codex
- 작업 분류: B1 후속 calibration
- 상태: 사용자 설계 승인 완료, 구현 계획 작성 전

## 1. 문서 목적과 적용 범위

이 문서는 위험도별 던전 첫 시도 클리어율의 새 목표 곡선을 확정하고, 그 곡선을 보정하는 동안 적용할 acceptance 범위를 분리한다. 이번 단계는 `bossBaseStatMultiplierByInitialRisk`만 조정해 위험도 곡선을 맞추는 calibration이다.

기존 [B1 위험도별 던전 클리어율 보정 설계](2026-08-25-lattebun-b1-risk-clearance-calibration-design.md)의 다음 항목만 이 문서가 대체한다.

- 위험도별 목표 구간
- 해당 곡선을 최종 판정할 때 모든 캠페인 gate를 동시에 통과해야 한다는 조건

기존 문서의 첫 시도·초기 위험도 기준 metric, 실제 Store 실행, 공개 정보 전략, 보스 배율 단일 축, 단계별 seed 구조, holdout 격리 원칙은 유지한다. 이번 calibration은 holdout을 실행하지 않으며, 전체 캠페인 acceptance를 통과한 것으로 해석하지 않는다.

## 2. 현재 기준선과 판단 근거

현재 production balance revision은 `b1c-boss-depletion-v1`이고, 초기 위험도별 보스 능력치 배율은 다음과 같다.

| 초기 위험도 | ★1 | ★2 | ★3 | ★4 | ★5 |
|---|---:|---:|---:|---:|---:|
| 현재 배율 | 1.100 | 0.825 | 0.650 | 0.550 | 0.600 |

생존형 진행 정책 교정 뒤 200 seed calibration의 `opportunist@0.7` 첫 시도 클리어율 기준선은 다음과 같다.

| 초기 위험도 | 클리어율 | 표본 수 |
|---|---:|---:|
| ★1 | 83.94% | 498 |
| ★2 | 70.50% | 800 |
| ★3 | 61.89% | 761 |
| ★4 | 32.80% | 439 |
| ★5 | 9.52% | 21 |

현재 곡선은 고위험 구간이 지나치게 가파르고 ★5 표본도 최소 기준에 못 미친다. 별도 throwaway 실험에서 `{1: 1.10, 2: 0.80, 3: 0.60, 4: 0.45, 5: 0.475}`는 약 `81.66%, 80.00%, 75.45%, 69.68%, 60.78%`를 기록했다. 이는 보스 배율만으로 고위험 곡선을 크게 개선할 수 있다는 방향성 근거일 뿐이다. ★1이 새 목표에 미달하고 전체 캠페인 gate도 통과하지 못했으므로 후보를 채택하지 않는다.

## 3. 목표와 비목표

### 목표

- 낮은 위험도는 첫 시도 기준 80%대의 높은 성공률을 제공한다.
- 위험도가 높아질수록 성공률이 엄격하게 감소한다.
- ★5도 첫 시도 성공률 55~65%를 확보해 진행 불가능에 가까운 병목을 제거한다.
- 위험도 곡선 보정 결과와 아직 해결되지 않은 전체 캠페인 문제를 같은 보고서에서 구분해 공개한다.
- 고정 seed와 명시적 focus로 동일 입력이 동일 판정을 내리게 한다.

### 비목표

- 이번 단계에서 캠페인 완주율, 전멸률, 조언 정확도 효과, 배신형 완주율을 동시에 해결하지 않는다.
- 보스 배율 외에 모험가 능력치, 일반 전투, 회복, 보상, 신뢰, 월드턴, 승급, 전략 행동을 변경하지 않는다.
- acceptance 실패를 `passed: true`로 위장하거나 기존 gate를 삭제하지 않는다.
- 독립 holdout을 실행하거나 승인하지 않는다.

## 4. 위험도 곡선 v2 계약

측정 전략은 `opportunist@0.7`, 분류 기준은 던전의 초기 위험도, 사건은 각 던전의 첫 시도 결과다.

| 초기 위험도 | 목표 첫 시도 클리어율 |
|---|---:|
| ★1 | 85~90% |
| ★2 | 78~85% |
| ★3 | 70~78% |
| ★4 | 62~70% |
| ★5 | 55~65% |

최종 200 seed 판정은 다음 조건을 모두 만족해야 한다.

1. 각 위험도 표본 수가 30 이상이다.
2. 각 위험도의 클리어율이 해당 목표 구간 안에 있다.
3. `★1 > ★2 > ★3 > ★4 > ★5`가 성립한다. 목표 구간 경계가 겹치더라도 동률은 허용하지 않는다.

50·100 seed 결과는 후보 방향과 안정성을 판단하는 중간 관측치이며, 목표 곡선의 최종 합격 판정은 200 seed에서만 수행한다.

## 5. Acceptance focus 분리

실행기와 acceptance 입력에 다음 focus를 추가한다.

```ts
type BacktestFocus = "full-campaign" | "risk-curve";
```

focus를 생략하면 기존 호환성을 위해 `full-campaign`으로 간주한다.

### `risk-curve`

- 50·100·200 seed 모든 단계에서 `no-run-errors`와 `not-all-rank-s`를 강제한다.
- 위험도 곡선 gate는 50·100 seed에서 `OBSERVE`, 200 seed에서 `ENFORCE`한다.
- 캠페인 완주율, 전멸률, 정확도 구간, 배신형 완주, 정확도 효과 gate는 `OBSERVE`한다.
- 관측 gate의 실제 성공·실패 값과 근거 수치는 그대로 보존한다. 관측이라는 이유로 성공 처리하지 않는다.

### `full-campaign`

- 기존 calibration 200 seed와 향후 holdout에서 모든 기존 gate를 강제한다.
- 기존 `backtest:structure`, `backtest:tune`, `backtest:quick`, `backtest`의 의미를 바꾸지 않는다.

### 고정 gate 표현

현재 `FixedGateResult`에는 강제 여부가 없으므로, focus에 따라 `enforced`를 명시하거나 동등한 단일 상태 모델로 정규화한다.

- `risk-curve`: `no-run-errors`, `not-all-rank-s`만 항상 강제
- `risk-curve`: `accuracy-interval`, `betrayal-can-complete`, `accuracy-has-effect`와 기타 전체 캠페인 gate는 관측
- `full-campaign`과 holdout: 모든 고정 gate 강제

보고서의 `PASS`, `FAIL`, `OBSERVE` 표시는 acceptance가 사용한 동일한 gate 객체에서 파생한다. 보고서 전용 재판정 로직을 만들지 않는다.

## 6. 실행 namespace와 명령

새 calibration namespace는 `b1-risk-curve-v2-calibration`로 고정한다. 기존 calibration과 seed 영역을 공유하지 않아 결과가 섞이지 않게 한다.

다음 명령을 추가한다.

- `backtest:risk-structure`: 조합당 50 seed, 방향 확인
- `backtest:risk-tune`: 조합당 100 seed, 후보 선택
- `backtest:risk-quick`: 조합당 200 seed, 위험도 곡선 최종 판정

기존 backtest 명령은 `full-campaign` focus를 유지한다. holdout은 항상 `full-campaign`이어야 하며, `risk-curve` focus와 holdout 조합은 입력 오류로 거부한다.

공식 Vitest 설정은 `.worktrees/**`와 `.pnpm-store/**`를 제외해야 한다. 현재 기본 `pnpm test`가 이 디렉터리를 탐색해 중복·과거 테스트를 수집하는 문제를 함께 제거하되, 테스트 의미나 production 동작은 변경하지 않는다.

## 7. 보스 배율 calibration 절차

조정 가능한 유일한 production balance 값은 `bossBaseStatMultiplierByInitialRisk`다.

- 탐색 범위: 위험도별 `0.20` 이상 `1.20` 이하
- 격자 간격: `0.025`
- 시작점: 현재 production 값
- 순서: ★1부터 ★5까지 한 위험도씩 낮은 위험도에서 높은 위험도로 진행
- 후보 우선순위: 목표 구간 중심에 가장 가까운 클리어율, 그다음 현재 production 값에서 변화량이 가장 작은 배율
- 50 seed: 증감 방향 확인
- 100 seed: 후보 선택
- 200 seed: 전체 곡선과 최소 표본 최종 판정

보스 이전 실패를 숨기지 않기 위한 중단 조건을 둔다. 특정 위험도에서 보스 이전 실패 비중이 보스전 실패 비중보다 커지거나 보스 진입 평균 HP 비율이 `0.70` 미만이면, 해당 위험도의 보스 배율 완화를 중단한다. 이 경우 위험도 곡선 미달을 보고하고 다음 설계에서 다른 축을 검토한다.

## 8. 데이터 흐름과 변경 경계

- `lib/backtest/backtest.run.ts`: focus·namespace·stage 입력 검증과 실행 metadata 전달
- `lib/backtest/acceptance.ts`: focus별 enforced/observed 판정, v2 목표 구간과 엄격 감소 검증
- `lib/backtest/report.ts`: 동일 gate 결과를 `PASS`/`FAIL`/`OBSERVE`로 표시
- `lib/balance/campaign-balance.ts`: 최종 승인된 보스 배율과 revision만 반영
- `vitest.config.mts`, `vitest.backtest.config.ts`: worktree와 pnpm store 수집 제외
- `package.json`: risk-curve 전용 50·100·200 seed 명령 추가

production 전투 코드는 balance 설정만 참조한다. backtest focus, acceptance 목표, namespace가 production 전투 로직으로 유입되어서는 안 된다. 이 설계는 이미 구현된 생존형 진행 정책과 승급·잔여 던전 진단 metric을 기준선으로 사용한다.

## 9. 오류 처리와 결정성

- 알 수 없는 focus 또는 namespace는 실행 전에 오류로 거부한다.
- `risk-curve`와 holdout 조합은 오류로 거부한다.
- 실행 중 오류가 한 건이라도 있으면 `no-run-errors`가 실패하고 risk-curve 판정도 실패한다.
- seed, 전략, 정확도, focus, namespace, balance revision이 같으면 metric과 gate 결과가 같아야 한다.
- 최소 표본 미달은 목표 구간 안의 비율처럼 보여도 실패다.

## 10. 테스트 전략

구현은 다음 회귀를 먼저 실패시키고 최소 변경으로 통과시킨다.

1. focus 생략 시 `full-campaign`이 선택된다.
2. `risk-curve` 200 seed에서는 위험도 곡선만 최종 강제하고 `no-run-errors`, `not-all-rank-s`를 함께 강제한다.
3. `risk-curve` 50·100 seed에서는 위험도 곡선을 관측 상태로 보고한다.
4. `full-campaign`과 holdout에서는 기존 모든 gate를 강제한다.
5. 잘못된 focus·namespace와 risk-curve holdout 조합을 거부한다.
6. 새 목표 구간의 양 경계, 구간 밖 값, 역전·동률, 표본 29와 30을 검증한다.
7. 과거 목표값이 acceptance test와 보고서 계약에 남지 않는다.
8. 보고서가 실패한 관측 gate를 `OBSERVE`로 표시하면서 실제 실패 근거를 보존한다.
9. 공식 Vitest 설정이 `.worktrees/**`, `.pnpm-store/**`를 수집하지 않는다.

## 11. 문서 영향

200 seed에서 최종 후보가 통과한 뒤에만 다음 문서를 실제 수치와 revision에 맞춰 갱신한다.

- `docs/README.md`
- `docs/GAME_PRINCIPLES.md`는 이번 변경이 원칙을 바꾸지 않으므로 변경하지 않고 재확인만 기록
- `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- `docs/systems/PROGRESSION_AND_ENDINGS.md`
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- `docs/technical/PROJECT_STATUS_2026-08-24.md`

문서와 production balance revision은 같은 변경에 포함한다.

## 12. 완료 조건

- 새 focus와 namespace가 결정적으로 동작한다.
- 200 seed에서 위험도별 최소 표본 30, 각 v2 목표 구간, 엄격 감소를 모두 만족한다.
- 실행 오류가 0이고 모든 run이 S랭크로 수렴하지 않는다.
- production 수치 변경은 초기 위험도별 보스 배율에 한정된다.
- 기존 전체 캠페인 gate는 삭제하거나 성공으로 위장하지 않고 `OBSERVE` 결과로 남는다.
- balance revision, 보고서, 공식 문서의 최종 수치가 일치한다.
- holdout은 실행하지 않으며, 남은 전체 캠페인 실패와 후속 과제를 명시한다.
