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
          <h1 id="u2-intro-title">당신은 용사들을 던전으로 안내하는 고블린 길잡이입니다.</h1>
          <p className="u2-intro__lead">직접 싸우지 않습니다. 길을 읽고, 어떤 조언을 건넬지 결정하십시오.</p>
        </div>

        <section className="u2-intro__strategy" aria-labelledby="u2-strategy-title">
          <p id="u2-strategy-title">당신의 선택</p>
          <article className="u2-intro__strategy-card u2-intro__strategy-card--help">
            <p>전략 01</p>
            <h2>용사를 돕는다</h2>
            <p>안전 · 꾸준한 보상</p>
            <p>올바른 길과 조언으로 용사들이 살아 돌아오도록 돕습니다.</p>
            <ul>
              <li>명성 ↑</li>
              <li>계약금 ↑</li>
              <li>신뢰 유지</li>
            </ul>
            <p>용사들이 살아야 다음 원정도 이어집니다.</p>
          </article>
          <article className="u2-intro__strategy-card u2-intro__strategy-card--betray">
            <p>전략 02</p>
            <h2>용사를 배신한다</h2>
            <p>위험 · 막대한 보상</p>
            <p>거짓된 조언으로 용사들을 위험에 빠뜨리고 전멸을 노릴 수도 있습니다.</p>
            <ul>
              <li>대량 골드 ↑↑</li>
              <li>명성 ↓</li>
              <li>신뢰 ↓</li>
              <li>남은 인력 ↓</li>
            </ul>
            <p>경고: 한 번 잃은 신뢰와 인력은 쉽게 돌아오지 않습니다.</p>
          </article>
          <p>안전하게 명성을 쌓을 것인가, 위험을 감수하고 큰돈을 노릴 것인가.</p>
        </section>

        <section className="u2-intro__facts" aria-label="원정 안내">
          <article>
            <h2>S급으로 가는 두 길</h2>
            <p>명성으로 인정받아 정식 승급</p>
            <p>골드로 뒷거래 승급</p>
            <p>C → B → A → S</p>
            <p>높은 등급일수록 더 위험한 던전에 입장할 수 있습니다.</p>
          </article>
          <article>
            <h2>원정의 목표</h2>
            <p>15개의 던전을 돌파하십시오.</p>
            <p>최고의 목표는 S급 길잡이</p>
          </article>
          <article>
            <h2>길잡이에게도 끝은 찾아옵니다</h2>
            <p>신뢰, 인력, 승급을 관리하지 못하면 원정은 일찍 끝날 수 있습니다.</p>
          </article>
        </section>

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
