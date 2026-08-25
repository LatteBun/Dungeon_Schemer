import { expect, test } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

test("U5-2 프리뷰는 재생 중 건너뛰고 완료 뒤 다시 볼 수 있다", async ({ page }) => {
  const failures = watchBrowserErrors(page);

  await page.goto("/u5-2-test");

  await page.getByRole("button", { name: "전투 건너뛰기" }).click();
  await expect(page.getByRole("button", { name: "다시 보기" })).toBeVisible();

  await page.getByRole("button", { name: "다시 보기" }).click();
  await expect(page.getByRole("button", { name: "전투 건너뛰기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "지도로 돌아간다" })).toHaveCount(0);

  expectNoBrowserErrors(failures, "/u5-2-test");
});
