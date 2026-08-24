# Task 2 구현 보고서 — 월드턴 소모와 회복 조정

## 결과

- `REST_RECOVERY_RATIO`가 `CAMPAIGN_BALANCE.worldTurn.restRecoveryRatio`를 읽도록 연결했다.
- 백그라운드 HP 손실 범위가 `CAMPAIGN_BALANCE.worldTurn.backgroundLossPercent`의 5~10%를 사용하도록 연결했다.
- 휴식 20%, 백그라운드 양 끝값 5%·10%를 검증하는 회귀 테스트를 추가·갱신했다.
- 강제 휴식 50%, 중상 20%, 최소 회복 2, HP 하한 1, 골드 5~15 계약은 변경하지 않았다.
- `CAMPAIGN_BALANCE`를 domain barrel에서도 내보내 공통 설정 접근 경로를 보존했다.

## RED 증거

새 기대값을 먼저 추가하고 기존 구현에서 실행했다.

```text
pnpm vitest run lib/domain/worldturn.test.ts

Test Files  1 failed (1)
Tests  4 failed | 26 passed (30)
```

실패는 구현이 아직 15% 회복·10~20% 손실을 사용하기 때문이었다. 예를 들어 휴식은
`expected 60, received 55`, 기존 백그라운드 경계는 `expected 45, received 40`으로
실패했다. 10% 경계도 기존 최대값 20%를 사용해 `expected 40, received 30`이었다.

## GREEN 및 검증 증거

설정 참조를 최소 변경한 뒤 오래된 회복 관련 경계 기대값도 새 20% 규칙에 맞춰
갱신했다.

```text
pnpm vitest run lib/domain/worldturn.test.ts && pnpm typecheck

Test Files  1 passed (1)
Tests  30 passed (30)
$ tsc --noEmit
```

기본 제한으로 실행한 전체 테스트는 40개 시드 캠페인 검사가 Vitest 기본 5초
제한에 걸렸다.

```text
pnpm vitest run

Test Files  1 failed | 106 passed (107)
Tests  1 failed | 971 passed (972)
FAIL lib/store/campaign-full-run.test.ts > 막다른 길이 없다 > 어느 시드로 시작해도 끝까지 간다
Error: Test timed out in 5000ms.
```

해당 테스트를 20초 제한으로 단독 실행했을 때는 통과했다.

```text
pnpm vitest run lib/store/campaign-full-run.test.ts --testTimeout=20000

Test Files  1 passed (1)
Tests  7 passed (7)
```

같은 제한을 적용한 전체 회귀 실행은 모두 통과했다.

```text
pnpm vitest run --testTimeout=20000

Test Files  107 passed (107)
Tests  972 passed (972)
```

## 변경 파일

- `lib/domain/worldturn.ts`
- `lib/domain/worldturn.test.ts`
- `lib/domain/index.ts`

## 자체 검토

- 생산 코드의 숫자 원본은 월드턴 설정 두 값으로만 교체했다. 강제 휴식·중상 판정·
  최소 회복·HP 하한·골드 범위 계산은 건드리지 않았다.
- RNG 경계 테스트는 최소 5%와 최대 10%를 각각 확인하며, 기존 결과 순서와
  불변성 계약 테스트는 그대로 유지된다.
- `CAMPAIGN_BALANCE` export는 기존 월드턴 상수 export 블록과 인접한 domain barrel에
  추가했고 다른 모듈은 수정하지 않았다.
- `git diff --check`는 오류가 없었다.

## 우려 사항

- 새 20% 회복 규칙에서는 저 HP 캐릭터가 휴식 후 중상 임계 이상으로 회복하므로,
  기존의 “휴식 처리 후 새 중상 발생” 기대값은 더 이상 도달 가능한 시나리오가 아니다.
  테스트를 강제 휴식 후 중상 아님으로 갱신했고, 기존 중상 해제·정확한 임계 판정
  계약은 계속 검증한다.
- 기본 Vitest 5초 제한은 전체 실행에서 한 시드 스캔을 timeout시키지만, 20초 제한의
  전체 실행은 107개 파일·972개 테스트 모두 통과했다.
