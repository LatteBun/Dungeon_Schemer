# R3 정보 카드 판정과 R2 신뢰 확장 Implementation Plan

> 상태: **제품 요구사항 대체됨**
> 용사 전용 정보 전달과 보스 정보 효과는 [게임 방향 개편 설계](../specs/2026-08-13-sanghwan-yoo-game-direction-rework-design.md)를 따른다. 기존 개인 반응 구현의 역사 기록으로 보존한다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플레이어가 선택한 정보 카드 한 장에 대해 파티 또는 보스의 재현 가능한 반응과 즉시 신뢰 변화를 순수 함수로 반환한다.

**Architecture:** R2의 `trust.ts`에 정보 카드 전용 공통 행동 세 개를 추가하고, R3의 새 `info.ts`가 카드 반응 확률·플래그·R2 호출만 소유한다. R3는 상태, 카드 효과, `InfoClaim` 생성, 보스전 결과, 게임 오버를 변경하지 않으며 P1/P2/U2가 반환값을 소비한다.

**Tech Stack:** TypeScript 5.9 strict, Vitest 4.1.10, Next.js 16.3, 기존 `@/lib/domain`·`@/lib/rng`·`@/lib/rules/trust`, pnpm 11.21.0, Node.js 24.19.0

## Global Constraints

- 근거 설계는 `docs/superpowers/specs/2026-08-13-sanghwan-yoo-information-card-rules-design.md`, 공식 규칙은 `docs/systems/INFORMATION_AND_DECEPTION.md`와 `docs/systems/PARTY_AND_TRUST.md`다.
- R3는 이미 선택된 `InfoCard` 한 장만 받는다. 카드 세 장의 생성·선택은 Q1/U2의 책임이다.
- 파티 대상은 살아 있는 파티원을 입력 순서대로 모두 판정한다. 보스 대상은 기본 확률만 사용해 한 번 판정한다.
- 반응은 `accepted`, `suspected`, `exposed`다. 여기서 `exposed`는 거짓 카드 적발이고, `TrustEvaluation.exposed`는 신뢰 0 도달 상태다.
- 진실 수용은 `actHonestly`, 거짓 수용은 `deceptionAccepted`, 거짓 적발은 `deceptionExposed`를 R2에 전달한다. 중립 수용과 모든 의심은 즉시 신뢰를 바꾸지 않는다.
- 수용된 거짓만 `pendingVerification: true`, 의심한 정보만 `pendingSuspicionEvaluation: true`다. 실제 기록 생성·사후 신뢰 변화·카드 효과·게임 종료는 이 작업에 넣지 않는다.
- 카드 반응에는 주입된 `cardRng`, 신뢰 변화에는 주입된 `trustRng`만 쓴다. `Math.random`, `createRng`, Zustand, 시간 API를 호출하지 않는다.
- 진실·중립 수용률은 5~95, 거짓 적발률은 5~80, 거짓 수용률은 5~`95 - 적발률`로 제한한다.
- 기존 R2의 20% 변동 폭, 0~100 경계, 신뢰 0의 회복 불가·난수 미소비, 입력 불변성 규약을 보존한다.
- 테스트는 명시적 Vitest import와 `@/` 별칭을 사용하고, 설명과 커밋 제목·본문은 한글로 작성한다.

## 구현 전 수치 확인

R3 설계는 세 R2 행동의 방향만 확정했다. 아래 표는 이 계획이 사용하는 권장 기본 변화량이다. 모두 기존 R2와 같은 ±20% 난수 변동을 적용한다. 구현을 시작하기 전 이 표를 사용자와 확정하고, 확정한 표를 `docs/systems/PARTY_AND_TRUST.md`에 기록한다.

| 행동 | 의심 많음 | 정의로움 | 탐욕스러움 | 신중함 | 충동적 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `deceptionAccepted` | +4 | +6 | +2 | +3 | +5 |
| `suspicionWasCostly` | +10 | +8 | +4 | +9 | +7 |
| `suspicionWasCorrect` | -5 | -8 | -5 | -7 | -6 |

`deceptionAccepted`는 정직한 행동보다 작은 상승으로, `suspicionWasCostly`는 잘못된 의심을 교정할 만큼 더 큰 상승으로 둔다. `suspicionWasCorrect`는 의심이 이득이었다는 확인 뒤 신뢰를 낮춘다. 이 표가 확정되기 전에는 코드나 기존 설계 수치를 변경하지 않는다.

## File Map

| 파일 | 책임 |
| --- | --- |
| `lib/rules/trust.ts` | R3가 필요한 세 `TrustAction`과 성격별 기본 변화량·표준 사유를 기존 R2 판정표에 추가 |
| `lib/rules/trust.test.ts` | 열한 행동의 완전성, 세 추가 행동의 수치·방향, 기존 변동·경계 규약 회귀 검증 |
| `lib/rules/info.ts` | 카드 유형·파티원 신뢰/성격 보정, 반응 굴림, R2 연동, 공개 결과 타입을 소유하는 순수 규칙 |
| `lib/rules/info.test.ts` | 파티/보스 × 진실·중립·거짓, 혼합 반응, 확률 경계, 플래그, 난수 분리, 불변성 검증 |
| `docs/systems/PARTY_AND_TRUST.md` | 확정된 세 R2 행동의 성격별 수치와 의미를 공식 규칙으로 기록 |
| `docs/superpowers/specs/2026-08-13-sanghwan-yoo-information-card-rules-design.md` | 설계 승인 상태를 보관 |
| `docs/superpowers/plans/2026-08-13-sanghwan-yoo-information-card-rules.md` | 이 구현 순서와 검증 명령을 보관 |

---

### Task 1: R2 정보 카드용 신뢰 행동을 확장한다

**Files:**
- Modify: `lib/rules/trust.ts`
- Modify: `lib/rules/trust.test.ts`
- Modify: `docs/systems/PARTY_AND_TRUST.md`

**Interfaces:**
- Consumes: 기존 `PartyMember`, `Personality`, `TrustChange`, `Rng`, `evaluateTrust(member, action, rng)`
- Produces: `TrustAction`에 `deceptionAccepted | suspicionWasCostly | suspicionWasCorrect`를 포함한 열한 행동과 완전한 `TRUST_RULES`

- [x] **Step 1: 세 확장 행동의 실패 테스트를 추가한다**

`lib/rules/trust.test.ts`의 판정표 테스트를 열한 행동과 아래 정확한 행렬을 검증하도록 바꾼다. `PERSONALITIES`의 선언 순서는 `suspicious`, `righteous`, `greedy`, `prudent`, `impulsive`다.

```ts
it("R3 신뢰 행동 세 개가 성격별 확정 수치로 존재한다", () => {
  expect(TRUST_ACTIONS).toHaveLength(11);
  expect(
    PERSONALITIES.map(
      (personality) => TRUST_RULES[personality].deceptionAccepted.baseDelta,
    ),
  ).toEqual([4, 6, 2, 3, 5]);
  expect(
    PERSONALITIES.map(
      (personality) => TRUST_RULES[personality].suspicionWasCostly.baseDelta,
    ),
  ).toEqual([10, 8, 4, 9, 7]);
  expect(
    PERSONALITIES.map(
      (personality) => TRUST_RULES[personality].suspicionWasCorrect.baseDelta,
    ),
  ).toEqual([-5, -8, -5, -7, -6]);
});
```

기존 `같은 행동에서 성격에 따른 의미 있는 차이`와 변동 범위 반복은 `TRUST_ACTIONS` 전체를 순회하게 그대로 둔다. 이로써 새 행동도 표준 사유, ±20% 변동, 경계값, 신뢰 0 난수 미소비 규약을 자동으로 검증한다.

- [x] **Step 2: 새 테스트가 아직 없는 행동 때문에 실패하는지 확인한다**

Run:

```bash
pnpm test -- lib/rules/trust.test.ts
```

Expected: FAIL. `deceptionAccepted`, `suspicionWasCostly`, `suspicionWasCorrect` 속성이 `TRUST_RULES`에 없다는 TypeScript/Vitest 오류가 나와야 한다.

- [x] **Step 3: 닫힌 행동 유니온과 각 성격의 판정표를 추가한다**

`lib/rules/trust.ts`의 `TRUST_ACTIONS` 끝에 다음 문자열 세 개를 이 순서로 넣는다.

```ts
  "deceptionAccepted",
  "suspicionWasCostly",
  "suspicionWasCorrect",
```

각 성격 객체에 다음 `rule` 항목을 추가한다. 기존 `rule`, `TRUST_RULES satisfies`, `rollDelta`, `evaluateTrust`는 바꾸지 않는다.

```ts
// suspicious
deceptionAccepted: rule(4, "의심 많은 성격: 믿을 만해 보인 정보에 조심스럽게 신뢰를 보냄"),
suspicionWasCostly: rule(10, "의심 많은 성격: 근거 없는 의심으로 입은 손해에서 신뢰할 이유를 배움"),
suspicionWasCorrect: rule(-5, "의심 많은 성격: 의심이 이득이 되어 플레이어를 더 경계함"),

// righteous
deceptionAccepted: rule(6, "정의로운 성격: 믿은 정보가 성실한 안내라고 받아들임"),
suspicionWasCostly: rule(8, "정의로운 성격: 불신으로 동료가 손해 본 일을 반성하며 신뢰함"),
suspicionWasCorrect: rule(-8, "정의로운 성격: 의심이 옳았다는 결과로 플레이어를 강하게 불신함"),

// greedy
deceptionAccepted: rule(2, "탐욕스러운 성격: 정보가 이익으로 이어질 가능성을 조금 신뢰함"),
suspicionWasCostly: rule(4, "탐욕스러운 성격: 의심으로 잃은 이익을 보고 신뢰를 조금 회복함"),
suspicionWasCorrect: rule(-5, "탐욕스러운 성격: 의심 덕분에 이득을 얻어 플레이어를 경계함"),

// prudent
deceptionAccepted: rule(3, "신중한 성격: 수용한 정보가 당장은 신뢰할 근거가 됨"),
suspicionWasCostly: rule(9, "신중한 성격: 과도한 경계가 손해를 낳았음을 확인하고 신뢰함"),
suspicionWasCorrect: rule(-7, "신중한 성격: 의심이 위험을 피하게 해 플레이어를 덜 신뢰함"),

// impulsive
deceptionAccepted: rule(5, "충동적 성격: 믿은 정보를 즉시 긍정적으로 받아들임"),
suspicionWasCostly: rule(7, "충동적 성격: 의심으로 기회를 놓친 일을 보고 신뢰를 회복함"),
suspicionWasCorrect: rule(-6, "충동적 성격: 의심이 이득이 되어 플레이어를 즉시 불신함"),
```

`docs/systems/PARTY_AND_TRUST.md`의 `R3 추가 행동` 표는 방향 열만 남기지 말고, 다음 표로 교체한다. 기존 문장 `세 행동의 성격별 기본 변화량과 변동 폭은 R2 확장 작업에서 확정한다`는 `세 행동에도 다른 R2 행동과 같은 ±20% 변동 폭을 적용한다`로 교체한다.

```md
| 공통 행동 | 의심 많음 | 정의로움 | 탐욕스러움 | 신중함 | 충동적 | 의미 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `deceptionAccepted` | +4 | +6 | +2 | +3 | +5 | 거짓 정보가 믿어져 일시적으로 신뢰를 얻음 |
| `suspicionWasCostly` | +10 | +8 | +4 | +9 | +7 | 정보를 의심해 파티가 손해를 봄 |
| `suspicionWasCorrect` | -5 | -8 | -5 | -7 | -6 | 정보를 의심해 파티가 이득을 봄 |
```

- [x] **Step 4: R2 확장과 회귀 테스트를 통과시킨다**

Run:

```bash
pnpm test -- lib/rules/trust.test.ts lib/rules/party.test.ts lib/rng/index.test.ts
```

Expected: 지정한 세 테스트 파일이 모두 PASS한다. 새 세 행동은 각각 상승·상승·하락의 실제 변화량을 내며, 기존 여덟 행동의 결과는 바뀌지 않는다.

- [x] **Step 5: R2 확장 변경을 독립 커밋한다**

```bash
git add lib/rules/trust.ts lib/rules/trust.test.ts docs/systems/PARTY_AND_TRUST.md
git commit -m "기능: 정보 카드용 신뢰 행동 확장" -m "거짓 수용과 의심 결과를 성격별 신뢰 변화로 해석한다.
R3가 즉시 판정과 사후 검증을 같은 신뢰 규칙으로 연결할 수 있게 한다."
```

---

### Task 2: R3 공개 계약과 반응 경계를 테스트로 고정한다

**Files:**
- Create: `lib/rules/info.test.ts`

**Interfaces:**
- Consumes: `InfoCard`, `PartyMember`, `Rng`, Task 1의 확장 `evaluateTrust`
- Produces: 아직 존재하지 않는 `evaluateInfoCard(options)`가 반환해야 할 `InfoCardEvaluation` 계약과 결정적 테스트 픽스처

- [x] **Step 1: 순서가 정해진 난수와 카드·파티 픽스처를 작성한다**

`lib/rules/info.test.ts`에 다음 헬퍼를 만든다. `scriptedRng`는 `int` 호출마다 미리 정한 수를 하나 반환하므로, 카드 반응 경계를 시드 탐색 없이 검사할 수 있다. 카드 RNG에는 1~100, 신뢰 RNG에는 해당 변동 폭 안의 `0`만 넣는다.

```ts
import { describe, expect, it } from "vitest";
import type { CardId, ClassId, MemberId, PartyMember } from "@/lib/domain";
import type { InfoCard } from "@/lib/domain";
import { createRng } from "@/lib/rng";
import type { Rng, RngStream } from "@/lib/rng";
import { TRUST_RULES } from "@/lib/rules/trust";
import { evaluateInfoCard } from "@/lib/rules/info";

function scriptedRng(...values: number[]): Rng {
  let index = 0;
  const rng: Rng = {
    seed: "scripted",
    float: () => { throw new Error("이 테스트는 float를 사용하지 않는다."); },
    int: (min, max) => {
      const value = values[index++];
      if (value === undefined || value < min || value > max) {
        throw new Error(`허용 범위 ${min}~${max} 밖의 scriptedRng 값: ${value}`);
      }
      return value;
    },
    pick: <T>(items: readonly T[]) => items[0] as T,
    shuffle: <T>(items: readonly T[]) => [...items],
    derive: (_stream: RngStream) => rng,
  };
  return rng;
}

function member(
  personality: PartyMember["personality"], trust = 50, alive = true,
): PartyMember {
  return {
    id: `member-${personality}-${trust}` as MemberId,
    name: personality,
    classId: "test-class" as ClassId,
    personality,
    trust,
    alive,
  };
}

function card(truthType: InfoCard["truthType"]): InfoCard {
  return {
    id: `card-${truthType}` as CardId,
    truthType,
    topic: "테스트 정보",
    text: `${truthType} 카드`,
  };
}
```

- [x] **Step 2: 파티·보스와 세 카드 유형의 실패 테스트를 작성한다**

같은 파일에 다음 테스트를 추가한다. 보스는 보정이 없으므로 진실 `1/71`, 중립 `1/56`, 거짓 `1/16/61`이 각각 수용·의심 또는 적발·수용·의심 경계다. 파티 테스트는 각 반응이 가능한지와 R2의 실제 사유를 확인한다.

```ts
describe("정보 카드 반응", () => {
  it.each([
    ["truth", 1, "accepted", false, false],
    ["truth", 71, "suspected", false, true],
    ["neutral", 1, "accepted", false, false],
    ["neutral", 56, "suspected", false, true],
    ["lie", 1, "exposed", false, false],
    ["lie", 16, "accepted", true, false],
    ["lie", 61, "suspected", false, true],
  ] as const)(
    "보스는 %s 카드와 굴림 %i에서 %s를 반환한다",
    (truthType, roll, reaction, pendingVerification, pendingSuspicionEvaluation) => {
      expect(evaluateInfoCard({
        audience: "boss", card: card(truthType), cardRng: scriptedRng(roll),
      })).toEqual({
        audience: "boss", reaction, pendingVerification, pendingSuspicionEvaluation,
      });
    },
  );

  it("파티의 진실 수용, 중립 수용, 거짓 수용·적발은 정해진 R2 결과만 반환한다", () => {
    const party = [member("righteous"), member("greedy"), member("prudent")];
    const truth = evaluateInfoCard({
      audience: "party", card: card("truth"), party,
      cardRng: scriptedRng(1, 100, 100), trustRng: scriptedRng(0),
    });
    const neutral = evaluateInfoCard({
      audience: "party", card: card("neutral"), party,
      cardRng: scriptedRng(1, 100, 100), trustRng: scriptedRng(),
    });
    const lie = evaluateInfoCard({
      audience: "party", card: card("lie"), party,
      cardRng: scriptedRng(31, 1, 100), trustRng: scriptedRng(0, 0),
    });
    if (truth.audience !== "party" || neutral.audience !== "party" || lie.audience !== "party") {
      throw new Error("파티 결과가 필요하다.");
    }
    expect(truth.memberResults[0].reaction).toBe("accepted");
    expect(truth.memberResults[0].trustEvaluation?.change.reason).toBe(
      TRUST_RULES.righteous.actHonestly.reason,
    );
    expect(neutral.memberResults[0].trustEvaluation).toBeNull();
    expect(lie.memberResults.map((result) => result.reaction)).toEqual([
      "accepted", "exposed", "suspected",
    ]);
    expect(lie.memberResults[0].trustEvaluation?.change.reason).toBe(
      TRUST_RULES.righteous.deceptionAccepted.reason,
    );
    expect(lie.memberResults[1].trustEvaluation?.change.reason).toBe(
      TRUST_RULES.greedy.deceptionExposed.reason,
    );
    expect(lie.memberResults[2].trustEvaluation).toBeNull();
  });
});
```

`lie`의 첫 굴림 `31`은 신뢰 50인 정의로운 파티원에서 적발률 30, 수용률 35이므로 수용이다. 둘째 굴림 `1`은 탐욕스러운 파티원의 거짓 적발이고, 셋째 굴림 `100`은 의심이다.

- [x] **Step 3: 플래그, 생존 필터, 확률 경계, 재현성, 불변성의 실패 테스트를 추가한다**

아래 테스트를 추가한다. 이 테스트는 수용된 거짓과 의심을 파티원별로 분리하고, 사망자는 난수와 결과에서 제외하며, R3가 입력을 변경하지 않는 계약을 고정한다.

```ts
describe("정보 카드 규칙 경계", () => {
  it("한 장의 거짓에 살아 있는 모든 파티원이 서로 다른 반응을 낼 수 있다", () => {
    const party = [
      member("suspicious", 0),
      member("impulsive", 100),
      member("greedy", 50),
    ];
    const result = evaluateInfoCard({
      audience: "party", card: card("lie"), party,
      cardRng: scriptedRng(1, 30, 100), trustRng: scriptedRng(0, 0),
    });
    if (result.audience !== "party") throw new Error("파티 결과가 필요하다.");
    expect(result.memberResults.map((entry) => entry.reaction)).toEqual([
      "exposed", "accepted", "suspected",
    ]);
    expect(result.memberResults.map((entry) => entry.pendingVerification)).toEqual([
      false, true, false,
    ]);
    expect(result.memberResults.map((entry) => entry.pendingSuspicionEvaluation)).toEqual([
      false, false, true,
    ]);
  });

  it("확률 하한·상한과 거짓의 최소 의심 구간을 지킨다", () => {
    const lowSuspicious = [member("suspicious", 0)];
    const highImpulsive = [member("impulsive", 100)];
    const truthAt95 = evaluateInfoCard({
      audience: "party", card: card("truth"), party: highImpulsive,
      cardRng: scriptedRng(95), trustRng: scriptedRng(0),
    });
    const truthAt96 = evaluateInfoCard({
      audience: "party", card: card("truth"), party: highImpulsive,
      cardRng: scriptedRng(96), trustRng: scriptedRng(),
    });
    const lieAt50 = evaluateInfoCard({
      audience: "party", card: card("lie"), party: lowSuspicious,
      cardRng: scriptedRng(50), trustRng: scriptedRng(),
    });
    const lieAt51 = evaluateInfoCard({
      audience: "party", card: card("lie"), party: lowSuspicious,
      cardRng: scriptedRng(51), trustRng: scriptedRng(0),
    });
    const lieAt56 = evaluateInfoCard({
      audience: "party", card: card("lie"), party: lowSuspicious,
      cardRng: scriptedRng(56), trustRng: scriptedRng(),
    });
    if (
      truthAt95.audience !== "party" || truthAt96.audience !== "party" ||
      lieAt50.audience !== "party" || lieAt51.audience !== "party" || lieAt56.audience !== "party"
    ) throw new Error("파티 결과가 필요하다.");
    expect(truthAt95.memberResults[0].reaction).toBe("accepted");
    expect(truthAt96.memberResults[0].reaction).toBe("suspected");
    expect(lieAt50.memberResults[0].reaction).toBe("exposed");
    expect(lieAt51.memberResults[0].reaction).toBe("accepted");
    expect(lieAt56.memberResults[0].reaction).toBe("suspected");
  });

  it("사망 파티원을 제외하고 입력 객체·배열을 변경하지 않으며 같은 시드에서 재현된다", () => {
    const party = [member("prudent"), member("greedy", 50, false)];
    const partySnapshot = structuredClone(party);
    const options = {
      audience: "party" as const,
      card: card("truth"), party,
      cardRng: createRng("same").derive("card"),
      trustRng: createRng("same").derive("trust"),
    };
    const first = evaluateInfoCard(options);
    const second = evaluateInfoCard({
      ...options,
      cardRng: createRng("same").derive("card"),
      trustRng: createRng("same").derive("trust"),
    });
    expect(first).toEqual(second);
    if (first.audience !== "party") throw new Error("파티 결과가 필요하다.");
    expect(first.memberResults).toHaveLength(1);
    expect(party).toEqual(partySnapshot);
    expect(first.memberResults[0].member).not.toBe(party[0]);
  });
});
```

- [x] **Step 4: 새 R3 테스트가 모듈 부재로 실패하는지 확인한다**

Run:

```bash
pnpm test -- lib/rules/info.test.ts
```

Expected: FAIL. `@/lib/rules/info` 모듈을 찾을 수 없다는 오류가 나와야 한다.

---

### Task 3: 순수 정보 카드 판정 규칙을 구현한다

**Files:**
- Create: `lib/rules/info.ts`
- Modify: `lib/rules/info.test.ts`

**Interfaces:**
- Consumes: `InfoCard`, `PartyMember`, `TruthType` from `@/lib/domain`; `Rng` from `@/lib/rng`; `TrustEvaluation`, `evaluateTrust` from `@/lib/rules/trust`
- Produces: `InfoAudience`, `InfoReaction`, `MemberInfoCardResult`, `PartyInfoCardEvaluation`, `BossInfoCardEvaluation`, `InfoCardEvaluation`, `PartyInfoCardOptions`, `BossInfoCardOptions`, `evaluateInfoCard(options)`

- [x] **Step 1: 공개 타입과 확률 상수를 구현한다**

`lib/rules/info.ts`에 설계서와 같은 공개 계약을 선언하고, 카드 유형별 기본 확률을 닫힌 `Record`로 둔다.

```ts
import type { InfoCard, PartyMember, Personality, TruthType } from "@/lib/domain";
import type { Rng } from "@/lib/rng";
import { evaluateTrust } from "@/lib/rules/trust";
import type { TrustEvaluation } from "@/lib/rules/trust";

export type InfoAudience = "party" | "boss";
export type InfoReaction = "accepted" | "suspected" | "exposed";

export interface MemberInfoCardResult {
  readonly member: PartyMember;
  readonly reaction: InfoReaction;
  readonly trustEvaluation: TrustEvaluation | null;
  readonly pendingVerification: boolean;
  readonly pendingSuspicionEvaluation: boolean;
}

export interface PartyInfoCardEvaluation {
  readonly audience: "party";
  readonly memberResults: readonly MemberInfoCardResult[];
}

export interface BossInfoCardEvaluation {
  readonly audience: "boss";
  readonly reaction: InfoReaction;
  readonly pendingVerification: boolean;
  readonly pendingSuspicionEvaluation: boolean;
}

export type InfoCardEvaluation = PartyInfoCardEvaluation | BossInfoCardEvaluation;

export interface PartyInfoCardOptions {
  readonly audience: "party";
  readonly card: InfoCard;
  readonly party: readonly PartyMember[];
  readonly cardRng: Rng;
  readonly trustRng: Rng;
}

export interface BossInfoCardOptions {
  readonly audience: "boss";
  readonly card: InfoCard;
  readonly cardRng: Rng;
}

const BASE_CHANCES: Readonly<Record<TruthType, Readonly<{ accept: number; expose: number }>>> = {
  truth: { accept: 70, expose: 0 },
  neutral: { accept: 55, expose: 0 },
  lie: { accept: 45, expose: 15 },
};
```

- [x] **Step 2: 파티 보정과 반응 굴림을 구현한다**

같은 파일에 아래 순수 헬퍼를 추가한다. `clamp`는 `value`를 양끝 포함 범위로 제한하고, 거짓은 적발 구간을 먼저 확인한다. 보스 호출은 `member` 없이 기본 확률만 사용하므로 보정·제한을 거치지 않는다.

```ts
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function trustModifier(trust: number): { accept: number; expose: number } {
  if (trust <= 33) return { accept: -20, expose: 15 };
  if (trust <= 66) return { accept: 0, expose: 0 };
  return { accept: 15, expose: -10 };
}

function personalityModifier(
  personality: Personality,
  truthType: TruthType,
): { accept: number; expose: number } {
  switch (personality) {
    case "suspicious": return { accept: -20, expose: 20 };
    case "righteous": return {
      accept: truthType === "truth" ? 15 : truthType === "lie" ? -10 : 0,
      expose: 15,
    };
    case "greedy": return { accept: 10, expose: -5 };
    case "prudent": return { accept: -10, expose: 10 };
    case "impulsive": return { accept: 15, expose: -10 };
  }
}

function reactionFor(card: InfoCard, rng: Rng, member?: PartyMember): InfoReaction {
  const base = BASE_CHANCES[card.truthType];
  const trust = member ? trustModifier(member.trust) : { accept: 0, expose: 0 };
  const personality = member
    ? personalityModifier(member.personality, card.truthType)
    : { accept: 0, expose: 0 };
  const expose = member && card.truthType === "lie"
    ? clamp(base.expose + trust.expose + personality.expose, 5, 80)
    : base.expose;
  const accept = member
    ? card.truthType === "lie"
      ? clamp(base.accept + trust.accept + personality.accept, 5, 95 - expose)
      : clamp(base.accept + trust.accept + personality.accept, 5, 95)
    : base.accept;
  const roll = rng.int(1, 100);
  if (card.truthType === "lie" && roll <= expose) return "exposed";
  if (roll <= expose + accept) return "accepted";
  return "suspected";
}
```

- [x] **Step 3: 파티와 보스 반환값을 구현한다**

반응에서 R2 행동으로 바꾸는 매핑을 한 곳에 둔다. 중립 수용과 의심은 `null`, 진실 수용·거짓 수용·거짓 적발은 각각 한 번만 `evaluateTrust`를 호출한다. R2 호출이 없는 결과도 새 `PartyMember` 복사본을 반환한다.

```ts
function immediateTrustAction(
  truthType: TruthType,
  reaction: InfoReaction,
): "actHonestly" | "deceptionAccepted" | "deceptionExposed" | null {
  if (truthType === "truth" && reaction === "accepted") return "actHonestly";
  if (truthType === "lie" && reaction === "accepted") return "deceptionAccepted";
  if (truthType === "lie" && reaction === "exposed") return "deceptionExposed";
  return null;
}

function resultForMember(
  card: InfoCard,
  member: PartyMember,
  cardRng: Rng,
  trustRng: Rng,
): MemberInfoCardResult {
  const reaction = reactionFor(card, cardRng, member);
  const action = immediateTrustAction(card.truthType, reaction);
  const trustEvaluation = action ? evaluateTrust(member, action, trustRng) : null;
  return {
    member: trustEvaluation?.member ?? { ...member },
    reaction,
    trustEvaluation,
    pendingVerification: card.truthType === "lie" && reaction === "accepted",
    pendingSuspicionEvaluation: reaction === "suspected",
  };
}

export function evaluateInfoCard(
  options: PartyInfoCardOptions | BossInfoCardOptions,
): InfoCardEvaluation {
  if (options.audience === "boss") {
    const reaction = reactionFor(options.card, options.cardRng);
    return {
      audience: "boss",
      reaction,
      pendingVerification: options.card.truthType === "lie" && reaction === "accepted",
      pendingSuspicionEvaluation: reaction === "suspected",
    };
  }
  return {
    audience: "party",
    memberResults: options.party
      .filter((member) => member.alive)
      .map((member) => resultForMember(options.card, member, options.cardRng, options.trustRng)),
  };
}
```

- [x] **Step 4: Task 2의 R3 테스트를 통과시킨다**

Run:

```bash
pnpm test -- lib/rules/info.test.ts
```

Expected: PASS. 실패하면 먼저 테스트의 굴림이 해당 파티원의 실제 보정 구간에 맞는지 확인하고, 그 다음에만 반응 경계 또는 즉시 R2 매핑을 고친다.

- [x] **Step 5: R3 변경을 독립 커밋한다**

```bash
git add lib/rules/info.ts lib/rules/info.test.ts
git commit -m "기능: 정보 카드 반응 규칙 추가" -m "선택된 정보 카드를 파티 또는 보스가 수용·의심·적발하는 결과를 시드로 재현한다.
즉시 신뢰 변화와 사후 검증 플래그만 반환해 상태와 전투 흐름에서 재사용할 수 있게 한다."
```

---

### Task 4: 전체 회귀 검증과 문서 상태를 확인한다

**Files:**
- Modify: `docs/superpowers/specs/2026-08-13-sanghwan-yoo-information-card-rules-design.md`
- Modify: `docs/superpowers/plans/2026-08-13-sanghwan-yoo-information-card-rules.md`

**Interfaces:**
- Consumes: Task 1의 R2 행동과 Task 3의 `evaluateInfoCard`
- Produces: 전체 테스트·정적 검사·프로덕션 빌드를 통과한 R3 규칙 변경과 승인된 설계/계획 기록

- [x] **Step 1: 설계서와 실제 공개 계약을 대조한다**

`docs/superpowers/specs/2026-08-13-sanghwan-yoo-information-card-rules-design.md`의 섹션 2~5와 `lib/rules/info.ts`를 대조한다. 다음 항목이 모두 일치해야 한다.

```text
party: alive 구성원 전원, 입력 순서, 각자 cardRng 1회
boss: 기본 확률만, 신뢰 판정 없음
truth accepted: actHonestly
neutral accepted / every suspected: trustEvaluation null
lie accepted: deceptionAccepted + pendingVerification
lie exposed: deceptionExposed
suspected: pendingSuspicionEvaluation
R3 non-scope: InfoClaim·상태·효과·사후 신뢰·종료
```

서술과 구현이 다르면 구현을 설계서 계약에 맞추고, 계획에 체크 표시를 한다. 설계서 상태는 `승인됨`으로 유지한다.

- [x] **Step 2: 관련 단위 테스트와 전체 테스트를 실행한다**

Run:

```bash
pnpm test -- lib/rules/trust.test.ts lib/rules/info.test.ts
pnpm test
```

Expected: 두 명령 모두 PASS한다. 첫 명령은 직접 변경한 R2/R3 규칙을 빠르게 확인하고, 둘째 명령은 배정표 무결성 검사와 상태·UI 인접 테스트의 회귀를 확인한다.

- [x] **Step 3: 정적 검사와 프로덕션 빌드를 실행한다**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm build
git diff --check
git status --short
```

Expected: 앞의 네 명령은 exit code 0이다. 마지막 명령에는 이번 R2/R3 코드·테스트·문서 변경만 보여야 하며, 다른 사람의 변경은 stage하거나 되돌리지 않는다.

- [x] **Step 4: 계획과 설계 승인 기록을 커밋한다**

```bash
git add docs/superpowers/specs/2026-08-13-sanghwan-yoo-information-card-rules-design.md docs/superpowers/plans/2026-08-13-sanghwan-yoo-information-card-rules.md
git commit -m "문서: R3 정보 카드 구현 계획 기록" -m "정보 카드 반응과 R2 신뢰 확장의 구현 순서 및 검증 기준을 남긴다.
선택된 한 장의 정보 전달과 사후 검증 책임 경계를 명확히 한다."
```

## Spec Coverage Review

| 설계 요구 | 구현 계획 위치 |
| --- | --- |
| 선택된 카드 한 장, 파티/보스 대상 | Task 3 Steps 1~3 |
| 세 카드 유형과 반응 조합 | Task 2 Step 2, Task 3 Step 2 |
| 전원 개별 판정·사망자 제외·혼합 결과 | Task 2 Step 3, Task 3 Step 3 |
| 신뢰/성격 보정·확률 제한·RNG 순서 | Task 2 Step 3, Task 3 Step 2 |
| 진실/거짓 수용·거짓 적발의 R2 연동 | Task 1, Task 2 Step 2, Task 3 Step 3 |
| 수용된 거짓·의심의 사후 플래그 | Task 2 Steps 2~3, Task 3 Step 3 |
| R3의 상태·효과·사후 결과·종료 비범위 | Global Constraints, Task 4 Step 1 |
| 재현성·불변성·전체 회귀 | Task 2 Step 3, Task 4 Steps 2~3 |

`deceptionAccepted`, `suspicionWasCostly`, `suspicionWasCorrect`의 실제 수치는 이 문서의 `구현 전 수치 확인` 표를 사용한다. 해당 표가 확정되어야 Task 1의 테스트와 공식 규칙 문서가 같은 값을 검증한다.


---

### Task 5: R3 UI 테스트와 전체 규칙 통합 테스트 페이지를 추가한다

**Files:**
- Create: lib/dev-tools/test-snapshots.ts
- Create: lib/dev-tools/test-snapshots.test.ts
- Create: app/r3-test/page.tsx
- Create: app/r3-test/r3-test-panel.tsx
- Create: app/integration-test/page.tsx
- Create: app/integration-test/integration-test-panel.tsx

**Interfaces:**
- createR3HarnessResult({ seed, audience, cardIndex })는 MOCK_PARTY, MOCK_CARDS, evaluateInfoCard를 연결해 R3 결과를 반환한다.
- createIntegrationSnapshot({ seed, audience, cardIndex, memberIndex, trustAction })는 generateParty, generateDungeon, evaluateTrust, evaluateInfoCard와 F2 RunState를 연결한 직렬화 가능한 개발 스냅샷을 반환한다.
- 두 page.tsx는 Server Component로 두고, 상호작용이 필요한 패널만 "use client"로 선언한다.

- [x] **Step 1: 하네스 스냅샷의 결정성과 연결 계약을 검증하는 실패 테스트를 작성한다**

같은 seed·선택이 같은 R3 결과를 만드는지, 살아 있는 MOCK_PARTY 전원이 포함되는지, integration snapshot이 party·dungeon·trustEvaluation·infoEvaluation·RunState를 모두 가지는지, 다른 cardIndex·seed가 결과를 바꾸는지를 검증한다.

- [x] **Step 2: 새 하네스 모듈이 없어 테스트가 실패하는지 확인한다**

~~~bash
pnpm test -- lib/dev-tools/test-snapshots.test.ts
~~~

Expected: test-snapshots 모듈을 찾을 수 없다는 FAIL이다.

- [x] **Step 3: 순수 하네스 스냅샷 모듈을 구현한다**

각 호출마다 createRng(seed).derive("party" | "dungeon" | "card" | "trust")를 사용한다. cardIndex와 memberIndex를 유효 범위로 제한하고, 생성된 party·dungeon을 같은 값으로 담은 F2 RunState를 반환한다. 실제 Zustand store는 호출하지 않는다.

- [x] **Step 4: R3 테스트 패널을 구현한다**

/r3-test에서 진실·거짓·중립 카드 3장, 파티/보스 대상, seed, 판정 실행 버튼을 제공한다. 파티 결과에는 구성원별 반응·현재 신뢰·delta·사유·pendingVerification·pendingSuspicionEvaluation을 표시하고, 보스 결과에는 보스 반응과 플래그를 표시한다. 의심은 카드 효과를 적용하지 않고 수용된 거짓은 나중에 검증된다는 설명도 표시한다.

- [x] **Step 5: 통합 테스트 패널을 구현한다**

/integration-test에서 seed, 카드, 대상, 파티원, 열한 R2 행동, 전체 판정 실행을 제공한다. R1 파티, R2 전후 신뢰, R3 카드 결과, R4 노드·이벤트, F2 RunState를 구분해 표시하고 /state-preview 링크와 P1/P2/R5 미연결 안내를 둔다.

- [x] **Step 6: 정적 검사와 브라우저 확인을 실행한다**

~~~bash
pnpm test -- lib/dev-tools/test-snapshots.test.ts
pnpm lint
pnpm typecheck
pnpm build
pnpm dev
~~~

dev server에서 agent-browser로 /r3-test와 /integration-test를 열어 내용 렌더링, error overlay 부재, 버튼 클릭 결과, seed 재현성을 확인한다. snapshot의 실제 ref를 사용해 카드 선택·판정 실행·전체 판정 실행을 누르고 마지막에 브라우저를 닫는다.
실행 결과: pnpm test, pnpm lint, pnpm typecheck, pnpm build와 두 경로의 HTTP 200·핵심 UI 문구 smoke check는 통과했다. 현재 환경에는 agent-browser CLI와 브라우저 실행 파일이 없어 실제 클릭·시드 재현성 브라우저 검증은 실행하지 못했다.
