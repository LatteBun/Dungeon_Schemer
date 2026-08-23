import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 셸의 틀은 모든 화면이 같아야 한다.
 *
 * 두 칸의 여백과 화면 제목이 화면별 파일에서 세 번 더 덮이는 바람에 안쪽
 * 여백이 u4 12.8px, u5·u6 16px, u3 17.3px 로 갈라져 있었다. 제목의 서체마저
 * u3·u4 만 세리프였다. 한 화면 안에서는 보이지 않고, 화면을 옮길 때 제목이
 * 몇 px 미끄러지는 것으로만 드러나는 종류의 어긋남이라 여기서 고정한다.
 *
 * 배경·display 같은 화면 고유의 성질은 화면별 파일에 두어도 된다. 자리를
 * 정하는 값만 막는다.
 */

const APP = join(process.cwd(), "app");

function styleSheets(): string[] {
  return readdirSync(APP).filter((name) => name.endsWith(".css"));
}

/** 주석은 규칙이 아니다. 주석에 클래스 이름을 적었다고 걸리면 안 된다. */
function read(name: string): string {
  return readFileSync(join(APP, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** `.selector { ... }` 한 덩어리씩 끊는다. 여러 줄 선언을 놓치지 않으려는 것이다. */
function rules(css: string): Array<{ selector: string; body: string }> {
  const found: Array<{ selector: string; body: string }> = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    found.push({ selector: match[1].trim(), body: match[2] });
  }
  return found;
}

/** 컴포넌트에서 panel-section 과 함께 붙는 클래스를 모은다. */
function panelSectionClasses(): string[] {
  const dir = join(process.cwd(), "components", "game");
  const found = new Set<string>();

  for (const name of readdirSync(dir).filter((file) => file.endsWith(".tsx"))) {
    const source = readFileSync(join(dir, name), "utf8");
    for (const match of source.matchAll(/className="([^"]*\bpanel-section\b[^"]*)"/g)) {
      for (const token of match[1].split(/\s+/)) {
        if (token !== "" && token !== "panel-section") found.add(token);
      }
    }
  }

  return [...found].sort();
}

describe("셸 틀", () => {
  it("두 칸의 여백을 globals.css 밖에서 정하지 않는다", () => {
    const offenders: string[] = [];

    for (const name of styleSheets()) {
      if (name === "globals.css") continue;
      for (const rule of rules(read(name))) {
        if (!/game-shell__(main|right-panel)/.test(rule.selector)) continue;
        if (/(^|[\s;])padding(-\w+)?\s*:/.test(rule.body)) offenders.push(`${name} — ${rule.selector}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("화면 제목을 globals.css 밖에서 꾸미지 않는다", () => {
    const offenders = styleSheets()
      .filter((name) => name !== "globals.css")
      .filter((name) => rules(read(name)).some((rule) => /game-shell__main\s*>\s*h1/.test(rule.selector)));

    expect(offenders).toEqual([]);
  });

  it("틀의 값은 토큰으로만 정한다", () => {
    const globals = read("globals.css");

    for (const token of [
      "--shell-padding",
      "--shell-title-size",
      "--shell-title-gap",
      "--panel-section-padding",
      "--panel-title-size",
      "--panel-title-gap",
    ]) {
      expect(globals).toContain(token);
    }
  });

  it("panel-section 자체를 globals.css 밖에서 손대지 않는다", () => {
    const offenders = styleSheets()
      .filter((name) => name !== "globals.css")
      .filter((name) => read(name).includes("panel-section"));

    expect(offenders).toEqual([]);
  });

  /*
   * 원정 화면(U3·U4·U5)의 바탕과 질감도 한 곳에서 정한다.
   *
   * 본문 바탕이 u3 #130d08, u4 #100b07 이고 u5 는 아무것도 정하지 않아 기본값
   * #201710 이 나와 u4 보다 두 배 밝았다. 질감 타일도 u3 만 깔고 있었다. 한
   * 화면만 보면 알 수 없고, 단계를 넘길 때 재질이 바뀌는 것으로만 드러난다.
   *
   * U2(도입)와 U6(정산·엔딩)은 아직 별개 화면이라 여기 들어오지 않는다.
   */
  it("셸의 바탕을 globals.css 밖에서 정하지 않는다", () => {
    const offenders: string[] = [];

    for (const name of styleSheets()) {
      if (name === "globals.css") continue;
      for (const rule of rules(read(name))) {
        /* U2·U6 은 아직 원정 화면과 별개다. 그 둘로 범위를 좁힌 규칙은 넘어간다. */
        if (/\.(u2|u6)[\w-]*(?=[\s.:,])/.test(rule.selector)) continue;
        if (!/\.game-shell(__(main|right-panel|body))?(?![\w-])/.test(rule.selector)) continue;
        if (/(^|[\s;])background(-(color|image|repeat))?\s*:/.test(rule.body)) offenders.push(`${name} — ${rule.selector}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("원정 화면 셋이 공통 바탕 클래스를 쓴다", () => {
    const dir = join(process.cwd(), "components", "game");
    const wearing = ["U3BoardScreen", "U4DungeonMapScreen", "U5ProgressScreen"]
      .filter((name) => readFileSync(join(dir, `${name}.tsx`), "utf8").includes('className="expedition-screen'));

    expect(wearing).toEqual(["U3BoardScreen", "U4DungeonMapScreen", "U5ProgressScreen"]);
    expect(read("globals.css")).toContain("--screen-texture");
  });

  /*
   * 같은 파티를 보여주는 자리는 같은 문구를 쓴다.
   *
   * U3 만 "파티 구성" 이고 나머지가 "파티 상태" 였다. 카드에 담긴 것이 HP·신뢰
   * ·골드 라는 상태이므로 어느 화면에서든 같은 말이어야 한다.
   */
  it("파티 블록의 문구가 화면마다 같다", () => {
    const dir = join(process.cwd(), "components", "game");
    const headings = new Set<string>();

    for (const name of readdirSync(dir).filter((file) => file.endsWith(".tsx"))) {
      const source = readFileSync(join(dir, name), "utf8");
      for (const match of source.matchAll(/<h[23][^>]*id="u\d-party-title"[^>]*>([^<]+)<\/h[23]>/g)) {
        headings.add(match[1].trim());
      }
    }

    expect([...headings]).toEqual(["파티 상태"]);
  });

  /*
   * 덩어리의 겉모습은 화면마다 다시 정하지 않는다.
   *
   * 클래스 목록을 손으로 적지 않고 컴포넌트에서 읽어 온다. 새 화면이
   * panel-section 을 쓰기 시작하면 그 화면도 저절로 이 검사에 들어온다.
   */
  it("덩어리를 쓰는 화면이 겉모습을 다시 정하지 않는다", () => {
    const classes = panelSectionClasses();
    expect(classes.length).toBeGreaterThan(0);

    const chrome = /(^|[\s;])(padding(-\w+)?|border(-(top|right|bottom|left|radius|color|width))?|font-size|font-family)\s*:/;
    const offenders: string[] = [];

    for (const name of styleSheets()) {
      if (name === "globals.css") continue;
      for (const rule of rules(read(name))) {
        const hit = classes.find((cls) => new RegExp(`\\.${cls}(?![\\w-])`).test(rule.selector));
        if (hit === undefined) continue;
        if (/[>\s]\s*h[23]\b/.test(rule.selector) || !/[>\s+~]/.test(rule.selector.replace(/^\s*[.\w-]+\s*$/, ""))) {
          if (chrome.test(rule.body)) offenders.push(`${name} — ${rule.selector}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
