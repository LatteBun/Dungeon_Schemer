import { expect, test, type Page } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

async function expectPlaybackControls(entryName: string, page: Page): Promise<void> {
  const failures = watchBrowserErrors(page);
  await page.goto("/u5-2-test");

  await page.getByRole("button", { name: entryName }).click();
  const skip = page.getByRole("button", { name: "전투 건너뛰기" });
  await expect(skip).toBeEnabled();

  await skip.click();
  const replay = page.getByRole("button", { name: "다시 보기" });
  await expect(replay).toBeEnabled();

  await replay.click();
  await expect(skip).toBeEnabled();
  expectNoBrowserErrors(failures, `U5-2 ${entryName}`);
}

test.describe("U5-2 전투 프리뷰", () => {
  test("실제 일반전은 건너뛰기와 다시 보기를 전환한다", async ({ page }) => {
    await expectPlaybackControls("E3 실제 일반전", page);
  });

  test("실제 보스전은 건너뛰기와 다시 보기를 전환한다", async ({ page }) => {
    await expectPlaybackControls("E4 실제 보스전", page);
  });

  test("자연 재생 완료 뒤에는 다시 보기를 표시한다", async ({ page }) => {
    await page.goto("/u5-2-test");

    await expect(page.getByRole("button", { name: "다시 보기" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "전투 건너뛰기" })).toHaveCount(0);
  });
});
