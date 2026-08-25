# U5 조언 카드 번호 제거 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 던전 진행 화면의 조언 카드 세 장에서 시각용 숫자 `1`·`2`·`3`만 제거하고, 내부 슬롯 기반 선택 동작은 그대로 유지한다.

**Architecture:** `U5ProgressScreen`은 계속 각 조언의 내부 `slot` 값을 React key와 `onSelectAdvice(slot)` callback에 전달한다. 플레이어에게만 보이던 `.u5-advice__slot` 마크업과 그 전용 CSS를 없애며, 서버 렌더링 테스트가 숫자 배지의 부재와 기존 카드 구조를 함께 고정한다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5.9, CSS Grid, Vitest 4.1.10

**Spec:** `docs/superpowers/specs/2026-08-25-lattebun-u5-advice-number-removal-design.md`

## Global Constraints

- 숫자 배지 `1`·`2`·`3`만 제거하고 카드의 문구·근거·골드 비용·선택 불가 사유는 유지한다.
- 내부 `slot`, React key, `onSelectAdvice(slot)` 선택 연결과 조언 셔플 규칙은 변경하지 않는다.
- 카드 세 장의 동일한 외형, 리벳, 테두리, hover, 비활성 상태와 `focus-visible` 표현을 유지한다.
- 숫자 자리에 아이콘, 문자 또는 다른 순서 표식을 추가하지 않는다.
- 게임 규칙과 공식 경험 문서는 수정하지 않고 `docs/README.md` 색인만 spec·plan 링크로 갱신한다.
- 구현 전에 `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`를 끝까지 읽어 현재 Next.js 16의 전역 CSS 규칙을 확인한다.

---

### Task 1: 숫자 배지 부재와 내부 슬롯 연결 계약

**Files:**
- Modify: `components/game/U5ProgressScreen.test.tsx:112-131`
- Modify: `components/game/U5ProgressScreen.tsx:58-99`
- Modify: `app/u5-progress.css:212-284`

**Interfaces:**
- Consumes: `U5ProgressView["advice"]`의 `{ slot, text, rationale, goldCost?, unavailableReason? }`와 `U5ProgressScreen`의 `onSelectAdvice?: (slot: number) => void`
- Produces: 숫자 표시 없이 조언 문구·근거 등을 렌더링하고 선택 때 기존 `slot` 값을 전달하는 `AdviceOption`

- [ ] **Step 1: 현재 Next.js CSS 공식 문서를 읽는다**

Run:

```bash
sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/11-css.md
```

Expected: 현재 프로젝트처럼 root layout에서 전역 CSS를 가져오는 방식이 지원됨을 확인한다. 이번 변경은 import 구조를 바꾸지 않고 기존 `app/u5-progress.css`에서 죽은 선택자만 제거한다.

- [ ] **Step 2: 숫자 배지가 남지 않는 실패 테스트를 작성한다**

`components/game/U5ProgressScreen.test.tsx`의 `U5ProgressScreen` describe에서 세 카드 구조 테스트 바로 뒤에 다음 테스트를 추가한다.

```ts
it("조언 카드에 숫자 슬롯 배지를 표시하지 않는다", () => {
  const html = render();
  const adviceHtml = (html.match(/<ul class="u5-advice-list"[\s\S]*?<\/ul>/) ?? [""])[0];

  expect(adviceHtml).not.toContain("u5-advice__slot");
  expect(adviceHtml).not.toMatch(/>1<|>2<|>3</);
});
```

같은 테스트 파일의 `잠긴 조언` describe에, 잠긴 카드도 숫자 배지를 만들지 않는지 확인하는 기대를 추가한다.

```ts
expect(html).not.toContain("u5-advice__slot");
```

이 테스트는 카드 문구나 비용에 들어갈 수 있는 임의의 숫자와 분리하기 위해 `u5-advice-list` 내부만 검사한다. 기본 fixture의 조언 문구와 근거에는 `1`·`2`·`3`이 없으므로, 숫자 배지가 되살아나면 정확히 실패한다.

- [ ] **Step 3: 테스트가 올바른 이유로 실패하는지 확인한다**

Run:

```bash
pnpm vitest run components/game/U5ProgressScreen.test.tsx
```

Expected: 새 `조언 카드에 숫자 슬롯 배지를 표시하지 않는다` 테스트가 `u5-advice__slot` 또는 `>1<`·`>2<`·`>3<` 검출로 FAIL한다. 기존 테스트는 PASS한다.

- [ ] **Step 4: 숫자 마크업과 전용 CSS만 제거한다**

`components/game/U5ProgressScreen.tsx`의 `AdviceOption`에서 다음 숫자 마크업과 그에 맞춘 주석을 제거한다.

```tsx
<span className="u5-advice__slot" aria-hidden="true">{slot + 1}</span>
```

`slot` prop과 아래 callback은 그대로 둔다.

```tsx
onClick={() => onSelect?.(slot)}
```

`app/u5-progress.css`에서는 다음 두 규칙을 완전히 제거한다.

```css
.u5-advice__slot { /* 숫자 배지 전용 선언 전체 */ }

.u5-advice__button:disabled .u5-advice__slot {
  border-color: #6b5c42;
  color: #8b7a5c;
}
```

`.u5-advice__content`의 `display`, `grid-template-rows: repeat(4, auto)`, 중앙 정렬, 간격과 padding은 이 작업에서 바꾸지 않는다. 남는 grid 행은 콘텐츠를 중앙에 유지하며 카드의 문구·근거·비용·잠금 사유를 기존처럼 배치한다.

- [ ] **Step 5: 대상 테스트가 통과하는지 확인한다**

Run:

```bash
pnpm vitest run components/game/U5ProgressScreen.test.tsx components/game/u5-advice-presentation.test.ts
```

Expected: 모든 대상 테스트 PASS. 조언 세 장은 동일한 구조를 유지하고, 숫자 슬롯 배지는 일반·잠긴 카드 모두에 없으며, 화면 model의 슬롯-조언 연결 계약도 계속 PASS한다.

- [ ] **Step 6: 구현 변경을 커밋한다**

```bash
git add components/game/U5ProgressScreen.test.tsx components/game/U5ProgressScreen.tsx app/u5-progress.css
git commit -m "화면: U5 조언 카드 번호를 제거한다" -m "카드의 숫자 배지를 없애고 내부 슬롯 기반 선택 연결은 그대로 유지한다."
```

---

### Task 2: 문서 색인과 전체 회귀·화면 검증

**Files:**
- Modify: `docs/README.md:103`
- Verify: `docs/superpowers/specs/2026-08-25-lattebun-u5-advice-number-removal-design.md`
- Verify: `docs/superpowers/plans/2026-08-25-lattebun-u5-advice-number-removal.md`
- Verify: `components/game/U5ProgressScreen.tsx`
- Verify: `app/u5-progress.css`
- Verify: `components/game/U5ProgressScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1의 숫자 없는 `AdviceOption`과 CSS 계약
- Produces: 색인에서 찾을 수 있는 설계·계획 문서, 자동 회귀와 실제 U5 화면에서 확인된 숫자 없는 카드

- [ ] **Step 1: 문서 색인에 구현 계획 링크를 추가한다**

`docs/README.md`의 `## 이번 개편 설계` 목록에서 U5 spec 바로 다음에 다음 줄을 추가한다.

```md
- [U5 조언 카드 번호 제거 구현 계획](superpowers/plans/2026-08-25-lattebun-u5-advice-number-removal.md): 조언 카드의 숫자 배지를 테스트 우선으로 제거하고 내부 슬롯 선택 계약을 유지하는 구현 순서
```

게임 원칙, 화면 구조, 조언 규칙에는 변경이 없으므로 다른 공식 문서 본문은 수정하지 않는다.

- [ ] **Step 2: 전체 자동 검사를 실행한다**

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
git diff --check HEAD~1..HEAD
```

Expected: 전체 단위 테스트 PASS, lint 오류 0개, TypeScript 오류 0개, 구현 커밋에 공백 오류 없음. 기존 실패나 경고가 있으면 명령 출력과 이번 변경 파일에 닿는지 여부를 기록하고, 범위 밖 파일은 수정하지 않는다.

- [ ] **Step 3: 개발 서버를 실행한다**

Run:

```bash
pnpm dev
```

Expected: Next.js 개발 서버가 로컬 주소를 출력하고 `/u5-test` 및 `/campaign` 경로를 제공한다.

- [ ] **Step 4: U5 프리뷰에서 카드 모양과 선택을 확인한다**

Open: `http://localhost:3000/u5-test`

Verify:

- 조언 카드 세 장 어디에도 `1`·`2`·`3` 숫자 배지나 대체 순서 표식이 없다.
- 카드 문구와 근거가 온전히 보이며 리벳·테두리·hover·키보드 포커스가 유지된다.
- 카드 세 장의 크기와 외형이 같고 콘텐츠가 자연스럽게 중앙에 놓인다.
- 각 카드를 클릭하면 기존과 같은 선택 결과와 다음 단계 흐름이 발생한다.
- 잠긴 조언이 있는 프리뷰 상태에서는 잠금 사유와 비활성 상태는 보이되 숫자 배지는 보이지 않는다.
- 브라우저 콘솔 오류와 Next.js 오류 오버레이가 없다.

- [ ] **Step 5: 실제 캠페인 진행 화면을 확인한다**

Open: `http://localhost:3000/campaign`

카드 선택 기회가 열리는 던전 진행 화면까지 진행하고, 프리뷰와 동일하게 숫자가 없으며 실제 선택이 올바른 조언을 적용하는지 확인한다. 1920×1080 고정 캔버스에서 카드 콘텐츠가 잘리거나 겹치지 않고 가로·세로 스크롤이 생기지 않아야 한다.

- [ ] **Step 6: 문서와 구현 계획을 커밋한다**

```bash
git add docs/README.md docs/superpowers/plans/2026-08-25-lattebun-u5-advice-number-removal.md
git commit -m "계획: U5 조언 카드 번호 제거 순서를 정리한다" -m "숫자 배지 제거의 테스트 우선 구현과 화면 검증 절차를 문서화한다."
```

- [ ] **Step 7: 브랜치 상태와 커밋 범위를 확인한다**

Run:

```bash
git status --short --branch
git log --oneline HEAD~3..HEAD
```

Expected: 의도하지 않은 파일이 없고, U5 조언 카드 번호 제거의 설계·구현 계획·구현 커밋만 이번 작업 단위에 포함된다. 기존 사용자 파일인 `.pnpm-store/`와 `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/`는 stage하거나 커밋하지 않는다.
