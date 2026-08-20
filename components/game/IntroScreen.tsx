import { TopStatusBar } from "./TopStatusBar";
import type { TopStatusView } from "./TopStatusBar";

export interface IntroScreenProps {
  status: TopStatusView;
  onEnterBoard: () => void;
}

const introCards = [
  {
    id: "guide",
    icon: "/assets/u2/intro-guide.svg",
    title: "내 역할",
    body: "나는 던전 편의 길잡이. 앞서 본 길과 숨은 사정을 읽는 것이 내 역할이다.",
  },
  {
    id: "advice",
    icon: "/assets/u2/intro-advice.svg",
    title: "내 수단",
    body: "나는 싸우지 않는다. 길을 고르고, 징후를 해석해 용사들에게 조언을 건넨다.",
  },
  {
    id: "goal",
    icon: "/assets/u2/intro-goal.svg",
    title: "나의 목표",
    body: "열다섯 던전을 정리하고 평판을 쌓아, 끝내 S급 길잡이를 노린다.",
  },
] as const;

function IntroMainContent({ onEnterBoard }: { onEnterBoard: () => void }) {
  return (
    <main className="u2-intro-stage" aria-labelledby="u2-intro-title">
      <div className="u2-intro" data-testid="u2-intro">
        <div className="u2-intro__copy">
          <p className="u2-intro__eyebrow">길잡이의 첫 기록</p>
          <h1 id="u2-intro-title">던전은 검보다 먼저 말을 건넨다</h1>
          <p className="u2-intro__lead">
            용사들은 앞으로 나아갑니다. 당신은 그보다 먼저 길을 읽고,
            흔적을 기록하며, 무엇을 믿게 할지 결정합니다.
            <br />이 기록이 던전과 용사 사이의 첫 번째 약속이 됩니다.
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

        <button className="u2-intro__cta" type="button" onClick={onEnterBoard}>
          <img src="/assets/u2/intro-contract.svg" alt="" aria-hidden="true" width={40} height={40} />
          <strong>길드 게시판으로</strong>
          <span className="u2-intro__cta-arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </main>
  );
}

export function IntroScreen({ status, onEnterBoard }: IntroScreenProps) {
  return (
    <div className="u2-intro-shell">
      <TopStatusBar status={status} />
      <IntroMainContent onEnterBoard={onEnterBoard} />
    </div>
  );
}
