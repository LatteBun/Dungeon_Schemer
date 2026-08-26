import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 16:9 고정 캔버스 계약.
 *
 * 화면이 창 크기를 따라 모양을 바꾸던 시절의 CSS가 조용히 돌아오는 것을
 * 막는다. `vw` 하나, 미디어 쿼리 하나가 다시 들어오면 그 규칙만 창을
 * 따라가면서 나머지 캔버스와 어긋나고, 그 어긋남은 특정 창 크기에서만
 * 보이므로 사람이 눈으로 찾기 어렵다.
 */

function css(name: string): string {
  return readFileSync(join(process.cwd(), "app", name), "utf8");
}

/*
 * 캔버스 안에 사는 스타일시트.
 *
 * `screen-fit.css` 하나만 뺀다. 그 화면은 캔버스 **바깥**에 서기 때문이다 —
 * 휴대폰을 세로로 들면 16:9 판이 화면 한가운데 작은 띠로 줄어드는데, 돌려
 * 달라는 안내까지 그 안에 두면 같이 작아져 읽을 수 없다. 그래서 그 파일만
 * 판이 아니라 창을 기준으로 재고, 동작 줄이기 설정도 읽는다.
 *
 * 예외는 이 한 줄로 끝난다. 다른 파일이 창을 따라가려 하면 아래 검사가 잡는다.
 */
const OUTSIDE_CANVAS = new Set(["screen-fit.css"]);

function styleSheets(): string[] {
  return readdirSync(join(process.cwd(), "app")).filter((name) =>
    name.endsWith(".css") && !OUTSIDE_CANVAS.has(name),
  );
}

function disallowedMediaConditions(source: string): string[] {
  const cssWithoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");

  return [...cssWithoutComments.matchAll(/@media\s*([^{]+)\{/gi)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((condition) => !/^\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)$/i.test(condition));
}

function uiSources(): Array<{ name: string; source: string }> {
  return ["app", join("components", "game")].flatMap((root) => {
    const absoluteRoot = join(process.cwd(), root);

    return readdirSync(absoluteRoot, { recursive: true, encoding: "utf8" })
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => {
        const relativeName = join(root, name);

        return {
          name: relativeName,
          source: readFileSync(join(process.cwd(), relativeName), "utf8"),
        };
      });
  });
}

describe("16:9 고정 캔버스", () => {
  it("루트 글꼴 크기가 창에 맞춘 축척을 만든다", () => {
    const sheet = css("globals.css");

    /*
     * 두 줄이다. 앞은 `dvh` 를 모르는 브라우저가 읽는 대비이고, 뒤는 지금 보이는
     * 높이와 가려지지 않는 폭으로 재는 본 줄이다. 앞 줄이 빠지면 뒤 줄을 모르는
     * 브라우저에서 글자 크기가 기본값으로 돌아가 판이 화면 밖으로 부푼다.
     */
    expect(sheet).toContain("min(100vw / 120, 100vh / 67.5)");
    expect(sheet).toContain("100dvw - env(safe-area-inset-left");
    expect(sheet).toContain("100dvh - env(safe-area-inset-top");
  });

  it("캔버스는 1920x1080 비율의 크기 컨테이너다", () => {
    const sheet = css("globals.css");

    expect(sheet).toContain(".game-canvas");
    expect(sheet).toContain("width: 120rem");
    expect(sheet).toContain("height: 67.5rem");
    expect(sheet).toContain("container-type: size");
    expect(sheet).toContain("container-name: game");
  });

  it("남는 공간은 가운데 정렬된 레터박스로 남는다", () => {
    const sheet = css("globals.css");

    expect(sheet).toContain("place-content: center");
    expect(sheet).toContain("overflow: hidden");
  });

  it("레이아웃이 모든 화면을 캔버스로 감싼다", () => {
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");

    expect(layout).toContain('className="game-canvas"');
  });

  it("일반 화면 루트는 캔버스 전체를 점유한다", () => {
    const sheet = css("globals.css");

    expect(sheet).toContain(
      '.game-canvas > :not([data-canvas-layout="intrinsic"])',
    );
    expect(sheet).toMatch(
      /\.game-canvas > :not\(\[data-canvas-layout="intrinsic"\]\)\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*min-width:\s*0;[^}]*min-height:\s*0;/,
    );
  });

  /*
   * 예외는 목록으로만 늘어난다.
   *
   * `.game-canvas` 의 자식은 기본으로 판을 꽉 채운다. 화면 루트는 그래야 하지만,
   * 판 위에 얹는 쪽지는 아니다 — 거부 알림이 그 규칙에 걸려 1152 x 1080 으로
   * 판을 통째로 덮고 있었다.
   *
   * 예외를 열어 두되 조용히 늘지 않게 한다. 새로 쓰려면 이 목록에 이름을 적고
   * 왜 화면 루트가 아닌지를 여기 남겨야 한다.
   */
  const INTRINSIC_ALLOWED = new Map([
    [
      join("components", "game", "CampaignScreen.tsx"),
      "거부 알림. 판을 쓰는 화면이 아니라 화면 위에 잠깐 얹었다 사라지는 쪽지다.",
    ],
  ]);

  it("intrinsic 예외는 승인된 것뿐이다", () => {
    const users = uiSources()
      .filter(({ source }) => source.includes('data-canvas-layout="intrinsic"'))
      .map(({ name }) => name);

    expect(users.sort()).toEqual([...INTRINSIC_ALLOWED.keys()].sort());
  });

  it("예외마다 왜 화면 루트가 아닌지 적혀 있다", () => {
    for (const [name, reason] of INTRINSIC_ALLOWED) {
      expect(reason.length, name).toBeGreaterThan(20);
    }
  });

  it("예외를 쓰는 곳은 판 안에 머문다", () => {
    /* 절대 배치라 기준이 필요하다. 판이 기준이 아니면 레터박스 밖으로 나간다. */
    expect(css("globals.css")).toMatch(/\.game-canvas \{[^}]*position:\s*relative/);
  });

  it("캔버스 내부 화면은 브라우저 높이를 요구하지 않는다", () => {
    const offenders = uiSources()
      .filter(({ name }) => name !== join("app", "layout.tsx"))
      .filter(({ source }) => source.includes("min-h-screen"))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it("캔버스 내부 화면은 브라우저 폭 breakpoint를 요구하지 않는다", () => {
    const offenders = uiSources()
      .filter(({ source }) => /\b(?:sm|md|lg|xl|2xl):/.test(source))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it("동작 줄이기만 허용하고 뷰포트·breakpoint 미디어 쿼리는 거부한다", () => {
    const fixture = `
      @media (prefers-reduced-motion: reduce) { .motion { transition: none; } }
      @media (max-width: 80rem) { .canvas { width: 100%; } }
      @media screen and (orientation: portrait) { .canvas { height: auto; } }
    `;

    expect(disallowedMediaConditions(fixture)).toEqual([
      "(max-width: 80rem)",
      "screen and (orientation: portrait)",
    ]);
  });

  it("고정 비율 화면에는 접근성 외 미디어 쿼리가 없다", () => {
    const offenders = styleSheets().flatMap((name) =>
      disallowedMediaConditions(css(name)).map((condition) => `${name}: ${condition}`),
    );

    expect(offenders).toEqual([]);
  });

  it("크기 계산은 창이 아니라 캔버스를 기준으로 한다", () => {
    /* 축척을 정하는 줄만 창을 본다. 그 줄을 걷어낸 나머지에 창 단위가 없어야 한다. */
    const fallbackScale = "min(100vw / 120, 100vh / 67.5)";
    const offenders = styleSheets().filter((name) =>
      /\d(vw|vh)\b/.test(css(name).replaceAll(fallbackScale, "")),
    );

    expect(offenders).toEqual([]);
  });

  it("게시판 나뭇결은 판과 함께 커진다", () => {
    const sheet = css("u3-board.css");

    expect(sheet).toContain("#321d10 0.5rem 0.8125rem");
    expect(sheet).not.toContain("#321d10 8px 13px");
  });

  it("번짐이 큰 그림자는 축척을 따른다", () => {
    const offenders = styleSheets().flatMap((name) =>
      (css(name).match(/box-shadow:[^;]+;/g) ?? [])
        .flatMap((rule) => rule.match(/\d+px/g) ?? [])
        .filter((value) => Number.parseInt(value, 10) >= 12)
        .map((value) => `${name}: ${value}`),
    );

    expect(offenders).toEqual([]);
  });
});

/*
 * 캔버스 바깥에 서는 화면은 하나뿐이다.
 *
 * 예외를 두었으니 그 예외가 자라지 않는지 지킨다. 그리고 그 파일이 정말로
 * 캔버스 바깥에서만 쓰이는지 — 캔버스 안 요소를 건드리지 않는지 — 도 본다.
 */
describe("캔버스 바깥 화면", () => {
  it("예외는 세로 안내 하나뿐이다", () => {
    expect([...OUTSIDE_CANVAS]).toEqual(["screen-fit.css"]);
  });

  it("세로 안내는 캔버스 안의 것을 건드리지 않는다", () => {
    const sheet = css("screen-fit.css");

    expect(sheet).not.toContain(".game-canvas");
    expect(sheet).not.toContain(".game-shell");
    /* 판을 기준으로 재면 세로에서 같이 작아진다. 창을 기준으로 재야 한다. */
    expect(sheet).not.toMatch(/\d(cqw|cqh)\b/);
  });
});
