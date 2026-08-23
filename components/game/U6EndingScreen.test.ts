import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U6EndingScreen } from "./U6EndingScreen";
import { ENDING_CONSEQUENCE_TITLE, ENDING_REPORT_TITLE } from "./u6-ending-model";
import { U6_PREVIEW_ENTRIES } from "./u6-preview-data";
import type { EndingKind } from "@/lib/domain";

function view(kind: EndingKind) {
  const found = U6_PREVIEW_ENTRIES.find((entry) => entry.ending?.kind === kind)?.ending;
  if (!found) throw new Error(`프리뷰에 ${kind} 엔딩이 없다`);
  return found;
}

const render = (kind: EndingKind) =>
  renderToStaticMarkup(createElement(U6EndingScreen, { ending: view(kind) }));

describe("U6EndingScreen", () => {
  it("표제와 부제를 함께 보여준다", () => {
    const html = render("distrust");

    expect(html).toContain("캠페인 종료");
    expect(html).toContain("불신의 대가");
    expect(html).toContain(view("distrust").subtitle);
  });

  it("결말의 이유를 세 줄로 보여준다", () => {
    const html = render("completed");

    expect(html).toContain('data-testid="u6-ending-verdict"');
    for (const reason of view("completed").reasons) {
      expect(html).toContain(reason);
    }
  });

  /*
   * 결말의 성격을 이름으로 먼저 말한다. 원정 종료는 「원정 보고서 · 주요 업적」,
   * 불신의 대가는 「최후 보고서 · 무너진 관계」다.
   */
  it("엔딩마다 오른쪽 문서와 세 번째 패널의 이름이 바뀐다", () => {
    for (const kind of ["completed", "distrust", "denounced", "exhausted", "unemployed"] as const) {
      const html = render(kind);

      expect(html).toContain(ENDING_REPORT_TITLE[kind]);
      expect(html).toContain(ENDING_CONSEQUENCE_TITLE[kind]);
    }
  });

  it("보고서 확인 항목과 결말 항목을 모두 보여준다", () => {
    const html = render("denounced");
    const ending = view("denounced");

    for (const item of ending.report) expect(html).toContain(item);
    for (const note of ending.consequences) expect(html).toContain(note.label);
    expect(html).toContain('data-testid="u6-consequences"');
  });

  it("정상 완주와 조기 종료를 색이 아니라 문구로 구분한다", () => {
    expect(render("completed")).toContain("정상 완주");
    expect(render("unemployed")).toContain("조기 종료");
  });

  /*
   * 완주는 등급 문양을, 조기 종료는 결말 문양을 쓴다는 것이 이 검사의 뜻이다.
   * 전에는 `rank_s.png` 를 콕 집었는데, 그때 프리뷰의 등급이 손으로 적힌 S 라서
   * 가능한 일이었다. 지금은 실제 캠페인이 도달한 등급이 온다.
   */
  it("완주는 최종 등급 문양을, 조기 종료는 결말 문양을 쓴다", () => {
    expect(render("completed")).toMatch(/rank_[cbas]\.png/);
    expect(render("distrust")).toContain("achievement_together.png");
  });

  it("최종 결과와 캠페인 수치를 함께 보여준다", () => {
    const html = render("completed");

    expect(html).toContain('data-testid="u6-stats"');
    expect(html).toContain("누적 조언");
    /* 전멸 횟수는 총 원정 수와 함께 나온다. 분모 없이 놓으면 뜻이 서지 않는다. */
    expect(html).toContain("전멸");
    expect(html).toContain("클리어");
    expect(html).toContain("도달 깊이");
  });

  it("연대기는 15줄 나열이 아니라 산문 요약이다", () => {
    const html = render("completed");

    expect(html).toContain('data-testid="u6-chronicle"');
    expect(html).toContain("원정 연대기 요약");
    expect(html).toContain(view("completed").chronicleSummary);
  });

  /*
   * 시안의 다섯 엔딩은 모두 전환점이 있다. 그래도 아주 짧게 끝난 캠페인은
   * 전환점이 없을 수 있으므로 화면이 그 경우를 견뎌야 한다. fixture 가 아니라
   * 여기서 직접 만들어 확인한다.
   */
  it("전환점이 없으면 그 자리를 비우지 않고 없다고 적는다", () => {
    const html = renderToStaticMarkup(
      createElement(U6EndingScreen, {
        ending: { ...view("unemployed"), turningPoint: null },
      }),
    );

    expect(html).toContain('data-testid="u6-turning-point"');
    expect(html).toContain("전환점이라 부를 만한");
  });

  it("게시판으로 돌아가는 CTA 를 둔다", () => {
    expect(render("completed")).toContain("길드 게시판으로 돌아가기");
  });

  it("상단 상태 바를 두지 않는다", () => {
    expect(render("completed")).not.toContain("game-shell__status");
  });
});
