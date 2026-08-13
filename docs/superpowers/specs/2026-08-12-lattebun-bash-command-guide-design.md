# Bash 명령 안내 설계

**작성자:** LatteBun  
**작성 도구:** Codex

## 목적

Codespaces와 Linux Bash 사용자가 Dungeon Schemer의 설치·개발·검증 명령을 같은 기준으로 실행할 수 있게 개발 환경 문서를 보완한다.

## 범위

- `docs/technical/DEVELOPMENT_ENVIRONMENT.md`에 Bash 공통 명령을 추가한다.
- Node.js, npm, pnpm의 고정 버전과 pnpm 중심 워크플로는 유지한다.
- Codespaces와 Linux Bash에서 사용할 설치 확인, 의존성 설치, 개발 서버, lint, typecheck, build, production 실행 명령을 기록한다.

## 구성

PowerShell의 Windows 설치 절차는 유지한다. 별도 `Bash 공통 명령` 섹션에서 아래 명령을 제공한다.

```bash
node --version
npm --version
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

pnpm이 없는 경우에는 `npm install --global pnpm@11.21.0`으로 설치하도록 적는다. PowerShell 실행 정책으로 `pnpm.ps1`이 차단되는 경우에만 Windows PowerShell에서 `pnpm.cmd`를 대체 명령으로 사용한다는 주석을 덧붙인다.

## 제외 범위

- 런타임 버전, 패키지 구성, 검증 기준 변경
- Codespaces 이미지·devcontainer 설정 변경
- 게임 기능, 배포, 테스트 도구 추가

## 검증

- 문서에 Bash 명령과 pnpm 설치 대체 절차가 모두 있는지 검색한다.
- Markdown 코드 블록과 기존 PowerShell 안내가 유지되는지 확인한다.
