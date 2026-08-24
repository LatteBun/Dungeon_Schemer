import { expect, test } from "@playwright/test";
import { expectNoBrowserErrors, watchBrowserErrors } from "./browser-errors";

const VIEWPORTS = [
  { name: "FHD", width: 1920, height: 1080 },
  { name: "QHD", width: 2560, height: 1440 },
  { name: "16:10", width: 1440, height: 900 },
  { name: "5:4", width: 1280, height: 1024 },
] as const;

const ROUTES = ["/campaign", "/u5-test", "/u6-test"] as const;
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

      const root = canvas.locator(":scope > :not([data-canvas-layout='intrinsic'])").first();
      const rootBox = await root.boundingBox();
      expect(rootBox).not.toBeNull();
      if (rootBox !== null) {
        expect(Math.abs(rootBox.width - canvasBox.width)).toBeLessThan(tolerance);
        expect(Math.abs(rootBox.height - canvasBox.height)).toBeLessThan(tolerance);
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
