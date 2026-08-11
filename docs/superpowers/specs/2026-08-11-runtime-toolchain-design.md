# 런타임과 개발 검증 환경 설계

## 목적

세 명의 개발자와 GitHub Codespaces가 같은 Node.js·npm·pnpm 버전으로 Dungeon Schemer MVP를 초기화하고, 같은 명령으로 설치·실행·검증할 수 있게 개발 환경 문서를 구체화한다.

## 확정 버전

- Node.js: `24.19.0` LTS (Krypton)
- npm: `11.17.0` (Node.js `24.19.0`에 포함)
- pnpm: `11.21.0`

Next.js가 요구하는 최소 Node.js `20.9`보다 높은 LTS 버전을 사용한다. npm은 Node.js 설치 확인과 pnpm 설치에만 사용하고, 프로젝트 의존성 설치와 실행은 pnpm으로 통일한다.

## 문서 변경

`docs/technical/DEVELOPMENT_ENVIRONMENT.md`에 다음 섹션을 추가하고 기존의 버전·패키지 매니저 미확정 표현을 갱신한다.

1. `표준 런타임과 패키지 매니저`: 세 버전, 역할, pnpm 사용 원칙
2. `개발자 PC 설치`: Windows PowerShell에서 Node.js LTS를 설치·확인하고 pnpm을 정확한 버전으로 설치하는 명령
3. `Codespaces 확인`: Codespaces에서 동일 버전을 확인하고 pnpm을 준비하는 명령
4. `프로젝트 초기화 뒤 버전 고정`: `.nvmrc`, `package.json`의 `engines`와 `packageManager`, Codespaces 설정에 적용할 값
5. `공통 개발과 검증 명령`: 의존성 설치, 개발 서버, 린트, 타입 검사, 단위 테스트, 프로덕션 빌드, 로컬 프로덕션 실행 명령

## 명령 정책

- 잠금 파일이 있는 경우에는 `pnpm install --frozen-lockfile`로 재현 가능한 설치를 한다.
- 초기화 후 개발 서버는 `pnpm dev`로 실행한다.
- Pull Request 병합 전에는 `pnpm lint`, `pnpm typecheck`, `pnpm build`를 실행한다.
- Vitest를 추가한 뒤에는 `pnpm test`도 병합 전 검증에 포함한다.
- `pnpm start`는 `pnpm build`가 성공한 뒤 로컬 프로덕션 동작을 확인할 때 사용한다.
- 아직 존재하지 않는 스크립트는 프로젝트 초기화 작업에서 추가하며, 그 전에는 실행한 것처럼 기록하지 않는다.

## 범위와 갱신

이 변경은 문서만 수정한다. Node.js, pnpm, Next.js, 테스트 도구의 실제 설치·초기화 파일은 이후 프로젝트 초기화 작업에서 만든다. 런타임·패키지 매니저·검증 명령이 바뀌면 `TEAM_DEVELOPMENT_WORKFLOW.md`와 `AI_DEVELOPMENT_PRECHECK.md`도 같은 변경 단위에서 갱신한다.
