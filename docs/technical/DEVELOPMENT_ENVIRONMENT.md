# 개발 환경

## 목적

이 문서는 현재 기획에서 선택한 개발 환경, 공통 런타임, 초기 애플리케이션 구성과 각 기술의 책임을 공식적으로 정리한다. 런타임과 초기 패키지 구성은 잠금 파일로 재현하며, 인증 방식은 별도 설계에서 결정한다.

## 기술 구성

```text
GitHub Codespaces
↓
Next.js + React + TypeScript
↓
Tailwind CSS + Framer Motion + Zustand
↓
Supabase
↓
Vercel
```

## 개발 환경: GitHub Codespaces

GitHub Codespaces를 기본 개발 환경으로 사용한다.

담당 역할:

- 저장소 기반의 일관된 개발 환경 제공
- 프로젝트 의존성과 실행 도구 공유
- 로컬 환경 차이로 인한 설정 문제 감소

`.devcontainer/devcontainer.json`은 Node.js와 pnpm 버전을 이 문서의 표준 런타임으로 고정한다.

## 표준 런타임과 패키지 매니저

| 도구 | 고정 버전 | 역할 |
| --- | --- | --- |
| Node.js | `24.19.0` LTS | Next.js 애플리케이션과 개발 도구를 실행하는 런타임 |
| npm | `11.17.0` | Node.js 설치에 포함되며 pnpm 설치에만 사용 |
| pnpm | `11.21.0` | 프로젝트 의존성 설치와 모든 스크립트 실행에 사용하는 표준 패키지 매니저 |

Next.js는 Node.js `20.9` 이상을 요구한다. Node.js `24.19.0` LTS를 팀의 기준으로 고정해 개발자 PC, Codespaces, 이후 Vercel 배포 환경의 차이를 줄인다. 프로젝트 의존성은 npm이 아니라 pnpm으로 설치하고 실행한다.

## 개발자 PC 설치

Windows PowerShell에서 아래 명령으로 Node.js LTS와 pnpm을 설치한다. `winget`이 없는 경우에는 Node.js 공식 설치 프로그램에서 `24.19.0` LTS를 설치한 뒤 pnpm 설치 명령부터 실행한다.

```powershell
winget install --id OpenJS.NodeJS.LTS --version 24.19.0 --exact
node --version
npm --version
npm install --global pnpm@11.21.0
pnpm --version
```

명령 결과는 다음 버전이어야 한다.

```text
node --version  → v24.19.0
npm --version   → 11.17.0
pnpm --version  → 11.21.0
```

설치 직후 `node`나 `pnpm`을 찾지 못하면 PowerShell과 VS Code를 완전히 닫은 뒤 새 창에서 버전 확인 명령을 다시 실행한다.

## Codespaces 확인

새 Codespace를 열면 아래 명령으로 런타임을 확인한다. pnpm이 없을 때만 지정한 버전을 설치한다.

```bash
node --version
npm --version
pnpm --version || npm install --global pnpm@11.21.0
pnpm --version
```

Codespaces 설정 파일을 추가할 때에도 Node.js `24.19.0`과 pnpm `11.21.0`을 사용하도록 고정한다.

## Bash 공통 명령

Codespaces와 Linux Bash에서는 아래 명령을 공통으로 사용한다. pnpm이 없다면 먼저 지정한 버전을 설치한 뒤 버전을 다시 확인한다.

```bash
node --version
npm --version
pnpm --version || npm install --global pnpm@11.21.0
pnpm --version

pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

- `pnpm dev`: 개발 서버를 실행한다.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`: Pull Request 전 실행하는 검증 명령이다.
- `pnpm start`: `pnpm build`가 성공한 뒤 프로덕션 모드로 앱을 실행한다.

Windows PowerShell에서 실행 정책이 `pnpm.ps1`을 차단하는 경우에만 `pnpm.cmd`를 사용한다. 예를 들어 `pnpm.cmd dev`로 개발 서버를 실행할 수 있다. Codespaces와 Linux Bash에서는 표준 `pnpm` 명령을 사용한다.

## 저장소의 버전 고정

저장소는 아래 파일과 값으로 개발 환경을 재현 가능하게 만든다.

```text
.nvmrc                       24.19.0
package.json engines.node     24.19.0
package.json packageManager   pnpm@11.21.0
Codespaces Node.js            24.19.0
```

`.nvmrc`, `package.json`, `.devcontainer/devcontainer.json`, `pnpm-lock.yaml`은 초기화된 저장소에 포함되며 같은 런타임과 의존성 구성을 재현한다.

## 공통 개발과 검증 명령

프로젝트 초기화 후 팀원은 다음 pnpm 명령을 공통으로 사용한다.

| 명령 | 목적 | 실행 시점 |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 잠금 파일 기준으로 정확히 같은 의존성 설치 | 새 Codespace, 의존성 변경 뒤 |
| `pnpm dev` | 개발 서버 실행 | 기능 개발과 수동 확인 |
| `pnpm lint` | ESLint 검사 | Pull Request 병합 전 |
| `pnpm typecheck` | TypeScript 타입 검사 | Pull Request 병합 전 |
| `pnpm test` | Vitest 단위 테스트 | Pull Request 병합 전 |
| `pnpm build` | Vercel과 같은 Next.js 프로덕션 빌드 | Pull Request 병합 전 |
| `pnpm start` | `pnpm build` 성공 뒤 로컬 프로덕션 서버 실행 | 배포 전 동작 확인이 필요할 때 |

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 병합 전 검증 기준으로 사용한다. 감시 모드가 필요하면 개발 중에만 `pnpm test:watch`를 사용하고, 검증에는 한 번 실행하고 종료하는 `pnpm test`를 사용한다.

## 테스트 작성 규약

단위 테스트는 Vitest로 작성한다. 세 사람이 같은 규약을 쓰도록 다음을 지킨다.

- 테스트 파일 이름은 `<대상>.test.ts`로 하고 대상 소스와 같은 디렉터리에 둔다. 별도의 `tests/` 디렉터리를 만들지 않는다.
- 다른 모듈은 상대 경로가 아니라 `@/`로 가져온다. 예를 들어 `@/lib/domain`이다.
- `describe`, `it`, `expect`를 `vitest`에서 명시적으로 가져온다. 전역으로 쓰지 않는다.
- `describe`와 `it`의 설명은 한국어로 쓴다. 커밋 메시지와 문서가 한국어이므로 실패 출력도 같은 언어로 읽히는 편이 낫다.

Vitest 설정은 `vitest.config.mts`에 둔다. 확장자가 `.ts`가 아니라 `.mts`인 이유는 Vite가 `.ts` 설정 파일을 CommonJS로 읽어 ESM 구문 경고를 내기 때문이다. `package.json`에 `type: module`을 넣는 방법은 Next.js 전체 모듈 해석에 영향을 주므로 쓰지 않는다.

Vitest는 `tsconfig.json`의 `paths`를 읽지 않는다. `@/` 별칭은 `vitest.config.mts`의 `resolve.alias`가 따로 맞춘다. 새 별칭을 추가할 때는 두 파일을 함께 고쳐야 한다.

현재 테스트 환경은 Node이며 순수 로직 검증을 대상으로 한다. React 컴포넌트를 렌더링하는 테스트가 필요해지면 그 작업에서 `jsdom`과 테스트 라이브러리를 함께 도입하고 이 절을 갱신한다.

가장 가까운 예시는 `lib/domain/constants.test.ts`다.

## 애플리케이션: Next.js, React, TypeScript

### Next.js

웹 애플리케이션의 기본 프레임워크다. 화면 라우팅, 렌더링, 서버 기능과 Vercel 배포의 중심 역할을 맡는다.

### React

게임 화면과 상호작용 UI를 컴포넌트로 구성한다. 파티, 이벤트, 정보 카드, 던전 지도, 결과 화면을 명확한 책임 단위로 분리한다.

### TypeScript

파티원, 신뢰도, 정보 카드, 이벤트, 던전 상태, 진행 결과 같은 게임 데이터를 명시적인 타입으로 표현한다. 시스템 사이의 데이터 계약을 코드에서 확인할 수 있도록 한다.

초기 애플리케이션은 Next.js App Router를 사용하며, 라우트·레이아웃·전역 스타일은 저장소 루트의 `app/`에 둔다. 이번 초기화에서는 `src/` 디렉터리를 만들지 않는다. Next.js의 정확한 버전은 초기화 시점의 안정 버전을 사용하되, 잠금 파일로 재현한다.

## UI와 모션: Tailwind CSS, Framer Motion

### Tailwind CSS

UI 레이아웃과 스타일링에 사용한다. 화면의 정보 우선순위와 반복되는 상태 표현을 일관되게 관리한다.

### Framer Motion

전투, 이동, 카드 선택, 상태 변화 애니메이션에 사용한다. 모션은 선택 결과를 이해시키는 데 우선 사용하며 핵심 정보를 늦추거나 가리지 않는다.

최종 디자인 시스템, 색상 토큰, 애니메이션 규칙은 별도 UI 설계에서 결정한다.

## 클라이언트 상태: Zustand

Zustand는 화면 간 또는 여러 컴포넌트가 공유하는 클라이언트 게임 상태를 관리한다.

관리 대상 후보:

- 현재 파티와 파티원 상태
- 현재 던전 위치와 이벤트
- 선택 중인 정보 카드와 행동
- 일시적인 전투·애니메이션 상태
- 정산 전의 탐험 진행 상태

서버에 영구 저장해야 하는 데이터와 화면에만 필요한 임시 상태를 구분한다. 정확한 스토어 분할은 게임 데이터 모델을 설계할 때 확정한다.

## 백엔드와 데이터: Supabase

Supabase는 영구 데이터와 백엔드 기능을 담당한다.

사용 대상 후보:

- 사용자 계정과 세이브 데이터
- 장기 성장과 엔딩 진행 상태
- 파티, 보스, 이벤트, 정보 카드 콘텐츠
- 플레이 기록과 정산 결과

인증 사용 여부, 데이터베이스 스키마, 접근 정책과 실시간 기능 사용 범위는 아직 확정하지 않는다.

## 배포: Vercel

Vercel을 Next.js 애플리케이션의 배포 환경으로 사용한다.

담당 역할:

- Preview 배포를 통한 변경 검토
- 운영 환경 배포
- 환경별 설정과 환경 변수 관리
- Next.js 빌드 및 실행

프로젝트 연결, 도메인, 배포 브랜치 정책은 애플리케이션 초기화 이후 확정한다.

## 시스템 책임 경계

```text
React 컴포넌트
  화면과 사용자 입력

Zustand
  현재 세션의 클라이언트 상태

Next.js
  라우팅, 렌더링, 서버와 클라이언트 연결

Supabase
  영구 데이터와 계정 관련 백엔드

Vercel
  빌드, Preview, 운영 배포
```

각 기술이 다른 계층의 책임을 불필요하게 대신하지 않도록 한다. 게임 규칙은 특정 UI 컴포넌트에만 숨기지 않고 테스트 가능한 게임 로직으로 분리하는 방향을 따른다.

## 현재 확정된 것

- GitHub Codespaces를 개발 환경으로 사용한다.
- Node.js `24.19.0` LTS, npm `11.17.0`, pnpm `11.21.0`을 공통 런타임으로 사용한다.
- 프로젝트 의존성 설치와 스크립트 실행은 pnpm으로 통일한다.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 병합 전 검증 기준으로 사용한다.
- Vitest로 단위 테스트를 작성한다.
- Next.js, React, TypeScript로 애플리케이션을 구성한다.
- Next.js App Router와 루트 `app/` 디렉터리로 초기 화면을 구성한다.
- Tailwind CSS로 UI를 작성한다.
- Framer Motion으로 애니메이션을 구현한다.
- Zustand로 클라이언트 상태를 관리한다.
- Supabase를 백엔드와 데이터 계층으로 사용한다.
- Vercel에 배포한다.

## 아직 확정하지 않는 것

- Next.js, React, Tailwind CSS, Framer Motion, Zustand, Supabase의 정확한 버전
- Supabase 인증과 데이터베이스 스키마
- 배포 승인 절차
- 환경 변수 이름과 비밀 정보 관리 규칙

이 항목은 구현 전에 기술 설계와 초기화 계획에서 결정한다.

## Hello World 초기화 범위

초기화 작업은 브라우저에서 `Hello World`와 Dungeon Schemer 식별 문구를 표시하고, `pnpm lint`, `pnpm typecheck`, `pnpm build`를 실행할 수 있는 최소 앱을 만드는 데 한정한다.

이 단계에서는 Supabase, 로그인, 환경 변수, Vercel 프로젝트 연결, Zustand, Framer Motion, 테스트 도구, 게임 규칙과 화면 상호작용을 추가하지 않는다.

## 관련 문서

- [게임 원칙](../GAME_PRINCIPLES.md)
- [온보딩과 인터페이스](../experience/ONBOARDING_AND_INTERFACE.md)
- [기존 개발 환경 메모](../initialization/Development_Environment.md)
