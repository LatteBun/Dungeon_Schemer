/**
 * 판의 축척을 실제로 보이는 크기에서 잰다.
 *
 * CSS 만으로 재던 것을 옮겨 온다. `dvh` 도 `env(safe-area-inset-*)` 도 브라우저
 * 마다 언제 무엇을 가리키는지가 미묘하게 달라서, 휴대폰 사파리에서는 판 아래가
 * 계속 잘렸다. 값의 뜻을 맞히는 대신 브라우저에게 직접 묻는다.
 *
 * `visualViewport` 는 주소창과 도구 막대를 뺀 **지금 눈에 보이는** 영역이다.
 * 그것으로 재면 어느 브라우저가 어떤 단위를 어떻게 해석하든 상관이 없다.
 *
 * CSS 쪽 계산은 그대로 둔다. 스크립트가 돌기 전과 돌지 않는 경우의 자리다.
 */

export const CANVAS_COLUMNS = 120;
export const CANVAS_ROWS = 67.5;

export interface VisibleSize {
  readonly width: number;
  readonly height: number;
}

/**
 * 판 한 칸(rem)의 크기.
 *
 * 가로와 세로 중 **작은 쪽**을 따른다. 큰 쪽을 따르면 반대쪽이 화면 밖으로
 * 넘쳐 잘린다. 16:9 를 지키는 것이 이 한 줄이다.
 */
export function canvasFontSizePx(visible: VisibleSize): number {
  const byWidth = visible.width / CANVAS_COLUMNS;
  const byHeight = visible.height / CANVAS_ROWS;
  return Math.min(byWidth, byHeight);
}

interface ViewportLike {
  readonly width: number;
  readonly height: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

interface WindowLike {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly visualViewport?: ViewportLike | null;
}

/**
 * 지금 보이는 크기.
 *
 * `visualViewport` 가 없는 브라우저는 `innerWidth/Height` 로 물러선다. 그 값도
 * 없을 수는 없으므로 판이 아주 사라지는 일은 없다.
 */
export function visibleSizeOf(view: WindowLike): VisibleSize {
  const viewport = view.visualViewport;
  if (viewport !== undefined && viewport !== null && viewport.width > 0 && viewport.height > 0) {
    return { width: viewport.width, height: viewport.height };
  }
  return { width: view.innerWidth, height: view.innerHeight };
}
