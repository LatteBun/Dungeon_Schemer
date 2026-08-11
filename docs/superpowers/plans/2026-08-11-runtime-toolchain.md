# Runtime Toolchain Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개발자가 Node.js, npm, pnpm을 동일한 버전으로 준비하고 프로젝트 초기화 후 같은 개발·검증 명령을 실행할 수 있도록 개발 환경 문서를 갱신한다.

**Architecture:** 기존 기술 책임 설명은 유지한다. 그 뒤에 표준 런타임, 개발자 PC 설치, Codespaces 확인, 초기화 후 버전 고정, 공통 개발·검증 명령을 추가해 실제 작업 순서를 제공한다.

**Tech Stack:** Node.js 24.19.0 LTS, npm 11.17.0, pnpm 11.21.0, GitHub Codespaces, Next.js, Markdown

## Global Constraints

- 이 작업은 `docs/technical/DEVELOPMENT_ENVIRONMENT.md`만 수정한다.
- Node.js는 `24.19.0` LTS, npm은 `11.17.0`, pnpm은 `11.21.0`을 사용한다.
- npm은 pnpm 설치에만 사용하고 프로젝트 의존성 설치와 실행은 pnpm으로 통일한다.
- 잠금 파일이 있는 설치는 `pnpm install --frozen-lockfile`를 사용한다.
- 현재 저장소에는 아직 `package.json`이 없으므로, 스크립트는 프로젝트 초기화 후 사용할 명령으로 설명한다.
- Supabase, 로그인, 환경 변수, Codespaces 설정 파일을 실제로 만들거나 변경하지 않는다.
- 런타임 또는 검증 규칙이 바뀌면 팀 워크플로와 AI 사전 점검표를 같은 변경 단위에서 갱신한다.

---

### Task 1: 개발 환경 문서에 런타임·검증 절차 추가

**Files:**
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`
- Reference: `docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md`
- Reference: `docs/technical/AI_DEVELOPMENT_PRECHECK.md`

**Interfaces:**
- Consumes: 현재 기술 책임 경계와 확정된 Node.js·npm·pnpm 버전
- Produces: 팀원과 AI가 공통으로 참조하는 설치, 버전 고정, 개발, 빌드 검증 명령

- [ ] **Step 1: 문서의 현재 미확정 항목과 운영 문서의 검증 기준을 확인한다**

Run:

```powershell
Get-Content -Raw 'docs/technical/DEVELOPMENT_ENVIRONMENT.md'
Get-Content -Raw 'docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md'
Get-Content -Raw 'docs/technical/AI_DEVELOPMENT_PRECHECK.md'
```

Expected: 기존 문서의 버전·패키지 매니저 미확정 표현과 `pnpm lint`, `pnpm typecheck`, `pnpm build` 기준을 확인한다.

- [ ] **Step 2: 표준 런타임과 설치·확인 명령을 작성한다**

`개발 환경: GitHub Codespaces` 다음에 `표준 런타임과 패키지 매니저`, `개발자 PC 설치`, `Codespaces 확인` 섹션을 추가한다.

`표준 런타임과 패키지 매니저`에는 Node.js `24.19.0` LTS, npm `11.17.0`, pnpm `11.21.0`과 npm·pnpm의 역할을 표로 적는다.

`개발자 PC 설치`에는 아래 PowerShell 명령과 기대 출력 형식을 포함한다.

```powershell
winget install --id OpenJS.NodeJS.LTS --version 24.19.0 --exact
node --version
npm --version
npm install --global pnpm@11.21.0
pnpm --version
```

`Codespaces 확인`에는 아래 명령을 포함한다.

```bash
node --version
npm --version
pnpm --version || npm install --global pnpm@11.21.0
pnpm --version
```

각 버전 확인의 기대값은 각각 `v24.19.0`, `11.17.0`, `11.21.0`이다.

- [ ] **Step 3: 프로젝트 초기화 후 버전 고정과 개발·검증 명령을 작성한다**

`프로젝트 초기화 후 버전 고정`과 `공통 개발과 검증 명령` 섹션을 추가한다.

버전 고정 섹션에는 다음 내용을 포함한다.

```text
.nvmrc: 24.19.0
package.json engines.node: 24.19.0
package.json packageManager: pnpm@11.21.0
Codespaces Node.js: 24.19.0
```

개발·검증 섹션에는 명령과 목적을 표로 적는다.

```text
pnpm install --frozen-lockfile  잠금 파일 기준 설치
pnpm dev                         개발 서버 실행
pnpm lint                        린트 검사
pnpm typecheck                   TypeScript 검사
pnpm test                        Vitest 도입 후 단위 테스트
pnpm build                       Vercel과 같은 프로덕션 빌드
pnpm start                       build 성공 후 로컬 프로덕션 실행
```

`pnpm lint`, `pnpm typecheck`, `pnpm build`는 Pull Request 병합 전 기준임을 명시한다. `pnpm test`는 Vitest가 추가된 뒤 기준에 포함한다고 명시한다. 존재하지 않는 스크립트는 초기화 작업에서 추가하며, 그 전에는 실행한 것처럼 기록하지 않는다고 명시한다.

- [ ] **Step 4: 기존 확정·미확정 항목을 일관되게 갱신한다**

`현재 확정된 것`에 Node.js, npm, pnpm 및 공통 검증 기준을 추가한다. `아직 확정하지 않는 것`에서는 정확한 버전과 패키지 매니저 항목을 제거하고, Next.js 버전·세부 라우터·Supabase·테스트 세부 구성 등 남아 있는 항목은 유지한다.

- [ ] **Step 5: 버전·명령·문서 형식을 검증한다**

Run:

```powershell
rg -n '24\.19\.0|11\.17\.0|11\.21\.0|winget install|pnpm install --frozen-lockfile|pnpm dev|pnpm lint|pnpm typecheck|pnpm test|pnpm build|pnpm start|\.nvmrc|packageManager' 'docs/technical/DEVELOPMENT_ENVIRONMENT.md'
git diff --check -- 'docs/technical/DEVELOPMENT_ENVIRONMENT.md'
```

Expected: 모든 버전·설치·개발·검증 명령이 출력되고 Markdown 공백 오류가 없다.

- [ ] **Step 6: 변경을 검토하고 커밋한다**

Run:

```powershell
git diff -- 'docs/technical/DEVELOPMENT_ENVIRONMENT.md'
git add -- 'docs/technical/DEVELOPMENT_ENVIRONMENT.md'
git commit -m 'docs: add runtime setup and validation commands'
```

Expected: 개발 환경 문서 변경이 독립 커밋으로 기록된다.
