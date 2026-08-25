import { expect, test } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

test("상인 명패의 긴 비용과 잠금 이유는 카드 안에서 스크롤된다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/u5-test");
  await page.getByRole("button", { name: "상인 사건" }).click();

  const card = page.locator(".u5-advice").first();
  await expect(card.locator(".u5-advice__content")).toBeVisible();

  const merchantCost = `골드 ${"9".repeat(180)}`;
  const lockReason = "골드가모자라서구매할수없습니다".repeat(48);
  await card.evaluate((element, text) => {
    const cost = element.querySelector(".u5-advice__cost");
    const content = element.querySelector(".u5-advice__content");
    const button = element.querySelector<HTMLButtonElement>(".u5-advice__button");
    if (cost === null || content === null || button === null) throw new Error("상인 조언 fixture가 없다");
    cost.textContent = text.merchantCost;
    const blocked = document.createElement("span");
    blocked.className = "u5-advice__blocked";
    blocked.textContent = text.lockReason;
    content.append(blocked);
    button.disabled = true;
  }, { merchantCost, lockReason });

  const metrics = await card.evaluate((element) => {
    const button = element.querySelector<HTMLElement>(".u5-advice__button");
    const content = element.querySelector<HTMLElement>(".u5-advice__content");
    const cost = element.querySelector<HTMLElement>(".u5-advice__cost");
    const blocked = element.querySelector<HTMLElement>(".u5-advice__blocked");
    if (button === null || content === null || cost === null || blocked === null) {
      throw new Error("조언 명패의 내용 영역이 없다");
    }

    const buttonBox = button.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    content.scrollTop = content.scrollHeight;
    const blockedBox = blocked.getBoundingClientRect();

    return {
      buttonWidth: buttonBox.width,
      buttonHeight: buttonBox.height,
      contentWidth: contentBox.width,
      contentHeight: contentBox.height,
      contentScrollHeight: content.scrollHeight,
      contentScrollTop: content.scrollTop,
      contentOverflowY: getComputedStyle(content).overflowY,
      buttonScrollWidth: button.scrollWidth,
      lockText: blocked.textContent,
      costText: cost.textContent,
      blockedBottom: blockedBox.bottom,
      contentBottom: contentBox.bottom,
    };
  });

  expect(metrics.buttonHeight).toBeGreaterThan(0);
  expect(metrics.contentWidth).toBeLessThanOrEqual(metrics.buttonWidth + 1);
  expect(metrics.contentHeight).toBeLessThanOrEqual(metrics.buttonHeight + 1);
  expect(metrics.buttonScrollWidth).toBeLessThanOrEqual(metrics.buttonWidth + 1);
  expect(metrics.contentScrollHeight).toBeGreaterThan(metrics.contentHeight);
  expect(["auto", "scroll"]).toContain(metrics.contentOverflowY);
  expect(metrics.contentScrollTop).toBeGreaterThan(0);
  expect(metrics.blockedBottom).toBeLessThanOrEqual(metrics.contentBottom + 1);
  expect(metrics.costText).toBe(merchantCost);
  expect(metrics.lockText).toBe(lockReason);
  expectNoBrowserErrors(failures, "긴 상인 조언 명패");
});
