import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globals = readFileSync("app/globals.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

function numericDeclaration(
  css: string,
  selector: string,
  property: string,
): number {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const propertyPattern = new RegExp(
    `${property}\\s*:\\s*(\\d+(?:\\.\\d+)?)`,
  );
  const rule = [
    ...css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g")),
  ].find((match) => propertyPattern.test(match[1] ?? ""));
  const declaration = rule?.[1]?.match(propertyPattern);

  if (declaration?.[1] === undefined) {
    throw new Error(`${selector}의 ${property} 값을 찾을 수 없습니다.`);
  }

  return Number(declaration[1]);
}

describe("U4 fixed 16:9 canvas contract", () => {
  it("inherits the shared 1920x1080 canvas and 60:40 GameShell split", () => {
    expect(globals).toContain("width: 120rem");
    expect(globals).toContain("height: 67.5rem");
    expect(globals).toContain(
      "grid-template-columns: minmax(0, 3fr) minmax(0, 2fr)",
    );
  });

  it("loads the U4 stylesheet and its visual correction layer from the root layout", () => {
    expect(layout).toContain('import "./u4-dungeon-map.css";');
    expect(layout).toContain('import "./u4-dungeon-map-fixes.css";');
  });

  it("keeps U4 styles inside the fixed canvas coordinate system", () => {
    const css = readFileSync("app/u4-dungeon-map.css", "utf8");
    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    expect(css).toContain(".u4-dungeon-map-screen .game-shell");
    expect(css).toMatch(/\.u4-dungeon-map-screen[\s\S]*height:\s*100%/);
    expect(`${css}\n${fixes}`).not.toMatch(/@media\b/);
    expect(`${css}\n${fixes}`).not.toMatch(
      /(?:^|[^a-z-])\d*\.?\d+(?:vw|vh)\b/i,
    );
  });

  it("removes ornate map-frame chrome and enlarges room iconography", () => {
    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    expect(fixes).toMatch(
      /\.u4-map-surface__frame\s*\{[\s\S]*display:\s*none/,
    );
    expect(fixes).toMatch(
      /\.u4-room__icon\s*\{[\s\S]*width:\s*49%[\s\S]*height:\s*49%/,
    );
    expect(fixes).toMatch(
      /\.u4-corridor\s*\{[\s\S]*height:\s*clamp\(1\.05rem/,
    );
  });

  it("keeps the complete route topology visible while preserving state priority", () => {
    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    const inactiveCorridor = numericDeclaration(
      fixes,
      ".u4-corridor",
      "opacity",
    );
    const visitedCorridor = numericDeclaration(
      fixes,
      ".u4-corridor.is-visited",
      "opacity",
    );
    const selectableCorridor = numericDeclaration(
      fixes,
      ".u4-corridor.is-selectable",
      "opacity",
    );
    const inactiveRoom = numericDeclaration(
      fixes,
      ".u4-room.is-inactive",
      "opacity",
    );

    expect(inactiveCorridor).toBeGreaterThanOrEqual(0.62);
    expect(visitedCorridor).toBeGreaterThan(inactiveCorridor);
    expect(selectableCorridor).toBeGreaterThan(visitedCorridor);
    expect(inactiveRoom).toBeGreaterThanOrEqual(0.68);
    expect(inactiveRoom).toBeLessThan(visitedCorridor);
  });

  it("keeps the vignette below corridors and rooms", () => {
    const base = readFileSync("app/u4-dungeon-map.css", "utf8");
    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    const vignette = numericDeclaration(
      fixes,
      ".u4-map-surface__vignette",
      "z-index",
    );
    const corridors = numericDeclaration(
      base,
      ".u4-map-surface__corridors",
      "z-index",
    );
    const rooms = numericDeclaration(
      base,
      ".u4-map-surface__rooms",
      "z-index",
    );

    expect(vignette).toBe(2);
    expect(vignette).toBeLessThan(corridors);
    expect(corridors).toBeLessThan(rooms);
  });

  /*
   * 우측 패널은 앞 두 덩어리를 내용 높이로 쌓고, 마지막이 남는 자리를 받는다.
   *
   * 전에는 2fr : 1fr 로 나눠 다음 지점을 아래 3분의 1 에 붙였다. 그러면 파티
   * 칸이 내용보다 커져 카드 아래가 빈 상자로 남는다. 그래서 둘 다 내용 높이로
   * 두었는데, 이번에는 그 아래가 통째로 비어 보였다.
   *
   * 답사 기록이 그 자리를 받는다. 늘려도 빈 상자가 되지 않는 유일한 덩어리라
   * 그렇다 - 알아낸 규칙이 쌓이고, 넘치면 그 안에서 스크롤한다. 앞 둘은 그대로
   * 내용 높이다.
   */
  it("stacks the right panel and lets only the last block take the rest", () => {
    const base = readFileSync("app/u4-dungeon-map.css", "utf8");
    const rule = base.match(/\.u4-right-panel\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toMatch(/grid-template-rows:\s*auto auto minmax\(0, 1fr\)/);
    /* 마지막이 자리를 받아야 하므로 위로 몰지 않는다. */
    expect(rule).not.toMatch(/align-content:\s*start/);

    /* 늘어난 덩어리는 제 안에서 스크롤한다. 패널을 밀어내지 않는다. */
    const survey = base.match(/\.u4-survey\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(survey).toMatch(/min-height:\s*0/);
    expect(survey).toMatch(/overflow-y:\s*auto/);

    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    const override = fixes.match(/\.u4-right-panel\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(override).not.toMatch(/grid-template-rows/);
  });

  it("keeps destination content above its decorative panel and the move CTA fully visible", () => {
    const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");
    expect(fixes).toMatch(
      /\.u4-destination__panel-frame\s*\{[\s\S]*z-index:\s*1/,
    );
    expect(fixes).toMatch(/\.u4-destination__summary[\s\S]*z-index:\s*2/);
    expect(fixes).toMatch(
      /\.u4-move-button\s*\{[\s\S]*height:\s*clamp\(3\.7rem/,
    );
    expect(fixes).toMatch(/\.u4-move-button__left,[\s\S]*display:\s*none/);
  });
});

describe("선택한 지점 썸네일", () => {
  /*
   * 여기서 필요한 것은 분류 하나다.
   *
   * 방 밑그림이 돌문이라 칸의 주인공이 되어, 정작 무슨 지점인지 말하는 아이콘을
   * 덮었다. 밑그림을 물려 두는 것으로 한 번 넘겼다가 아예 뺐다 - 지도의 방들은
   * 그대로 그 밑그림을 쓰고, 이 칸은 아이콘과 테두리만 든다.
   */
  it("방 밑그림을 두지 않는다", () => {
    const source = readFileSync("components/game/U4DungeonMapScreen.tsx", "utf8");
    const thumbnail = source.match(/u4-destination__thumbnail[\s\S]*?<\/div>/)?.[0] ?? "";

    expect(thumbnail).toContain("u4-destination__icon");
    expect(thumbnail).toContain("u4-destination__frame");
    expect(thumbnail).not.toContain("u4-destination__room");
  });

  /* 아이콘이 작으면 테두리 안에 묻힌다. */
  it("분류 아이콘이 썸네일의 절반을 넘는다", () => {
    const sheet = readFileSync("app/u4-dungeon-map.css", "utf8");
    const icon = [...sheet.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, selector]) => selector.includes(".u4-destination__icon"))
      .map(([, , body]) => body.match(/width:\s*(\d+)%/)?.[1])
      .find((one) => one !== undefined) ?? "0";

    expect(Number(icon)).toBeGreaterThan(50);
  });
});

