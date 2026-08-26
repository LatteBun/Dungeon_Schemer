# 남은 용사 상태 칩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 `GameShell` 상단 상태 바에 응급 편성 가능한 `남은 용사` 수를 표시하고, 칩 바로 아래 팝오버에서 인력 소진 엔딩 조건을 설명한다.

**Architecture:** C6의 새 `countEmergencyEligibleAdventurers(campaign)` selector가 기존 `canDeployEmergency()`를 재사용해 숫자를 계산하고, `statusFor()` 및 캠페인 기반 프리뷰가 그 결과만 `TopStatusView.remainingAdventurers`로 옮긴다. `TopStatusBar`는 규칙을 알지 못한 채 `의심 인원`과 `남은 용사`를 같은 내부 `StatusInfoItem` 상호작용으로 렌더링하며, 실제 인력 소진 판정은 기존 `canCreateEmergencyParty()`에 그대로 남긴다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript 5, CSS, Vitest 4.1.10, Playwright 1.62.1

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-remaining-adventurers-status-design.md`

## Global Constraints

- 레이블은 `남은 용사`, 값은 `{remainingAdventurers}명`이다.
- 집계 대상은 `canDeployEmergency(character)`가 참인 살아 있고 신뢰가 1 이상인 용사다. 중상자는 포함하고 사망자와 신뢰 0 용사는 제외한다.
- 숫자는 정보 표시일 뿐이다. `인력 소진`은 계속 `canCreateEmergencyParty()`가 서로 다른 직업 3명을 만들 수 있는지 판정한다.
- 순서는 `길잡이 등급 → 현재 명성 → 골드 → 승급 → 의심 인원 → 남은 용사 → 남은 던전 → 현재 던전(원정 중)`이다.
- 기본 화면 7칩, 원정 화면 최대 8칩을 한 줄로 유지하며 줄바꿈, 텍스트 잘림, 상태 바 내부 가로 스크롤, 화면별 CSS override를 추가하지 않는다.
- 팝오버 제목과 본문은 Spec 문구를 그대로 사용한다. `남은 용사` 칩 바로 아래에 열고 바깥 클릭, `Escape`, `닫기`로 닫는다.
- `Escape`로 닫은 뒤 해당 칩으로 초점을 돌린다. 팝오버는 비모달 `role="dialog"`이며 `aria-modal="true"`를 사용하지 않는다.
- 저장 상태, 월드턴, 편성, 엔딩 우선순위, 새 패키지와 새 이미지 자산은 변경하지 않는다.
- 커밋 메시지는 제목과 본문을 모두 한글로 작성한다.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/rules/ending.ts` | `canDeployEmergency()`를 재사용하는 남은 용사 selector |
| `lib/rules/ending.test.ts` | 중상·사망·신뢰 0·직업 중복을 포함한 selector와 엔딩 경계 |
| `components/game/campaign-adapters.ts` | selector 결과를 `TopStatusView`로 전달하는 런타임 경계 |
| `components/game/campaign-adapters.test.ts` | 어댑터가 규칙 결과를 재계산 없이 전달하는 계약 |
| `components/game/TopStatusBar.tsx` | 필수 View 필드, 두 정보 칩과 공용 앵커 팝오버 상호작용 |
| `components/game/TopStatusBar.test.ts` | 값·순서·버튼·문구의 정적 렌더 계약 |
| `components/game/u1-preview-data.ts` | 레이아웃 스트레스용 정적 상태 fixture |
| `components/game/u4-preview-data.ts`, `components/game/u5-preview-data.ts` | 캠페인 기반 원정 프리뷰의 selector 전달 |
| `components/game/u6-preview-data.ts` | `statusFor()`를 재사용하는 엔딩 프리뷰 계약 확인 |
| `components/game/U2Preview.tsx` | 시작 화면 정적 상태 fixture |
| `components/game/*.test.ts`, `components/game/*.test.tsx` | 필수 View 필드를 직접 만드는 기존 테스트 fixture 갱신 |
| `app/globals.css` | 공용 칩 anchor와 팝오버, 최대 8칩 공용 토큰 |
| `e2e/canvas-layout.spec.ts` | 8칩 한 줄·overflow·팝오버 위치·퀵 메뉴 비겹침 브라우저 회귀 |
| `docs/README.md` | 새 spec과 plan 색인 |
| `docs/experience/SCREEN_LAYOUT.md` | 7·8칩 순서와 레이아웃 공식 계약 |
| `docs/experience/ONBOARDING_AND_INTERFACE.md` | 플레이어에게 보이는 숫자와 설명 계약 |
| `docs/technical/SCREEN_ADAPTER_CONTRACT.md` | selector → View 어댑터 경계 |
| `docs/superpowers/specs/2026-08-26-lattebun-suspicion-status-dialog-design.md` | 실제 구현과 어긋난 모달 표현을 기존 앵커 팝오버 계약으로 정정 |

---

### Task 1: 남은 용사 규칙 selector와 View 경계를 만든다

**Files:**
- Modify: `lib/rules/ending.ts`
- Test: `lib/rules/ending.test.ts`
- Modify: `components/game/campaign-adapters.ts`
- Test: `components/game/campaign-adapters.test.ts`

**Interfaces:**
- Consumes: `canDeployEmergency(character: Character): boolean`, `canCreateEmergencyParty(pool: CharacterPool): boolean`
- Produces: `countEmergencyEligibleAdventurers(campaign: CampaignState): number`, `TopStatusView.remainingAdventurers: number`

- [ ] **Step 1: 설치된 Next.js 공식 문서를 확인한다**

의존성을 설치한 뒤 저장소 루트 기준 아래 문서를 끝까지 읽는다. 서버/클라이언트 경계와 CSS 적용 방식만 사용하고 새 Next API는 도입하지 않는다.

```bash
pnpm install --frozen-lockfile
sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/11-css.md
sed -n '1,260p' node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md
```

Expected: Next 16.3.0 문서가 열리고 lockfile 변경이 없다.

- [ ] **Step 2: selector와 엔딩 조건의 차이를 고정하는 실패 테스트를 작성한다**

`lib/rules/ending.test.ts` import에 `countEmergencyEligibleAdventurers`를 추가하고 아래 계약을 넣는다.

```ts
describe("countEmergencyEligibleAdventurers", () => {
  it("중상자는 포함하고 사망자와 신뢰 0은 제외한다", () => {
    const campaign = campaignWith([
      { classId: "warrior" },
      { classId: "rogue", gravelyWounded: true },
      { classId: "mage", alive: false },
      { classId: "cleric", trust: 0 },
    ]);

    expect(countEmergencyEligibleAdventurers(campaign)).toBe(2);
  });

  it("표시 인원이 셋이어도 직업이 겹치면 인력 소진일 수 있다", () => {
    const campaign = campaignWithThreeLivingWarriors();

    expect(countEmergencyEligibleAdventurers(campaign)).toBe(3);
    expect(isPersonnelExhausted(campaign)).toBe(true);
  });
});
```

같은 직업 3명을 만드는 `campaignWithThreeLivingWarriors()`는 초기 풀에서 `classId === "warrior"`인 서로 다른 세 캐릭터를 살리고 나머지를 사망 처리해 반환한다. 이 fixture는 숫자와 엔딩 판정을 분리하는 용도로만 사용한다.

- [ ] **Step 3: selector 테스트가 예상대로 실패하는지 확인한다**

```bash
pnpm vitest run lib/rules/ending.test.ts
```

Expected: `countEmergencyEligibleAdventurers` export가 없어 FAIL.

- [ ] **Step 4: 기존 응급 편성 조건을 재사용하는 최소 selector를 구현한다**

`lib/rules/ending.ts`가 `canDeployEmergency`를 도메인에서 import하도록 바꾸고 `countLivingZeroTrust` 근처에 다음 함수를 추가한다.

```ts
/** 마지막 응급 편성에 동원할 수 있는 생존 용사 수다. */
export function countEmergencyEligibleAdventurers(campaign: CampaignState): number {
  return campaign.pool.order.reduce((count, id) => {
    const member = campaign.pool.byId[id];
    return count + Number(member !== undefined && canDeployEmergency(member));
  }, 0);
}
```

`isPersonnelExhausted()`와 `canCreateEmergencyParty()`는 수정하지 않는다.

- [ ] **Step 5: `statusFor()` 전달 계약의 실패 테스트를 작성한다**

`components/game/campaign-adapters.test.ts`의 상태 바 describe에 초기 값과 제외 조건을 추가한다.

```ts
it("응급 편성 가능한 남은 용사 수를 전달한다", () => {
  const initial = createCampaignStore(SEED).getState().campaign;
  const campaign = withEmergencyEligibility(initial, {
    wounded: 1,
    dead: 1,
    zeroTrust: 1,
  });

  expect(statusFor(campaign, null).remainingAdventurers)
    .toBe(countEmergencyEligibleAdventurers(campaign));
});
```

`withEmergencyEligibility()`는 지정한 캐릭터만 `gravelyWounded`, `alive: false`, `trust: 0`으로 바꾸며 기대 숫자를 직접 계산하지 않는다. 테스트 import에 selector를 추가한다.

- [ ] **Step 6: 어댑터 테스트가 필수 View 필드 누락으로 실패하는지 확인한다**

```bash
pnpm vitest run components/game/campaign-adapters.test.ts
```

Expected: `remainingAdventurers`가 `undefined`여서 FAIL.

- [ ] **Step 7: View 타입과 런타임 어댑터를 연결한다**

`TopStatusView`에 아래 필수 필드를 추가한다.

```ts
remainingAdventurers: number;
```

`campaign-adapters.ts`에서 selector를 import하고 반환 객체에 아래 값을 넣는다.

```ts
remainingAdventurers: countEmergencyEligibleAdventurers(campaign),
```

- [ ] **Step 8: selector와 어댑터 테스트를 통과시킨다**

```bash
pnpm vitest run lib/rules/ending.test.ts components/game/campaign-adapters.test.ts
```

Expected: 두 파일 모두 PASS.

- [ ] **Step 9: 규칙과 어댑터 변경을 커밋한다**

```bash
git add lib/rules/ending.ts lib/rules/ending.test.ts components/game/TopStatusBar.tsx components/game/campaign-adapters.ts components/game/campaign-adapters.test.ts
git commit -m "기능: 남은 용사 집계 경계를 추가한다" -m "응급 편성 조건을 재사용해 표시 인원을 계산하고 실제 인력 소진의 직업 구성 판정과 분리한다."
```

### Task 2: 모든 상태 fixture를 필수 View 계약에 맞춘다

**Files:**
- Modify: `components/game/u1-preview-data.ts`
- Modify: `components/game/U2Preview.tsx`
- Modify: `components/game/u4-preview-data.ts`
- Modify: `components/game/u5-preview-data.ts`
- Verify: `components/game/u6-preview-data.ts`
- Modify: `components/game/TopStatusBar.test.ts`
- Modify: `components/game/GameShell.test.ts`
- Modify: `components/game/IntroScreen.test.ts`
- Modify: `components/game/U3BoardScreen.test.ts`
- Modify: `components/game/U4DungeonMapScreen.test.tsx`
- Modify: `components/game/U5ProgressScreen.test.tsx`
- Modify: `components/game/U6SettlementScreen.test.ts`
- Modify: `components/game/u1-preview-data.test.ts`
- Modify: `components/game/u5-preview-data.test.ts`
- Modify: `components/game/u6-preview-data.test.ts`
- Modify: `components/game/campaign-render.test.tsx`

**Interfaces:**
- Consumes: `countEmergencyEligibleAdventurers(campaign: CampaignState): number`, `TopStatusView.remainingAdventurers: number`
- Produces: 모든 화면과 테스트가 제공하는 필수 `remainingAdventurers` View 값

- [ ] **Step 1: 타입 검사를 실행해 빠진 fixture 전체를 확인한다**

```bash
pnpm typecheck
```

Expected: 직접 만든 `TopStatusView` 객체에서 `remainingAdventurers` 누락 오류가 발생한다.

- [ ] **Step 2: 캠페인 기반 프리뷰는 selector를 통해 값을 만든다**

`u4-preview-data.ts`와 `u5-preview-data.ts`에 selector import를 추가하고 각 상태 객체에 다음 필드를 넣는다.

```ts
remainingAdventurers: countEmergencyEligibleAdventurers(campaign),
```

`u6-preview-data.ts`는 이미 `statusFor(campaign, null)`을 사용하므로 별도 집계 코드를 추가하지 않는다.

- [ ] **Step 3: 정적 프리뷰와 테스트 fixture에 명시적 값을 넣는다**

`U1_PREVIEW_STATUS`에는 레이아웃 스트레스를 유지할 `remainingAdventurers: 12`, `U2_START_STATUS`에는 초기 프리뷰 캠페인과 맞는 값을 넣는다. 나머지 테스트의 `baseStatus`·`status` 상수에는 테스트 의미를 흐리지 않는 `remainingAdventurers: 12`를 추가한다.

```ts
const baseStatus: TopStatusView = {
  rank: "C",
  reputation: 30,
  gold: 10,
  canPromote: false,
  remainingAdventurers: 12,
  remainingDungeons: 15,
  zeroTrust: { livingCount: 0, threshold: DENOUNCE_THRESHOLD },
};
```

`rg -n "TopStatusView|remainingDungeons:" components/game`으로 누락된 직접 fixture가 없는지 다시 확인한다.

- [ ] **Step 4: 프리뷰가 selector 결과와 일치하는 테스트를 추가한다**

캠페인을 소유하는 `u5-preview-data.test.ts`, `u6-preview-data.test.ts`, `campaign-render.test.tsx`에는 아래 형태의 기대를 추가한다.

```ts
expect(entry.status.remainingAdventurers)
  .toBe(countEmergencyEligibleAdventurers(entry.campaign));
```

fixture가 캠페인을 외부로 내보내지 않는 테스트는 `Number.isInteger`와 `>= 0`만 검사하고, 구현 조건을 복제하지 않는다.

- [ ] **Step 5: 타입과 관련 프리뷰 테스트를 통과시킨다**

```bash
pnpm typecheck
pnpm vitest run components/game/u1-preview-data.test.ts components/game/u5-preview-data.test.ts components/game/u6-preview-data.test.ts components/game/campaign-render.test.tsx
```

Expected: 타입 오류 없이 모두 PASS.

- [ ] **Step 6: fixture 변경을 커밋한다**

```bash
git add components/game
git commit -m "리팩터링: 상태 화면에 남은 용사 값을 연결한다" -m "캠페인 기반 프리뷰는 공용 집계를 사용하고 정적 화면과 테스트 fixture는 필수 View 계약을 명시한다."
```

### Task 3: 두 정보 칩을 공용 앵커 팝오버로 렌더링한다

**Files:**
- Modify: `components/game/TopStatusBar.tsx`
- Test: `components/game/TopStatusBar.test.ts`
- Modify: `app/globals.css`
- Test: `e2e/canvas-layout.spec.ts`

**Interfaces:**
- Consumes: `TopStatusView.remainingAdventurers: number`, `TopStatusView.zeroTrust`
- Produces: `StatusInfoItem` 내부 컴포넌트, `data-testid="remaining-adventurers-info-trigger"`, 공용 `.game-shell__status-info-*` CSS 계약

- [ ] **Step 1: 값·순서·버튼·문구의 실패 테스트를 작성한다**

`TopStatusBar.test.ts`에 다음 정적 계약을 추가하고 기존 `의심 인원` 테스트도 비모달 팝오버 명칭을 사용하도록 정리한다.

```ts
it("남은 용사를 의심 인원과 남은 던전 사이에 표시한다", () => {
  const html = renderToStaticMarkup(createElement(TopStatusBar, {
    status: { ...baseStatus, remainingAdventurers: 12 },
  }));

  const remaining = chip(html, "남은 용사");
  expect(remaining).toContain("12명");
  expect(remaining.startsWith("<button")).toBe(true);
  expect(remaining).toContain('data-testid="remaining-adventurers-info-trigger"');
  expect(html.indexOf("의심 인원")).toBeLessThan(html.indexOf("남은 용사"));
  expect(html.indexOf("남은 용사")).toBeLessThan(html.indexOf("남은 던전"));
});
```

닫힌 초기 markup에는 두 팝오버 본문이 없어야 한다.

- [ ] **Step 2: 상태 바 정적 테스트의 실패를 확인한다**

```bash
pnpm vitest run components/game/TopStatusBar.test.ts
```

Expected: `남은 용사` 칩이 없어 FAIL.

- [ ] **Step 3: 공용 `StatusInfoItem`을 최소 구현한다**

`TopStatusBar.tsx` 내부에 `StatusInfoItem`을 만든다. 컴포넌트는 자체 `isOpen`, trigger ref, popover ref를 소유하고 `StatusItem`과 패널을 아래 wrapper 안에 렌더링한다.

```tsx
interface StatusInfoItemProps {
  label: string;
  value: ReactNode;
  iconSrc?: string;
  testId: string;
  children: ReactNode;
}

function StatusInfoItem({ label, value, iconSrc, testId, children }: StatusInfoItemProps) {
  // open 상태일 때만 document pointerdown/keydown listener를 등록한다.
  // trigger와 panel 내부 pointerdown은 바깥 클릭으로 취급하지 않는다.
  // Escape와 닫기 버튼은 닫은 뒤 requestAnimationFrame으로 trigger에 focus한다.
  return (
    <div className="game-shell__status-info-anchor">
      <StatusItem label={label} value={value} iconSrc={iconSrc} onClick={open} testId={testId} buttonRef={triggerRef} />
      {isOpen ? (
        <section ref={popoverRef} className="game-shell__status-info-popover" role="dialog" aria-label={label}>
          <h2>{label}</h2>
          {children}
          <button type="button" onClick={close}>닫기</button>
        </section>
      ) : null}
    </div>
  );
}
```

위 주석의 네 동작을 실제 코드로 모두 작성한다. `aria-modal`과 `autoFocus`는 제거해 팝오버가 모달처럼 초점을 빼앗지 않게 한다. 기존 `isZeroTrustInfoOpen` 및 전용 refs/effect는 삭제한다.

- [ ] **Step 4: 두 칩을 공용 컴포넌트로 렌더링한다**

`의심 인원`에는 기존 아이콘과 승인 문구를, 그 바로 뒤 `남은 용사`에는 새 자산 없이 다음 본문을 넘긴다.

```tsx
<StatusInfoItem
  label="남은 용사"
  value={`${status.remainingAdventurers}명`}
  testId="remaining-adventurers-info-trigger"
>
  <p>서로 다른 직업의 용사 세 명을 더는 모을 수 없으면, 이번 던전이 끝난 뒤 원정대를 꾸리지 못해 길잡이 일도 끝납니다.</p>
  <p>중상을 입은 용사도 마지막 원정에는 나설 수 있지만, 죽거나 신뢰를 완전히 잃은 용사는 돌아오지 않습니다.</p>
</StatusInfoItem>
```

- [ ] **Step 5: 공용 anchor와 팝오버 CSS를 구현한다**

`app/globals.css`의 `.game-shell__zero-trust-popover`를 공용 class로 바꾸고 wrapper를 기준으로 배치한다.

```css
.game-shell__status-info-anchor {
  position: relative;
  display: flex;
  flex: 0 1 auto;
  min-width: 0;
}

.game-shell__status-info-anchor > .game-shell__status-chip {
  width: 100%;
}

.game-shell__status-info-popover {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.5rem);
  left: 50%;
  translate: -50% 0;
  width: min(34rem, 70cqw);
}
```

기존 border, padding, color, background, shadow와 자식 `h2`, `p`, `button` 규칙은 새 공용 class로 그대로 옮긴다.

- [ ] **Step 6: 단위 테스트와 타입 검사를 통과시킨다**

```bash
pnpm vitest run components/game/TopStatusBar.test.ts components/game/GameShell.test.ts
pnpm typecheck
```

Expected: 모두 PASS.

- [ ] **Step 7: 공용 팝오버 구현을 커밋한다**

```bash
git add components/game/TopStatusBar.tsx components/game/TopStatusBar.test.ts app/globals.css
git commit -m "기능: 남은 용사 안내 팝오버를 추가한다" -m "두 상태 칩이 같은 앵커 팝오버와 닫기 및 포커스 복귀 계약을 사용하도록 공통화한다."
```

### Task 4: 최대 8칩과 두 팝오버의 브라우저 레이아웃을 고정한다

**Files:**
- Modify: `e2e/canvas-layout.spec.ts`
- Modify only if measured failure requires it: `app/globals.css`

**Interfaces:**
- Consumes: `.game-shell__status-chip`, `.game-shell__status-info-popover`, 두 trigger test id, 전역 퀵 메뉴
- Produces: FHD 1920×1080, HD 1280×720, 5:4 1280×1024의 최대 8칩 수치 회귀

- [ ] **Step 1: 기존 7칩 시나리오를 8칩 실패 계약으로 확장한다**

테스트 이름과 count를 8로 바꾸고 `남은 용사 12명`을 확인한다. 두 팝오버마다 아래 helper를 호출한다.

```ts
async function expectAnchoredPopover(
  page: Page,
  triggerTestId: string,
  dialogName: string,
  expectedCopy: string,
) {
  const trigger = page.getByTestId(triggerTestId);
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog).toContainText(expectedCopy);
  const [triggerBox, dialogBox] = await Promise.all([
    trigger.boundingBox(),
    dialog.boundingBox(),
  ]);
  expect(triggerBox).not.toBeNull();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.y).toBeGreaterThanOrEqual(triggerBox!.y + triggerBox!.height - 1);
  expect(Math.abs(
    (dialogBox!.x + dialogBox!.width / 2) - (triggerBox!.x + triggerBox!.width / 2),
  )).toBeLessThanOrEqual(2);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
}
```

기존 list `scrollWidth <= clientWidth`, 모든 chip 동일 top, 각 chip 내부 overflow 없음, 퀵 메뉴 trigger·열린 panel 비겹침 검사는 유지한다. 열린 팝오버와 퀵 메뉴 panel도 `overlaps()`가 false인지 확인한다.

- [ ] **Step 2: 8칩 E2E가 현재 토큰에서 실패하는지 측정한다**

```bash
pnpm exec playwright test e2e/canvas-layout.spec.ts --grep "상태 칩 8개"
```

Expected: 기능이 맞더라도 적어도 한 viewport에서 overflow 또는 비겹침 실패가 나면 실제 bounding box 값을 기록한다. 모두 PASS면 토큰을 임의로 줄이지 않는다.

- [ ] **Step 3: 실패한 경우에만 공용 토큰을 최소 조정한다**

`--status-list-gap`, `--status-chip-min-width`, `--status-chip-padding-inline`, `--status-icon-size` 순서로 필요한 값만 줄인다. `font-size`, label 문구, `flex-wrap`, `overflow-x`, 화면별 selector는 변경하지 않는다.

- [ ] **Step 4: 세 viewport 회귀를 통과시킨다**

```bash
pnpm exec playwright test e2e/canvas-layout.spec.ts --grep "상태 칩 8개"
```

Expected: FHD, HD, 5:4에서 8칩이 한 줄이고 내부 overflow와 퀵 메뉴·팝오버 겹침이 없으며 두 팝오버의 Escape 초점 복귀가 PASS.

- [ ] **Step 5: 레이아웃 회귀를 커밋한다**

```bash
git add e2e/canvas-layout.spec.ts app/globals.css
git commit -m "테스트: 상태 칩 8개 레이아웃을 고정한다" -m "세 기준 화면에서 두 앵커 팝오버와 전역 퀵 메뉴를 포함한 한 줄 및 비겹침 계약을 검증한다."
```

### Task 5: 공식 문서와 기존 의심 인원 spec을 현재 계약에 맞춘다

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Modify: `docs/technical/SCREEN_ADAPTER_CONTRACT.md`
- Modify: `docs/superpowers/specs/2026-08-26-lattebun-suspicion-status-dialog-design.md`

**Interfaces:**
- Consumes: 승인된 copy, `countEmergencyEligibleAdventurers`, 7·8칩 및 공용 앵커 팝오버 계약
- Produces: 플레이어 설명과 기술 경계가 실제 구현과 일치하는 공식 문서

- [ ] **Step 1: README에 spec과 plan 색인을 추가한다**

```md
- [남은 용사 상태 칩 설계](superpowers/specs/2026-08-26-lattebun-remaining-adventurers-status-design.md): 응급 편성 가능 인원과 인력 소진 안내 팝오버 계약
- [남은 용사 상태 칩 구현 계획](superpowers/plans/2026-08-26-lattebun-remaining-adventurers-status.md): selector, View, 공용 팝오버와 최대 8칩 회귀의 테스트 우선 실행 순서
```

- [ ] **Step 2: 화면과 온보딩 문서를 갱신한다**

`SCREEN_LAYOUT.md`의 상태 바 트리와 본문을 7·8칩으로 바꾸고 `의심 인원 → 남은 용사 → 남은 던전` 순서를 기록한다. `ONBOARDING_AND_INTERFACE.md`에는 `남은 용사`가 중상자를 포함하고 사망·신뢰 0을 제외하지만, 엔딩은 숫자 3명이 아니라 서로 다른 직업 3종 가능 여부로 판정된다고 명시한다.

- [ ] **Step 3: 어댑터 계약을 갱신한다**

`SCREEN_ADAPTER_CONTRACT.md`의 `TopStatusView` 예시에 아래 필드를 추가하고 UI가 조건을 재구현하지 않는다고 기록한다.

```ts
remainingAdventurers: number;
```

규칙 원본은 `countEmergencyEligibleAdventurers(campaign)`와 `canCreateEmergencyParty(pool)`이며 둘의 목적이 표시와 종료 판정으로 다르다는 문장을 함께 둔다.

- [ ] **Step 4: 기존 의심 인원 spec의 모달 표현을 실제 계약으로 정정한다**

`suspicion-status-dialog-design.md`에서 backdrop·`showModal()`·modal focus trap 설명을 제거하고, 칩 바로 아래 비모달 `role="dialog"`, 바깥 클릭·Escape·닫기, 공용 anchor 동작으로 바꾼다. 고정 문구와 집계 규칙은 변경하지 않는다.

- [ ] **Step 5: 문서 일관성을 검색하고 커밋한다**

```bash
rg -n "최대 7개|상태 칩 7개|aria-modal|showModal|신뢰 0 n / 5" docs/README.md docs/experience docs/technical docs/superpowers/specs/2026-08-26-lattebun-suspicion-status-dialog-design.md
git diff --check
git add docs
git commit -m "문서: 남은 용사 상태 계약을 기록한다" -m "응급 편성 인원과 인력 소진의 차이, 공용 앵커 팝오버와 최대 8개 상태 칩을 공식 문서에 반영한다."
```

Expected: 현행 문서를 가리키는 오래된 7칩·모달 표현이 없고 `git diff --check` PASS.

### Task 6: 전체 회귀를 검증하고 별도 PR을 준비한다

**Files:**
- Verify only: repository-wide tests and git state

**Interfaces:**
- Consumes: Tasks 1–5의 커밋
- Produces: 최신 `origin/main` 기반의 검증된 `codex/remaining-adventurers-status` 별도 PR 브랜치

- [ ] **Step 1: 정적 검증을 실행한다**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check origin/main...HEAD
```

Expected: lint, typecheck, 전체 Vitest, Next production build, whitespace 검사 모두 PASS.

- [ ] **Step 2: 관련 브라우저 회귀를 실행한다**

```bash
pnpm exec playwright test e2e/canvas-layout.spec.ts
```

Expected: 고정 캔버스 전체와 8칩·두 팝오버 시나리오 PASS.

- [ ] **Step 3: 변경 범위와 브랜치 기반을 확인한다**

```bash
git status --short
git log --oneline --decorate origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected: 작업 트리가 깨끗하고, PR #195가 병합된 `origin/main` 위에 이 spec·plan과 남은 용사 구현 커밋만 있다.

- [ ] **Step 4: 원격 브랜치에 올리고 별도 PR을 연다**

```bash
git push -u origin codex/remaining-adventurers-status
gh pr create --base main --head codex/remaining-adventurers-status --title "기능: 상단 상태 바에 남은 용사를 표시한다" --body-file /tmp/remaining-adventurers-pr.md
```

`/tmp/remaining-adventurers-pr.md`에는 요약(응급 편성 가능 인원 표시, 공용 앵커 팝오버, 8칩 레이아웃), 규칙 경계(숫자와 서로 다른 직업 3종 엔딩 판정의 차이), 실행한 검증 명령과 결과를 한글로 기록한다.

Expected: PR #195와 분리된 새 PR URL이 생성된다.

## Completion Checklist

- [ ] `남은 용사`는 중상자를 포함하고 사망자와 신뢰 0을 제외한다.
- [ ] 표시 숫자가 실제 `인력 소진` 엔딩 판정을 대체하지 않는다.
- [ ] `남은 용사`가 `의심 인원`과 `남은 던전` 사이에 `{n}명`으로 표시된다.
- [ ] 두 칩이 같은 비모달 앵커 팝오버 계약을 사용한다.
- [ ] 승인된 플레이어 문구가 그대로 표시된다.
- [ ] 최대 8칩이 세 viewport에서 한 줄이며 overflow와 퀵 메뉴 겹침이 없다.
- [ ] 공식 문서와 기존 의심 인원 spec이 현재 팝오버 동작과 일치한다.
- [ ] lint, typecheck, unit, build, 관련 Playwright가 모두 통과한다.
- [ ] PR #195와 분리된 새 PR로 올라간다.
