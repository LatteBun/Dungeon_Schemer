import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PartyMemberCard, type PartyMemberCardView } from "./PartyMemberCard";

/**
 * 파티원 카드 계약.
 *
 * U3·U4·U5 가 각자 카드를 그리면서 같은 파티원이 화면마다 다르게 보였다.
 * 정의를 한 곳으로 모았으니 그 모양을 여기서 고정한다.
 */

const member: PartyMemberCardView = {
  id: "a",
  name: "아델",
  classLabel: "전사",
  personalityLabel: "신중한",
  hp: 40,
  maxHp: 45,
  trust: 72,
  gold: 31,
};

const partyCardCss = readFileSync(join(process.cwd(), "app", "party-card.css"), "utf8");

const render = (over: Partial<PartyMemberCardView> = {}, props = {}) =>
  renderToStaticMarkup(
    createElement(PartyMemberCard, { member: { ...member, ...over }, ...props }),
  );

describe("PartyMemberCard", () => {
  it("확인한 HP와 신뢰 변화량을 카드 앞면에 함께 남긴다", () => {
    const html = render({}, { settledResult: { hpDelta: -3, trustDelta: -2 } });

    expect(html).toContain("party-card__settled-results");
    expect(html).toContain("HP −3");
    expect(html).toContain("신뢰 −2");
  });

  it("확인한 양수 변화량에는 더하기 부호를 붙인다", () => {
    const html = render({}, { settledResult: { hpDelta: 4, trustDelta: 2 } });

    expect(html).toContain("HP +4");
    expect(html).toContain("신뢰 +2");
  });

  it("0인 완료 변화량은 카드 앞면에 남기지 않는다", () => {
    const html = render({}, { settledResult: { hpDelta: 0, trustDelta: 0 } });

    expect(html).not.toContain("party-card__settled-results");
  });

  it("동작 줄이기 상태는 미디어 쿼리 없이 완료 변화량의 진입 모션만 제거한다", () => {
    expect(partyCardCss).toMatch(
      /\.party-card__settled-results\[data-reduced-motion="true"\]\s*\{[^}]*animation:\s*none/,
    );
  });

  it("전투 수치 증감을 카드 안의 접근 가능한 output으로 표시한다", () => {
    const html = render({}, { effect: { kind: "hp", delta: -3, token: "private-token" } });
    expect(html).toContain("HP −3");
    expect(html).toContain("party-card__effect--hp");
    expect(html).not.toContain("private-token");
  });
  it("이름·직업·성격을 함께 보여준다", () => {
    const html = render();

    expect(html).toContain("아델");
    expect(html).toContain("전사");
    expect(html).toContain("신중한");
  });

  /* 나란히 두면 막대가 절반 폭이라 눈금이 읽히지 않는다. */
  it("HP 와 신뢰를 각각 한 줄로 쌓는다", () => {
    const html = render();

    expect(html).toContain("<dt>HP</dt><dd>40 / 45</dd>");
    expect(html).toContain("<dt>신뢰</dt><dd>72</dd>");
    expect((html.match(/class="party-card__stat"/g) ?? [])).toHaveLength(2);
  });

  it("HP 와 신뢰가 각자 막대를 가진다", () => {
    const html = render();

    expect(html).toContain('class="party-meter"');
    expect(html).toContain('class="party-meter party-meter--trust"');
  });

  /* 라벨 문구를 두지 않는다. 아이콘과 금액이 붙어 있으면 읽힌다. */
  it("소지 골드는 라벨 문구 없이 아이콘과 금액으로 보여준다", () => {
    const html = render();

    expect(html).toContain('class="party-card__gold"');
    expect(html).toContain("/assets/u2/status-gold.svg");
    expect(html).toContain("<dd>31</dd>");
    expect(html).not.toContain(">소지 골드<");
  });

  /* 눈으로는 아이콘이지만 읽어주는 도구에는 이름이 있어야 한다. */
  it("골드 아이콘이 대체 텍스트로 이름을 남긴다", () => {
    expect(render()).toContain('alt="소지 골드"');
  });

  it("사망한 파티원을 색 외 단서로도 표시한다", () => {
    const html = render({ alive: false, hp: 0 });

    expect(html).toContain("party-card is-dead");
    expect(html).toContain("사망");
  });

  it("사망하면 HP 막대를 비운다", () => {
    expect(render({ alive: false, hp: 0 })).toContain('style="width:0%"');
  });

  it("초상 자산이 없어도 자리를 남긴다", () => {
    const html = render();

    expect(html).toContain('class="party-card__portrait"');
    expect(html).toContain("party-card__portrait-empty");
  });

  it("초상이 있으면 이름을 대체 텍스트로 쓴다", () => {
    const html = render({ portraitSrc: "/assets/characters/adel.webp" });

    expect(html).toContain('alt="아델 초상"');
    expect(html).not.toContain("party-card__portrait-empty");
  });

  it("순번을 주면 두 자리로 보여준다", () => {
    expect(render({}, { index: 0 })).toContain(">01<");
    expect(render({}, { index: 2 })).toContain(">03<");
  });

  it("순번을 주지 않으면 그 자리를 두지 않는다", () => {
    expect(render()).not.toContain("party-card__number");
  });

  it("최대 HP 가 0 이어도 막대가 깨지지 않는다", () => {
    expect(() => render({ hp: 0, maxHp: 0 })).not.toThrow();
  });
});

describe("카드 뒤집기", () => {
  const member = {
    id: "character-1",
    name: "로자린드",
    classLabel: "마법사",
    personalityLabel: "신중한",
    hp: 18,
    maxHp: 24,
    trust: 41,
    gold: 12,
    alive: true,
  };

  /* 원정 밖에는 되짚을 원정이 없다. 누를 수 없는 카드에 버튼 모양을 주지 않는다. */
  it("변화를 주지 않으면 뒤집을 수 없다", () => {
    const html = renderToStaticMarkup(createElement(PartyMemberCard, { member }));

    expect(html).not.toContain("party-card__flip");
    expect(html).not.toContain("party-member-changes");
  });

  it("변화를 주면 뒤집을 수 있다", () => {
    const html = renderToStaticMarkup(createElement(PartyMemberCard, {
      member,
      changes: [{ cause: "돌을 괴고 지나가라고 하세요", reaction: "수용", trust: { before: 38, after: 41 } }],
    }));

    expect(html).toContain("party-card__flip");
    expect(html).toContain("돌을 괴고 지나가라고 하세요");
    expect(html).toContain("수용 · 신뢰 38 → 41");
  });

  /* 뒤집혀도 누구인지는 남는다. 이름이 없으면 어느 카드인지 잃는다. */
  it("뒷면에 이름이 남는다", () => {
    const html = renderToStaticMarkup(createElement(PartyMemberCard, { member, changes: [] }));
    const back = html.match(/party-card__back[\s\S]*?<\/div>/)?.[0] ?? "";

    expect(back).toContain("로자린드");
  });

  it("아직 아무 일도 없으면 그렇게 적는다", () => {
    const html = renderToStaticMarkup(createElement(PartyMemberCard, { member, changes: [] }));

    expect(html).toContain("아직 아무 일도 없었다");
  });

  /* HP 와 신뢰가 함께 바뀐 자리는 둘 다 적는다. */
  it("HP 와 신뢰를 함께 적는다", () => {
    const html = renderToStaticMarkup(createElement(PartyMemberCard, {
      member,
      changes: [{ cause: "그대로 지나가라고 하세요", hp: { before: 24, after: 18 }, trust: { before: 45, after: 41 } }],
    }));

    expect(html).toContain("HP 24 → 18");
    expect(html).toContain("신뢰 45 → 41");
  });
});

describe("이 원정의 총합", () => {
  const member = {
    id: "character-1",
    name: "로자린드",
    classLabel: "마법사",
    personalityLabel: "신중한",
    hp: 12,
    maxHp: 24,
    trust: 30,
    gold: 12,
    alive: true,
  };

  /* 한 줄씩 훑어 더해야 알 수 있으면 되짚는 뜻이 없다. */
  it("여러 자리의 변화를 처음과 마지막으로 합친다", () => {
    const html = renderToStaticMarkup(createElement(PartyMemberCard, {
      member,
      changes: [
        { cause: "첫 자리", hp: { before: 24, after: 18 }, trust: { before: 45, after: 40 } },
        { cause: "둘째 자리", hp: { before: 18, after: 12 }, trust: { before: 40, after: 30 } },
      ],
    }));

    /* 24 에서 12 로, 45 에서 30 으로. 중간값은 총합에 나오지 않는다. */
    expect(html).toContain("-12");
    expect(html).toContain("24 → 12");
    expect(html).toContain("-15");
    expect(html).toContain("45 → 30");
  });

  it("오른 것은 더하기로 적는다", () => {
    const html = renderToStaticMarkup(createElement(PartyMemberCard, {
      member,
      changes: [{ cause: "쉬어 갔다", hp: { before: 12, after: 20 } }],
    }));

    expect(html).toContain("+8");
  });

  /* 아무것도 달라지지 않았으면 총합 칸을 두지 않는다. */
  it("변화가 없으면 총합이 없다", () => {
    const html = renderToStaticMarkup(createElement(PartyMemberCard, {
      member,
      changes: [{ cause: "반응만 했다", reaction: "수용" }],
    }));

    expect(html).not.toContain("party-card__net");
    expect(html).toContain("반응만 했다");
  });
});
