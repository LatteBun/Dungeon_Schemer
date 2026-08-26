import { expect, test, type Page } from "@playwright/test";

const CAMPAIGN_KEY = "dungeon-schemer.campaign-run.v1";
const ACHIEVEMENT_KEY = "dungeon-schemer.player-progress.v1";
const AUDIO_KEY = "dungeon-schemer.audio-settings.v1";
const BACKUP_KEY = "dungeon-schemer.player-progress.corrupt-backup";

const emptyProgress = JSON.stringify({
  version: 1,
  totals: { completedCampaigns: 0, expeditions: 0, clearedExpeditions: 0, wipedExpeditions: 0, deaths: 0, advices: 0 },
  endingCounts: { distrust: 0, denounced: 0, completed: 0, exhausted: 0, unemployed: 0 },
  unlocked: {},
  recordedRunIds: [],
});

async function openDiagnostics(page: Page): Promise<void> {
  const trigger = page.getByRole("button", { name: /달성 0 \/ 12/ });
  for (let index = 0; index < 4; index += 1) await trigger.click();
  await expect(page.getByTestId("achievement-storage-diagnostics")).toHaveCount(0);
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "브라우저 저장 진단" })).toBeVisible();
}

test("독립 업적 화면은 5회 진입 뒤 저장을 복사하고 캠페인만 초기화한다", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(({ campaign, achievement, audio, backup }) => {
    if (sessionStorage.getItem("diagnostics-fixture-seeded") === "true") return;
    sessionStorage.setItem("diagnostics-fixture-seeded", "true");
    localStorage.setItem("dungeon-schemer.campaign-run.v1", campaign);
    localStorage.setItem("dungeon-schemer.player-progress.v1", achievement);
    localStorage.setItem("dungeon-schemer.audio-settings.v1", audio);
    localStorage.setItem("dungeon-schemer.player-progress.corrupt-backup", backup);
    localStorage.setItem("unrelated", "keep-me");
  }, {
    campaign: JSON.stringify({ version: 1, seed: "report-seed", actions: [{ type: "OPEN_BOARD" }] }),
    achievement: emptyProgress,
    audio: JSON.stringify({ version: 1, bgmEnabled: false, sfxEnabled: false }),
    backup: "{broken",
  });

  await page.goto("/achievements");
  await openDiagnostics(page);

  const dialog = page.getByRole("dialog", { name: "브라우저 저장 진단" });
  await expect(dialog).toContainText("report-seed");
  await expect(dialog).toContainText("OPEN_BOARD");
  await expect(dialog).not.toContainText("keep-me");

  await dialog.getByRole("button", { name: "전체 복사" }).click();
  await expect(dialog.getByRole("status")).toHaveText("진단 정보를 복사했습니다.");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("report-seed");
  expect(copied).toContain(BACKUP_KEY);
  expect(copied).not.toContain("keep-me");

  await dialog.getByRole("button", { name: "캠페인 초기화" }).click();
  await expect(dialog).toContainText("업적 기록과 오디오 설정은 그대로 유지됩니다.");
  await dialog.getByRole("button", { name: "캠페인 초기화 확인" }).click();

  await expect(page).toHaveURL(/\/campaign$/);
  await expect(page.getByRole("button", { name: "길드 게시판으로" })).toBeVisible();
  expect(await page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), [
    CAMPAIGN_KEY, ACHIEVEMENT_KEY, AUDIO_KEY, BACKUP_KEY, "unrelated",
  ])).toEqual({
    [CAMPAIGN_KEY]: null,
    [ACHIEVEMENT_KEY]: emptyProgress,
    [AUDIO_KEY]: JSON.stringify({ version: 1, bgmEnabled: false, sfxEnabled: false }),
    [BACKUP_KEY]: "{broken",
    unrelated: "keep-me",
  });
});

test("캠페인 overlay에서도 같은 히든 진단을 열고 초기화를 취소한다", async ({ page }) => {
  await page.goto("/campaign?seed=diagnostics-overlay");
  await page.getByRole("button", { name: "빠른 메뉴 열기" }).click();
  await page.getByRole("button", { name: "업적 기록" }).click();
  await openDiagnostics(page);

  const diagnostics = page.getByRole("dialog", { name: "브라우저 저장 진단" });
  await diagnostics.getByRole("button", { name: "캠페인 초기화" }).click();
  await diagnostics.getByRole("button", { name: "취소" }).click();
  await expect(diagnostics.getByRole("button", { name: "전체 복사" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/campaign");
});
