# U6 정산·승급·엔딩 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정산 화면과 엔딩 화면을 만들고 `/u6-test` 에서 여덟 상태를 결정적으로 확인할 수 있게 한다. 규칙(`C4`~`C8`)이 들어올 자리는 ViewModel 타입으로 먼저 고정한다.

**Architecture:** 화면은 `CampaignState` 를 직접 읽지 않는다. `u6-settlement-model.ts` 와 `u6-ending-model.ts` 가 View 타입을 정의하고, 지금은 `u6-preview-data.ts` 가 결정적 상수로 그 타입을 만든다. `C4`~`C8` 이 들어오면 같은 타입을 만드는 함수만 바뀌고 화면 코드는 그대로다. 정산과 엔딩은 성격이 달라 한 컴포넌트에 분기를 넣지 않고 둘로 나눈다.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, Tailwind CSS 4, Vitest 4.1, 전역 CSS

**Spec:** `docs/superpowers/specs/2026-08-22-sbh3821-u6-settlement-ending-design.md`

## Global Constraints

- 상단 상태 바를 화면 CSS 에서 다시 선언하지 않는다. `globals.css` 정의를 쓴다.
- 크기는 `rem` 과 `cqw`·`cqh` 로만 쓴다. `vw`·`vh` 와 `@media` 를 새로 넣지 않는다.
- CTA 아이콘은 `--cta-icon-optical-lift` 로 글자의 광학 중심선에 맞춘다.
- 색만으로 의미를 전달하지 않는다. 엔딩 종류·승급 가능 여부·전멸 여부에 문구를 함께 둔다.
- 자산은 화면에 넣기 전에 투명 여백을 걷어낸다.
- `lib/` 을 건드리지 않는다. 이 작업은 `C4`~`C8` 을 대신하지 않는다.
- `pnpm backtest` 는 실행하지 않는다.
- 새 의존성을 추가하지 않는다.
- 커밋 메시지는 제목과 본문을 포함한 한글로 작성한다.

## File Map

- `components/game/u6-settlement-model.ts` (신규): 정산·승급 View 타입과 순수 헬퍼.
- `components/game/u6-ending-model.ts` (신규): 엔딩 View 타입과 엔딩 종류 표시 정보.
- `components/game/u6-preview-data.ts` (신규): 여덟 상태의 결정적 fixture.
- `components/game/U6SettlementScreen.tsx` (신규): 정산 화면.
- `components/game/U6EndingScreen.tsx` (신규): 엔딩 화면.
- `components/game/U6Preview.tsx` (신규): 여덟 상태 전환 프리뷰.
- `app/u6-test/page.tsx` (신규): 프리뷰 라우트.
- `app/u6-result.css` (신규): 두 화면의 시각 규칙.
- `app/layout.tsx`: 새 CSS import.
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`: `U6` 행 상태와 담당 갱신.

## Task 1: Fix the U6 asset padding

**Files:**
- Create: `components/game/U6Assets.test.ts`
- Modify: `public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/**/*.png` (여백이 있는 것만)

**Interfaces:**
- Consumes: 없음
- Produces: 화면이 배치만 하면 되는, 여백 없는 자산

- [ ] **Step 1: Measure every U6 asset**

`docs/experience/SCREEN_LAYOUT.md` 의 「자산의 투명 여백」 규칙대로 39개 자산의 알파 경계를 잰다. 캔버스 대비 내용 비율과 상·하·좌·우 여백을 표로 남긴다.

`_source/result_asset_sheet.png` 는 원본 시트이므로 대상이 아니다.

- [ ] **Step 2: Add the failing asset contract test**

`components/game/U6Assets.test.ts` 를 만든다. `U3Assets.test.ts` 의 `pngDimensions` 와 `pngAlphaPadding` 헬퍼를 그대로 쓰되, 여러 화면이 같은 헬퍼를 복사하지 않도록 `components/game/png-alpha.ts` 로 뽑아 양쪽이 함께 쓴다.

화면에서 실제로 쓰는 자산만 계약으로 고정한다. 쓰지 않는 자산까지 묶으면 나중에 자산을 정리할 때 관계없는 테스트가 깨진다.

- [ ] **Step 3: Crop the assets that carry padding**

여백이 있는 자산만 경계에 맞춰 자른다. 나란히 놓이는 자산끼리 비율을 맞춰야 하거나(등급 문장 4종) 도형이 상하 비대칭이라 무게중심 보정이 필요하면 그 값을 남기고 **이유를 테스트 주석에 적는다.**

- [ ] **Step 4: Run the asset test**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/U6Assets.test.ts`

Expected: 자산 계약이 통과한다.

- [ ] **Step 5: Commit**

```bash
git add components/game/U6Assets.test.ts components/game/png-alpha.ts components/game/U3Assets.test.ts public/assets/u6
git commit -m "수정: U6 결과 화면 자산의 투명 여백을 걷어낸다" -m "화면이 배치만 하면 되도록 자산의 여백을 없앤다. 여러 화면이 같은 알파 측정 헬퍼를 복사하지 않도록 png-alpha.ts 로 뽑는다."
```

## Task 2: Define the ViewModel boundary

**Files:**
- Create: `components/game/u6-settlement-model.ts`
- Create: `components/game/u6-settlement-model.test.ts`
- Create: `components/game/u6-ending-model.ts`
- Create: `components/game/u6-ending-model.test.ts`

**Interfaces:**
- Consumes: `RiskLevel`, `GuideRank`, `ThemeId`, `EndingKind` from `@/lib/domain`
- Produces: `U6SettlementView`, `U6PromotionView`, `U6EndingView` 와 그 순수 헬퍼

- [ ] **Step 1: Write the failing model tests**

`u6-settlement-model.test.ts`:

```ts
it("원인 사슬은 1~5 순서를 빠뜨리지 않는다", ...)
it("전멸이면 계약 보상이 0 이고 유품이 들어온다", ...)
it("전멸의 명성 손실은 상승 전 위험도를 쓴다", ...)
it("★5 던전은 위험도가 더 오르지 않는다", ...)
```

`u6-promotion` 은 정산 모델 안에 둔다. 승급은 정산 화면에서만 일어나므로 파일을 나누면 오히려 흩어진다.

```ts
it("명성 경로와 골드 경로가 독립으로 열린다", ...)
it("명성 승급은 명성을 줄이지 않는다", ...)
it("최고 등급이면 promotion 이 null 이다", ...)
```

`u6-ending-model.test.ts`:

```ts
it("엔딩 5종이 각각 제목과 판정 근거를 가진다", ...)
it("completed 만 정상 완주로 표시된다", ...)
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/u6-`

Expected: FAIL. 모델이 아직 없다.

- [ ] **Step 3: Implement the models**

Spec 6절의 타입을 그대로 만든다. 규칙 계산을 여기에 넣지 않는다. **이 파일은 화면이 받을 모양을 정의할 뿐이고, 값을 만드는 책임은 `C4`~`C8` 에 있다.** 지금 넣는 순수 헬퍼는 표시용 파생값(등급 문장 경로, 엔딩 제목, 위험도 상한 여부)까지다.

엔딩 제목은 `EndingKind` 에서 파생한다.

```ts
const ENDING_TITLE: Readonly<Record<EndingKind, string>> = {
  distrust: "불신의 대가",
  denounced: "누적 고발",
  completed: "원정 종료",
  exhausted: "인력 소진",
  unemployed: "실직",
};
```

- [ ] **Step 4: Run the model tests**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/u6- && pnpm typecheck`

Expected: 모델 테스트 전부 통과, 타입 검사 통과.

- [ ] **Step 5: Commit**

```bash
git add components/game/u6-settlement-model.ts components/game/u6-settlement-model.test.ts components/game/u6-ending-model.ts components/game/u6-ending-model.test.ts
git commit -m "기능: U6 정산과 엔딩의 화면 모델 경계를 정의한다" -m "화면이 CampaignState 를 직접 읽지 않도록 View 타입을 먼저 고정한다. C4~C8 이 들어오면 같은 타입을 만드는 함수만 바뀌고 화면 코드는 그대로다."
```

## Task 3: Build the settlement screen

**Files:**
- Create: `components/game/U6SettlementScreen.tsx`
- Create: `components/game/U6SettlementScreen.test.ts`
- Create: `app/u6-result.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `U6SettlementView`, `GameShell`, `TopStatusView`
- Produces: 원인 사슬 좌측과 변화·승급 우측

- [ ] **Step 1: Write the failing component test**

landmark 와 접근성 속성, 그리고 색 외 단서를 단정한다.

```ts
it("원인 사슬을 번호와 함께 순서대로 보여준다", ...)
it("전멸이면 계약 보상 없음과 유품 회수를 문구로 밝힌다", ...)
it("위험도 변화를 전후로 함께 보여준다", ...)
it("승급 두 경로를 나란히 보여주고 미달 시 무엇이 모자란지 적는다", ...)
it("최고 등급이면 승급 영역을 두지 않는다", ...)
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/U6SettlementScreen.test.ts`

Expected: FAIL. 컴포넌트가 없다.

- [ ] **Step 3: Implement the screen**

`GameShell` 의 3:2 를 쓴다. 좌측은 번호가 붙은 5단계, 우측은 위험도·보상 변화와 승급이다.

승급 버튼은 `u3-contract-button` 을 복사하지 않는다. 두 화면이 같은 CTA 모양을 쓴다면 공용 클래스로 뽑고, 다르다면 왜 다른지 `app/u6-result.css` 주석에 적는다.

- [ ] **Step 4: Add the CSS and register it**

`app/u6-result.css` 를 만들고 `app/layout.tsx` 에 import 한다. 상태 바를 다시 선언하지 않는다. `vw`·`vh`·`@media` 를 쓰지 않는다.

- [ ] **Step 5: Run the focused checks**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/U6SettlementScreen.test.ts && pnpm lint`

Expected: 통과.

- [ ] **Step 6: Commit**

```bash
git add components/game/U6SettlementScreen.tsx components/game/U6SettlementScreen.test.ts app/u6-result.css app/layout.tsx
git commit -m "기능: U6 정산 화면을 만든다" -m "좌측에 선택부터 캠페인 변화까지의 원인 사슬을 번호로 나열하고, 우측에 위험도·보상 변화와 명성·골드 두 승급 경로를 나란히 둔다."
```

## Task 4: Build the ending screen

**Files:**
- Create: `components/game/U6EndingScreen.tsx`
- Create: `components/game/U6EndingScreen.test.ts`
- Modify: `app/u6-result.css`

**Interfaces:**
- Consumes: `U6EndingView`, `GameShell`
- Produces: 판정·최종 등급 좌측과 회고 우측

- [ ] **Step 1: Write the failing component test**

```ts
it("엔딩 종류와 판정 근거 문장을 가장 크게 보여준다", ...)
it("최종 등급을 등급 문장과 문구로 함께 보여준다", ...)
it("정상 완주와 조기 종료를 색이 아니라 문구로 구분한다", ...)
it("누적 통계와 전환점과 연대기를 함께 보여준다", ...)
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/U6EndingScreen.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement the screen**

좌측은 엔딩 표제(문양 + 제목 + `reason`)와 최종 등급이다. 우측은 회고이고, 수치를 나열하기 전에 문장이 먼저 온다.

연대기는 원정 15회를 넘지 않으므로 스크롤 없이 담기게 한다. 담기지 않으면 항목을 줄이지 말고 행 높이를 줄인다. 회고에서 원정 하나를 빼면 그 원정의 선택이 사라진다.

- [ ] **Step 4: Run the focused checks**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/U6EndingScreen.test.ts && pnpm lint`

Expected: 통과.

- [ ] **Step 5: Commit**

```bash
git add components/game/U6EndingScreen.tsx components/game/U6EndingScreen.test.ts app/u6-result.css
git commit -m "기능: U6 엔딩 화면을 만든다" -m "엔딩 5종의 판정 근거와 최종 등급을 좌측에 크게 두고, 우측에 누적 통계와 전환점과 원정 연대기를 회고로 둔다."
```

## Task 5: Wire the preview route

**Files:**
- Create: `components/game/u6-preview-data.ts`
- Create: `components/game/u6-preview-data.test.ts`
- Create: `components/game/U6Preview.tsx`
- Create: `app/u6-test/page.tsx`
- Create: `components/game/U6FixedCanvas.test.ts`

**Interfaces:**
- Consumes: Task 2~4 의 모델과 화면
- Produces: `/u6-test` 의 여덟 상태

- [ ] **Step 1: Write the failing fixture and canvas tests**

`u6-preview-data.test.ts` 는 여덟 상태가 모두 있고 결정적임을 단정한다. `U6FixedCanvas.test.ts` 는 `app/u6-result.css` 에 `vw`·`vh`·`@media` 가 없고 상태 바 재선언이 없음을 단정한다.

- [ ] **Step 2: Run to confirm failure**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm test components/game/u6-preview-data.test.ts components/game/U6FixedCanvas.test.ts`

Expected: FAIL.

- [ ] **Step 3: Build the fixtures**

Spec 9절의 여덟 상태를 결정적 상수로 만든다. 프리뷰 seed 를 상수로 고정한다.

- [ ] **Step 4: Build the preview and route**

`U1Preview` 의 화면 전환 버튼 방식을 그대로 쓴다. `app/u6-test/page.tsx` 는 `U6Preview` 만 렌더링한다.

- [ ] **Step 5: Run the full checks**

```bash
cd /Users/semin/Develop/Dungeon_Schemer
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Expected: 네 명령이 모두 종료 코드 0 이다. `main` 에서 이미 실패하던 문서 테스트가 있다면 그것과 같은 목록인지 확인하고, 새로 생긴 실패가 없어야 한다.

- [ ] **Step 6: Commit**

```bash
git add components/game/u6-preview-data.ts components/game/u6-preview-data.test.ts components/game/U6Preview.tsx components/game/U6FixedCanvas.test.ts app/u6-test
git commit -m "기능: /u6-test 에 정산과 엔딩 여덟 상태를 붙인다" -m "규칙 C4~C8 이 아직 없으므로 결정적 fixture 로 화면을 검증한다. 실제 CampaignState 연결은 I2 의 몫이다."
```

## Task 6: Verify in a browser and update the assignment table

**Files:**
- Verify: `/u6-test`
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Task 1~5 의 커밋
- Produces: 네 창 비율에서 확인한 기록과 갱신된 배정표

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && pnpm dev`

- [ ] **Step 2: Check the eight states at four window ratios**

1920×1080, 2560×1440, 1440×900, 1280×1024 에서 여덟 상태를 각각 확인한다.

Expected:
- 캔버스 비율이 1.778 이고 가운데 정렬된다.
- 가로·세로 스크롤이 없다.
- 네 비율에서 줄바꿈과 상대 배치가 같다.
- 콘솔 오류와 Next 오류 overlay 가 없다.
- 상단 상태 바가 `/u2-test` `/u3-test` 와 같은 크기다.

- [ ] **Step 3: Update the assignment table**

`U6` 행의 담당을 `sbh3821` 로, 상태를 진행 중으로 바꾼다. **`✅` 로 바꾸지 않는다.** 선행 `C4`~`C8` 이 없어 실제 데이터 연결이 남아 있다. 그 사실을 배정표 주석에 적는다.

- [ ] **Step 4: Confirm repository state**

Run: `cd /Users/semin/Develop/Dungeon_Schemer && git status --short --branch && git log --oneline origin/main..HEAD`

Expected: 작업 트리가 깨끗하고 커밋 여섯 개가 순서대로 있다.
