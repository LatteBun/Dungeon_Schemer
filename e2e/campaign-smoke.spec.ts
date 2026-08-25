import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

async function attachSelection(testInfo: TestInfo, name: string, value: string): Promise<void> {
  await testInfo.attach(name, { body: value, contentType: "text/plain" });
}

async function startExpedition(page: Page, seed: string): Promise<void> {
  await page.goto(`/campaign?seed=${seed}`);
  await page.getByRole("button", { name: "길드 게시판으로" }).click();

  const board = page.getByRole("region", { name: "길드 게시판" });
  await expect(board).toBeVisible();
  await board.getByRole("button").filter({ hasText: "진입 가능" }).first().click();
  await page.getByRole("button", { name: "이 공고 계약하기" }).click();
  await expect(page.getByRole("region", { name: "던전 지도" })).toBeVisible();
}

async function reachesBossReplay(page: Page, seed: string): Promise<boolean> {
  await startExpedition(page, seed);

  for (let step = 0; step < 40; step += 1) {
    if (await page.getByRole("heading", { level: 1, name: /보스방/ }).isVisible()) return true;
    if (await page.getByRole("button", { name: "정산으로" }).isVisible()) return false;

    const adviceList = page.getByTestId("u5-advice-list");
    if (await adviceList.isVisible()) {
      await adviceList.locator("button:not(:disabled)").first().click();
      continue;
    }

    const skip = page.getByRole("button", { name: "전투 건너뛰기" });
    if (await skip.isVisible()) {
      await skip.click();
      continue;
    }

    const returnToMap = page.getByRole("button", { name: "지도로 돌아간다" });
    if (await returnToMap.isVisible()) {
      await returnToMap.click();
      continue;
    }

    const map = page.getByRole("region", { name: "던전 지도" });
    if (await map.isVisible()) {
      await map.getByTestId("u4-selectable-room").first().click();
      await page.getByRole("button", { name: "이 지점으로 이동" }).click();
      continue;
    }

    throw new Error(`보스방으로 가는 화면을 찾지 못했습니다: ${seed}, step ${step}`);
  }

  return false;
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
  const returnToMap = page.getByRole("button", { name: "지도로 돌아간다" });
  await expect(returnToMap).toBeEnabled();
  await returnToMap.click();
  await expect(map).toBeVisible();
  await expect(page.getByTestId("campaign-rejection")).toHaveCount(0);
  expectNoBrowserErrors(failures, `campaign ${page.url()}`);
});

test("보스전은 재생이 끝난 뒤에만 정산으로 이동한다", async ({ page }) => {
  test.setTimeout(120_000);

  let foundBoss = false;
  for (let index = 0; index < 30; index += 1) {
    if (await reachesBossReplay(page, `boss-screen-${index}`)) {
      foundBoss = true;
      break;
    }
  }
  expect(foundBoss).toBe(true);

  const skip = page.getByRole("button", { name: "전투 건너뛰기" });
  const settlement = page.getByRole("button", { name: "정산으로" });
  await expect(skip).toBeEnabled();
  await expect(settlement).toHaveCount(0);

  await skip.click();
  await expect(settlement).toBeEnabled();

  await page.getByRole("button", { name: "다시 보기" }).click();
  await expect(skip).toBeEnabled();
  await expect(settlement).toHaveCount(0);

  await skip.click();
  await settlement.click();
  await expect(page.getByTestId("u6-settlement")).toBeVisible();
});

test("같은 원정의 다음 전투도 선택한 ×2 속도를 유지한다", async ({ page }) => {
  test.setTimeout(120_000);
  const failures = watchBrowserErrors(page);
  await page.goto("/campaign?seed=dungeon-schemer");

  await page.getByRole("button", { name: "길드 게시판으로" }).click();
  const board = page.getByRole("region", { name: "길드 게시판" });
  await board.getByRole("button").filter({ hasText: "진입 가능" }).first().click();
  await page.getByRole("button", { name: "이 공고 계약하기" }).click();

  const speed = page.getByRole("button", { name: "전투 재생 속도" });
  const enterNextBattle = async () => {
    for (let step = 0; step < 40; step += 1) {
      if (await speed.isVisible()) return;

      const adviceList = page.getByTestId("u5-advice-list");
      if (await adviceList.isVisible()) {
        await adviceList.locator("button:not(:disabled)").first().click();
        continue;
      }

      const returnToMap = page.getByRole("button", { name: "지도로 돌아간다" });
      if (await returnToMap.isVisible()) {
        await returnToMap.click();
        continue;
      }

      const map = page.getByRole("region", { name: "던전 지도" });
      if (await map.isVisible()) {
        await map.getByTestId("u4-selectable-room").first().click();
        await page.getByRole("button", { name: "이 지점으로 이동" }).click();
        continue;
      }

      throw new Error("전투 재생으로 가는 원정 화면을 찾지 못했습니다");
    }

    throw new Error("전투 재생 화면에 도달하지 못했습니다");
  };

  await enterNextBattle();
  await speed.click();
  await expect(speed).toHaveText("×2");
  await page.getByRole("button", { name: "전투 건너뛰기" }).click();
  await page.getByRole("button", { name: "지도로 돌아간다" }).click();

  await enterNextBattle();
  await expect(speed).toHaveText("×2");
  await expect(speed).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("u5-battle-scene")).toHaveAttribute("data-playback-rate", "2");

  await page.getByRole("button", { name: "전투 건너뛰기" }).click();
  await page.getByRole("button", { name: "정산으로" }).click();
  await page.getByRole("button", { name: "길드로 돌아간다" }).click();
  const nextBoard = page.getByRole("region", { name: "길드 게시판" });
  await expect(nextBoard).toBeVisible();
  await nextBoard.getByRole("button").filter({ hasText: "진입 가능" }).first().click();
  await page.getByRole("button", { name: "이 공고 계약하기" }).click();

  await enterNextBattle();
  await expect(speed).toHaveText("×1");
  await expect(speed).toHaveAttribute("aria-pressed", "false");
  expectNoBrowserErrors(failures, `campaign ${page.url()}`);
});
