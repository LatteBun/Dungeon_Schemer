import { expect, test, type TestInfo } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

async function attachSelection(testInfo: TestInfo, name: string, value: string): Promise<void> {
  await testInfo.attach(name, { body: value, contentType: "text/plain" });
}

test("캠페인이 인트로에서 첫 사건 결과까지 진행된다", async ({ page }, testInfo) => {
  const failures = watchBrowserErrors(page);
  await page.goto("/campaign?seed=dungeon-schemer");

  await page.getByRole("button", { name: "길드 게시판으로" }).click();
  const board = page.getByRole("region", { name: "길드 게시판" });
  await expect(board).toBeVisible();

  const offer = board.getByRole("button").filter({ hasText: "진입 가능" }).first();
  const offerName = (await offer.innerText()).trim();
  await attachSelection(testInfo, "selected-offer", offerName);
  await offer.click();

  await page.getByRole("button", { name: "이 공고 계약하기" }).click();
  const map = page.getByRole("region", { name: "던전 지도" });
  await expect(map).toBeVisible();

  const battleNode = map.getByRole("button", { name: "전투 지점 선택" }).first();
  await expect(battleNode).toBeVisible();
  await attachSelection(testInfo, "selected-node", await battleNode.getAttribute("aria-label") ?? "전투 지점 선택");
  await battleNode.click();

  const move = page.getByRole("button", { name: "이 지점으로 이동" });
  await expect(move).toBeEnabled();
  const defaultSkin = move.locator(
    ".u4-move-button__center:not(.u4-move-button__center--active)",
  );
  const pressedSkin = move.locator(".u4-move-button__center--active");
  const [defaultBox, pressedBox] = await Promise.all([
    defaultSkin.boundingBox(),
    pressedSkin.boundingBox(),
  ]);
  expect(defaultBox).not.toBeNull();
  expect(pressedBox).not.toBeNull();
  if (defaultBox !== null && pressedBox !== null) {
    expect(Math.abs(pressedBox.x - defaultBox.x)).toBeLessThan(1);
    expect(Math.abs(pressedBox.y - defaultBox.y)).toBeLessThan(1);
    expect(Math.abs(pressedBox.width - defaultBox.width)).toBeLessThan(1);
    expect(Math.abs(pressedBox.height - defaultBox.height)).toBeLessThan(1);
  }

  await move.hover();
  await page.mouse.down();
  await expect(pressedSkin).toHaveCSS("opacity", "1");
  await page.mouse.up();

  const adviceList = page.getByTestId("u5-advice-list");
  await expect(adviceList).toBeVisible();
  const advice = adviceList.getByRole("button").first();
  await expect(advice).toBeEnabled();
  await attachSelection(testInfo, "selected-advice", (await advice.innerText()).trim());
  await advice.click();

  const outcome = page.getByTestId("u5-outcome");
  await expect(outcome).toBeVisible();
  await expect(outcome.getByRole("heading", { name: "사건 결과" })).toBeVisible();
  await expect(outcome.getByRole("heading", { name: "수치·신뢰 변화" })).toBeVisible();
  await expect(page.getByRole("button", { name: "지도로 돌아간다" })).toBeEnabled();
  await expect(page.getByTestId("campaign-rejection")).toHaveCount(0);
  expectNoBrowserErrors(failures, `campaign ${page.url()}`);
});
