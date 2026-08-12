# State Preview R1 연동 설계

**작성자:** SangHwan Yoo
**작성 도구:** Codex
**상태:** 제안

## 목적

F2의 `/state-preview`가 고정된 예시 파티 대신 병합된 R1 파티 생성 규칙의 실제 결과를 표시하게 한다. 동료가 배포 환경에서도 seed를 직접 입력해 같은 파티가 재현되는지, 새 seed에서 파티 구성이 달라지는지를 확인할 수 있게 한다.

이 작업은 F2 완료 기록을 보존하는 후속 연동이다. R1의 규칙·콘텐츠·초기 신뢰 값은 변경하지 않는다.

## 기준 문서

- [게임 원칙](../../GAME_PRINCIPLES.md): 파티원별 직업·성격·신뢰를 개별적으로 다룬다.
- [파티와 신뢰](../../systems/PARTY_AND_TRUST.md): 파티는 3~5명이고 직업·성격이 중복되지 않는다.
- [개발 환경](../../technical/DEVELOPMENT_ENVIRONMENT.md): 난수는 `Rng`를 인자로 받고 시스템별 독립 스트림을 사용한다.
- [프로토타입 작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md): R1과 F2 완료 상태 및 P1의 남은 선행을 갱신한다.
- [R1 파티 생성 규칙 설계](2026-08-12-party-generation-sbh3821-design.md): `generateParty(rng)`의 생성 계약과 잠정 초기 신뢰 값을 따른다.
- [F2 상태 스토어 골격 설계](2026-08-12-state-store-sanghwan-yoo-design.md): Run/UI Store 분리와 preview의 기술 검증 책임을 유지한다.

## 설계 결정

### 실제 R1 파티를 preview에 연결한다

`createPreviewRun(seed: string)`의 `party`는 다음 호출의 결과다.

```ts
generateParty(createRng(seed).derive("party"))
```

이 호출은 R1이 정한 3~5명, 직업·성격·이름 중복 불허, 성격별 초기 신뢰 기본값 ±5, 모든 구성원의 `alive: true`를 그대로 보존한다. 고정 아리아·보린·셀린 fixture는 제거한다.

`RunState`의 `phase`, 최소 던전 그래프, 자원, `pendingClaims`, `log`는 여전히 F2 기술 fixture다. R4 던전 생성, R2 신뢰 변화, P1 상태 전이는 이 작업에 포함하지 않는다.

### seed 입력으로 재현성을 수동 검증한다

`StatePreviewPanel`은 초기값 `f2-preview-initial`의 로컬 seed 입력 상태를 가진다. 화면의 seed 입력과 동작은 다음 계약을 따른다.

- `입력한 seed로 생성`: 입력값을 앞뒤 공백 제거 후 사용해 `startNewRun(createPreviewRun, seed)`를 호출하고 UI 선택을 초기화한다.
- 공백만 있는 입력값은 런·선택을 바꾸지 않고 입력 아래에 오류를 표시한다.
- `새 미리보기 런`: `createSeed()`로 UUID를 만든 뒤 명시적으로 `startNewRun(createPreviewRun, newSeed)`를 호출하고, 입력값을 새 seed로 바꾸며 UI 선택을 초기화한다.
- `모두 초기화`: Run Store와 UI Store를 초기화하고 입력값을 `f2-preview-initial`로 되돌리며 오류를 지운다.

새 런을 만들 때 UI 선택을 함께 지우는 이유는 `member-1` 같은 동일 ID가 다른 생성 파티원을 가리키는 잘못된 선택 상태를 막기 위해서다.

### 동료가 규칙을 읽을 수 있게 표시한다

상단 안내는 `R1 파티 생성 규칙의 실제 결과를 보여 주는 기술 검증 화면`임을 밝힌다. 기존 `Development only`와 `표시 값은 기술 검증용 예시` 안내는 유지한다.

파티 카드에는 이름, 한국어 직업명과 class ID, 성격 식별자, 개인 trust, 생존 상태를 표시한다. 개인 신뢰의 평균이나 합계는 표시하지 않는다.

입력 영역에는 같은 seed는 같은 파티를 재현하고 새 seed는 다른 조합을 생성한다는 수동 검증 안내를 표시한다.

### production에서도 공개한다

`app/state-preview/page.tsx`는 Server Component를 유지하고 production의 `notFound()` 가드와 import를 제거한다. `/state-preview`는 development와 production 모두 같은 fixture와 상호작용을 제공한다.

홈에서는 이 라우트에 링크하지 않는다. 화면은 고정 fixture와 공개된 R1 콘텐츠만 사용하고 인증, 사용자 데이터, 환경 비밀, 저장 기능을 사용하지 않으므로 별도 접근 제어를 추가하지 않는다.

## 파일과 인터페이스

| 파일 | 변경 책임 |
| --- | --- |
| `app/state-preview/preview-run.ts` | R1의 `generateParty(createRng(seed).derive("party"))`로 `RunState.party` 구성 |
| `app/state-preview/preview-run.test.ts` | preview가 정확한 R1 `party` 스트림 결과를 사용하는 회귀 테스트 |
| `app/state-preview/state-preview-panel.tsx` | seed 입력, 생성·오류·초기화 흐름과 직업 표시 |
| `app/state-preview/page.tsx` | production 404 가드 제거 |
| `docs/technical/DEVELOPMENT_ENVIRONMENT.md` | 공개 기술 검증 라우트와 R1 연동 검증 방법 기록 |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | F2·R1 완료와 P1의 남은 선행 `R4` 기록 |

`createPreviewRun(seed: string): RunState`, `generateParty(rng: Rng): PartyMember[]`, Run Store와 UI Store의 public API는 유지한다.

## 테스트와 검증

Vitest Node 환경을 유지하며 React DOM 테스트 도구를 추가하지 않는다.

`preview-run.test.ts`는 다음을 검증한다.

- `createPreviewRun("manual-seed").party`가 `generateParty(createRng("manual-seed").derive("party"))`와 깊은 비교로 같다. 이 테스트는 preview가 고정 파티를 쓰거나 `party` 스트림을 생략하면 실패한다.
- 서로 다른 두 seed의 preview 파티가 다르다.

정적·통합 검증은 다음을 사용한다.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

개발 서버에서는 같은 seed를 두 번 적용해 같은 파티인지, 다른 seed와 새 미리보기 런에서 파티가 바뀌는지, 선택·해제·초기화가 유지되는지 확인한다. production 서버에서는 `/`와 `/state-preview`가 모두 `200`인지 확인한다.

## 문서와 완료 기록

구현 전에 최신 `origin/main`을 F2 브랜치에 병합해 R1 구현과 배정표 무결성 검사를 포함한다. 문서 충돌이 생기면 R1·F2의 기존 기술 계약을 모두 보존한다.

완료 시 배정표는 다음을 만족한다.

- F2: 담당 `SangHwan Yoo`, 상태 `✅`
- R1: 담당 `sbh3821`, 상태 `✅`
- P1의 남은 선행: `R4`

## 제외 범위

- R1의 직업·이름 콘텐츠, 중복 규칙, 초기 신뢰 상수 변경
- R2, R3, R4, P1의 규칙이나 상태 전이 구현
- 실제 게임 홈 화면·온보딩·F5 화면 셸 변경
- URL 기반 seed 공유, localStorage, Zustand persist, Supabase 저장
- preview의 인증 또는 사용자별 접근 제어

## 완료 조건

- preview 파티가 고정 fixture가 아닌 실제 R1 결과다.
- 같은 입력 seed가 같은 파티를 만들고, 새 UUID seed로 새 파티를 만들 수 있다.
- 공백 seed는 상태를 변경하지 않고 오류를 알린다.
- 새 런·초기화 시 UI 선택과 seed 입력 상태가 일관되게 초기화된다.
- production `/state-preview`가 `200`으로 열리고 기술 검증 안내를 유지한다.
- F2와 R1의 완료 상태, P1의 남은 선행이 배정표에 반영된다.
- lint, typecheck, 단위 테스트, production build가 모두 통과한다.
