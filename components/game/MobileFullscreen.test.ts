import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canGoFullscreen, enterLandscapeFullscreen } from "./ScreenFit";

/**
 * 휴대폰에서 주소창을 감추는 길은 두 갈래뿐이다.
 *
 * 브라우저는 주소창을 마음대로 감추게 해 주지 않는다. 홈 화면에 얹어 앱처럼
 * 열거나(manifest), 사람이 눌러서 전체 화면으로 들어가는 것(안드로이드)이다.
 * 둘 다 조용히 빠지기 쉬운 설정이라 여기서 고정한다.
 */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("휴대폰에서 주소창 감추기", () => {
  const manifest = read("app", "manifest.ts");
  const layout = read("app", "layout.tsx");

  it("홈 화면 앱은 전체 화면 가로로 연다", () => {
    expect(manifest).toMatch(/display:\s*"fullscreen"/);
    expect(manifest).toMatch(/orientation:\s*"landscape"/);
  });

  it("예전 iOS 가 읽는 태그도 함께 낸다", () => {
    /* Next 는 표준형만 낸다. 이것이 빠지면 홈 화면에서 열어도 주소창이 남는다. */
    expect(layout).toContain("apple-mobile-web-app-capable");
    expect(layout).toMatch(/appleWebApp:\s*\{[^}]*capable:\s*true/);
  });

  it("판을 손가락으로 늘리지 않고 가장자리까지 쓴다", () => {
    expect(layout).toMatch(/userScalable:\s*false/);
    expect(layout).toMatch(/viewportFit:\s*"cover"/);
  });

  it("높이는 지금 보이는 만큼으로 잰다", () => {
    // 정적 뷰포트 높이로 재면 주소창이 떠 있는 동안 판이 위아래로 잘린다.
    expect(read("app", "globals.css")).toContain("100dvh / 67.5");
  });
});

describe("전체 화면 들어가기", () => {
  it("받아 주지 않는 기기에서는 아무 일도 하지 않는다", async () => {
    // 아이폰 사파리에는 이 API 가 없다. 눌러도 조용해야 한다.
    expect(canGoFullscreen({})).toBe(false);
    expect(canGoFullscreen(null)).toBe(false);

    await expect(enterLandscapeFullscreen({}, null)).resolves.toBeUndefined();
  });

  it("전체 화면에 든 뒤에 가로로 잠근다", async () => {
    /* 잠금은 전체 화면 안에서만 허락된다. 순서가 뒤집히면 잠기지 않는다. */
    const order: string[] = [];
    const element = { requestFullscreen: async () => { order.push("fullscreen"); } };
    const orientation = { lock: async (value: "landscape") => { order.push(`lock:${value}`); } };

    await enterLandscapeFullscreen(element, orientation);

    expect(order).toEqual(["fullscreen", "lock:landscape"]);
  });

  it("잠그지 못해도 전체 화면은 남긴다", async () => {
    // 잠금을 지원하지 않는 기기가 있다. 주소창이 사라진 것만으로도 얻은 것이 있다.
    const element = { requestFullscreen: async () => undefined };
    const orientation = { lock: async () => { throw new Error("not supported"); } };

    await expect(enterLandscapeFullscreen(element, orientation)).resolves.toBeUndefined();
  });

  it("전체 화면이 거부되면 잠금을 시도하지 않는다", async () => {
    let locked = false;
    const element = { requestFullscreen: async () => { throw new Error("denied"); } };
    const orientation = { lock: async () => { locked = true; } };

    await enterLandscapeFullscreen(element, orientation);

    expect(locked).toBe(false);
  });
});
