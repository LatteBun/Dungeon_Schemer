import { expect, test, type Page } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

const VIEWPORTS = [
  { name: "FHD", width: 1920, height: 1080 },
  { name: "QHD", width: 2560, height: 1440 },
  { name: "16:10", width: 1440, height: 900 },
  { name: "5:4", width: 1280, height: 1024 },
] as const;

async function focusByTab(page: Page, target: ReturnType<Page["getByTestId"]>): Promise<void> {
  for (let index = 0; index < 50; index += 1) {
    if (await target.evaluate((element) => document.activeElement === element)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("선택 가능한 U4 방에 Tab focus를 이동하지 못했습니다.");
}

for (const viewport of VIEWPORTS) {
  test(`거미굴 양피지 preview는 ${viewport.name} 고정 캔버스에서 레이어 계약을 지킨다`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const failures = watchBrowserErrors(page);
    await page.goto("/u4-test?theme=spider");

    const canvas = page.locator(".game-canvas");
    const map = page.getByTestId("u4-map-surface");
    const parchment = map.locator(".u4-map-surface__background.is-parchment");
    await expect(canvas).toBeVisible();
    await expect(map).toBeVisible();
    await expect(parchment).toHaveAttribute(
      "src",
      "/assets/u4/map/map_background_spider_parchment.png",
    );
    await expect(map.locator(".u4-map-surface__atmosphere")).toHaveCount(0);
    await expect(parchment).toHaveJSProperty("naturalWidth", 1672);
    await expect(parchment).toHaveJSProperty("naturalHeight", 1360);
    await expect(parchment).toHaveCSS("object-fit", "cover");
    await expect(parchment).toHaveCSS("object-position", "50% 50%");

    const canvasBox = await canvas.boundingBox();
    const mapBox = await map.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(mapBox).not.toBeNull();
    if (canvasBox !== null && mapBox !== null) {
      expect(Math.abs(canvasBox.width / canvasBox.height - 16 / 9)).toBeLessThan(0.01);
      expect(mapBox.x).toBeGreaterThanOrEqual(canvasBox.x - 1);
      expect(mapBox.x + mapBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
      expect(mapBox.y).toBeGreaterThanOrEqual(canvasBox.y - 1);
      expect(mapBox.y + mapBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 1);
    }

    await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
    expectNoBrowserErrors(failures, `U4 spider parchment ${viewport.name}`);
  });
}

for (const themeId of ["spider", "desert", "graveyard"] as const) {
  test(`${themeId} preview는 공용 양피지 배경 계약을 지킨다`, async ({ page }) => {
    const failures = watchBrowserErrors(page);
    await page.goto(`/u4-test?theme=${themeId}`);

    const map = page.getByTestId("u4-map-surface");
    await expect(
      map.locator(".u4-map-surface__background.is-parchment"),
    ).toHaveAttribute(
      "src",
      "/assets/u4/map/map_background_spider_parchment.png",
    );
    await expect(
      map.locator(".u4-map-surface__background.is-themed"),
    ).toHaveCount(0);
    await expect(map.locator(".u4-map-surface__atmosphere")).toHaveCount(0);
    expectNoBrowserErrors(failures, `U4 ${themeId} shared parchment`);
  });
}

test("거미굴 preview는 mouse·Tab·Enter·Space·방향키 선택을 유지한다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await page.goto("/u4-test?theme=spider");

  const rooms = page.getByTestId("u4-selectable-room");
  const first = rooms.first();
  const second = rooms.nth(1);
  await expect(rooms).toHaveCount(2);

  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");

  await focusByTab(page, first);
  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("Tab");
  await expect(second).toBeFocused();
  await page.keyboard.press("Space");
  await expect(second).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("ArrowLeft");
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  expectNoBrowserErrors(failures, "U4 spider parchment interaction");
});

test("실제 캠페인의 거미굴 계약도 U4 양피지 배경으로 전달한다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await page.goto("/campaign?seed=dungeon-schemer");
  await page.getByRole("button", { name: "길드 게시판으로" }).click();

  const board = page.getByRole("region", { name: "길드 게시판" });
  const spiderOffer = board
    .getByRole("button")
    .filter({ hasText: "거미굴" })
    .filter({ hasText: "진입 가능" })
    .first();
  await expect(spiderOffer).toBeVisible();
  await spiderOffer.click();
  await page.getByRole("button", { name: "이 공고 계약하기" }).click();

  const map = page.getByRole("region", { name: "던전 지도" });
  await expect(map).toBeVisible();
  await expect(map.locator(".u4-map-surface__background.is-parchment")).toHaveAttribute(
    "src",
    "/assets/u4/map/map_background_spider_parchment.png",
  );
  await expect(map.locator(".u4-map-surface__atmosphere")).toHaveCount(0);
  expectNoBrowserErrors(failures, "campaign spider parchment flow");
});
