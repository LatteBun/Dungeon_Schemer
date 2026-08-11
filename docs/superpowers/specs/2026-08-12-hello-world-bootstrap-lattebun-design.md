# Hello World 초기화 설계

**작성자:** LatteBun  
**작성 도구:** Codex

## 목적

Dungeon Schemer를 실행 가능한 Next.js 웹 애플리케이션으로 초기화하고, 브라우저에서 최소 Hello World 화면을 확인할 수 있게 한다. 팀의 공통 런타임과 검증 명령도 실제 저장소 구성에 반영한다.

## 현재 상태와 제약

- 저장소에는 애플리케이션과 `package.json`이 아직 없다.
- 공식 기술 문서는 Node.js `24.19.0`, npm `11.17.0`, pnpm `11.21.0`을 기준으로 정한다.
- 현재 PC에는 Node.js `24.18.0`이 설치되어 있고 pnpm은 없다.
- 현재 단계에서는 Supabase, 로그인, 환경 변수, 게임 시스템, 배포 연결을 추가하지 않는다.

## 선택한 접근

Next.js App Router, TypeScript, Tailwind CSS를 저장소 루트에 생성한다. 기본 예제 UI와 불필요한 에셋은 제거하고, 루트 페이지에는 Dungeon Schemer의 초기 화면임을 알리는 간결한 Hello World만 표시한다.

`src/` 디렉터리는 만들지 않는다. 아직 규모가 작은 프로젝트이므로 `app/`을 루트에 두고, 게임 기능이 생길 때 필요한 도메인별 폴더 구조를 별도 설계한다.

## 구성 요소

- 런타임: Node.js `24.19.0`, npm `11.17.0`, pnpm `11.21.0`
- 패키지 구성: Next.js, React, TypeScript, Tailwind CSS, ESLint
- 앱 셸: `app/layout.tsx`, `app/page.tsx`, 전역 스타일
- 재현성: `.nvmrc`, `package.json`의 `engines.node`와 `packageManager`, `pnpm-lock.yaml`
- 개발 환경: Node 버전과 pnpm을 고정하는 Codespaces 설정

## 동작과 검증

1. `pnpm install --frozen-lockfile`로 잠금 파일 기준의 의존성을 설치한다.
2. `pnpm dev`로 개발 서버를 실행한다.
3. 브라우저의 `/`에서 `Hello World`와 Dungeon Schemer 식별 문구를 확인한다.
4. `pnpm lint`, `pnpm typecheck`, `pnpm build`가 모두 성공해야 한다.

`typecheck` 스크립트는 `tsc --noEmit`을 사용한다. 테스트 도구는 게임 규칙이 UI에서 분리될 때까지 추가하지 않으며, 현재는 `pnpm test`를 성공 기준에 포함하지 않는다.

## 문서 갱신

기술 문서에는 실제로 확정된 Next.js App Router 구성, 초기화 파일, Codespaces 고정 방식과 검증 명령을 반영한다. 팀 워크플로와 AI 사전 점검표에는 아직 준비되지 않은 명령이라는 표현을 제거하고, 초기화된 프로젝트의 검증 기준을 유지한다.

## 제외 범위

- 게임 플레이 로직, Zustand 스토어, Framer Motion 애니메이션
- Supabase, 인증, 환경 변수, 데이터베이스
- Vercel 프로젝트 연결·배포 및 사용자 도메인
- Vitest·Playwright 도입

## 승인 기준

- 문서 기준의 Node.js·npm·pnpm 버전을 사용할 수 있다.
- 새 클론 또는 Codespaces에서 잠금 파일 기반 설치가 가능하다.
- 개발 서버의 루트 화면에 Hello World가 보인다.
- lint, typecheck, build가 모두 통과한다.
