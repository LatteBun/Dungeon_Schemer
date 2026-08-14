# 낡은 작업 ID 문서 참조 정리 설계

> 작성자: SangHwan Yoo
>
> 작성 도구: Codex

## 배경

PR #22는 2026-08-13 캠페인 개편에서 작업 ID를 새로 부여하면서, 코드 주석에 남은 이전 ID가 사라진 작업 또는 다른 작업을 가리키게 된 문제를 정리했다. 현재 공식 문서에도 같은 문제가 남아 있다. 특히 `docs/systems`와 `docs/technical`의 문서는 현재 설계와 개발 기준을 설명하므로, 이전 작업표의 ID가 현재 작업표의 ID로 오해되지 않아야 한다.

## 목표

- 현재 공식 문서에서 역사적 작업 ID를 의미 기반 표현으로 바꾼다.
- 새 작업표의 ID 체계와 이전 문서의 ID 체계를 구분할 수 있도록 배정표에 안내를 추가한다.
- 소스 코드와 개발용 검증 화면에서도 이전 작업 ID를 기능 의미로 바꾼다.
- 날짜가 있는 spec·plan은 역사 기록으로 보존한다.

## 대상 문서와 변경 내용

### `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`

`목적과 현재 상태` 절에 ID 네임스페이스 안내를 추가한다. 이 표의 ID는 2026-08-13 캠페인 개편으로 새로 부여했으며, 이전 문서의 `R1`, `R3`, `P1`, `P2` 등은 이전 작업표를 가리킨다는 점과 코드 주석에서는 작업 의미를 사용한다는 점을 명시한다.

현재 표의 `F1`, `F2`, `C1`~`C4`, `E1`~`E3`, `U1`~`U3`, `I1`, `Q1`, `Q2` ID와 의존성 그래프는 변경하지 않는다.

### `docs/systems/PARTY_AND_TRUST.md`

현재 신뢰 시스템을 설명하는 문서에 남은 이전 작업 ID를 다음 의미 표현으로 바꾼다.

| 이전 표현 | 새 표현 |
| --- | --- |
| `R2` | 신뢰 판정 또는 신뢰 시스템 |
| `R3 정보 카드` | 정보 카드 판정 |
| `P2` | 보스전·종료 판정 |

문서의 규칙 자체, 수치, 공통 행동 이름은 변경하지 않는다.

### `docs/technical/DEVELOPMENT_ENVIRONMENT.md`

현재 개발 환경 설명에 남은 `R1 파티 생성`과 `R4 던전 생성`을 각각 `파티 생성 규칙`과 `던전 생성 규칙`으로 바꾼다. `/state-preview` 라우트는 유지하되 화면 문구의 이전 작업 ID는 제거한다.

### 소스 코드와 개발 검증 화면

이전 ID를 코드 식별자나 화면 라우트에 남기지 않고 기능 의미를 사용한다. 같은 글자가 새 작업표에도 존재하는 경우에는 현재 의미와 일치하는 참조만 유지한다.

| 대상 | 변경 |
| --- | --- |
| `lib/dev-tools/test-snapshots.ts`와 사용처 | `R3HarnessOptions`, `R3HarnessResult`, `createR3HarnessResult`를 정보 카드 하네스 의미의 `InfoCardHarnessOptions`, `InfoCardHarnessResult`, `createInfoCardHarnessResult`로 변경 |
| `lib/dev-tools/test-snapshots.test.ts` | 변경한 하네스 함수 이름을 사용하고 테스트 설명에서 `R3`를 제거 |
| `app/r3-test/` | `app/info-card-test/`로 라우트와 파일을 옮기고 `R3TestPage`, `R3TestPanel`, `r3-*` HTML 식별자·seed를 정보 카드 테스트 의미로 변경 |
| `app/integration-test/integration-test-panel.tsx` | `/r3-test` 링크를 `/info-card-test`로 바꾸고 링크 문구를 `정보 카드 단독 테스트`로 변경. 현재 작업표와 일치하는 `F1/F2/C1`은 유지 |
| `app/state-preview/` | `F2 상태 스토어`, `R1 파티`를 각각 `상태 스토어`, `파티 생성`으로 변경 |
| `app/globals.css` | `U1~U4` 주석을 작업 ID가 없는 의미 기반 문구로 변경 |
| `app/f1-test/page.tsx` | `F1 / Foundation Contract`를 현재 F1 의미인 `F1 / Campaign Domain & State Contract`로 변경 |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts` | 예시의 존재하지 않는 `F3`, `R1`을 현재 작업표에 있는 `C1`, `E1`로 변경 |
| `app/r3-test/`의 상태 미리보기 링크 | `F2 상태 미리보기`를 `상태 스토어 미리보기`로 변경 |

`/r3-test`는 개발용 검증 라우트이므로 새 `/info-card-test` 경로로 교체하며 이전 경로 호환용 별칭은 두지 않는다. 게임 동작과 판정 로직은 변경하지 않는다.

## 변경하지 않는 범위

- `docs/superpowers/specs/`와 `docs/superpowers/plans/`의 날짜 기반 기록은 당시 작업 ID를 보존한다.
- `docs/README.md`, `docs/technical/F1_TESTING.md`, `docs/technical/F2_TESTING.md`의 새 작업 ID 참조는 바꾸지 않는다.
- 현재 작업표와 의미가 일치하는 `F1`, `F2`, `C1`, `U1`~`U3`, `Q1`, `Q2` 참조는 바꾸지 않는다.
- 게임 규칙과 판정 로직, 작업표의 의존성 구조는 바꾸지 않는다.

## 검증 기준

1. 공식 문서 영역(`docs/systems`, `docs/technical`)에서 이전 작업표의 `R1`~`R5`, `P1`~`P2` 참조가 의미 기반 문구로 정리된다.
2. 배정표의 새 ID, 그래프, 완료 상태, 선행 관계는 변경 전과 동일하다.
3. `docs/superpowers/`의 역사 기록은 변경되지 않는다.
4. 소스 코드와 개발 검증 화면에서 이전 ID 기반의 `R1`, `R3`, `P2`, `U4` 및 `R3` 복합 식별자가 제거된다. 새 정보 카드 테스트 경로는 `/info-card-test`이며, 현재 ID 예시는 실제 배정표에 존재하는 노드만 사용한다.
5. Markdown과 소스 코드 변경 후 배정표 무결성 테스트와 전체 정적·테스트 검증을 실행한다.

