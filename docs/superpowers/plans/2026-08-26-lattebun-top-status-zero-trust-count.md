# 상단 상태 바 신뢰 0 인원 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 `GameShell` 화면의 공통 상단 상태 바에 현재 살아 있는 신뢰 0 인원과 누적 고발 기준을 `신뢰 0 n / 5`로 항상 표시한다.

**Architecture:** C6의 `countLivingZeroTrust(campaign)`와 도메인의 `DENOUNCE_THRESHOLD`가 유일한 규칙 원본이다. `statusFor()`와 규칙 기반 프리뷰 어댑터가 이를 `TopStatusView.zeroTrust`로 옮기고, `TopStatusBar`는 필수 View 값만 기존 `StatusItem`으로 렌더링한다. 저장 상태와 전이는 바꾸지 않으며 최대 7개 칩과 최신 전역 퀵 메뉴의 비겹침을 Chromium에서 수치로 고정한다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5.x, Zustand 5.0.14, CSS Flexbox, Vitest 4.1.10, Playwright 1.62.1, Node.js 24.19.0, pnpm 11.21.0

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-top-status-zero-trust-count-design.md`

## Global Constraints

- 표시 문구는 `신뢰 0 n / 5`이며 칩은 0명부터 모든 `GameShell` 화면에 항상 표시한다.
- 칩 순서는 `길잡이 등급 → 현재 명성 → 골드 → 승급 → 신뢰 0 → 남은 던전 → 현재 던전(원정 중)`이다.
- `n`은 `countLivingZeroTrust(campaign)` 결과이며 5를 초과해도 제한하지 않는다.
- 기준값은 `DENOUNCE_THRESHOLD`를 사용하고 화면과 fixture에 숫자 5를 별도 하드코딩하지 않는다.
- `CampaignState`와 캐릭터 상태에 카운터·이력 필드를 추가하지 않는다.
- `TopStatusBar`는 `CampaignState`, `TRUST_MIN`, `DENOUNCE_THRESHOLD`, C6 규칙을 import하지 않는다.
- `statusFor()`와 프리뷰 어댑터는 집계 조건을 다시 작성하지 않고 selector 결과를 View로 옮긴다.
- 활성 원정 파티를 캠페인 풀에 합성하는 두 번째 집계 경로를 만들지 않고 기존 반영 시점을 유지한다.
- U6 `trustPressure`는 정산 변화 설명용 View로 남기고 공통 상태 바가 이를 재사용하거나 의존하지 않는다.
- 새 칩은 읽기 전용이며 경고 색상, 점멸, 애니메이션, 툴팁, 상세 모달을 추가하지 않는다.
- 기존 `StatusItem`, `GameShell`, `app/globals.css`의 공통 `--status-*` 토큰을 재사용한다.
- 화면별 상태 바 CSS 재정의, 줄바꿈, 텍스트 잘림, 상태 바 내부 가로 스크롤을 허용하지 않는다.
- 최대 7개 칩은 전역 퀵 메뉴 트리거와 열린 패널을 가리거나 겹치지 않는다.
- 새 패키지를 추가하지 않는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.
- React 컴포넌트 작업 전에 `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`를 끝까지 읽는다.
- CSS·정적 SVG 작업 전에 `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`와 `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md`를 끝까지 읽는다.
- Playwright 작업 전에 `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md`를 끝까지 읽는다.

## File Map

| 파일 | 책임 |
| --- | --- |
| `docs/README.md` | Spec과 Plan 색인 |
| `docs/experience/SCREEN_LAYOUT.md` | 6·7개 칩 및 전역 퀵 메뉴 비겹침 공식 화면 계약 |
| `docs/experience/ONBOARDING_AND_INTERFACE.md` | 캠페인 공통 정보와 사망자 제외·누적 고발 연결 |
| `docs/technical/SCREEN_ADAPTER_CONTRACT.md` | `CampaignState → statusFor() → TopStatusView` 경계 |
| `components/game/TopStatusBar.tsx` | `TopStatusView.zeroTrust` 타입과 읽기 전용 칩 렌더링 |
| `components/game/TopStatusBar.test.ts` | 문구·아이콘·순서·읽기 전용·초과 표시 계약 |
| `components/game/campaign-adapters.ts` | C6 selector와 도메인 기준을 런타임 상태 View로 변환 |
| `components/game/campaign-adapters.test.ts` | 초기·생존·사망·기준 초과 어댑터 계약 |
| `components/game/U2Preview.tsx`, `components/game/u1-preview-data.ts` | 규칙을 실행하지 않는 정적 상태 fixture |
| `components/game/GameShell.test.ts`, `components/game/IntroScreen.test.ts`, `components/game/U3BoardScreen.test.ts`, `components/game/U4DungeonMapScreen.test.tsx`, `components/game/U5ProgressScreen.test.tsx`, `components/game/U6SettlementScreen.test.ts` | 필수 `TopStatusView.zeroTrust`를 가진 순수 화면 fixture |
| `components/game/U3Preview.tsx` | 실제 캠페인을 `statusFor(campaign, null)`로 변환하는 게시판 프리뷰 |
| `components/game/u4-preview-data.ts`, `components/game/u5-preview-data.ts` | 캠페인 기반 지도·진행 프리뷰의 selector 기반 신뢰 0 View |
| `components/game/u6-preview-data.ts` | 실제 정산·엔딩 캠페인을 `statusFor(campaign, null)`로 변환 |
| `components/game/u1-preview-data.test.ts`, `components/game/u5-preview-data.test.ts`, `components/game/u6-preview-data.test.ts` | 정적·규칙 기반 프리뷰의 zeroTrust 원본 회귀 |
| `public/assets/u2/status-trust.svg` | 공통 24×24 금빛 신뢰 붕괴 상태 아이콘 |
| `components/game/StatusBarConsistency.test.ts` | 상태 바 CSS 단일 정의와 토큰 계약 |
| `app/globals.css` | 시각 검증에서 필요할 때만 조정하는 공통 상태 바 토큰 |
| `e2e/canvas-layout.spec.ts` | 7개 칩 내부 overflow·동일 행·전역 퀵 메뉴 비겹침 계약 |

---

## Execution Preflight: Spec·Plan 보존과 최신 main 통합

- [ ] **Step 1: 구현용 격리 worktree를 준비한다**

Use: `superpowers:using-git-worktrees`

Expected: 이 브랜치의 격리 worktree에 이미 있으면 그대로 사용하고, 아니면 현재 사용자 작업과 분리된 worktree를 만든다.

- [ ] **Step 2: 승인된 Spec과 Plan을 커밋한다**

Run:

```bash
git add docs/superpowers/specs/2026-08-26-lattebun-top-status-zero-trust-count-design.md docs/superpowers/plans/2026-08-26-lattebun-top-status-zero-trust-count.md
git commit -m "문서: 상단 신뢰 0 표시 설계와 계획을 보완한다" -m "기준 초과 표시, 규칙 기반 프리뷰, 전역 퀵 메뉴 비겹침과 pnpm 검증 계약을 구현 전에 고정한다."
```

Expected: Spec과 Plan만 한글 제목·본문 커밋으로 보존되고 기존 미추적 파일은 포함되지 않는다.

- [ ] **Step 3: 최신 main을 통합한다**

Run:

```bash
git fetch origin main
git merge origin/main -m "병합: 최신 main 변경을 반영한다" -m "상단 신뢰 0 표시 설계와 계획을 유지하면서 전역 퀵 메뉴를 포함한 선행 변경을 통합한다."
```

Expected: `components/game/AppFrame.tsx`, `app/app-frame.css`, 최신 U5 진행 화면 변경을 포함한 main이 통합된다. 충돌이 생기면 main의 최신 동작과 이 Spec 문서를 모두 보존한다.

- [ ] **Step 4: 필수 Next.js 문서를 끝까지 읽는다**

Run:

```bash
sed -n '1,9999p' node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
sed -n '1,9999p' node_modules/next/dist/docs/01-app/01-getting-started/11-css.md
sed -n '1,9999p' node_modules/next/dist/docs/01-app/01-getting-started/12-images.md
sed -n '1,9999p' node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md
```

Expected: 현재 설치된 Next.js 16.3.0의 컴포넌트·CSS·정적 이미지·Playwright 지침을 EOF까지 확인한다.

- [ ] **Step 5: 최신 기준선을 검증한다**

Run:

```bash
pnpm vitest run components/game/TopStatusBar.test.ts components/game/campaign-adapters.test.ts components/game/StatusBarConsistency.test.ts
pnpm typecheck
```

Expected: 관련 테스트와 typecheck가 변경 전 기준에서 PASS한다. 실패가 있으면 이번 기능과 분리해 사용자에게 먼저 보고한다.

---

### Task 1: 공식 문서에 공통 신뢰 0 상태 계약 기록

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/technical/SCREEN_ADAPTER_CONTRACT.md`

**Interfaces:**
- Consumes: 승인된 Spec의 표시 문구, selector 경계, 6·7개 칩 및 전역 퀵 메뉴 계약
- Produces: 이후 코드·테스트 Task가 따라야 하는 공식 화면·어댑터 문서

- [ ] **Step 1: `docs/README.md`에 Spec과 Plan을 색인한다**

`## 이번 개편 설계`에 다음 두 항목을 추가한다.

```markdown
- [상단 상태 바 신뢰 0 인원 표시 설계](superpowers/specs/2026-08-26-lattebun-top-status-zero-trust-count-design.md): 살아 있는 신뢰 0 인원과 누적 고발 기준을 C6 selector에서 공통 상태 바로 전달하는 화면 계약
- [상단 상태 바 신뢰 0 인원 표시 구현 계획](superpowers/plans/2026-08-26-lattebun-top-status-zero-trust-count.md): 필수 View 계약, 프리뷰 원본 구분, 읽기 전용 칩과 최대 7개 레이아웃 검증의 테스트 우선 실행 순서
```

- [ ] **Step 2: `SCREEN_LAYOUT.md`의 상단 상태 바 계약을 갱신한다**

게임 셸 트리를 다음 의미로 바꾸고, 공용 요소 규칙 아래에 6·7개 칩 계약을 추가한다.

```markdown
GameShell
├─ TopStatusBar   길잡이 등급 · 명성 · 골드 · 승급 · 살아 있는 신뢰 0 인원 / 누적 고발 기준 · 남은 던전 · 원정 중 현재 던전
├─ MainContent    좌측 약 60%
└─ RightPanel     우측 약 40%

상단 상태 바는 기본 화면에서 6개, 현재 던전을 함께 표시하는 원정 화면에서 최대 7개 칩을 한 줄로 유지한다. 살아 있고 `trust === 0`인 인원과 누적 고발 기준을 `신뢰 0 n / 5`로 항상 표시하며 사망자는 `n`에서 제외한다. 상태 바 내부 가로 스크롤과 화면별 CSS 재정의는 허용하지 않는다. 전역 퀵 메뉴 트리거와 열린 패널도 최대 7개 칩을 가리거나 겹치지 않아야 한다.
```

- [ ] **Step 3: `ONBOARDING_AND_INTERFACE.md`의 캠페인 공통 정보에 신뢰 0을 추가한다**

`## 캠페인 공통 정보` 목록에 다음 항목과 설명을 추가한다.

```markdown
- 살아 있는 신뢰 0 인원 / 누적 고발 기준

신뢰 0 인원은 현재 캠페인 풀에서 살아 있고 `trust === 0`인 캐릭터만 센다. 사망자는 빠지므로 숫자는 감소할 수 있고, 5명 이상이면 정산과 월드턴 뒤 `누적 고발` 엔딩이 성립한다.
```

- [ ] **Step 4: `SCREEN_ADAPTER_CONTRACT.md`에 `statusFor()` 경계를 기록한다**

`## 경계의 모양` 뒤에 다음 절을 추가한다.

````markdown
### 공통 상단 상태 — C5 승급과 C6 신뢰 누적

`components/game/campaign-adapters.ts`의 `statusFor(campaign, active)`가 `CampaignState`를 `TopStatusView`로 바꾸는 런타임 경계다. 어댑터는 집계 조건을 다시 쓰지 않고 C6 selector와 도메인 상수를 표시용 View로 옮긴다.

```ts
zeroTrust: {
  livingCount: countLivingZeroTrust(campaign),
  threshold: DENOUNCE_THRESHOLD,
}
```

`TopStatusBar`는 `CampaignState`, `TRUST_MIN`, `DENOUNCE_THRESHOLD`, C6 규칙을 import하지 않는다. 활성 원정 파티를 캠페인 풀에 합성하지 않고 현재 캠페인 풀에 반영된 확정 상태만 표시한다.
````

- [ ] **Step 5: 문서 테스트를 실행한다**

Run:

```bash
pnpm vitest run docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts
```

Expected: 두 테스트 파일의 모든 테스트 PASS.

- [ ] **Step 6: 공식 문서 변경을 커밋한다**

```bash
git add docs/README.md docs/experience/SCREEN_LAYOUT.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/technical/SCREEN_ADAPTER_CONTRACT.md
git commit -m "문서: 상단 신뢰 0 상태 계약을 기록한다" -m "공통 상태 정보, C6 selector 어댑터 경계와 최대 7개 칩의 퀵 메뉴 비겹침을 공식 문서에 반영한다."
```

---

### Task 2: 필수 `TopStatusView.zeroTrust`와 데이터 원본 연결

**Files:**
- Modify: `components/game/TopStatusBar.tsx`
- Modify: `components/game/campaign-adapters.ts`
- Modify: `components/game/campaign-adapters.test.ts`
- Modify: `components/game/U2Preview.tsx`
- Modify: `components/game/u1-preview-data.ts`
- Modify: `components/game/u1-preview-data.test.ts`
- Modify: `components/game/GameShell.test.ts`
- Modify: `components/game/IntroScreen.test.ts`
- Modify: `components/game/U3BoardScreen.test.ts`
- Modify: `components/game/U4DungeonMapScreen.test.tsx`
- Modify: `components/game/U5ProgressScreen.test.tsx`
- Modify: `components/game/U6SettlementScreen.test.ts`
- Modify: `components/game/U3Preview.tsx`
- Modify: `components/game/u4-preview-data.ts`
- Modify: `components/game/u5-preview-data.ts`
- Modify: `components/game/u5-preview-data.test.ts`
- Modify: `components/game/u6-preview-data.ts`
- Modify: `components/game/u6-preview-data.test.ts`

**Interfaces:**
- Consumes: `countLivingZeroTrust(campaign: CampaignState): number`, `DENOUNCE_THRESHOLD`, 기존 `statusFor(campaign, active)`
- Produces: 필수 `TopStatusView.zeroTrust: { livingCount: number; threshold: number }`, 모든 타입 안전 fixture와 프리뷰

- [ ] **Step 1: 어댑터의 실패 테스트를 추가한다**

`components/game/campaign-adapters.test.ts`에 값만 바꾸는 캠페인 helper와 세 계약을 추가한다.

```ts
import { DENOUNCE_THRESHOLD, type CampaignState, type Character } from "@/lib/domain";

function withZeroTrust(
  campaign: CampaignState,
  livingCount: number,
  deadCount = 0,
): CampaignState {
  const byId = { ...campaign.pool.byId } as Record<string, Character>;
  for (const id of campaign.pool.order.slice(0, livingCount)) {
    const member = byId[id];
    if (member === undefined) throw new Error(`missing character ${id}`);
    byId[id] = { ...member, trust: 0, alive: true, hp: Math.max(1, member.hp) };
  }
  for (const id of campaign.pool.order.slice(livingCount, livingCount + deadCount)) {
    const member = byId[id];
    if (member === undefined) throw new Error(`missing character ${id}`);
    byId[id] = { ...member, trust: 0, alive: false, hp: 0 };
  }
  return { ...campaign, pool: { ...campaign.pool, byId } };
}

it("초기 캠페인은 살아 있는 신뢰 0 인원과 도메인 기준을 함께 낸다", () => {
  const campaign = createCampaignStore(SEED).getState().campaign;
  expect(statusFor(campaign, null).zeroTrust).toEqual({
    livingCount: 0,
    threshold: DENOUNCE_THRESHOLD,
  });
});

it("살아 있는 신뢰 0만 세고 사망자는 제외한다", () => {
  const initial = createCampaignStore(SEED).getState().campaign;
  const campaign = withZeroTrust(initial, 2, 1);
  expect(statusFor(campaign, null).zeroTrust.livingCount).toBe(2);
});

it("기준을 넘은 실제 인원을 제한하지 않는다", () => {
  const initial = createCampaignStore(SEED).getState().campaign;
  expect(statusFor(withZeroTrust(initial, 7), null).zeroTrust.livingCount).toBe(7);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run:

```bash
pnpm vitest run components/game/campaign-adapters.test.ts
```

Expected: FAIL — `statusFor(...).zeroTrust`가 아직 없다.

- [ ] **Step 3: `TopStatusView`와 `statusFor()`의 최소 계약을 구현한다**

`components/game/TopStatusBar.tsx`의 interface에 필수 필드를 추가한다.

```ts
zeroTrust: {
  livingCount: number;
  threshold: number;
};
```

`components/game/campaign-adapters.ts`에 다음 import와 반환값을 추가하고, 파일 상단 주석은 “규칙을 재구현하지 않고 selector 결과를 View로 옮긴다”는 의미로 고친다.

```ts
import { DENOUNCE_THRESHOLD } from "@/lib/domain";
import { countLivingZeroTrust } from "@/lib/rules/ending";

zeroTrust: {
  livingCount: countLivingZeroTrust(campaign),
  threshold: DENOUNCE_THRESHOLD,
},
```

- [ ] **Step 4: 정적 fixture를 도메인 기준값으로 갱신한다**

다음 파일의 상태 객체에 `DENOUNCE_THRESHOLD` import와 기본 View를 추가한다.

```ts
zeroTrust: { livingCount: 0, threshold: DENOUNCE_THRESHOLD },
```

대상:

```text
components/game/U2Preview.tsx
components/game/u1-preview-data.ts
components/game/GameShell.test.ts
components/game/IntroScreen.test.ts
components/game/TopStatusBar.test.ts
components/game/U3BoardScreen.test.ts
components/game/U4DungeonMapScreen.test.tsx
components/game/U5ProgressScreen.test.tsx
components/game/U6SettlementScreen.test.ts
```

`u1-preview-data.test.ts`의 상태 fixture 기대에도 다음을 추가한다.

```ts
zeroTrust: {
  livingCount: expect.any(Number),
  threshold: DENOUNCE_THRESHOLD,
},
```

- [ ] **Step 5: 규칙 기반 프리뷰를 selector 원본에 연결한다**

`U3Preview.tsx`는 수동 상태 객체를 다음 호출로 교체한다. 기존 `eligibility`는 승급 dialog View에 계속 필요하므로 유지한다.

```ts
const status = statusFor(campaign, null);
```

`u6-preview-data.ts`의 `statusOf`도 다음으로 축소한다. `getGuidePromotionEligibility`가 다른 곳에서 쓰이지 않으면 import를 제거한다.

```ts
function statusOf(campaign: CampaignState): TopStatusView {
  return statusFor(campaign, null);
}
```

`u4-preview-data.ts`와 `u5-preview-data.ts`는 현재 화면용 던전 View를 직접 만들고 있으므로 기존 상태 생성 구조를 유지하되 다음 selector 값을 추가한다.

```ts
zeroTrust: {
  livingCount: countLivingZeroTrust(campaign),
  threshold: DENOUNCE_THRESHOLD,
},
```

집계 조건이나 숫자 5를 파일 안에 복제하지 않는다.

- [ ] **Step 6: 프리뷰 원본 회귀 테스트를 추가한다**

`u5-preview-data.test.ts`에 다음 검사를 추가한다.

```ts
import { DENOUNCE_THRESHOLD } from "@/lib/domain";

it("상태 바의 누적 고발 기준은 도메인 상수와 같다", () => {
  for (const entry of U5_PREVIEW_ENTRIES) {
    expect(entry.status.zeroTrust.threshold).toBe(DENOUNCE_THRESHOLD);
  }
});
```

`u6-preview-data.test.ts`에는 다음 검사를 추가한다. 엔딩 entry도 타입 필수 상태를 가지지만 `U6EndingScreen`은 이를 렌더링하지 않는 기존 경계를 유지한다.

```ts
import { DENOUNCE_THRESHOLD } from "@/lib/domain";

it("모든 상태가 도메인의 누적 고발 기준과 유효한 현재 인원을 가진다", () => {
  for (const entry of U6_PREVIEW_ENTRIES) {
    expect(entry.status.zeroTrust.threshold).toBe(DENOUNCE_THRESHOLD);
    expect(Number.isInteger(entry.status.zeroTrust.livingCount)).toBe(true);
    expect(entry.status.zeroTrust.livingCount).toBeGreaterThanOrEqual(0);
  }
});
```

- [ ] **Step 7: 계약과 전체 타입을 검증한다**

Run:

```bash
pnpm vitest run components/game/campaign-adapters.test.ts components/game/u1-preview-data.test.ts components/game/u5-preview-data.test.ts components/game/u6-preview-data.test.ts
pnpm typecheck
```

Expected: 관련 테스트 PASS, 누락된 `TopStatusView.zeroTrust` fixture 없이 typecheck 성공.

- [ ] **Step 8: 데이터 계약 변경을 커밋한다**

```bash
git add components/game/TopStatusBar.tsx components/game/campaign-adapters.ts components/game/campaign-adapters.test.ts components/game/U2Preview.tsx components/game/u1-preview-data.ts components/game/u1-preview-data.test.ts components/game/GameShell.test.ts components/game/IntroScreen.test.ts components/game/TopStatusBar.test.ts components/game/U3BoardScreen.test.ts components/game/U4DungeonMapScreen.test.tsx components/game/U5ProgressScreen.test.tsx components/game/U6SettlementScreen.test.ts components/game/U3Preview.tsx components/game/u4-preview-data.ts components/game/u5-preview-data.ts components/game/u5-preview-data.test.ts components/game/u6-preview-data.ts components/game/u6-preview-data.test.ts
git commit -m "기능: 상단 신뢰 0 상태 데이터를 연결한다" -m "C6 selector와 누적 고발 기준을 필수 TopStatusView로 전달하고 정적 fixture와 규칙 기반 프리뷰의 원본을 구분한다."
```

---

### Task 3: 읽기 전용 신뢰 0 칩과 전용 SVG 추가

**Files:**
- Modify: `components/game/TopStatusBar.test.ts`
- Modify: `components/game/TopStatusBar.tsx`
- Add: `public/assets/u2/status-trust.svg`

**Interfaces:**
- Consumes: Task 2의 필수 `TopStatusView.zeroTrust`
- Produces: `승급 → 신뢰 0 → 남은 던전` 순서의 읽기 전용 `StatusItem`, `/assets/u2/status-trust.svg`

- [ ] **Step 1: 렌더링과 자산의 실패 테스트를 추가한다**

`TopStatusBar.test.ts`에 `readFileSync`, `join`, `DENOUNCE_THRESHOLD`를 사용해 다음 계약을 추가한다. 기존 `chip(html, label)` helper는 파일 최상위로 옮겨 두 describe에서 함께 사용한다.

```ts
it("신뢰 0 인원과 기준을 승급 뒤 남은 던전 앞에 표시한다", () => {
  const html = renderToStaticMarkup(createElement(TopStatusBar, {
    status: {
      ...baseStatus,
      zeroTrust: { livingCount: 2, threshold: DENOUNCE_THRESHOLD },
    },
  }));

  expect(html).toContain("신뢰 0");
  expect(html).toContain("2 / 5");
  expect(html.indexOf("승급")).toBeLessThan(html.indexOf("신뢰 0"));
  expect(html.indexOf("신뢰 0")).toBeLessThan(html.indexOf("남은 던전"));
  expect(html).toContain("/assets/u2/status-trust.svg");
});

it("기준 초과 값을 제한하지 않고 읽기 전용으로 표시한다", () => {
  const html = renderToStaticMarkup(createElement(TopStatusBar, {
    status: {
      ...baseStatus,
      zeroTrust: { livingCount: 7, threshold: DENOUNCE_THRESHOLD },
    },
    onOpenPromotion: () => undefined,
  }));

  const trust = chip(html, "신뢰 0");
  expect(trust).toContain("7 / 5");
  expect(trust.startsWith("<button")).toBe(false);
  expect(trust).not.toContain("u3-promotion-trigger");
});

it("신뢰 상태 아이콘은 공통 24x24 SVG 계약을 따른다", () => {
  const svg = readFileSync(
    join(process.cwd(), "public", "assets", "u2", "status-trust.svg"),
    "utf8",
  );
  expect(svg).toContain('viewBox="0 0 24 24"');
  expect(svg).toContain("<path");
});
```

- [ ] **Step 2: 실패를 확인한다**

Run:

```bash
pnpm vitest run components/game/TopStatusBar.test.ts
```

Expected: FAIL — `신뢰 0`, `2 / 5`, SVG 파일이 아직 없다.

- [ ] **Step 3: 기존 `StatusItem`으로 신뢰 0 칩을 렌더링한다**

`TopStatusBar.tsx`에서 승급 `StatusItem` 바로 뒤, 남은 던전 바로 앞에 추가한다.

```tsx
<StatusItem
  label="신뢰 0"
  value={`${status.zeroTrust.livingCount} / ${status.zeroTrust.threshold}`}
  iconSrc="/assets/u2/status-trust.svg"
/>
```

`onClick`, `testId`, `available`은 전달하지 않는다.

- [ ] **Step 4: 기존 U2 아이콘 계열의 SVG를 추가한다**

`public/assets/u2/status-trust.svg`를 다음 24×24 단색 금빛 문양으로 추가한다. 두 고리가 끊어진 실루엣으로 관계 붕괴를 표현하고 개별 CSS 크기는 만들지 않는다.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M9.2 7.1 7.6 5.5a4.1 4.1 0 0 0-5.8 5.8l2.7 2.7a4.1 4.1 0 0 0 5.8 0l1.1-1.1" stroke="#d8aa43" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="m14.8 16.9 1.6 1.6a4.1 4.1 0 0 0 5.8-5.8L19.5 10a4.1 4.1 0 0 0-5.8 0l-1.1 1.1" stroke="#d8aa43" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="m8.8 15.2-2.1 2.1M15.2 8.8l2.1-2.1M8.1 9.1 5.4 8.4M15.9 14.9l2.7.7" stroke="#8c6f39" stroke-width="1.4" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 5: 렌더링 회귀를 검증한다**

Run:

```bash
pnpm vitest run components/game/TopStatusBar.test.ts components/game/GameShell.test.ts components/game/StatusBarConsistency.test.ts
pnpm typecheck
```

Expected: 새 칩 계약, 기존 승급 버튼 계약, 공통 CSS 단일 정의와 typecheck 모두 PASS.

- [ ] **Step 6: 렌더링과 자산을 커밋한다**

```bash
git add components/game/TopStatusBar.tsx components/game/TopStatusBar.test.ts public/assets/u2/status-trust.svg
git commit -m "기능: 상단 상태 바에 신뢰 0 인원을 표시한다" -m "기존 상태 칩 스타일로 현재 생존 신뢰 0 인원과 누적 고발 기준을 읽기 전용으로 표시한다."
```

---

### Task 4: 최대 7개 칩과 전역 퀵 메뉴 비겹침 고정

**Files:**
- Modify: `components/game/u1-preview-data.ts`
- Modify: `components/game/u1-preview-data.test.ts`
- Modify: `e2e/canvas-layout.spec.ts`
- Inspect and modify only after a measured red test: `app/globals.css`

**Interfaces:**
- Consumes: Task 3의 7개 `StatusItem`, 최신 `AppFrame` 전역 퀵 메뉴
- Produces: `/u1-test?screen=board`의 `신뢰 0 7 / 5` 스트레스 fixture와 Chromium 레이아웃 계약

- [ ] **Step 1: 7개 칩 스트레스 fixture를 요구하는 실패 테스트를 추가한다**

`u1-preview-data.test.ts`의 상태 fixture 검사에 다음 기대를 추가한다.

```ts
expect(U1_PREVIEW_STATUS.zeroTrust).toEqual({
  livingCount: 7,
  threshold: DENOUNCE_THRESHOLD,
});
expect(U1_PREVIEW_STATUS.currentDungeon?.name).toBe("자카르의 불탄 우물");
```

- [ ] **Step 2: fixture 테스트 실패를 확인한다**

Run:

```bash
pnpm vitest run components/game/u1-preview-data.test.ts
```

Expected: FAIL — Task 2의 기본 U1 fixture는 아직 `0 / 5`와 기존 던전 이름이다.

- [ ] **Step 3: U1 상태 바 스트레스 fixture를 만든다**

`U1_PREVIEW_STATUS`의 관련 필드를 다음으로 바꾼다.

```ts
zeroTrust: { livingCount: 7, threshold: DENOUNCE_THRESHOLD },
currentDungeon: { name: "자카르의 불탄 우물", riskLevel: 5 },
```

U2와 실제 캠페인 기본 상태는 계속 `0 / 5`다.

- [ ] **Step 4: 상태 바 전용 Playwright 계약을 추가한다**

`e2e/canvas-layout.spec.ts`에 다음 helper와 독립 테스트를 추가한다.

```ts
interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

const STATUS_VIEWPORTS = [
  { name: "FHD", width: 1920, height: 1080 },
  { name: "HD", width: 1280, height: 720 },
  { name: "5:4", width: 1280, height: 1024 },
] as const;

for (const viewport of STATUS_VIEWPORTS) {
  test(`상태 칩 7개 ${viewport.name} 한 줄·퀵 메뉴 비겹침`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const failures = watchBrowserErrors(page);
    await page.goto("/u1-test?screen=board");

    const list = page.locator(".game-shell__status-list");
    const chips = page.locator(".game-shell__status-chip");
    await expect(chips).toHaveCount(7);
    await expect(page.getByText("7 / 5", { exact: true })).toBeVisible();

    const metrics = await list.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

    const boxes = await chips.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      };
    }));
    expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(1);
    expect(boxes.every((box) => box.scrollWidth <= box.clientWidth + 1)).toBe(true);

    const trigger = page.getByRole("button", { name: "빠른 메뉴 열기" });
    const triggerBox = await trigger.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    expect(boxes.some((box) => overlaps(box, triggerBox))).toBe(false);

    await trigger.click();
    const panel = page.getByRole("region", { name: "빠른 메뉴" });
    const panelBox = await panel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    expect(boxes.some((box) => overlaps(box, panelBox))).toBe(false);
    expectNoBrowserErrors(failures, `상태 칩 7개 ${viewport.name}`);
  });
}
```

- [ ] **Step 5: 상태 바 브라우저 계약을 실행한다**

Run:

```bash
pnpm exec playwright test e2e/canvas-layout.spec.ts --grep "상태 칩 7개"
```

Expected: 세 viewport 모두 PASS. 실패하면 측정값으로 overflow 또는 퀵 메뉴 겹침을 확인한다.

- [ ] **Step 6: 실패한 경우에만 공통 토큰을 최소 조정한다**

`app/globals.css`의 `--status-list-gap`, `--status-chip-min-width`, `--status-chip-padding-inline`, `--status-icon-size` 순서로 공간을 줄인다. 화면별 selector, `font-size` 축소, 레이블 축약, `overflow-x`, `flex-wrap`은 추가하지 않는다. 변경 후 다음을 실행한다.

```bash
pnpm vitest run components/game/StatusBarConsistency.test.ts
pnpm exec playwright test e2e/canvas-layout.spec.ts --grep "상태 칩 7개"
```

Expected: CSS 단일 정의 테스트와 세 viewport의 overflow·비겹침 계약 PASS.

- [ ] **Step 7: 레이아웃 계약을 커밋한다**

```bash
git add components/game/u1-preview-data.ts components/game/u1-preview-data.test.ts e2e/canvas-layout.spec.ts app/globals.css
git commit -m "테스트: 상태 칩 7개 레이아웃을 고정한다" -m "기준 초과 신뢰 fixture로 내부 넘침과 같은 행 배치를 검증하고 전역 퀵 메뉴와의 비겹침을 세 viewport에서 보장한다."
```

`app/globals.css`가 바뀌지 않았다면 `git add` 대상에서 제외한다.

---

### Task 5: 실제 캠페인 갱신과 전체 품질 게이트 검증

**Files:**
- Modify: `components/game/campaign-render.test.tsx`
- Verify: 모든 변경 파일

**Interfaces:**
- Consumes: Task 1~4의 문서·View·렌더링·자산·브라우저 계약
- Produces: 구현 완료 증거와 깨끗한 최종 diff

- [ ] **Step 1: 실제 캠페인 어댑터 갱신 경로를 통합 테스트에 고정한다**

`components/game/campaign-render.test.tsx`의 `정산이 실제 결과로 그려진다 > 선택과 판단, 인물별 결과가 다 찍힌다` 테스트에서 `statusFor` 호출을 변수로 꺼내고 다음 검사를 추가한다. 파일의 `@/lib/domain` import에는 `DENOUNCE_THRESHOLD` 값을 추가한다.

```ts
const status = statusFor(campaign, null);
const markup = renderToStaticMarkup(createElement(U6SettlementScreen, {
  status,
  settlement: view,
  onContinue: noop,
}));

expect(status.zeroTrust.livingCount).toBe(countLivingZeroTrust(campaign));
expect(status.zeroTrust.threshold).toBe(DENOUNCE_THRESHOLD);
```

원정 중 임시 파티를 `campaign.pool`에 합성하는 assertion이나 helper는 추가하지 않는다.

- [ ] **Step 2: 관련 단위·통합 테스트를 실행한다**

Run:

```bash
pnpm vitest run components/game/TopStatusBar.test.ts components/game/campaign-adapters.test.ts components/game/StatusBarConsistency.test.ts components/game/GameShell.test.ts components/game/IntroScreen.test.ts components/game/U3BoardScreen.test.ts components/game/U4DungeonMapScreen.test.tsx components/game/U5ProgressScreen.test.tsx components/game/U6SettlementScreen.test.ts components/game/u1-preview-data.test.ts components/game/u4-preview-data.test.ts components/game/u5-preview-data.test.ts components/game/u6-preview-data.test.ts components/game/campaign-render.test.tsx
```

Expected: 모든 관련 테스트 PASS.

- [ ] **Step 3: 전체 정적·단위 품질 게이트를 실행한다**

Run:

```bash
pnpm test
pnpm typecheck
pnpm exec eslint . --ignore-pattern 'playwright-report/**' --ignore-pattern 'test-results/**'
pnpm exec next build --webpack
```

Expected: 전체 테스트 PASS, typecheck 성공, ESLint 오류 0개, production build 성공.

- [ ] **Step 4: 전체 Chromium 회귀를 실행한다**

Run:

```bash
pnpm test:e2e
```

Expected: 공개 route, 캠페인 smoke, 고정 캔버스, U5 회귀와 새 상태 바 7개 칩 시나리오 모두 PASS.

- [ ] **Step 5: 최종 diff와 자산을 검사한다**

Run:

```bash
git diff --check
git status --short
git diff --stat
test -f public/assets/u2/status-trust.svg
```

Expected: 공백 오류 없음, 의도한 파일만 변경, SVG 파일 존재. 기존 `.pnpm-store/`와 U6 asset manifest·README 같은 사용자 미추적 파일은 stage하지 않는다.

- [ ] **Step 6: 실제 캠페인 통합 테스트를 커밋한다**

```bash
git add components/game/campaign-render.test.tsx
git commit -m "테스트: 실제 캠페인의 신뢰 0 상태를 검증한다" -m "정산 뒤 캠페인 상태가 C6 selector와 같은 상단 신뢰 0 인원 및 기준을 전달하는지 통합 경로에서 확인한다."
```

---

## Completion Checklist

- [ ] 모든 `GameShell` 화면에서 `신뢰 0 n / 5`가 0명부터 항상 보인다.
- [ ] `n`은 살아 있는 `trust === 0` 인원만 세며 사망자는 제외한다.
- [ ] `6 / 5`, `7 / 5`를 5로 제한하지 않는다.
- [ ] `TopStatusBar`는 도메인·C6 규칙을 import하지 않는다.
- [ ] 신뢰 0 칩은 읽기 전용이고 승급 칩만 기존 조작 계약을 유지한다.
- [ ] 정적 fixture도 `DENOUNCE_THRESHOLD`를 쓰고 규칙 기반 프리뷰는 selector 원본을 쓴다.
- [ ] 최대 7개 칩이 한 줄이고 내부 가로 스크롤·텍스트 잘림이 없다.
- [ ] 전역 퀵 메뉴 닫힘·열림 상태 모두 상태 칩과 겹치지 않는다.
- [ ] 화면별 상태 바 CSS 재정의가 없다.
- [ ] 공식 문서, 단위·통합 테스트, typecheck, lint, build, Playwright가 모두 통과한다.
