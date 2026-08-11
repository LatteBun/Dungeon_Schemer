# Bash 명령 안내 Implementation Plan

**작성자:** LatteBun  
**작성 도구:** Codex

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Codespaces와 Linux Bash에서 런타임 확인, 의존성 설치, 개발·검증 명령을 같은 기준으로 실행할 수 있게 개발 환경 문서를 보완한다.

**Architecture:** Windows 전용 PowerShell 설치 절차는 그대로 유지한다. `DEVELOPMENT_ENVIRONMENT.md`에 Bash 공통 명령 섹션을 추가해 설치 확인과 일상 개발·검증 절차를 한곳에서 제공한다.

**Tech Stack:** Bash, Node.js 24.19.0, npm 11.17.0, pnpm 11.21.0, Next.js

## Global Constraints

- Node.js `24.19.0`, npm `11.17.0`, pnpm `11.21.0` 기준을 변경하지 않는다.
- 프로젝트 의존성과 스크립트 실행은 pnpm을 계속 사용한다.
- Codespaces와 Linux Bash에 공통인 명령만 추가한다.
- PowerShell 실행 정책으로 `pnpm.ps1`이 차단될 때만 `pnpm.cmd`를 대체 명령으로 안내한다.
- 앱 코드, devcontainer 설정, 패키지 구성, 테스트·배포 정책은 바꾸지 않는다.

---

### Task 1: 개발 환경 문서에 Bash 공통 명령을 추가한다

**Files:**
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`
- Reference: `package.json`
- Reference: `.nvmrc`

**Interfaces:**
- Consumes: 고정 런타임과 실제 `package.json` 스크립트
- Produces: Codespaces/Linux Bash에서 복사해 실행할 수 있는 공통 명령 안내

- [ ] **Step 1: 현재 런타임·스크립트 기준을 확인한다**

Run:

```bash
cat .nvmrc
node --version
npm --version
pnpm --version
node -e "const p=require('./package.json'); console.log(p.scripts)"
```

Expected: `.nvmrc`는 `24.19.0`이고 Node.js·npm·pnpm 버전과 `dev`, `lint`, `typecheck`, `build`, `start` 스크립트를 확인한다.

- [ ] **Step 2: Bash 공통 명령 섹션을 작성한다**

`docs/technical/DEVELOPMENT_ENVIRONMENT.md`의 Codespaces 확인 다음에 `Bash 공통 명령` 섹션을 추가한다. 다음 명령과 목적을 포함한다.

```bash
node --version
npm --version
pnpm --version || npm install --global pnpm@11.21.0
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

`pnpm dev`는 개발 서버, `pnpm lint`·`pnpm typecheck`·`pnpm build`는 병합 전 검증, `pnpm start`는 빌드 후 프로덕션 실행이라는 설명을 넣는다.

- [ ] **Step 3: PowerShell 대체 명령 주석을 추가한다**

PowerShell 실행 정책이 `pnpm.ps1`을 차단하는 경우에만 `pnpm.cmd <명령>`을 사용한다는 주석과 예시 `pnpm.cmd dev`를 넣는다. Bash와 Codespaces에서는 표준 `pnpm` 명령을 사용한다고 명시한다.

- [ ] **Step 4: 문서 내용을 검증한다**

Run:

```powershell
rg -n "Bash 공통 명령|pnpm install --frozen-lockfile|pnpm dev|pnpm lint|pnpm typecheck|pnpm build|pnpm start|pnpm\.cmd" docs\technical\DEVELOPMENT_ENVIRONMENT.md
git diff --check
```

Expected: Bash 명령, PowerShell 대체 명령, 공백 오류 없는 diff를 확인한다.

- [ ] **Step 5: Commit**

```powershell
git add docs/technical/DEVELOPMENT_ENVIRONMENT.md
git commit -m "docs: add Bash development commands"
```
