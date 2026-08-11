# 팀 개발 환경 운영 문서 설계

## 목적

세 명이 비공개 GitHub 저장소에서 Dungeon Schemer MVP를 함께 개발할 때 따라야 할 협업·검증·데모 배포 기준을 문서화한다. 사람용 안내와 AI용 사전 점검표를 분리해, 필요한 정보만 빠르게 찾을 수 있게 한다.

## 범위

이번 문서는 로그인 없이 핵심 게임 루프를 검증하는 MVP에만 적용한다. 개발은 각자의 GitHub Codespaces에서 수행하고, 통합 데모는 한 명이 소유한 Vercel Hobby 프로젝트의 `main` 배포로 확인한다.

## 문서 구성

### `docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md`

사람이 읽는 팀 운영 안내다.

- GitHub 비공개 저장소, Codespaces, Vercel Hobby의 역할을 구분한다.
- `main`을 실행 가능한 통합 브랜치로 정의한다.
- `feature/<작업명>` 브랜치, Pull Request, 동료 확인, `main` 병합 순서를 정한다.
- Codespaces에서의 로컬 실행 확인과 Vercel `main` 데모 확인 시점을 설명한다.
- 현재 MVP에서는 Supabase, 로그인, 환경 변수를 도입하지 않는다는 범위를 명시한다.
- 협업 방식이나 기술 범위가 바뀔 때 두 운영 문서를 함께 갱신하도록 정한다.

### `docs/technical/AI_DEVELOPMENT_PRECHECK.md`

AI가 구현 전에 읽는 간결한 작업 계약이다.

- 공식 게임 문서의 우선순위와 작업 관련 문서 확인을 요구한다.
- 브랜치와 기존 작업 트리를 확인해 다른 작업자의 변경을 보존하게 한다.
- 변경 범위, 영향 파일, MVP 범위를 먼저 확인하게 한다.
- 기능 브랜치에서는 Codespaces 검증을 우선하고, Vercel Hobby는 `main` 통합 데모용임을 명시한다.
- 초기 공통 검증 명령인 `pnpm lint`, `pnpm typecheck`, `pnpm build`와 핵심 흐름 수동 확인을 정의한다.
- 게임 규칙 분리 후 Vitest, 화면·루프 안정화 후 Playwright를 추가하는 시점을 명시한다.
- 운영 규칙이나 기술 범위 변경 시 두 문서를 함께 갱신하게 한다.

## 협업 흐름

```text
feature/<작업명>에서 개발
  → Codespaces에서 실행·검증
  → Pull Request 생성
  → 동료 한 명이 확인
  → main 병합
  → Vercel 데모 배포 확인
```

`main`에는 직접 push하지 않으며, 항상 실행 가능한 상태를 유지한다. Vercel Hobby의 비공개 저장소 협업 제약 때문에 브랜치별 Vercel Preview를 팀 공통 검증 수단으로 사용하지 않는다.

## 검증과 오류 처리

- 초기화 후에는 린트, 타입 검사, 프로덕션 빌드를 PR 병합 전 기준으로 사용한다.
- 브랜치에서 오류가 나면 먼저 Codespaces에서 재현하고 수정한 뒤 PR을 갱신한다.
- `main` 병합 후 Vercel 데모가 실패하면, 실패한 배포와 마지막 정상 배포를 확인하고 필요한 경우 되돌리는 판단을 한다.
- 검증 도구가 아직 초기화되지 않은 단계에서는 그 사실을 PR에 명시하고, 도구 도입 작업에서 기준을 활성화한다.

## 비목표

- Vercel Pro 팀 좌석, 팀별 Preview 배포, 유료 배포 운영 정책을 도입하지 않는다.
- Supabase 스키마, 인증, 비밀 환경 변수, 운영 도메인을 이번 범위에서 확정하지 않는다.
- 특정 게임 기능의 상세 설계를 이 문서들에 중복하지 않는다.

## 갱신 규칙

협업 흐름, Codespaces 설정, 패키지 매니저, Vercel 운영 방식, 환경 변수, Supabase·인증 범위, 공통 검증 명령이 바뀌면 두 운영 문서를 같은 변경 단위에서 함께 갱신한다.
