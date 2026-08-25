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
    const adviceList = console.querySelector<HTMLElement>(".u5-advice-list");
    const cards = [...console.querySelectorAll<HTMLElement>(".u5-advice__button")];
    const outcome = console.querySelector<HTMLElement>("[data-testid='u5-outcome']");
    const steps = [...console.querySelectorAll<HTMLElement>(".u5-outcome__step")];
    if (panel === null || situation === null) throw new Error("현재 상황 패널이 없다");
    if (!expected.hasOutcome && (adviceList === null || cards.length !== 3)) {
      throw new Error("선택 전 조언 카드 세 장이 없다");
    }
    if (expected.hasOutcome && outcome === null) throw new Error("선택 후 결과가 없다");
    if (expected.hasOutcome && steps.length !== 3) throw new Error("선택 후 결과 단계 세 개가 없다");

    const consoleBox = console.getBoundingClientRect();
    const measure = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      };
    };

    return {
      situationText: situation.textContent,
      panel: measure(panel),
      adviceList: adviceList === null ? null : measure(adviceList),
      cards: cards.map(measure),
      outcome: outcome === null ? null : measure(outcome),
      steps: steps.map(measure),
      consoleLeft: consoleBox.left,
      consoleRight: consoleBox.right,
      consoleTop: consoleBox.top,
      consoleBottom: consoleBox.bottom,
    };
  }, { hasOutcome });

  expect(metrics.situationText).toBe(longestSituation);
  const expectContained = (element: typeof metrics.panel) => {
    expect(element.left).toBeGreaterThanOrEqual(metrics.consoleLeft - 1);
    expect(element.right).toBeLessThanOrEqual(metrics.consoleRight + 1);
    expect(element.top).toBeGreaterThanOrEqual(metrics.consoleTop - 1);
    expect(element.bottom).toBeLessThanOrEqual(metrics.consoleBottom + 1);
    expect(element.scrollHeight).toBeLessThanOrEqual(element.clientHeight);
  };

  expectContained(metrics.panel);
  if (hasOutcome) {
    expect(metrics.outcome).not.toBeNull();
    if (metrics.outcome === null) throw new Error("선택 후 결과 측정값이 없다");
    expectContained(metrics.outcome);
    expect(metrics.outcome.top).toBeGreaterThanOrEqual(metrics.panel.bottom - 1);
    expect(metrics.steps).toHaveLength(3);
    for (const step of metrics.steps) expectContained(step);
    for (let index = 1; index < metrics.steps.length; index += 1) {
      expect(metrics.steps[index].top).toBeGreaterThanOrEqual(metrics.steps[index - 1].bottom - 1);
    }
  } else {
    expect(metrics.adviceList).not.toBeNull();
    if (metrics.adviceList === null) throw new Error("선택 전 조언 목록 측정값이 없다");
    expectContained(metrics.adviceList);
    expect(metrics.adviceList.top).toBeGreaterThanOrEqual(metrics.panel.bottom - 1);
    expect(metrics.cards).toHaveLength(3);
    for (const card of metrics.cards) expectContained(card);
  }
}

test("행동/조언과 진행 기록은 실제 클릭으로 aria-pressed와 표시 영역을 함께 전환한다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);
  const advice = page.getByRole("button", { name: "행동 / 조언", exact: true });
  const log = page.getByRole("button", { name: "진행 기록", exact: true });

  await expect(advice).toHaveAttribute("aria-pressed", "true");
  await expect(log).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("u5-situation")).toBeVisible();
  await log.click();
  await expect(advice).toHaveAttribute("aria-pressed", "false");
  await expect(log).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("u5-log")).toBeVisible();
  await advice.click();
  await expect(advice).toHaveAttribute("aria-pressed", "true");
  await expect(log).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("u5-situation")).toBeVisible();
  expectNoBrowserErrors(failures, "U5 콘솔 모드 전환");
});

test("진행 기록 필터는 기존 계산 스타일을 유지한다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);
  await page.getByRole("button", { name: "진행 기록", exact: true }).click();
  const filterStyles = async () => page.locator(".u5-log__filters button").evaluateAll((buttons) =>
    buttons.map((element) => {
      const style = getComputedStyle(element);
      return {
        label: element.textContent,
        pressed: element.getAttribute("aria-pressed"),
        height: style.height,
        borderTopWidth: style.borderTopWidth,
        borderTopColor: style.borderTopColor,
        backgroundColor: style.backgroundColor,
        color: style.color,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        fontSize: style.fontSize,
      };
    }),
  );
  const initial = await filterStyles();

  expect(initial).toHaveLength(4);
  expect(initial.map(({ label }) => label)).toEqual(["전체", "단서", "전투", "생태"]);
  expect(initial.map(({ height }) => height)).toEqual(["36.5312px", "36.5312px", "36.5312px", "36.5312px"]);
  expect(initial[0]).toEqual({
    label: "전체",
    pressed: "true",
    height: "36.5312px",
    borderTopWidth: "1px",
    borderTopColor: "rgb(216, 170, 67)",
    backgroundColor: "rgb(59, 42, 20)",
    color: "rgb(255, 243, 204)",
    paddingTop: "5.76px",
    paddingRight: "13.44px",
    fontSize: "15.36px",
  });
  for (const filter of initial.slice(1)) {
    expect(filter).toEqual({
      label: filter.label,
      pressed: "false",
      height: "36.5312px",
      borderTopWidth: "1px",
      borderTopColor: "rgb(58, 46, 35)",
      backgroundColor: "rgba(12, 9, 6, 0.8)",
      color: "rgb(203, 188, 165)",
      paddingTop: "5.76px",
      paddingRight: "13.44px",
      fontSize: "15.36px",
    });
  }

  await page.getByRole("button", { name: "단서", exact: true }).click();
  const afterClick = await filterStyles();
  expect(afterClick[0].pressed).toBe("false");
  expect(afterClick[0].borderTopColor).toBe("rgb(58, 46, 35)");
  expect(afterClick[0].backgroundColor).toBe("rgba(12, 9, 6, 0.8)");
  expect(afterClick[0].color).toBe("rgb(203, 188, 165)");
  expect(afterClick[1].pressed).toBe("true");
  expect(afterClick[1].borderTopColor).toBe("rgb(216, 170, 67)");
  expect(afterClick[1].backgroundColor).toBe("rgb(59, 42, 20)");
  expect(afterClick[1].color).toBe("rgb(255, 243, 204)");
  expect(afterClick.map(({ height }) => height)).toEqual(["36.5312px", "36.5312px", "36.5312px", "36.5312px"]);
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

test("조언 카드는 FHD 콘솔의 기존 안쪽 여백만 남기고 하단에 정렬된다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);
  const metrics = await page.getByTestId("u5-console").evaluate((console) => {
    const cards = [...console.querySelectorAll<HTMLElement>(".u5-advice__button")];
    if (cards.length !== 3) throw new Error("조언 카드 세 장이 없다");
    const consoleBox = console.getBoundingClientRect();
    const style = getComputedStyle(console);
    const cardBottom = Math.max(...cards.map((card) => card.getBoundingClientRect().bottom));
    return {
      bottomGap: consoleBox.bottom - cardBottom,
      expectedGap: parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth),
    };
  });

  expect(metrics.bottomGap).toBeGreaterThan(0);
  expect(Math.abs(metrics.bottomGap - metrics.expectedGap)).toBeLessThanOrEqual(1.5);
  expectNoBrowserErrors(failures, "U5 조언 카드 하단 정렬");
});

test("탭과 현재 상황은 FHD에서 금속 표면과 확대된 글자를 사용한다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);
  const styles = await page.evaluate(() => {
    const tab = document.querySelector<HTMLElement>(".u5-console__tabs button:not(.is-active)");
    const panel = document.querySelector<HTMLElement>(".u5-situation-panel");
    const title = document.querySelector<HTMLElement>(".u5-situation-panel__title");
    const body = document.querySelector<HTMLElement>(".u5-situation");
    if (tab === null || panel === null || title === null || body === null) {
      throw new Error("U5 금속 표면 fixture가 없다");
    }
    const surface = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      return { clipPath: style.clipPath, backgroundImage: style.backgroundImage, boxShadow: style.boxShadow };
    };
    return {
      tab: surface(tab),
      panel: surface(panel),
      tabSize: parseFloat(getComputedStyle(tab).fontSize),
      tabHeights: [...document.querySelectorAll<HTMLElement>(".u5-console__tabs button")].map((button) => button.getBoundingClientRect().height),
      titleSize: parseFloat(getComputedStyle(title).fontSize),
      bodySize: parseFloat(getComputedStyle(body).fontSize),
    };
  });

  for (const surface of [styles.tab, styles.panel]) {
    expect(surface.clipPath).not.toBe("none");
    expect(surface.backgroundImage).toContain("linear-gradient");
    expect(surface.boxShadow.match(/inset/g)).toHaveLength(2);
  }
  expect(styles.tabSize).toBeGreaterThanOrEqual(18);
  expect(styles.tabHeights).toHaveLength(2);
  expect(styles.tabHeights[0]).toBeGreaterThanOrEqual(30);
  expect(styles.tabHeights[1]).toBeGreaterThanOrEqual(30);
  expect(Math.abs(styles.tabHeights[0] - styles.tabHeights[1])).toBeLessThanOrEqual(0.1);
  expect(styles.titleSize).toBeGreaterThanOrEqual(19);
  expect(styles.bodySize).toBeGreaterThanOrEqual(21);
  expect(styles.bodySize).toBeGreaterThan(styles.titleSize);
  expectNoBrowserErrors(failures, "U5 금속 표면과 상황 typography");
});

test("현재 상황 패널은 FHD에서 카드 바로 위까지 늘어나고 글자는 좌측 상단에 남는다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await useFhd(page);

  const metrics = await page.getByTestId("u5-console").evaluate((console) => {
    const mode = console.querySelector<HTMLElement>(".u5-advice-mode");
    const panel = console.querySelector<HTMLElement>(".u5-situation-panel");
    const title = console.querySelector<HTMLElement>(".u5-situation-panel__title");
    const body = console.querySelector<HTMLElement>(".u5-situation");
    const cards = [...console.querySelectorAll<HTMLElement>(".u5-advice__button")];
    if (mode === null || panel === null || title === null || body === null || cards.length !== 3) {
      throw new Error("U5 상황 패널 확장 fixture가 없다");
    }

    const modeStyle = getComputedStyle(mode);
    const panelStyle = getComputedStyle(panel);
    const panelBox = panel.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    const bodyBox = body.getBoundingClientRect();
    const cardTop = Math.min(...cards.map((card) => card.getBoundingClientRect().top));
    return {
      expectedGap: parseFloat(modeStyle.rowGap),
      actualGap: cardTop - panelBox.bottom,
      titleTopInset: titleBox.top - panelBox.top,
      titleLeftInset: titleBox.left - panelBox.left,
      panelPaddingTop: parseFloat(panelStyle.paddingTop),
      panelPaddingLeft: parseFloat(panelStyle.paddingLeft),
      freeSpaceBelowBody: panelBox.bottom - bodyBox.bottom,
      hasOutcome: mode.dataset.hasOutcome,
    };
  });

  expect(Math.abs(metrics.actualGap - metrics.expectedGap)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(metrics.titleTopInset - metrics.panelPaddingTop)).toBeLessThanOrEqual(3);
  expect(Math.abs(metrics.titleLeftInset - metrics.panelPaddingLeft)).toBeLessThanOrEqual(3);
  expect(metrics.freeSpaceBelowBody).toBeGreaterThan(16);
  expect(metrics.hasOutcome).toBe("false");

  await page.getByRole("button", { name: "일반 사건 · 선택 후", exact: true }).click();
  const outcomeGap = await page.getByTestId("u5-console").evaluate((console) => {
    const mode = console.querySelector<HTMLElement>(".u5-advice-mode");
    const panel = console.querySelector<HTMLElement>(".u5-situation-panel");
    const outcome = console.querySelector<HTMLElement>("[data-testid='u5-outcome']");
    if (mode === null || panel === null || outcome === null) {
      throw new Error("U5 선택 후 패널 확장 fixture가 없다");
    }
    return {
      expected: parseFloat(getComputedStyle(mode).rowGap),
      actual: outcome.getBoundingClientRect().top - panel.getBoundingClientRect().bottom,
      hasOutcome: mode.dataset.hasOutcome,
    };
  });
  expect(Math.abs(outcomeGap.actual - outcomeGap.expected)).toBeLessThanOrEqual(1.5);
  expect(outcomeGap.hasOutcome).toBe("true");
  expectNoBrowserErrors(failures, "U5 현재 상황 패널 확장");
});
