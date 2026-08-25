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
    const bossHeading = page.getByRole("heading", { level: 1, name: /보스방/ });
    const settlement = page.getByRole("button", { name: "정산으로" });
    const adviceList = page.getByTestId("u5-advice-list");
    const skip = page.getByRole("button", { name: "전투 건너뛰기" });
    const reaction = page.getByRole("button", { name: "반응 확인" });
    const returnToMap = page.getByRole("button", { name: "지도로 돌아간다" });
    const map = page.getByRole("region", { name: "던전 지도" });
    await expect.poll(async () => {
      if (await bossHeading.isVisible()) return "boss";
      if (await settlement.isVisible()) return "settlement";
      if (await adviceList.isVisible()) return "advice";
      if (await skip.isVisible()) return "skip";
      if (await reaction.isVisible()) return "reaction";
      if (await returnToMap.isVisible()) return "return";
      if (await map.isVisible()) return "map";
      return null;
    }, {
      message: `보스방으로 가는 다음 화면을 기다립니다: ${seed}, step ${step}`,
      timeout: 15_000,
    }).not.toBeNull();

    if (await bossHeading.isVisible()) return true;
    if (await settlement.isVisible()) return false;
    if (await adviceList.isVisible()) await adviceList.locator("button:not(:disabled)").first().click();
    else if (await skip.isVisible()) await skip.click();
    else if (await reaction.isVisible()) await reaction.click();
    else if (await returnToMap.isVisible()) await returnToMap.click();
    else if (await map.isVisible()) {
      await map.getByTestId("u4-selectable-room").first().click();
      await page.getByRole("button", { name: "이 지점으로 이동" }).click();
    }
  }

  return false;
}

test("캠페인이 인트로에서 첫 전투 결과 확인까지 진행된다", async ({ page }, testInfo) => {
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

  const skip = page.getByRole("button", { name: "전투 건너뛰기" });
  await expect(skip).toBeEnabled({ timeout: 15_000 });
  await skip.click();

  const reaction = page.getByRole("button", { name: "반응 확인" });
  const returnToMap = page.getByRole("button", { name: "지도로 돌아간다" });
  await expect.poll(async () => await reaction.isVisible() || await returnToMap.isVisible(), {
    message: "전투 뒤 반응 확인 또는 지도 복귀를 기다립니다",
    timeout: 15_000,
  }).toBe(true);
  if (await reaction.isVisible()) {
    await expect(returnToMap).toHaveCount(0);
    await reaction.click();
  }
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
  const reaction = page.getByRole("button", { name: "반응 확인" });
  await expect.poll(async () => await reaction.isVisible() || await settlement.isVisible(), {
    message: "보스전 뒤 반응 확인 또는 정산 진입을 기다립니다",
    timeout: 15_000,
  }).toBe(true);
  if (await reaction.isVisible()) await reaction.click();
  await expect(settlement).toBeEnabled({ timeout: 15_000 });

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
