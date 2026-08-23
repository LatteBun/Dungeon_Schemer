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

const introCards = [
  {
    id: "guide",
    icon: "/assets/u2/intro-role-observer.svg",
    title: "역할",
    body: "던전 편에 선 길잡이로서, 앞서 본 길과 숨은 사정을 읽는다.",
  },
  {
    id: "advice",
    icon: "/assets/u2/intro-means-map-quill.svg",
    title: "수단",
    body: "직접 싸우지 않고, 길과 징후를 해석해 용사들에게 조언을 건넨다.",
  },
  {
    id: "goal",
    icon: "/assets/u2/intro-goal-rank-crest.svg",
    title: "목표",
    body: "열다섯 던전을 정리하고 명성을 쌓아, 끝내 S급 길잡이에 오른다.",
  },
] as const;

function CtaBody() {
  return (
    <>
      <img className="u2-intro__cta-emblem" src="/assets/u3/extracted/contract-emblem.png" alt="" aria-hidden="true" width={48} height={43} />
      <strong>길드 게시판으로</strong>
      <img className="u2-intro__cta-arrow" src="/assets/u3/extracted/arrow-right.png" alt="" aria-hidden="true" width={70} height={27} />
    </>
  );
}

function IntroMainContent({ boardHref, onEnterBoard }: { boardHref: string; onEnterBoard?: () => void }) {
  return (
    <main className="u2-intro-stage" aria-labelledby="u2-intro-title">
      <div className="u2-intro" data-testid="u2-intro">
        <div className="u2-intro__copy">
          <p className="u2-intro__eyebrow">길잡이의 첫 기록</p>
          <h1 id="u2-intro-title">던전은 검보다 먼저 말을 건넨다</h1>
          <p className="u2-intro__lead">
            <span>용사들은 앞으로 나아갑니다. 당신은 그보다 먼저 길을 읽고, 흔적을 기록합니다.</span>
            <span>무엇을 믿게 할지 결정하는 이 기록이, 던전과 용사 사이의 첫 약속이 됩니다.</span>
          </p>
        </div>

        <div className="u2-intro__cards" aria-label="길잡이 안내">
          {introCards.map((card) => (
            <article key={card.id} className="u2-intro__card">
              <div className="u2-intro__card-icon" aria-hidden="true">
                <img src={card.icon} alt="" width={72} height={72} />
              </div>
              <h2>{card.title}</h2>
              <span className="u2-intro__card-rule" aria-hidden="true" />
              <p>{card.body}</p>
            </article>
          ))}
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
