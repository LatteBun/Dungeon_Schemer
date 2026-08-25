import { describe, expect, it } from "vitest";
import { CANVAS_COLUMNS, CANVAS_ROWS, canvasFontSizePx, visibleSizeOf } from "./canvas-scale";

/**
 * 판의 축척은 눈에 보이는 크기에서 나온다.
 *
 * CSS 의 `dvh` 와 `env(safe-area-inset-*)` 로 재던 것을 옮겨 왔다. 그 값들은
 * 브라우저마다 언제 무엇을 가리키는지가 미묘하게 달라서, 휴대폰 사파리에서
 * 판 아래가 계속 잘렸다. 값의 뜻을 맞히는 대신 브라우저에게 직접 묻는다.
 */
describe("판의 축척", () => {
  it("가로와 세로 중 작은 쪽을 따른다", () => {
    /* 큰 쪽을 따르면 반대쪽이 화면 밖으로 넘쳐 잘린다. */
    expect(canvasFontSizePx({ width: 1920, height: 1080 })).toBeCloseTo(16, 5);
    expect(canvasFontSizePx({ width: 1920, height: 540 })).toBeCloseTo(8, 5);
    expect(canvasFontSizePx({ width: 960, height: 1080 })).toBeCloseTo(8, 5);
  });

  it("어떤 크기에서도 판이 화면 안에 들어간다", () => {
    const sizes = [
      { width: 852, height: 393 },
      { width: 393, height: 852 },
      { width: 1180, height: 820 },
      { width: 2560, height: 1080 },
      { width: 852, height: 320 },
    ];

    for (const size of sizes) {
      const rem = canvasFontSizePx(size);
      const label = `${size.width}x${size.height}`;

      expect(rem * CANVAS_COLUMNS, `${label} 폭`).toBeLessThanOrEqual(size.width + 0.001);
      expect(rem * CANVAS_ROWS, `${label} 높이`).toBeLessThanOrEqual(size.height + 0.001);
    }
  });

  it("한쪽은 정확히 화면에 닿는다", () => {
    // 남는 쪽이 검은 여백이 된다. 둘 다 남으면 판을 덜 쓴 것이다.
    for (const size of [{ width: 852, height: 393 }, { width: 1180, height: 820 }]) {
      const rem = canvasFontSizePx(size);
      const touchesWidth = Math.abs(rem * CANVAS_COLUMNS - size.width) < 0.001;
      const touchesHeight = Math.abs(rem * CANVAS_ROWS - size.height) < 0.001;

      expect(touchesWidth || touchesHeight, `${size.width}x${size.height}`).toBe(true);
    }
  });

  it("16:9 를 지킨다", () => {
    const rem = canvasFontSizePx({ width: 852, height: 393 });
    expect((rem * CANVAS_COLUMNS) / (rem * CANVAS_ROWS)).toBeCloseTo(16 / 9, 5);
  });
});

describe("보이는 크기 묻기", () => {
  it("visualViewport 가 있으면 그것을 쓴다", () => {
    /* 주소창과 도구 막대를 뺀 값이다. innerHeight 는 그것을 빼 주지 않는다. */
    const size = visibleSizeOf({
      innerWidth: 852,
      innerHeight: 393,
      visualViewport: { width: 852, height: 340 },
    });

    expect(size).toEqual({ width: 852, height: 340 });
  });

  it("없으면 창 크기로 물러선다", () => {
    expect(visibleSizeOf({ innerWidth: 852, innerHeight: 393 }))
      .toEqual({ width: 852, height: 393 });
    expect(visibleSizeOf({ innerWidth: 852, innerHeight: 393, visualViewport: null }))
      .toEqual({ width: 852, height: 393 });
  });

  it("0 을 주는 브라우저에도 물러선다", () => {
    // 회전 도중 잠깐 0 을 주는 기기가 있다. 그때 판이 사라지면 안 된다.
    expect(visibleSizeOf({ innerWidth: 852, innerHeight: 393, visualViewport: { width: 0, height: 0 } }))
      .toEqual({ width: 852, height: 393 });
  });
});
