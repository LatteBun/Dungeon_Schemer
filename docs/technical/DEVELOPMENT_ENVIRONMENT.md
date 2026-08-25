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
pnpm test:e2e:install
pnpm test:e2e
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
| `pnpm test:e2e:install` | Playwright Chromium 최초 설치 | 새 checkout, Playwright 버전 변경 뒤 |
| `pnpm test:e2e` | Chromium 브라우저 안정성 회귀 | UI·라우트·캠페인 흐름 PR 병합 전 |
| `pnpm build` | Vercel과 같은 Next.js 프로덕션 빌드 | Pull Request 병합 전 |
| `pnpm start` | `pnpm build` 성공 뒤 로컬 프로덕션 서버 실행 | 배포 전 동작 확인이 필요할 때 |

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 병합 전 검증 기준으로 사용한다. UI·라우트·캠페인 흐름을 바꾼 Pull Request는 여기에 `pnpm test:e2e`를 더한다. 감시 모드가 필요하면 개발 중에만 `pnpm test:watch`를 사용하고, 검증에는 한 번 실행하고 종료하는 `pnpm test`를 사용한다.

## 화면 구조와 import 경계

라우트는 저장소 루트의 `app/`에 둔다.

```text
app/page.tsx                    /play 로 리다이렉트
app/play/layout.tsx             게임 셸. 자원 바와 파티 사이드바
app/play/page.tsx               파티 소개·던전 입장
app/play/map/page.tsx           던전 분기 지도
app/play/node/[nodeId]/page.tsx 조우 화면
app/play/result/page.tsx        결과 화면
```

컴포넌트는 `components/`에 두고 두 디렉터리로 나눈다.

- `components/ui/` — 게임을 모르는 프리미티브. `Panel`, `StatValue`가 여기 있다.
- `components/game/` — 도메인 타입을 읽는 컴포넌트.

두 경계를 `eslint.config.mjs`의 `no-restricted-imports`가 강제한다.

- `components/**`는 `@/lib/mock`을 가져오지 않는다. 목 데이터를 읽는 곳은 `app/**`뿐이며 컴포넌트에는 props로 넘긴다. 이 규칙 덕분에 실제 상태를 붙일 때 컴포넌트를 고치지 않는다.
- `components/ui/**`는 추가로 `@/lib/domain`을 가져오지 않는다. 프리미티브가 게임을 모르게 유지한다.

디자인 토큰은 `app/globals.css`의 `@theme`에 둔다. 새 색을 화면에서 직접 고르지 않고 토큰을 늘린다. 색으로만 뜻을 전달하지 않으며 기호나 텍스트를 함께 쓴다.

Next.js 16에서 `params`는 Promise이므로 `await`해야 한다. `PageProps<'/route'>` 전역 도우미는 `next dev`·`next build`·`next typegen`이 만든 타입에 의존하므로, 빌드 산물 없이 `pnpm typecheck`만 돌려도 통과하도록 `params: Promise<{ ... }>`를 명시한다.

## 테스트 작성 규약

단위 테스트는 Vitest로 작성한다. 세 사람이 같은 규약을 쓰도록 다음을 지킨다.

- 테스트 파일 이름은 `<대상>.test.ts`로 하고 대상 소스와 같은 디렉터리에 둔다. 별도의 `tests/` 디렉터리를 만들지 않는다.
- 다른 모듈은 상대 경로가 아니라 `@/`로 가져온다. 예를 들어 `@/lib/domain`이다.
- `describe`, `it`, `expect`를 `vitest`에서 명시적으로 가져온다. 전역으로 쓰지 않는다.
- `describe`와 `it`의 설명은 한국어로 쓴다. 커밋 메시지와 문서가 한국어이므로 실패 출력도 같은 언어로 읽히는 편이 낫다.
- 목 데이터에도 무결성 검사를 붙인다. 목이 도메인 상수의 범위를 어기거나 끊긴 참조를 담고 있으면 그 목을 믿고 만든 화면이 실제 데이터에서 깨진다. `lib/mock/mock.test.ts`가 예다.
- 검사 대상은 코드만이 아니다. 문서가 스스로 지켜야 할 규약을 담고 있으면 그 문서 옆에 `<문서명>.test.ts`를 두고 규약을 검사한다. [배정표 무결성 검사](PROTOTYPE_WORK_ASSIGNMENT.test.ts)가 그 예다.
- 위반이 여러 개일 수 있는 검사는 루프 안에서 바로 단정하지 않는다. 첫 위반에서 예외가 나면 나머지가 가려져 여러 번 고쳐야 한다. 위반을 배열로 모아 `expect(위반목록).toEqual([])`로 단정한다.

Vitest 설정은 `vitest.config.mts`에 둔다. 확장자가 `.ts`가 아니라 `.mts`인 이유는 Vite가 `.ts` 설정 파일을 CommonJS로 읽어 ESM 구문 경고를 내기 때문이다. `package.json`에 `type: module`을 넣는 방법은 Next.js 전체 모듈 해석에 영향을 주므로 쓰지 않는다.

Vitest는 `tsconfig.json`의 `paths`를 읽지 않는다. `@/` 별칭은 `vitest.config.mts`의 `resolve.alias`가 따로 맞춘다. 새 별칭을 추가할 때는 두 파일을 함께 고쳐야 한다.

현재 테스트 환경은 Node이며 순수 로직 검증을 대상으로 한다. React 컴포넌트를 렌더링하는 테스트가 필요해지면 그 작업에서 `jsdom`과 테스트 라이브러리를 함께 도입하고 이 절을 갱신한다.

가장 가까운 예시는 `lib/domain/contract.test.ts`다.

## 브라우저 E2E 테스트

Playwright Test와 Chromium은 실제 Next.js 라우트 렌더링, 브라우저 예외, 사용자 클릭
화면 전이, 고정 캔버스 viewport 계약을 검증한다. 최초 한 번
`pnpm test:e2e:install`로 Chromium을 설치하고, 이후 `pnpm test:e2e`로 서버 기동부터
종료까지 한 번에 실행한다.

Vitest의 `*.test.ts(x)`는 Node 환경의 규칙·Store·문서 회귀를 소유한다. Playwright의
`e2e/*.spec.ts`는 실제 브라우저가 필요한 회귀만 소유하며 서로의 내부 구현을 복제하지
않는다. 기존의 대상 옆 단위 테스트 규약은 Vitest에 적용하고, E2E는 이 분리 경로를
사용한다. 실패 trace와 screenshot은 `test-results/`, HTML 리포트는
`playwright-report/`에 생성되고 Git에는 포함하지 않는다.

현재 자동 범위는 Chromium 로컬 실행이다. GitHub Actions, Firefox·WebKit, 픽셀 골든
스크린샷은 별도 승인 뒤 추가한다.

Playwright는 하나의 Next 개발 서버와 오디오 재생 인스턴스를 공유하므로 워커를
1개로 고정한다. route 컴파일/HMR이 겹쳐 문서가 통째로 reload되는 테스트 환경
경합을 막고, route 전환에도 BGM 위치가 유지된다는 계약을 실제 앱 동작과 같은
조건에서 검증하기 위해서다.

## 오디오 자산 생성과 검증

공통 BGM과 UI 효과음은 외부 CDN이 아니라 저장소의 PCM WAV를 사용한다.
`pnpm audio:generate`는 고정 seed와 Node.js 표준 모듈만으로 아래 세 파일을
결정적으로 다시 만든다.

- `public/assets/audio/dungeon-schemer-guild-loop.wav`
- `public/assets/audio/ui-select.wav`
- `public/assets/audio/ui-menu.wav`

생성 뒤 `pnpm exec vitest run lib/audio/audio-assets.test.ts`로 RIFF/WAVE header,
길이, channel, sample rate, peak, DC offset, loop seam과 끝단 감쇠를 검증한다.
브라우저 흐름은 `pnpm exec playwright test e2e/audio-menu.spec.ts`로 확인한다.
런타임은 세 파일을 읽기만 하며 음원을 생성하거나 네트워크에서 내려받지 않는다.

세 파일은 44,100Hz signed PCM16으로 생성한다. BGM은 승인된 `어두운 길드의 밤
1B`의 음색을 64초 seamless loop로 확장하고, UI 효과음의 애플리케이션 재생
음량은 `0.28`로 고정한다. 미리듣기 파일은 최종 자산이 아니므로 `public`에 함께
배포하지 않는다.

## 난수와 재현성

같은 시드로 같은 판을 다시 만들 수 있어야 한다. 버그를 재현하고 밸런스를 비교하려면 이 성질이 필요하다.

- `Math.random`을 직접 호출하지 않는다. eslint가 오류로 막으며 예외는 없다.
- 난수는 `@/lib/rng`의 `createRng(seed)`로 만든다.
- 시스템마다 `derive(스트림 이름)`으로 독립 스트림을 받는다. 한 시스템의 난수 호출 횟수가 바뀌어도 다른 시스템의 결과가 변하지 않는다.
- 새 스트림이 필요하면 `RngStream` 유니온에 이름을 추가한다. 문자열을 그대로 넘기면 오타가 오류 없이 다른 스트림을 만든다.
- 새 판의 시드는 `createSeed()`로 만든다. 이 함수도 `Math.random`을 쓰지 않는다.

현재 스트림 10개는 `pool` · `board` · `party` · `map` · `ecology` · `card` ·
`event` · `boss` · `trust` · `worldturn`이다. `ecology`와 `worldturn`이 이번
개편에서 새로 생겼다. 활성 규칙 추첨과 월드턴 배정이 다른 스트림을 소비해야
한쪽 규칙을 고쳐도 다른 쪽 재현성이 흔들리지 않는다.

난수를 쓰는 함수는 `Rng`를 인자로 받는다. 함수 안에서 `createRng`를 직접 부르지 않는다. 그래야 테스트가 고정 시드를 주입할 수 있다.

```ts
// 이렇게 쓴다
export function generatePool(rng: Rng): Character[] { ... }

const pool = generatePool(createRng(seed).derive("pool"));
```

가장 가까운 예시는 `lib/rng/index.test.ts`다.

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

Zustand `5.0.14`는 현재 세션에서 여러 Client Component가 공유하는 상태를 관리하는 production dependency다. 상태는 책임에 따라 다음 두 스토어로 분리한다.

- Run Store: `RunState` 전체와 새 런 시작·교체·초기화 동작
- UI Store: 선택한 파티원처럼 화면에서만 필요한 임시 상태

Next.js App Router에서는 모듈 전역 singleton 스토어를 만들지 않는다. `zustand/vanilla`의 팩토리로 스토어를 만들고 Client Context Provider가 화면 인스턴스마다 한 번 생성한다. React Server Component는 스토어를 직접 읽거나 쓰지 않으며, 서버에서 준비한 값이 필요하면 직렬화 가능한 props를 Provider의 초기값으로 전달한다. 이 기준은 [Zustand의 Next.js 가이드](https://zustand.docs.pmnd.rs/learn/guides/nextjs)를 따른다.

스토어는 게임 규칙을 소유하지 않는다. 규칙 함수가 만든 다음 `RunState`를 받아 전체 상태를 교체하며 중첩 객체를 제자리에서 변경하지 않는다. 새 런의 시드는 `@/lib/rng`의 `createSeed()`로 만들되, 실제 파티와 던전 생성 규칙은 파티 생성 규칙과 던전 생성 규칙이 제공한다.

캠페인 Store의 `CampaignState`와 `CampaignTransitionContext`는 브라우저 저장소나
서버에 영속화하지 않는다. 캠페인 이어하기를 위한 `persist`, `localStorage`,
Supabase 저장·복원은 별도 설계가 승인될 때 도입한다.

허용된 브라우저 영속 상태는 캠페인과 분리된 V1 업적 프로필과 V1 오디오 설정이다.
업적 기본 키는 `dungeon-schemer.player-progress.v1`이며, 엔딩에서 확정한 결과와
누적 업적만 보관한다. 손상된 원문을 교체하기 전에는
`dungeon-schemer.player-progress.corrupt-backup`에 한 번 보조 백업할 수 있다.
로그인·서버 동기화·캠페인 진행 복원에는 이 업적 키들을 사용하지 않는다.

오디오 키 `dungeon-schemer.audio-settings.v1`은 BGM·효과음 ON/OFF만 저장한다.
최초값은 모두 OFF이고, 업적 초기화와 서로 영향을 주지 않는다. 구조 오류는 OFF로
복구하고 미래 버전은 덮어쓰지 않으며, 저장소 접근 실패는 탭 메모리 fallback으로
처리한다.

`/state-preview`는 Run/UI Store와 파티 생성을 확인하는 공개 기술 검증 라우트다. 홈과 실제 게임 흐름에는 연결하지 않지만 development 환경과 Vercel production에서 접근할 수 있다. seed를 입력하면 같은 파티를 재현할 수 있으며, 고정 던전 fixture만 함께 표시한다. 이 라우트는 사용자 데이터·비밀 값·인증·영속화를 사용하지 않고, 배포 환경에서도 `Development only` 안내를 유지한다.

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
- Zustand `5.0.14`로 클라이언트 상태를 관리한다.
- Run Store와 UI Store를 분리하고, App Router에서는 vanilla store factory와 Client Context Provider를 사용한다.
- Supabase를 백엔드와 데이터 계층으로 사용한다.
- Vercel에 배포한다.

## 아직 확정하지 않는 것

- Next.js, React, Tailwind CSS, Framer Motion, Supabase의 정확한 버전
- Supabase 인증과 데이터베이스 스키마
- 배포 승인 절차
- 환경 변수 이름과 비밀 정보 관리 규칙

이 항목은 구현 전에 기술 설계와 초기화 계획에서 결정한다.

## Hello World 초기화 범위

이 절은 지난 초기화 작업의 기록이다. 화면 셸 작업에서 `Hello World` 화면은 `/play` 리다이렉트로 대체됐다.

초기화 작업은 브라우저에서 `Hello World`와 Dungeon Schemer 식별 문구를 표시하고, `pnpm lint`, `pnpm typecheck`, `pnpm build`를 실행할 수 있는 최소 앱을 만드는 데 한정한다.

이 단계에서는 Supabase, 로그인, 환경 변수, Vercel 프로젝트 연결, Zustand, Framer Motion, 테스트 도구, 게임 규칙과 화면 상호작용을 추가하지 않는다.

## 관련 문서

- [게임 원칙](../GAME_PRINCIPLES.md)
- [온보딩과 인터페이스](../experience/ONBOARDING_AND_INTERFACE.md)
- [기존 개발 환경 메모](../initialization/Development_Environment.md)
