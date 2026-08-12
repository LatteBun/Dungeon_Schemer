# State Preview R1 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/state-preview`가 실제 R1 파티 생성 결과를 production에서도 표시하고, 동료가 입력한 seed로 생성 결과를 재현하게 한다.

**Architecture:** 최신 `main`의 R1 규칙을 F2 브랜치에 병합한 뒤 `createPreviewRun(seed)`가 `party` 독립 RNG 스트림에서 `generateParty`를 호출하도록 바꾼다. Client panel은 입력 seed를 정규화해 Run Store에 명시적으로 전달하고 UI 선택을 초기화한다. Node Vitest는 preview와 R1의 연결을 검증하고, 화면 상호작용은 typecheck·build와 브라우저 수동 검증으로 확인한다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5, Zustand 5.0.14, Vitest 4.1.10, pnpm 11.21.0

## Global Constraints

- 구현 시작 전에 최신 `origin/main`을 `feature/state-store`에 병합해 R1과 배정표 무결성 검사를 포함한다.
- 커밋 메시지는 제목과 본문을 포함해 항상 한글로 작성한다.
- R1의 `generateParty(rng)`, 직업·이름 콘텐츠, 초기 신뢰 상수는 수정하지 않는다.
- 파티는 반드시 `generateParty(createRng(seed).derive("party"))`로 생성한다.
- Run Store와 UI Store API는 바꾸지 않는다. 새 런 뒤에는 UI Store를 별도 action으로 초기화한다.
- `persist`, `localStorage`, Supabase, 인증, URL seed 공유, React DOM 테스트 도구를 추가하지 않는다.
- `/state-preview`는 홈에서 링크하지 않지만 development와 production에서 공개한다.
- F5 소유 파일 `app/page.tsx`, `app/layout.tsx`, `app/globals.css`는 수정하지 않는다.
- 신뢰는 파티원별 `trust`만 표시하며 평균·합계를 계산하거나 표시하지 않는다.
- 구현 완료를 주장하기 전 `superpowers:verification-before-completion`을, 최종 diff 검토에는 `superpowers:requesting-code-review`를 사용한다.

---

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `app/state-preview/preview-run.ts` | R1 party RNG stream으로 `RunState.party`를 조립하고 초기 seed 상수를 제공 | 수정 |
| `app/state-preview/preview-run.test.ts` | preview와 R1의 실제 연결을 Vitest로 검증 | 신규 |
| `app/state-preview/preview-seed.ts` | seed 입력값 trim·빈 값 거부를 순수 함수로 제공 | 신규 |
| `app/state-preview/preview-seed.test.ts` | seed 정규화 계약 검증 | 신규 |
| `app/state-preview/state-preview-panel.tsx` | seed form, 새 UUID 런, reset, 직업명 표시 | 수정 |
| `app/state-preview/page.tsx` | production에서도 preview를 렌더링 | 수정 |
| `docs/technical/DEVELOPMENT_ENVIRONMENT.md` | 공개 R1 preview의 기술 검증 책임 기록 | 수정 |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | F2·R1 완료와 P1의 남은 선행 기록 | 수정 |

---

### Task 1: 최신 main의 R1을 F2 worktree에 병합한다

**Files:**
- Merge source: `origin/main`
- Expected additions: `lib/content/classes.ts`, `lib/content/names.ts`, `lib/rules/party.ts`, `lib/rules/party.test.ts`, `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts`
- Potential merge context: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`, `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`

**Consumes:** merged R1 `generateParty(rng: Rng): PartyMember[]` and R1 content data.

**Produces:** F2 branch based on the R1-capable `origin/main`, preserving the F2 state-store commits and the already committed follow-up spec.

- [ ] **Step 1: remote main을 다시 가져온다**

Run:

```bash
git fetch --no-tags origin main
git log --oneline --decorate -4 origin/main
```

Expected: `origin/main`에 R1 병합 커밋 `d62e9f6`와 배정표 검사 병합 커밋이 보인다.

- [ ] **Step 2: 최신 main을 병합한다**

Run:

```bash
git merge --no-ff origin/main -m "병합: R1 파티 생성 규칙을 상태 스토어 브랜치에 반영"
```

`docs/technical/DEVELOPMENT_ENVIRONMENT.md` 충돌 시 R1의 `난수와 재현성` 규약과 F2의 Zustand Run/UI Store 규약을 모두 남긴다. `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` 충돌 시 F2 완료 행과 R1 담당·상태 행을 모두 보존한다. 이 task에서는 R1 상태를 아직 `🟡`로 둔다. 상태 완료는 Task 6에서 코드·검증과 함께 기록한다.

- [ ] **Step 3: 병합된 R1 테스트 기준선을 확인한다**

Run:

```bash
pnpm test lib/rules/party.test.ts docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts
```

Expected: R1의 7개 규칙 테스트와 배정표 무결성 테스트가 모두 통과한다.

- [ ] **Step 4: 병합 결과를 확인한다**

Run:

```bash
git status --short
git log --oneline --decorate -8
rg -n "export function generateParty" lib/rules/party.ts
```

Expected: 충돌이 남지 않고 `generateParty`가 현재 branch에 존재한다.

---

### Task 2: preview가 R1 party stream을 쓰는 실패 테스트를 추가한다

**Files:**
- Create: `app/state-preview/preview-run.test.ts`
- Test target: `app/state-preview/preview-run.ts`

**Interfaces:**
- Consumes: `createPreviewRun(seed: string): RunState`, `createRng(seed: string): Rng`, `generateParty(rng: Rng): PartyMember[]`
- Produces: R1 연결과 seed별 preview 차이를 고정하는 회귀 테스트

`createPreviewRun`이 다시 고정 파티를 반환하거나 `derive("party")`를 빼먹으면 첫 테스트가 실패한다. 모든 seed에 같은 고정 파티를 반환하면 두 번째 테스트가 실패한다.

- [ ] **Step 1: 실패하는 integration test를 작성한다**

Create `app/state-preview/preview-run.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createPreviewRun } from "@/app/state-preview/preview-run";
import { createRng } from "@/lib/rng";
import { generateParty } from "@/lib/rules/party";

describe("R1 연동 상태 미리보기", () => {
  it("party 독립 stream의 R1 파티를 RunState에 담는다", () => {
    const seed = "manual-seed";

    expect(createPreviewRun(seed).party).toEqual(
      generateParty(createRng(seed).derive("party")),
    );
  });

  it("서로 다른 seed는 서로 다른 preview 파티를 만든다", () => {
    expect(createPreviewRun("preview-a").party).not.toEqual(
      createPreviewRun("preview-b").party,
    );
  });
});
```

- [ ] **Step 2: 테스트가 고정 fixture 때문에 실패하는지 확인한다**

Run:

```bash
pnpm test app/state-preview/preview-run.test.ts
```

Expected: 두 테스트가 실패한다. 첫 테스트는 고정 아리아·보린·셀린 파티와 R1 결과가 다르기 때문이고, 두 번째 테스트는 서로 다른 seed에도 동일한 고정 파티를 쓰기 때문이다.

---

### Task 3: preview RunState를 실제 R1 결과로 조립한다

**Files:**
- Modify: `app/state-preview/preview-run.ts`
- Test: `app/state-preview/preview-run.test.ts`

**Interfaces:**
- Consumes: `createRng`, `generateParty`, R1의 `party` stream 이름
- Produces: `PREVIEW_INITIAL_SEED: "f2-preview-initial"`과 기존 signature의 `createPreviewRun(seed): RunState`

- [ ] **Step 1: preview 초기 seed 상수와 R1 import를 추가한다**

`app/state-preview/preview-run.ts`의 import와 상단을 다음처럼 바꾼다.

```ts
import type { EventId, NodeId, RunState } from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { generateParty } from "@/lib/rules/party";

export const PREVIEW_INITIAL_SEED = "f2-preview-initial";
```

고정 파티에서만 쓰던 `ClassId`, `MemberId` import를 제거한다.

- [ ] **Step 2: 고정 파티 배열을 R1 호출로 교체한다**

`createPreviewRun`의 `party` 값을 다음 한 줄로 바꾼다. dungeon과 resources를 포함한 나머지 `RunState` fixture는 바꾸지 않는다.

```ts
party: generateParty(createRng(seed).derive("party")),
```

- [ ] **Step 3: preview와 R1 테스트를 통과시킨다**

Run:

```bash
pnpm test app/state-preview/preview-run.test.ts lib/rules/party.test.ts
```

Expected: Task 2의 두 integration test와 R1의 7개 규칙 test가 모두 통과한다.

- [ ] **Step 4: Task 2~3을 커밋한다**

```bash
git add app/state-preview/preview-run.ts app/state-preview/preview-run.test.ts
git commit -m "기능: State Preview에 R1 파티 생성 연동" -m "고정 파티 fixture 대신 party 독립 난수 stream의 generateParty 결과를 RunState에 담는다.
동일 seed의 R1 결과가 preview에 그대로 반영되는 회귀 테스트를 추가한다."
```

---

### Task 4: seed 입력 정규화의 실패 테스트와 순수 함수를 추가한다

**Files:**
- Create: `app/state-preview/preview-seed.ts`
- Create: `app/state-preview/preview-seed.test.ts`

**Interfaces:**
- Produces: `normalizePreviewSeed(input: string): string | null`
- Contract: 앞뒤 공백을 제거한 non-empty seed를 반환하고, 공백만 있는 입력은 `null`을 반환한다.

이 helper는 Node Vitest에서 브라우저 없이 공백 입력 거부를 검증하게 한다. Panel은 `null`일 때 Run/UI Store를 변경하지 않는다.

- [ ] **Step 1: 실패하는 seed 정규화 테스트를 작성한다**

Create `app/state-preview/preview-seed.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizePreviewSeed } from "@/app/state-preview/preview-seed";

describe("상태 미리보기 seed 입력", () => {
  it("앞뒤 공백을 제거한 seed를 반환한다", () => {
    expect(normalizePreviewSeed("  manual-seed  ")).toBe("manual-seed");
  });

  it("공백만 있는 seed는 거부한다", () => {
    expect(normalizePreviewSeed(" \n\t ")).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 모듈 부재로 실패하는지 확인한다**

Run:

```bash
pnpm test app/state-preview/preview-seed.test.ts
```

Expected: `@/app/state-preview/preview-seed` 모듈을 찾지 못해 실패한다.

- [ ] **Step 3: 최소 seed 정규화 함수를 구현한다**

Create `app/state-preview/preview-seed.ts`:

```ts
export function normalizePreviewSeed(input: string): string | null {
  const seed = input.trim();
  return seed === "" ? null : seed;
}
```

- [ ] **Step 4: seed 정규화 테스트를 통과시킨다**

Run:

```bash
pnpm test app/state-preview/preview-seed.test.ts
```

Expected: 두 테스트가 통과한다.

- [ ] **Step 5: Task 4를 커밋한다**

```bash
git add app/state-preview/preview-seed.ts app/state-preview/preview-seed.test.ts
git commit -m "기능: State Preview seed 입력 검증 추가" -m "입력 seed의 앞뒤 공백을 제거하고 공백만 있는 값은 거부한다.
브라우저 의존성 없이 seed 입력 계약을 Vitest로 검증한다."
```

---

### Task 5: seed form과 production preview를 구현한다

**Files:**
- Modify: `app/state-preview/state-preview-panel.tsx`
- Modify: `app/state-preview/page.tsx`
- Verify: `app/page.tsx`, `app/layout.tsx`, `app/globals.css` unchanged

**Interfaces:**
- Consumes: `PREVIEW_INITIAL_SEED`, `createPreviewRun`, `normalizePreviewSeed`, `createSeed`, `CLASSES`, existing Run/UI Store hooks
- Produces: seed form, `입력한 seed로 생성`, `새 미리보기 런`, `모두 초기화`, production-enabled `/state-preview`

Vitest 환경은 Node로 유지한다. 이 task의 Client Component 동작은 React DOM 테스트 라이브러리를 추가하지 않고 Task 4의 pure validation test, typecheck, build, 브라우저 수동 검증으로 확인한다.

- [ ] **Step 1: Panel에 필요한 import와 로컬 상태를 추가한다**

`state-preview-panel.tsx`에 다음 import를 추가한다.

```ts
import { useState } from "react";
import { CLASSES } from "@/lib/content/classes";
import {
  createPreviewRun,
  PREVIEW_INITIAL_SEED,
} from "@/app/state-preview/preview-run";
import { normalizePreviewSeed } from "@/app/state-preview/preview-seed";
import { createSeed } from "@/lib/rng";
```

컴포넌트 안에서 `run` selector 다음에 상태를 만든다.

```ts
const [seedInput, setSeedInput] = useState(run.seed);
const [seedError, setSeedError] = useState<string | null>(null);
```

- [ ] **Step 2: seed 기반 새 런 helper와 event handler를 구현한다**

기존 `handleNewPreviewRun`과 `handleResetAll`을 아래 동작으로 교체한다.

```ts
function startPreviewRun(seed: string) {
  startNewRun(createPreviewRun, seed);
  resetUi();
  setSeedInput(seed);
  setSeedError(null);
}

function handleSeedSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const seed = normalizePreviewSeed(seedInput);

  if (seed === null) {
    setSeedError("seed를 입력해 주세요.");
    return;
  }

  startPreviewRun(seed);
}

function handleNewPreviewRun() {
  startPreviewRun(createSeed());
}

function handleResetAll() {
  resetRun();
  resetUi();
  setSeedInput(PREVIEW_INITIAL_SEED);
  setSeedError(null);
}
```

`React.FormEvent` 타입은 `import type { FormEvent } from "react"`로 가져와 `FormEvent<HTMLFormElement>`로 써도 된다. runtime React namespace import는 추가하지 않는다.

- [ ] **Step 3: Run Store 앞에 재현성 form을 추가한다**

header 아래에 다음 의미 구조를 추가한다.

```tsx
<section aria-labelledby="seed-check-heading" className="space-y-3 rounded border p-4">
  <h2 id="seed-check-heading" className="text-2xl font-semibold">
    R1 파티 생성 재현 확인
  </h2>
  <p>같은 seed는 같은 파티를 재현하고, 새 seed는 다른 조합을 생성합니다.</p>
  <form className="flex flex-wrap gap-3" onSubmit={handleSeedSubmit}>
    <label className="flex flex-col gap-1" htmlFor="preview-seed">
      재현할 seed
      <input
        id="preview-seed"
        className="rounded border px-3 py-2"
        value={seedInput}
        onChange={(event) => setSeedInput(event.target.value)}
      />
    </label>
    <button className="self-end rounded border px-3 py-2" type="submit">
      입력한 seed로 생성
    </button>
  </form>
  {seedError === null ? null : <p role="alert">{seedError}</p>}
</section>
```

- [ ] **Step 4: 파티 카드에 한국어 직업명을 표시한다**

`run.party.map` 안에서 `member`를 그리기 전에 직업 정의를 찾는다.

```ts
const classDef = CLASSES.find((candidate) => candidate.id === member.classId);
```

카드에는 class ID 줄 앞에 다음 줄을 추가한다. 콘텐츠가 확장되어 정의를 못 찾더라도 ID를 계속 보여 준다.

```tsx
<div>
  <dt className="inline font-semibold">직업: </dt>
  <dd className="inline">{classDef?.name ?? member.classId}</dd>
</div>
```

- [ ] **Step 5: production 404 가드를 제거하고 초기 상수를 사용한다**

`app/state-preview/page.tsx`를 다음 구조로 만든다.

```tsx
import {
  createPreviewRun,
  PREVIEW_INITIAL_SEED,
} from "@/app/state-preview/preview-run";
import { StatePreviewPanel } from "@/app/state-preview/state-preview-panel";
import { GameStoreProvider } from "@/lib/stores/game-store-provider";

export default function StatePreviewPage() {
  return (
    <GameStoreProvider initialRun={createPreviewRun(PREVIEW_INITIAL_SEED)}>
      <StatePreviewPanel />
    </GameStoreProvider>
  );
}
```

`next/navigation` import, `notFound()` 호출, `NODE_ENV` 분기를 모두 제거한다. `page.tsx`는 Server Component로 유지한다.

- [ ] **Step 6: 정적 검사와 R1/F2 test를 실행한다**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test app/state-preview/preview-run.test.ts app/state-preview/preview-seed.test.ts lib/rules/party.test.ts lib/stores/run-store.test.ts lib/stores/ui-store.test.ts
git diff -- app/page.tsx app/layout.tsx app/globals.css
```

Expected: lint·typecheck·지정 테스트 모두 통과하고 마지막 diff 출력은 비어 있다.

- [ ] **Step 7: Task 5를 커밋한다**

```bash
git add app/state-preview/state-preview-panel.tsx app/state-preview/page.tsx
git commit -m "기능: State Preview에서 seed 재현 확인 지원" -m "입력 seed와 새 UUID seed로 실제 R1 파티를 생성할 수 있게 한다.
production에서도 preview를 공개하고 런 재생성 시 UI 선택을 함께 초기화한다."
```

---

### Task 6: 기술 문서와 완료 배정표를 갱신한다

**Files:**
- Modify: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`
- Test: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts`

**Interfaces:**
- Consumes: 공개된 R1-integrated preview와 완료된 F2/R1 구현
- Produces: 기술 검증 라우트의 공개 정책, 완료 상태가 반영된 의존성 표

- [ ] **Step 1: 개발 환경 문서에 preview 공개 정책을 기록한다**

Zustand 책임 설명 뒤에 다음 의미를 한국어로 기록한다.

- `/state-preview`는 Run/UI Store와 R1 파티 생성을 확인하는 공개 기술 검증 라우트다.
- 홈과 실제 게임 흐름에는 연결하지 않지만 development와 Vercel production에서 접근할 수 있다.
- seed 입력으로 같은 파티를 재현하며, 고정 던전 fixture만 함께 표시한다.
- 사용자 데이터·비밀 값·인증·영속화를 쓰지 않고 `Development only` 안내를 배포에서도 유지한다.

- [ ] **Step 2: 배정표의 완료 상태와 P1 선행을 갱신한다**

`docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`의 행을 다음 값으로 맞춘다.

```markdown
| F2 | 상태 스토어 골격 | Zustand 설치, 런 상태와 UI 상태 스토어 분리, 초기 상태가 화면에 표시됨 | — | **P1** | SangHwan Yoo | ✅ |
| R1 | 파티 생성 규칙 | 시드로 3~5명의 직업·성격·초기 신뢰가 결정되고 재현되는 테스트 통과 | — | **R5 P1 U1 Q1** | sbh3821 | ✅ |
| P1 | 게임 상태 머신 | 파티 등장 → 경로 선택 → 이벤트 → 다음 노드 → 보스전 진입 전이가 테스트 통과하고 잘못된 전이는 거부됨 | R4 | **P2 U3 U5** | | ⬜ |
```

Mermaid 그래프의 `F2 --> P1`, `R1 --> P1`와 각 행의 `풀리는 것`은 전체 구조이므로 유지한다.

- [ ] **Step 3: 배정표 무결성 test를 실행한다**

Run:

```bash
pnpm test docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts
```

Expected: 완료된 F2·R1이 P1의 `선행`에 남지 않았고 표와 Mermaid 그래프가 일치한다는 test가 통과한다.

- [ ] **Step 4: Task 6를 커밋한다**

```bash
git add docs/technical/DEVELOPMENT_ENVIRONMENT.md docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "문서: R1 연동 State Preview 완료 기록" -m "배포 환경에서의 R1 파티 생성 검증 방법을 기술 문서에 기록한다.
F2와 R1을 완료로 갱신하고 P1의 남은 선행을 R4만 남긴다."
```

---

### Task 7: 전체 검증과 브라우저·production 확인을 완료한다

**Files:**
- Verify all changed files
- Verify unchanged: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `lib/rules/party.ts`, `lib/content/classes.ts`, `lib/content/names.ts`

- [ ] **Step 1: 완료 전 검증 지침을 적용한다**

`superpowers:verification-before-completion`을 읽고 아래 명령을 현재 커밋에서 새로 실행한다.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
git status --short
```

Expected: 모든 명령이 종료 코드 0이고 `git diff --check` 출력은 비어 있다.

- [ ] **Step 2: 개발 서버에서 동료용 수동 검증을 한다**

한 터미널에서 실행한다.

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000/state-preview`를 열어 다음을 확인한다.

1. 초기 seed `f2-preview-initial`과 R1 규칙 안내가 보인다.
2. 파티는 3~5명이며 각 카드에 이름, 한국어 직업명·ID, 성격, 개인 trust, alive 상태가 보인다.
3. seed `manual-seed`를 적용한 뒤 같은 값을 다시 적용하면 파티가 정확히 같다.
4. `manual-seed-2`를 적용하면 파티 구성 또는 trust가 바뀐다.
5. 빈 seed를 적용하면 오류가 보이고 현재 seed·파티·선택이 유지된다.
6. 파티원 선택과 선택 해제가 UI Store만 바꾼다.
7. 새 미리보기 런은 UUID seed와 새 파티를 만들고 선택을 해제한다.
8. 모두 초기화는 `f2-preview-initial`과 해당 초기 파티, 선택 없음으로 돌아간다.
9. browser console과 hydration error가 없다.

확인 뒤 개발 서버를 종료한다.

- [ ] **Step 3: production 공개 상태를 확인한다**

한 터미널에서 실행한다.

```bash
pnpm start
```

다른 터미널에서 실행한다.

```bash
curl --silent --output /dev/null --write-out "home %{http_code}\n" http://localhost:3000/
curl --silent --output /dev/null --write-out "preview %{http_code}\n" http://localhost:3000/state-preview
```

Expected: `home 200`, `preview 200`. `/state-preview` HTML에는 `R1 파티 생성 재현 확인`이 포함된다. 확인 뒤 production 서버를 종료한다.

- [ ] **Step 4: 범위와 최종 상태를 확인한다**

Run:

```bash
git diff origin/main...HEAD -- app/page.tsx app/layout.tsx app/globals.css lib/rules/party.ts lib/content/classes.ts lib/content/names.ts
git diff origin/main...HEAD --stat
git status --short
git log --oneline --decorate -12
```

Expected: 첫 diff 출력은 비어 있고 worktree는 깨끗하다.

- [ ] **Step 5: 최종 코드 리뷰를 요청한다**

`superpowers:requesting-code-review`로 새 follow-up spec, 구현 diff, 전체 검증 결과를 대조한다. 지적 사항이 있으면 `superpowers:receiving-code-review`로 검증한 후 해당 task의 테스트와 전체 검증을 다시 실행한다.

