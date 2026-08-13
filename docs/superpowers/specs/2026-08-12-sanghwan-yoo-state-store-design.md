# F2 상태 스토어 골격 설계

**작성자:** SangHwan Yoo
**작성 도구:** Codex

## 목적

현재 한 판의 게임 데이터와 화면에서만 필요한 선택 상태를 서로 다른 Zustand 스토어로 관리한다. 이후 `P1` 상태 머신과 `U1`~`U5` 화면이 같은 계약 위에서 연결될 수 있도록 최소 골격을 만든다.

이 작업은 [프로토타입 작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)의 `F2`다. 완료된 `F1`의 `RunState`, `F3`의 시드 생성기, `F4`의 Vitest를 사용한다.

> Zustand 설치, 런 상태와 UI 상태 스토어 분리, 초기 상태가 화면에 표시됨

초기 상태는 실제 게임 화면이 아니라 개발 전용 `/state-preview`에서 검증한다. 이 라우트는 실제 게임 흐름에 포함되지 않는다.

## 기준 문서

- [게임 원칙](../../GAME_PRINCIPLES.md): 신뢰는 파티 평균이 아니라 파티원 개인별로 관리하고 표시한다.
- [핵심 게임 루프](../../design/CORE_GAME_LOOP.md): F2는 게임 규칙을 구현하지 않고 현재 런을 담을 자리만 제공한다.
- [F1 도메인 타입 설계](2026-08-12-lattebun-domain-types-design.md): 런 데이터 계약으로 기존 `RunState`를 사용하고 별도 타입을 만들지 않는다.
- [개발 환경](../../technical/DEVELOPMENT_ENVIRONMENT.md): App Router용 스토어 생성 방식과 Run/UI 분리 원칙을 따른다.
- [프로토타입 작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md): F2는 `P1`의 직접 선행이며 `R1`, `R4`, `F5`의 책임을 가져오지 않는다.
- [Zustand Next.js 가이드](https://zustand.docs.pmnd.rs/learn/guides/nextjs): 요청 간 공유되는 전역 스토어를 피하고 vanilla store를 Context Provider에서 생성한다.
- [Zustand TypeScript 가이드](https://zustand.docs.pmnd.rs/guides/typescript): `createStore`와 `useStore`의 타입을 명시한다.
- 설치된 `node_modules/next/dist/docs/`: 구현 전에 App Router page, Client Component, `notFound` 관련 문서를 확인한다.

## 설계 결정

### Zustand 버전과 생성 방식

production dependency로 `zustand@5.0.14`를 설치한다. `package.json`과 `pnpm-lock.yaml`에 설치 결과를 기록한다.

모듈 전역 singleton hook을 만들지 않는다. `zustand/vanilla`의 `createStore`로 인스턴스를 반환하는 팩토리를 제공하고 React에서는 `zustand`의 `useStore`로 구독한다.

### Run Store와 UI Store 분리

Run Store는 게임 세션 데이터인 `RunState`만 소유한다. UI Store는 선택한 파티원처럼 화면 표현에만 필요한 임시 상태만 소유한다. UI 선택을 게임 상태 변경으로 취급하지 않고, 이후 세이브 데이터에도 섞지 않기 위한 경계다.

F2에서 UI Store에 넣는 값은 `selectedMemberId` 하나뿐이다. 다른 모달, 애니메이션, 카드 선택 상태는 실제 요구가 생기는 후속 작업에서 추가한다.

### 화면 인스턴스별 Provider

App Router 서버는 요청을 동시에 처리하므로 모듈 최상위 스토어 인스턴스를 금지한다. `GameStoreProvider`가 Run Store와 UI Store를 각각 한 번 생성하고 두 Context로 공급한다.

React Server Component는 스토어를 직접 읽거나 쓰지 않는다. 서버 초기값이 있다면 직렬화 가능한 `RunState`를 Provider의 `initialRun` prop으로 전달한다. Client Component만 selector hook으로 상태를 구독하고 action을 호출한다.

### 상태 수명주기와 게임 규칙 분리

스토어는 파티 생성, 경로 생성, 신뢰 판정, 상태 전이를 구현하지 않는다. 외부 규칙 함수가 완성한 다음 `RunState`를 받아 전체 상태를 교체한다. 중첩 객체를 제자리에서 변경하지 않는다.

### 개발 전용 검증 라우트

`/state-preview`는 F2 수동 검증 전용이다. 실제 게임 라우트나 온보딩에 참여하지 않으며 홈에서도 링크하지 않는다. production에서는 `notFound()`를 호출해 404를 반환한다.

실제 게임 화면에 Store Provider를 연결하는 첫 후속 작업에서 `app/state-preview/` 전체를 삭제한다.

## 파일 구조

```text
lib/stores/
  run-store.ts
  run-store.test.ts
  ui-store.ts
  ui-store.test.ts
  game-store-provider.tsx

app/state-preview/
  page.tsx
  preview-run.ts
  state-preview-panel.tsx
```

| 파일 | 책임 |
| --- | --- |
| `lib/stores/run-store.ts` | `RunState` vanilla store 팩토리와 action 타입 |
| `lib/stores/run-store.test.ts` | 생성·교체·새 런·초기화 계약 검증 |
| `lib/stores/ui-store.ts` | UI 선택 vanilla store 팩토리와 action 타입 |
| `lib/stores/ui-store.test.ts` | 선택·해제·초기화와 Run Store 독립성 검증 |
| `lib/stores/game-store-provider.tsx` | 두 Context, Provider, selector hook |
| `app/state-preview/page.tsx` | 개발 환경에서만 초기값과 Provider를 조립하는 Server Component |
| `app/state-preview/preview-run.ts` | F2 검증용 `RunState` fixture |
| `app/state-preview/state-preview-panel.tsx` | 상태 표시와 action 실행 Client Component |

`app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `lib/domain/*`, `lib/rng/*`는 수정하지 않는다. LatteBun이 진행 중인 F5 화면 작업과 파일 충돌을 만들지 않는다.

## Run Store 계약

```ts
export type RunFactory = (seed: string) => RunState;

export interface RunStoreState {
  run: RunState;
}

export interface RunStoreActions {
  replaceRun(nextRun: RunState): void;
  startNewRun(createRun: RunFactory, seed?: string): void;
  resetRun(): void;
}
```

`createRunStore(initialRun)`은 상태와 action을 담는 새 vanilla store를 반환한다.

- `replaceRun(nextRun)`은 현재 런 전체를 교체한다.
- `startNewRun(createRun, seed?)`은 명시적 시드 또는 F3의 `createSeed()`로 선택한 시드를 factory에 전달한다.
- factory가 반환한 `RunState.seed`가 선택한 시드와 다르면 명확한 오류를 던지고 기존 상태를 유지한다. 검증 전에는 `set`을 호출하지 않는다.
- `resetRun()`은 생성 시 전달한 `initialRun`으로 돌아간다.

F2는 빈 런이나 공식 초기값을 정의하지 않는다. 실제 파티와 던전은 `R1`과 `R4`가 만들고 `P1`이 조립한다.

## UI Store 계약

```ts
export interface UiStoreState {
  selectedMemberId: MemberId | null;
}

export interface UiStoreActions {
  selectMember(memberId: MemberId): void;
  clearSelectedMember(): void;
  resetUi(): void;
}
```

`createUiStore()`는 `selectedMemberId: null`로 시작한다. 선택·해제·초기화 action은 Run Store를 가져오거나 수정하지 않는다. UI Store는 ID가 현재 파티에 존재하는지 검사하지 않으며 화면이 유효한 ID만 전달한다.

## Provider와 selector hook

`GameStoreProvider`는 `initialRun`과 `children`을 받는 Client Component다. 첫 렌더에서 두 스토어를 만들고 재렌더링에서도 같은 인스턴스를 유지한다.

`useRunStore(selector)`와 `useUiStore(selector)`는 각 Context를 읽어 `useStore(store, selector)`에 전달한다. Provider 바깥에서 호출하면 필요한 Provider 이름을 포함한 오류를 던진다. 컴포넌트는 selector로 필요한 상태 조각만 구독한다.

Provider는 F2에서 `/state-preview`에만 설치한다.

## 상태 미리보기

### Fixture

`createPreviewRun(seed)`는 인자 시드를 그대로 `RunState.seed`에 넣고 다음 기술 검증 데이터를 반환한다.

- `partyIntro` 단계
- 서로 다른 고정 직업·성격과 서로 다른 개인 신뢰를 가진 파티원 3명
- 입구에서 보스로 이어지는 최소 던전 그래프와 입구 현재 위치
- 화면 확인용 고정 자원
- 빈 `pendingClaims`와 `log`

이름, 직업, 성격, 신뢰, 자원은 기술 예시일 뿐 공식 기본값이나 콘텐츠가 아니다. `R1`, `R2`, `R4`, `Q1`의 규칙을 정의하지 않는다.

### 표시 항목

화면 상단에 “F2 상태 스토어 개발 미리보기 — 표시 값은 기술 검증용 예시이며 공식 기본값이 아닙니다.”를 눈에 띄게 표시한다.

- seed, phase, 현재 노드 ID
- 노드 수와 파티원 수
- gold, food, reputation
- pending claim 수와 log 수
- 파티원별 이름, class ID, personality, 개인 trust, 생존 여부
- 현재 선택된 파티원

파티 평균 또는 합산 신뢰는 계산하거나 표시하지 않는다.

### 조작

- 파티원 선택: UI Store의 `selectedMemberId`만 변경
- 선택 해제: UI Store 선택만 `null`로 변경
- 새 미리보기 런: `startNewRun(createPreviewRun)` 실행 후 UI Store를 별도 action으로 초기화
- 모두 초기화: 두 스토어의 reset action을 각각 호출

현재 Tailwind 유틸리티와 의미 있는 HTML로 읽을 수 있는 정도만 작성한다. F5가 소유한 화면 셸, 색상 체계, 반응형 레이아웃, 모션을 설계하지 않는다.

## 오류 처리

- Provider 없는 selector hook은 즉시 오류를 던진다.
- 새 런 factory가 다른 시드를 반환하면 오류를 던지고 현재 런을 유지한다.
- `RunState` 세부 도메인 검증기는 만들지 않는다. F1 타입을 만족하는 값은 호출자 책임이다.
- preview 외 콘텐츠 누락을 F2 임시 값으로 메우지 않는다.

## 테스트

현재 Vitest Node 환경을 유지하며 `jsdom`이나 React Testing Library는 추가하지 않는다.

### `run-store.test.ts`

- 전달한 초기 상태를 정확히 보관
- `replaceRun`의 전체 교체와 이전 객체 비변경
- 고정 시드를 factory에 전달하고 결과 저장
- 시드 생략 시 비어 있지 않은 `createSeed()` 결과를 factory와 상태에 동일하게 사용
- 시드 불일치 시 오류와 기존 상태 유지
- 생성 시점 초기 런으로 reset

### `ui-store.test.ts`

- 초기 선택 `null`
- 선택, 선택 해제, reset
- UI Store 변경과 별도 Run Store의 독립성

Provider와 화면은 `pnpm typecheck`, `pnpm build`, 브라우저 수동 확인으로 검증한다.

## 문서 갱신

설계 승인 뒤 구현 전에 [개발 환경](../../technical/DEVELOPMENT_ENVIRONMENT.md)에 Zustand `5.0.14`, vanilla store factory와 Context Provider, Run/UI 분리, RSC 경계, 비영속화 원칙을 확정한다.

구현과 검증이 끝날 때 [프로토타입 작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)를 다음처럼 갱신한다.

- `F2` 담당자: `SangHwan Yoo`
- `F2` 상태: `✅`
- `P1`의 남은 선행: `F2 R1 R4`에서 `R1 R4`로 변경

의존성 그래프의 `F2 → P1` 관계는 전체 구조이므로 유지한다.

## 검증 절차

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

개발 모드에서는 `pnpm dev` 후 `/state-preview`의 초기 상태와 네 조작을 확인하고 `/`가 기존과 같은지 확인한다. production에서는 `pnpm build`와 `pnpm start` 후 `/state-preview`가 404인지 확인한다.

## 제외 범위

- `app/page.tsx`, F5 화면 셸과 실제 게임 화면
- `R1`~`R4` 규칙과 `P1` 상태 전이
- `Q1` 공식 콘텐츠와 밸런스 값
- localStorage, Zustand persist, Supabase 저장·복원
- URL seed 공유와 런 복원
- React 컴포넌트 테스트 환경

## 완료 조건

- `zustand@5.0.14`가 production dependency와 잠금 파일에 기록된다.
- Run Store와 UI Store가 별도 vanilla store로 존재한다.
- Provider가 화면 인스턴스마다 두 스토어를 한 번씩 생성한다.
- 두 스토어의 계약과 시드 일치 검증 단위 테스트가 통과한다.
- 개발 환경 `/state-preview`에서 초기 `RunState`와 UI 선택을 확인·조작할 수 있다.
- production `/state-preview`는 404다.
- `/`와 F5 소유 파일은 변경되지 않는다.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`가 모두 통과한다.

## 후속 계약

- `P1`은 순수 규칙 함수가 만든 다음 `RunState`를 `replaceRun`으로 반영한다.
- `R1`과 `R4`가 준비되면 실제 새 런 factory를 `startNewRun`에 전달한다.
- `U1`~`U5`는 selector hook으로 필요한 상태만 구독한다.
- 실제 게임 화면에 Provider가 연결되는 첫 후속 작업은 `app/state-preview/`를 삭제한다.
