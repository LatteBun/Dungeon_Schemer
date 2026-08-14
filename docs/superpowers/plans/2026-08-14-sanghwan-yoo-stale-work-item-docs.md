# 낡은 작업 ID 문서 참조 정리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 공식 문서와 개발용 소스에서 이전 작업 ID와 의미가 어긋난 신규 ID 표현을 제거하고 기능 의미를 명확히 한다.

**Architecture:** 작업표의 새 ID와 의미를 기준으로 공식 문서·개발 검증 화면·하네스 식별자를 대조한다. 정보 카드 검증 기능은 `R3` 대신 의미 기반 이름과 `/info-card-test` 라우트를 사용하고, 현재 의미가 맞는 `F1/F2/C1` 참조는 유지한다.

**Tech Stack:** Markdown, TypeScript, React, Next.js App Router, Vitest, pnpm

## Global Constraints

- 게임 규칙과 정보 카드·신뢰 판정 로직의 실행 동작은 변경하지 않는다.
- `F1`은 캠페인·탐험 도메인 계약, `F2`는 사건·카드·아이템 콘텐츠, `C1`은 캠페인 초기화·게시판의 현재 의미와 맞는 경우에만 유지한다.
- `R1`, `R3`, `P2`, `U4`, `F3`와 `R3` 복합 식별자는 현재 공식 문서·소스에서 제거한다.
- 정보 카드 개발 경로는 `/info-card-test`로 바꾸고 `/r3-test` 호환 별칭은 만들지 않는다.
- `docs/superpowers/`의 날짜 기반 spec·plan 역사 기록은 수정하지 않는다.
- 커밋 메시지는 제목과 본문을 포함한 한글로 작성한다.
- 검증은 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 사용한다.

---

### Task 1: 공식 문서와 배정표 검사 예시 정리

**Files:**
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`
- Modify: `docs/systems/PARTY_AND_TRUST.md`
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts`

**Interfaces:**
- Consumes: 현재 작업표의 ID 의미와 PR #22의 재번호 정책
- Produces: 현재 공식 문서와 배정표 무결성 검사에 의미 기반 표현만 남긴 문서

- [ ] **Step 1: 배정표에 ID 네임스페이스 안내를 추가한다**

  `PROTOTYPE_WORK_ASSIGNMENT.md`의 목적 절에 2026-08-13 개편으로 ID를 새로 부여했다는 점과 이전 문서의 동일한 글자는 이전 작업표를 가리킨다는 점을 기록한다. 현재 ID와 의존성 그래프는 수정하지 않는다.

- [ ] **Step 2: 공식 시스템 문서의 이전 ID를 의미로 치환한다**

  `PARTY_AND_TRUST.md`의 `R2`, `R3`, `P2`를 각각 신뢰 판정, 정보 카드 판정, 보스전·종료 판정으로 바꾼다. `DEVELOPMENT_ENVIRONMENT.md`의 `R1`, `R4`를 파티 생성 규칙, 던전 생성 규칙으로 바꾼다. 수치·규칙·라우트 동작은 건드리지 않는다.

- [ ] **Step 3: 배정표 테스트 주석의 존재하지 않는 예시를 바꾼다**

  `PROTOTYPE_WORK_ASSIGNMENT.test.ts`의 예시 `F3`, `R1`을 현재 표에 존재하는 `C1`, `E1` 등으로 바꾸되 테스트 로직과 정규식은 변경하지 않는다.

- [ ] **Step 4: 문서 관련 테스트를 실행한다**

  Run: `pnpm test -- docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts`

  Expected: 배정표 파싱·그래프·선행 검사가 모두 PASS.

- [ ] **Step 5: 변경을 커밋한다**

  Commit: `문서: 공식 작업 ID 참조를 의미로 정리`

### Task 2: 정보 카드 하네스와 개발 라우트 이름 변경

**Files:**
- Rename: `lib/dev-tools/test-snapshots.ts` identifiers `R3HarnessOptions`, `R3HarnessResult`, `createR3HarnessResult`
- Modify: `lib/dev-tools/test-snapshots.test.ts`
- Rename: `app/r3-test/page.tsx` → `app/info-card-test/page.tsx`
- Rename: `app/r3-test/r3-test-panel.tsx` → `app/info-card-test/info-card-test-panel.tsx`
- Modify: `app/integration-test/integration-test-panel.tsx`

**Interfaces:**
- Consumes: `InfoCard`, `InfoCardEvaluation`, `evaluateInfoCard`, `HarnessAudience`
- Produces: `InfoCardHarnessOptions`, `InfoCardHarnessResult`, `createInfoCardHarnessResult`, `/info-card-test`

- [ ] **Step 1: 하네스 공개 식별자를 의미 기반으로 바꾼다**

  `R3HarnessOptions` → `InfoCardHarnessOptions`, `R3HarnessResult` → `InfoCardHarnessResult`, `createR3HarnessResult` → `createInfoCardHarnessResult`로 바꾸고 모든 import·ReturnType 참조를 갱신한다. 반환값과 판정 호출은 변경하지 않는다.

- [ ] **Step 2: 하네스 테스트를 갱신한다**

  `lib/dev-tools/test-snapshots.test.ts`의 import와 호출을 새 함수명으로 바꾸고 테스트 설명에 남은 `R3`를 정보 카드 의미로 바꾼다.

- [ ] **Step 3: 개발 라우트를 의미 기반 경로로 옮긴다**

  `app/r3-test/`를 `app/info-card-test/`로 옮긴다. 페이지·패널 export, `r3-*` input id/name, 기본 seed, 화면 제목과 설명을 정보 카드 판정 의미로 바꾼다. `/r3-test` 별칭은 만들지 않는다.

- [ ] **Step 4: 통합 검증 링크를 갱신한다**

  `app/integration-test/integration-test-panel.tsx`의 `/r3-test` 링크를 `/info-card-test`로 바꾸고 링크 문구를 `정보 카드 단독 테스트`로 변경한다. 통합 화면의 현재 `F1/F2/C1` 의미는 유지한다.

- [ ] **Step 5: 타입 검사와 하네스 테스트를 실행한다**

  Run: `pnpm typecheck` and `pnpm test -- lib/dev-tools/test-snapshots.test.ts`

  Expected: 새 식별자 import가 모두 해결되고 테스트가 PASS.

- [ ] **Step 6: 변경을 커밋한다**

  Commit: `개발: 정보 카드 검증 하네스 이름을 의미로 변경`

### Task 3: 상태 미리보기와 신규 ID 표현 명확화

**Files:**
- Modify: `app/state-preview/state-preview-panel.tsx`
- Modify: `app/state-preview/preview-run.test.ts`
- Modify: `app/f1-test/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/info-card-test/info-card-test-panel.tsx`

**Interfaces:**
- Consumes: 현재 `F1` 도메인 계약과 상태 스토어 미리보기 화면
- Produces: 신규 ID의 의미와 일치하는 화면·테스트 문구

- [ ] **Step 1: 상태 미리보기의 잘못된 F2/R1 문구를 제거한다**

  `F2 상태 스토어 개발 미리보기`를 `상태 스토어 개발 미리보기`, `R1 파티 생성 재현 확인`을 `파티 생성 재현 확인`으로 바꾸고 `preview-run.test.ts`의 describe·it 설명에서도 `R1`을 제거한다.

- [ ] **Step 2: F1 화면의 모호한 영문명을 정확히 한다**

  `F1 / Foundation Contract`를 `F1 / Campaign Domain & State Contract`로 바꾼다. `F1`의 지도·탐험 계약 설명은 현재 F1 범위와 일치하도록 유지한다.

- [ ] **Step 3: 정보 카드 화면의 상태 링크와 U4 주석을 정리한다**

  정보 카드 화면의 `F2 상태 미리보기` 링크를 `상태 스토어 미리보기`로 바꾸고, `app/globals.css`의 `U1~U4` 주석을 작업 ID 없는 디자인 토큰 설명으로 변경한다.

- [ ] **Step 4: 관련 테스트를 실행한다**

  Run: `pnpm test -- app/state-preview/preview-run.test.ts`

  Expected: seed 재현과 파티 생성 검사가 PASS.

- [ ] **Step 5: 변경을 커밋한다**

  Commit: `개발: 검증 화면의 작업 ID 의미를 명확히 한다`

### Task 4: 전수 검색과 전체 검증

**Files:**
- Verify: all `docs/**/*.md`, `app/**/*.{ts,tsx}`, `components/**/*.{ts,tsx}`, `lib/**/*.{ts,tsx}`, `app/globals.css`

**Interfaces:**
- Consumes: Tasks 1–3의 문서·소스 변경
- Produces: 이전 ID와 의미가 어긋난 신규 ID가 남지 않은 검증된 브랜치

- [ ] **Step 1: 이전 ID와 복합 식별자를 검색한다**

  Run: `rg -n -g '*.md' -g '*.ts' -g '*.tsx' -g '*.css' -g '!docs/superpowers/**' -g '!node_modules/**' '(R[1-5]|P[1-2]|U[4-5]|Q3|F[3-5])' docs app components lib`

  Expected: 역사 기록을 제외한 현재 문서·소스에서 결과가 없고, `/info-card-test`만 새 정보 카드 경로로 존재한다.

- [ ] **Step 2: 전체 검증을 실행한다**

  Run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

  Expected: 네 명령이 모두 성공한다.

- [ ] **Step 3: 최종 변경을 커밋한다**

  Commit: `검증: 낡은 작업 ID 참조 정리 완료`
