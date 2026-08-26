import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppQuickMenuProvider, useAppQuickMenu } from "./AppQuickMenuContext";

function QuickMenuOpener() {
  const { openQuickMenu } = useAppQuickMenu();
  return createElement("button", {
    type: "button",
    onClick: () => openQuickMenu(document.body),
  }, "열기");
}

function CallbackCheck({ expected }: { readonly expected: (trigger: HTMLElement) => void }) {
  const { openQuickMenu } = useAppQuickMenu();
  return createElement("span", null, openQuickMenu === expected ? "same callback" : "different callback");
}

describe("AppQuickMenuContext", () => {
  it("provider 없이 hook을 쓰면 명시적 오류를 낸다", () => {
    expect(() => renderToStaticMarkup(createElement(QuickMenuOpener))).toThrow(
      "useAppQuickMenu must be used inside AppQuickMenuProvider",
    );
  });

  it("provider의 openQuickMenu callback을 소비자에게 전달한다", () => {
    const openQuickMenu = vi.fn();
    const html = renderToStaticMarkup(createElement(
      AppQuickMenuProvider,
      {
        value: { openQuickMenu },
        children: createElement(CallbackCheck, { expected: openQuickMenu }),
      },
    ));

    expect(html).toContain("same callback");
    expect(openQuickMenu).not.toHaveBeenCalled();
  });
});
