import { expect, test, type Page } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

const RECORD_COUNT = 18;
const LAST_RECORD = `합성 원정 기록 ${RECORD_COUNT}`;
const TOLERANCE = 1.5;

interface CardBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

async function mountOverflowingBack(page: Page): Promise<readonly CardBox[]> {
  const party = page.getByTestId("u5-party");
  const before = await party.locator("[data-testid='u5-party-member']").evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect();
      return { left: box.left, top: box.top, width: box.width, height: box.height };
    }),
  );

  await page.getByTestId("u5-party-member").first().evaluate((card, count) => {
    const back = document.createElement("div");
    back.className = "party-card__back";
    back.dataset.testid = "party-member-changes";

    const heading = document.createElement("h4");
    const name = document.createElement("strong");
    name.textContent = "로자린드";
    heading.append(name);
    back.append(heading);

    const list = document.createElement("ol");
    list.className = "party-card__changes";
    for (let position = 1; position <= count; position += 1) {
      const item = document.createElement("li");
      const cause = document.createElement("strong");
      cause.textContent = `합성 원정 기록 ${position}`;
      const detail = document.createElement("span");
      detail.className = "party-card__change-detail";
      detail.textContent = `신뢰 ${40 + position} → ${39 + position}`;
      item.append(cause, detail);
      list.append(item);
    }
    back.append(list);
    card.append(back);
    card.classList.add("is-flipped");
  }, RECORD_COUNT);

  return before;
}

test("U5 파티 카드 기록은 scrollbar 없이 마지막 항목까지 스크롤된다", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const failures = watchBrowserErrors(page);
  await page.goto("/u5-test");

  const before = await mountOverflowingBack(page);
  const back = page.getByTestId("party-member-changes");
  await expect(back).toBeVisible();

  const initial = await back.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
    overflowY: getComputedStyle(element).overflowY,
    scrollbarWidth: getComputedStyle(element).scrollbarWidth,
    webkitDisplay: getComputedStyle(element, "::-webkit-scrollbar").display,
  }));
  expect(initial.scrollHeight).toBeGreaterThan(initial.clientHeight);
  expect(initial.scrollTop).toBe(0);
  expect(initial.overflowY).toBe("auto");
  expect(initial.scrollbarWidth).toBe("none");
  expect(initial.webkitDisplay).toBe("none");

  const backBox = await back.boundingBox();
  expect(backBox).not.toBeNull();
  if (backBox === null) throw new Error("합성한 카드 뒷면의 위치를 측정할 수 없다");
  await page.mouse.move(backBox.x + backBox.width / 2, backBox.y + backBox.height / 2);
  await page.mouse.wheel(0, backBox.height);
  await expect.poll(() => back.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const final = await back.evaluate((element, lastText) => {
    element.scrollTop = element.scrollHeight;
    const last = [...element.querySelectorAll<HTMLElement>(".party-card__changes > li")]
      .find((item) => item.textContent?.includes(lastText));
    if (last === undefined) throw new Error("마지막 합성 기록이 없다");
    const area = element.getBoundingClientRect();
    const item = last.getBoundingClientRect();
    return {
      scrollTop: element.scrollTop,
      maximum: element.scrollHeight - element.clientHeight,
      lastText: last.textContent,
      lastTop: item.top,
      lastBottom: item.bottom,
      areaTop: area.top,
      areaBottom: area.bottom,
    };
  }, LAST_RECORD);
  expect(final.scrollTop).toBeGreaterThanOrEqual(final.maximum - 1);
  expect(final.lastText).toContain(LAST_RECORD);
  expect(final.lastTop).toBeGreaterThanOrEqual(final.areaTop - TOLERANCE);
  expect(final.lastBottom).toBeLessThanOrEqual(final.areaBottom + TOLERANCE);

  const after = await page.getByTestId("u5-party-member").evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect();
      return { left: box.left, top: box.top, width: box.width, height: box.height };
    }),
  );
  expect(after).toHaveLength(before.length);
  for (let index = 0; index < before.length; index += 1) {
    expect(Math.abs(after[index].left - before[index].left)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(after[index].top - before[index].top)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(after[index].width - before[index].width)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(after[index].height - before[index].height)).toBeLessThanOrEqual(TOLERANCE);
  }

  const containment = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".u5-progress-screen .game-shell__right-panel");
    const party = document.querySelector<HTMLElement>("[data-testid='u5-party']");
    if (panel === null || party === null) throw new Error("U5 우측 패널을 찾을 수 없다");
    const panelBox = panel.getBoundingClientRect();
    const partyBox = party.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      partyLeft: partyBox.left,
      partyRight: partyBox.right,
      partyTop: partyBox.top,
      partyBottom: partyBox.bottom,
      panelLeft: panelBox.left,
      panelRight: panelBox.right,
      panelTop: panelBox.top,
      panelBottom: panelBox.bottom,
    };
  });
  expect(containment.documentWidth).toBeLessThanOrEqual(containment.innerWidth + 1);
  expect(containment.documentHeight).toBeLessThanOrEqual(containment.innerHeight + 1);
  expect(containment.partyLeft).toBeGreaterThanOrEqual(containment.panelLeft - TOLERANCE);
  expect(containment.partyRight).toBeLessThanOrEqual(containment.panelRight + TOLERANCE);
  expect(containment.partyTop).toBeGreaterThanOrEqual(containment.panelTop - TOLERANCE);
  expect(containment.partyBottom).toBeLessThanOrEqual(containment.panelBottom + TOLERANCE);
  expectNoBrowserErrors(failures, "U5 파티 카드 숨김 scrollbar");
});
