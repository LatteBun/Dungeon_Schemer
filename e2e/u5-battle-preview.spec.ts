import { expect, test, type Page } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

async function partyHpValues(page: Page): Promise<readonly string[]> {
  return page.locator(".party-card__stat").filter({ hasText: "HP" }).locator("dd").allTextContents();
}

async function partyCardHeights(page: Page): Promise<readonly number[]> {
  return page.locator(".party-card").evaluateAll((cards) =>
    cards.map((card) => card.getBoundingClientRect().height));
}

async function expectPlaybackControls(entryName: string, page: Page, expectsHpResult: boolean): Promise<void> {
  const failures = watchBrowserErrors(page);
  await page.goto("/u5-2-test");

  await page.getByRole("button", { name: entryName }).click();
  const speed = page.getByRole("button", { name: "전투 재생 속도" });
  await expect(speed).toHaveText("×1");
  await speed.click();
  await expect(speed).toHaveText("×2");
  const skip = page.getByRole("button", { name: "전투 건너뛰기" });
  await expect(skip).toBeEnabled();

  await skip.click();
  const reaction = page.getByRole("button", { name: "반응 확인" });
  await expect(reaction).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".party-card__settled-results")).toHaveCount(3);
  await expect(page.locator(".party-card__settled-result")).toHaveCount(0);
  const hpBeforeReaction = await partyHpValues(page);
  const heightsBeforeReaction = await partyCardHeights(page);
  await reaction.click();

  const replay = page.getByRole("button", { name: "다시 보기" });
  await expect(replay).toBeEnabled({ timeout: 10_000 });
  const settledCard = page.locator(".party-card:has(.party-card__settled-result--trust)");
  await expect(settledCard).toHaveCount(1);
  await expect(settledCard.locator(".party-card__settled-result--trust")).toHaveText("신뢰 −2");
  if (expectsHpResult) {
    await expect(settledCard.locator(".party-card__settled-result--hp")).toHaveText(/HP −\d+/);
  } else {
    await expect(page.locator(".party-card__settled-result--hp")).toHaveCount(0);
  }
  expect(await partyHpValues(page)).toEqual(hpBeforeReaction);
  const heightsAfterReaction = await partyCardHeights(page);
  expect(heightsAfterReaction).toHaveLength(heightsBeforeReaction.length);
  heightsAfterReaction.forEach((height, index) => {
    expect(Math.abs(height - heightsBeforeReaction[index]!)).toBeLessThan(1);
  });
  expect(Math.max(...heightsAfterReaction) - Math.min(...heightsAfterReaction)).toBeLessThan(1);
  const finalHp = await settledCard.locator(".party-card__stat").filter({ hasText: "HP" }).locator("dd").innerText();
  const finalTrust = await settledCard.locator(".party-card__stat").filter({ hasText: "신뢰" }).locator("dd").innerText();
  const settledResults = await settledCard.locator(".party-card__settled-result").allTextContents();

  await replay.click();
  await expect(skip).toBeEnabled();
  await expect(speed).toHaveText("×2");
  await expect(settledCard.locator(".party-card__stat").filter({ hasText: "HP" }).locator("dd")).toHaveText(finalHp);
  await expect(settledCard.locator(".party-card__stat").filter({ hasText: "신뢰" }).locator("dd")).toHaveText(finalTrust);
  await expect(settledCard.locator(".party-card__settled-result")).toHaveText(settledResults);
  await expect(reaction).toHaveCount(0);

  await expect(replay).toBeVisible({ timeout: 60_000 });
  await expect(settledCard.locator(".party-card__settled-result")).toHaveText(settledResults);
  expectNoBrowserErrors(failures, `U5-2 ${entryName}`);
}

test.describe("U5-2 전투 프리뷰", () => {
  test("실제 일반전은 건너뛰기와 다시 보기를 전환한다", async ({ page }) => {
    await expectPlaybackControls("E3 실제 일반전", page, false);
  });

  test("실제 보스전은 건너뛰기와 다시 보기를 전환한다", async ({ page }) => {
    await expectPlaybackControls("E4 실제 보스전", page, true);
  });

  test("자연 재생 완료 뒤에는 다시 보기를 표시한다", async ({ page }) => {
    await page.goto("/u5-2-test");

    const reaction = page.getByRole("button", { name: "반응 확인" });
    await expect(reaction).toBeVisible({ timeout: 60_000 });
    await reaction.click();
    await expect(page.getByRole("button", { name: "다시 보기" })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".party-card__settled-result--trust")).toHaveText("신뢰 −2");
    await expect(page.getByRole("button", { name: "전투 건너뛰기" })).toHaveCount(0);
  });

  test("보스전 피격 effect가 나타나도 파티 카드 높이를 유지한다", async ({ page }) => {
    test.setTimeout(90_000);
    const failures = watchBrowserErrors(page);
    await page.goto("/u5-2-test");
    await page.getByRole("button", { name: "E4 실제 보스전" }).click();
    await expect(page.getByRole("heading", { name: /E4 실제 보스전/ })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const effect = page.locator(".party-card__effect--hp");
    await expect(effect).toHaveCount(0);
    const beforeHit = await partyCardHeights(page);
    await expect(effect).toBeVisible({ timeout: 60_000 });
    const duringHit = await partyCardHeights(page);

    expect(duringHit).toHaveLength(beforeHit.length);
    duringHit.forEach((height, index) => {
      expect(Math.abs(height - beforeHit[index]!)).toBeLessThan(1);
    });
    expectNoBrowserErrors(failures, "U5-2 보스전 피격 카드 높이");
  });
});
