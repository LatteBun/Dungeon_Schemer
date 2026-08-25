import { expect, test, type Page } from "@playwright/test";
import { allSituationEvents } from "../lib/content/event-registry";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

const longestSituation = allSituationEvents().reduce(
  (longest, event) => event.description.length > longest.length ? event.description : longest,
  "",
);

async function useFhd(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/u5-test");
}

async function replaceSituationWithLongestCorpusEntry(page: Page): Promise<void> {
  await page.getByTestId("u5-situation").evaluate((element, text) => {
    element.textContent = text;
  }, longestSituation);
}

async function expectSituationAndOutcomeFitConsole(page: Page, hasOutcome: boolean): Promise<void> {
  const metrics = await page.getByTestId("u5-console").evaluate((console, expected) => {
    const panel = console.querySelector<HTMLElement>(".u5-situation-panel");
    const situation = console.querySelector<HTMLElement>("[data-testid='u5-situation']");
    const outcome = console.querySelector<HTMLElement>("[data-testid='u5-outcome']");
    if (panel === null || situation === null) throw new Error("현재 상황 패널이 없다");
    if (expected.hasOutcome && outcome === null) throw new Error("선택 후 결과가 없다");

    const consoleBox = console.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const outcomeBox = outcome?.getBoundingClientRect();

    return {
      situationText: situation.textContent,
      panelLeft: panelBox.left,
      panelRight: panelBox.right,
      panelTop: panelBox.top,
      panelBottom: panelBox.bottom,
      panelScrollHeight: panel.scrollHeight,
      panelClientHeight: panel.clientHeight,
      outcomeLeft: outcomeBox?.left,
      outcomeRight: outcomeBox?.right,
      outcomeTop: outcomeBox?.top,
      outcomeBottom: outcomeBox?.bottom,
      consoleLeft: consoleBox.left,
      consoleRight: consoleBox.right,
      consoleTop: consoleBox.top,
      consoleBottom: consoleBox.bottom,
    };
  }, { hasOutcome });

  expect(metrics.situationText).toBe(longestSituation);
  expect(metrics.panelLeft).toBeGreaterThanOrEqual(metrics.consoleLeft - 1);
  expect(metrics.panelRight).toBeLessThanOrEqual(metrics.consoleRight + 1);
  expect(metrics.panelTop).toBeGreaterThanOrEqual(metrics.consoleTop - 1);
  expect(metrics.panelBottom).toBeLessThanOrEqual(metrics.consoleBottom + 1);
  expect(metrics.panelScrollHeight).toBeLessThanOrEqual(metrics.panelClientHeight + 1);
  if (hasOutcome) {
    expect(metrics.outcomeLeft).toBeGreaterThanOrEqual(metrics.consoleLeft - 1);
    expect(metrics.outcomeRight).toBeLessThanOrEqual(metrics.consoleRight + 1);
    expect(metrics.outcomeTop).toBeGreaterThanOrEqual(metrics.consoleTop - 1);
    expect(metrics.outcomeBottom).toBeLessThanOrEqual(metrics.consoleBottom + 1);
  }
}

test("행동/조언과 진행 기록은 실제 클릭으로 aria-pressed와 표시 영역을 함께 전환한다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);
  const advice = page.getByRole("button", { name: "행동 / 조언", exact: true });
  const log = page.getByRole("button", { name: "진행 기록", exact: true });

  await expect(advice).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("u5-situation")).toBeVisible();
  await log.click();
  await expect(log).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("u5-log")).toBeVisible();
  await advice.click();
  await expect(advice).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("u5-situation")).toBeVisible();
  expectNoBrowserErrors(failures, "U5 콘솔 모드 전환");
});

test("진행 기록 필터는 기존 계산 스타일을 유지한다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);
  await page.getByRole("button", { name: "진행 기록", exact: true }).click();
  const styles = await page.getByRole("button", { name: "단서", exact: true }).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderTopWidth: style.borderTopWidth,
      borderTopColor: style.borderTopColor,
      backgroundColor: style.backgroundColor,
      color: style.color,
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      fontSize: style.fontSize,
    };
  });

  expect(styles).toEqual({
    borderTopWidth: "1px",
    borderTopColor: "rgb(58, 46, 35)",
    backgroundColor: "rgba(12, 9, 6, 0.8)",
    color: "rgb(203, 188, 165)",
    paddingTop: "5.76px",
    paddingRight: "13.44px",
    fontSize: "15.36px",
  });
  expectNoBrowserErrors(failures, "진행 기록 필터 스타일");
});

test("최장 공식 상황 문구는 FHD에서 선택 전과 선택 후에 패널과 콘솔 안에 남는다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);
  await replaceSituationWithLongestCorpusEntry(page);
  await expectSituationAndOutcomeFitConsole(page, false);

  await page.getByRole("button", { name: "일반 사건 · 선택 후", exact: true }).click();
  await replaceSituationWithLongestCorpusEntry(page);
  await expectSituationAndOutcomeFitConsole(page, true);
  expectNoBrowserErrors(failures, "최장 공식 U5 상황 문구 containment");
});
