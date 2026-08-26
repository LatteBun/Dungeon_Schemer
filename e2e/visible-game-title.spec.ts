import { expect, test } from "@playwright/test";

test("메인과 업적 문서가 새 게임 제목을 노출한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("용사님, 이쪽입니다");
  await expect(page).toHaveTitle("용사님, 이쪽입니다");

  await page.goto("/achievements");
  await expect(page).toHaveTitle("길잡이 업적 기록 | 용사님, 이쪽입니다");
});
