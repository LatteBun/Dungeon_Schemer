# F3-1 조언 콘텐츠 계약·검증기와 공용 사건 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 조언 콘텐츠의 계약을 검증기로 고정하고, 그 계약을 만족하는 공용 사건 15개를 만든다.

**Architecture:** 검증기를 먼저 놓고 콘텐츠를 나중에 넣는다. 검증기는 `lib/content/theme-validation.ts`의 패턴을 그대로 따르는 순수 함수이고 위반 시 `RuleError("INVALID_GENERATION", ...)`를 던진다. 검증기 테스트는 **일부러 위반한 fixture**로 오류 발생을 확인하고, 콘텐츠 테스트는 진짜 15개가 통과하는지 확인한다. 앞의 것이 없으면 검증기가 아무것도 하지 않고 통과시켜도 알 수 없다.

**Tech Stack:** TypeScript, Vitest, pnpm

**Spec:** [F3-1 조언 콘텐츠 계약·검증기와 공용 사건 설계](../specs/2026-08-20-lattebun-f3-1-advice-content-contract-design.md)

## Global Constraints

- 커밋 메시지는 제목과 본문을 포함해 **항상 한글**로 쓴다
- `main`에 직접 push하지 않는다. `main`에서 브랜치를 따고 PR을 만든다. PR을 쌓지 않는다
- 검증 명령은 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` 넷이다
- 콘텐츠 검증 실패는 조용히 재추첨하지 않고 `RuleError("INVALID_GENERATION", message, details)`로 보고한다
- 검증기는 **수량·문구·태그만** 확인한다. 유형 판정, 수용·의심·적발 확률, 개인별 반응, 보스 피해 보정은 `E2`의 몫이다
- 한 던전 안의 사건 중복 방지는 검증기가 아니라 **배치(`E3`)의 책임**이다
- 공용 사건 수량은 **하한**이다. 분류당 5개 **이상**을 요구하며 정확히 15개를 요구하지 않는다 — `F3-4`가 90개로 늘릴 때 검증기가 깨지면 안 된다

## 기존 코드에서 그대로 쓰는 것

`lib/domain/content.ts`에 타입이 이미 있다. **이 계획은 타입을 고치지 않는다.**

```typescript
export interface AdviceOption {
  id: ChoiceId;
  label: string;          // "횃불을 하나 집어 거미들 사이의 바닥에 던지세요"
  line: string;           // "거미는 불을 싫어한다고 들었어!"
  outcome: AdviceOutcome; // "help" | "harm" | "neutral"
  ruleId?: RuleId;        // relation이 unrelated면 없다
  relation: EcologyRelation; // "consistent" | "contradictory" | "unrelated"
  effectTags: readonly EventEffectTag[];
  bossDamageModifier?: number;
  resultText: string;
}

export interface AdviceUpgrade {
  clueId: ClueId;
  slotIndex: number;      // 0 · 1 · 2
  replacement: AdviceOption;
}

export interface SituationEvent {
  id: EventId;
  kind: EventKind;        // "monster" | "rest" | "merchant" | "special"
  theme?: ThemeId;        // 공용이면 없다
  title: string;
  description: string;
  advice: readonly AdviceOption[];
  defaultResultText: string;
  revealsClue?: ClueId;
  requiresClue?: ClueId;
  upgrades?: readonly AdviceUpgrade[];
}
```

`lib/content/theme-validation.ts`의 헬퍼 세 개를 같은 모양으로 다시 만든다. 파일을 넘나들며 공유하지 않는다 — 검증 대상이 다르면 오류 문구의 `details`도 달라야 하기 때문이다.

```typescript
function invalid(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function requireText(value: string, message: string, details: Record<string, unknown>): void {
  if (value.trim() === "") invalid(message, details);
}
```

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/content/situation-validation.ts` | 검증기. `F3-2`·`F3-3`가 재사용한다 |
| `lib/content/situation-validation.test.ts` | 위반 fixture마다 오류가 나는지 |
| `lib/content/shared-events.ts` | 공용 사건 15개 |
| `lib/content/shared-events.test.ts` | 15개가 계약을 만족하는지 |
| `docs/systems/INFORMATION_AND_DECEPTION.md` | 계약의 모순 둘을 고친다 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | `F3-4`·`F3-5` 신설, `F3-1` 완료 |

`themes.ts`와 `theme-validation.ts`가 나뉘어 있는 것과 같은 모양이다. 검증기가 여러 콘텐츠 작업에서 재사용되므로 데이터와 분리한다.

---

## Task 1: 브랜치를 만들고 계약의 모순 둘을 고친다

**Files:**
- Modify: `docs/systems/INFORMATION_AND_DECEPTION.md`

**Interfaces:**
- Consumes: 없음
- Produces: 검증기가 근거로 삼을 공식 계약. Task 2~5가 이 문서를 구현한다

- [ ] **Step 1: main에서 브랜치를 딴다**

```bash
git checkout main
git pull --ff-only
git checkout -b feature/f3-1-advice-content
```

- [ ] **Step 2: 고칠 문구가 있는지 확인한다**

```bash
grep -n "활성 규칙마다 도움·방해·중립이 각각 2개" docs/systems/INFORMATION_AND_DECEPTION.md
```

Expected: 1건. 0건이면 누가 먼저 고친 것이므로 멈추고 확인한다.

- [ ] **Step 3: 공용 사건의 유형 판정 근거를 적는다**

`## 유형과 생태 규칙` 절의 `### 중립` 소절 **뒤**, `같은 조언이라도 참조하는 규칙이` 문단 **앞**에 아래를 넣는다.

```markdown
### 공용 사건의 유형

공용 사건은 생태 규칙을 참조하지 않으므로 세 조언의 관계가 모두 `무관`이다. 그러면 유형을 관계로 정할 수 없다. 공용 사건은 **콘텐츠가 유형을 직접 선언하고**, 판단의 근거는 그 장면에만 있는 관찰 가능한 사실이 진다.

```text
상황  상인이 파는 물약이다. 병 바닥에 젖은 흙이 말라붙어 있고,
      상인은 물건을 건넬 때 자꾸 뒤를 돌아본다.

① 물약을 사서 부상자에게 먹이세요    방해 — 무덤에서 파낸 부장품이다
② 값을 깎아 식량만 사세요            도움
③ 거래를 거절하세요                  중립
```

**테마 전용 사건은 던전의 생태를 알아야 풀리고, 공용 사건은 그 장면을 자세히 읽어야 풀린다.** 두 종류의 주의력을 요구하므로 한 테마에서 31개를 만나도 단조롭지 않다.

상황 묘사에는 사실을 적고 결론을 적지 않는다. `상인은 물건을 건넬 때 자꾸 뒤를 돌아본다`는 사실이고 `이 상인은 도둑이다`는 결론이다.
```

- [ ] **Step 4: 셀 수 없는 공급 조건을 고친다**

같은 절 맨 끝의 아래 문장을 찾는다.

```markdown
같은 조언이라도 참조하는 규칙이 활성이 아닌 던전에서는 제시되지 않는다. 활성 규칙마다 도움·방해·중립이 각각 2개 이상 있어야 한다.
```

아래로 바꾼다.

```markdown
같은 조언이라도 참조하는 규칙이 활성이 아닌 던전에서는 제시되지 않는다.

공급은 이렇게 센다. 테마의 규칙마다 **그 규칙을 참조하는 도움 2개·방해 2개** 이상이 있어야 하고, **중립은 규칙과 무관하므로 테마 전체에 2개** 이상이면 된다. 중립은 참조 규칙이 없어 규칙별로 셀 수 있는 대상이 아니다.
```

- [ ] **Step 5: 강화판의 유형 제약과 결과 문구 조항을 넣는다**

`## 단서와 연계` 절에서 `강화판은 네 번째 선택지로 추가되지 않는다.`로 시작하는 문단 **뒤**에 아래를 넣는다.

```markdown
**강화판의 유형은 교체당하는 슬롯과 같아야 한다.** 도움 슬롯이 방해로 바뀌면 `도움·방해·중립 각 한 개씩`이 깨진다. 단서를 본 플레이어에게만 불변식이 다르게 적용될 이유가 없다. 강화판은 같은 유형의 더 강한 수단이다.
```

`## 조언 콘텐츠 계약` 절의 목록에서 `- 조언 3개. 각각 선택지 문구, 고블린의 근거 대사, 결과 문구를 가진다`를 아래로 바꾼다.

```markdown
- 조언 3개. 각각 선택지 문구, 고블린의 근거 대사, 결과 문구를 가진다
- 결과 문구는 **무슨 일이 왜 일어났는지** 드러낸다. `실패했다`가 아니라 `벽을 두드리자 진동이 굴을 타고 퍼진다. 옆 굴의 거미 한 마리가 더 다가온다`로 쓴다
```

- [ ] **Step 6: 문서가 스스로 모순되지 않는지 확인한다**

```bash
grep -n "활성 규칙마다 도움·방해·중립이 각각 2개" docs/systems/INFORMATION_AND_DECEPTION.md
```

Expected: 0건.

- [ ] **Step 7: 커밋한다**

```bash
git add docs/systems/INFORMATION_AND_DECEPTION.md
git commit -m "$(cat <<'EOF'
문서: 공용 사건의 유형 판정과 공급 계산을 고친다

공용 사건은 참조 규칙이 없어 관계로 유형을 정할 수 없었다. 콘텐츠가 유형을
직접 선언하고 상황 묘사의 관찰 가능한 사실이 근거를 지도록 적는다.

중립은 참조 규칙이 없어 규칙별로 셀 수 없다. 규칙별 도움·방해와 테마별 중립으로
공급 계산을 가른다. 강화판 유형 제약과 결과 문구 조항을 함께 넣는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 사건 하나의 구조를 검사한다

**Files:**
- Create: `lib/content/situation-validation.ts`
- Create: `lib/content/situation-validation.test.ts`

**Interfaces:**
- Consumes: `SituationEvent`·`AdviceOption`·`AdviceOutcome` (`@/lib/domain`)
- Produces: `validateSituationEvents(events: readonly SituationEvent[]): void` — 위반 시 `RuleError` throw, 통과하면 반환값 없음

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `lib/content/situation-validation.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { validateSituationEvents } from "@/lib/content/situation-validation";
import { RuleError } from "@/lib/domain";
import type {
  AdviceOption,
  AdviceOutcome,
  ChoiceId,
  EventId,
  SituationEvent,
} from "@/lib/domain";

/** 계약을 만족하는 공용 조언 하나. 테스트가 필요한 필드만 덮어쓴다. */
function advice(
  id: string,
  outcome: AdviceOutcome,
  overrides: Partial<AdviceOption> = {},
): AdviceOption {
  return {
    id: id as ChoiceId,
    label: "깨끗한 천을 찢어 새로 감으세요",
    line: "젖은 천은 상처에 안 좋다고 들었어!",
    outcome,
    relation: "unrelated",
    effectTags: ["support"],
    resultText: "새 천으로 감자 피가 멎는다.",
    ...overrides,
  };
}

/** 계약을 만족하는 공용 사건 하나. */
function sharedEvent(overrides: Partial<SituationEvent> = {}): SituationEvent {
  return {
    id: "shared-rest-wound" as EventId,
    kind: "rest",
    title: "벌어진 상처",
    description: "전사의 상처가 다시 벌어졌다. 붕대는 이미 검게 젖어 있다.",
    advice: [
      advice("a", "help"),
      advice("b", "harm"),
      advice("c", "neutral"),
    ],
    defaultResultText: "파티가 알아서 붕대를 고쳐 맨다.",
    ...overrides,
  };
}

describe("validateSituationEvents 구조", () => {
  it("계약을 만족하는 사건은 통과한다", () => {
    expect(() => validateSituationEvents([sharedEvent()])).not.toThrow();
  });

  it("조언이 3개가 아니면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [advice("a", "help"), advice("b", "harm")],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });

  it("유형이 한 개씩이 아니면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [advice("a", "help"), advice("b", "help"), advice("c", "neutral")],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });

  it("조언 ID가 사건 안에서 중복되면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [advice("a", "help"), advice("a", "harm"), advice("c", "neutral")],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });

  it.each<[string, Partial<SituationEvent>]>([
    ["제목", { title: "  " }],
    ["묘사", { description: "" }],
    ["기본 결과", { defaultResultText: "" }],
  ])("%s가 비어 있으면 생성 오류다", (_label, overrides) => {
    expect(() => validateSituationEvents([sharedEvent(overrides)])).toThrow(RuleError);
  });

  it.each<[string, Partial<AdviceOption>]>([
    ["선택지 문구", { label: "" }],
    ["근거 대사", { line: "   " }],
    ["결과 문구", { resultText: "" }],
  ])("조언의 %s가 비어 있으면 생성 오류다", (_label, overrides) => {
    const event = sharedEvent({
      advice: [
        advice("a", "help", overrides),
        advice("b", "harm"),
        advice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });

  it("생성 오류는 INVALID_GENERATION 코드를 쓴다", () => {
    const event = sharedEvent({ title: "" });
    try {
      validateSituationEvents([event]);
      throw new Error("오류가 나야 하는데 통과했다");
    } catch (error) {
      expect(error).toBeInstanceOf(RuleError);
      expect((error as RuleError).code).toBe("INVALID_GENERATION");
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm test -- situation-validation
```

Expected: FAIL — `@/lib/content/situation-validation`을 찾을 수 없다.

- [ ] **Step 3: 검증기를 만든다**

Create `lib/content/situation-validation.ts`:

```typescript
import { ADVICE_OUTCOMES, RuleError } from "@/lib/domain";
import type { AdviceOption, SituationEvent } from "@/lib/domain";

/** 사건 하나가 담는 조언 수. 도움·방해·중립을 한 개씩이다. */
const ADVICE_PER_EVENT = 3;

function invalid(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function requireText(
  value: string,
  message: string,
  details: Record<string, unknown>,
): void {
  if (value.trim() === "") invalid(message, details);
}

function validateAdviceText(option: AdviceOption, eventId: string): void {
  const details = { contentType: "advice", eventId, adviceId: option.id };
  requireText(option.label, `조언 문구가 비어 있다: ${option.id}`, details);
  requireText(option.line, `조언의 근거 대사가 비어 있다: ${option.id}`, details);
  requireText(option.resultText, `조언의 결과 문구가 비어 있다: ${option.id}`, details);
}

function validateAdviceSet(event: SituationEvent): void {
  const details = { contentType: "situationEvent", eventId: event.id };

  if (event.advice.length !== ADVICE_PER_EVENT) {
    invalid(`조언이 ${ADVICE_PER_EVENT}개가 아니다: ${event.id}`, {
      ...details,
      expected: ADVICE_PER_EVENT,
      actual: event.advice.length,
    });
  }

  const seenIds = new Set<string>();
  for (const option of event.advice) {
    if (seenIds.has(option.id)) {
      invalid(`조언 ID가 사건 안에서 중복된다: ${option.id}`, {
        ...details,
        adviceId: option.id,
      });
    }
    seenIds.add(option.id);
    validateAdviceText(option, event.id);
  }

  // 유형이 정확히 한 개씩인지. 개수만 세면 help 2개 + harm 1개도 3개라 통과한다.
  for (const outcome of ADVICE_OUTCOMES) {
    const count = event.advice.filter((option) => option.outcome === outcome).length;
    if (count !== 1) {
      invalid(`조언 유형 ${outcome}이 한 개가 아니다: ${event.id}`, {
        ...details,
        outcome,
        expected: 1,
        actual: count,
      });
    }
  }
}

/**
 * 조언 콘텐츠가 계약을 만족하는지 검사한다.
 *
 * 수량·문구·태그만 본다. 유형 판정, 수용·의심·적발 확률, 개인별 반응,
 * 보스 피해 보정은 규칙(E2)의 몫이다. 한 던전 안의 중복 방지는 배치(E3)가 한다.
 * docs/systems/INFORMATION_AND_DECEPTION.md
 */
export function validateSituationEvents(events: readonly SituationEvent[]): void {
  for (const event of events) {
    const details = { contentType: "situationEvent", eventId: event.id };
    requireText(event.title, `사건 제목이 비어 있다: ${event.id}`, details);
    requireText(event.description, `사건 묘사가 비어 있다: ${event.id}`, details);
    requireText(
      event.defaultResultText,
      `기본 결과 문구가 비어 있다: ${event.id}`,
      details,
    );
    validateAdviceSet(event);
  }
}
```

`AdviceOutcome`·`EcologyRelation`은 Task 3에서 처음 쓰므로 지금 import하지 않는다. 안 쓰는 import는 lint가 잡는다.

- [ ] **Step 4: 통과를 확인한다**

```bash
pnpm test -- situation-validation
pnpm lint
```

Expected: 테스트 PASS, lint 통과.

- [ ] **Step 5: 검사가 실제로 발동하는지 본다**

`validateAdviceSet`에서 유형 개수 검사 루프를 잠시 주석 처리하고 실행한다.

```bash
pnpm test -- situation-validation
```

Expected: `유형이 한 개씩이 아니면 생성 오류다`가 FAIL한다. 통과하면 그 검사가 작동하지 않는 것이므로 멈추고 원인을 찾는다.

확인했으면 주석을 되돌린다.

- [ ] **Step 6: 커밋한다**

```bash
git add lib/content/situation-validation.ts lib/content/situation-validation.test.ts
git commit -m "$(cat <<'EOF'
검증: 사건 하나의 조언 구조를 검사한다

조언 3개와 도움·방해·중립 각 한 개씩, 조언 ID 중복, 빈 문구를 본다. 개수만
세면 도움 2개도 3개라 통과하므로 유형별로 정확히 한 개인지 따로 센다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 테마 전용과 공용을 구분해 검사한다

**Files:**
- Modify: `lib/content/situation-validation.ts`
- Modify: `lib/content/situation-validation.test.ts`

**Interfaces:**
- Consumes: Task 2의 `validateSituationEvents`
- Produces: `theme` 유무로 갈리는 `relation`·`ruleId`·`bossDamageModifier` 검사

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`lib/content/situation-validation.test.ts` 끝에 덧붙인다. 파일 위쪽 import에 `RuleId`·`ThemeId`를 더한다.

```typescript
/** 계약을 만족하는 테마 전용 조언. */
function themedAdvice(
  id: string,
  outcome: AdviceOutcome,
  overrides: Partial<AdviceOption> = {},
): AdviceOption {
  const byOutcome = {
    help: { relation: "consistent" as const, ruleId: "spider-fire" as RuleId },
    harm: { relation: "contradictory" as const, ruleId: "spider-fire" as RuleId },
    neutral: { relation: "unrelated" as const, ruleId: undefined },
  };
  return advice(id, outcome, { ...byOutcome[outcome], ...overrides });
}

function themedEvent(overrides: Partial<SituationEvent> = {}): SituationEvent {
  return {
    id: "spider-webbed-hunter" as EventId,
    kind: "monster",
    theme: "spider" as ThemeId,
    title: "실에 걸린 사냥꾼",
    description: "바닥과 벽에는 오래된 거미줄이 잔뜩 붙어 있다.",
    advice: [
      themedAdvice("a", "help"),
      themedAdvice("b", "harm"),
      themedAdvice("c", "neutral"),
    ],
    defaultResultText: "파티가 알아서 거미를 밀어낸다.",
    ...overrides,
  };
}

describe("validateSituationEvents 테마 전용", () => {
  it("계약을 만족하는 테마 사건은 통과한다", () => {
    expect(() => validateSituationEvents([themedEvent()])).not.toThrow();
  });

  it("도움이 정합이 아니면 생성 오류다", () => {
    const event = themedEvent({
      advice: [
        themedAdvice("a", "help", { relation: "contradictory" }),
        themedAdvice("b", "harm"),
        themedAdvice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });

  it("방해가 모순이 아니면 생성 오류다", () => {
    const event = themedEvent({
      advice: [
        themedAdvice("a", "help"),
        themedAdvice("b", "harm", { relation: "consistent" }),
        themedAdvice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });

  it("정합·모순인데 참조 규칙이 없으면 생성 오류다", () => {
    const event = themedEvent({
      advice: [
        themedAdvice("a", "help", { ruleId: undefined }),
        themedAdvice("b", "harm"),
        themedAdvice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });

  it("무관인데 참조 규칙이 있으면 생성 오류다", () => {
    const event = themedEvent({
      advice: [
        themedAdvice("a", "help"),
        themedAdvice("b", "harm"),
        themedAdvice("c", "neutral", { ruleId: "spider-fire" as RuleId }),
      ],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });
});

describe("validateSituationEvents 공용", () => {
  it("공용 조언이 무관이 아니면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [
        advice("a", "help", { relation: "consistent", ruleId: "spider-fire" as RuleId }),
        advice("b", "harm"),
        advice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });

  it("공용 조언에 참조 규칙이 있으면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [
        advice("a", "help", { ruleId: "spider-fire" as RuleId }),
        advice("b", "harm"),
        advice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });

  it("공용 조언에 보스 피해 보정이 있으면 생성 오류다", () => {
    const event = sharedEvent({
      advice: [
        advice("a", "help", { bossDamageModifier: -0.2 }),
        advice("b", "harm"),
        advice("c", "neutral"),
      ],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm test -- situation-validation
```

Expected: `테마 전용`과 `공용` describe의 오류 기대 테스트들이 FAIL한다. 아직 검사가 없어 `not.toThrow`만 통과한다.

- [ ] **Step 3: 관계 검사를 더한다**

`lib/content/situation-validation.ts`의 import에 `AdviceOutcome`과 `EcologyRelation`을 더하고, `validateAdviceSet` **앞**에 아래를 넣는다.

```typescript
/** 테마 전용 사건에서 유형이 요구하는 관계. */
const REQUIRED_RELATION: Readonly<Record<AdviceOutcome, EcologyRelation>> = {
  help: "consistent",
  harm: "contradictory",
  neutral: "unrelated",
};

function validateThemedAdvice(option: AdviceOption, eventId: string): void {
  const details = { contentType: "advice", eventId, adviceId: option.id };
  const required = REQUIRED_RELATION[option.outcome];

  if (option.relation !== required) {
    invalid(`조언 유형과 규칙 관계가 맞지 않는다: ${option.id}`, {
      ...details,
      outcome: option.outcome,
      expected: required,
      actual: option.relation,
    });
  }

  // 정합·모순은 무엇에 대해 정합인지 가리켜야 한다. 무관은 가리킬 것이 없다.
  const needsRule = option.relation !== "unrelated";
  if (needsRule && option.ruleId === undefined) {
    invalid(`참조 규칙이 없다: ${option.id}`, { ...details, relation: option.relation });
  }
  if (!needsRule && option.ruleId !== undefined) {
    invalid(`무관한 조언이 참조 규칙을 갖는다: ${option.id}`, {
      ...details,
      ruleId: option.ruleId,
    });
  }
}

function validateSharedAdvice(option: AdviceOption, eventId: string): void {
  const details = { contentType: "advice", eventId, adviceId: option.id };

  // 공용 사건은 생태 규칙을 참조하지 않는다. 그것이 공용의 정의다.
  if (option.relation !== "unrelated") {
    invalid(`공용 조언의 관계가 무관이 아니다: ${option.id}`, {
      ...details,
      actual: option.relation,
    });
  }
  if (option.ruleId !== undefined) {
    invalid(`공용 조언이 참조 규칙을 갖는다: ${option.id}`, {
      ...details,
      ruleId: option.ruleId,
    });
  }
  // 보스는 테마에 속한다. 모든 테마에 나오는 사건이 특정 보스의 피해를 바꿀 수 없다.
  if (option.bossDamageModifier !== undefined) {
    invalid(`공용 조언이 보스 피해 보정을 갖는다: ${option.id}`, {
      ...details,
      bossDamageModifier: option.bossDamageModifier,
    });
  }
}
```

- [ ] **Step 4: 사건 검사에서 갈라 부른다**

`validateAdviceSet`의 `for (const option of event.advice)` 루프에서 `validateAdviceText(option, event.id);` 바로 뒤에 아래를 넣는다.

```typescript
    if (event.theme === undefined) {
      validateSharedAdvice(option, event.id);
    } else {
      validateThemedAdvice(option, event.id);
    }
```

- [ ] **Step 5: 통과를 확인한다**

```bash
pnpm test -- situation-validation
pnpm lint
pnpm typecheck
```

Expected: 전부 통과.

- [ ] **Step 6: 커밋한다**

```bash
git add lib/content/situation-validation.ts lib/content/situation-validation.test.ts
git commit -m "$(cat <<'EOF'
검증: 테마 전용과 공용의 규칙 관계를 갈라 검사한다

테마 전용은 도움이 정합, 방해가 모순이어야 하고 정합·모순은 참조 규칙을 가져야
한다. 공용은 셋 다 무관이고 참조 규칙과 보스 피해 보정을 가질 수 없다. 보스는
테마에 속하므로 모든 테마에 나오는 사건이 보스 피해를 바꿀 수 없다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 강화판을 검사한다

**Files:**
- Modify: `lib/content/situation-validation.ts`
- Modify: `lib/content/situation-validation.test.ts`

**Interfaces:**
- Consumes: Task 3의 `validateThemedAdvice`·`validateSharedAdvice`·`validateAdviceText`
- Produces: `upgrades`의 `slotIndex` 범위와 대체 조언의 유형 일치 검사

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`lib/content/situation-validation.test.ts` 끝에 덧붙인다. import에 `ClueId`를 더한다.

```typescript
describe("validateSituationEvents 강화판", () => {
  it("계약을 만족하는 강화판은 통과한다", () => {
    const event = themedEvent({
      upgrades: [
        {
          clueId: "spider-molt-seen" as ClueId,
          slotIndex: 0,
          replacement: themedAdvice("a-up", "help"),
        },
      ],
    });
    expect(() => validateSituationEvents([event])).not.toThrow();
  });

  it.each([-1, 3])("slotIndex가 %i이면 생성 오류다", (slotIndex) => {
    const event = themedEvent({
      upgrades: [
        {
          clueId: "spider-molt-seen" as ClueId,
          slotIndex,
          replacement: themedAdvice("a-up", "help"),
        },
      ],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });

  it("대체 조언의 유형이 원래 슬롯과 다르면 생성 오류다", () => {
    // 0번 슬롯은 도움인데 방해로 바꾸면 각 한 개씩이 깨진다.
    const event = themedEvent({
      upgrades: [
        {
          clueId: "spider-molt-seen" as ClueId,
          slotIndex: 0,
          replacement: themedAdvice("a-up", "harm"),
        },
      ],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });

  it("대체 조언의 문구가 비어 있으면 생성 오류다", () => {
    const event = themedEvent({
      upgrades: [
        {
          clueId: "spider-molt-seen" as ClueId,
          slotIndex: 0,
          replacement: themedAdvice("a-up", "help", { resultText: "" }),
        },
      ],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });

  it("공용 사건의 대체 조언도 공용 규칙을 따른다", () => {
    const event = sharedEvent({
      upgrades: [
        {
          clueId: "shared-clue" as ClueId,
          slotIndex: 0,
          replacement: advice("a-up", "help", { ruleId: "spider-fire" as RuleId }),
        },
      ],
    });
    expect(() => validateSituationEvents([event])).toThrow(RuleError);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm test -- situation-validation
```

Expected: `강화판` describe의 오류 기대 테스트 4개가 FAIL한다.

- [ ] **Step 3: 강화판 검사를 더한다**

`lib/content/situation-validation.ts`의 import에 `SituationEvent`가 이미 있다. `validateAdviceSet` **뒤**에 아래를 넣는다.

```typescript
function validateUpgrades(event: SituationEvent): void {
  if (event.upgrades === undefined) return;

  for (const upgrade of event.upgrades) {
    const details = {
      contentType: "adviceUpgrade",
      eventId: event.id,
      clueId: upgrade.clueId,
      slotIndex: upgrade.slotIndex,
    };

    if (
      !Number.isInteger(upgrade.slotIndex) ||
      upgrade.slotIndex < 0 ||
      upgrade.slotIndex >= ADVICE_PER_EVENT
    ) {
      invalid(`강화판의 slotIndex가 범위를 벗어난다: ${event.id}`, details);
    }

    const replaced = event.advice[upgrade.slotIndex];
    const replacement = upgrade.replacement;

    // 도움 슬롯을 방해로 바꾸면 각 한 개씩이 깨진다.
    // 단서를 본 플레이어에게만 불변식이 다르게 적용될 이유가 없다.
    if (replacement.outcome !== replaced.outcome) {
      invalid(`강화판의 유형이 교체할 슬롯과 다르다: ${event.id}`, {
        ...details,
        expected: replaced.outcome,
        actual: replacement.outcome,
      });
    }

    validateAdviceText(replacement, event.id);
    if (event.theme === undefined) {
      validateSharedAdvice(replacement, event.id);
    } else {
      validateThemedAdvice(replacement, event.id);
    }
  }
}
```

`validateSituationEvents`의 루프에서 `validateAdviceSet(event);` 뒤에 `validateUpgrades(event);`를 넣는다.

- [ ] **Step 4: 통과를 확인한다**

```bash
pnpm test -- situation-validation
pnpm lint
pnpm typecheck
```

Expected: 전부 통과.

- [ ] **Step 5: 커밋한다**

```bash
git add lib/content/situation-validation.ts lib/content/situation-validation.test.ts
git commit -m "$(cat <<'EOF'
검증: 강화판의 슬롯과 유형을 검사한다

slotIndex가 0·1·2이고 대체 조언의 유형이 교체할 슬롯과 같아야 한다. 도움
슬롯을 방해로 바꾸면 도움·방해·중립 각 한 개씩이 깨지기 때문이다. 대체 조언도
같은 문구·관계 검사를 통과해야 한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 모음 전체의 공급을 검사한다

**Files:**
- Modify: `lib/content/situation-validation.ts`
- Modify: `lib/content/situation-validation.test.ts`

**Interfaces:**
- Consumes: Task 2~4의 검사
- Produces: 사건 ID 전역 중복, 공용 분류별 하한, 규칙별 도움·방해 공급, 테마별 중립 공급

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`lib/content/situation-validation.test.ts` 끝에 덧붙인다.

```typescript
/** 규칙 하나에 도움·방해를 두 개씩 공급하는 테마 사건 묶음. */
function themedSupply(ruleId: string): SituationEvent[] {
  return [0, 1].map((n) =>
    themedEvent({
      id: `${ruleId}-event-${n}` as EventId,
      advice: [
        themedAdvice(`${ruleId}-h${n}`, "help", { ruleId: ruleId as RuleId }),
        themedAdvice(`${ruleId}-x${n}`, "harm", { ruleId: ruleId as RuleId }),
        themedAdvice(`${ruleId}-n${n}`, "neutral"),
      ],
    }),
  );
}

/** 분류마다 다섯 개씩인 공용 사건 15개. */
function sharedSupply(): SituationEvent[] {
  const kinds = ["rest", "merchant", "special"] as const;
  return kinds.flatMap((kind) =>
    [0, 1, 2, 3, 4].map((n) =>
      sharedEvent({
        id: `shared-${kind}-${n}` as EventId,
        kind,
        advice: [
          advice(`${kind}${n}-a`, "help"),
          advice(`${kind}${n}-b`, "harm"),
          advice(`${kind}${n}-c`, "neutral"),
        ],
      }),
    ),
  );
}

describe("validateSituationEvents 모음", () => {
  it("사건 ID가 중복되면 생성 오류다", () => {
    expect(() =>
      validateSituationEvents([sharedEvent(), sharedEvent()]),
    ).toThrow(RuleError);
  });

  it("공용 15개가 분류별 5개면 통과한다", () => {
    expect(() => validateSituationEvents(sharedSupply())).not.toThrow();
  });

  it("공용이 분류당 5개보다 적으면 생성 오류다", () => {
    const short = sharedSupply().filter((event) => event.id !== "shared-rest-4");
    expect(() => validateSituationEvents(short)).toThrow(RuleError);
  });

  it("공용이 분류당 5개보다 많아도 통과한다", () => {
    // 수량은 하한이다. F3-4가 30개로 늘려도 검증기가 깨지면 안 된다.
    const extra = [
      ...sharedSupply(),
      sharedEvent({ id: "shared-rest-5" as EventId, kind: "rest" }),
    ];
    expect(() => validateSituationEvents(extra)).not.toThrow();
  });

  it("규칙마다 도움·방해가 2개씩이면 통과한다", () => {
    expect(() =>
      validateSituationEvents([...sharedSupply(), ...themedSupply("spider-fire")]),
    ).not.toThrow();
  });

  it("규칙의 도움이 2개보다 적으면 생성 오류다", () => {
    const supply = themedSupply("spider-fire");
    const broken = supply.map((event, index) =>
      index === 0
        ? {
            ...event,
            advice: [
              // 도움을 다른 규칙으로 옮겨 spider-fire의 도움을 1개로 만든다.
              themedAdvice("moved-help", "help", { ruleId: "spider-shadow" as RuleId }),
              event.advice[1],
              event.advice[2],
            ],
          }
        : event,
    );
    expect(() =>
      validateSituationEvents([...sharedSupply(), ...broken]),
    ).toThrow(RuleError);
  });

  it("테마의 중립이 2개보다 적으면 생성 오류다", () => {
    const [first] = themedSupply("spider-fire");
    expect(() =>
      validateSituationEvents([...sharedSupply(), first]),
    ).toThrow(RuleError);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm test -- situation-validation
```

Expected: `모음` describe의 오류 기대 테스트들이 FAIL한다.

- [ ] **Step 3: 모음 검사를 더한다**

`lib/content/situation-validation.ts`의 import에 `EVENT_KINDS`와 `ThemeId`를 더하고, 상수와 함수를 아래처럼 넣는다.

```typescript
/**
 * 공용 사건의 분류별 하한.
 *
 * 상한이 아니다. 던전 하나가 6~8지점이고 네 분류가 각 1회 이상 보장되므로
 * 여유 지점이 한 분류로 몰리면 최대 5개가 필요하다. 정확히 5개를 요구하면
 * F3-4가 30개로 늘릴 때 검증기가 깨진다.
 */
const SHARED_EVENTS_PER_KIND_MIN = 5;

/** 규칙 하나가 공급해야 하는 도움·방해 수. */
const RULE_ADVICE_MIN = 2;

/** 테마 하나가 공급해야 하는 중립 수. 중립은 규칙에 매이지 않는다. */
const NEUTRAL_PER_THEME_MIN = 2;

function validateEventIds(events: readonly SituationEvent[]): void {
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) {
      invalid(`사건 ID가 중복된다: ${event.id}`, {
        contentType: "situationEvent",
        eventId: event.id,
      });
    }
    seen.add(event.id);
  }
}

function validateSharedSupply(events: readonly SituationEvent[]): void {
  const shared = events.filter((event) => event.theme === undefined);
  // monster는 전부 생태 규칙 위에서 판정되므로 공용일 수 없다.
  for (const kind of EVENT_KINDS) {
    if (kind === "monster") continue;
    const count = shared.filter((event) => event.kind === kind).length;
    if (count < SHARED_EVENTS_PER_KIND_MIN) {
      invalid(`공용 ${kind} 사건이 ${SHARED_EVENTS_PER_KIND_MIN}개 미만이다`, {
        contentType: "situationEvent",
        kind,
        expected: SHARED_EVENTS_PER_KIND_MIN,
        actual: count,
      });
    }
  }
}

function validateThemeSupply(events: readonly SituationEvent[]): void {
  const themed = events.filter((event) => event.theme !== undefined);
  const themes = new Set<ThemeId>(themed.map((event) => event.theme as ThemeId));

  for (const theme of themes) {
    const options = themed
      .filter((event) => event.theme === theme)
      .flatMap((event) => event.advice);

    const neutrals = options.filter((option) => option.outcome === "neutral").length;
    if (neutrals < NEUTRAL_PER_THEME_MIN) {
      invalid(`${theme} 테마의 중립 조언이 ${NEUTRAL_PER_THEME_MIN}개 미만이다`, {
        contentType: "advice",
        theme,
        expected: NEUTRAL_PER_THEME_MIN,
        actual: neutrals,
      });
    }

    // 던전이 규칙 6개 중 어느 3개를 활성으로 뽑아도 재료가 있어야 한다.
    const ruleIds = new Set(
      options.flatMap((option) => (option.ruleId === undefined ? [] : [option.ruleId])),
    );
    for (const ruleId of ruleIds) {
      for (const outcome of ["help", "harm"] as const) {
        const count = options.filter(
          (option) => option.ruleId === ruleId && option.outcome === outcome,
        ).length;
        if (count < RULE_ADVICE_MIN) {
          invalid(`규칙 ${ruleId}의 ${outcome} 조언이 ${RULE_ADVICE_MIN}개 미만이다`, {
            contentType: "advice",
            theme,
            ruleId,
            outcome,
            expected: RULE_ADVICE_MIN,
            actual: count,
          });
        }
      }
    }
  }
}
```

`validateSituationEvents`의 사건별 루프 **뒤**에 아래 세 줄을 넣는다.

```typescript
  validateEventIds(events);
  validateSharedSupply(events);
  validateThemeSupply(events);
```

- [ ] **Step 4: 통과를 확인한다**

```bash
pnpm test -- situation-validation
pnpm lint
pnpm typecheck
```

Expected: 전부 통과.

- [ ] **Step 5: 하한이 하한인지 확인한다**

`공용이 분류당 5개보다 많아도 통과한다` 테스트가 통과했는지 출력에서 직접 확인한다. 이 테스트가 없거나 실패하면 `F3-4`가 공용을 90개로 늘릴 때 검증기가 깨진다.

- [ ] **Step 6: 커밋한다**

```bash
git add lib/content/situation-validation.ts lib/content/situation-validation.test.ts
git commit -m "$(cat <<'EOF'
검증: 모음 전체의 사건 ID와 공급을 검사한다

사건 ID 전역 중복과 공용 분류별 하한 5개, 규칙마다 도움·방해 2개, 테마마다
중립 2개를 본다. 중립은 참조 규칙이 없어 규칙별로 셀 수 없으므로 테마 전체에서
센다. 수량은 하한이라 F3-4가 늘려도 깨지지 않는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 공용 휴식 사건 5개를 쓴다

**Files:**
- Create: `lib/content/shared-events.ts`
- Create: `lib/content/shared-events.test.ts`

**Interfaces:**
- Consumes: Task 2~5의 `validateSituationEvents`
- Produces: `SHARED_EVENTS: readonly SituationEvent[]`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `lib/content/shared-events.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { SHARED_EVENTS } from "@/lib/content/shared-events";

describe("SHARED_EVENTS", () => {
  it("휴식 사건이 5개다", () => {
    expect(SHARED_EVENTS.filter((event) => event.kind === "rest")).toHaveLength(5);
  });

  it("전부 공용이라 테마가 없다", () => {
    for (const event of SHARED_EVENTS) {
      expect(event.theme).toBeUndefined();
    }
  });

  it("묘사에 결론이 아니라 사실을 적는다", () => {
    // 묘사가 짧으면 관찰할 사실을 담지 못한다. 추론의 근거가 여기에만 있다.
    for (const event of SHARED_EVENTS) {
      expect(event.description.length).toBeGreaterThanOrEqual(20);
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm test -- shared-events
```

Expected: FAIL — `@/lib/content/shared-events`를 찾을 수 없다.

- [ ] **Step 3: 휴식 사건 5개를 쓴다**

Create `lib/content/shared-events.ts`:

```typescript
import type {
  AdviceOption,
  AdviceOutcome,
  ChoiceId,
  EventEffectTag,
  EventId,
  EventKind,
  SituationEvent,
} from "@/lib/domain";

function advice(
  id: string,
  outcome: AdviceOutcome,
  label: string,
  line: string,
  resultText: string,
  effectTags: readonly EventEffectTag[],
): AdviceOption {
  return {
    id: id as ChoiceId,
    label,
    line,
    outcome,
    relation: "unrelated",
    effectTags,
    resultText,
  };
}

function sharedEvent(
  id: string,
  kind: EventKind,
  title: string,
  description: string,
  advices: readonly AdviceOption[],
  defaultResultText: string,
): SituationEvent {
  return {
    id: id as EventId,
    kind,
    title,
    description,
    advice: advices,
    defaultResultText,
  };
}

/**
 * 공용 사건. 생태 규칙을 참조하지 않으므로 모든 테마의 던전에 나온다.
 *
 * 유형은 콘텐츠가 직접 선언하고, 판단의 근거는 상황 묘사의 관찰 가능한 사실이
 * 진다. 묘사에는 사실을 적고 결론을 적지 않는다. `상인이 자꾸 뒤를 돌아본다`는
 * 사실이고 `이 상인은 도둑이다`는 결론이다.
 * docs/superpowers/specs/2026-08-20-lattebun-f3-1-advice-content-contract-design.md
 */
const REST_EVENTS: readonly SituationEvent[] = [
  sharedEvent(
    "shared-rest-wound",
    "rest",
    "벌어진 상처",
    "전사의 상처가 다시 벌어졌다. 감아둔 천은 이미 검게 젖었고, 물통은 절반이 비어 있다.",
    [
      advice(
        "shared-rest-wound-a",
        "help",
        "마른 천을 찢어 새로 감으라고 하세요",
        "젖은 천은 상처에 안 좋다고 들었어!",
        "마른 천으로 다시 감자 배어나오던 피가 멎는다.",
        ["support"],
      ),
      advice(
        "shared-rest-wound-b",
        "harm",
        "남은 물을 상처에 부어 씻으라고 하세요",
        "깨끗이 씻어내면 낫지 않을까!",
        "물통이 바닥을 드러낸다. 젖은 천은 그대로고, 남은 길에 마실 물이 없다.",
        ["sabotage"],
      ),
      advice(
        "shared-rest-wound-c",
        "neutral",
        "잠시 앉아 쉬라고 하세요",
        "일단 좀 앉아 있어!",
        "숨은 돌렸지만 상처는 그대로다.",
        ["rest"],
      ),
    ],
    "전사가 알아서 천을 고쳐 감는다. 시간이 조금 지난다.",
  ),
  sharedEvent(
    "shared-rest-fire",
    "rest",
    "마른 장작",
    "불을 피울 만한 마른 장작이 쌓여 있다. 통로 안쪽에서 바람이 꾸준히 불어 나온다.",
    [
      advice(
        "shared-rest-fire-a",
        "help",
        "바람이 나오는 쪽을 등지고 불을 피우라고 하세요",
        "연기가 안으로 들어가면 곤란하잖아!",
        "연기가 통로 밖으로 빠진다. 파티가 온기를 쬐고 체온을 회복한다.",
        ["rest"],
      ),
      advice(
        "shared-rest-fire-b",
        "harm",
        "통로 한가운데에 불을 피우라고 하세요",
        "가운데가 제일 따뜻하지!",
        "바람이 연기를 안쪽으로 밀어 넣는다. 파티가 기침을 하고, 안쪽 어딘가에서 무언가 움직이는 소리가 난다.",
        ["sabotage"],
      ),
      advice(
        "shared-rest-fire-c",
        "neutral",
        "불 없이 그냥 쉬라고 하세요",
        "불은 위험할 수도 있으니까!",
        "어둠 속에서 잠시 쉰다. 춥지만 아무 일도 없다.",
        ["rest"],
      ),
    ],
    "파티가 장작을 그냥 지나친다.",
  ),
  sharedEvent(
    "shared-rest-ration",
    "rest",
    "마지막 이틀치",
    "식량이 이틀치 남았다. 도적은 아까부터 자기 몫을 조금씩 아껴 주머니에 넣고 있다.",
    [
      advice(
        "shared-rest-ration-a",
        "help",
        "오늘 몫만 꺼내 나누라고 하세요",
        "내일 것도 있어야 하잖아!",
        "각자 한 끼씩 나눈다. 내일 몫이 그대로 남는다.",
        ["support"],
      ),
      advice(
        "shared-rest-ration-b",
        "harm",
        "오늘 다 먹고 힘을 내라고 하세요",
        "잘 먹어야 잘 싸우지!",
        "배는 불렀다. 다음 날 아무도 먹을 것이 없어 파티 전원이 힘을 쓰지 못한다.",
        ["sabotage"],
      ),
      advice(
        "shared-rest-ration-c",
        "neutral",
        "각자 알아서 먹으라고 하세요",
        "알아서들 하겠지!",
        "도적은 아꼈고 나머지는 먹었다. 총량은 그대로다.",
        ["observe"],
      ),
    ],
    "파티가 각자 조금씩 꺼내 먹는다.",
  ),
  sharedEvent(
    "shared-rest-watch",
    "rest",
    "불침번",
    "셋 다 지쳐 있다. 성직자는 앉은 채로 고개가 자꾸 앞으로 꺾인다.",
    [
      advice(
        "shared-rest-watch-a",
        "help",
        "가장 멀쩡한 사람에게 불침번을 맡기라고 하세요",
        "제일 쌩쌩한 사람이 서야지!",
        "깨어 있는 눈이 하나 남는다. 파티가 방해 없이 회복한다.",
        ["support"],
      ),
      advice(
        "shared-rest-watch-b",
        "harm",
        "성직자에게 불침번을 맡기라고 하세요",
        "성직자는 기도하면서 깨어 있을 수 있잖아!",
        "성직자가 곧 잠든다. 아무도 깨어 있지 않은 사이 짐이 헤집어졌다.",
        ["sabotage"],
      ),
      advice(
        "shared-rest-watch-c",
        "neutral",
        "돌아가며 짧게 서라고 하세요",
        "조금씩 나눠서 서면 되지!",
        "셋 다 선잠을 잤다. 아무 일도 없었지만 피로가 덜 풀렸다.",
        ["rest"],
      ),
    ],
    "파티가 알아서 순번을 정한다.",
  ),
  sharedEvent(
    "shared-rest-water",
    "rest",
    "고인 물",
    "벽을 타고 흘러내린 물이 바닥 웅덩이에 고여 있다. 고인 자리에는 벌레 몇 마리가 떠 있고, 벽에서는 아직 물이 흐른다.",
    [
      advice(
        "shared-rest-water-a",
        "help",
        "벽에서 흐르는 물을 받으라고 하세요",
        "흐르는 물이 낫지 않겠어?",
        "흐르는 물을 받아 물통을 채운다. 맛이 나쁘지 않다.",
        ["support"],
      ),
      advice(
        "shared-rest-water-b",
        "harm",
        "웅덩이 물을 그대로 뜨라고 하세요",
        "여기가 뜨기 편하잖아!",
        "고인 물을 마신 파티원들이 얼마 지나지 않아 배를 움켜쥔다.",
        ["sabotage"],
      ),
      advice(
        "shared-rest-water-c",
        "neutral",
        "물은 건드리지 말라고 하세요",
        "괜히 탈 나면 곤란하니까!",
        "물통은 그대로다. 아무 일도 없다.",
        ["observe"],
      ),
    ],
    "파티가 물을 살펴보다 그냥 지나친다.",
  ),
];

export const SHARED_EVENTS: readonly SituationEvent[] = [...REST_EVENTS];
```

- [ ] **Step 4: 통과를 확인한다**

```bash
pnpm test -- shared-events
```

Expected: `휴식 사건이 5개다`·`전부 공용이라 테마가 없다`·`묘사에 결론이 아니라 사실을 적는다` PASS.

- [ ] **Step 5: 커밋한다**

```bash
git add lib/content/shared-events.ts lib/content/shared-events.test.ts
git commit -m "$(cat <<'EOF'
콘텐츠: 공용 휴식 사건 5개를 쓴다

젖은 천·바람·남은 식량·졸고 있는 성직자·고인 물처럼 그 장면에서 관찰되는
사실이 답을 정한다. 결과 문구는 무슨 일이 왜 일어났는지 드러낸다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 공용 상인 사건 5개를 쓴다

**Files:**
- Modify: `lib/content/shared-events.ts`
- Modify: `lib/content/shared-events.test.ts`

**Interfaces:**
- Consumes: Task 6의 `advice`·`sharedEvent` 헬퍼와 `SHARED_EVENTS`
- Produces: `SHARED_EVENTS`에 상인 5개 추가

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`lib/content/shared-events.test.ts`의 `describe` 안에 넣는다.

```typescript
  it("상인 사건이 5개다", () => {
    expect(SHARED_EVENTS.filter((event) => event.kind === "merchant")).toHaveLength(5);
  });
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm test -- shared-events
```

Expected: FAIL — 0개인데 5개를 기대한다.

- [ ] **Step 3: 상인 사건 5개를 쓴다**

`lib/content/shared-events.ts`의 `REST_EVENTS` 뒤에 넣는다.

```typescript
const MERCHANT_EVENTS: readonly SituationEvent[] = [
  sharedEvent(
    "shared-merchant-potion",
    "merchant",
    "젖은 흙이 묻은 병",
    "상인이 물약을 판다. 병 바닥에 젖은 흙이 말라붙어 있고, 상인은 물건을 건넬 때마다 자꾸 뒤를 돌아본다.",
    [
      advice(
        "shared-merchant-potion-a",
        "help",
        "물약은 두고 식량만 값을 깎아 사라고 하세요",
        "먹을 것부터 챙기는 게 낫지!",
        "값을 깎아 식량을 산다. 골드가 덜 나갔다.",
        ["trade"],
      ),
      advice(
        "shared-merchant-potion-b",
        "harm",
        "물약을 사서 부상자에게 먹이라고 하세요",
        "약이 있으면 먹여야지!",
        "병을 비운 부상자가 곧 토한다. 오래 묻혀 있던 물약이었다.",
        ["sabotage"],
      ),
      advice(
        "shared-merchant-potion-c",
        "neutral",
        "거래를 거절하라고 하세요",
        "지금은 됐어!",
        "상인이 어깨를 으쓱하고 짐을 챙긴다.",
        ["observe"],
      ),
    ],
    "파티가 값을 흥정하다 그냥 돌아선다.",
  ),
  sharedEvent(
    "shared-merchant-scale",
    "merchant",
    "저울",
    "상인이 값을 저울로 단다. 저울 한쪽 접시 밑에 검은 자국이 눌어붙어 있고, 그쪽만 유난히 빨리 내려앉는다.",
    [
      advice(
        "shared-merchant-scale-a",
        "help",
        "접시를 바꿔 다시 달아보라고 하세요",
        "양쪽 바꿔서 재보면 되잖아!",
        "접시를 바꾸자 무게가 달라진다. 상인이 말없이 값을 낮춘다.",
        ["trade"],
      ),
      advice(
        "shared-merchant-scale-b",
        "harm",
        "상인의 저울을 믿고 값을 치르라고 하세요",
        "저울이 거짓말하겠어?",
        "무거운 쪽 접시에 납이 붙어 있었다. 파티가 실제보다 많은 골드를 냈다.",
        ["sabotage"],
      ),
      advice(
        "shared-merchant-scale-c",
        "neutral",
        "흥정하지 말고 부른 값에 사라고 하세요",
        "그냥 빨리 끝내자!",
        "값을 그대로 치른다. 시간은 벌었다.",
        ["trade"],
      ),
    ],
    "파티가 저울을 힐끔 보고 거래를 접는다.",
  ),
  sharedEvent(
    "shared-merchant-credit",
    "merchant",
    "외상 계약",
    "상인이 지금 돈이 없어도 된다며 종이를 내민다. 아래쪽 몇 줄은 위쪽보다 글씨가 눈에 띄게 작다.",
    [
      advice(
        "shared-merchant-credit-a",
        "help",
        "작은 글씨를 소리 내어 읽어달라고 하세요",
        "이 밑에 뭐라고 쓴 건지 좀 읽어줘!",
        "상인이 머뭇거리다 조항을 읽는다. 파티가 서명을 미룬다.",
        ["information"],
      ),
      advice(
        "shared-merchant-credit-b",
        "harm",
        "서명하고 물건을 받으라고 하세요",
        "지금 안 내도 된다잖아!",
        "작은 글씨는 이자 조항이었다. 갚아야 할 골드가 불어난다.",
        ["sabotage"],
      ),
      advice(
        "shared-merchant-credit-c",
        "neutral",
        "다음에 오겠다고 하세요",
        "다음에 보자고!",
        "상인이 종이를 접는다. 아무것도 얻지 못했다.",
        ["observe"],
      ),
    ],
    "파티가 종이를 들여다보다 돌려준다.",
  ),
  sharedEvent(
    "shared-merchant-scout",
    "merchant",
    "앞길을 안다는 자",
    "앞쪽 길을 잘 안다며 값을 부르는 자가 있다. 던전 안쪽은 온통 젖은 진흙인데 그의 신발은 깨끗하다.",
    [
      advice(
        "shared-merchant-scout-a",
        "help",
        "값을 치르기 전에 무엇을 봤는지 먼저 말해보라고 하세요",
        "먼저 좀 들어보고 결정하자!",
        "그가 얼버무린다. 파티가 골드를 아꼈다.",
        ["information"],
      ),
      advice(
        "shared-merchant-scout-b",
        "harm",
        "값을 치르고 앞길 이야기를 사라고 하세요",
        "정보가 있으면 사야지!",
        "그가 말한 길은 실제와 달랐다. 파티가 헛걸음하고 골드도 잃었다.",
        ["sabotage"],
      ),
      advice(
        "shared-merchant-scout-c",
        "neutral",
        "그냥 지나치라고 하세요",
        "우리끼리 가자!",
        "그가 뒤에서 뭐라고 외치지만 파티는 돌아보지 않는다.",
        ["observe"],
      ),
    ],
    "파티가 값이 비싸다며 손을 젓는다.",
  ),
  sharedEvent(
    "shared-merchant-barter",
    "merchant",
    "이름표",
    "상인이 물자와 바꾸자며 파티의 짐을 살핀다. 파티가 챙겨 나온 유품에는 아직 주인의 이름표가 달려 있다.",
    [
      advice(
        "shared-merchant-barter-a",
        "help",
        "유품 말고 여분의 무기를 내주라고 하세요",
        "무기는 남으니까 그걸 주자!",
        "여분 무기와 물자를 바꾼다. 유품은 그대로 남았다.",
        ["trade"],
      ),
      advice(
        "shared-merchant-barter-b",
        "harm",
        "유품을 이름표째 넘기라고 하세요",
        "어차피 주인은 없잖아!",
        "이름표가 달린 유품이 시장에 돌았다. 길드에 소문이 들어가 명성이 깎인다.",
        ["sabotage"],
      ),
      advice(
        "shared-merchant-barter-c",
        "neutral",
        "교환하지 말라고 하세요",
        "지금은 바꿀 게 없어!",
        "상인이 짐을 다시 묶는다.",
        ["observe"],
      ),
    ],
    "파티가 짐을 뒤적이다 그만둔다.",
  ),
];
```

파일 맨 아래의 `SHARED_EVENTS`를 아래로 바꾼다.

```typescript
export const SHARED_EVENTS: readonly SituationEvent[] = [
  ...REST_EVENTS,
  ...MERCHANT_EVENTS,
];
```

- [ ] **Step 4: 통과를 확인한다**

```bash
pnpm test -- shared-events
```

Expected: 전부 PASS.

- [ ] **Step 5: 커밋한다**

```bash
git add lib/content/shared-events.ts lib/content/shared-events.test.ts
git commit -m "$(cat <<'EOF'
콘텐츠: 공용 상인 사건 5개를 쓴다

젖은 흙이 묻은 병·눌어붙은 저울·작은 글씨·깨끗한 신발·이름표가 답을 정한다.
상인이 파는 것이 무엇인지는 값이 아니라 물건에 남은 흔적이 말한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 공용 특수 사건 5개를 쓰고 계약을 통과시킨다

**Files:**
- Modify: `lib/content/shared-events.ts`
- Modify: `lib/content/shared-events.test.ts`

**Interfaces:**
- Consumes: Task 6·7의 헬퍼, Task 5의 `validateSituationEvents`
- Produces: 공용 15개 완성. `F3-2`가 이 배열에 테마 사건을 더해 검증한다

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`lib/content/shared-events.test.ts`의 `describe` 안에 넣는다.

```typescript
파일 위쪽 import에 검증기를 더한다.

```typescript
import { validateSituationEvents } from "@/lib/content/situation-validation";
```

`describe` 안에 세 테스트를 넣는다.

```typescript
  it("특수 사건이 5개다", () => {
    expect(SHARED_EVENTS.filter((event) => event.kind === "special")).toHaveLength(5);
  });

  it("모두 15개다", () => {
    expect(SHARED_EVENTS).toHaveLength(15);
  });

  it("검증기를 통과한다", () => {
    expect(() => validateSituationEvents(SHARED_EVENTS)).not.toThrow();
  });
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm test -- shared-events
```

Expected: FAIL — 특수 사건 0개, 전체 10개, 검증기가 `공용 special 사건이 5개 미만이다`를 던진다.

- [ ] **Step 3: 특수 사건 5개를 쓴다**

`lib/content/shared-events.ts`의 `MERCHANT_EVENTS` 뒤에 넣는다.

```typescript
const SPECIAL_EVENTS: readonly SituationEvent[] = [
  sharedEvent(
    "shared-special-scrawl",
    "special",
    "벽의 낙서",
    "벽에 누군가 급하게 새긴 글씨가 있다. `셋을 두고 혼자 나오면 몫이 는다.` 글씨 아래에는 마른 핏자국이 번져 있다.",
    [
      advice(
        "shared-special-scrawl-a",
        "help",
        "글씨를 파티에게 보여주세요",
        "이런 게 적혀 있는데, 봐둬야 하지 않겠어?",
        "파티가 글씨를 읽고 서로를 한 번씩 본다. 경계심이 올라가지만 길잡이를 향하지는 않는다.",
        ["information"],
      ),
      advice(
        "shared-special-scrawl-b",
        "harm",
        "글씨를 문질러 지우세요",
        "지저분한 낙서네, 지워버리자!",
        "글씨를 지우는 손을 성직자가 뒤에서 본다. 왜 지웠는지 묻는 눈이다.",
        ["sabotage"],
      ),
      advice(
        "shared-special-scrawl-c",
        "neutral",
        "못 본 척 지나가세요",
        "가자, 갈 길이 멀어!",
        "파티가 벽을 지나친다. 아무도 글씨를 읽지 않았다.",
        ["observe"],
      ),
    ],
    "파티가 벽의 글씨를 흘깃 보고 지나간다.",
  ),
  sharedEvent(
    "shared-special-camp",
    "special",
    "남겨진 야영지",
    "앞선 원정대의 야영 자리다. 짐과 담요가 그대로 펼쳐져 있고 불도 아직 온기가 남았는데, 사람은 하나도 없다.",
    [
      advice(
        "shared-special-camp-a",
        "help",
        "짐을 살펴 무슨 일이 있었는지 알아보라고 하세요",
        "왜 다 두고 갔는지부터 알아야지!",
        "끌린 자국이 안쪽으로 이어져 있다. 파티가 그 방향을 피해 간다.",
        ["information"],
      ),
      advice(
        "shared-special-camp-b",
        "harm",
        "짐을 챙겨 나눠 가지라고 하세요",
        "임자 없는 물건인데 챙겨야지!",
        "짐을 들자 매어둔 줄이 딸려 올라간다. 안쪽에서 무언가가 이쪽으로 오는 소리가 난다.",
        ["sabotage"],
      ),
      advice(
        "shared-special-camp-c",
        "neutral",
        "건드리지 말고 지나가라고 하세요",
        "손대지 말자, 찜찜해!",
        "파티가 야영지를 크게 돌아 지나간다.",
        ["observe"],
      ),
    ],
    "파티가 야영지를 둘러보다 아무것도 만지지 않고 떠난다.",
  ),
  sharedEvent(
    "shared-special-tripwire",
    "special",
    "팽팽한 줄",
    "바닥 판에서 이어진 가는 줄이 천장으로 올라간다. 줄은 손대지 않았는데도 팽팽하게 당겨져 있다.",
    [
      advice(
        "shared-special-tripwire-a",
        "help",
        "판을 밟지 말고 벽을 짚어 돌아가라고 하세요",
        "저 판만 안 밟으면 되잖아!",
        "파티가 벽을 짚고 판을 돌아간다. 줄은 그대로 팽팽하다.",
        ["support"],
      ),
      advice(
        "shared-special-tripwire-b",
        "harm",
        "줄을 끊으라고 하세요",
        "줄만 끊으면 안전하지 않을까!",
        "팽팽하던 줄이 끊기며 천장의 무게가 풀린다. 돌덩이가 통로로 쏟아진다.",
        ["sabotage"],
      ),
      advice(
        "shared-special-tripwire-c",
        "neutral",
        "판 위에 돌을 올려 무게를 맞추라고 하세요",
        "무게만 유지하면 되는 거 아냐?",
        "돌을 올리고 조심스럽게 지난다. 시간이 오래 걸렸지만 무사하다.",
        ["observe"],
      ),
    ],
    "파티가 줄을 피해 한 명씩 조심스럽게 지나간다.",
  ),
  sharedEvent(
    "shared-special-contract",
    "special",
    "계약서 사본",
    "파티가 길드에서 받은 계약서 사본을 펴 본다. 보상 항목 옆에 다른 글씨보다 작게 `생환 시`라고 덧붙어 있다.",
    [
      advice(
        "shared-special-contract-a",
        "help",
        "그 조항을 짚어 알려주세요",
        "여기 이렇게 적혀 있는데, 알고는 있어야지!",
        "파티가 조항을 확인한다. 무리하지 않기로 뜻을 모은다.",
        ["information"],
      ),
      advice(
        "shared-special-contract-b",
        "harm",
        "손으로 그 줄을 가린 채 넘기세요",
        "별거 아니야, 다음 장 보자!",
        "파티가 조항을 못 본 채 계약을 믿는다. 나중에 보상이 나오지 않는 이유를 알게 된다.",
        ["sabotage"],
      ),
      advice(
        "shared-special-contract-c",
        "neutral",
        "계약서 이야기는 꺼내지 마세요",
        "그건 나중에 보고!",
        "계약서가 다시 접힌다. 아무도 조항을 읽지 않았다.",
        ["observe"],
      ),
    ],
    "파티가 계약서를 대충 훑고 도로 넣는다.",
  ),
  sharedEvent(
    "shared-special-chasm",
    "special",
    "갈라진 바닥",
    "바닥이 길게 갈라져 아래가 보이지 않는다. 던져 넣은 돌이 한참 뒤에야 소리를 낸다. 건너편까지는 두 걸음 남짓이다.",
    [
      advice(
        "shared-special-chasm-a",
        "help",
        "밧줄로 서로를 묶고 건너라고 하세요",
        "묶어두면 하나가 미끄러져도 붙잡지!",
        "두 번째 사람이 미끄러졌지만 밧줄에 걸려 올라온다.",
        ["support"],
      ),
      advice(
        "shared-special-chasm-b",
        "harm",
        "짐을 진 채로 한 명씩 뛰어 건너라고 하세요",
        "두 걸음이면 그냥 뛰어도 되잖아!",
        "짐 무게에 발이 밀린다. 마지막 사람이 가장자리를 놓쳐 벽에 부딪히며 떨어질 뻔한다.",
        ["sabotage"],
      ),
      advice(
        "shared-special-chasm-c",
        "neutral",
        "돌아가는 길을 찾아보라고 하세요",
        "굳이 여기로 안 가도 되지 않아?",
        "돌아가는 길을 찾았다. 시간이 걸렸지만 아무도 다치지 않았다.",
        ["observe"],
      ),
    ],
    "파티가 서로 눈치를 보다 한 명씩 조심히 건넌다.",
  ),
];
```

파일 맨 아래의 `SHARED_EVENTS`를 아래로 바꾼다.

```typescript
export const SHARED_EVENTS: readonly SituationEvent[] = [
  ...REST_EVENTS,
  ...MERCHANT_EVENTS,
  ...SPECIAL_EVENTS,
];
```

- [ ] **Step 4: 통과를 확인한다**

```bash
pnpm test -- shared-events
```

Expected: 전부 PASS. 특히 `검증기를 통과한다`가 통과해야 한다.

- [ ] **Step 5: 검증기가 이 콘텐츠에 실제로 발동하는지 본다**

`lib/content/shared-events.ts`에서 `shared-rest-wound`의 `defaultResultText`를 빈 문자열로 잠시 바꾸고 실행한다.

```bash
pnpm test -- shared-events
```

Expected: `검증기를 통과한다`가 FAIL한다. 통과하면 검증기가 이 배열을 보지 않는 것이므로 멈추고 원인을 찾는다.

확인했으면 되돌린다.

- [ ] **Step 6: 네 명령을 모두 돌린다**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 넷 다 통과.

- [ ] **Step 7: 커밋한다**

```bash
git add lib/content/shared-events.ts lib/content/shared-events.test.ts
git commit -m "$(cat <<'EOF'
콘텐츠: 공용 특수 사건 5개를 쓰고 15개를 채운다

낙서 아래 핏자국·온기가 남은 야영지·이미 팽팽한 줄·작게 덧붙은 생환 조항·
한참 뒤에 나는 돌 소리가 답을 정한다. 공용 15개가 검증기를 통과한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 배정표를 갱신하고 PR을 만든다

**Files:**
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Task 1~8의 결과
- Produces: `F3-4`·`F3-5` 항목. `F3-1` 완료 표시

- [ ] **Step 1: main의 최신 표를 확인한다**

배정표 ID는 팀원이 동시에 선점한다. 새 ID를 붙이기 전에 표를 다시 읽는다.

```bash
git fetch origin
git log --oneline HEAD..origin/main | cat
grep -n "^| F3-" docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
```

`F3-4`·`F3-5`가 이미 있으면 멈추고 비어 있는 다음 번호를 쓴다.

- [ ] **Step 2: `F3-1`을 완료 처리하고 확장 항목을 넣는다**

`F3-1` 행의 담당을 `LatteBun`, 상태를 `✅`로 바꾼다. `F3-2`·`F3-3` 행의 `선행`에서 `F3-1`을 지우고 `—`로 바꾼다.

`F3-3` 행 뒤에 두 행을 넣는다.

```markdown
| F3-4 | 공용 사건 확장 | 공용 사건이 `rest`·`merchant`·`special` 각 30개로 늘고 검증기를 그대로 통과하며, 사건 ID·문구 중복이 없음 | — | — |  | ⬜ |
| F3-5 | 테마 전용 사건 확장 | 테마마다 전용 사건이 30개로 늘고 규칙별 도움·방해 공급과 테마별 중립 공급을 그대로 만족 | F3-2 F3-3 | — |  | ⬜ |
```

- [ ] **Step 3: 의존성 그래프와 항목 수를 고친다**

```mermaid 블록의 `L1["기반"]` subgraph에서 `F3-3["F3-3 사막·묘지"]` 뒤에 두 줄을 넣는다.

```text
    F3-4["F3-4 공용 확장"]
    F3-5["F3-5 테마 확장"]
```

간선 목록의 `F3-3 --> E2 & E3` 뒤에 한 줄을 넣는다.

```text
  F3-2 & F3-3 --> F3-5
```

`아래 41개 항목을 모두 완료하면`을 `아래 43개 항목을 모두 완료하면`으로 바꾼다.

- [ ] **Step 4: 시작 가능한 작업을 갱신한다**

`### 시작 가능한 작업` 절의 두 문단을 아래로 바꾼다.

```markdown
문서 계층이 끝났고 `D9`·`F1-2`가 조언·사건 계약을 문서와 타입 양쪽에 놓았다. `F3-1`이 검증기와 공용 사건을 채워 `F3-2`·`F3-3`의 선행도 풀렸다.

지금 시작 가능한 것은 대표 화면 이미지 작업(`D8`), **조언 콘텐츠 거미굴(`F3-2`)**, 사막·묘지(`F3-3`), 공용 사건 확장(`F3-4`), 아이템 콘텐츠(`F5`), 게시판·편성(`C2`), 위험도별 지도(`E1`), 인트로 화면(`U2`)이다. 서로 파일이 겹치지 않는다.

`F3-2`가 임계 경로에 있으므로 먼저 잡는 것이 좋다. `F3-4`는 선행이 없고 데이터만 더하므로 언제든 병렬로 할 수 있다.
```

- [ ] **Step 5: 무결성 검사와 전체 테스트를 돌린다**

```bash
pnpm test -- CAMPAIGN_REWORK
pnpm test
```

Expected: 둘 다 PASS.

- [ ] **Step 6: 커밋하고 PR을 만든다**

```bash
git add docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "$(cat <<'EOF'
배정표: F3-1을 완료 처리하고 콘텐츠 확장 항목을 연다

검증기와 공용 15개가 끝나 F3-2·F3-3의 선행이 풀렸다. 수량의 하한과 목표를
나눈 결과로 F3-4·F3-5를 임계 경로 밖에 신설한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"

git push -u origin feature/f3-1-advice-content
gh pr create --title "F3-1: 조언 콘텐츠 계약·검증기와 공용 사건 15개" --body "$(cat <<'EOF'
## 무엇을 했나

[F3-1 설계](docs/superpowers/specs/2026-08-20-lattebun-f3-1-advice-content-contract-design.md)를 구현했다.

- 계약의 모순 둘을 문서에서 고쳤다 — 공용 사건의 유형 판정 근거, 셀 수 없던 중립 공급 계산
- `validateSituationEvents` 검증기를 놓았다
- 공용 사건 15개(`rest`·`merchant`·`special` 각 5개)를 썼다
- `F3-4`·`F3-5`를 신설하고 `F3-1`을 완료 처리했다

## 설계의 중심

> 테마 전용 사건은 던전의 생태를 알아야 풀리고, **공용 사건은 그 장면을 자세히 읽어야 풀린다.**

공용 사건은 참조할 생태 규칙이 없다. 대신 그 장면에만 있는 관찰 가능한 사실이 답을 정한다. 젖은 흙이 묻은 병, 이미 팽팽한 줄, 온기가 남은 야영지 같은 것들이다.

## 검증기가 보는 것

사건마다 조언 3개와 도움·방해·중립 각 한 개, 빈 문구, 조언 ID 중복. 테마 전용은 유형과 규칙 관계의 정합, 공용은 셋 다 무관에 참조 규칙과 보스 보정 없음. 강화판은 슬롯 범위와 **유형이 원래 슬롯과 같은지**.

모음 전체로는 사건 ID 중복, 공용 분류별 하한 5개, 규칙마다 도움·방해 2개, 테마마다 중립 2개.

**공용 수량은 하한이다.** 정확히 15개를 요구하면 `F3-4`가 90개로 늘릴 때 검증기가 깨진다.

## 검증

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] 유형 개수 검사를 꺼서 테스트가 잡는지 확인 후 복구
- [x] `defaultResultText`를 비워 콘텐츠 테스트가 잡는지 확인 후 복구

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 이 계획이 다루지 않는 것

| 항목 | 어디서 |
| --- | --- |
| 테마 전용 사건 | `F3-2`(거미굴) · `F3-3`(사막·묘지) |
| 공용·테마 사건 확장 | `F3-4` · `F3-5` |
| 사건 배치, 분류 균형, 한 던전 안 중복 방지 | `E3` |
| 조언 판정, 수용·의심·적발, 신뢰 갱신 | `E2` |
| 아이템 5종 | `F5` |
| 규칙 학습 | 별도 설계 |
