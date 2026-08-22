# PR 88 문서 무결성 검증 복구 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR 88의 `U5_2` Mermaid 식별자와 `U5-2` 배정표 ID를 같은 작업으로 해석하고, 현재 문서 용어 검증까지 통과시킨다.

**Architecture:** Mermaid 토큰만 배정표 정식 ID 형식으로 정규화한다. 그래프 선언과 간선에서 같은 정규화를 사용해 표·그래프 비교의 입력을 통일한다. E3의 방문 시 사건 물질화 설명에는 기존 필수 용어를 복원한다.

**Tech Stack:** TypeScript, Vitest, Markdown, pnpm, Next.js 16.3.0

**Spec:** `docs/superpowers/specs/2026-08-22-lattebun-pr88-validation-design.md`

## Global Constraints

- PR 88의 자동 전투 규칙·의존성·배정표 상태는 바꾸지 않는다.
- Mermaid의 `_` 구분자만 배정표 ID의 `-` 구분자로 정규화한다.
- 기존 이미지 최적화 lint 경고는 범위 밖으로 유지한다.
- 구현 전 실패하는 회귀 테스트를 확인하고, 모든 수정 뒤 lint·typecheck·test·build를 실행한다.

---

## File Structure

- `docs/technical/work-assignment-integrity.ts`: Mermaid 식별자를 정규화해 그래프와 표의 작업 ID를 일관되게 비교한다.
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`: PR 88의 하이픈 ID가 그래프 검증에서 누락되지 않는 회귀 사례를 검증한다.
- `docs/design/CORE_GAME_LOOP.md`: E3가 방문 시 실제 사건을 고르는 설명에 필수 문서 앵커를 복원한다.

### Task 1: Mermaid 작업 ID 회귀 테스트 추가

**Files:**

- Modify: `docs/technical/work-assignment-integrity.ts`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`

**Interfaces:**

- Consumes: `describeWorkAssignment(label, docPath)` from `./work-assignment-integrity`.
- Produces: `U5_2` Mermaid ID가 `U5-2` 배정표 행과 동일하게 검증되어야 한다는 회귀 계약.

- [ ] **Step 1: 임시 Markdown에 Mermaid `U5_2`와 표 `U5-2`를 넣어 정규화되지 않으면 실패하는 회귀 테스트를 작성한다.**

- [ ] **Step 2: `pnpm vitest run docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`를 실행한다.**

Expected: 그래프·표 ID 비교에서 `U5-2`가 누락되어 실패한다.

- [ ] **Step 3: `normalizeMermaidTaskId`를 추가하고 그래프 선언과 간선 ID에 적용한다.**

```ts
function normalizeMermaidTaskId(id: string): string {
  return id.replaceAll("_", "-");
}
```

- [ ] **Step 4: `pnpm vitest run docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts`를 다시 실행한다.**

Expected: 테스트 파일의 모든 테스트가 통과한다.

- [ ] **Step 5: 변경 파일을 한국어 제목·본문 커밋으로 저장한다.**

### Task 2: 핵심 게임 루프 문서 앵커 복원

**Files:**

- Modify: `docs/design/CORE_GAME_LOOP.md`
- Test: `docs/DOCUMENT_TERMINOLOGY.test.ts`

**Interfaces:**

- Consumes: `REQUIRED_ANCHORS["design/CORE_GAME_LOOP.md"]`의 `방문한 사건` 계약.
- Produces: E3의 사건 물질화 책임을 설명하면서 필수 문구를 포함하는 공식 문서.

- [ ] **Step 1: `pnpm vitest run docs/DOCUMENT_TERMINOLOGY.test.ts`를 실행한다.**

Expected: `design/CORE_GAME_LOOP.md: "방문한 사건" 없음`으로 실패한다.

- [ ] **Step 2: E3 책임 문장을 다음으로 변경한다.**

```md
일반 사건의 선택·중복 방지·약한/강한 연계와 **방문한 사건**의 물질화 방식은 E3가 소유한다.
```

- [ ] **Step 3: `pnpm vitest run docs/DOCUMENT_TERMINOLOGY.test.ts`를 다시 실행한다.**

Expected: 모든 문서 용어 테스트가 통과한다.

- [ ] **Step 4: 문서 변경을 한국어 제목·본문 커밋으로 저장한다.**

### Task 3: 전체 검증 및 PR 생성

**Files:**

- Verify only: repository root

**Interfaces:**

- Consumes: Tasks 1–2의 커밋된 수정.
- Produces: 원격 브랜치와 `main` 대상 Pull Request.

- [ ] **Step 1: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 실행한다.**

Expected: 모두 종료 코드 0으로 완료된다. 기존 `@next/next/no-img-element` 경고는 오류가 아니며 범위 밖이다.

- [ ] **Step 2: `git status --short`로 사용자 미추적 에셋이 스테이징되지 않았음을 확인한다.**

- [ ] **Step 3: 설계와 계획 문서를 한국어 제목·본문 커밋으로 저장한다.**

- [ ] **Step 4: `codex/pr88-validation-fix` 브랜치를 푸시하고 `main` 대상 PR을 생성한다.**

GitHub CLI가 없으면 GitHub 비교 URL을 열어 제목 `수정: PR 88 문서 검증 복구`와 원인·수정·검증 결과를 담은 본문으로 생성한다.
