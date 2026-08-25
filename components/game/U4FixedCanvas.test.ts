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
   * 우측 패널은 파티를 자동 높이 행에 두고, 답사 기록을 내부 스크롤이 가능한
   * 유연한 가운데 행에 배치하며, 다음 지점과 CTA를 자동 높이의 마지막 행에 둔다.
   */
  it("keeps the survey flexible and the destination in the last row", () => {
    const base = readFileSync("app/u4-dungeon-map.css", "utf8");
    const rightPanel = base.match(/\.u4-right-panel\s*\{([^}]*)\}/)?.[1] ?? "";
    const party = base.match(/\.u4-party\s*\{([^}]*)\}/)?.[1] ?? "";
    const survey = base.match(/\.u4-survey\s*\{([^}]*)\}/)?.[1] ?? "";
    const destination = base.match(/\.u4-destination\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rightPanel).toMatch(
      /grid-template-rows:\s*auto minmax\(0, 1fr\) auto/,
    );
    expect(party).toMatch(/grid-row:\s*1/);
    expect(survey).toMatch(/grid-row:\s*2/);
    expect(destination).toMatch(/grid-row:\s*3/);
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

  it("keeps the pressed move-button skin over the default skin", () => {
    const base = readFileSync("app/u4-dungeon-map.css", "utf8");
    const pressed = base.match(
      /\.u4-move-button__center--active\s*\{([^}]*)\}/,
    )?.[1] ?? "";
    const active = base.match(
      /\.u4-move-button:not\(:disabled\):active \.u4-move-button__center--active\s*\{([^}]*)\}/,
    )?.[1] ?? "";

    expect(pressed).toMatch(/position:\s*absolute/);
    expect(pressed).toMatch(/inset:\s*0/);
    expect(active).toMatch(/opacity:\s*1/);
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
  /*
   * 아이콘 하나만 든다.
   *
   * 방 밑그림(돌문)은 칸의 주인공이 되어 아이콘을 덮었고, 액자 그림은 244x119
   * 라 정사각 칸에 넣으면 늘어났다. 여기서 필요한 것은 분류 하나뿐이라 둘 다
   * 버리고 테두리는 CSS 로 두른다.
   */
  it("아이콘 말고 다른 그림을 두지 않는다", () => {
    const source = readFileSync("components/game/U4DungeonMapScreen.tsx", "utf8");
    const thumbnail = source.match(/u4-destination__thumbnail[\s\S]*?<\/div>/)?.[0] ?? "";

    expect(thumbnail).toContain("u4-destination__icon");
    expect(thumbnail).not.toContain("u4-destination__room");
    expect(thumbnail).not.toContain("u4-destination__frame");
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


describe("액자를 늘리지 않는다", () => {
  /*
   * 241x129 짜리를 700x70 판에 늘려 씌우고 있었다.
   *
   * 가로로 세 배 늘고 세로로 눌려 네 귀퉁이 문양이 찌그러졌다. `border-image` 는
   * 귀퉁이를 그대로 두고 변만 늘린다.
   */
  it("선택한 지점 액자는 border-image 로 잘라 쓴다", () => {
    const sheet = readFileSync("app/u4-dungeon-map.css", "utf8");
    const panel = sheet.match(/\.u4-destination__panel\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(panel).toMatch(/border-image:\s*url\("\/assets\/u4\/navigation\/destination_panel_frame\.png"\)/);
    /* 늘려 씌우던 그림 요소는 남아 있지 않아야 한다. */
    expect(sheet).not.toContain("u4-destination__panel-frame");
  });

  /*
   * 폭은 열이 정하고 그림이 따른다.
   *
   * 같은 변수를 열과 그림에 각각 주었더니 둘이 어긋나 액자가 첫 글자를 덮었다.
   */
  /* 좌우로 긴 칸보다 네모난 칸이 아이콘을 크게 보여준다. */
  it("썸네일은 정사각이고 폭은 열이 정한다", () => {
    const sheet = readFileSync("app/u4-dungeon-map.css", "utf8");
    const thumb = sheet.match(/\.u4-destination__thumbnail\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(thumb).toMatch(/width:\s*100%/);
    expect(thumb).toMatch(/aspect-ratio:\s*1/);
  });
});

/*
 * 같은 규칙을 두 파일이 정하면, 뒤에 실리는 쪽만 살고 앞의 값은 죽는다.
 *
 * 선택한 지점의 아이콘이 그랬다. u4-dungeon-map.css 의 크기를
 * u4-dungeon-map-fixes.css 가 42%로 덮어써서, 앞 파일을 아무리 고쳐도 화면은
 * 그대로였다. 고쳤다고 믿은 채로 배포까지 나갔다.
 */
describe("U4 지도 스타일 단일 출처", () => {
  const map = readFileSync("app/u4-dungeon-map.css", "utf8");
  const fixes = readFileSync("app/u4-dungeon-map-fixes.css", "utf8");

  function definesSize(css: string, selector: string): boolean {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))]
      .some((match) => /(^|[;{\s])width\s*:/.test(match[1] ?? ""));
  }

  it("선택한 지점 아이콘의 크기를 두 파일이 함께 정하지 않는다", () => {
    expect(definesSize(map, ".u4-destination__icon")).toBe(true);
    expect(definesSize(fixes, ".u4-destination__icon")).toBe(false);
  });

  it("아이콘이 칸을 채울 만큼 크다", () => {
    // 42%일 때는 어두운 칸 한가운데 작게 떠 있어 무슨 지점인지 읽기 어려웠다.
    expect(numericDeclaration(map, ".u4-destination__icon", "width"))
      .toBeGreaterThanOrEqual(80);
  });
});
