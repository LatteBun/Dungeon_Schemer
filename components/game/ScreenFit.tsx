"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { canvasFontSizePx, visibleSizeOf } from "./canvas-scale";

/**
 * 휴대폰에서 판을 화면에 맞추는 두 가지.
 *
 * 브라우저는 주소창을 마음대로 감추게 해 주지 않는다. 열려 있는 길은 둘뿐이다 —
 * 전체 화면으로 들어가거나, 홈 화면에 얹어 앱처럼 여는 것이다. 앞의 것은 사람이
 * 눌러야만 되고(안드로이드), 뒤의 것은 manifest 가 맡는다.
 *
 * 회전도 마찬가지다. 안드로이드는 전체 화면에서 가로로 잠글 수 있지만 iOS 는
 * 그 API 자체가 없다. 그래서 잠그지 못하는 기기에는 말로 부탁한다.
 */

interface FullscreenElement {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void>;
}

interface LockableOrientation {
  lock?: (orientation: "landscape") => Promise<void>;
}

/** 이 기기가 전체 화면을 받아 주는가. iOS 사파리(아이폰)는 받지 않는다. */
export function canGoFullscreen(target: unknown): boolean {
  const element = target as FullscreenElement | null;
  if (element === null || element === undefined) return false;
  return typeof element.requestFullscreen === "function"
    || typeof element.webkitRequestFullscreen === "function";
}

/**
 * 전체 화면으로 들어가고, 되는 기기면 가로로 잠근다.
 *
 * 잠금은 전체 화면 안에서만 허락되므로 순서를 지킨다. 잠그지 못해도 전체 화면은
 * 남기므로 실패를 삼킨다 — 주소창이 사라진 것만으로도 얻은 것이 있다.
 */
export async function enterLandscapeFullscreen(
  element: unknown,
  orientation: unknown,
): Promise<void> {
  const target = element as FullscreenElement;
  const request = target.requestFullscreen ?? target.webkitRequestFullscreen;
  if (typeof request !== "function") return;

  try {
    await request.call(target);
  } catch {
    return;
  }

  const lockable = orientation as LockableOrientation | null;
  if (lockable === null || lockable === undefined || typeof lockable.lock !== "function") return;
  try {
    await lockable.lock("landscape");
  } catch {
    /* 잠그지 못하는 기기가 있다. 전체 화면만으로도 판은 커진다. */
  }
}

/**
 * 돌려 달라고 말할 자리인가.
 *
 * 두 가지가 함께 맞아야 한다 — 지금 세로이고, 돌릴 수 있는 기기여야 한다.
 * 세로인 것만 보면 PC 에서 창을 위아래로 길게 늘린 사람에게도 안내가 떠서,
 * 돌릴 물건이 없는 사람에게 돌리라고 하게 된다.
 */
export function shouldAskToTurn(input: {
  readonly portrait: boolean;
  readonly coarsePointer: boolean;
}): boolean {
  return input.portrait && input.coarsePointer;
}


/**
 * 손가락으로 쓰는 기기인가.
 *
 * 기기 이름(userAgent)으로 가르지 않는다. 아이패드는 스스로를 맥이라고 말하고,
 * 새 기기가 나올 때마다 목록이 낡는다. 필요한 것은 이름이 아니라 「손가락으로
 * 쓰는 기기인가」 하나뿐이므로 그것만 묻는다.
 */
function hasCoarsePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function fullscreenEntryAvailable(target: unknown, fullscreenElement: unknown): boolean {
  return canGoFullscreen(target) && fullscreenElement === null;
}

export function subscribeToFullscreenChanges(
  target: EventTarget,
  onStoreChange: () => void,
): () => void {
  target.addEventListener("fullscreenchange", onStoreChange);
  return () => target.removeEventListener("fullscreenchange", onStoreChange);
}

function subscribeFullscreenAvailability(onStoreChange: () => void): () => void {
  return subscribeToFullscreenChanges(document, onStoreChange);
}

function fullscreenAvailabilitySnapshot(): boolean {
  return fullscreenEntryAvailable(document.documentElement, document.fullscreenElement);
}

function fullscreenAvailabilityServerSnapshot(): false {
  return false;
}

/**
 * 세로로 든 동안 판을 가리고 돌려 달라고 말한다.
 *
 * 판이 16:9 로 고정이라 세로에서는 글자가 읽을 수 없을 만큼 작아진다. 그대로
 * 두는 것보다 한 줄로 부탁하는 편이 낫다.
 */
export function ScreenFit() {
  const [needsTurn, setNeedsTurn] = useState(false);
  const fullscreenAvailable = useSyncExternalStore(
    subscribeFullscreenAvailability,
    fullscreenAvailabilitySnapshot,
    fullscreenAvailabilityServerSnapshot,
  );

  useEffect(() => {
    /*
     * 판의 축척을 여기서 정한다.
     *
     * CSS 의 `dvh` 와 `env()` 는 브라우저마다 언제 무엇을 가리키는지가 달라서
     * 휴대폰 사파리에서 판 아래가 계속 잘렸다. 값의 뜻을 맞히는 대신 지금 눈에
     * 보이는 크기를 브라우저에게 직접 묻는다. CSS 쪽 계산은 이 스크립트가 돌기
     * 전과 돌지 않는 경우의 자리로 남겨 둔다.
     */
    const sync = () => {
      const size = visibleSizeOf(window);
      document.documentElement.style.fontSize = `${canvasFontSizePx(size)}px`;
      setNeedsTurn(shouldAskToTurn({
        portrait: size.height > size.width,
        coarsePointer: hasCoarsePointer(),
      }));
    };
    sync();

    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    /* 주소창이 나타나고 사라지는 동안은 이 두 가지만 알려 온다. */
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, []);

  if (!needsTurn) return null;

  return (
    <div className="screen-fit" role="alert">
      <div className="screen-fit__card">
        <span className="screen-fit__mark" aria-hidden="true" />
        <p className="screen-fit__title">가로로 돌려 주세요</p>
        <p className="screen-fit__body">이 게임은 가로 화면에 맞춰 만들어졌습니다.</p>
        {fullscreenAvailable ? (
          <button
            type="button"
            className="shell-cta screen-fit__cta"
            onClick={() => {
              void enterLandscapeFullscreen(
                document.documentElement,
                (screen as unknown as { orientation?: unknown }).orientation ?? null,
              );
            }}
          >
            전체 화면으로 열기
          </button>
        ) : (
          /*
           * 전체 화면을 받아 주지 않는 기기 — 아이폰 사파리다.
           *
           * 그 자리를 비워 두는 대신 홈 화면에 얹는 법을 적는다. 그러면 주소창이
           * 사라져 판이 커지고, 화면 맨 아래가 시스템 제스처 영역에서 벗어나
           * 아래쪽 단추가 잘 눌린다. 여기서 겪는 불편이 한 번에 없어진다.
           */
          <div className="screen-fit__guide">
            <p className="screen-fit__guide-title">주소창 없이 크게 보려면</p>
            <ol className="screen-fit__steps">
              <li>아래 공유 단추를 누르고</li>
              <li>「홈 화면에 추가」를 고른 다음</li>
              <li>바탕화면에 생긴 아이콘으로 여세요</li>
            </ol>
            <p className="screen-fit__guide-note">화면 아래쪽 단추도 그때 잘 눌립니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
