# U5 던전 진행 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 던전 진행 화면을 만들고 `/u5-test`에서 아홉 상태를 확인할 수 있게 한다. 조언 3개가 시각적으로 구별되지 않는다는 계약을 테스트로 고정한다.

**Architecture:** 화면은 `ExpeditionState`를 직접 읽지 않는다. `u5-progress-model.ts`가 View 타입을 정의하고, `u5-preview-data.ts`가 **실제 `E2` 함수를 호출하되 사건만 fixture로 넣는다.** `E3`가 들어오면 사건 공급만 바뀌고 화면 코드는 그대로다. 조언 제시·반응 판정·생태 공개는 처음부터 실제 규칙이 한다.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, Vitest 4.1, 전역 CSS

**Spec:** `docs/superpowers/specs/2026-08-22-sbh3821-u5-dungeon-progress-design.md`

## Global Constraints

- `lib/`을 건드리지 않는다. 이 작업은 `E3`를 대신하지 않는다.
- 상단 상태 바를 화면 CSS에서 다시 선언하지 않는다.
- 크기는 `rem`과 `cqw`·`cqh`로만 쓴다. `vw`·`vh`와 `@media`를 새로 넣지 않는다.
- **조언 3개는 시각적으로 구별되지 않아야 한다.** 유형·정합·확률·신뢰 변화가 View 타입에 아예 없어야 한다.
- 색만으로 의미를 전달하지 않는다. 반응 셋에 문구를 함께 둔다.
- `u5/dungeon-progress-scenes` 자산 파일과 폴더 이름을 바꾸지 않는다.
- `pnpm backtest`는 실행하지 않는다.
- 새 의존성을 추가하지 않는다.
- 커밋 메시지는 제목과 본문을 포함한 한글로 작성한다.

## File Map

- `components/game/u5-progress-model.ts` (신규): View 타입과 장면 경로 매핑.
- `components/game/u5-log.ts` (신규): 진행 기록 항목과 필터.
- `components/game/u5-preview-data.ts` (신규): 실제 `E2` 호출 + 사건 fixture.
- `components/game/U5ProgressScreen.tsx` (신규): 화면.
- `components/game/U5Preview.tsx` (신규): 아홉 상태 전환.
- `app/u5-test/page.tsx` (신규): 라우트.
- `app/u5-progress.css` (신규): 시각 규칙.
- `app/layout.tsx`: 새 CSS import.
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`: `U5` 행 담당·상태 갱신.

## Task 1: Pin the scene asset contract

**Files:**
- Create: `components/game/U5Assets.test.ts`
- Create: `components/game/u5-progress-model.ts` (장면 매핑 부분만)

**Interfaces:**
- Consumes: `ThemeId` from `@/lib/domain`
- Produces: `sceneSrc(theme, kind)`

- [ ] **Step 1: Write the failing asset test**

18장이 실제 PNG이고 테마×종류 조합이 빠짐없음을 단정한다. `png-alpha.ts`의 `pngDimensions`를 재사용한다.

**`ThemeId`와 자산 폴더 이름이 어긋난다는 사실을 테스트로 고정한다.**

```ts
it("도메인 테마 이름과 자산 폴더 이름이 어긋나므로 한 곳에서만 매핑한다", () => {
  expect(sceneSrc("desert", "monster")).toContain("/dessert/");
  expect(sceneSrc("graveyard", "monster")).toContain("/tomb/");
  expect(sceneSrc("spider", "monster")).toContain("/spider/");
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/U5Assets.test.ts`

Expected: FAIL. 매핑이 아직 없다.

- [ ] **Step 3: Implement the mapping**

`u5-progress-model.ts`에 매핑을 만든다. 자산 폴더를 옮기지 않는 이유를 주석으로 남긴다. 이미 머지된 커밋의 경로가 깨지기 때문이다.

```ts
/** 도메인 테마 이름과 자산 폴더 이름이 어긋난다. 자산을 옮기면 이미 머지된
 *  커밋의 경로가 깨지므로 여기 한 곳에서만 잇는다. */
const SCENE_FOLDER: Readonly<Record<ThemeId, string>> = {
  spider: "spider",
  desert: "dessert",
  graveyard: "tomb",
};
```

- [ ] **Step 4: Run and commit**

```bash
pnpm test components/game/U5Assets.test.ts
git add components/game/U5Assets.test.ts components/game/u5-progress-model.ts
git commit -m "테스트: U5 장면 자산 계약과 테마 이름 매핑을 고정한다" -m "도메인 ThemeId 와 자산 폴더 이름이 어긋난다. 자산을 옮기면 이미 머지된 커밋의 경로가 깨지므로 한 곳에서만 잇고 그 어긋남을 테스트로 남긴다."
```

## Task 2: Define the ViewModel and prove advice stays opaque

**Files:**
- Modify: `components/game/u5-progress-model.ts`
- Create: `components/game/u5-progress-model.test.ts`
- Create: `components/game/u5-advice-presentation.test.ts`

**Interfaces:**
- Consumes: `InfoReaction`, `PresentedAdviceOption` from `@/lib/domain`
- Produces: `U5ProgressView` 와 그 하위 타입

- [ ] **Step 1: Write the failing opacity test**

이 화면에서 가장 중요한 계약이다. 조언 View 에 결론이 실리면 안 된다.

```ts
/*
 * 감추는 것은 결론이지 근거가 아니다. 유형·정합·확률·신뢰 변화가 View 타입에
 * 아예 없어야 화면이 실수로도 드러내지 못한다.
 */
it("조언 View 는 내부 판정값을 담지 않는다", () => {
  const option = view.advice[0];
  const keys = Object.keys(option);

  expect(keys.sort()).toEqual(["rationale", "slot", "text"]);
});

it("조언 3개의 렌더 결과가 슬롯 번호와 문구 말고는 같은 모양이다", () => {
  // 같은 클래스, 같은 요소 구조여야 한다
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/u5-`

Expected: FAIL. 모델이 아직 없다.

- [ ] **Step 3: Implement the ViewModel**

Spec 6절의 타입을 만든다. `PresentedAdviceOption`에서 View 로 옮길 때 **유형·정합·확률·신뢰 변화를 버린다.** 버리는 것이 이 함수의 목적이므로 그 사실을 주석에 적는다.

- [ ] **Step 4: Run and commit**

```bash
pnpm test components/game/u5- && pnpm typecheck
git add components/game/u5-progress-model.ts components/game/u5-progress-model.test.ts components/game/u5-advice-presentation.test.ts
git commit -m "기능: U5 화면 모델 경계를 정의하고 조언 불투명성을 고정한다" -m "조언 3개가 유형·정합·확률·신뢰 변화를 담지 않는다는 것이 이 화면의 가장 중요한 계약이다. View 타입에 그 필드를 두지 않아 화면이 실수로도 드러내지 못하게 하고, 테스트로 고정한다."
```

## Task 3: Build the progress log with its four filters

**Files:**
- Create: `components/game/u5-log.ts`
- Create: `components/game/u5-log-filter.test.ts`

**Interfaces:**
- Consumes: `U5LogEntry`
- Produces: 필터별 항목 선별

- [ ] **Step 1: Write the failing filter tests**

```ts
it("한 항목이 여러 필터에 걸린다", ...)
it("전체는 조언 선택·반응·결과를 시간 순으로 합친다", ...)
it("생태는 공개된 규칙만 담는다", ...)
it("단서를 규칙 문장으로 승격하지 않는다", ...)
```

**`생태` 탭이 이 화면에서 가장 조심스러운 자리다.** 단서가 규칙을 시사해도 화면이 대신 결론 내리면 안 된다. 확인된 생태와 관찰 단서를 구역으로 나누는 것을 여기서 고정한다.

- [ ] **Step 2: Run to confirm failure**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/u5-log-filter.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement the log**

한 항목이 여러 필터에 속할 수 있으므로 `filters: readonly U5LogFilter[]`로 둔다. 필터별로 목록을 복제하지 않는다.

- [ ] **Step 4: Run and commit**

```bash
pnpm test components/game/u5-log-filter.test.ts
git add components/game/u5-log.ts components/game/u5-log-filter.test.ts
git commit -m "기능: U5 진행 기록과 네 필터를 만든다" -m "한 항목이 여러 필터에 걸리므로 목록을 복제하지 않고 항목이 자기 필터를 가진다. 생태 탭은 공개된 규칙만 담고 관찰 단서를 규칙으로 승격하지 않는다."
```

## Task 4: Build the screen

**Files:**
- Create: `components/game/U5ProgressScreen.tsx`
- Create: `components/game/U5ProgressScreen.test.ts`
- Create: `app/u5-progress.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `U5ProgressView`, `GameShell`
- Produces: 장면 슬롯 40% + 콘솔 60%, 우측 파티 상태

- [ ] **Step 1: Write the failing component tests**

```ts
it("좌측을 장면 40% 와 콘솔 60% 로 나눈다", ...)
it("상황 묘사가 조언보다 먼저 온다", ...)
it("조언 3개가 같은 클래스와 같은 구조로 렌더된다", ...)
it("선택 전에는 결과 영역을 두지 않는다", ...)
it("선택 뒤 반응 → 결과 → 변화 순서로 보여준다", ...)
it("반응을 색이 아니라 문구로도 구분한다", ...)
it("아무도 수용하지 않으면 기본 결과 문구가 온다", ...)
it("콘솔 두 모드를 수동으로 바꿀 수 있다", ...)
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/U5ProgressScreen.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement the screen**

`GameShell`의 3:2를 쓰고 좌측을 40:60으로 나눈다. **조작 영역이 장면보다 넓다는 원칙을 지킨다.**

장면 슬롯은 배경 이미지를 `background-size: cover`로 깐다. 2048×768이라 슬롯보다 크므로 잘린다.

- [ ] **Step 4: Add CSS and register**

`app/u5-progress.css`를 만들고 `layout.tsx`에 import 한다.

- [ ] **Step 5: Run and commit**

```bash
pnpm test components/game/U5ProgressScreen.test.ts && pnpm lint
git add components/game/U5ProgressScreen.tsx components/game/U5ProgressScreen.test.ts app/u5-progress.css app/layout.tsx
git commit -m "기능: U5 던전 진행 화면을 만든다" -m "좌측 위 40% 장면 슬롯, 아래 60% 콘솔로 나눈다. 조작 영역이 장면보다 넓다는 원칙을 지킨다. 상황 묘사를 조언보다 먼저 두고, 선택 뒤에는 반응 → 결과 → 변화를 인과 순서로 보여준다."
```

## Task 5: Wire the preview with real E2 calls

**Files:**
- Create: `components/game/u5-preview-data.ts`
- Create: `components/game/u5-preview-data.test.ts`
- Create: `components/game/U5Preview.tsx`
- Create: `app/u5-test/page.tsx`
- Create: `components/game/U5FixedCanvas.test.ts`

**Interfaces:**
- Consumes: `presentShuffledAdvice`, `decideImmediateAdvice`, `finalizeImmediateAdviceTrust`, `disclosedRuleIds` from `@/lib/rules/advice-evaluation`
- Produces: `/u5-test`의 아홉 상태

- [ ] **Step 1: Write the failing fixture test**

**fixture 가 조언을 직접 만들지 않고 실제 `E2` 함수를 거친다는 것을 단정한다.** 이것이 `U6`와 다른 점이다.

```ts
it("조언 순서를 화면이 아니라 E2 가 정한다", () => {
  // 같은 seed 로 presentShuffledAdvice 를 직접 호출한 결과와 같아야 한다
});
it("반응이 E2 판정에서 온다", ...)
it("생태 목록이 disclosedRuleIds 에서 온다", ...)
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/u5-preview-data.test.ts`

Expected: FAIL.

- [ ] **Step 3: Build fixtures on top of real rules**

사건(`SituationEvent`)만 상수로 넣고, 조언 제시·반응·생태 공개는 실제 함수를 호출한다. 프리뷰 seed 를 상수로 고정한다.

`E3`가 들어오면 **이 파일에서 사건 공급만 바뀐다.** 그 자리를 주석으로 표시한다.

- [ ] **Step 4: Build preview and route**

`U1Preview`의 전환 버튼 방식을 따른다. Spec 9절의 아홉 상태를 담는다.

- [ ] **Step 5: Run the full checks**

```bash
cd /Users/semin/Develop/Dungeon_Schemer
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Expected: 네 명령이 모두 종료 코드 0이다.

- [ ] **Step 6: Commit**

```bash
git add components/game/u5-preview-data.ts components/game/u5-preview-data.test.ts components/game/U5Preview.tsx components/game/U5FixedCanvas.test.ts app/u5-test
git commit -m "기능: /u5-test 에 진행 화면 아홉 상태를 붙인다" -m "U6 와 달리 조언 제시·반응 판정·생태 공개를 실제 E2 함수가 한다. fixture 가 지어내는 것은 어떤 사건이 나왔는가 하나뿐이고, E3 가 들어오면 그 공급만 바뀐다."
```

## Task 6: Verify in a browser and update the assignment table

**Files:**
- Verify: `/u5-test`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Task 1~5의 커밋
- Produces: 네 창 비율 확인 기록과 갱신된 배정표

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm dev`

- [ ] **Step 2: Check nine states at four window ratios**

`http://localhost:3000/u5-test`에서 확인한다. **`127.0.0.1`로 열면 Next dev 가 정적 청크를 403으로 막아 하이드레이션이 실패하고 버튼이 먹지 않는다.**

1920×1080, 2560×1440, 1440×900, 1280×1024.

Expected:
- 캔버스 비율 1.778, 가운데 정렬
- 가로·세로 스크롤 없음
- 네 비율에서 줄바꿈과 상대 배치가 같음
- 콘솔 오류와 오류 overlay 없음
- 상단 상태 바가 다른 화면과 같은 크기
- **조언 3개가 스크린샷에서 서로 구별되지 않음**

- [ ] **Step 3: Update the assignment table**

`U5` 행의 담당을 `sbh3821`로, 상태를 `🟡`로 바꾼다. `✅`로 바꾸지 않는다. 선행 `E3`가 없어 실제 사건 공급이 남아 있다. 그 사실을 표 아래 주석에 적는다.

- [ ] **Step 4: Confirm repository state**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && git status --short --branch && git log --oneline origin/main..HEAD`

Expected: 작업 트리가 깨끗하고 커밋 여섯 개가 순서대로 있다.
