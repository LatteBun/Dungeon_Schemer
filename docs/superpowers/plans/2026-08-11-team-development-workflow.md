# Team Development Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 세 명이 Codespaces에서 MVP를 개발하고 Vercel Hobby의 `main` 데모 배포로 통합 결과를 확인할 수 있는 사람용·AI용 운영 문서 두 개를 만든다.

**Architecture:** `TEAM_DEVELOPMENT_WORKFLOW.md`는 사람이 따르는 협업 흐름과 도구별 책임을 설명한다. `AI_DEVELOPMENT_PRECHECK.md`는 AI가 구현 전 확인할 문서 우선순위, 작업 트리 보호, 검증 및 범위 제약을 짧은 체크리스트로 제공한다. 두 파일은 `docs/technical/`에 함께 두고 운영 규칙 변경 시 같은 변경 단위에서 갱신한다.

**Tech Stack:** Markdown, GitHub private repository, GitHub Codespaces, Vercel Hobby, pnpm, Next.js, TypeScript

## Global Constraints

- 대상은 로그인 없이 핵심 게임 루프를 검증하는 MVP다.
- 저장소는 비공개 GitHub 저장소 하나를 세 명이 공유한다.
- 개발·기능 검증은 각자의 Codespaces에서 수행한다.
- `main`은 항상 실행 가능한 통합 브랜치이며 직접 push하지 않는다.
- 작업 브랜치는 `feature/<작업명>` 형식을 사용하고 Pull Request와 동료 한 명의 확인을 거쳐 `main`에 병합한다.
- Vercel Hobby는 한 명이 소유하며 `main`의 통합 데모 배포만 확인한다.
- Vercel Hobby의 비공개 저장소 협업 제약 때문에 브랜치별 Vercel Preview를 팀 공통 검증 수단으로 사용하지 않는다.
- 초기 MVP에는 Supabase, 로그인, 비밀 환경 변수, 운영 도메인을 도입하지 않는다.
- 공통 검증 명령은 초기화 후 `pnpm lint`, `pnpm typecheck`, `pnpm build`다.
- 게임 규칙이 UI에서 분리되면 Vitest를, 화면과 핵심 루프가 안정되면 Playwright를 추가한다.

---

### Task 1: 사람용 팀 개발 운영 문서 작성

**Files:**
- Create: `docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md`

**Interfaces:**
- Consumes: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`의 기술 책임 경계와 Global Constraints의 협업·배포 기준
- Produces: 팀원이 개발, 리뷰, 병합, 데모 확인 시 읽는 단일 운영 안내

- [ ] **Step 1: 개발환경 문서의 책임 경계를 확인한다**

Run:

```powershell
Get-Content -Raw 'docs/technical/DEVELOPMENT_ENVIRONMENT.md'
```

Expected: Codespaces, Next.js, Zustand, Supabase, Vercel의 역할과 아직 확정하지 않은 항목을 확인한다.

- [ ] **Step 2: 사람용 운영 문서를 작성한다**

`docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md`에 아래 순서의 섹션을 작성한다.

```markdown
# 팀 개발 워크플로

## 목적
## MVP 범위
## 도구별 역할
## 브랜치와 Pull Request 흐름
## Codespaces에서의 개발·검증
## Vercel 데모 배포
## 병합 전과 병합 후 확인
## 운영 규칙 갱신
## 관련 문서
```

반드시 다음 내용을 명시한다.

- 비공개 GitHub 저장소 하나를 세 명이 공유한다.
- 각 기능은 `feature/<작업명>` 브랜치에서 개발하고 `main`에는 직접 push하지 않는다.
- Pull Request는 동료 한 명이 확인한 뒤 병합하며 `main`은 항상 실행 가능하게 유지한다.
- 기능 개발과 브랜치 검증은 각자의 Codespaces에서 수행한다.
- Vercel Hobby는 한 명이 소유하고 `main` 통합 데모만 배포한다.
- Vercel Hobby의 비공개 협업 제약 때문에 각 기능 브랜치의 Vercel Preview를 공통 절차로 요구하지 않는다.
- 프로젝트 초기화 뒤 병합 전 `pnpm lint`, `pnpm typecheck`, `pnpm build`를 실행한다.
- `main` 병합 뒤 Vercel 데모 URL에서 변경한 핵심 흐름을 확인한다.
- Supabase, 로그인, 비밀 환경 변수, 운영 도메인은 MVP 범위 밖이다.
- 협업·검증·배포·환경 범위가 바뀌면 이 문서와 AI 사전 점검표를 함께 갱신한다.

- [ ] **Step 3: 사람이 읽을 핵심 규칙이 모두 포함됐는지 검사한다**

Run:

```powershell
rg -n '비공개|feature/<작업명>|직접 push하지 않는다|Pull Request|Codespaces|Vercel Hobby|pnpm lint|pnpm typecheck|pnpm build|Supabase|환경 변수' 'docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md'
```

Expected: 각 핵심 규칙이 한 번 이상 출력된다.

- [ ] **Step 4: 문서 형식과 변경 내용을 검사한다**

Run:

```powershell
git diff --check -- 'docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md'
git diff -- 'docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md'
```

Expected: `git diff --check`는 출력 없이 성공하고, diff에는 새 운영 문서만 보인다.

- [ ] **Step 5: 사람용 운영 문서를 커밋한다**

```powershell
git add -- 'docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md'
git commit -m 'docs: add team development workflow'
```

Expected: 새 문서가 독립 커밋으로 기록된다.

### Task 2: AI 개발 전 사전 점검표 작성

**Files:**
- Create: `docs/technical/AI_DEVELOPMENT_PRECHECK.md`
- Reference: `docs/README.md`
- Reference: `docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md`

**Interfaces:**
- Consumes: 문서 우선순위, Task 1의 협업 흐름, Global Constraints의 MVP·검증 기준
- Produces: AI가 구현 전과 구현 후에 따라야 하는 간결한 체크리스트

- [ ] **Step 1: 공식 문서 우선순위와 팀 운영 문서를 확인한다**

Run:

```powershell
Get-Content -Raw 'docs/README.md'
Get-Content -Raw 'docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md'
```

Expected: `GAME_PRINCIPLES.md`가 최상위 기준이고 새 운영 문서가 인간 협업 기준임을 확인한다.

- [ ] **Step 2: AI 사전 점검표를 작성한다**

`docs/technical/AI_DEVELOPMENT_PRECHECK.md`에 아래 순서의 섹션을 작성한다.

```markdown
# AI 개발 전 사전 점검표

## 사용 시점
## 구현 전 확인
## 작업 중 제약
## 구현 후 검증
## 규칙 변경 시 문서 갱신
## 관련 문서
```

`구현 전 확인`에는 다음 체크 항목을 넣는다.

- `docs/README.md`와 `docs/GAME_PRINCIPLES.md`를 먼저 읽고 작업 관련 공식 문서를 확인한다.
- 현재 브랜치, `git status --short`, 영향 파일을 확인하고 다른 작업자의 변경을 보존한다.
- 요청이 로그인 없는 핵심 게임 루프 MVP 범위 안인지 확인한다.
- Supabase, 로그인, 비밀 환경 변수, 운영 도메인을 새로 도입하지 않는다.

`작업 중 제약`에는 다음 체크 항목을 넣는다.

- 기능 작업은 `feature/<작업명>`에서 수행하고 `main`에 직접 push하지 않는다.
- 기능 실행 확인은 Codespaces에서 먼저 수행한다.
- Vercel Hobby는 `main` 통합 데모용이며 기능 브랜치의 공통 검증 수단이 아니다.
- 게임 규칙을 UI에 숨기지 않고 테스트 가능한 로직으로 분리하는 기존 기술 문서의 방향을 따른다.

`구현 후 검증`에는 다음 체크 항목을 넣는다.

- 초기화가 완료된 뒤 `pnpm lint`, `pnpm typecheck`, `pnpm build`를 실행한다.
- 변경한 핵심 흐름을 Codespaces에서 수동으로 확인한다.
- `main` 병합 뒤에는 Vercel 데모 URL에서 변경 흐름을 확인한다.
- 게임 규칙 분리 후 Vitest, 화면과 루프 안정화 후 Playwright 도입 여부를 검토한다.

마지막으로 협업·검증·배포·환경·MVP 범위가 바뀌면 이 문서와 사람용 운영 문서를 함께 갱신하게 한다.

- [ ] **Step 3: AI가 지켜야 할 제약과 검증 항목을 검사한다**

Run:

```powershell
rg -n 'GAME_PRINCIPLES|git status --short|다른 작업자의 변경|Supabase|로그인|환경 변수|feature/<작업명>|Codespaces|Vercel Hobby|pnpm lint|pnpm typecheck|pnpm build|Vitest|Playwright' 'docs/technical/AI_DEVELOPMENT_PRECHECK.md'
```

Expected: 문서 우선순위, 작업 트리 보호, MVP 범위, 브랜치·배포 제약, 검증 명령, 테스트 도입 시점이 모두 출력된다.

- [ ] **Step 4: 전체 문서 무결성과 누락 없는 상태를 검사한다**

Run:

```powershell
git diff --check
git status --short
```

Expected: 공백 오류가 없고, 이번 작업에서는 AI 점검표 파일만 추적되지 않은 변경으로 표시된다.

- [ ] **Step 5: AI 사전 점검표를 커밋한다**

```powershell
git add -- 'docs/technical/AI_DEVELOPMENT_PRECHECK.md'
git commit -m 'docs: add AI development precheck'
```

Expected: 두 운영 문서가 각각 검증된 독립 커밋으로 기록된다.
