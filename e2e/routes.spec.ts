import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

interface RouteCase {
  readonly path: string;
  readonly marker: (page: Page) => Locator;
}

const ROUTES: readonly RouteCase[] = [
  { path: "/", marker: (page) => page.getByRole("heading", { level: 1, name: "Dungeon Schemer" }) },
  { path: "/achievements", marker: (page) => page.getByRole("heading", { level: 1, name: "길잡이 업적 기록" }) },
  { path: "/campaign", marker: (page) => page.getByRole("main", { name: /당신은 용사들을 던전으로 안내하는 고블린 길잡이입니다/ }) },
  { path: "/u1-test", marker: (page) => page.getByRole("heading", { level: 1, name: "인트로" }) },
  { path: "/u2-test", marker: (page) => page.getByRole("main", { name: /당신은 용사들을 던전으로 안내하는 고블린 길잡이입니다/ }) },
  { path: "/u3-test", marker: (page) => page.getByRole("heading", { level: 1, name: "길드 게시판" }) },
  { path: "/u4-test", marker: (page) => page.getByRole("region", { name: "던전 지도" }) },
  { path: "/u5-test", marker: (page) => page.getByTestId("u5-progress") },
  { path: "/u5-2-test", marker: (page) => page.getByTestId("u5-progress") },
  { path: "/u6-test", marker: (page) => page.getByRole("heading", { level: 1, name: /정산 · 모르칸의 사체길/ }) },
];

for (const route of ROUTES) {
  test(`${route.path} 공개 화면이 브라우저 오류 없이 렌더링된다`, async ({ page }) => {
    const failures = watchBrowserErrors(page);
    const response = await page.goto(route.path);

    expect(response?.ok(), `${route.path} document response`).toBe(true);
    await expect(route.marker(page)).toBeVisible();
    await expect(page.locator("body")).not.toHaveText("");
    await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
    const quickMenu = page.getByRole("button", { name: "빠른 메뉴 열기" });
    if (route.path === "/achievements") {
      await expect(quickMenu).toBeHidden();
    } else {
      await expect(quickMenu).toBeVisible();
    }
    expectNoBrowserErrors(failures, route.path);
  });
}
