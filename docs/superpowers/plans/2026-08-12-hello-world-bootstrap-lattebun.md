# Hello World 초기화 Implementation Plan

**작성자:** LatteBun  
**작성 도구:** Codex

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기준 런타임으로 Next.js 앱을 초기화하고 루트의 Hello World와 공통 검증 명령을 제공한다.

**Architecture:** 저장소 루트의 Next.js App Router와 TypeScript·Tailwind CSS를 사용한다. 앱 셸은 `app/`에 두며 게임·인증·데이터 계층은 만들지 않는다. `.nvmrc`, `package.json`, `pnpm-lock.yaml`, Codespaces 설정으로 재현성을 확보한다.

**Tech Stack:** Node.js 24.19.0, npm 11.17.0, pnpm 11.21.0, Next.js App Router, React, TypeScript, Tailwind CSS, ESLint

## Global Constraints

- Node.js `24.19.0`, npm `11.17.0`, pnpm `11.21.0`을 사용한다.
- 설치와 스크립트 실행은 pnpm으로만 수행한다.
- App Router를 사용하고 `src/` 디렉터리는 만들지 않는다.
- `/`에는 `Hello World`와 Dungeon Schemer 식별 문구를 표시한다.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`가 성공해야 한다.
- Supabase, 로그인, 환경 변수, Vercel 연결, Zustand, Framer Motion, 테스트 도구, 게임 로직을 추가하지 않는다.
- 기술 환경·AI 사전 점검·팀 워크플로 문서를 같은 변경 단위에서 갱신한다.

---

### Task 0: 구현 전에 공식 기술 문서를 초기화 결정으로 갱신한다

**Files:**
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`
- Reference: `docs/superpowers/specs/2026-08-12-hello-world-bootstrap-lattebun-design.md`

**Interfaces:**
- Consumes: 승인된 Hello World 초기화 설계
- Produces: App Router, 루트 `app/` 구조, 초기화 범위가 명확한 공식 기술 기준

- [ ] **Step 1: 기술 문서의 미확정 항목을 확인한다**

Run: `rg -n "아직 확정하지 않는 것|라우터|초기화" docs/technical/DEVELOPMENT_ENVIRONMENT.md`

Expected: App Router와 루트 앱 구조가 아직 미확정임을 확인한다.

- [ ] **Step 2: App Router와 초기화 범위를 공식 문서에 반영한다**

`DEVELOPMENT_ENVIRONMENT.md`에 Next.js App Router, 루트 `app/` 구조, 이번 초기화에서 제외할 Supabase·로그인·환경 변수·게임 기능을 기록한다. 현재 문서의 Node.js·pnpm 고정 버전은 바꾸지 않는다.

- [ ] **Step 3: 공식 문서 갱신을 확인한다**

Run: `rg -n "App Router|루트.*app|Supabase|로그인|환경 변수" docs/technical/DEVELOPMENT_ENVIRONMENT.md`

Expected: 구현 전에 참조할 공식 기술 문서에 확정 구성과 제외 범위가 출력된다.

### Task 1: 기준 런타임과 재현성 파일을 준비한다

**Files:**
- Create: `.nvmrc`
- Create: `.devcontainer/devcontainer.json`
- Reference: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`

**Interfaces:**
- Consumes: 문서의 런타임 기준
- Produces: 로컬과 Codespaces가 같은 Node.js·pnpm을 사용하는 구성

- [ ] **Step 1: 현재 설치 상태를 확인한다**

Run: `node --version`, `npm.cmd --version`, `pnpm --version`

Expected: Node.js `24.19.0`과 pnpm `11.21.0`이 준비되지 않은 상태를 확인한다.

- [ ] **Step 2: Windows 런타임과 pnpm을 설치한다**

Run: `winget install --id OpenJS.NodeJS.LTS --version 24.19.0 --exact`

Run: `npm.cmd install --global pnpm@11.21.0`

Expected: 새 PowerShell에서 Node.js `v24.19.0`, npm `11.17.0`, pnpm `11.21.0`을 출력한다.

- [ ] **Step 3: 재현성 파일을 작성하고 확인한다**

`.nvmrc`에는 `24.19.0`을 기록한다. `.devcontainer/devcontainer.json`에는 Node.js `24.19.0` JavaScript/TypeScript devcontainer 이미지와 pnpm `11.21.0` 설치 feature를 설정한다.

Run: `Get-Content -Raw .nvmrc` 및 `Get-Content -Raw .devcontainer/devcontainer.json`

Expected: 두 파일에 문서 기준 버전이 포함된다.

### Task 2: Next.js App Router Hello World를 생성·검증한다

**Files:**
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `next-env.d.ts`
- Create: `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Task 1의 Node.js와 pnpm
- Produces: `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm build`가 가능한 앱

- [ ] **Step 1: 임시 디렉터리에 표준 Next.js 앱을 생성한다**

Run: `pnpm create next-app@latest .bootstrap --ts --tailwind --eslint --app --use-pnpm --import-alias "@/*" --yes`

Expected: `.bootstrap`에 App Router, TypeScript, Tailwind CSS, ESLint, pnpm 잠금 파일이 생성된다.

- [ ] **Step 2: 앱 파일을 저장소 루트로 옮긴다**

앱·설정·패키지 파일만 옮긴다. `README.md`, `AGENTS.md`, `docs/`, `.git/`, `.gitignore`는 덮어쓰지 않는다. 생성기의 README와 기본 예제 public 자산은 옮기지 않고, 이동 후 `.bootstrap`을 제거한다.

- [ ] **Step 3: 런타임과 검증 스크립트를 고정한다**

`package.json`에 `engines.node: "24.19.0"`, `packageManager: "pnpm@11.21.0"`을 넣는다. 스크립트는 `dev: next dev`, `lint: eslint .`, `typecheck: tsc --noEmit`, `build: next build`, `start: next start`로 설정한다.

- [ ] **Step 4: 기본 페이지를 최소 Hello World로 바꾼다**

`app/page.tsx`는 서버 컴포넌트로 유지한다. 정확히 `Hello World` 제목과 Dungeon Schemer 설명만 표시하며, 상태·버튼·외부 API·추가 라이브러리는 넣지 않는다.

- [ ] **Step 5: 정적·실행 검증을 한다**

Run: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm dev`

Expected: 정적 명령은 종료 코드 `0`으로 성공하고 `http://localhost:3000`에서 Hello World와 설명이 보인다.

### Task 3: 공식 문서를 실제 구성으로 갱신한다

**Files:**
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`
- Modify: `docs/technical/AI_DEVELOPMENT_PRECHECK.md`
- Modify: `docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md`

**Interfaces:**
- Consumes: Tasks 1–2에서 실제 생성·검증한 런타임, 파일, 명령
- Produces: 저장소와 일치하는 기술·AI·팀 운영 문서

- [ ] **Step 1: 실제 구성 파일을 확인한다**

Run: `Get-Content -Raw package.json`, `Get-Content -Raw .nvmrc`, `Get-Content -Raw .devcontainer/devcontainer.json`

Expected: 런타임, pnpm, App Router, 검증 스크립트가 고정값과 일치한다.

- [ ] **Step 2: 공식 문서를 갱신한다**

개발 환경 문서에는 App Router·루트 `app/`·재현성 파일·사용 가능한 검증 명령을 반영한다. AI 사전 점검표와 팀 워크플로에서는 초기화 전제·미구성 명령 표현을 제거하고 Pull Request 전 lint/typecheck/build 실행 기준을 유지한다.

- [ ] **Step 3: 문서와 구현을 검증하고 커밋한다**

Run: `rg -n "24\\.19\\.0|11\\.21\\.0|App Router|pnpm lint|pnpm typecheck|pnpm build" docs\\technical\\DEVELOPMENT_ENVIRONMENT.md docs\\technical\\AI_DEVELOPMENT_PRECHECK.md docs\\technical\\TEAM_DEVELOPMENT_WORKFLOW.md`

Run: `git diff --check` 및 `git status --short`

Expected: 문서에 실제 런타임·명령이 출력되고 공백 오류가 없다.
