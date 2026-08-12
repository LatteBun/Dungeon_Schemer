# 팀 개발 워크플로

## 목적

이 문서는 세 명이 Dungeon Schemer의 로그인 없는 핵심 게임 루프 MVP를 함께 개발할 때 따르는 협업·검증·데모 배포 기준이다. 사람을 위한 운영 안내이며, AI 작업 전 점검은 [AI 개발 전 사전 점검표](AI_DEVELOPMENT_PRECHECK.md)를 따른다.

## MVP 범위

현재 목표는 로그인 없이 브라우저에서 핵심 게임 루프를 실행하고 검증하는 것이다.

- Supabase 연동, 사용자 로그인, 비밀 환경 변수, 운영 도메인은 현재 범위에 넣지 않는다.
- 개발 중 기능 확인은 각자의 Codespaces에서 수행한다.
- 통합된 데모 확인은 Vercel Hobby에 배포된 `main`으로 수행한다.

## 도구별 역할

| 도구 | 역할 |
| --- | --- |
| GitHub 비공개 저장소 | 세 명이 코드, 문서, 이슈와 Pull Request를 공유하는 기준 저장소 |
| GitHub Codespaces | 각자가 같은 개발 환경에서 앱을 실행하고 기능 브랜치를 검증하는 작업 공간 |
| Vercel Hobby | `main` 통합본의 배포 빌드와 공유 가능한 데모 URL을 확인하는 환경 |

Vercel Hobby의 비공개 저장소 협업 제약 때문에 기능 브랜치별 Vercel Preview를 팀의 공통 검증 절차로 사용하지 않는다.

## 브랜치와 Pull Request 흐름

`main`은 항상 실행 가능한 통합 브랜치다. 누구도 `main`에 직접 push하지 않는다.

1. 작업을 시작할 때 `feature/<작업명>` 브랜치를 만든다.
2. 해당 브랜치에서 기능과 관련 문서를 함께 수정한다.
3. Codespaces에서 실행과 필요한 검증을 마친다.
4. `main`을 대상으로 Pull Request를 만든다.
5. 작업자가 아닌 팀원 한 명이 변경 범위, 실행 결과, 문서 반영 여부를 확인한다.
6. 확인이 끝난 Pull Request만 `main`에 병합한다.

서로 다른 기능은 가능한 한 서로 다른 파일이나 명확히 분리된 영역에서 작업한다. 다른 작업자의 변경을 발견하면 덮어쓰지 말고, 먼저 공유하거나 충돌을 해결한 뒤 진행한다.

## Codespaces에서의 개발·검증

각 팀원은 자신의 Codespaces에서 작업 브랜치를 열어 개발한다.

- 기능을 수정한 뒤 앱을 실행해 변경한 흐름을 직접 확인한다.
- Pull Request 전 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 실행한다.
- 검증 명령 또는 실행이 실패하면 원인을 수정한 뒤 Pull Request를 갱신한다.

## Vercel 데모 배포

Vercel Hobby 프로젝트는 한 명의 소유자가 관리하며 GitHub 저장소의 `main`을 데모 배포 대상으로 연결한다.

- 기능 브랜치의 개발·검증은 Codespaces가 담당한다.
- `main` 병합 뒤에는 Vercel의 빌드 결과와 데모 URL을 확인한다.
- 변경한 핵심 흐름을 데모 URL에서 한 번 재현한다.
- 배포가 실패하면 마지막 정상 배포와 빌드 로그를 비교하고, 필요한 경우 문제 Pull Request를 되돌린다.

## 병합 전과 병합 후 확인

### 병합 전

- 작업이 `feature/<작업명>` 브랜치에 있는가?
- 변경한 기능을 Codespaces에서 실행해 보았는가?
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`가 통과하는가?
- 다른 팀원 한 명이 Pull Request를 확인했는가?

### 병합 후

- Vercel의 `main` 배포가 성공했는가?
- 데모 URL에서 변경한 핵심 흐름이 동작하는가?
- 협업 규칙 또는 MVP 범위가 바뀌었다면 관련 문서를 갱신했는가?

## 운영 규칙 갱신

다음이 바뀌면 이 문서와 [AI 개발 전 사전 점검표](AI_DEVELOPMENT_PRECHECK.md)를 같은 변경 단위에서 함께 갱신한다.

- 브랜치, Pull Request, 리뷰 또는 병합 규칙
- Codespaces 설정과 패키지 매니저
- Vercel 배포 방식, 소유자, 환경 변수 또는 도메인
- Supabase·로그인 도입처럼 MVP 범위가 확장되는 경우
- 공통 검증 명령과 테스트 도구

## 관련 문서

- [문서 안내](../README.md)
- [게임 원칙](../GAME_PRINCIPLES.md)
- [개발 환경](DEVELOPMENT_ENVIRONMENT.md)
- [AI 개발 전 사전 점검표](AI_DEVELOPMENT_PRECHECK.md)
