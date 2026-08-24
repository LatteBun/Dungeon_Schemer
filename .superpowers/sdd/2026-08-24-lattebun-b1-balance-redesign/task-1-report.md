# Task 1 구현 보고서 — 공통 밸런스 설정과 검증 경계

## 결과

- 공통 숫자 원본 `CAMPAIGN_BALANCE`를 추가했다. revision은 `b1b-initial-v1`이며 월드턴, 초기 위험도별 보스, 조언 압력, 보스 정보 배율과 clamp를 한 곳에서 제공한다.
- `validateCampaignBalance`가 위험도·압력 키 완전성, 승인 범위, 유한 양수 multiplier, 범위 순서, 압력 단조성을 `INVALID_GENERATION` `RuleError`로 검증한다.
- 기존 보스 정보 export는 공통 설정의 참조 alias로 유지했고, `initializeCampaign` 시작 시 기본 설정을 검증한다.

## RED 증거

테스트를 먼저 추가한 뒤 다음 명령을 실행했다.

```text
pnpm vitest run lib/balance/campaign-balance.test.ts lib/rules/balance-validation.test.ts
```

결과는 의도한 import 실패였다.

```text
FAIL lib/balance/campaign-balance.test.ts
Error: Cannot find module './campaign-balance'

FAIL lib/rules/balance-validation.test.ts
Error: Cannot find package '@/lib/balance/campaign-balance'

Test Files  2 failed (2)
Tests  no tests
```

두 실패 모두 새 설정/검증 모듈이 아직 없기 때문이었고, 테스트 문법·기존 동작 오류는 아니었다.

## GREEN 및 검증 증거

최소 구현 뒤 관련 범위 테스트를 실행했다.

```text
pnpm vitest run lib/balance/campaign-balance.test.ts lib/rules/balance-validation.test.ts lib/content/boss-traits.test.ts lib/rules/campaign-init.test.ts

Test Files  4 passed (4)
Tests  16 passed (16)
```

타입 검사는 성공했다.

```text
pnpm typecheck
$ tsc --noEmit
```

전체 회귀는 커밋 전에 `pnpm test`와 `pnpm vitest run --reporter=dot`으로 실행했고 두 명령 모두 종료 코드 0이었다. 실행 환경 출력은 30.2초에서 Vitest 시작 헤더와 dot 진행만 보이고 최종 집계 행은 캡처하지 못했으며, 실패 출력은 없었다.

## 변경 파일

- `lib/balance/campaign-balance.ts`
- `lib/balance/campaign-balance.test.ts`
- `lib/rules/balance-validation.ts`
- `lib/rules/balance-validation.test.ts`
- `lib/content/boss-traits.ts`
- `lib/content/boss-traits.test.ts`
- `lib/rules/campaign-init.ts`
- `lib/rules/campaign-init.test.ts`

## 자체 검토

- 공통 설정 모듈은 domain·rules·store를 import하지 않아 의존성 하위에 유지된다.
- 기존 `BOSS_INFO_MULTIPLIERS`와 `BOSS_INFO_MULTIPLIER_LIMITS` 이름은 설정 객체 참조 alias로 유지해 기존 소비자를 깨지 않는다.
- 검증은 누락·추가 키까지 거부하고, NaN·Infinity·0 이하 multiplier와 잘못된 min/max, 압력 단조성 위반을 모두 `RuleError("INVALID_GENERATION")`로 처리한다.
- `initializeCampaign`의 첫 실행문은 설정 검증이므로 콘텐츠 생성보다 먼저 실패한다.
- `git diff --check`는 오류가 없었다.

## 우려 사항

- 전체 테스트 실행은 종료 코드 0이었지만, 실행 도구의 30.2초 출력 제한 때문에 Vitest 최종 집계 행을 확보하지 못했다. focused 16개 테스트와 타입 검사의 성공 출력은 확보했다.
