import { TopStatusBar } from "./TopStatusBar";
import type { TopStatusView } from "./TopStatusBar";

export interface IntroScreenProps {
  status: TopStatusView;
  boardHref: string;
  /*
   * 통합 화면에서는 진입이 링크가 아니라 액션이다.
   *
   * 프리뷰는 `/uN-test` 사이를 오가므로 링크가 맞다. 캠페인 한 페이지 안에서는
   * 옮겨 갈 주소가 없고 `phase` 가 화면을 정한다. 주면 버튼, 없으면 링크다.
   */
  onEnterBoard?: () => void;
}

function CtaBody() {
  return <strong>길드 게시판으로</strong>;
}

function IntroMainContent({ boardHref, onEnterBoard }: { boardHref: string; onEnterBoard?: () => void }) {
  return (
    <main className="u2-intro-stage" aria-labelledby="u2-intro-title">
      <div className="u2-intro__guide" data-testid="u2-intro">
        <img
          className="u2-intro__guide-image"
          src="/assets/u2/game-guide-bg.png"
          alt=""
          aria-hidden="true"
          width={1672}
          height={941}
        />
        <div className="sr-only">
          <h1 id="u2-intro-title">당신은 용사들을 던전으로 안내하는 고블린 길잡이입니다.</h1>
          <p>도움과 배신의 전략, 명성과 골드의 두 승급 경로, 15개 던전 완주 목표와 조기 종료 위험을 안내합니다.</p>
        </div>

        {onEnterBoard === undefined ? (
          <a className="u2-intro__cta" href={boardHref}>
            <CtaBody />
          </a>
        ) : (
          <button className="u2-intro__cta" type="button" onClick={onEnterBoard}>
            <CtaBody />
          </button>
        )}
      </div>
    </main>
  );
}

export function IntroScreen({ status, boardHref, onEnterBoard }: IntroScreenProps) {
  return (
    <div className="u2-intro-shell">
      <TopStatusBar status={status} />
      <IntroMainContent boardHref={boardHref} onEnterBoard={onEnterBoard} />
    </div>
  );
}
