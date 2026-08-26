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

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

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

const STATUS_VIEWPORTS = [
  { name: "FHD", width: 1920, height: 1080 },
  { name: "HD", width: 1280, height: 720 },
  { name: "5:4", width: 1280, height: 1024 },
] as const;

for (const viewport of STATUS_VIEWPORTS) {
  test(`상태 칩 7개 ${viewport.name} 한 줄·퀵 메뉴 비겹침`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const failures = watchBrowserErrors(page);
    await page.goto("/u1-test?screen=board");

    const list = page.locator(".game-shell__status-list");
    const chips = page.locator(".game-shell__status-chip");
    await expect(chips).toHaveCount(7);
    await expect(page.getByText("7 / 5", { exact: true })).toBeVisible();

    const metrics = await list.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

    const boxes = await chips.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      };
    }));
    expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(1);
    expect(boxes.every((box) => box.scrollWidth <= box.clientWidth + 1)).toBe(true);

    const trigger = page.getByRole("button", { name: "빠른 메뉴 열기" });
    const triggerBox = await trigger.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    expect(boxes.some((box) => overlaps(box, triggerBox))).toBe(false);

    await trigger.click();
    const panel = page.getByRole("region", { name: "빠른 메뉴" });
    const panelBox = await panel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    expect(boxes.some((box) => overlaps(box, panelBox))).toBe(false);
    expectNoBrowserErrors(failures, `상태 칩 7개 ${viewport.name}`);
  });
}
