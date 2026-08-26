import { expect, test } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

const VIEWPORTS = [
  { name: "desktop", width: 1672, height: 941 },
  { name: "mobile-landscape", width: 844, height: 390 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`${viewport.name} 일러스트 메인 메뉴의 세 실제 버튼이 캔버스 안에 정렬된다`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const failures = watchBrowserErrors(page);
    await page.goto("/");

    const canvas = page.locator(".main-menu-screen__canvas");
    const actions = page.getByRole("navigation", { name: "메인 메뉴" });
    const startButton = actions.getByRole("link", { name: "캠페인 시작" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("용사님, 이쪽입니다");
    await expect(page.locator(".main-menu-screen__art")).toHaveAttribute(
      "src",
      "/assets/main-menu/hero-this-way-main-menu.jpeg",
    );
    await expect(startButton).toBeVisible();
    await expect(actions.getByRole("link", { name: "업적" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "설정" })).toBeVisible();
    await expect(page.getByRole("button", { name: "빠른 메뉴 열기" })).toBeHidden();

    const [canvasBox, actionsBox, startButtonBox] = await Promise.all([
      canvas.boundingBox(),
      actions.boundingBox(),
      startButton.boundingBox(),
    ]);
    expect(canvasBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(startButtonBox).not.toBeNull();
    if (canvasBox === null || actionsBox === null || startButtonBox === null) return;

    expect(actionsBox.x).toBeGreaterThan(canvasBox.x);
    expect(actionsBox.x + actionsBox.width).toBeLessThan(canvasBox.x + canvasBox.width);
    const actionTopRatio = (actionsBox.y - canvasBox.y) / canvasBox.height;
    expect(actionTopRatio).toBeGreaterThanOrEqual(0.555);
    expect(startButtonBox.height / canvasBox.height).toBeCloseTo(0.072, 2);
    expect(actionsBox.y + actionsBox.height).toBeLessThan(canvasBox.y + canvasBox.height);
    expectNoBrowserErrors(failures, `${viewport.name} 일러스트 메인 메뉴`);
  });
}

test("설정은 기존 전역 메뉴를 열고 업적과 캠페인은 실제 route로 이동한다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await page.goto("/");

  await page.getByRole("button", { name: "설정" }).click();
  await expect(page.getByRole("region", { name: "빠른 메뉴" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "설정" })).toBeFocused();

  await page.getByRole("link", { name: "업적" }).click();
  await expect(page).toHaveURL(/\/achievements\?returnTo=%2F$/);
  await page.goto("/");
  await page.getByRole("link", { name: "캠페인 시작" }).click();
  await expect(page).toHaveURL(/\/campaign$/);
  expectNoBrowserErrors(failures, "일러스트 메인 메뉴 동선");
});
