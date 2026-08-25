import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __dungeonAudioCalls: string[];
  }
}

async function mockMediaPlayback(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: string[] = [];
    Object.defineProperty(window, "__dungeonAudioCalls", { value: calls });
    HTMLMediaElement.prototype.play = function play() {
      calls.push(`play:${this.src}`);
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {
      calls.push(`pause:${this.src}`);
    };
  });
}

async function audioCalls(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => [...window.__dungeonAudioCalls]);
}

async function playCount(page: Page, filename: string): Promise<number> {
  const calls = await audioCalls(page);
  return calls.filter((call) => call.startsWith("play:") && call.endsWith(filename)).length;
}

async function playCalls(page: Page): Promise<readonly string[]> {
  return (await audioCalls(page)).filter((call) => call.startsWith("play:"));
}

test("로컬 WAV 세 파일이 제공되고 첫 설정은 모두 OFF다", async ({ page, request }) => {
  for (const filename of [
    "dungeon-schemer-guild-loop.wav",
    "ui-select.wav",
    "ui-menu.wav",
  ]) {
    const response = await request.get(`/assets/audio/${filename}`);
    expect(response.ok(), filename).toBe(true);
    expect(response.headers()["content-type"]).toContain("audio/wav");
  }

  await mockMediaPlayback(page);
  await page.goto("/");
  expect(await playCalls(page)).toEqual([]);

  await page.getByRole("button", { name: "빠른 메뉴 열기" }).click();
  await expect(page.getByRole("switch", { name: /BGM/ })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("switch", { name: /효과음/ })).toHaveAttribute("aria-checked", "false");
  expect(await playCalls(page)).toEqual([]);

  const stored = await page.evaluate((key) => localStorage.getItem(key), "dungeon-schemer.audio-settings.v1");
  expect(stored === null || stored === JSON.stringify({
    version: 1,
    bgmEnabled: false,
    sfxEnabled: false,
  })).toBe(true);
});

test("오디오 토글은 저장되고 reload와 campaign route 전환에도 BGM을 중복 시작하지 않는다", async ({ page }) => {
  await mockMediaPlayback(page);
  await page.goto("/");
  await page.getByRole("button", { name: "빠른 메뉴 열기" }).click();

  const bgm = page.getByRole("switch", { name: /BGM/ });
  const sfx = page.getByRole("switch", { name: /효과음/ });
  await bgm.click();
  await expect(bgm).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => playCount(page, "dungeon-schemer-guild-loop.wav")).toBe(1);

  await sfx.click();
  await expect(sfx).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => playCount(page, "ui-menu.wav")).toBe(1);

  expect(await page.evaluate((key) => localStorage.getItem(key), "dungeon-schemer.audio-settings.v1"))
    .toBe(JSON.stringify({ version: 1, bgmEnabled: true, sfxEnabled: true }));

  await page.reload();
  expect(await playCalls(page)).toEqual([]);
  await page.getByRole("button", { name: "빠른 메뉴 열기" }).click();
  await expect(page.getByRole("switch", { name: /BGM/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("switch", { name: /효과음/ })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => playCount(page, "dungeon-schemer-guild-loop.wav")).toBe(1);

  await page.getByRole("link", { name: "캠페인 시작" }).click();
  await expect(page).toHaveURL(/\/campaign$/);
  await expect(page.getByRole("button", { name: "길드 게시판으로" })).toBeVisible();
  expect(await playCount(page, "dungeon-schemer-guild-loop.wav")).toBe(1);
});

test("campaign 업적 overlay를 닫아도 게시판 phase와 URL을 보존한다", async ({ page }) => {
  await mockMediaPlayback(page);
  await page.goto("/campaign?seed=dungeon-schemer");
  await page.getByRole("button", { name: "길드 게시판으로" }).click();
  const board = page.getByRole("region", { name: "길드 게시판" });
  await expect(board).toBeVisible();

  const menuButton = page.getByRole("button", { name: "빠른 메뉴 열기" });
  await menuButton.click();
  await page.getByRole("button", { name: "업적 기록" }).click();

  const overlay = page.getByRole("dialog", { name: "길잡이 업적 기록" });
  await expect(overlay).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/campaign");

  await overlay.getByRole("button", { name: "업적 기록 초기화" }).click();
  const reset = page.getByRole("dialog", { name: "업적 기록 초기화" });
  await expect(reset).toBeVisible();
  await reset.getByRole("button", { name: "취소" }).click();
  await expect(reset).toHaveCount(0);
  await expect(overlay).toBeVisible();

  await overlay.getByRole("button", { name: "이전 화면으로" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(board).toBeVisible();
  await expect(menuButton).toBeFocused();
  expect(new URL(page.url()).pathname).toBe("/campaign");

  await menuButton.click();
  await page.getByRole("button", { name: "업적 기록" }).click();
  await expect(overlay).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
  await expect(board).toBeVisible();
  await expect(menuButton).toBeFocused();
});

for (const [returnTo, expectedHref] of [
  [undefined, "/"],
  ["//evil.example", "/"],
  ["/campaign?seed=return-test", "/campaign?seed=return-test"],
] as const) {
  test(`독립 업적 route의 returnTo ${returnTo ?? "없음"}은 ${expectedHref}로 돌아간다`, async ({ page }) => {
    const path = returnTo === undefined
      ? "/achievements"
      : `/achievements?${new URLSearchParams({ returnTo })}`;
    await page.goto(path);
    await expect(page.getByRole("link", { name: "이전 화면으로" })).toHaveAttribute("href", expectedHref);
    await expect(page.getByRole("button", { name: "빠른 메뉴 열기" })).toBeHidden();
  });
}
