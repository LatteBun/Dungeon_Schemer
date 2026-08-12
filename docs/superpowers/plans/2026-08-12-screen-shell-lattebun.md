# F5 화면 셸·레이아웃 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인터페이스 문서의 6개 화면 영역을 목 데이터로 배치한 라우트 5개를 만들고, `U1`~`U4`가 공유할 셸·디자인 토큰·경계 규칙을 세운다.

**Architecture:** `app/play/layout.tsx` 하나가 자원 바(①)와 파티 사이드바(④)를 들고, 네 화면이 그 안에 들어간다. 모든 컴포넌트는 서버 컴포넌트이며 `lib/mock`의 `RunState` 하나를 데이터 출처로 쓴다. 컴포넌트는 목 데이터를 직접 가져오지 않고 props로 받으므로, `F2`·`P1`이 붙을 때 `app/**`의 import만 바뀐다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5.9.3 (`strict`), Tailwind CSS 4.3.3 (`@theme`), Vitest 4.1.10 (`environment: "node"`)

## Global Constraints

- 브랜치는 `feature/screen-shell`이며 `main`의 `f980171`에서 갈라졌다. `main`에 직접 push하지 않는다.
- 커밋 메시지는 제목과 본문을 포함해 한글로 쓴다.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` 넷이 모두 통과해야 한다.
- `Math.random`을 쓰지 않는다. 목 데이터는 고정값이므로 난수가 필요 없다.
- 테스트 파일 이름은 `<대상>.test.ts`이며 대상과 같은 디렉터리에 둔다. 별도 `tests/` 디렉터리를 만들지 않는다.
- 테스트는 `describe`·`it`·`expect`를 `vitest`에서 명시적으로 가져오고 설명을 한국어로 쓴다.
- 다른 모듈은 상대 경로가 아니라 `@/`로 가져온다. 단 같은 디렉터리 안의 형제 파일은 상대 경로를 쓴다.
- `jsdom`을 도입하지 않는다. 컴포넌트 렌더링 테스트를 쓰지 않는다.
- `"use client"`를 쓰지 않는다. 클라이언트 상태는 `F2`의 책임이다.
- 위반 목록을 검사하는 테스트는 배열로 모아 `expect(위반목록).toEqual([])`로 단정한다. 루프 안에서 바로 단정하면 첫 위반만 드러난다.
- 신뢰 변화는 색만으로 구분하지 않는다. `▲`/`▼` 기호와 스크린 리더용 텍스트를 함께 쓴다.
- 도메인 타입에 더하는 것은 `ChoiceId`와 `EventChoice`뿐이다. 정산 결과 타입은 만들지 않는다.
- 브랜드 ID는 `"m-1" as MemberId` 형태의 캐스트로 만든다. 생성 함수를 도메인에 넣지 않는다.

## 두 가지 import 경계

이 계획은 규칙 둘을 eslint로 강제한다. 산문으로만 두면 반드시 깨진다.

1. **`components/ui/**`는 `@/lib/domain`을 가져오지 않는다.** 프리미티브가 게임을 모르게 유지한다.
2. **`components/**`는 `@/lib/mock`을 가져오지 않는다.** 목 데이터를 읽는 곳은 `app/**`뿐이다. 이 규칙 덕분에 `F2`·`P1`이 붙을 때 컴포넌트를 고치지 않는다.

## File Structure

| 경로 | 책임 |
| --- | --- |
| `app/globals.css` | 디자인 토큰. Hello World용 규칙 제거 |
| `app/layout.tsx` | `html`/`body`. 바탕색과 글자색을 Tailwind 클래스로 |
| `app/page.tsx` | `/play`로 리다이렉트 |
| `app/play/layout.tsx` | 게임 셸. ①과 ④를 담고 목 데이터를 주입 |
| `app/play/page.tsx` | 파티 소개·던전 입장 |
| `app/play/map/page.tsx` | ⑤ 분기 지도 |
| `app/play/node/[nodeId]/page.tsx` | ② 장면 + ③ 선택 |
| `app/play/result/page.tsx` | ⑥ 결과 |
| `components/ui/Panel.tsx` | 제목 있는 패널 껍데기 |
| `components/ui/StatValue.tsx` | 라벨 + 값 |
| `components/game/labels.ts` | 도메인 유니온 → 한국어 표기 |
| `components/game/ResourceBar.tsx` | ① |
| `components/game/PartySidebar.tsx` | ④ |
| `components/game/TrustRow.tsx` | ④ 의 한 줄 |
| `components/game/SceneStage.tsx` | ② 자리 |
| `components/game/ChoiceList.tsx` | ③ |
| `components/game/DungeonMap.tsx` | ⑤ |
| `components/game/ResultSummary.tsx` | ⑥ |
| `lib/domain/ids.ts` | `ChoiceId` 추가 |
| `lib/domain/dungeon.ts` | `EventChoice` 추가, `DungeonEvent.choices` 추가, 보스방 주석 |
| `lib/domain/index.ts` | 배럴에 둘 추가 |
| `lib/domain/__checks__.ts` | `choices` 필수화에 맞춰 갱신 |
| `lib/mock/*` | 목 데이터와 무결성 검사 |
| `eslint.config.mjs` | import 경계 규칙 둘 |

---

## Task 1: 디자인 토큰, UI 프리미티브, import 경계

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `components/ui/Panel.tsx`
- Create: `components/ui/StatValue.tsx`
- Modify: `eslint.config.mjs`

**Interfaces:**
- Consumes: 없음. 첫 작업이다.
- Produces:
  - CSS 토큰 `--color-ink` `--color-parchment` `--color-muted` `--color-panel` `--color-edge` `--color-trust-up` `--color-trust-down`. Tailwind 유틸리티 `bg-ink` `text-parchment` `text-muted` `bg-panel` `border-edge` `text-trust-up` `text-trust-down`로 쓴다.
  - `Panel({ title?: string, aside?: ReactNode, className?: string, children: ReactNode }): JSX.Element`
  - `StatValue({ label: string, value: number | string, suffix?: string }): JSX.Element`

- [ ] **Step 1: 의존성이 설치돼 있는지 확인한다**

Run:
```bash
pnpm install --frozen-lockfile
```
Expected: 이미 설치돼 있으면 `Already up to date` 또는 즉시 완료. `node_modules`가 없으면 설치가 진행된다.

- [ ] **Step 2: `app/globals.css`를 토큰 정의로 교체한다**

파일 전체를 다음으로 바꾼다. Hello World용 `place-items: center`, `text-align: center`, `font-size: 3rem`은 게임 레이아웃과 맞지 않으므로 지운다. 바탕색과 글자색은 `app/layout.tsx`의 Tailwind 클래스로 옮긴다.

```css
@import "tailwindcss";

/*
 * 디자인 토큰. U1~U4가 새 패널을 만들 때 색을 새로 고르지 않도록
 * 여기에 모은다. 아이콘·질감·아트 스타일은 아직 정하지 않는다.
 */
@theme {
  --color-ink: #17130f;
  --color-parchment: #f4f0e6;
  --color-muted: #cbbca5;
  --color-panel: #211a14;
  --color-edge: #3a2e23;
  --color-trust-up: #7fa66a;
  --color-trust-down: #b5654f;
}
```

- [ ] **Step 3: `app/layout.tsx`의 `body`에 바탕색과 글자색을 준다**

`body` 태그만 고친다. 나머지는 그대로 둔다.

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dungeon Schemer",
  description: "Dungeon Schemer prototype",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-ink font-sans text-parchment antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: `components/ui/Panel.tsx`를 만든다**

```tsx
import type { ReactNode } from "react";

interface PanelProps {
  /** 없으면 제목 줄을 그리지 않는다. */
  title?: string;
  /** 제목 오른쪽에 놓는 보조 정보다. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * 화면 영역의 공통 껍데기다.
 * 게임을 모르는 프리미티브이므로 @/lib/domain 을 가져오지 않는다.
 * eslint 의 no-restricted-imports 가 이 경계를 강제한다.
 */
export function Panel({ title, aside, className, children }: PanelProps) {
  return (
    <section
      className={`flex flex-col rounded border border-edge bg-panel${
        className === undefined ? "" : ` ${className}`
      }`}
    >
      {title === undefined ? null : (
        <header className="flex items-baseline justify-between gap-2 border-b border-edge px-3 py-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted">
            {title}
          </h2>
          {aside}
        </header>
      )}
      <div className="flex-1 p-3">{children}</div>
    </section>
  );
}
```

- [ ] **Step 5: `components/ui/StatValue.tsx`를 만든다**

```tsx
interface StatValueProps {
  label: string;
  value: number | string;
  /** 값 뒤에 붙는 단위나 기호다. */
  suffix?: string;
}

/** 라벨과 값을 한 쌍으로 보여준다. 게임을 모른다. */
export function StatValue({ label, value, suffix }: StatValueProps) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-parchment">
        {value}
        {suffix}
      </span>
    </span>
  );
}
```

- [ ] **Step 6: `eslint.config.mjs`에 import 경계 규칙 둘을 넣는다**

`...nextTs` 다음, `globalIgnores` 앞에 두 블록을 넣는다.

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // 목 데이터를 읽는 곳은 app/** 뿐이다. 컴포넌트가 목을 직접 가져오면
    // F2·P1이 실제 상태를 붙일 때 컴포넌트를 전부 고쳐야 한다.
    files: ["components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/mock", "@/lib/mock/*"],
              message:
                "컴포넌트는 목 데이터를 직접 가져오지 않는다. app/** 에서 props로 넘긴다.",
            },
          ],
        },
      ],
    },
  },
  {
    // 프리미티브는 게임을 모른다. 도메인 타입을 읽는 컴포넌트는
    // components/game 에 둔다.
    files: ["components/ui/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/mock",
                "@/lib/mock/*",
                "@/lib/domain",
                "@/lib/domain/*",
              ],
              message:
                "components/ui 는 게임을 모르는 프리미티브다. 도메인 타입을 읽는 컴포넌트는 components/game 에 둔다.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

- [ ] **Step 7: 경계 규칙이 실제로 발동하는지 확인한다**

통과만 보고 믿을 수 없다. 일부러 위반을 넣고 규칙이 잡는지 본다.

Run:
```bash
printf 'import type { MemberId } from "@/lib/domain";\nexport const x: MemberId = "a" as MemberId;\n' > components/ui/__probe.ts
pnpm lint 2>&1 | tail -20
```
Expected: `components/ui/__probe.ts`에서 `no-restricted-imports` 오류. 메시지에 "게임을 모르는 프리미티브"가 나온다.

- [ ] **Step 8: 두 번째 규칙도 발동하는지 확인하고 탐침을 지운다**

Run:
```bash
printf 'export const y = 1;\nimport "@/lib/mock";\n' > components/game/__probe.ts
pnpm lint 2>&1 | grep -c "no-restricted-imports"
rm components/ui/__probe.ts components/game/__probe.ts
```
Expected: `grep -c`가 1 이상. `components/game/__probe.ts`가 `@/lib/mock` import로 걸린다. `@/lib/mock`이 아직 없어도 eslint는 경로를 해석하지 않고 문자열만 보므로 규칙이 발동한다. 그 뒤 두 탐침 파일이 지워진다.

- [ ] **Step 9: 검증 명령을 돌린다**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm build
```
Expected: 셋 다 통과. `pnpm build` 출력에 `/` 라우트가 나온다. `pnpm test`는 이 작업에서 새 테스트를 만들지 않으므로 기존 5개가 그대로 통과한다.

`components/` 아래 파일은 아직 아무도 가져오지 않으므로 빌드 출력에 나타나지 않는다. 정상이다.

- [ ] **Step 10: 커밋한다**

```bash
git add app/globals.css app/layout.tsx components/ui eslint.config.mjs
git commit -F - <<'MSG'
작업: 디자인 토큰과 UI 프리미티브, import 경계 규칙

U1~U4가 각자 색과 간격을 고르면 넷이 어긋난 뒤 누군가 통일하는 작업이
생긴다. 셸을 만드는 이 작업에서 토큰과 공용 패널을 함께 제공한다.

globals.css 의 Hello World 용 규칙을 지웠다. place-items: center 와
text-align: center 는 게임 레이아웃과 맞지 않는다. 바탕색과 글자색은
app/layout.tsx 의 Tailwind 클래스로 옮겼다.

import 경계 둘을 eslint 로 강제한다. 산문으로만 두면 깨진다.

components/** 는 @/lib/mock 을 가져오지 않는다. 목을 읽는 곳은 app/**
뿐이므로, F2·P1 이 실제 상태를 붙일 때 컴포넌트를 고치지 않는다.

components/ui/** 는 추가로 @/lib/domain 을 가져오지 않는다. 프리미티브가
게임을 모르게 유지하는 경계다.

두 규칙이 실제로 발동하는지 탐침 파일로 확인한 뒤 지웠다.
MSG
```

---

## Task 2: 도메인에 이벤트 선택지 타입 추가

**Files:**
- Modify: `lib/domain/ids.ts`
- Modify: `lib/domain/dungeon.ts`
- Modify: `lib/domain/index.ts`
- Modify: `lib/domain/__checks__.ts`

**Interfaces:**
- Consumes: Task 1의 결과에 의존하지 않는다.
- Produces:
  - `ChoiceId = Brand<string, "ChoiceId">`
  - `EventChoice { id: ChoiceId; label: string; target?: Target; expectedGain: string; knownRisk: string }`
  - `DungeonEvent.choices: EventChoice[]` — 필수 필드
  - 배럴 `@/lib/domain`이 `ChoiceId`와 `EventChoice`를 내보낸다.

**주의:** `choices`를 필수로 만들면 `lib/domain/__checks__.ts`의 `sampleEvent`가 컴파일에 실패한다. 같은 작업에서 함께 고친다.

- [ ] **Step 1: `lib/domain/ids.ts`에 `ChoiceId`를 더한다**

`NodeId` 다음 줄에 넣는다.

```ts
export type ChoiceId = Brand<string, "ChoiceId">;
```

파일의 ID 목록이 다음과 같아진다.

```ts
export type MemberId = Brand<string, "MemberId">;
export type ClassId = Brand<string, "ClassId">;
export type CardId = Brand<string, "CardId">;
export type EventId = Brand<string, "EventId">;
export type NodeId = Brand<string, "NodeId">;
export type ChoiceId = Brand<string, "ChoiceId">;
export type ClaimId = Brand<string, "ClaimId">;
export type ItemId = Brand<string, "ItemId">;
```

- [ ] **Step 2: `lib/domain/dungeon.ts`에 `EventChoice`를 더하고 `DungeonEvent`를 고친다**

import 줄과 `DungeonEvent`, `DungeonNode`를 고친다. `EVENT_KINDS`와 `DungeonState`는 그대로 둔다.

```ts
import type { ChoiceId, EventId, NodeId } from "./ids";
import type { Target } from "./info";
```

`EventKind`와 `EVENT_KINDS` 선언 다음에 `EventChoice`를 넣고 `DungeonEvent`를 교체한다.

```ts
/**
 * 이벤트에서 플레이어가 고를 수 있는 하나의 행동이다.
 *
 * 인터페이스 문서가 선택 전에 행동 대상·예상 이득·알려진 위험을 확인할 수
 * 있어야 한다고 정했으므로 셋을 타입에 담는다. 정확한 계산식을 다 공개할
 * 필요는 없지만 위험이 완전히 숨겨져서는 안 된다.
 * docs/experience/ONBOARDING_AND_INTERFACE.md
 */
export interface EventChoice {
  id: ChoiceId;
  label: string;
  /** 행동 대상. 없으면 파티 전체나 상황 자체를 향한다. */
  target?: Target;
  /** "성직자의 신뢰를 얻는다"처럼 플레이어에게 알려주는 기대치다. */
  expectedGain: string;
  /** "발각되면 처형"처럼 플레이어가 아는 위험이다. */
  knownRisk: string;
}

export interface DungeonEvent {
  id: EventId;
  kind: EventKind;
  title: string;
  description: string;
  /** 비어 있을 수 없다. 모든 이벤트는 최소 하나의 선택을 제공한다. */
  choices: EventChoice[];
}
```

`DungeonNode`의 `nextNodeIds` 주석을 고친다. 지금 주석은 "빈 배열이면 보스전 직전이다"인데 `bossNodeId`가 따로 있어 두 가지로 읽힌다.

```ts
/** 던전은 되돌아가지 않는 분기 그래프다. */
export interface DungeonNode {
  id: NodeId;
  /** 입구에서의 거리. 경로 지도가 세로 위치를 잡는 데 쓴다. */
  depth: number;
  eventId: EventId;
  /** 빈 배열이면 마지막 지점이다. DungeonState의 bossNodeId가 그렇다. */
  nextNodeIds: NodeId[];
}
```

- [ ] **Step 3: `lib/domain/index.ts`의 배럴에 둘을 더한다**

두 export 블록을 고친다.

```ts
export type {
  Brand,
  CardId,
  ChoiceId,
  ClaimId,
  ClassId,
  EventId,
  ItemId,
  MemberId,
  NodeId,
} from "./ids";
```

```ts
export { EVENT_KINDS } from "./dungeon";
export type {
  DungeonEvent,
  DungeonNode,
  DungeonState,
  EventChoice,
  EventKind,
} from "./dungeon";
```

- [ ] **Step 4: 타입 검사를 돌려 `__checks__.ts`가 깨지는 것을 확인한다**

Run:
```bash
pnpm typecheck
```
Expected: FAIL. `lib/domain/__checks__.ts`의 `sampleEvent`에서 `choices` 속성이 없다는 오류가 난다. 이것이 `choices`를 필수로 만든 효과다.

- [ ] **Step 5: `lib/domain/__checks__.ts`를 갱신한다**

import에 `ChoiceId`와 `EventChoice`를 더한다.

```ts
import type {
  CardId,
  ChoiceId,
  ClaimId,
  ClassId,
  EventId,
  MemberId,
  NodeId,
} from "./ids";
```

```ts
import { EVENT_KINDS } from "./dungeon";
import type {
  DungeonEvent,
  DungeonNode,
  DungeonState,
  EventChoice,
} from "./dungeon";
```

`sampleEvent` 선언을 다음으로 교체한다. `sampleTargetMember`가 그 위에 이미 선언돼 있으므로 그대로 쓴다.

```ts
export const sampleChoice: EventChoice = {
  id: "choice-help-heroes" as ChoiceId,
  label: "용사를 지원한다",
  target: sampleTargetMember,
  expectedGain: "성직자의 신뢰를 얻는다",
  knownRisk: "보스와의 관계가 나빠진다",
};

// target은 선택 사항이다. 파티 전체나 상황 자체를 향하는 행동이 있다.
export const sampleChoiceWithoutTarget: EventChoice = {
  id: "choice-watch" as ChoiceId,
  label: "관망한다",
  expectedGain: "관계 변화를 줄인다",
  knownRisk: "기회를 잃는다",
};

export const sampleEvent: DungeonEvent = {
  id: "event-goblin-ambush" as EventId,
  kind: "monster",
  title: "고블린 매복",
  description: "좁은 길에서 고블린 세 마리가 튀어나온다.",
  choices: [sampleChoice, sampleChoiceWithoutTarget],
};

// 브랜드가 동작하면 ChoiceId를 NodeId 자리에 넣을 수 없다.
// @ts-expect-error ChoiceId는 NodeId에 대입할 수 없다
export const wrongChoiceId: NodeId = sampleChoice.id;
```

파일 끝의 배럴 확인 목록에 두 줄을 더한다.

```ts
export const barrelChoice: domain.EventChoice = sampleChoice;
export const barrelChoiceId: domain.ChoiceId = sampleChoice.id;
```

- [ ] **Step 6: 검증 명령을 돌린다**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Expected: 넷 다 통과. `pnpm test`는 기존 5개가 통과한다.

- [ ] **Step 7: 커밋한다**

```bash
git add lib/domain
git commit -F - <<'MSG'
기능: 이벤트 선택지 타입을 도메인에 추가

DungeonEvent 가 title 과 description 만 갖고 있어서 선택 패널이 보여줄
것을 담을 자리가 없었다. 인터페이스 문서는 선택 전에 행동 대상, 예상
이득, 알려진 위험을 확인할 수 있어야 한다고 정해 뒀다.

R4 의 완료 기준에 "각 이벤트가 선택지를 1개 이상 가짐"이 이미 적혀
있으므로 어차피 필요한 타입이고 모양이 확실하다. 그래서 화면 지역
타입이 아니라 도메인에 넣는다.

choices 를 필수 필드로 만들었다. 선택지 없는 이벤트는 플레이어가
결정할 것이 없는 이벤트이므로 타입 수준에서 막는다. 그 결과
__checks__.ts 의 sampleEvent 가 깨졌고 함께 고쳤다.

DungeonNode.nextNodeIds 의 주석도 고쳤다. "빈 배열이면 보스전 직전"이
DungeonState.bossNodeId 와 겹쳐 두 가지로 읽혔다. 보스방 자신이 빈
배열을 갖는다는 뜻으로 명확히 했다. bossFight 단계에서 currentNodeId 가
보스방을 가리켜야 하므로 보스방은 nodes 의 원소다.
MSG
```

---

## Task 3: 목 데이터와 무결성 검사

**Files:**
- Create: `lib/mock/classes.ts`
- Create: `lib/mock/cards.ts`
- Create: `lib/mock/events.ts`
- Create: `lib/mock/party.ts`
- Create: `lib/mock/dungeon.ts`
- Create: `lib/mock/run.ts`
- Create: `lib/mock/index.ts`
- Test: `lib/mock/mock.test.ts`

**Interfaces:**
- Consumes: Task 2의 `EventChoice`, `ChoiceId`, `DungeonEvent.choices`.
- Produces: `@/lib/mock`이 다음을 내보낸다.
  - `MOCK_CLASSES: ClassDef[]` — 5개
  - `MOCK_CARDS: InfoCard[]` — 3장
  - `MOCK_EVENTS: DungeonEvent[]` — 7개
  - `MOCK_PARTY: PartyMember[]` — 4명
  - `MOCK_DUNGEON: DungeonState` — 노드 7개
  - `MOCK_RUN: RunState` — 완전한 한 판
  - `findEvent(eventId: EventId): DungeonEvent` — 없으면 예외
  - `findNode(nodeId: string): DungeonNode | undefined`

- [ ] **Step 1: 무결성 검사를 먼저 쓴다**

`lib/mock/mock.test.ts`를 만든다. 아직 `lib/mock`의 다른 파일이 없으므로 이 테스트는 실패한다.

```ts
import { describe, expect, it } from "vitest";
import {
  EVENT_KINDS,
  PARTY_SIZE_MAX,
  PARTY_SIZE_MIN,
  TRUST_MAX,
  TRUST_MIN,
} from "@/lib/domain";
import {
  MOCK_CARDS,
  MOCK_CLASSES,
  MOCK_DUNGEON,
  MOCK_EVENTS,
  MOCK_PARTY,
  MOCK_RUN,
} from "@/lib/mock";

const nodeById = new Map(MOCK_DUNGEON.nodes.map((node) => [node.id, node]));

/** 입구에서 너비 우선으로 닿을 수 있는 노드 집합이다. */
function reachableFromEntry(): Set<string> {
  const seen = new Set<string>([MOCK_DUNGEON.entryNodeId]);
  const queue: string[] = [MOCK_DUNGEON.entryNodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const next of nodeById.get(current)?.nextNodeIds ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

describe("파티 목", () => {
  it("파티 인원이 정해진 범위 안이다", () => {
    expect(MOCK_PARTY.length).toBeGreaterThanOrEqual(PARTY_SIZE_MIN);
    expect(MOCK_PARTY.length).toBeLessThanOrEqual(PARTY_SIZE_MAX);
  });

  it("모든 신뢰가 정해진 범위 안이다", () => {
    const outOfRange = MOCK_PARTY.filter(
      (member) => member.trust < TRUST_MIN || member.trust > TRUST_MAX,
    ).map((member) => `${member.name}: ${member.trust}`);
    expect(outOfRange, "범위를 벗어난 신뢰").toEqual([]);
  });

  it("성격이 서로 다른 파티원이 둘 이상 있다", () => {
    const personalities = new Set(
      MOCK_PARTY.map((member) => member.personality),
    );
    expect(personalities.size).toBeGreaterThan(1);
  });

  it("모든 classId가 직업 목록에 있다", () => {
    const known = new Set(MOCK_CLASSES.map((klass) => klass.id));
    const missing = MOCK_PARTY.filter(
      (member) => !known.has(member.classId),
    ).map((member) => `${member.name}: ${member.classId}`);
    expect(missing, "직업 목록에 없는 classId").toEqual([]);
  });

  it("파티원 id가 중복되지 않는다", () => {
    expect(new Set(MOCK_PARTY.map((member) => member.id)).size).toBe(
      MOCK_PARTY.length,
    );
  });
});

describe("이벤트 목", () => {
  it("모든 이벤트가 선택지를 하나 이상 가진다", () => {
    const empty = MOCK_EVENTS.filter(
      (event) => event.choices.length === 0,
    ).map((event) => event.id);
    expect(empty, "선택지가 없는 이벤트").toEqual([]);
  });

  it("모든 선택지에 예상 이득과 알려진 위험이 있다", () => {
    const incomplete: string[] = [];
    for (const event of MOCK_EVENTS) {
      for (const choice of event.choices) {
        if (choice.expectedGain === "" || choice.knownRisk === "") {
          incomplete.push(`${event.id} / ${choice.id}`);
        }
      }
    }
    expect(incomplete, "이득이나 위험이 빈 선택지").toEqual([]);
  });

  it("네 가지 이벤트 분류가 모두 등장한다", () => {
    const used = new Set(MOCK_EVENTS.map((event) => event.kind));
    const unused = EVENT_KINDS.filter((kind) => !used.has(kind));
    expect(unused, "목에 등장하지 않는 이벤트 분류").toEqual([]);
  });

  it("이벤트 id와 선택지 id가 중복되지 않는다", () => {
    expect(new Set(MOCK_EVENTS.map((event) => event.id)).size).toBe(
      MOCK_EVENTS.length,
    );
    const choiceIds = MOCK_EVENTS.flatMap((event) =>
      event.choices.map((choice) => choice.id),
    );
    expect(new Set(choiceIds).size).toBe(choiceIds.length);
  });

  it("선택지의 대상 파티원이 파티에 있다", () => {
    const known = new Set(MOCK_PARTY.map((member) => member.id));
    const unknown: string[] = [];
    for (const event of MOCK_EVENTS) {
      for (const choice of event.choices) {
        if (choice.target?.kind === "member" && !known.has(choice.target.id)) {
          unknown.push(`${choice.id} → ${choice.target.id}`);
        }
      }
    }
    expect(unknown, "파티에 없는 대상").toEqual([]);
  });
});

describe("던전 지도 목", () => {
  it("입구와 보스방과 현재 위치가 노드 목록에 있다", () => {
    expect(nodeById.has(MOCK_DUNGEON.entryNodeId), "입구").toBe(true);
    expect(nodeById.has(MOCK_DUNGEON.bossNodeId), "보스방").toBe(true);
    expect(nodeById.has(MOCK_RUN.currentNodeId), "현재 위치").toBe(true);
  });

  it("모든 eventId가 이벤트 목록에 있다", () => {
    const known = new Set(MOCK_EVENTS.map((event) => event.id));
    const missing = MOCK_DUNGEON.nodes
      .filter((node) => !known.has(node.eventId))
      .map((node) => `${node.id}: ${node.eventId}`);
    expect(missing, "이벤트 목록에 없는 eventId").toEqual([]);
  });

  it("모든 간선이 존재하는 노드를 가리킨다", () => {
    const dangling: string[] = [];
    for (const node of MOCK_DUNGEON.nodes) {
      for (const next of node.nextNodeIds) {
        if (!nodeById.has(next)) dangling.push(`${node.id} → ${next}`);
      }
    }
    expect(dangling, "없는 노드를 가리키는 간선").toEqual([]);
  });

  it("입구에서 보스방까지 갈 수 있다", () => {
    expect(reachableFromEntry().has(MOCK_DUNGEON.bossNodeId)).toBe(true);
  });

  it("입구에서 닿지 않는 노드가 없다", () => {
    const reachable = reachableFromEntry();
    const orphans = MOCK_DUNGEON.nodes
      .filter((node) => !reachable.has(node.id))
      .map((node) => node.id);
    expect(orphans, "입구에서 닿지 않는 노드").toEqual([]);
  });

  it("모든 간선이 depth를 늘린다", () => {
    const backwards: string[] = [];
    for (const node of MOCK_DUNGEON.nodes) {
      for (const next of node.nextNodeIds) {
        const target = nodeById.get(next);
        if (target !== undefined && target.depth <= node.depth) {
          backwards.push(
            `${node.id}(${node.depth}) → ${next}(${target.depth})`,
          );
        }
      }
    }
    expect(backwards, "depth를 늘리지 않는 간선").toEqual([]);
  });

  it("막다른 길은 보스방 하나뿐이다", () => {
    const deadEnds = MOCK_DUNGEON.nodes
      .filter((node) => node.nextNodeIds.length === 0)
      .map((node) => node.id);
    expect(deadEnds).toEqual([MOCK_DUNGEON.bossNodeId]);
  });

  it("갈라지는 노드와 합쳐지는 노드가 모두 있다", () => {
    const branching = MOCK_DUNGEON.nodes.filter(
      (node) => node.nextNodeIds.length > 1,
    );
    const inDegree = new Map<string, number>();
    for (const node of MOCK_DUNGEON.nodes) {
      for (const next of node.nextNodeIds) {
        inDegree.set(next, (inDegree.get(next) ?? 0) + 1);
      }
    }
    const merging = [...inDegree.values()].filter((count) => count > 1);

    expect(branching.length, "갈라지는 노드 수").toBeGreaterThan(0);
    expect(merging.length, "합쳐지는 노드 수").toBeGreaterThan(0);
  });
});

describe("런 상태 목", () => {
  it("시드가 비어 있지 않다", () => {
    expect(MOCK_RUN.seed).not.toBe("");
  });

  it("파티와 던전이 다른 목과 같은 것을 가리킨다", () => {
    expect(MOCK_RUN.party).toBe(MOCK_PARTY);
    expect(MOCK_RUN.dungeon).toBe(MOCK_DUNGEON);
  });

  it("미검증 정보의 cardId가 카드 목록에 있다", () => {
    const known = new Set(MOCK_CARDS.map((card) => card.id));
    const missing = MOCK_RUN.pendingClaims
      .filter((claim) => !known.has(claim.cardId))
      .map((claim) => `${claim.id}: ${claim.cardId}`);
    expect(missing, "카드 목록에 없는 cardId").toEqual([]);
  });

  it("미검증 정보의 대상 파티원이 파티에 있다", () => {
    const known = new Set(MOCK_PARTY.map((member) => member.id));
    const unknown = MOCK_RUN.pendingClaims
      .filter(
        (claim) =>
          claim.target.kind === "member" && !known.has(claim.target.id),
      )
      .map((claim) => claim.id);
    expect(unknown, "파티에 없는 대상").toEqual([]);
  });

  it("로그의 at이 0부터 1씩 늘어난다", () => {
    expect(MOCK_RUN.log.map((record) => record.at)).toEqual(
      MOCK_RUN.log.map((_, index) => index),
    );
  });

  it("로그의 nodeId와 신뢰 변화 대상이 모두 존재한다", () => {
    const knownMembers = new Set(MOCK_PARTY.map((member) => member.id));
    const problems: string[] = [];
    for (const record of MOCK_RUN.log) {
      if (!nodeById.has(record.nodeId)) {
        problems.push(`at ${record.at}: 없는 노드 ${record.nodeId}`);
      }
      for (const change of record.trustChanges) {
        if (!knownMembers.has(change.memberId)) {
          problems.push(`at ${record.at}: 없는 파티원 ${change.memberId}`);
        }
        if (change.reason === "") {
          problems.push(`at ${record.at}: 사유가 빈 신뢰 변화`);
        }
      }
    }
    expect(problems, "로그의 문제").toEqual([]);
  });

  it("카드가 진실·거짓·중립을 모두 담는다", () => {
    const types = new Set(MOCK_CARDS.map((card) => card.truthType));
    expect([...types].sort()).toEqual(["lie", "neutral", "truth"]);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run:
```bash
pnpm test 2>&1 | tail -20
```
Expected: FAIL. `@/lib/mock`을 해석할 수 없다는 오류. 아직 만들지 않았기 때문이다.

- [ ] **Step 3: `lib/mock/classes.ts`를 만든다**

```ts
import type { ClassDef, ClassId } from "@/lib/domain";

/**
 * 직업은 열린 목록이므로 콘텐츠 데이터다. Q1 콘텐츠 채우기가 이 파일을
 * 실제 데이터 파일로 옮긴다.
 */
export const MOCK_CLASSES: ClassDef[] = [
  {
    id: "c-warrior" as ClassId,
    name: "전사",
    description: "앞에서 버티며 파티의 피해를 받아낸다.",
  },
  {
    id: "c-cleric" as ClassId,
    name: "성직자",
    description: "치유를 맡고 파티의 규율을 따진다.",
  },
  {
    id: "c-rogue" as ClassId,
    name: "도적",
    description: "잠금과 함정을 다루고 자기 몫을 챈다.",
  },
  {
    id: "c-mage" as ClassId,
    name: "마법사",
    description: "화력을 내지만 오래 버티지 못한다.",
  },
  {
    id: "c-ranger" as ClassId,
    name: "궁수",
    description: "거리를 두고 길과 흔적을 읽는다.",
  },
];
```

- [ ] **Step 4: `lib/mock/party.ts`를 만든다**

```ts
import type { ClassId, MemberId, PartyMember } from "@/lib/domain";

/** 성격 넷이 서로 다르다. 신뢰도 서로 다르게 벌려 두었다. */
export const MOCK_PARTY: PartyMember[] = [
  {
    id: "m-garon" as MemberId,
    name: "가론",
    classId: "c-warrior" as ClassId,
    personality: "impulsive",
    trust: 72,
    alive: true,
  },
  {
    id: "m-rien" as MemberId,
    name: "리엔",
    classId: "c-cleric" as ClassId,
    personality: "righteous",
    trust: 41,
    alive: true,
  },
  {
    id: "m-beka" as MemberId,
    name: "베카",
    classId: "c-rogue" as ClassId,
    personality: "greedy",
    trust: 58,
    alive: true,
  },
  {
    id: "m-is" as MemberId,
    name: "이스",
    classId: "c-mage" as ClassId,
    personality: "suspicious",
    trust: 30,
    alive: true,
  },
];
```

- [ ] **Step 5: `lib/mock/cards.ts`를 만든다**

```ts
import type { CardId, InfoCard } from "@/lib/domain";

/** 진실·거짓·중립 셋이 모두 있다. 선택 패널이 세 유형을 보여줘야 한다. */
export const MOCK_CARDS: InfoCard[] = [
  {
    id: "card-boss-weakness" as CardId,
    truthType: "truth",
    topic: "보스 약점",
    text: "리치의 관은 옥좌 뒤에 있다. 관을 깨면 되살아나지 못한다.",
  },
  {
    id: "card-empty-path" as CardId,
    truthType: "lie",
    topic: "앞길의 위험",
    text: "왼쪽 길은 비어 있다. 아무것도 없으니 지름길로 쓸 수 있다.",
  },
  {
    id: "card-merchant-rumor" as CardId,
    truthType: "neutral",
    topic: "던전 소문",
    text: "이 층에서 상인을 봤다는 말이 있다. 사실인지는 모른다.",
  },
];
```

- [ ] **Step 6: `lib/mock/events.ts`를 만든다**

이벤트 7개다. 네 분류가 모두 나오고 각 이벤트가 선택지를 둘 이상 가진다. `target`이 있는 선택지와 없는 선택지를 섞는다.

```ts
import type { ChoiceId, DungeonEvent, EventId, MemberId } from "@/lib/domain";

export const MOCK_EVENTS: DungeonEvent[] = [
  {
    id: "e-entry" as EventId,
    kind: "rest",
    title: "던전 입구의 마지막 점검",
    description:
      "파티가 장비를 다시 묶는다. 리엔이 이 층의 소문을 당신에게 묻는다.",
    choices: [
      {
        id: "ch-entry-tell" as ChoiceId,
        label: "아는 대로 말한다",
        target: { kind: "member", id: "m-rien" as MemberId },
        expectedGain: "리엔의 신뢰를 얻는다",
        knownRisk: "정보를 나중에 팔 기회를 잃는다",
      },
      {
        id: "ch-entry-hide" as ChoiceId,
        label: "아는 것이 없다고 한다",
        expectedGain: "정보를 나중에 쓸 수 있다",
        knownRisk: "길잡이로서 무능해 보인다",
      },
    ],
  },
  {
    id: "e-a1" as EventId,
    kind: "monster",
    title: "고블린 정찰대",
    description:
      "좁은 길에서 고블린 셋이 튀어나온다. 가론이 먼저 뛰어들었다.",
    choices: [
      {
        id: "ch-a1-support" as ChoiceId,
        label: "고블린의 약점을 알려준다",
        target: { kind: "member", id: "m-garon" as MemberId },
        expectedGain: "가론의 신뢰를 얻고 피해를 줄인다",
        knownRisk: "던전 쪽 정보원을 잃는다",
      },
      {
        id: "ch-a1-betray" as ChoiceId,
        label: "고블린에게 파티의 대형을 넘긴다",
        target: { kind: "boss" },
        expectedGain: "보스와의 관계가 좋아진다",
        knownRisk: "발각되면 처형",
      },
      {
        id: "ch-a1-watch" as ChoiceId,
        label: "관망한다",
        expectedGain: "관계 변화를 줄인다",
        knownRisk: "양쪽 모두 당신을 셈에 넣지 않게 된다",
      },
    ],
  },
  {
    id: "e-a2" as EventId,
    kind: "merchant",
    title: "그림자 상인",
    description:
      "후드를 쓴 상인이 좌판을 펼친다. 독과 가짜 지도를 함께 팔고 있다.",
    choices: [
      {
        id: "ch-a2-buy-map" as ChoiceId,
        label: "가짜 지도를 산다",
        expectedGain: "나중에 파티를 원하는 길로 유도할 수 있다",
        knownRisk: "사례금 6을 쓴다",
      },
      {
        id: "ch-a2-buy-info" as ChoiceId,
        label: "보스에 관한 정보를 산다",
        expectedGain: "보스전에서 쓸 진실 카드를 얻는다",
        knownRisk: "사례금 8을 쓴다",
      },
      {
        id: "ch-a2-sell" as ChoiceId,
        label: "파티의 사정을 상인에게 판다",
        expectedGain: "사례금을 얻는다",
        knownRisk: "베카가 거래를 목격할 수 있다",
      },
    ],
  },
  {
    id: "e-a3" as EventId,
    kind: "special",
    title: "보스의 밀사",
    description:
      "복면을 쓴 자가 당신만 따로 부른다. 옥좌까지 파티를 데려오면 몫을 주겠다고 한다.",
    choices: [
      {
        id: "ch-a3-accept" as ChoiceId,
        label: "계약을 받아들인다",
        target: { kind: "boss" },
        expectedGain: "보스전 뒤 큰 보수를 약속받는다",
        knownRisk: "파티가 전멸하면 명성을 잃는다",
      },
      {
        id: "ch-a3-report" as ChoiceId,
        label: "파티에 알린다",
        target: { kind: "member", id: "m-is" as MemberId },
        expectedGain: "이스의 신뢰를 크게 얻는다",
        knownRisk: "보스가 당신을 적으로 셈한다",
      },
    ],
  },
  {
    id: "e-b1" as EventId,
    kind: "monster",
    title: "무너진 다리의 파수꾼",
    description: "돌로 된 파수꾼이 다리를 막고 있다. 우회로는 좁고 어둡다.",
    choices: [
      {
        id: "ch-b1-fight" as ChoiceId,
        label: "정면으로 붙게 한다",
        expectedGain: "시간을 아낀다",
        knownRisk: "누군가 크게 다칠 수 있다",
      },
      {
        id: "ch-b1-detour" as ChoiceId,
        label: "우회로로 안내한다",
        target: { kind: "member", id: "m-beka" as MemberId },
        expectedGain: "베카가 함정을 미리 걷어낸다",
        knownRisk: "식량을 더 쓴다",
      },
    ],
  },
  {
    id: "e-b2" as EventId,
    kind: "rest",
    title: "젖은 야영지",
    description:
      "물이 새는 방에서 파티가 잠깐 눕는다. 가론이 먼저 잠들었다.",
    choices: [
      {
        id: "ch-b2-food" as ChoiceId,
        label: "식량을 나눈다",
        expectedGain: "모두의 신뢰를 조금씩 얻는다",
        knownRisk: "식량 2를 쓴다",
      },
      {
        id: "ch-b2-steal" as ChoiceId,
        label: "가론의 짐을 뒤진다",
        target: { kind: "member", id: "m-garon" as MemberId },
        expectedGain: "유품이 될 물건을 미리 챈다",
        knownRisk: "깨면 신뢰가 크게 떨어진다",
      },
      {
        id: "ch-b2-listen" as ChoiceId,
        label: "파티원끼리 하는 말을 듣는다",
        expectedGain: "누가 누구를 의심하는지 알게 된다",
        knownRisk: "쉬지 못해 다음 전투가 불리해진다",
      },
    ],
  },
  {
    id: "e-boss" as EventId,
    kind: "monster",
    title: "리치의 옥좌",
    description:
      "옥좌 뒤에 관이 놓여 있다. 리치가 당신을 알아보고 눈길을 준다.",
    choices: [
      {
        id: "ch-boss-help-heroes" as ChoiceId,
        label: "관의 위치를 알려준다",
        target: { kind: "member", id: "m-rien" as MemberId },
        expectedGain: "파티가 리치를 끝낼 수 있다",
        knownRisk: "보스와 맺은 것이 있다면 모두 깨진다",
      },
      {
        id: "ch-boss-help-boss" as ChoiceId,
        label: "파티의 남은 힘을 리치에게 알린다",
        target: { kind: "boss" },
        expectedGain: "리치가 약속한 몫을 받는다",
        knownRisk: "생존자가 있으면 처형된다",
      },
      {
        id: "ch-boss-watch" as ChoiceId,
        label: "끝까지 지켜본다",
        expectedGain: "어느 쪽과도 등지지 않는다",
        knownRisk: "이긴 쪽이 당신에게 줄 것이 없다",
      },
    ],
  },
];
```

- [ ] **Step 7: `lib/mock/dungeon.ts`를 만든다**

```ts
import type { DungeonNode, DungeonState, EventId, NodeId } from "@/lib/domain";

/** 캐스트를 한곳에 모으는 도우미다. 브랜드 ID 생성 함수는 아직 없다. */
function node(
  id: string,
  depth: number,
  eventId: string,
  nextNodeIds: string[],
): DungeonNode {
  return {
    id: id as NodeId,
    depth,
    eventId: eventId as EventId,
    nextNodeIds: nextNodeIds.map((next) => next as NodeId),
  };
}

/**
 * 입구는 한 곳이며 depth 0이다. 아래에서 위로 올라가고 어떤 경로도
 * 보스방으로 모인다. 갈라지기만 하지 않고 다시 합쳐진다. 합류가 없는
 * 목을 주면 U3 지도가 합류를 그릴 수 있는지 확인할 수 없다.
 *
 * n-a2가 두 곳으로 갈라지고, n-b1은 n-a1·n-a2에서, n-b2는 n-a2·n-a3에서
 * 합류한다. 노드 7개, 간선 9개다.
 */
export const MOCK_DUNGEON: DungeonState = {
  entryNodeId: "n-entry" as NodeId,
  bossNodeId: "n-boss" as NodeId,
  nodes: [
    node("n-entry", 0, "e-entry", ["n-a1", "n-a2", "n-a3"]),
    node("n-a1", 1, "e-a1", ["n-b1"]),
    node("n-a2", 1, "e-a2", ["n-b1", "n-b2"]),
    node("n-a3", 1, "e-a3", ["n-b2"]),
    node("n-b1", 2, "e-b1", ["n-boss"]),
    node("n-b2", 2, "e-b2", ["n-boss"]),
    node("n-boss", 3, "e-boss", []),
  ],
};
```

- [ ] **Step 8: `lib/mock/run.ts`를 만든다**

```ts
import type {
  CardId,
  ClaimId,
  DecisionRecord,
  InfoClaim,
  MemberId,
  NodeId,
  RunState,
} from "@/lib/domain";
import { MOCK_DUNGEON } from "./dungeon";
import { MOCK_PARTY } from "./party";

/** 이미 건넨 정보다. 아직 사실 여부가 드러나지 않았다. */
const MOCK_CLAIMS: InfoClaim[] = [
  {
    id: "claim-empty-path" as ClaimId,
    cardId: "card-empty-path" as CardId,
    target: { kind: "member", id: "m-is" as MemberId },
    toldAt: 1,
  },
];

/** at은 0부터 1씩 늘어나는 로그 순번이다. 시각이 아니다. */
const MOCK_LOG: DecisionRecord[] = [
  {
    at: 0,
    nodeId: "n-entry" as NodeId,
    summary: "리엔에게 이 층의 소문을 사실대로 말했다.",
    trustChanges: [
      {
        memberId: "m-rien" as MemberId,
        delta: 4,
        reason: "정의로운 성격: 숨기지 않은 답변",
      },
    ],
  },
  {
    at: 1,
    nodeId: "n-a2" as NodeId,
    summary: "이스에게 왼쪽 길이 비어 있다고 말했다.",
    trustChanges: [
      {
        memberId: "m-is" as MemberId,
        delta: -6,
        reason: "의심 많은 성격: 근거를 물었으나 답하지 못함",
      },
    ],
  },
];

/**
 * 화면이 읽는 단일 출처다. F2 상태 스토어와 P1 상태 머신이 붙으면
 * app/** 의 import만 바뀌고 컴포넌트는 고치지 않는다.
 */
export const MOCK_RUN: RunState = {
  seed: "mock-shell-0001",
  phase: "event",
  party: MOCK_PARTY,
  dungeon: MOCK_DUNGEON,
  currentNodeId: "n-a2" as NodeId,
  resources: { gold: 12, food: 4, reputation: 7 },
  pendingClaims: MOCK_CLAIMS,
  log: MOCK_LOG,
};
```

- [ ] **Step 9: `lib/mock/index.ts`를 만든다**

조회 도우미 둘을 함께 둔다. 화면이 `eventId`로 이벤트를 찾아야 하고, 동적 라우트가 문자열 `nodeId`로 노드를 찾아야 한다.

```ts
import type { DungeonEvent, DungeonNode, EventId } from "@/lib/domain";
import { MOCK_DUNGEON } from "./dungeon";
import { MOCK_EVENTS } from "./events";

export { MOCK_CARDS } from "./cards";
export { MOCK_CLASSES } from "./classes";
export { MOCK_DUNGEON } from "./dungeon";
export { MOCK_EVENTS } from "./events";
export { MOCK_PARTY } from "./party";
export { MOCK_RUN } from "./run";

/**
 * 없으면 예외를 던진다. 목 무결성 검사가 모든 eventId의 존재를
 * 확인하므로, 여기서 없다면 목이 깨졌다는 뜻이다.
 */
export function findEvent(eventId: EventId): DungeonEvent {
  const found = MOCK_EVENTS.find((event) => event.id === eventId);
  if (found === undefined) {
    throw new Error(`목 이벤트를 찾을 수 없다: ${eventId}`);
  }
  return found;
}

/** URL에서 온 문자열로 찾는다. 없을 수 있으므로 undefined를 반환한다. */
export function findNode(nodeId: string): DungeonNode | undefined {
  return MOCK_DUNGEON.nodes.find((node) => node.id === nodeId);
}
```

- [ ] **Step 10: 테스트를 돌려 통과를 확인한다**

Run:
```bash
pnpm test 2>&1 | tail -10
```
Expected: PASS. 기존 5개 + 새 목 검사가 모두 통과한다.

- [ ] **Step 11: 검사가 실제로 잡는지 확인한다**

통과만 보고 믿을 수 없다. 목을 일부러 망가뜨려 검사가 잡는지 본다. 셋을 시험한다.

Run:
```bash
cp lib/mock/dungeon.ts /tmp/dungeon.bak

# 1. 합류를 없앤다
sed -i 's/node("n-a2", 1, "e-a2", \["n-b1", "n-b2"\])/node("n-a2", 1, "e-a2", ["n-b1"])/' lib/mock/dungeon.ts
pnpm test 2>&1 | grep -E "×|Tests  " | head -5
cp /tmp/dungeon.bak lib/mock/dungeon.ts

# 2. depth를 거꾸로 만든다
sed -i 's/node("n-b1", 2, "e-b1", \["n-boss"\])/node("n-b1", 2, "e-b1", ["n-a1"])/' lib/mock/dungeon.ts
pnpm test 2>&1 | grep -E "×|Tests  " | head -5
cp /tmp/dungeon.bak lib/mock/dungeon.ts

# 3. 고아 노드를 만든다
sed -i 's/node("n-entry", 0, "e-entry", \["n-a1", "n-a2", "n-a3"\])/node("n-entry", 0, "e-entry", ["n-a1", "n-a2"])/' lib/mock/dungeon.ts
pnpm test 2>&1 | grep -E "×|Tests  " | head -5
cp /tmp/dungeon.bak lib/mock/dungeon.ts

git diff --stat lib/mock/dungeon.ts
```
Expected:
1. `갈라지는 노드와 합쳐지는 노드가 모두 있다` 실패
2. `모든 간선이 depth를 늘린다` 실패
3. `입구에서 닿지 않는 노드가 없다` 실패

마지막 `git diff --stat`은 아무것도 출력하지 않아야 한다. 출력이 있으면 복원이 안 된 것이므로 `cp /tmp/dungeon.bak lib/mock/dungeon.ts`를 다시 실행한다.

- [ ] **Step 12: 검증 명령을 돌린다**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Expected: 넷 다 통과.

`components/**`가 `@/lib/mock`을 가져오지 않는 규칙이 있으므로, `lib/mock`은 아직 어디에서도 쓰이지 않는다. `pnpm build`는 여전히 `/`만 보여준다. 정상이다.

- [ ] **Step 13: 커밋한다**

```bash
git add lib/mock
git commit -F - <<'MSG'
기능: 화면 셸이 쓸 목 데이터와 무결성 검사

RunState 하나를 통째로 만든다. 화면은 그 안에서 필요한 부분만 읽으므로
F2 와 P1 이 붙을 때 데이터의 출처만 바뀌고 JSX 는 고치지 않는다.

목이 그럴듯한 값이 아니라 실제로 쓸 수 있는 값인지 검사한다. 파티
인원과 신뢰가 도메인 상수의 범위 안인지, 모든 참조가 끊기지 않았는지,
입구에서 보스방까지 실제로 갈 수 있는지, 고아 노드가 없는지, 모든
간선이 depth 를 늘리는지, 막다른 길이 보스방 하나뿐인지 본다.

지도는 갈라지기만 하지 않고 다시 합쳐진다. 합류가 없는 목을 주면 U3
지도가 합류를 그릴 수 있는지 아무도 확인하지 못한다. 그래서 합류의
존재 자체를 검사 항목으로 넣었다.

모든 간선이 depth 를 늘린다는 검사가 "되돌아가지 않는다"를 구조로
보장한다. 이 성질이 있으면 순환 검사가 따로 필요 없다.

목을 세 가지로 일부러 망가뜨려 검사가 실제로 잡는지 확인했다. 합류
없애기, depth 거꾸로 만들기, 고아 노드 만들기. 셋 모두 의도한 검사에서
실패했다.
MSG
```

---

## Task 4: 게임 셸과 파티 소개 화면

**Files:**
- Create: `components/game/labels.ts`
- Test: `components/game/labels.test.ts`
- Create: `components/game/TrustRow.tsx`
- Create: `components/game/PartySidebar.tsx`
- Create: `components/game/ResourceBar.tsx`
- Create: `app/play/layout.tsx`
- Create: `app/play/page.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `Panel`·`StatValue`와 토큰. Task 3의 `MOCK_RUN`·`MOCK_CLASSES`·`findEvent`.
- Produces:
  - `PHASE_LABELS: Record<RunPhase, string>`
  - `PERSONALITY_LABELS: Record<Personality, string>`
  - `EVENT_KIND_LABELS: Record<EventKind, string>`
  - `EVENT_KIND_MARKS: Record<EventKind, string>` — 색 외의 단서
  - `TRUTH_TYPE_LABELS: Record<TruthType, string>`
  - `TRUST_UNIT: string` — 신뢰 표기의 단위 문자열
  - `TrustRow({ member: PartyMember, classLabel: string, change?: { delta: number; reason: string } })`
  - `PartySidebar({ party: PartyMember[], classes: ClassDef[], latestChanges: TrustChange[], className?: string })`
  - `ResourceBar({ resources: Resources, phase: RunPhase, depth: number, className?: string })`

- [ ] **Step 1: 라벨 검사를 먼저 쓴다**

`components/game/labels.test.ts`를 만든다. `Record<유니온, string>`이 컴파일 시점에 누락을 잡지만, 값이 빈 문자열인 경우와 기호가 서로 겹치는 경우는 잡지 못한다.

```ts
import { describe, expect, it } from "vitest";
import {
  EVENT_KINDS,
  PERSONALITIES,
  RUN_PHASES,
  TRUTH_TYPES,
} from "@/lib/domain";
import {
  EVENT_KIND_LABELS,
  EVENT_KIND_MARKS,
  PERSONALITY_LABELS,
  PHASE_LABELS,
  TRUTH_TYPE_LABELS,
} from "@/components/game/labels";

describe("라벨이 모든 값을 덮는다", () => {
  it("빈 라벨이 없다", () => {
    const empty: string[] = [];
    for (const phase of RUN_PHASES) {
      if (PHASE_LABELS[phase] === "") empty.push(`phase ${phase}`);
    }
    for (const personality of PERSONALITIES) {
      if (PERSONALITY_LABELS[personality] === "") {
        empty.push(`personality ${personality}`);
      }
    }
    for (const kind of EVENT_KINDS) {
      if (EVENT_KIND_LABELS[kind] === "") empty.push(`kind ${kind}`);
      if (EVENT_KIND_MARKS[kind] === "") empty.push(`mark ${kind}`);
    }
    for (const truthType of TRUTH_TYPES) {
      if (TRUTH_TYPE_LABELS[truthType] === "") {
        empty.push(`truthType ${truthType}`);
      }
    }
    expect(empty, "빈 라벨").toEqual([]);
  });

  it("이벤트 분류 기호가 서로 다르다", () => {
    const marks = EVENT_KINDS.map((kind) => EVENT_KIND_MARKS[kind]);
    expect(new Set(marks).size, "겹치는 기호가 있다").toBe(marks.length);
  });

  it("이벤트 분류 라벨이 서로 다르다", () => {
    const labels = EVENT_KINDS.map((kind) => EVENT_KIND_LABELS[kind]);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run:
```bash
pnpm test 2>&1 | tail -10
```
Expected: FAIL. `@/components/game/labels`를 해석할 수 없다.

- [ ] **Step 3: `components/game/labels.ts`를 만든다**

```ts
import type {
  EventKind,
  Personality,
  RunPhase,
  TruthType,
} from "@/lib/domain";

/**
 * 도메인 유니온을 화면에 쓰는 한국어 표기로 옮긴다.
 *
 * Record<유니온, string>으로 선언한 이유는 유니온에 값이 추가될 때
 * 컴파일이 실패하게 만들기 위함이다. 라벨 없는 새 값이 화면에
 * 식별자로 그대로 나오는 일을 막는다.
 */
export const PHASE_LABELS: Record<RunPhase, string> = {
  partyIntro: "파티 소개",
  pathChoice: "경로 선택",
  event: "이벤트",
  bossFight: "보스전",
  settlement: "정산",
  ended: "종료",
};

export const PERSONALITY_LABELS: Record<Personality, string> = {
  suspicious: "의심 많음",
  righteous: "정의로움",
  greedy: "탐욕스러움",
  prudent: "신중함",
  impulsive: "충동적",
};

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  monster: "몬스터",
  rest: "휴식",
  merchant: "상인",
  special: "특수 사건",
};

/**
 * 색 외의 단서다. 이벤트 분류를 색으로만 구분하면 Q2 접근성 점검을
 * 통과하지 못한다. 기호는 서로 달라야 한다.
 */
export const EVENT_KIND_MARKS: Record<EventKind, string> = {
  monster: "◆",
  rest: "○",
  merchant: "◇",
  special: "★",
};

export const TRUTH_TYPE_LABELS: Record<TruthType, string> = {
  truth: "진실",
  lie: "거짓",
  neutral: "중립",
};

/** 신뢰 수치 뒤에 붙이지 않는다. 라벨로만 쓴다. */
export const TRUST_UNIT = "신뢰";
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run:
```bash
pnpm test 2>&1 | tail -8
```
Expected: PASS.

- [ ] **Step 5: `components/game/TrustRow.tsx`를 만든다**

```tsx
import type { PartyMember } from "@/lib/domain";
import { PERSONALITY_LABELS } from "./labels";

interface TrustChangeView {
  delta: number;
  reason: string;
}

interface TrustRowProps {
  member: PartyMember;
  /** 직업 이름이다. classId를 이름으로 옮긴 결과를 받는다. */
  classLabel: string;
  /** 가장 최근 신뢰 변화. 없으면 표시하지 않는다. */
  change?: TrustChangeView;
}

/**
 * 신뢰 변화를 색만으로 구분하지 않는다. 색, 삼각형 기호, 스크린
 * 리더용 텍스트 셋을 함께 쓴다.
 */
function TrustDelta({ delta, reason }: TrustChangeView) {
  const rising = delta >= 0;
  return (
    <p
      className={`mt-1 text-xs ${
        rising ? "text-trust-up" : "text-trust-down"
      }`}
    >
      <span aria-hidden="true">{rising ? "▲" : "▼"}</span>
      <span className="sr-only">{rising ? "신뢰 상승 " : "신뢰 하락 "}</span>
      {Math.abs(delta)} · {reason}
    </p>
  );
}

export function TrustRow({ member, classLabel, change }: TrustRowProps) {
  return (
    <li className="border-b border-edge py-2 last:border-b-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-parchment">
          {member.name}
          <span className="ml-1 text-xs text-muted">{classLabel}</span>
        </span>
        <span className="text-sm font-semibold tabular-nums text-parchment">
          {member.trust}
        </span>
      </div>
      <p className="text-xs text-muted">
        {PERSONALITY_LABELS[member.personality]}
        {member.alive ? "" : " · 사망"}
      </p>
      {change === undefined ? null : <TrustDelta {...change} />}
    </li>
  );
}
```

- [ ] **Step 6: `components/game/PartySidebar.tsx`를 만든다**

```tsx
import { Panel } from "@/components/ui/Panel";
import type { ClassDef, PartyMember, TrustChange } from "@/lib/domain";
import { TRUST_UNIT } from "./labels";
import { TrustRow } from "./TrustRow";

interface PartySidebarProps {
  party: PartyMember[];
  classes: ClassDef[];
  /** 가장 최근 결정이 만든 신뢰 변화다. 없으면 빈 배열을 넘긴다. */
  latestChanges: TrustChange[];
  className?: string;
}

/**
 * 화면 영역 ④다. 셸이 들고 있으므로 네 화면 모두에서 보인다.
 * 길을 고를 때도 누가 나를 얼마나 믿는지 보여야 한다.
 */
export function PartySidebar({
  party,
  classes,
  latestChanges,
  className,
}: PartySidebarProps) {
  const classNameById = new Map(
    classes.map((klass) => [klass.id, klass.name]),
  );
  const changeByMemberId = new Map(
    latestChanges.map((change) => [change.memberId, change]),
  );

  return (
    <Panel title={`파티와 개인 ${TRUST_UNIT}`} className={className}>
      <ul className="flex flex-col">
        {party.map((member) => {
          const change = changeByMemberId.get(member.id);
          return (
            <TrustRow
              key={member.id}
              member={member}
              classLabel={classNameById.get(member.classId) ?? "직업 미정"}
              change={
                change === undefined
                  ? undefined
                  : { delta: change.delta, reason: change.reason }
              }
            />
          );
        })}
      </ul>
    </Panel>
  );
}
```

- [ ] **Step 7: `components/game/ResourceBar.tsx`를 만든다**

```tsx
import { StatValue } from "@/components/ui/StatValue";
import type { Resources, RunPhase } from "@/lib/domain";
import { PHASE_LABELS } from "./labels";

interface ResourceBarProps {
  resources: Resources;
  phase: RunPhase;
  /** 현재 노드의 입구로부터의 거리다. 층 표기에 쓴다. */
  depth: number;
  className?: string;
}

/**
 * 화면 영역 ①이다. 현재 위치와 진행 단계, 핵심 자원을 담는다.
 * 인터페이스 문서가 즉시 보여줄 것으로 정한 항목들이다.
 */
export function ResourceBar({
  resources,
  phase,
  depth,
  className,
}: ResourceBarProps) {
  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded border border-edge bg-panel px-3 py-2${
        className === undefined ? "" : ` ${className}`
      }`}
    >
      <span className="text-sm font-semibold text-parchment">
        {depth + 1}층
      </span>
      <span className="text-xs text-muted">{PHASE_LABELS[phase]}</span>
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        <StatValue label="사례금" value={resources.gold} />
        <StatValue label="식량" value={resources.food} />
        <StatValue label="명성" value={resources.reputation} />
      </span>
    </div>
  );
}
```

- [ ] **Step 8: `app/play/layout.tsx`를 만든다**

```tsx
import type { ReactNode } from "react";
import { PartySidebar } from "@/components/game/PartySidebar";
import { ResourceBar } from "@/components/game/ResourceBar";
import { MOCK_CLASSES, MOCK_RUN, findNode } from "@/lib/mock";

/**
 * 게임 셸이다. 화면 영역 ①과 ④를 담고 네 화면이 이것을 공유한다.
 *
 * 목 데이터를 읽는 곳은 app/** 뿐이다. 컴포넌트에는 props로 넘긴다.
 * F2 상태 스토어와 P1 상태 머신이 붙으면 이 파일의 import만 바뀐다.
 */
export default function PlayLayout({ children }: { children: ReactNode }) {
  const currentDepth = findNode(MOCK_RUN.currentNodeId)?.depth ?? 0;
  const latestChanges = MOCK_RUN.log.at(-1)?.trustChanges ?? [];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-3 p-3">
      <ResourceBar
        resources={MOCK_RUN.resources}
        phase={MOCK_RUN.phase}
        depth={currentDepth}
      />
      <div className="flex flex-1 flex-col gap-3 lg:flex-row">
        <main className="flex flex-1 flex-col gap-3">{children}</main>
        <PartySidebar
          party={MOCK_RUN.party}
          classes={MOCK_CLASSES}
          latestChanges={latestChanges}
          className="lg:w-72 lg:shrink-0"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 9: `app/play/page.tsx`를 만든다**

파티 소개와 던전 입장 화면이다. `partyIntro` 단계가 여기에 해당한다.

```tsx
import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { PERSONALITY_LABELS } from "@/components/game/labels";
import { MOCK_CLASSES, MOCK_RUN, findEvent, findNode } from "@/lib/mock";

export default function PlayPage() {
  const entryNode = findNode(MOCK_RUN.dungeon.entryNodeId);
  const entryEvent =
    entryNode === undefined ? undefined : findEvent(entryNode.eventId);
  const classNameById = new Map(
    MOCK_CLASSES.map((klass) => [klass.id, klass.name]),
  );

  return (
    <>
      <Panel title="새 용사 파티">
        <p className="text-sm text-muted">
          파티가 당신을 길잡이로 고용했다. 각자 당신을 다르게 믿는다.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {MOCK_RUN.party.map((member) => (
            <li
              key={member.id}
              className="rounded border border-edge px-3 py-2"
            >
              <p className="text-sm text-parchment">
                {member.name}
                <span className="ml-1 text-xs text-muted">
                  {classNameById.get(member.classId) ?? "직업 미정"}
                </span>
              </p>
              <p className="text-xs text-muted">
                {PERSONALITY_LABELS[member.personality]} · 신뢰 {member.trust}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="던전 입장">
        {entryEvent === undefined ? (
          <p className="text-sm text-trust-down">입구 노드를 찾을 수 없다.</p>
        ) : (
          <>
            <h3 className="text-sm text-parchment">{entryEvent.title}</h3>
            <p className="mt-1 text-sm text-muted">{entryEvent.description}</p>
          </>
        )}
        <Link
          href="/play/map"
          className="mt-3 inline-block rounded border border-edge px-3 py-2 text-sm text-parchment hover:bg-edge"
        >
          던전에 들어간다
        </Link>
      </Panel>
    </>
  );
}
```

- [ ] **Step 10: `app/page.tsx`를 리다이렉트로 바꾼다**

파일 전체를 다음으로 교체한다. Hello World는 여기서 없어진다.

```tsx
import { redirect } from "next/navigation";

/**
 * 시작 화면을 둘지는 U5 온보딩이 정할 일이므로 지금 만들지 않는다.
 * 곧바로 플레이 화면으로 보낸다.
 */
export default function Home() {
  redirect("/play");
}
```

- [ ] **Step 11: 검증 명령을 돌린다**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Expected: 넷 다 통과. `pnpm build` 출력에 `/`와 `/play`가 나온다.

- [ ] **Step 12: 개발 서버로 눈으로 확인한다**

Run:
```bash
pnpm dev &
sleep 8
curl -s http://localhost:3000/play | grep -o "파티와 개인 신뢰\|사례금\|가론\|의심 많음\|던전에 들어간다" | sort -u
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
kill %1
```
Expected: `curl` 출력에 `가론`, `던전에 들어간다`, `사례금`, `의심 많음`, `파티와 개인 신뢰`가 모두 나온다. `/`는 `307`을 반환한다.

- [ ] **Step 13: 커밋한다**

```bash
git add components/game app/play app/page.tsx
git commit -F - <<'MSG'
기능: 게임 셸과 파티 소개 화면

app/play/layout.tsx 하나가 자원 바와 파티 사이드바를 들고 네 화면이
그것을 공유한다. 사이드바를 셸에 둔 결과로 U1 은 개별 화면 작업이
아니라 셸 작업이 된다. 길을 고를 때도 누가 나를 얼마나 믿는지 보인다.

컴포넌트는 목 데이터를 가져오지 않고 props 로 받는다. 목을 읽는 곳은
app/** 뿐이다. F2 와 P1 이 붙으면 layout 의 import 만 바뀐다.

labels.ts 가 도메인 유니온을 한국어 표기로 옮긴다. Record<유니온,
string> 으로 선언해 유니온에 값이 추가되면 컴파일이 실패하게 했다.
라벨 없는 새 값이 화면에 식별자로 그대로 나오는 일을 막는다.

이벤트 분류는 기호도 함께 정했다. 색으로만 구분하면 Q2 접근성 점검을
통과하지 못한다. 같은 이유로 신뢰 변화는 색, 삼각형 기호, 스크린
리더용 텍스트 셋을 함께 쓴다.

app/page.tsx 의 Hello World 를 /play 리다이렉트로 바꿨다. 시작 화면을
둘지는 U5 온보딩이 정할 일이므로 지금 만들지 않는다.
MSG
```

---

## Task 5: 던전 분기 지도 화면

**Files:**
- Create: `components/game/DungeonMap.tsx`
- Create: `app/play/map/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `Panel`, Task 3의 `MOCK_RUN`·`MOCK_EVENTS`, Task 4의 `EVENT_KIND_LABELS`·`EVENT_KIND_MARKS`.
- Produces: `DungeonMap({ dungeon: DungeonState, events: DungeonEvent[], currentNodeId: NodeId, visitedNodeIds: NodeId[] })`

- [ ] **Step 1: `components/game/DungeonMap.tsx`를 만든다**

`depth`로 행을 만들고 아래에서 위로 그린다. `depth`가 큰 행이 위에 온다.

```tsx
import Link from "next/link";
import type {
  DungeonEvent,
  DungeonState,
  EventId,
  NodeId,
} from "@/lib/domain";
import { EVENT_KIND_LABELS, EVENT_KIND_MARKS } from "./labels";

interface DungeonMapProps {
  dungeon: DungeonState;
  events: DungeonEvent[];
  currentNodeId: NodeId;
  /** 이미 지나온 지점이다. */
  visitedNodeIds: NodeId[];
}

/**
 * 화면 영역 ⑤다. 입구는 한 곳이며 맨 아래에 있고, 위로 갈라지며
 * 올라가 어떤 경로를 골라도 맨 위의 보스방으로 모인다.
 * depth가 세로 위치를 정한다.
 */
export function DungeonMap({
  dungeon,
  events,
  currentNodeId,
  visitedNodeIds,
}: DungeonMapProps) {
  const eventById = new Map<EventId, DungeonEvent>(
    events.map((event) => [event.id, event]),
  );
  const visited = new Set<string>(visitedNodeIds);

  // depth가 큰 행이 위에 온다. 아래에서 위로 진행하기 때문이다.
  const depths = [...new Set(dungeon.nodes.map((node) => node.depth))].sort(
    (a, b) => b - a,
  );

  return (
    <ol className="flex flex-col gap-3">
      {depths.map((depth) => (
        <li key={depth}>
          <div className="flex items-stretch justify-center gap-2">
            {dungeon.nodes
              .filter((node) => node.depth === depth)
              .map((node) => {
                const event = eventById.get(node.eventId);
                const isCurrent = node.id === currentNodeId;
                const isBoss = node.id === dungeon.bossNodeId;
                const isVisited = visited.has(node.id);

                return (
                  <Link
                    key={node.id}
                    href={`/play/node/${node.id}`}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`flex-1 rounded border px-2 py-2 text-center hover:bg-edge ${
                      isCurrent
                        ? "border-parchment bg-edge"
                        : "border-edge bg-panel"
                    } ${isVisited && !isCurrent ? "opacity-60" : ""}`}
                  >
                    <span className="block text-sm text-parchment">
                      <span aria-hidden="true">
                        {event === undefined
                          ? "?"
                          : EVENT_KIND_MARKS[event.kind]}
                      </span>{" "}
                      {isBoss ? "보스방" : (event?.title ?? node.id)}
                    </span>
                    <span className="block text-xs text-muted">
                      {event === undefined
                        ? "이벤트 없음"
                        : EVENT_KIND_LABELS[event.kind]}
                      {isCurrent ? " · 현재 위치" : ""}
                      {isVisited && !isCurrent ? " · 지나옴" : ""}
                    </span>
                  </Link>
                );
              })}
          </div>
          <p className="mt-1 text-center text-xs text-muted">
            깊이 {depth}
          </p>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 2: `app/play/map/page.tsx`를 만든다**

```tsx
import Link from "next/link";
import { DungeonMap } from "@/components/game/DungeonMap";
import { Panel } from "@/components/ui/Panel";
import { MOCK_EVENTS, MOCK_RUN } from "@/lib/mock";

export default function MapPage() {
  // 목 데이터에서는 로그에 남은 지점을 지나온 곳으로 본다.
  // P1 상태 머신이 붙으면 실제 경로를 들고 있게 된다.
  const visitedNodeIds = MOCK_RUN.log.map((record) => record.nodeId);

  return (
    <Panel
      title="던전 분기 지도"
      aside={
        <Link
          href="/play/result"
          className="text-xs text-muted underline hover:text-parchment"
        >
          결과 화면 보기
        </Link>
      }
    >
      <p className="mb-3 text-sm text-muted">
        입구는 맨 아래 한 곳이다. 어떤 길을 골라도 맨 위의 보스방으로 모인다.
        당신이 길을 고른다.
      </p>
      <DungeonMap
        dungeon={MOCK_RUN.dungeon}
        events={MOCK_EVENTS}
        currentNodeId={MOCK_RUN.currentNodeId}
        visitedNodeIds={visitedNodeIds}
      />
    </Panel>
  );
}
```

- [ ] **Step 3: 검증 명령을 돌린다**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Expected: 넷 다 통과. `pnpm build` 출력에 `/play/map`이 나온다.

- [ ] **Step 4: 지도가 아래에서 위로 그려지는지 확인한다**

Run:
```bash
pnpm dev &
sleep 8
curl -s http://localhost:3000/play/map | grep -o "깊이 [0-9]"
kill %1
```
Expected: `깊이 3`, `깊이 2`, `깊이 1`, `깊이 0` 순서로 나온다. HTML 순서가 위에서 아래이므로, `깊이 3`(보스방)이 먼저 나오면 보스방이 화면 맨 위에 있다는 뜻이다.

- [ ] **Step 5: 커밋한다**

```bash
git add components/game/DungeonMap.tsx app/play/map
git commit -F - <<'MSG'
기능: 던전 분기 지도 화면

화면 영역 ⑤ 다. 입구는 맨 아래 한 곳이고 위로 갈라지며 올라가
어떤 경로를 골라도 맨 위의 보스방으로 모인다. DungeonNode.depth 가
세로 위치를 정하며, depth 가 큰 행을 먼저 그려 아래에서 위로 진행하는
방향을 만든다.

이벤트 분류를 기호와 라벨로 함께 표시한다. 색만으로 구분하지 않는다.

현재 위치는 테두리 색과 aria-current="step" 과 "현재 위치" 텍스트 셋으로
표시한다. 지나온 지점은 흐리게 하고 "지나옴" 텍스트를 붙인다. 흐리기만
쓰면 알아볼 수 없다.

지나온 지점은 목에서 로그에 남은 노드로 판단한다. P1 상태 머신이
붙으면 실제 경로를 들고 있게 되므로 그때 갈아탄다.
MSG
```

---

## Task 6: 조우 화면

**Files:**
- Create: `components/game/SceneStage.tsx`
- Create: `components/game/ChoiceList.tsx`
- Create: `app/play/node/[nodeId]/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `Panel`, Task 3의 `MOCK_*`·`findEvent`·`findNode`, Task 4의 라벨.
- Produces:
  - `SceneStage({ party: PartyMember[], event: DungeonEvent, isBoss: boolean })`
  - `ChoiceList({ event: DungeonEvent, party: PartyMember[], cards: InfoCard[] })`

**주의:** Next.js 16에서 `params`는 Promise다. `await`해야 한다. `PageProps<'/route'>` 전역 도우미도 있지만 `next dev`·`next build`·`next typegen`이 만든 타입에 의존하므로, 빌드 산물 없이 `pnpm typecheck`만 돌려도 통과하도록 `params: Promise<{ nodeId: string }>`를 명시한다.

- [ ] **Step 1: `components/game/SceneStage.tsx`를 만든다**

```tsx
import type { DungeonEvent, PartyMember } from "@/lib/domain";
import { EVENT_KIND_LABELS, EVENT_KIND_MARKS } from "./labels";

interface SceneStageProps {
  party: PartyMember[];
  event: DungeonEvent;
  isBoss: boolean;
}

/**
 * 화면 영역 ②다. 용사 파티의 행동을 자동으로 보여주는 자리이며
 * 플레이어가 조작하지 않는다.
 *
 * 애니메이션은 이번 작업에서 만들지 않는다. 자리와 비율만 잡고 안에는
 * 정지된 목 장면을 넣는다. 조작의 중심은 아래의 선택 패널이므로 이
 * 영역은 그보다 작게 둔다.
 */
export function SceneStage({ party, event, isBoss }: SceneStageProps) {
  return (
    <div
      className="flex min-h-32 items-center justify-between gap-4 rounded border border-edge bg-panel px-4 py-3"
      aria-label="파티 행동 장면"
    >
      <ul className="flex flex-wrap gap-3">
        {party
          .filter((member) => member.alive)
          .map((member) => (
            <li key={member.id} className="text-center">
              <span aria-hidden="true" className="block text-2xl">
                🧍
              </span>
              <span className="block text-xs text-muted">{member.name}</span>
            </li>
          ))}
      </ul>

      <span aria-hidden="true" className="text-muted">
        ──▶
      </span>

      <div className="text-center">
        <span aria-hidden="true" className="block text-2xl">
          {isBoss ? "👑" : "👹"}
        </span>
        <span className="block text-xs text-muted">
          <span aria-hidden="true">{EVENT_KIND_MARKS[event.kind]}</span>{" "}
          {EVENT_KIND_LABELS[event.kind]}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `components/game/ChoiceList.tsx`를 만든다**

```tsx
import type { DungeonEvent, InfoCard, PartyMember } from "@/lib/domain";
import { TRUTH_TYPE_LABELS } from "./labels";

interface ChoiceListProps {
  event: DungeonEvent;
  party: PartyMember[];
  /** 지금 건넬 수 있는 정보 카드다. */
  cards: InfoCard[];
}

/**
 * 화면 영역 ③이다. 화면에서 가장 큰 영역이며 조작의 중심이다.
 *
 * 선택지마다 행동 대상·예상 이득·알려진 위험을 함께 보여준다.
 * 정확한 계산식을 다 공개하지 않아도 되지만 위험이 완전히 숨겨져서는
 * 안 된다.
 *
 * 버튼은 이번 작업에서 아무 일도 하지 않는다. 동작은 U2가 붙인다.
 */
export function ChoiceList({ event, party, cards }: ChoiceListProps) {
  const nameByMemberId = new Map(
    party.map((member) => [member.id, member.name]),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm text-parchment">{event.title}</h3>
        <p className="mt-1 text-sm text-muted">{event.description}</p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {event.choices.map((choice) => {
          const targetLabel =
            choice.target === undefined
              ? "파티 전체"
              : choice.target.kind === "boss"
                ? "보스"
                : (nameByMemberId.get(choice.target.id) ?? "알 수 없는 대상");

          return (
            <li key={choice.id}>
              <button
                type="button"
                className="w-full rounded border border-edge px-3 py-2 text-left hover:bg-edge"
              >
                <span className="block text-sm text-parchment">
                  {choice.label}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  대상 {targetLabel}
                </span>
                <span className="mt-1 block text-xs text-trust-up">
                  <span aria-hidden="true">＋</span>
                  <span className="sr-only">예상 이득 </span>
                  {choice.expectedGain}
                </span>
                <span className="mt-1 block text-xs text-trust-down">
                  <span aria-hidden="true">！</span>
                  <span className="sr-only">알려진 위험 </span>
                  {choice.knownRisk}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div>
        <h4 className="text-xs font-semibold tracking-wide text-muted">
          건넬 수 있는 정보
        </h4>
        <ul className="mt-2 grid gap-2 sm:grid-cols-3">
          {cards.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                className="h-full w-full rounded border border-edge px-3 py-2 text-left hover:bg-edge"
              >
                <span className="block text-xs text-muted">
                  [{TRUTH_TYPE_LABELS[card.truthType]}] {card.topic}
                </span>
                <span className="mt-1 block text-sm text-parchment">
                  {card.text}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `app/play/node/[nodeId]/page.tsx`를 만든다**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChoiceList } from "@/components/game/ChoiceList";
import { SceneStage } from "@/components/game/SceneStage";
import { Panel } from "@/components/ui/Panel";
import { MOCK_CARDS, MOCK_DUNGEON, MOCK_RUN, findEvent, findNode } from "@/lib/mock";

/**
 * 목의 노드 7개를 빌드 시점에 미리 만든다. 그러면 빌드 출력에서
 * 라우트가 실제로 도는지 확인할 수 있다.
 */
export function generateStaticParams() {
  return MOCK_DUNGEON.nodes.map((node) => ({ nodeId: node.id }));
}

export default async function NodePage({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  const { nodeId } = await params;
  const node = findNode(nodeId);
  if (node === undefined) notFound();

  const event = findEvent(node.eventId);
  const isBoss = node.id === MOCK_DUNGEON.bossNodeId;

  return (
    <>
      <SceneStage party={MOCK_RUN.party} event={event} isBoss={isBoss} />

      <Panel
        title={isBoss ? "보스전" : "이벤트와 선택"}
        aside={
          <Link
            href="/play/map"
            className="text-xs text-muted underline hover:text-parchment"
          >
            지도로 돌아가기
          </Link>
        }
        className="flex-1"
      >
        <ChoiceList
          event={event}
          party={MOCK_RUN.party}
          cards={MOCK_CARDS}
        />
      </Panel>
    </>
  );
}
```

- [ ] **Step 4: 검증 명령을 돌린다**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build 2>&1 | tail -25
```
Expected: 넷 다 통과. `pnpm build` 출력에 `/play/node/[nodeId]`가 나오고, 미리 만들어진 경로 7개가 함께 표시된다.

- [ ] **Step 5: 조우 화면이 세 요소를 모두 보여주는지 확인한다**

Run:
```bash
pnpm dev &
sleep 8
curl -s http://localhost:3000/play/node/n-a2 | grep -o "그림자 상인\|대상 파티 전체\|사례금 6을 쓴다\|\[거짓\]\|보스에 관한 정보를 산다" | sort -u
curl -s -o /dev/null -w "없는 노드: %{http_code}\n" http://localhost:3000/play/node/n-nope
curl -s http://localhost:3000/play/node/n-boss | grep -o "보스전\|리치의 옥좌" | sort -u
kill %1
```
Expected: 첫 `curl`에 `[거짓]`, `그림자 상인`, `대상 파티 전체`, `보스에 관한 정보를 산다`, `사례금 6을 쓴다`가 모두 나온다. 없는 노드는 `404`. 보스방에는 `보스전`과 `리치의 옥좌`가 나온다.

- [ ] **Step 6: 커밋한다**

```bash
git add components/game/SceneStage.tsx components/game/ChoiceList.tsx "app/play/node"
git commit -F - <<'MSG'
기능: 조우 화면

화면 영역 ② 와 ③ 이다. 위는 파티의 행동을 자동으로 보여주는 자리이고
아래가 플레이어의 조작이다. 아래를 더 크게 두었다. 인터페이스 문서가
장면 영역은 조작의 중심이 아니라고 정한 것을 비율로 표현한다.

애니메이션은 만들지 않았다. 자리와 비율만 잡고 정지된 목 장면을 넣었다.

선택지마다 행동 대상, 예상 이득, 알려진 위험을 함께 보여준다. 기호와
스크린 리더용 텍스트를 붙여 색만으로 구분하지 않는다. 버튼은 아직
아무 일도 하지 않는다. 동작은 U2 가 붙인다.

라우트가 nodeId 를 받으므로 특정 이벤트를 URL 로 바로 열 수 있다.
generateStaticParams 로 목의 노드 7개를 빌드 시점에 미리 만들어,
빌드 출력에서 라우트가 실제로 도는지 확인할 수 있게 했다.

Next.js 16 에서 params 는 Promise 이므로 await 한다. PageProps 전역
도우미 대신 타입을 명시한 이유는, 그 도우미가 next dev·next build 가
만든 타입에 의존해서 빌드 산물 없이 pnpm typecheck 만 돌리면 실패할 수
있기 때문이다.
MSG
```

---

## Task 7: 결과 화면

**Files:**
- Create: `lib/mock/result.ts`
- Modify: `lib/mock/index.ts`
- Modify: `lib/mock/mock.test.ts`
- Create: `components/game/ResultSummary.tsx`
- Create: `app/play/result/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `Panel`·`StatValue`, Task 3의 `MOCK_PARTY`.
- Produces:
  - `MockSettlement` — 도메인 타입이 아닌 화면 뷰 타입
  - `MOCK_SETTLEMENT: MockSettlement`
  - `ResultSummary({ settlement: MockSettlement })`

- [ ] **Step 1: `lib/mock/result.ts`를 만든다**

```ts
import type { MemberId } from "@/lib/domain";

/**
 * 결과 화면이 쓰는 뷰 타입이다. 도메인 타입이 아니다.
 *
 * R5 결과 정산이 반환값을 설계하면 그 타입으로 갈아탄다. 지금 화면
 * 사정으로 도메인에 모양을 박으면 R5 를 제약한다. 뷰 타입이므로
 * 이름을 함께 담아 비정규화한다.
 */
export interface MockSettlement {
  outcome: "clear" | "gameOver";
  survivors: { memberId: MemberId; name: string; classLabel: string }[];
  casualties: { memberId: MemberId; name: string; classLabel: string }[];
  trustChanges: {
    memberId: MemberId;
    name: string;
    delta: number;
    reason: string;
  }[];
  rewards: { label: string; amount: number }[];
  /** 결과에 영향을 준 선택을 사람이 읽는 문장으로 담는다. */
  influentialDecisions: string[];
}

export const MOCK_SETTLEMENT: MockSettlement = {
  outcome: "clear",
  survivors: [
    { memberId: "m-garon" as MemberId, name: "가론", classLabel: "전사" },
    { memberId: "m-beka" as MemberId, name: "베카", classLabel: "도적" },
  ],
  casualties: [
    { memberId: "m-rien" as MemberId, name: "리엔", classLabel: "성직자" },
    { memberId: "m-is" as MemberId, name: "이스", classLabel: "마법사" },
  ],
  trustChanges: [
    {
      memberId: "m-garon" as MemberId,
      name: "가론",
      delta: 9,
      reason: "충동적 성격: 위험한 길에서 먼저 정보를 받았음",
    },
    {
      memberId: "m-is" as MemberId,
      name: "이스",
      delta: -18,
      reason: "의심 많은 성격: 왼쪽 길이 비어 있다는 말이 거짓으로 드러남",
    },
    {
      memberId: "m-rien" as MemberId,
      name: "리엔",
      delta: 4,
      reason: "정의로운 성격: 숨기지 않은 답변",
    },
  ],
  rewards: [
    { label: "사례금", amount: 34 },
    { label: "명성", amount: 2 },
    { label: "유품", amount: 1 },
  ],
  influentialDecisions: [
    "이스에게 왼쪽 길이 비어 있다고 말했다. 그 길에 파수꾼이 있었다.",
    "보스의 밀사가 준 계약을 받아들이지 않고 이스에게 알렸다.",
    "리치의 관 위치를 리엔에게 알려줘 파티가 보스를 끝냈다.",
  ],
};
```

- [ ] **Step 2: `lib/mock/index.ts`에 결과 목을 더한다**

기존 export 목록에 한 줄과 타입 한 줄을 더한다.

```ts
export { MOCK_SETTLEMENT } from "./result";
export type { MockSettlement } from "./result";
```

- [ ] **Step 3: 결과 목 검사를 `lib/mock/mock.test.ts`에 더한다**

import 줄에 둘을 더한다.

```ts
import {
  MOCK_CARDS,
  MOCK_CLASSES,
  MOCK_DUNGEON,
  MOCK_EVENTS,
  MOCK_PARTY,
  MOCK_RUN,
  MOCK_SETTLEMENT,
} from "@/lib/mock";
```

파일 끝에 `describe` 블록을 더한다.

```ts
describe("정산 목", () => {
  it("생존자와 사망자가 겹치지 않는다", () => {
    const survivors = new Set(
      MOCK_SETTLEMENT.survivors.map((entry) => entry.memberId),
    );
    const overlap = MOCK_SETTLEMENT.casualties
      .filter((entry) => survivors.has(entry.memberId))
      .map((entry) => entry.name);
    expect(overlap, "생존자와 사망자에 함께 있는 사람").toEqual([]);
  });

  it("생존자와 사망자를 합치면 파티 전원이다", () => {
    const listed = [
      ...MOCK_SETTLEMENT.survivors,
      ...MOCK_SETTLEMENT.casualties,
    ].map((entry) => entry.memberId);
    expect(listed.sort()).toEqual(
      MOCK_PARTY.map((member) => member.id).sort(),
    );
  });

  it("정산에 나오는 모든 memberId가 파티에 있다", () => {
    const known = new Set(MOCK_PARTY.map((member) => member.id));
    const unknown = [
      ...MOCK_SETTLEMENT.survivors,
      ...MOCK_SETTLEMENT.casualties,
      ...MOCK_SETTLEMENT.trustChanges,
    ]
      .filter((entry) => !known.has(entry.memberId))
      .map((entry) => `${entry.name}: ${entry.memberId}`);
    expect(unknown, "파티에 없는 memberId").toEqual([]);
  });

  it("모든 신뢰 변화에 사유가 있다", () => {
    const missing = MOCK_SETTLEMENT.trustChanges
      .filter((change) => change.reason === "")
      .map((change) => change.name);
    expect(missing, "사유 없는 신뢰 변화").toEqual([]);
  });

  it("영향을 준 선택이 하나 이상 있다", () => {
    expect(MOCK_SETTLEMENT.influentialDecisions.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run:
```bash
pnpm test 2>&1 | tail -8
```
Expected: PASS.

- [ ] **Step 5: `components/game/ResultSummary.tsx`를 만든다**

`MockSettlement`는 `lib/mock`에 있고 컴포넌트는 `@/lib/mock`을 가져올 수 없다. 그래서 컴포넌트가 필요한 모양을 자기 파일에 다시 선언하고 구조적으로 맞춘다. `R5`가 진짜 타입을 만들면 이 선언을 지우고 그 타입을 가져온다.

```tsx
import { StatValue } from "@/components/ui/StatValue";

interface MemberEntry {
  name: string;
  classLabel: string;
}

interface TrustChangeEntry {
  name: string;
  delta: number;
  reason: string;
}

interface SettlementView {
  outcome: "clear" | "gameOver";
  survivors: MemberEntry[];
  casualties: MemberEntry[];
  trustChanges: TrustChangeEntry[];
  rewards: { label: string; amount: number }[];
  influentialDecisions: string[];
}

interface ResultSummaryProps {
  settlement: SettlementView;
}

/**
 * 화면 영역 ⑥이다. CLEAR 또는 GAME OVER 만 띄우지 않고 어떤 선택이
 * 결과에 영향을 줬는지 함께 보여준다.
 *
 * 타입을 여기에 다시 선언한 이유는 컴포넌트가 @/lib/mock 을 가져올 수
 * 없기 때문이다. R5 결과 정산이 진짜 타입을 만들면 이 선언을 지우고
 * 그 타입을 가져온다.
 */
export function ResultSummary({ settlement }: ResultSummaryProps) {
  const cleared = settlement.outcome === "clear";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p
          className={`text-3xl font-bold tracking-widest ${
            cleared ? "text-trust-up" : "text-trust-down"
          }`}
        >
          {cleared ? "CLEAR" : "GAME OVER"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {cleared
            ? "파티가 보스를 넘었다. 당신은 살아서 나왔다."
            : "탐험이 끝났다. 당신의 몫은 남지 않았다."}
        </p>
      </div>

      <section>
        <h3 className="text-xs font-semibold tracking-wide text-muted">
          생존과 사망
        </h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded border border-edge px-3 py-2">
            <p className="text-xs text-muted">
              생존 {settlement.survivors.length}명
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {settlement.survivors.map((entry) => (
                <li key={entry.name} className="text-sm text-parchment">
                  {entry.name}
                  <span className="ml-1 text-xs text-muted">
                    {entry.classLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-edge px-3 py-2">
            <p className="text-xs text-muted">
              사망 {settlement.casualties.length}명
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {settlement.casualties.map((entry) => (
                <li key={entry.name} className="text-sm text-muted">
                  <span aria-hidden="true">†</span> {entry.name}
                  <span className="ml-1 text-xs">{entry.classLabel}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold tracking-wide text-muted">
          신뢰 변화와 사유
        </h3>
        <ul className="mt-2 flex flex-col">
          {settlement.trustChanges.map((change) => {
            const rising = change.delta >= 0;
            return (
              <li
                key={change.name}
                className="border-b border-edge py-2 last:border-b-0"
              >
                <p className="text-sm text-parchment">
                  {change.name}{" "}
                  <span
                    className={
                      rising ? "text-trust-up" : "text-trust-down"
                    }
                  >
                    <span aria-hidden="true">{rising ? "▲" : "▼"}</span>
                    <span className="sr-only">
                      {rising ? "신뢰 상승 " : "신뢰 하락 "}
                    </span>
                    {Math.abs(change.delta)}
                  </span>
                </p>
                <p className="text-xs text-muted">{change.reason}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-semibold tracking-wide text-muted">
          보상
        </h3>
        <div className="mt-2 flex flex-wrap gap-4">
          {settlement.rewards.map((reward) => (
            <StatValue
              key={reward.label}
              label={reward.label}
              value={reward.amount}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold tracking-wide text-muted">
          결과에 영향을 준 선택
        </h3>
        <ol className="mt-2 flex list-inside list-decimal flex-col gap-1">
          {settlement.influentialDecisions.map((decision) => (
            <li key={decision} className="text-sm text-muted">
              {decision}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: `app/play/result/page.tsx`를 만든다**

```tsx
import Link from "next/link";
import { ResultSummary } from "@/components/game/ResultSummary";
import { Panel } from "@/components/ui/Panel";
import { MOCK_SETTLEMENT } from "@/lib/mock";

export default function ResultPage() {
  return (
    <Panel
      title="결과 정산"
      aside={
        <Link
          href="/play"
          className="text-xs text-muted underline hover:text-parchment"
        >
          처음으로
        </Link>
      }
      className="flex-1"
    >
      <ResultSummary settlement={MOCK_SETTLEMENT} />
    </Panel>
  );
}
```

- [ ] **Step 7: 검증 명령을 돌린다**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build 2>&1 | tail -25
```
Expected: 넷 다 통과. `pnpm build` 출력에 라우트 5개가 모두 나온다 — `/`, `/play`, `/play/map`, `/play/node/[nodeId]`, `/play/result`.

- [ ] **Step 8: 결과 화면이 CLEAR 외의 것도 보여주는지 확인한다**

Run:
```bash
pnpm dev &
sleep 8
curl -s http://localhost:3000/play/result | grep -o "CLEAR\|생존 2명\|사망 2명\|왼쪽 길이 비어 있다는 말이 거짓으로 드러남\|결과에 영향을 준 선택" | sort -u
kill %1
```
Expected: 다섯 모두 나온다. `CLEAR`만 있고 나머지가 없으면 완료 기준을 못 지킨 것이다.

- [ ] **Step 9: 커밋한다**

```bash
git add lib/mock components/game/ResultSummary.tsx app/play/result
git commit -F - <<'MSG'
기능: 결과 화면

화면 영역 ⑥ 이다. CLEAR 또는 GAME OVER 만 띄우지 않고 생존자, 신뢰
변화와 사유, 보상, 결과에 영향을 준 선택 목록을 함께 보여준다.

정산 결과 타입은 도메인에 넣지 않았다. R5 결과 정산이 계산해 보고
반환값을 설계할 일이고, 지금 화면 사정으로 모양을 박으면 R5 를
제약한다. lib/mock/result.ts 의 MockSettlement 를 뷰 타입으로 둔다.

컴포넌트는 @/lib/mock 을 가져올 수 없으므로 필요한 모양을 자기 파일에
다시 선언하고 구조적으로 맞춘다. R5 가 진짜 타입을 만들면 그 선언을
지우고 가져온다. 이 중복은 의도한 것이며 주석에 적었다.

정산 목에도 무결성 검사를 붙였다. 생존자와 사망자가 겹치지 않는지,
둘을 합치면 파티 전원인지, 모든 신뢰 변화에 사유가 있는지 본다.
사유 없는 신뢰 변화는 Q2 접근성 점검이 금지하는 것이다.
MSG
```

---

## Task 8: 설정집과 개발 환경 문서 갱신

**Files:**
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`

**Interfaces:**
- Consumes: Task 1~7이 실제로 만든 구조.
- Produces: 없음. 문서만 바뀐다.

- [ ] **Step 1: `docs/experience/ONBOARDING_AND_INTERFACE.md`의 「주요 화면 영역」 앞에 화면 구성 절을 넣는다**

`## 주요 화면 영역` 줄 바로 앞에 다음을 넣는다. 이 계획에서는 안쪽에 코드 블록이 들어 있으므로 바깥 울타리를 백틱 넷으로 적었다. 문서에 넣을 때는 바깥 울타리를 빼고 안의 내용만 넣는다.

````markdown
## 화면 구성

여섯 영역은 한 화면에 모두 놓이지 않는다. 네 화면으로 나뉜다.

| 화면 | 담는 영역 | 진행 단계 |
| --- | --- | --- |
| 파티 소개·던전 입장 | ① ④ | `partyIntro` |
| 던전 분기 지도 | ① ④ ⑤ | `pathChoice` |
| 조우 | ① ② ③ ④ | `event` `bossFight` |
| 결과 | ① ④ ⑥ | `settlement` `ended` |

① 현재 위치와 상태, ④ 파티와 개인 신뢰는 네 화면 모두에 있다. 길을 고를 때도 누가 나를 얼마나 믿는지 보여야 하기 때문이다.

### 지도는 별개 화면이며 오간다

던전 분기 지도는 조우 화면의 사이드 패널이 아니다. 플레이어가 길잡이로서 길을 고르는 화면이고, 지점을 고르면 그 지점의 조우 화면으로 들어간다. 해결하면 다시 지도로 돌아온다.

```text
지도에서 지점 선택
→ 그 지점의 조우 화면
→ 해결
→ 다시 지도
→ 반복
→ 보스방
→ 결과 화면
```

### 지도는 아래에서 위로 진행한다

입구는 한 곳이며 지도의 맨 아래에 있다. 위로 갈라지며 올라가고, 어떤 경로를 골라도 맨 위의 보스방으로 모인다. 지점의 세로 위치는 입구에서의 거리가 정한다.

되돌아가지 않는 구조이므로 위로 갈수록 되돌릴 수 없는 선택이 쌓인다.

### 조우 화면은 위가 관람이고 아래가 조작이다

위쪽은 용사 파티의 행동을 자동으로 보여주는 영역이다. 플레이어가 조작하지 않는다. 아래쪽이 플레이어의 선택지와 정보 카드를 담는다.

**아래 영역을 위 영역보다 크게 둔다.** 전투·이동 장면의 역할은 선택의 결과를 전달하는 것이며 조작의 중심이 아니라는 원칙을 화면 비율로 표현한다.
````

- [ ] **Step 2: 같은 문서의 「프로토타입 이미지 해석」 절을 갱신한다**

`이 이미지는 다음 영역을 탐색한 초기 와이어프레임으로 사용한다.` 다음의 목록 네 줄을 다음으로 교체한다.

```markdown
- 조우 화면. 위의 좁은 띠가 파티 행동 장면이고 아래의 넓은 칸이 선택 영역이다
- 던전 분기 지도. 아래의 한 지점에서 시작해 위로 갈라지며 올라가고 맨 위의 별표가 보스방이다
- 결과 화면. `GAME OVER`와 `CLEAR`, 그 아래 수치와 보상
```

- [ ] **Step 3: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`의 「경로의 구조」 절에 한 줄을 더한다**

`- 앞으로만 나아간다. 지나온 지점으로 되돌아가지 않는다.` 다음에 넣는다.

```markdown
- 입구는 한 곳이고 보스방도 한 곳이다. 보스방은 다음 지점 목록이 빈 유일한 지점이다.
```

- [ ] **Step 4: 같은 문서의 「이벤트 분류」 절 다음에 선택지 절을 넣는다**

`### 몬스터 이벤트` 줄 바로 앞에 다음을 넣는다.

```markdown
### 이벤트의 선택지

모든 이벤트는 선택지를 하나 이상 가진다. 선택지가 없는 이벤트는 플레이어가 결정할 것이 없는 이벤트이므로 이 게임의 이벤트가 아니다.

각 선택지는 다음 셋을 함께 가진다.

| 요소 | 내용 |
| --- | --- |
| 행동 대상 | 특정 파티원, 보스, 또는 없음(파티 전체나 상황 자체) |
| 예상 이득 | "성직자의 신뢰를 얻는다"처럼 플레이어에게 알려주는 기대치 |
| 알려진 위험 | "발각되면 처형"처럼 플레이어가 아는 위험 |

정확한 계산식을 다 공개할 필요는 없다. 다만 위험이 완전히 숨겨져서는 안 된다.
```

- [ ] **Step 5: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`에 화면 구조 절을 넣는다**

`## 테스트 작성 규약` 줄 바로 앞에 다음을 넣는다. 여기도 안쪽에 코드 블록이 있으므로 바깥 울타리가 백틱 넷이다. 문서에 넣을 때는 바깥 울타리를 뺀다.

````markdown
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
````

- [ ] **Step 6: 같은 문서의 「Hello World 초기화 범위」 절에 지난 기록임을 명시한다**

절의 첫 문장 앞에 한 줄을 넣는다.

```markdown
이 절은 지난 초기화 작업의 기록이다. 화면 셸 작업에서 `Hello World` 화면은 `/play` 리다이렉트로 대체됐다.
```

- [ ] **Step 7: 같은 문서의 「테스트 작성 규약」에 한 줄을 더한다**

`- 검사 대상은 코드만이 아니다.`로 시작하는 줄이 있으면 그 다음에, 없으면 목록 끝에 넣는다.

```markdown
- 목 데이터에도 무결성 검사를 붙인다. 목이 도메인 상수의 범위를 어기거나 끊긴 참조를 담고 있으면 그 목을 믿고 만든 화면이 실제 데이터에서 깨진다. `lib/mock/mock.test.ts`가 예다.
```

- [ ] **Step 8: 문서의 링크와 코드 펜스를 확인한다**

Run:
```bash
for f in docs/experience/ONBOARDING_AND_INTERFACE.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/technical/DEVELOPMENT_ENVIRONMENT.md; do
  echo "=== $f"
  awk '/^```/{n++} END{print "  펜스:", n, (n%2==0 ? "OK" : "짝이 안 맞음")}' "$f"
  grep -c "확정 예정\|TBD\|TODO" "$f" || true
done
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Expected: 세 파일의 펜스가 모두 `OK`. `grep -c`는 `0`. 검증 명령 넷은 통과.

- [ ] **Step 9: 커밋한다**

```bash
git add docs/experience/ONBOARDING_AND_INTERFACE.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/technical/DEVELOPMENT_ENVIRONMENT.md
git commit -F - <<'MSG'
문서: 화면 구성과 이벤트 선택지를 설정집에 반영

구현하면서 확정한 내용이 설정집에 없었다.

인터페이스 문서에 화면 구성 절을 넣었다. 여섯 영역이 네 화면으로
나뉘고, 현재 위치와 파티 신뢰는 네 화면 모두에 있다. 지도는 사이드
패널이 아니라 별개 화면이며 오간다. 아래에서 위로 진행하고 입구는 한
곳이며 어떤 경로도 보스방으로 모인다. 조우 화면은 위가 관람이고
아래가 조작이며 아래를 더 크게 둔다.

프로토타입 이미지 해석 절도 갱신했다. 초기 와이어프레임의 세 덩이가
각각 무엇인지 이제 확정됐다.

던전 문서에 이벤트 선택지 절을 넣었다. 모든 이벤트는 선택지를 하나
이상 가지며, 각 선택지는 행동 대상과 예상 이득과 알려진 위험을 함께
가진다. 입구와 보스방이 각각 한 곳이고 보스방이 다음 지점 목록이 빈
유일한 지점이라는 것도 적었다.

개발 환경 문서에 화면 구조와 import 경계를 적었다. 두 경계를 eslint 가
강제하는 이유와 Next.js 16 의 params 가 Promise 라는 것, PageProps
전역 도우미를 쓰지 않는 이유를 함께 남겼다.

Hello World 초기화 범위 절이 지난 작업의 기록임을 명시했다.
MSG
```

---

## Task 9: main 동기화, 배정표 갱신, Pull Request

**Files:**
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Task 1~8 전부.
- Produces: 없음.

**주의:** `PROTOTYPE_WORK_ASSIGNMENT.md`는 PR `#4`와 `#5`가 이미 고치고 있다. `#4`가 `선행` 열의 규약을 "남은 선행만 담는다"로 바꾸고 `#5`가 그 규약을 검사하는 테스트를 더한다. 그래서 배정표 갱신을 마지막에 하고, 그 시점의 `main`에 어떤 규약이 들어 있는지 먼저 확인한다.

- [ ] **Step 1: `main`을 가져와 어떤 규약이 들어 있는지 확인한다**

Run:
```bash
git fetch origin
git log --oneline origin/main -3
git show origin/main:docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md | grep -n "선행에는 직접 선행만\|남은 것만\|상태를 \`✅\`로 바꿀 때"
ls docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts 2>/dev/null && echo "검사 테스트 있음" || echo "검사 테스트 없음"
```
Expected: `#4`가 병합됐으면 "남은 것만"이 포함된 줄이 나온다. 안 됐으면 아무것도 안 나온다. 이 결과가 Step 4의 분기를 정한다.

- [ ] **Step 2: `main`을 병합한다**

Run:
```bash
git merge origin/main --no-edit
```
Expected: 충돌 없이 병합. `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`에서 충돌이 나면 `main` 쪽 내용을 택하고 이 브랜치에서는 그 파일을 아직 고치지 않았음을 확인한다.

- [ ] **Step 3: 병합 후 검증 명령을 돌린다**

Run:
```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Expected: 넷 다 통과. `#5`가 병합됐으면 배정표 무결성 검사도 함께 돈다.

- [ ] **Step 4: 배정표의 `F5` 행을 갱신한다**

`F5` 행의 담당을 `LatteBun`으로, 상태를 `✅`로 바꾼다.

```text
| F5 | 화면 셸·레이아웃 | 인터페이스 문서의 6개 화면 영역이 목 데이터로 배치된 라우트 존재 | — | **U1 U2 U3 U4** | LatteBun | ✅ |
```

**Step 1의 결과에 따라 갈린다.**

`#4`가 병합돼 "남은 선행만" 규약이 들어 있으면, `U1`·`U2`·`U3`·`U4` 네 행의 `선행` 열에서 `F5`를 지운다. 지우고 남은 것이 없으면 `—`로 적는다.

```text
| U1 | 파티·개인 신뢰 패널 | ... | R1 R2 | **U5 Q2** | | ⬜ |
| U2 | 이벤트 선택·정보 카드 패널 | ... | R3 | **U5 Q2** | | ⬜ |
| U3 | 던전 분기 지도 | ... | R4 P1 | **Q2** | | ⬜ |
| U4 | 결과 화면 | ... | R5 P2 | **Q2** | | ⬜ |
```

`#4`가 아직 병합되지 않았으면 옛 규약이므로 `선행` 열은 건드리지 않는다. `F5`가 그대로 남는다.

- [ ] **Step 5: 배정표를 고친 뒤 검사를 다시 돌린다**

Run:
```bash
pnpm test 2>&1 | tail -10
```
Expected: PASS. `#5`가 병합돼 있으면 `완료된 ID가 선행에 남아 있지 않다` 검사가 Step 4의 `선행` 정리를 확인한다. 실패하면 지우지 않은 행이 있다는 뜻이므로 실패 메시지가 가리키는 행을 고친다.

- [ ] **Step 6: 커밋한다**

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -F - <<'MSG'
문서: 배정표의 F5 상태를 완료로 갱신

화면 셸 작업이 끝났다. 담당과 상태를 적고, main 에 들어 있는 선행
규약에 맞춰 U1~U4 의 선행 열을 정리했다.

배정표 갱신을 마지막에 한 이유는 PR #4 와 #5 가 같은 파일을 고치고
있었기 때문이다. 세 브랜치가 동시에 손대면 충돌한다.
MSG
```

- [ ] **Step 7: 최종 검증을 돌리고 결과를 기록한다**

Run:
```bash
pnpm lint && echo "lint OK"
pnpm typecheck && echo "typecheck OK"
pnpm test 2>&1 | tail -5
pnpm build 2>&1 | tail -25
```
Expected: `lint OK`, `typecheck OK`, 모든 테스트 통과, 빌드 성공. 빌드 출력의 라우트 5개를 그대로 옮겨 적어 PR 본문에 넣는다.

- [ ] **Step 8: 네 화면을 실제로 열어 6개 영역을 확인한다**

Run:
```bash
pnpm dev &
sleep 8
for path in /play /play/map /play/node/n-a2 /play/result; do
  echo "=== $path"
  curl -s "http://localhost:3000$path" | grep -o "사례금\|파티와 개인 신뢰" | sort -u
done
curl -s http://localhost:3000/play/map | grep -c "깊이"
curl -s http://localhost:3000/play/node/n-a2 | grep -c "알려진 위험"
curl -s http://localhost:3000/play/result | grep -o "결과에 영향을 준 선택"
kill %1
```
Expected: 네 화면 모두에 `사례금`(①)과 `파티와 개인 신뢰`(④)가 나온다. 지도의 `깊이`가 4, 조우 화면의 `알려진 위험`이 1 이상, 결과 화면에 `결과에 영향을 준 선택`이 나온다.

- [ ] **Step 9: push하고 Pull Request를 만든다**

Run:
```bash
git push -u origin feature/screen-shell
```

그다음 `gh pr create --base main --head feature/screen-shell`로 PR을 만든다. 본문에 다음을 담는다.

- 만든 라우트 5개와 각 화면이 담는 영역 번호
- 두 import 경계와 그것을 eslint가 강제한다는 것
- 도메인에 더한 것이 `ChoiceId`와 `EventChoice`뿐이라는 것과 그 근거
- 확정하지 않고 넘긴 셋과 각각의 주인 (정산 결과 타입은 `R5`, 손패 자리는 `R3`, 보스방 주석은 이번에 고침)
- 목 무결성 검사가 실제로 잡는지 확인한 결과 (Task 3 Step 11의 세 가지)
- 갱신한 설정집 문서와 그 이유
- Step 7의 검증 결과와 빌드 출력의 라우트 목록
- F5가 하지 않은 것 (애니메이션 없음, 버튼 반응 없음, 상태 관리 없음, 게임 규칙 없음)

- [ ] **Step 10: PR 상태를 확인한다**

Run:
```bash
gh pr list --state open --json number,title,headRefName,mergeStateStatus,reviewDecision
```
Expected: `feature/screen-shell` PR이 목록에 나온다. `mergeStateStatus`가 `BLOCKED`이고 `reviewDecision`이 `REVIEW_REQUIRED`인 것은 정상이다. 팀원의 승인이 필요하다.

---

## 자체 검토 결과

**Spec 커버리지.** spec의 각 절을 훑고 담당 task를 확인했다.

| spec 절 | Task |
| --- | --- |
| 6개 화면 영역 | 4(①④), 5(⑤), 6(②③), 7(⑥) |
| 초기 와이어프레임의 해석 | 5, 6, 8 |
| 라우트와 셸 | 4, 5, 6, 7 |
| 컴포넌트 배치 | 1, 4, 5, 6, 7 |
| 디자인 토큰 | 1 |
| 화면 크기 | 4 (`lg:flex-row`), 6·7 (`sm:grid-cols-*`) |
| 목 데이터 | 3, 7 |
| 목 데이터 무결성 검사 | 3, 7 |
| 도메인에 더하는 것 | 2 |
| 확정하지 않고 넘기는 것 | 2 (보스방 주석), 7 (정산 뷰 타입), 3 (`lib/mock/cards.ts`) |
| 함께 갱신할 문서 | 8, 9 |
| 검증 | 각 task의 마지막 검증 step, 9 Step 7~8 |

**빠진 것을 하나 찾아 채웠다.** spec의 「두 가지 import 경계」 중 `components/**`가 `@/lib/mock`을 가져오지 않는 규칙은 spec 본문에 없었다. 계획을 쓰면서 `PartySidebar`가 `MOCK_CLASSES`를 직접 가져오려는 것을 보고 발견했다. Task 1에 규칙을, Task 4~7에 props 주입을 넣었다. 이 규칙이 `F2`·`P1`이 붙을 때 컴포넌트를 고치지 않게 하는 실질적인 장치다.

**타입 일관성.** Task 간에 쓰는 이름을 맞췄다.

- `MOCK_CLASSES` `MOCK_CARDS` `MOCK_EVENTS` `MOCK_PARTY` `MOCK_DUNGEON` `MOCK_RUN` `MOCK_SETTLEMENT` — Task 3·7에서 정의하고 4~7에서 쓴다
- `findEvent(eventId: EventId): DungeonEvent`, `findNode(nodeId: string): DungeonNode | undefined` — Task 3에서 정의, 4·6에서 쓴다
- `TrustRow`의 직업 이름 prop은 `classLabel`이다. React의 `className`과 겹치지 않게 이름을 바꿨다
- `ResultSummary`는 `SettlementView`를 자기 파일에 선언한다. `MockSettlement`와 구조가 같지만 import하지 않는다. Task 1의 eslint 규칙 때문이며 주석에 이유를 적었다
- `EVENT_KIND_MARKS`는 Task 4에서 정의하고 5·6에서 쓴다

**플레이스홀더 없음.** 모든 step에 실제 코드나 실제 명령이 있다. "적절히 처리한다" 같은 표현을 쓰지 않았다.

**한 가지 미확정을 남겼다.** Task 9 Step 4는 `main`의 상태에 따라 갈린다. 이것은 계획의 흠이 아니라 실제 조건 분기이며, Step 1이 어느 쪽인지 판정하는 명령을 제공한다.
