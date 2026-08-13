# R2 개인 신뢰 판정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공통 행동을 파티원 성격에 따라 해석해 재현 가능한 신뢰 변화, 표준 사유, 정체 발각 여부를 반환한다.

**Architecture:** `lib/rules/trust.ts`가 닫힌 행동 유니온과 완전한 성격×행동 판정표를 소유한다. `evaluateTrust(member, action, rng)`는 주입받은 `trust` 난수 스트림만 사용하며 입력 객체를 변경하지 않고 실제 적용된 변화량을 반환한다. 정보 카드 판정, 상태 변경, 게임 종료는 이 모듈 밖에 둔다.

> 2026-08-13 설계 갱신: 이 문서는 최초 R2 구현 당시의 여덟 행동을 위한 계획이다. 현재 R3 설계는 `deceptionAccepted`, `suspicionWasCostly`, `suspicionWasCorrect` 세 행동을 추가로 요구한다. 세 행동의 확장 구현은 R3 spec 승인 후 별도 plan에서 다룬다.

**Tech Stack:** TypeScript 5.9.3 strict, Vitest 4.1.10, 기존 `@/lib/domain` 타입과 `@/lib/rng` API, pnpm 11.21.0, Node.js 24.19.0

## Global Constraints

- 근거 spec은 `docs/superpowers/specs/2026-08-12-lattebun-personal-trust-design.md`다.
- 공식 규칙은 `docs/systems/PARTY_AND_TRUST.md`의 「프로토타입 신뢰 판정」을 따른다.
- 이 문서의 최초 구현 대상 행동은 `actHonestly`, `deceptionExposed`, `protectAlly`, `betrayAlly`, `secureReward`, `denyReward`, `takeRisk`, `avoidRisk` 여덟이다. 현재 R3 확장에서는 `deceptionAccepted`, `suspicionWasCostly`, `suspicionWasCorrect`를 추가한다.
- 기본 변화량이 0이 아니면 절댓값의 20%를 반올림하고 최소 1로 만든 변동 폭을 사용한다. 변화의 부호는 뒤집지 않는다.
- 기본 변화량 0과 이미 신뢰 0인 입력은 난수를 소비하지 않는다.
- `TrustChange.delta`는 0~100 제한 후 실제 적용된 차이다. `reason`은 항상 비어 있지 않다.
- 신뢰 0은 `exposed: true`지만 R2가 게임을 종료하지 않으며 일반 판정으로 회복되지 않는다.
- `Math.random`을 호출하지 않는다. 호출자가 `createRng(seed).derive("trust")`를 넘긴다.
- 입력 `PartyMember` 객체를 변경하지 않는다.
- 테스트는 `vitest` API를 명시적으로 import하고 `@/` 별칭을 사용하며 설명은 한국어로 쓴다.
- 커밋 메시지는 제목과 본문을 모두 한글로 작성한다.
- `dungeon-schemer-handoff.md`는 개인 미추적 파일이므로 stage하거나 수정하지 않는다.

## File Map

| 파일 | 책임 |
| --- | --- |
| `lib/rules/trust.ts` | 행동 타입과 목록, 성격별 기본 변화량·표준 사유, 변동 계산, 범위 제한, 발각 판정 |
| `lib/rules/trust.test.ts` | 판정표 완전성, 재현성, 변동 범위, 0 반응, 경계값, 오류, 불변성 검증 |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | 구현 완료 뒤 R2 상태와 R3·R5·U1의 남은 선행 갱신 |

---

### Task 1: 성격별 판정표와 재현 가능한 변동

**Files:**
- Create: `lib/rules/trust.ts`
- Create: `lib/rules/trust.test.ts`

**Interfaces:**
- Consumes: `PartyMember`, `Personality`, `TrustChange` from `@/lib/domain`; `Rng` from `@/lib/rng`
- Produces: `TRUST_ACTIONS`, `TrustAction`, `TrustRule`, `TRUST_RULES`, `TrustEvaluation`, `evaluateTrust(member, action, rng)`

- [ ] **Step 1: 행동 목록, 판정표, 재현성의 실패 테스트를 작성한다**

`lib/rules/trust.test.ts`를 만들고 다음 내용을 넣는다.

```ts
import { describe, expect, it } from "vitest";
import { PERSONALITIES } from "@/lib/domain";
import type { ClassId, MemberId, PartyMember } from "@/lib/domain";
import { createRng } from "@/lib/rng";
import {
  evaluateTrust,
  TRUST_ACTIONS,
  TRUST_RULES,
} from "@/lib/rules/trust";

function member(
  personality: PartyMember["personality"],
  trust = 50,
): PartyMember {
  return {
    id: `member-${personality}` as MemberId,
    name: personality,
    classId: "test-class" as ClassId,
    personality,
    trust,
    alive: true,
  };
}

function trustRng(seed: string) {
  return createRng(seed).derive("trust");
}

describe("개인 신뢰 판정표", () => {
  it("행동 여덟과 모든 성격의 규칙이 빠짐없이 존재한다", () => {
    expect(TRUST_ACTIONS).toHaveLength(8);
    expect(Object.keys(TRUST_RULES).sort()).toEqual(
      [...PERSONALITIES].sort(),
    );
    for (const personality of PERSONALITIES) {
      expect(Object.keys(TRUST_RULES[personality]).sort()).toEqual(
        [...TRUST_ACTIONS].sort(),
      );
    }
  });

  it("같은 행동에서 성격에 따른 의미 있는 차이가 난다", () => {
    for (const action of TRUST_ACTIONS) {
      const deltas = PERSONALITIES.map(
        (personality) => TRUST_RULES[personality][action].baseDelta,
      );
      expect(new Set(deltas).size).toBeGreaterThan(1);
    }
  });

  it("모든 표준 사유가 비어 있지 않고 성격 이름을 포함한다", () => {
    const labels = {
      suspicious: "의심 많은 성격",
      righteous: "정의로운 성격",
      greedy: "탐욕스러운 성격",
      prudent: "신중한 성격",
      impulsive: "충동적 성격",
    } as const;

    for (const personality of PERSONALITIES) {
      for (const action of TRUST_ACTIONS) {
        const reason = TRUST_RULES[personality][action].reason;
        expect(reason.trim()).not.toBe("");
        expect(reason).toContain(labels[personality]);
      }
    }
  });
});

describe("개인 신뢰 판정 난수", () => {
  it("같은 시드와 같은 입력은 같은 결과를 만든다", () => {
    const target = member("righteous");
    expect(
      evaluateTrust(target, "actHonestly", trustRng("same")),
    ).toEqual(evaluateTrust(target, "actHonestly", trustRng("same")));
  });

  it("실제 변화가 기본값의 20% 변동 범위 안에 있다", () => {
    for (const personality of PERSONALITIES) {
      for (const action of TRUST_ACTIONS) {
        const base = TRUST_RULES[personality][action].baseDelta;
        const spread = base === 0 ? 0 : Math.max(1, Math.round(Math.abs(base) * 0.2));
        for (let index = 0; index < 30; index += 1) {
          const result = evaluateTrust(
            member(personality),
            action,
            trustRng(`range-${personality}-${action}-${index}`),
          );
          expect(result.change.delta).toBeGreaterThanOrEqual(base - spread);
          expect(result.change.delta).toBeLessThanOrEqual(base + spread);
          if (base > 0) expect(result.change.delta).toBeGreaterThan(0);
          if (base < 0) expect(result.change.delta).toBeLessThan(0);
        }
      }
    }
  });
});
```

- [ ] **Step 2: 새 테스트가 모듈 부재로 실패하는지 확인한다**

Run:

```bash
pnpm test -- lib/rules/trust.test.ts
```

Expected: FAIL. `@/lib/rules/trust`를 찾을 수 없다는 오류가 나와야 한다.

- [ ] **Step 3: 닫힌 행동 목록과 완전한 판정표를 구현한다**

`lib/rules/trust.ts`에 다음 구조를 만든다. 아래 수치와 사유를 그대로 사용하고,
`satisfies`로 모든 성격×행동 조합을 컴파일 시점에 강제한다.

```ts
import { TRUST_MAX, TRUST_MIN } from "@/lib/domain";
import type {
  PartyMember,
  Personality,
  TrustChange,
} from "@/lib/domain";
import type { Rng } from "@/lib/rng";

export const TRUST_ACTIONS = [
  "actHonestly",
  "deceptionExposed",
  "protectAlly",
  "betrayAlly",
  "secureReward",
  "denyReward",
  "takeRisk",
  "avoidRisk",
] as const;

export type TrustAction = (typeof TRUST_ACTIONS)[number];

export interface TrustRule {
  readonly baseDelta: number;
  readonly reason: string;
}

const rule = (baseDelta: number, reason: string): TrustRule => ({
  baseDelta,
  reason,
});

export const TRUST_RULES = {
  suspicious: {
    actHonestly: rule(8, "의심 많은 성격: 정직한 태도에서 신뢰할 근거를 얻음"),
    deceptionExposed: rule(-14, "의심 많은 성격: 기만이 드러나 강하게 경계함"),
    protectAlly: rule(3, "의심 많은 성격: 동료를 보호한 행동을 긍정적으로 봄"),
    betrayAlly: rule(-8, "의심 많은 성격: 동료를 배신한 행동에서 위험을 느낌"),
    secureReward: rule(3, "의심 많은 성격: 실질적인 이익을 확인함"),
    denyReward: rule(-5, "의심 많은 성격: 약속된 이익이 사라져 의심함"),
    takeRisk: rule(-5, "의심 많은 성격: 근거 없는 위험 감수를 경계함"),
    avoidRisk: rule(7, "의심 많은 성격: 위험을 피한 신중한 판단을 신뢰함"),
  },
  righteous: {
    actHonestly: rule(12, "정의로운 성격: 정직한 행동을 높이 평가함"),
    deceptionExposed: rule(-16, "정의로운 성격: 드러난 기만을 용납하지 않음"),
    protectAlly: rule(12, "정의로운 성격: 동료를 보호한 행동을 높이 평가함"),
    betrayAlly: rule(-16, "정의로운 성격: 동료를 배신한 행동을 용납하지 않음"),
    secureReward: rule(4, "정의로운 성격: 정당한 이익을 긍정적으로 받아들임"),
    denyReward: rule(-6, "정의로운 성격: 마땅한 몫을 빼앗긴 일을 부당하게 여김"),
    takeRisk: rule(-3, "정의로운 성격: 불필요한 위험으로 동료를 위태롭게 한 점을 걱정함"),
    avoidRisk: rule(3, "정의로운 성격: 동료의 안전을 고려한 판단을 긍정적으로 봄"),
  },
  greedy: {
    actHonestly: rule(0, "탐욕스러운 성격: 이익과 무관한 정직에는 반응하지 않음"),
    deceptionExposed: rule(-6, "탐욕스러운 성격: 기만으로 손해 볼 가능성을 경계함"),
    protectAlly: rule(0, "탐욕스러운 성격: 보상 없는 동료 보호에는 반응하지 않음"),
    betrayAlly: rule(-4, "탐욕스러운 성격: 자신도 배신당할 수 있다고 경계함"),
    secureReward: rule(14, "탐욕스러운 성격: 자신의 이익을 확보해 크게 만족함"),
    denyReward: rule(-16, "탐욕스러운 성격: 자신의 이익을 빼앗겨 크게 분노함"),
    takeRisk: rule(3, "탐욕스러운 성격: 더 큰 이익을 노린 위험 감수를 긍정적으로 봄"),
    avoidRisk: rule(0, "탐욕스러운 성격: 이익과 무관한 위험 회피에는 반응하지 않음"),
  },
  prudent: {
    actHonestly: rule(5, "신중한 성격: 예측 가능한 정직한 태도를 신뢰함"),
    deceptionExposed: rule(-10, "신중한 성격: 드러난 기만을 중대한 위험으로 봄"),
    protectAlly: rule(7, "신중한 성격: 동료의 생존을 지킨 판단을 높이 평가함"),
    betrayAlly: rule(-10, "신중한 성격: 파티를 불안정하게 만든 배신을 경계함"),
    secureReward: rule(5, "신중한 성격: 안정적인 이익을 확보한 점을 긍정적으로 봄"),
    denyReward: rule(-7, "신중한 성격: 확보할 수 있던 이익을 잃은 판단을 나쁘게 봄"),
    takeRisk: rule(-12, "신중한 성격: 무모한 위험 감수를 강하게 반대함"),
    avoidRisk: rule(12, "신중한 성격: 위험을 피한 안전한 판단을 높이 평가함"),
  },
  impulsive: {
    actHonestly: rule(3, "충동적 성격: 솔직하고 즉각적인 태도를 긍정적으로 봄"),
    deceptionExposed: rule(-7, "충동적 성격: 기만당했다는 사실에 즉각 반발함"),
    protectAlly: rule(8, "충동적 성격: 망설이지 않고 동료를 구한 행동을 좋아함"),
    betrayAlly: rule(-10, "충동적 성격: 동료를 저버린 행동에 강하게 반발함"),
    secureReward: rule(7, "충동적 성격: 즉시 얻은 보상에 만족함"),
    denyReward: rule(-8, "충동적 성격: 눈앞의 보상을 잃어 강하게 불만을 느낌"),
    takeRisk: rule(12, "충동적 성격: 과감한 위험 감수를 높이 평가함"),
    avoidRisk: rule(-10, "충동적 성격: 위험을 피한 소극적인 판단을 답답해함"),
  },
} as const satisfies Readonly<
  Record<Personality, Readonly<Record<TrustAction, TrustRule>>>
>;
```

같은 파일 아래에 판정 결과와 최소 구현을 추가한다. Task 2에서 입력 검증과
신뢰 0의 선행 반환을 보강하므로 여기서는 정상 범위 입력의 핵심 계산만 만든다.

```ts
export interface TrustEvaluation {
  member: PartyMember;
  change: TrustChange;
  exposed: boolean;
}

function clampTrust(value: number): number {
  return Math.min(TRUST_MAX, Math.max(TRUST_MIN, value));
}

function rollDelta(baseDelta: number, rng: Rng): number {
  if (baseDelta === 0) return 0;
  const spread = Math.max(1, Math.round(Math.abs(baseDelta) * 0.2));
  const rolled = baseDelta + rng.int(-spread, spread);
  return baseDelta > 0 ? Math.max(1, rolled) : Math.min(-1, rolled);
}

export function evaluateTrust(
  member: PartyMember,
  action: TrustAction,
  rng: Rng,
): TrustEvaluation {
  const trustRule = TRUST_RULES[member.personality][action];
  const nextTrust = clampTrust(member.trust + rollDelta(trustRule.baseDelta, rng));
  const nextMember = { ...member, trust: nextTrust };
  return {
    member: nextMember,
    change: {
      memberId: member.id,
      delta: nextTrust - member.trust,
      reason: trustRule.reason,
    },
    exposed: nextTrust === TRUST_MIN,
  };
}
```

- [ ] **Step 4: Task 1 테스트가 통과하는지 확인한다**

Run:

```bash
pnpm test -- lib/rules/trust.test.ts
```

Expected: `lib/rules/trust.test.ts`의 5개 테스트가 모두 PASS한다.

- [ ] **Step 5: Task 1 변경을 커밋한다**

```bash
git add lib/rules/trust.ts lib/rules/trust.test.ts
git commit -m "기능: 성격별 신뢰 판정 추가" -m "공통 행동을 성격별 기본 반응으로 해석하고 trust 난수 스트림으로 작은 변동을 준다.
정보 카드와 이벤트가 같은 신뢰 규칙을 재사용하면서도 결과를 시드로 재현하기 위함이다."
```

---

### Task 2: 경계값, 발각 상태, 입력 오류와 불변성

**Files:**
- Modify: `lib/rules/trust.ts`
- Modify: `lib/rules/trust.test.ts`

**Interfaces:**
- Consumes: Task 1의 `evaluateTrust(member, action, rng)`와 `TrustEvaluation`
- Produces: 유효한 정수 신뢰만 받으며 실제 적용량, 영구적인 신뢰 0 발각 상태, 입력 불변성을 보장하는 최종 `evaluateTrust`

- [ ] **Step 1: 경계값과 오류의 실패 테스트를 추가한다**

`lib/rules/trust.test.ts` 끝에 다음 테스트를 추가한다.

```ts
describe("개인 신뢰 판정 경계", () => {
  it("100을 넘지 않고 실제 적용된 상승량을 기록한다", () => {
    const result = evaluateTrust(
      member("righteous", 99),
      "actHonestly",
      trustRng("upper-bound"),
    );
    expect(result.member.trust).toBe(100);
    expect(result.change.delta).toBe(1);
    expect(result.exposed).toBe(false);
  });

  it("0을 넘지 않고 실제 적용된 하락량과 발각을 기록한다", () => {
    const result = evaluateTrust(
      member("righteous", 2),
      "deceptionExposed",
      trustRng("lower-bound"),
    );
    expect(result.member.trust).toBe(0);
    expect(result.change.delta).toBe(-2);
    expect(result.exposed).toBe(true);
  });

  it("이미 0인 신뢰는 긍정 행동으로 회복되지 않는다", () => {
    const result = evaluateTrust(
      member("righteous", 0),
      "actHonestly",
      trustRng("already-exposed"),
    );
    expect(result.member.trust).toBe(0);
    expect(result.change.delta).toBe(0);
    expect(result.change.reason).toContain("이미 정체가 발각됨");
    expect(result.exposed).toBe(true);
  });

  it("기본값 0은 난수를 소비하지 않는다", () => {
    const used = trustRng("zero-does-not-consume");
    evaluateTrust(member("greedy"), "actHonestly", used);
    const afterZero = evaluateTrust(member("greedy"), "secureReward", used);

    const untouched = trustRng("zero-does-not-consume");
    const direct = evaluateTrust(
      member("greedy"),
      "secureReward",
      untouched,
    );
    expect(afterZero).toEqual(direct);
  });

  it("이미 0인 입력은 난수를 소비하지 않는다", () => {
    const used = trustRng("exposed-does-not-consume");
    evaluateTrust(member("righteous", 0), "actHonestly", used);
    const afterExposed = evaluateTrust(
      member("righteous"),
      "actHonestly",
      used,
    );

    const untouched = trustRng("exposed-does-not-consume");
    const direct = evaluateTrust(
      member("righteous"),
      "actHonestly",
      untouched,
    );
    expect(afterExposed).toEqual(direct);
  });

  it.each([-1, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "유효하지 않은 신뢰 %s는 RangeError를 던진다",
    (trust) => {
      expect(() =>
        evaluateTrust(
          member("prudent", trust),
          "avoidRisk",
          trustRng("invalid"),
        ),
      ).toThrow(RangeError);
    },
  );

  it("입력 파티원 객체를 변경하지 않는다", () => {
    const original = member("impulsive", 50);
    const snapshot = structuredClone(original);
    const result = evaluateTrust(
      original,
      "takeRisk",
      trustRng("immutable"),
    );
    expect(original).toEqual(snapshot);
    expect(result.member).not.toBe(original);
  });
});
```

- [ ] **Step 2: 새 테스트가 신뢰 0 회복 때문에 실패하는지 확인한다**

Run:

```bash
pnpm test -- lib/rules/trust.test.ts
```

Expected: FAIL. `이미 0인 신뢰는 긍정 행동으로 회복되지 않는다`와 유효하지 않은
입력 테스트가 실패해야 한다.

- [ ] **Step 3: 입력 검증과 신뢰 0 선행 반환을 구현한다**

`lib/rules/trust.ts`에 검증 함수를 추가한다.

```ts
function assertValidTrust(trust: number): void {
  if (
    !Number.isInteger(trust) ||
    trust < TRUST_MIN ||
    trust > TRUST_MAX
  ) {
    throw new RangeError(
      `신뢰도는 ${TRUST_MIN} 이상 ${TRUST_MAX} 이하의 정수여야 한다: ${trust}`,
    );
  }
}
```

`evaluateTrust`의 첫 부분을 다음처럼 바꾼다. 신뢰 0의 사유도 비어 있지 않으며
대상 성격을 설명하도록 만든다.

```ts
export function evaluateTrust(
  member: PartyMember,
  action: TrustAction,
  rng: Rng,
): TrustEvaluation {
  assertValidTrust(member.trust);
  const trustRule = TRUST_RULES[member.personality][action];

  if (member.trust === TRUST_MIN) {
    return {
      member: { ...member },
      change: {
        memberId: member.id,
        delta: 0,
        reason: `${trustRule.reason} · 이미 정체가 발각됨`,
      },
      exposed: true,
    };
  }

  const nextTrust = clampTrust(
    member.trust + rollDelta(trustRule.baseDelta, rng),
  );
  const nextMember = { ...member, trust: nextTrust };
  return {
    member: nextMember,
    change: {
      memberId: member.id,
      delta: nextTrust - member.trust,
      reason: trustRule.reason,
    },
    exposed: nextTrust === TRUST_MIN,
  };
}
```

- [ ] **Step 4: R2 테스트와 인접 규칙 테스트가 통과하는지 확인한다**

Run:

```bash
pnpm test -- lib/rules/trust.test.ts lib/rules/party.test.ts lib/rng/index.test.ts
```

Expected: 지정한 세 테스트 파일이 모두 PASS한다.

- [ ] **Step 5: 정적 검사를 실행한다**

Run:

```bash
pnpm lint
pnpm typecheck
```

Expected: 두 명령 모두 exit code 0이다.

- [ ] **Step 6: Task 2 변경을 커밋한다**

```bash
git add lib/rules/trust.ts lib/rules/trust.test.ts
git commit -m "기능: 신뢰 경계와 발각 상태 보장" -m "실제 적용된 변화량만 기록하고 신뢰 0을 회복 불가능한 발각 상태로 유지한다.
잘못된 신뢰 입력과 원본 상태 변경이 후속 게임 흐름에 퍼지지 않도록 경계를 강화한다."
```

---

### Task 3: 배정표 갱신과 전체 검증

**Files:**
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Task 2에서 완성한 R2 공개 계약과 통과한 테스트
- Produces: R2 완료 상태, R3의 남은 선행 없음, R5의 남은 선행 `R1 R3 R4`, U1의 남은 선행 `R1`

- [ ] **Step 1: 원격 main을 가져와 구현 브랜치에 병합한다**

Run:

```bash
git fetch origin
git merge origin/main
```

Expected: 병합이 완료되고 충돌이 없다. 충돌이 있으면 사용자 변경을 덮어쓰지 말고
해당 파일의 양쪽 의도를 확인해 해결한 뒤 다음 단계로 간다. 승인받은 PR이 이미
있다면 이 단계 이후에는 브랜치에 추가 push하지 말고 새 승인이 필요함을 알린다.

- [ ] **Step 2: 배정표의 R2 완료와 풀린 선행을 수정한다**

`docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`에서 다음 네 행만 바꾼다.

```markdown
| R2 | 개인 신뢰 판정 | 같은 행동이 성격별로 다른 증감을 내고, 변화 사유를 함께 반환하며, 신뢰 0이 실패 상태가 되는 테스트 통과 | — | **R3 R5 U1** | LatteBun | ✅ |
| R3 | 정보 카드 판정 | 대상(용사·보스) × 유형(진실·거짓·중립)에 대해 수용·의심·적발 결과, 신뢰 변화, 미검증 플래그를 반환하는 테스트 통과 | — | **R5 P2 U2 Q1** | | ⬜ |
| R5 | 결과 정산 계산 | 런 종료 상태에서 생존자·신뢰 변화 내역·보상·영향을 준 선택 목록을 반환하는 테스트 통과 | R1 R3 R4 | **P2 U4** | | ⬜ |
| U1 | 파티·개인 신뢰 패널 | 파티원별 직업·성격·신뢰 상태와 최근 변화 사유가 보이고, 개인별 차이를 확인할 수 있음 | R1 | **U5 Q2** | | ⬜ |
```

다른 행과 의존성 그래프의 전체 구조는 바꾸지 않는다. `풀리는 것`은 완료 여부와
무관한 전체 구조이므로 R2 행에서도 그대로 둔다.

- [ ] **Step 3: 배정표 무결성 검사를 먼저 실행한다**

Run:

```bash
pnpm test -- docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts
```

Expected: 배정표 규약 테스트가 모두 PASS한다.

- [ ] **Step 4: 전체 검증 네 개를 각각 실행한다**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 네 명령 모두 exit code 0이다. `pnpm test`는 R2 테스트와 배정표 무결성
검사를 포함한다.

- [ ] **Step 5: diff와 개인 파일 제외 여부를 확인한다**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` 출력이 없다. `git status --short`에는 배정표 변경과
개인 미추적 파일 `dungeon-schemer-handoff.md`만 보이며, 개인 파일은 stage하지 않는다.

- [ ] **Step 6: 배정표 변경을 커밋한다**

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "문서: 개인 신뢰 판정 완료 기록" -m "R2 구현과 전체 검증이 끝나 후속 작업의 남은 선행을 갱신한다.
R3, R5, U1 담당자가 현재 시작 조건을 배정표에서 바로 확인할 수 있게 한다."
```

- [ ] **Step 7: 최종 커밋 상태와 검증 근거를 확인한다**

Run:

```bash
git status --short
git log --oneline -4
```

Expected: 추적 파일 변경은 없고 `dungeon-schemer-handoff.md`만 미추적 상태다.
최근 커밋에는 설계, 성격별 판정, 경계·발각, 배정표 갱신 커밋이 나타난다.
