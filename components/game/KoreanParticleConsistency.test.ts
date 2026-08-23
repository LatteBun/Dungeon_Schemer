import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 화면 문구에 두 형태를 나란히 적지 않는다.
 *
 * `새끼거미이(가) 쓰러졌습니다` 는 읽는 사람에게 고르는 일을 떠넘긴다. 받침을
 * 보고 하나를 고르는 `korean-particle.ts` 가 있는데도 같은 실수가 두 번 났다.
 * 처음은 U5-2 전투 문구였고, 두 번째는 그것을 고치고 나서 새로 쓴 보스 정보
 * 문구였다. 사람이 기억해서 막을 수 있는 종류가 아니라 여기서 고정한다.
 *
 * 검사 대상은 화면이 만드는 문자열이다. 게임 콘텐츠(`lib/content`)의 대사는
 * 작가가 쓴 그대로 두어야 하므로 보지 않는다.
 */

const GAME = join(process.cwd(), "components", "game");

/** `이(가)` `을(를)` `은(는)` `와(과)` `으로(로)` 같은 병기 형태다. */
const BOTH_FORMS = /[이가을를은는와과로]\s*\(\s*[이가을를은는와과]\s*\)|\(\s*[이가을를은는와과]\s*\)\s*[이가을를은는와과]/;

function sources(): { name: string; text: string }[] {
  return readdirSync(GAME)
    .filter((name) => (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.includes(".test."))
    .map((name) => ({ name, text: readFileSync(join(GAME, name), "utf8") }));
}

describe("조사 병기", () => {
  it("화면 문구가 두 형태를 나란히 적지 않는다", () => {
    const offenders: string[] = [];

    for (const { name, text } of sources()) {
      const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      for (const [index, line] of stripped.split("\n").entries()) {
        if (BOTH_FORMS.test(line)) offenders.push(`${name}:${index + 1} ${line.trim().slice(0, 80)}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  /* 검사가 실제로 잡는지 확인한다. 통과만 하는 검사는 없는 것과 같다. */
  it("병기 형태를 실제로 잡아낸다", () => {
    expect(BOTH_FORMS.test("새끼거미이(가) 쓰러졌습니다.")).toBe(true);
    expect(BOTH_FORMS.test("새끼거미을(를) 공격합니다.")).toBe(true);
    expect(BOTH_FORMS.test("파티(은)는 물러섰다.")).toBe(true);
    expect(BOTH_FORMS.test("새끼거미가 쓰러졌습니다.")).toBe(false);
    expect(BOTH_FORMS.test("오린을 공격합니다.")).toBe(false);
  });
});
