import { expect, test } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

const CAMPAIGN_KEY = "dungeon-schemer.campaign-run.v1";
const BACKUP_KEY = "dungeon-schemer.campaign-run.corrupt-backup";

const brokenRun = JSON.stringify({
  version: 1,
  seed: "broken-mobile-save",
  actions: [
    { type: "OPEN_BOARD" },
    { type: "SELECT_CONTRACT", offerId: "offer-0-dungeon-spider-01" },
    { type: "START_EXPEDITION", expeditionId: "broken" },
  ],
});

const futureRun = JSON.stringify({
  version: 2,
  seed: "future-save",
  actions: [{ type: "OPEN_BOARD" }],
});

test("손상된 저장은 인트로로 복구하고 원문을 격리한다", async ({ page }) => {
  const failures = watchBrowserErrors(page);
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), {
    key: CAMPAIGN_KEY,
    raw: brokenRun,
  });

  await page.goto("/campaign");

  await expect(page.getByRole("button", { name: "길드 게시판으로" })).toBeVisible();
  await expect(page.getByText("This page couldn't load")).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY)).not.toBeNull();
  expect(await page.evaluate((keys) => Object.fromEntries(
    keys.map((key) => [key, localStorage.getItem(key)]),
  ), [CAMPAIGN_KEY, BACKUP_KEY])).toEqual({
    [CAMPAIGN_KEY]: null,
    [BACKUP_KEY]: expect.any(String),
  });
  const backup = await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY);
  if (backup === null) throw new Error("손상 백업이 저장되지 않았다");
  expect(JSON.parse(backup)).toMatchObject({
    raw: brokenRun,
  });
  expectNoBrowserErrors(failures, "corrupt saved campaign recovery");
});

test("명시적 시드는 저장과 손상 백업을 건드리지 않는다", async ({ page }) => {
  const previousBackup = "existing corruption backup";
  await page.addInitScript(({ campaign, backup }) => {
    localStorage.setItem("dungeon-schemer.campaign-run.v1", campaign);
    localStorage.setItem("dungeon-schemer.campaign-run.corrupt-backup", backup);
  }, { campaign: brokenRun, backup: previousBackup });

  await page.goto("/campaign?seed=explicit");

  await page.getByRole("button", { name: "길드 게시판으로" }).click();
  await expect(page.getByText("길드 게시판", { exact: true })).toBeVisible();
  expect(await page.evaluate((keys) => Object.fromEntries(
    keys.map((key) => [key, localStorage.getItem(key)]),
  ), [CAMPAIGN_KEY, BACKUP_KEY])).toEqual({
    [CAMPAIGN_KEY]: brokenRun,
    [BACKUP_KEY]: previousBackup,
  });
});

test("미래 버전 저장은 새 판에서 행동해도 원문과 손상 백업을 보존한다", async ({ page }) => {
  const previousBackup = "existing corruption backup";
  await page.addInitScript(({ campaign, backup }) => {
    localStorage.setItem("dungeon-schemer.campaign-run.v1", campaign);
    localStorage.setItem("dungeon-schemer.campaign-run.corrupt-backup", backup);
  }, { campaign: futureRun, backup: previousBackup });

  await page.goto("/campaign");

  await page.getByRole("button", { name: "길드 게시판으로" }).click();
  await expect(page.getByText("길드 게시판", { exact: true })).toBeVisible();
  expect(await page.evaluate((keys) => Object.fromEntries(
    keys.map((key) => [key, localStorage.getItem(key)]),
  ), [CAMPAIGN_KEY, BACKUP_KEY])).toEqual({
    [CAMPAIGN_KEY]: futureRun,
    [BACKUP_KEY]: previousBackup,
  });
});
