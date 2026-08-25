import { expect, test } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

const VIEWPORTS = [
  { name: "FHD", width: 1920, height: 1080 },
  { name: "QHD", width: 2560, height: 1440 },
  { name: "16:10", width: 1440, height: 900 },
  { name: "5:4", width: 1280, height: 1024 },
] as const;

const ROUTES = ["/", "/achievements", "/campaign", "/u5-test", "/u6-test"] as const;
const tolerance = 1.5;

for (const viewport of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`${route} ${viewport.name} 고정 캔버스 계약을 지킨다`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const failures = watchBrowserErrors(page);
      await page.goto(route);

      const canvas = page.locator(".game-canvas");
      await expect(canvas).toBeVisible();
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox).not.toBeNull();
      if (canvasBox === null) return;

      expect(Math.abs(canvasBox.width / canvasBox.height - 16 / 9)).toBeLessThan(0.01);
      expect(Math.abs(canvasBox.x - (viewport.width - canvasBox.width) / 2)).toBeLessThan(tolerance);
      expect(Math.abs(canvasBox.y - (viewport.height - canvasBox.height) / 2)).toBeLessThan(tolerance);
      if (viewport.name === "FHD" || viewport.name === "QHD") {
        expect(canvasBox.x).toBeLessThan(tolerance);
        expect(canvasBox.y).toBeLessThan(tolerance);
      } else {
        expect(canvasBox.x).toBeLessThan(tolerance);
        expect(canvasBox.y).toBeGreaterThan(tolerance);
      }

      const documentSize = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      expect(documentSize.scrollWidth).toBeLessThanOrEqual(documentSize.innerWidth + 1);
      expect(documentSize.scrollHeight).toBeLessThanOrEqual(documentSize.innerHeight + 1);

      const root = canvas.locator(":scope > .app-frame");
      const rootBox = await root.boundingBox();
      expect(rootBox).not.toBeNull();
      if (rootBox !== null) {
        expect(Math.abs(rootBox.width - canvasBox.width)).toBeLessThan(tolerance);
        expect(Math.abs(rootBox.height - canvasBox.height)).toBeLessThan(tolerance);
      }

      if (route === "/") {
        await page.getByRole("button", { name: "빠른 메뉴 열기" }).click();
        const panel = page.getByRole("region", { name: "빠른 메뉴" });
        const heading = page.getByRole("heading", { level: 1, name: "Dungeon Schemer" });
        const actions = page.getByRole("navigation", { name: "메인 메뉴" });
        const [panelBox, headingBox, actionsBox] = await Promise.all([
          panel.boundingBox(),
          heading.boundingBox(),
          actions.boundingBox(),
        ]);
        expect(panelBox).not.toBeNull();
        expect(headingBox).not.toBeNull();
        expect(actionsBox).not.toBeNull();
        if (panelBox !== null) {
          expect(panelBox.x).toBeGreaterThanOrEqual(canvasBox.x - tolerance);
          expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + tolerance);
          expect(panelBox.y).toBeGreaterThanOrEqual(canvasBox.y - tolerance);
          expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + tolerance);
          for (const occupied of [headingBox, actionsBox]) {
            if (occupied === null) continue;
            const overlaps = panelBox.x < occupied.x + occupied.width
              && panelBox.x + panelBox.width > occupied.x
              && panelBox.y < occupied.y + occupied.height
              && panelBox.y + panelBox.height > occupied.y;
            expect(overlaps).toBe(false);
          }
        }
      }

      const overflowingImages = await canvas.locator("img:visible").evaluateAll((images, box) =>
        images.flatMap((image) => {
          const rect = image.getBoundingClientRect();
          const outside = rect.left < box.x - 1.5
            || rect.top < box.y - 1.5
            || rect.right > box.x + box.width + 1.5
            || rect.bottom > box.y + box.height + 1.5;
          return outside ? [image.getAttribute("src") ?? "<inline image>"] : [];
        }), canvasBox);
      expect(overflowingImages, `${route} ${viewport.name} canvas 밖 이미지`).toEqual([]);

      await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
      expectNoBrowserErrors(failures, `${route} ${viewport.name}`);
    });
  }
}
