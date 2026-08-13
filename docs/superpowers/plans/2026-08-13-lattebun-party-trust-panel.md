# U1 파티·개인 신뢰 패널 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사이드바에서 파티원을 고르면 그 성격이 무엇을 좋아하고 경계하는지, 그리고 그 파티원에게 최근 무슨 일이 있었는지 펼쳐 보인다.

**Architecture:** 강도 구간·정렬·무반응 제외는 `lib/rules/`의 순수 함수 둘이 맡고 테스트가 지킨다. 컴포넌트는 그 결과를 props로 받아 그리기만 한다. 펼침 상태는 `F2`가 이미 만들어 둔 `ui-store`의 `selectedMemberId`에 두고, 이를 쓰기 위해 `UiStoreProvider`를 `GameStoreProvider`에서 분리해 `app/play/layout.tsx`가 런 데이터 없이도 UI 스토어만 쓸 수 있게 한다.

**Tech Stack:** TypeScript 5.9.3 strict, React 19.2.8, Next.js 16.3.0 App Router, Zustand 5.0.14, Tailwind CSS 4, Vitest 4.1.10, pnpm 11.21.0, Node.js 24.19.0

## Global Constraints

- 근거 spec은 `docs/superpowers/specs/2026-08-13-lattebun-party-trust-panel-design.md`다.
- 공식 규칙은 `docs/systems/PARTY_AND_TRUST.md`와 `docs/experience/ONBOARDING_AND_INTERFACE.md`를 따른다.
- 강도 구간의 상위 경계는 `10`, 중간 경계는 `6`이다. 둘 다 이상(`>=`)으로 판정한다.
- `baseDelta`가 `0`인 행동은 `likes`와 `guards` 어디에도 넣지 않는다.
- 정렬은 `abs(baseDelta)` 내림차순이며, 같으면 `TRUST_ACTIONS` 배열 순서를 따른다. 결정적이어야 한다.
- 상세에 정확한 수치를 적지 않는다. `R2`가 기본값에 약 20% 난수를 더하므로 표시와 실제 결과가 어긋난다. 실제로 일어난 변화의 수치는 사유와 함께 그대로 보여준다.
- 신뢰 `0`만 정체 발각으로 표시한다. 낮은 신뢰 경고 구간을 만들지 않는다. `PARTY_AND_TRUST.md`가 경계값을 아직 정하지 않았다.
- 색으로만 뜻을 전달하지 않는다. 강도 기호는 `aria-hidden`이고 스크린 리더용 한국어 라벨을 함께 둔다.
- `lib/rules/trust.ts`를 읽기만 하고 고치지 않는다. `R3`이 같은 디렉터리에서 진행 중이다.
- `app/play/layout.tsx`는 서버 컴포넌트로 남는다. 목 데이터는 계속 앱이 읽어 props로 내린다.
- 서버에서 클라이언트로 넘기는 props는 직렬화 가능한 평범한 객체와 배열만 쓴다. `Map`과 `Set`을 넘기지 않는다.
- `components/**`는 `@/lib/mock`을 가져오지 않는다. eslint가 강제한다.
- `Math.random`을 호출하지 않는다. eslint가 강제한다.
- 테스트는 `vitest` API를 명시적으로 import하고 `@/` 별칭을 쓰며 설명은 한국어로 쓴다.
- 새 색을 화면에서 고르지 않는다. `app/globals.css`의 `@theme` 토큰(`parchment` `muted` `panel` `edge` `trust-up` `trust-down`)만 쓴다.
- 커밋 메시지는 제목과 본문을 모두 한글로 작성한다.
- `dungeon-schemer-handoff.md`는 개인 미추적 파일이므로 stage하거나 수정하지 않는다.

## File Map

| 파일 | 책임 |
| --- | --- |
| `lib/rules/personality-profile.ts` | 행동 한국어 이름, 강도 구간, 정렬, 무반응 제외, 성격 프로필 |
| `lib/rules/personality-profile.test.ts` | 구간 경계, 0 제외, 정렬 결정성, 성격 차이 검증 |
| `lib/rules/trust-history.ts` | 로그에서 파티원별 최근 신뢰 변화 추출 |
| `lib/rules/trust-history.test.ts` | 필터, 순서, 개수 제한 검증 |
| `lib/stores/game-store-provider.tsx` | `UiStoreProvider` 분리 export |
| `components/game/MemberDetail.tsx` | 펼침 내용 표시 |
| `components/game/TrustRow.tsx` | 요약 줄을 펼침 버튼으로, 정체 발각 표시 |
| `components/game/PartySidebar.tsx` | 클라이언트 컴포넌트, 선택 상태 연결 |
| `app/play/layout.tsx` | provider로 감싸고 프로필·이력 props 전달 |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | 구현 완료 뒤 `U1` 상태와 후속 선행 갱신 |

---

### Task 1: 성격 프로필 순수 모듈

**Files:**
- Create: `lib/rules/personality-profile.ts`
- Create: `lib/rules/personality-profile.test.ts`

**Interfaces:**
- Consumes: `Personality`, `PERSONALITIES` from `@/lib/domain`; `TrustAction`, `TRUST_ACTIONS`, `TRUST_RULES` from `@/lib/rules/trust`
- Produces: `ReactionStrength`, `TrustReaction`, `PersonalityProfile`, `TRUST_ACTION_LABELS`, `describePersonality(personality)`, `PERSONALITY_PROFILES`

- [ ] **Step 1: 실패 테스트를 작성한다**

`lib/rules/personality-profile.test.ts`를 만들고 다음 내용을 넣는다.

```ts
import { describe, expect, it } from "vitest";
import { PERSONALITIES } from "@/lib/domain";
import type { Personality } from "@/lib/domain";
import { TRUST_ACTIONS, TRUST_RULES } from "@/lib/rules/trust";
import type { TrustAction } from "@/lib/rules/trust";
import {
  describePersonality,
  PERSONALITY_PROFILES,
  TRUST_ACTION_LABELS,
} from "@/lib/rules/personality-profile";

function find(personality: Personality, action: TrustAction) {
  const profile = describePersonality(personality);
  return [...profile.likes, ...profile.guards].find(
    (reaction) => reaction.action === action,
  );
}

function magnitudes(personality: Personality, actions: TrustAction[]) {
  return actions.map((action) =>
    Math.abs(TRUST_RULES[personality][action].baseDelta),
  );
}

describe("성격 프로필 강도 구간", () => {
  it("상위 경계 10과 중간 경계 6을 포함해서 판정한다", () => {
    // 신중함 기만 적발 -10 → 최고 단계
    expect(find("prudent", "deceptionExposed")?.strength).toBe(3);
    // 신중함 본인 이익 박탈 -7 → 중간 단계
    expect(find("prudent", "denyReward")?.strength).toBe(2);
    // 정의로움 본인 이익 박탈 -6 → 경계값 포함이므로 중간 단계
    expect(find("righteous", "denyReward")?.strength).toBe(2);
    // 의심 많음 본인 이익 박탈 -5 → 최소 단계
    expect(find("suspicious", "denyReward")?.strength).toBe(1);
  });

  it("충동적 파티원의 경계 행동이 한 단계로 뭉치지 않는다", () => {
    // -10 -10 -8 -7 이므로 상위 경계가 12면 넷이 전부 같은 단계가 된다.
    const strengths = describePersonality("impulsive").guards.map(
      (reaction) => reaction.strength,
    );
    expect(new Set(strengths).size).toBeGreaterThan(1);
  });

  it("의심 많음은 최고 단계 호감 반응을 갖지 않는다", () => {
    // 최고가 +8이다. PARTY_AND_TRUST.md의 "높은 신뢰에 도달하기 어렵다"와 맞다.
    const likes = describePersonality("suspicious").likes;
    expect(likes.length).toBeGreaterThan(0);
    expect(likes.every((reaction) => reaction.strength < 3)).toBe(true);
  });
});

describe("성격 프로필 구성", () => {
  it("반응하지 않는 행동은 어느 쪽에도 넣지 않는다", () => {
    const greedy = describePersonality("greedy");
    const actions = [...greedy.likes, ...greedy.guards].map(
      (reaction) => reaction.action,
    );
    expect(actions).not.toContain("actHonestly");
    expect(actions).not.toContain("protectAlly");
    expect(actions).not.toContain("avoidRisk");
    expect(actions).toHaveLength(5);
  });

  it("모든 성격에서 기본 변화량 0인 행동만 빠진다", () => {
    for (const personality of PERSONALITIES) {
      const profile = describePersonality(personality);
      const shown = [...profile.likes, ...profile.guards];
      for (const reaction of shown) {
        expect(TRUST_RULES[personality][reaction.action].baseDelta).not.toBe(0);
      }
      const expected = TRUST_ACTIONS.filter(
        (action) => TRUST_RULES[personality][action].baseDelta !== 0,
      ).length;
      expect(shown).toHaveLength(expected);
    }
  });

  it("좋아함은 양수만, 경계함은 음수만 담는다", () => {
    for (const personality of PERSONALITIES) {
      const profile = describePersonality(personality);
      for (const reaction of profile.likes) {
        expect(
          TRUST_RULES[personality][reaction.action].baseDelta,
        ).toBeGreaterThan(0);
      }
      for (const reaction of profile.guards) {
        expect(
          TRUST_RULES[personality][reaction.action].baseDelta,
        ).toBeLessThan(0);
      }
    }
  });

  it("모든 성격이 좋아하는 행동과 경계하는 행동을 모두 가진다", () => {
    for (const personality of PERSONALITIES) {
      const profile = PERSONALITY_PROFILES[personality];
      expect(profile.likes.length).toBeGreaterThan(0);
      expect(profile.guards.length).toBeGreaterThan(0);
      for (const reaction of [...profile.likes, ...profile.guards]) {
        expect(reaction.label.trim()).not.toBe("");
      }
    }
  });
});

describe("성격 프로필 정렬", () => {
  it("강한 반응이 먼저 온다", () => {
    for (const personality of PERSONALITIES) {
      const profile = describePersonality(personality);
      for (const list of [profile.likes, profile.guards]) {
        const sizes = magnitudes(
          personality,
          list.map((reaction) => reaction.action),
        );
        expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
      }
    }
  });

  it("같은 크기의 반응은 TRUST_ACTIONS 순서를 따른다", () => {
    // 의심 많음의 동료 보호와 본인 이익 확보가 둘 다 +3이다.
    const likes = describePersonality("suspicious").likes.map(
      (reaction) => reaction.action,
    );
    expect(likes.indexOf("protectAlly")).toBeLessThan(
      likes.indexOf("secureReward"),
    );
  });

  it("같은 성격을 두 번 물어도 같은 순서를 낸다", () => {
    for (const personality of PERSONALITIES) {
      expect(describePersonality(personality)).toEqual(
        describePersonality(personality),
      );
    }
  });
});

describe("성격 프로필 공개 계약", () => {
  it("모든 공통 행동에 한국어 이름이 있다", () => {
    expect(Object.keys(TRUST_ACTION_LABELS).sort()).toEqual(
      [...TRUST_ACTIONS].sort(),
    );
    for (const action of TRUST_ACTIONS) {
      expect(TRUST_ACTION_LABELS[action].trim()).not.toBe("");
    }
  });

  it("탐욕스러움과 정의로움의 프로필이 실제로 다르다", () => {
    expect(describePersonality("greedy")).not.toEqual(
      describePersonality("righteous"),
    );
    expect(describePersonality("greedy").likes[0]?.action).toBe(
      "secureReward",
    );
    expect(describePersonality("righteous").likes[0]?.action).toBe(
      "actHonestly",
    );
  });

  it("PERSONALITY_PROFILES가 모든 성격을 담는다", () => {
    expect(Object.keys(PERSONALITY_PROFILES).sort()).toEqual(
      [...PERSONALITIES].sort(),
    );
    for (const personality of PERSONALITIES) {
      expect(PERSONALITY_PROFILES[personality]).toEqual(
        describePersonality(personality),
      );
    }
  });
});
```

- [ ] **Step 2: 테스트가 모듈 부재로 실패하는지 확인한다**

Run:

```bash
pnpm test -- lib/rules/personality-profile.test.ts
```

Expected: FAIL. `@/lib/rules/personality-profile`를 찾을 수 없다는 오류가 나온다.

- [ ] **Step 3: 최소 구현을 작성한다**

`lib/rules/personality-profile.ts`를 만들고 다음 내용을 넣는다.

```ts
import { PERSONALITIES } from "@/lib/domain";
import type { Personality } from "@/lib/domain";
import { TRUST_ACTIONS, TRUST_RULES } from "@/lib/rules/trust";
import type { TrustAction } from "@/lib/rules/trust";

/**
 * 강도 구간의 경계다. 상위를 12로 올리면 충동적 파티원의 경계 행동
 * 넷(-10 -10 -8 -7)이 전부 같은 단계로 뭉쳐 구분이 사라진다.
 */
const STRONG_THRESHOLD = 10;
const MEDIUM_THRESHOLD = 6;

export type ReactionStrength = 1 | 2 | 3;

/**
 * docs/systems/PARTY_AND_TRUST.md 「프로토타입 신뢰 판정」 공통 행동 표의 이름이다.
 * 화면이 @/lib/rules 를 직접 읽지 않도록 프로필이 이름을 함께 실어 보낸다.
 */
export const TRUST_ACTION_LABELS: Record<TrustAction, string> = {
  actHonestly: "정직한 행동",
  deceptionExposed: "기만 적발",
  protectAlly: "동료 보호",
  betrayAlly: "동료 배신",
  secureReward: "본인 이익 확보",
  denyReward: "본인 이익 박탈",
  takeRisk: "위험 감수",
  avoidRisk: "위험 회피",
};

export interface TrustReaction {
  action: TrustAction;
  /** "정직한 행동"처럼 화면에 그대로 쓰는 이름이다. */
  label: string;
  strength: ReactionStrength;
}

export interface PersonalityProfile {
  /** 기본 변화량이 양수인 행동. 강한 순 */
  likes: TrustReaction[];
  /** 기본 변화량이 음수인 행동. 강한 순 */
  guards: TrustReaction[];
}

function strengthOf(baseDelta: number): ReactionStrength {
  const size = Math.abs(baseDelta);
  if (size >= STRONG_THRESHOLD) return 3;
  if (size >= MEDIUM_THRESHOLD) return 2;
  return 1;
}

function collect(
  personality: Personality,
  keep: (baseDelta: number) => boolean,
): TrustReaction[] {
  return TRUST_ACTIONS.map((action) => ({
    action,
    baseDelta: TRUST_RULES[personality][action].baseDelta,
  }))
    .filter((entry) => keep(entry.baseDelta))
    // sort는 안정 정렬이므로 크기가 같으면 TRUST_ACTIONS 순서가 남는다.
    // 순서가 흔들리면 플레이어가 성격을 학습할 수 없다.
    .sort((left, right) => Math.abs(right.baseDelta) - Math.abs(left.baseDelta))
    .map((entry) => ({
      action: entry.action,
      label: TRUST_ACTION_LABELS[entry.action],
      strength: strengthOf(entry.baseDelta),
    }));
}

/**
 * 기본 변화량이 0인 행동은 넣지 않는다. 그 성격이 그 행동에
 * 의미 있는 반응을 보이지 않으므로 보여줄 반응이 없다.
 */
export function describePersonality(
  personality: Personality,
): PersonalityProfile {
  return {
    likes: collect(personality, (baseDelta) => baseDelta > 0),
    guards: collect(personality, (baseDelta) => baseDelta < 0),
  };
}

export const PERSONALITY_PROFILES = Object.fromEntries(
  // as const 가 없으면 튜플이 아니라 유니온 배열로 추론돼 fromEntries 가 거부한다.
  PERSONALITIES.map(
    (personality) => [personality, describePersonality(personality)] as const,
  ),
) as Record<Personality, PersonalityProfile>;
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run:

```bash
pnpm test -- lib/rules/personality-profile.test.ts
```

Expected: 13개 테스트가 모두 PASS한다.

- [ ] **Step 5: 검사가 실제로 발동하는지 확인한다**

세 가지를 하나씩 일부러 깨뜨리고 각각 테스트를 돌린 뒤 되돌린다. 한 번에 하나만 바꾼다.

1. `STRONG_THRESHOLD`를 `10`에서 `12`로 바꾼다 →
   `충동적 파티원의 경계 행동이 한 단계로 뭉치지 않는다`가 FAIL해야 한다.
2. `collect`의 `.filter(...)` 줄을 지운다 →
   `반응하지 않는 행동은 어느 쪽에도 넣지 않는다`가 FAIL해야 한다.
3. `.sort(...)`의 `right`와 `left`를 맞바꾼다 →
   `강한 반응이 먼저 온다`가 FAIL해야 한다.

각 변형마다 Run:

```bash
pnpm test -- lib/rules/personality-profile.test.ts
```

Expected: 위에 적은 테스트가 실제로 FAIL한다. FAIL하지 않으면 그 검사는 아무것도
지키지 않는 것이므로 테스트를 고친다.

세 확인이 끝나면 되돌리고 Run:

```bash
git diff --stat
```

Expected: 출력이 없다. 세 변형이 모두 복원됐다는 뜻이다.

- [ ] **Step 6: 커밋한다**

```bash
git add lib/rules/personality-profile.ts lib/rules/personality-profile.test.ts
git commit -m "기능: 성격별 선호와 경계 행동 프로필 추가" -m "TRUST_RULES에 들어 있는 성격 차이를 화면이 읽을 수 있는 모양으로 바꾼다.
정확한 수치 대신 3단계 강도를 쓰는 이유는 R2가 기본값에 약 20% 난수를 더해
표시한 수치와 실제 결과가 어긋나기 때문이다.

강도의 상위 경계는 12가 아니라 10이다. 12를 쓰면 충동적 파티원의 경계 행동
넷이 전부 같은 단계로 뭉쳐 구분이 사라진다.

발동 확인: 경계를 12로 되돌리기, 0 필터 제거, 정렬 뒤집기 셋을 넣어
각각 의도한 테스트가 실패하는 것을 보고 되돌렸다."
```

---

### Task 2: 신뢰 변화 이력 추출

**Files:**
- Create: `lib/rules/trust-history.ts`
- Create: `lib/rules/trust-history.test.ts`

**Interfaces:**
- Consumes: `DecisionRecord`, `MemberId` from `@/lib/domain`
- Produces: `TrustHistoryEntry`, `RECENT_TRUST_CHANGE_LIMIT`, `recentTrustChanges(log, memberId, limit?)`

- [ ] **Step 1: 실패 테스트를 작성한다**

`lib/rules/trust-history.test.ts`를 만들고 다음 내용을 넣는다.

```ts
import { describe, expect, it } from "vitest";
import type { DecisionRecord, MemberId, NodeId } from "@/lib/domain";
import {
  RECENT_TRUST_CHANGE_LIMIT,
  recentTrustChanges,
} from "@/lib/rules/trust-history";

const ALPHA = "m-alpha" as MemberId;
const BETA = "m-beta" as MemberId;

function record(
  at: number,
  changes: { memberId: MemberId; delta: number; reason: string }[],
): DecisionRecord {
  return {
    at,
    nodeId: `n-${at}` as NodeId,
    summary: `${at}번째 결정`,
    trustChanges: changes,
  };
}

const LOG: DecisionRecord[] = [
  record(0, [{ memberId: ALPHA, delta: 4, reason: "첫 번째" }]),
  record(1, [{ memberId: BETA, delta: -6, reason: "베타의 것" }]),
  record(2, [{ memberId: ALPHA, delta: -3, reason: "두 번째" }]),
  record(3, [{ memberId: ALPHA, delta: 7, reason: "세 번째" }]),
  record(4, [{ memberId: ALPHA, delta: 1, reason: "네 번째" }]),
];

describe("최근 신뢰 변화 추출", () => {
  it("다른 파티원의 변화를 섞지 않는다", () => {
    const entries = recentTrustChanges(LOG, BETA);
    expect(entries).toHaveLength(1);
    expect(entries[0].reason).toBe("베타의 것");
    expect(entries[0].delta).toBe(-6);
  });

  it("최신 기록이 먼저 온다", () => {
    const entries = recentTrustChanges(LOG, ALPHA);
    expect(entries.map((entry) => entry.reason)).toEqual([
      "네 번째",
      "세 번째",
      "두 번째",
    ]);
  });

  it("기본 개수 제한은 3이다", () => {
    expect(RECENT_TRUST_CHANGE_LIMIT).toBe(3);
    expect(recentTrustChanges(LOG, ALPHA)).toHaveLength(3);
  });

  it("개수 제한을 넘기지 않는다", () => {
    expect(recentTrustChanges(LOG, ALPHA, 2)).toHaveLength(2);
    expect(recentTrustChanges(LOG, ALPHA, 99)).toHaveLength(4);
  });

  it("제한이 0 이하이면 빈 배열이다", () => {
    expect(recentTrustChanges(LOG, ALPHA, 0)).toEqual([]);
    expect(recentTrustChanges(LOG, ALPHA, -1)).toEqual([]);
  });

  it("기록이 없는 파티원은 빈 배열이다", () => {
    expect(recentTrustChanges(LOG, "m-none" as MemberId)).toEqual([]);
    expect(recentTrustChanges([], ALPHA)).toEqual([]);
  });

  it("한 기록에 같은 파티원의 변화가 여럿이면 모두 담는다", () => {
    const doubled = [
      record(0, [
        { memberId: ALPHA, delta: 2, reason: "앞" },
        { memberId: ALPHA, delta: -5, reason: "뒤" },
      ]),
    ];
    const entries = recentTrustChanges(doubled, ALPHA);
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.reason)).toEqual(["앞", "뒤"]);
  });

  it("로그 순번과 사건 요약을 함께 싣는다", () => {
    const entries = recentTrustChanges(LOG, ALPHA, 1);
    expect(entries[0].at).toBe(4);
    expect(entries[0].summary).toBe("4번째 결정");
  });

  it("원본 로그를 변경하지 않는다", () => {
    const snapshot = structuredClone(LOG);
    recentTrustChanges(LOG, ALPHA);
    expect(LOG).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: 테스트가 모듈 부재로 실패하는지 확인한다**

Run:

```bash
pnpm test -- lib/rules/trust-history.test.ts
```

Expected: FAIL. `@/lib/rules/trust-history`를 찾을 수 없다는 오류가 나온다.

- [ ] **Step 3: 최소 구현을 작성한다**

`lib/rules/trust-history.ts`를 만들고 다음 내용을 넣는다.

```ts
import type { DecisionRecord, MemberId } from "@/lib/domain";

export interface TrustHistoryEntry {
  /** 로그 순번이다. 시각이 아니다. 시각을 쓰면 재현성이 깨진다. */
  at: number;
  /** 무슨 사건이었는지. DecisionRecord.summary 그대로다. */
  summary: string;
  /** 실제로 적용된 변화량이다. */
  delta: number;
  /** 그 성격이 왜 그렇게 반응했는지. */
  reason: string;
}

export const RECENT_TRUST_CHANGE_LIMIT = 3;

/**
 * 로그를 최신부터 거슬러 훑어 해당 파티원의 신뢰 변화만 모은다.
 * 로그는 추가 전용이므로 원본을 건드리지 않는다.
 */
export function recentTrustChanges(
  log: DecisionRecord[],
  memberId: MemberId,
  limit: number = RECENT_TRUST_CHANGE_LIMIT,
): TrustHistoryEntry[] {
  if (limit <= 0) return [];

  const entries: TrustHistoryEntry[] = [];

  for (let index = log.length - 1; index >= 0; index -= 1) {
    const record = log[index];
    for (const change of record.trustChanges) {
      if (change.memberId !== memberId) continue;
      entries.push({
        at: record.at,
        summary: record.summary,
        delta: change.delta,
        reason: change.reason,
      });
      if (entries.length >= limit) return entries;
    }
  }

  return entries;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run:

```bash
pnpm test -- lib/rules/trust-history.test.ts
```

Expected: 9개 테스트가 모두 PASS한다.

- [ ] **Step 5: 검사가 실제로 발동하는지 확인한다**

두 가지를 하나씩 깨뜨리고 각각 테스트를 돌린 뒤 되돌린다.

1. `for` 문의 시작을 `log.length - 1`에서 `0`으로, 감소를 증가로 바꾼다 →
   `최신 기록이 먼저 온다`가 FAIL해야 한다.
2. `if (change.memberId !== memberId) continue;` 줄을 지운다 →
   `다른 파티원의 변화를 섞지 않는다`가 FAIL해야 한다.

각 변형마다 Run:

```bash
pnpm test -- lib/rules/trust-history.test.ts
```

Expected: 위에 적은 테스트가 실제로 FAIL한다.

확인이 끝나면 되돌리고 Run:

```bash
git diff --stat
```

Expected: 출력이 없다.

- [ ] **Step 6: 커밋한다**

```bash
git add lib/rules/trust-history.ts lib/rules/trust-history.test.ts
git commit -m "기능: 파티원별 최근 신뢰 변화 추출 추가" -m "화면이 로그를 직접 훑지 않도록 조회를 순수 함수로 분리한다.
로그는 추가 전용이므로 원본을 건드리지 않고 최신부터 거슬러 모은다.

at은 로그 순번이지 시각이 아니라는 F1의 결정을 그대로 따른다.

발동 확인: 훑는 방향 뒤집기와 파티원 필터 제거를 넣어 각각 의도한
테스트가 실패하는 것을 보고 되돌렸다."
```

---

### Task 3: `UiStoreProvider` 분리

**Files:**
- Modify: `lib/stores/game-store-provider.tsx`

**Interfaces:**
- Consumes: 기존 `createUiStore`, `createRunStore`, `UiStoreApi`, `RunStoreApi`
- Produces: `UiStoreProvider({ children })` — 런 데이터 없이 UI 스토어만 제공한다. 기존 `GameStoreProvider`와 `useRunStore`, `useUiStore`의 동작은 그대로다.

`vitest.config.mts`의 `environment`가 `node`이고 `include`가 `**/*.test.ts`이므로 이
Task는 렌더링 테스트를 쓸 수 없다. 대신 타입 검사, 빌드, 기존 테스트, 그리고
`/state-preview` 화면이 그대로 도는지로 검증한다.

- [ ] **Step 1: 변경 전 상태를 확인한다**

Run:

```bash
pnpm test -- app/state-preview
pnpm typecheck
```

Expected: 두 명령 모두 통과한다. 이후 단계의 비교 기준이다.

- [ ] **Step 2: `UiStoreProvider`를 분리한다**

`lib/stores/game-store-provider.tsx`의 `GameStoreProvider` 정의를 다음으로 바꾼다.
기존 `import`, 두 `createContext`, `GameStoreProviderProps`는 그대로 둔다.

```tsx
/**
 * UI 상태만 필요한 화면을 위해 런 스토어와 떼어 놓는다.
 * app/play 는 아직 런을 스토어에 넣지 않는다. 그 배선은 P1의 몫이다.
 */
export function UiStoreProvider({ children }: { children: ReactNode }) {
  const [uiStore] = useState<UiStoreApi>(() => createUiStore());

  return (
    <UiStoreContext.Provider value={uiStore}>
      {children}
    </UiStoreContext.Provider>
  );
}

export function GameStoreProvider({
  initialRun,
  children,
}: GameStoreProviderProps) {
  const [runStore] = useState<RunStoreApi>(() => createRunStore(initialRun));

  return (
    <RunStoreContext.Provider value={runStore}>
      <UiStoreProvider>{children}</UiStoreProvider>
    </RunStoreContext.Provider>
  );
}
```

- [ ] **Step 3: `useUiStore`의 오류 문구를 고친다**

같은 파일의 `useUiStore` 안에 있는 오류 문구를 바꾼다. 이제 `GameStoreProvider`만
조건이 아니다.

```tsx
      "useUiStore는 UiStoreProvider 또는 GameStoreProvider 안에서 호출해야 합니다.",
```

- [ ] **Step 4: 기존 동작이 그대로인지 확인한다**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: 세 명령 모두 exit code 0이다. `GameStoreProvider`는 추가 변경 없이 계속
런과 UI 스토어를 함께 제공하므로 `/state-preview` 관련 테스트가 그대로 통과한다.

- [ ] **Step 5: `/state-preview`가 그대로 도는지 눈으로 확인한다**

Run:

```bash
pnpm dev
```

브라우저에서 `/state-preview`를 연다. 파티원을 고르는 기존 동작과 새 런 시작이
전과 같이 되는지 확인하고 `Ctrl+C`로 서버를 멈춘다.

Expected: 콘솔에 `useUiStore는 ... 안에서 호출해야 합니다` 오류가 없고 화면이 전과
같이 동작한다.

- [ ] **Step 6: 커밋한다**

```bash
git add lib/stores/game-store-provider.tsx
git commit -m "리팩터: UI 스토어 제공자를 런 스토어와 분리" -m "GameStoreProvider가 initialRun을 필수로 받으므로 selectedMemberId 하나를
쓰려 해도 런 데이터를 함께 넘겨야 했다. app/play는 아직 런을 스토어에
넣지 않으므로 UI 스토어만 제공하는 경로를 연다.

런을 언제 어떻게 스토어에 넣을지는 게임 상태 머신의 결정이므로 P1에 남긴다.
GameStoreProvider는 내부에서 UiStoreProvider를 쓰므로 동작이 그대로다."
```

---

### Task 4: 파티 패널 펼침 화면

**Files:**
- Create: `components/game/MemberDetail.tsx`
- Modify: `components/game/TrustRow.tsx`
- Modify: `components/game/PartySidebar.tsx`
- Modify: `app/play/layout.tsx`

**Interfaces:**
- Consumes: Task 1의 `PersonalityProfile`, `ReactionStrength`, `PERSONALITY_PROFILES`; Task 2의 `TrustHistoryEntry`, `recentTrustChanges`; Task 3의 `UiStoreProvider`; 기존 `useUiStore`
- Produces: 펼침 가능한 파티 사이드바. `PartySidebar`가 `profiles: Record<Personality, PersonalityProfile>`와 `history: Record<string, TrustHistoryEntry[]>` props를 추가로 받는다.

- [ ] **Step 1: 펼침 내용 컴포넌트를 만든다**

`components/game/MemberDetail.tsx`를 만들고 다음 내용을 넣는다.

```tsx
import type {
  PersonalityProfile,
  ReactionStrength,
  TrustReaction,
} from "@/lib/rules/personality-profile";
import type { TrustHistoryEntry } from "@/lib/rules/trust-history";

/** 색과 기호에만 기대지 않도록 스크린 리더에 읽을 말을 따로 둔다. */
const LIKE_LABELS: Record<ReactionStrength, string> = {
  3: "매우 좋아함",
  2: "좋아함",
  1: "조금 좋아함",
};

const GUARD_LABELS: Record<ReactionStrength, string> = {
  3: "매우 경계함",
  2: "경계함",
  1: "조금 경계함",
};

interface ReactionListProps {
  title: string;
  reactions: TrustReaction[];
  mark: string;
  markClassName: string;
  srLabels: Record<ReactionStrength, string>;
}

function ReactionList({
  title,
  reactions,
  mark,
  markClassName,
  srLabels,
}: ReactionListProps) {
  if (reactions.length === 0) return null;
  return (
    <>
      <h4 className="mt-2 text-xs font-semibold text-muted">{title}</h4>
      <ul>
        {reactions.map((reaction) => (
          <li key={reaction.action} className="flex gap-2 text-xs text-parchment">
            <span aria-hidden="true" className={`tabular-nums ${markClassName}`}>
              {mark.repeat(reaction.strength)}
            </span>
            <span className="sr-only">{srLabels[reaction.strength]}</span>
            <span>{reaction.label}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

interface MemberDetailProps {
  profile: PersonalityProfile;
  history: TrustHistoryEntry[];
}

export function MemberDetail({ profile, history }: MemberDetailProps) {
  return (
    <div className="mt-2 rounded border border-edge px-2 py-2">
      <ReactionList
        title="좋아함"
        reactions={profile.likes}
        mark="▲"
        markClassName="text-trust-up"
        srLabels={LIKE_LABELS}
      />
      <ReactionList
        title="경계함"
        reactions={profile.guards}
        mark="▼"
        markClassName="text-trust-down"
        srLabels={GUARD_LABELS}
      />
      <h4 className="mt-2 text-xs font-semibold text-muted">최근 변화</h4>
      {history.length === 0 ? (
        <p className="text-xs text-muted">아직 기록이 없다.</p>
      ) : (
        <ul>
          {history.map((entry, index) => (
            <li
              key={`${entry.at}-${index}`}
              className="text-xs text-parchment"
            >
              <span
                aria-hidden="true"
                className={entry.delta >= 0 ? "text-trust-up" : "text-trust-down"}
              >
                {entry.delta >= 0 ? "▲" : "▼"}
              </span>
              <span className="sr-only">
                {entry.delta >= 0 ? "신뢰 상승 " : "신뢰 하락 "}
              </span>
              {Math.abs(entry.delta)} · {entry.summary} — {entry.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 요약 줄을 펼침 버튼으로 바꾼다**

`components/game/TrustRow.tsx`의 전체 내용을 다음으로 바꾼다. `TrustDelta`는 지금
동작을 그대로 유지한다.

```tsx
import type { ReactNode } from "react";
import { TRUST_MIN } from "@/lib/domain";
import type { PartyMember } from "@/lib/domain";
import { PERSONALITY_LABELS } from "./labels";

interface TrustChangeView { delta: number; reason: string }

interface TrustRowProps {
  member: PartyMember;
  classLabel: string;
  change?: TrustChangeView;
  expanded: boolean;
  onToggle: () => void;
  detail: ReactNode;
}

function TrustDelta({ delta, reason }: TrustChangeView) {
  const rising = delta >= 0;
  return <p className={`mt-1 text-xs ${rising ? "text-trust-up" : "text-trust-down"}`}>
    <span aria-hidden="true">{rising ? "▲" : "▼"}</span>
    <span className="sr-only">{rising ? "신뢰 상승 " : "신뢰 하락 "}</span>
    {Math.abs(delta)} · {reason}
  </p>;
}

export function TrustRow({ member, classLabel, change, expanded, onToggle, detail }: TrustRowProps) {
  const detailId = `member-detail-${member.id}`;
  return <li className="border-b border-edge py-2 last:border-b-0 last:pb-0">
    <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={detailId} className="w-full text-left">
      {/* button 은 구문 콘텐츠만 담을 수 있으므로 div 와 p 대신 span 을 쓴다. */}
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-parchment">
          <span aria-hidden="true" className="mr-1 text-xs text-muted">{expanded ? "▼" : "▶"}</span>
          {member.name}<span className="ml-1 text-xs text-muted">{classLabel}</span>
        </span>
        <span className="text-sm font-semibold tabular-nums text-parchment">{member.trust}</span>
      </span>
      <span className="block text-xs text-muted">{PERSONALITY_LABELS[member.personality]}{member.alive ? "" : " · 사망"}</span>
    </button>
    {member.trust === TRUST_MIN ? <p className="text-xs text-trust-down"><span aria-hidden="true">⚠ </span>정체 발각</p> : null}
    {change === undefined ? null : <TrustDelta {...change} />}
    <div id={detailId} hidden={!expanded}>{expanded ? detail : null}</div>
  </li>;
}
```

- [ ] **Step 3: 사이드바를 클라이언트 컴포넌트로 바꾼다**

`components/game/PartySidebar.tsx`의 전체 내용을 다음으로 바꾼다.

```tsx
"use client";

import { Panel } from "@/components/ui/Panel";
import type { ClassDef, MemberId, PartyMember, Personality, TrustChange } from "@/lib/domain";
import type { PersonalityProfile } from "@/lib/rules/personality-profile";
import type { TrustHistoryEntry } from "@/lib/rules/trust-history";
import { useUiStore } from "@/lib/stores/game-store-provider";
import { TRUST_UNIT } from "./labels";
import { MemberDetail } from "./MemberDetail";
import { TrustRow } from "./TrustRow";

interface PartySidebarProps {
  party: PartyMember[];
  classes: ClassDef[];
  latestChanges: TrustChange[];
  profiles: Record<Personality, PersonalityProfile>;
  /** 파티원 id를 키로 쓴다. 서버에서 넘어오므로 Map이 아니라 평범한 객체다. */
  history: Record<string, TrustHistoryEntry[]>;
  className?: string;
}

export function PartySidebar({ party, classes, latestChanges, profiles, history, className }: PartySidebarProps) {
  const selectedMemberId = useUiStore((state) => state.selectedMemberId);
  const selectMember = useUiStore((state) => state.selectMember);
  const clearSelectedMember = useUiStore((state) => state.clearSelectedMember);

  const classNameById = new Map(classes.map((klass) => [klass.id, klass.name]));
  const changeByMemberId = new Map(latestChanges.map((change) => [change.memberId, change]));

  const toggle = (memberId: MemberId) => {
    if (memberId === selectedMemberId) clearSelectedMember();
    else selectMember(memberId);
  };

  return <Panel title={`파티와 개인 ${TRUST_UNIT}`} className={className}><ul className="flex flex-col">
    {party.map((member) => {
      const change = changeByMemberId.get(member.id);
      return <TrustRow key={member.id} member={member}
        classLabel={classNameById.get(member.classId) ?? "직업 미정"}
        change={change === undefined ? undefined : { delta: change.delta, reason: change.reason }}
        expanded={member.id === selectedMemberId}
        onToggle={() => { toggle(member.id); }}
        detail={<MemberDetail profile={profiles[member.personality]} history={history[member.id] ?? []} />} />;
    })}
  </ul></Panel>;
}
```

- [ ] **Step 4: 레이아웃에서 provider와 props를 연결한다**

`app/play/layout.tsx`의 전체 내용을 다음으로 바꾼다. 서버 컴포넌트로 남는다.

```tsx
import type { ReactNode } from "react";
import { PartySidebar } from "@/components/game/PartySidebar";
import { ResourceBar } from "@/components/game/ResourceBar";
import { MOCK_CLASSES, MOCK_RUN, findNode } from "@/lib/mock";
import { PERSONALITY_PROFILES } from "@/lib/rules/personality-profile";
import { recentTrustChanges } from "@/lib/rules/trust-history";
import { UiStoreProvider } from "@/lib/stores/game-store-provider";

export default function PlayLayout({ children }: { children: ReactNode }) {
  const currentDepth = findNode(MOCK_RUN.currentNodeId)?.depth ?? 0;
  const latestChanges = MOCK_RUN.log.at(-1)?.trustChanges ?? [];
  // 클라이언트 컴포넌트로 넘어가므로 직렬화 가능한 평범한 객체로 만든다.
  const history = Object.fromEntries(
    MOCK_RUN.party.map((member) => [member.id, recentTrustChanges(MOCK_RUN.log, member.id)] as const),
  );
  return <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-3 p-3">
    <ResourceBar resources={MOCK_RUN.resources} phase={MOCK_RUN.phase} depth={currentDepth} />
    <div className="flex flex-1 flex-col gap-3 lg:flex-row">
      <main className="flex flex-1 flex-col gap-3">{children}</main>
      <UiStoreProvider>
        <PartySidebar party={MOCK_RUN.party} classes={MOCK_CLASSES} latestChanges={latestChanges}
          profiles={PERSONALITY_PROFILES} history={history} className="lg:w-72 lg:shrink-0" />
      </UiStoreProvider>
    </div>
  </div>;
}
```

`UiStoreProvider`는 context만 렌더링하고 DOM 요소를 만들지 않으므로 flex 배치가
바뀌지 않는다.

- [ ] **Step 5: 정적 검사를 실행한다**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 네 명령 모두 exit code 0이다. `pnpm lint`는 `components/**`가
`@/lib/mock`을 가져오지 않는다는 경계도 함께 확인한다.

- [ ] **Step 6: 화면을 눈으로 확인한다**

Run:

```bash
pnpm dev
```

브라우저에서 `/play`를 열고 다음을 확인한다. 목 파티는 가론(충동적 72), 리엔(정의로움
41), 베카(탐욕스러움 58), 이스(의심 많음 30) 넷이다.

- 베카를 누르면 펼쳐지고 좋아함 2줄(`▲▲▲ 본인 이익 확보`, `▲ 위험 감수`), 경계함
  3줄(`▼▼▼ 본인 이익 박탈`, `▼▼ 기만 적발`, `▼ 동료 배신`)만 보인다. 탐욕스러움은
  정직한 행동·동료 보호·위험 회피에 반응하지 않으므로 그 셋이 없어야 한다.
- 가론을 누르면 베카가 접히고 가론이 펼쳐진다. 한 번에 하나만 펼쳐진다.
- 가론을 다시 누르면 접힌다.
- 리엔의 최근 변화에 `▲4 … 정의로운 성격: 숨기지 않은 답변`이, 이스의 최근 변화에
  `▼6 … 의심 많은 성격: 근거를 물었으나 답하지 못함`이 보인다.
- 가론과 베카의 최근 변화는 `아직 기록이 없다.`다.
- `Tab`으로 각 행에 초점이 가고 `Enter`와 `Space`로 펼치고 접을 수 있다.
- 개발자 도구에서 펼친 행의 버튼에 `aria-expanded="true"`가, 접힌 행에
  `aria-expanded="false"`가 있다.
- `/play/map`으로 이동해도 사이드바가 그대로 있고 펼침이 동작한다.

확인이 끝나면 `Ctrl+C`로 서버를 멈춘다. 확인한 내용을 PR 본문에 적을 수 있게
메모해 둔다.

- [ ] **Step 7: 커밋한다**

```bash
git add components/game/MemberDetail.tsx components/game/TrustRow.tsx components/game/PartySidebar.tsx app/play/layout.tsx
git commit -m "기능: 파티원별 선호와 경계 행동 펼침 추가" -m "파티원을 고르면 그 성격이 무엇을 좋아하고 경계하는지, 최근 무슨 일이
있었는지 사이드바에서 바로 확인할 수 있다. 사이드바는 레이아웃에 있으므로
조우 화면에서 카드를 고르기 직전에도 상대의 성격을 볼 수 있다.

펼침 상태는 F2가 만들어 둔 ui-store의 selectedMemberId를 쓴다. 런 데이터는
여전히 앱이 목에서 읽어 props로 내리므로 P1이 붙을 때 화면 코드를 고치지
않아도 된다.

강도 기호는 aria-hidden이고 스크린 리더에는 한국어 라벨이 읽힌다.
신뢰 0만 정체 발각으로 표시한다. 낮은 신뢰 경고 구간은 아직 정해지지 않았다."
```

---

### Task 5: 배정표 갱신과 전체 검증

**Files:**
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Task 4까지의 구현과 통과한 검증
- Produces: `U1` 완료 상태와 `U5`의 줄어든 선행

- [ ] **Step 1: 원격 main을 가져와 병합한다**

Run:

```bash
git fetch origin
git merge origin/main
```

Expected: 병합이 완료된다. 배정표는 여러 PR이 함께 건드리는 파일이므로 이 단계를
반드시 먼저 한다. 충돌이 나면 양쪽 의도를 확인해 해결한다. `P1`이 먼저 병합돼 있으면
`P1` 행이 이미 `✅`이고 `U3`·`U5`·`P2`의 선행이 줄어 있을 수 있다.

이 브랜치의 PR이 이미 승인받은 상태라면 여기서 멈추고, 추가 push가 승인을
무효화한다는 사실을 알린 뒤 진행 여부를 확인한다.

- [ ] **Step 2: 배정표의 `U1` 완료를 반영한다**

`docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`에서 `U1` 행의 담당과 상태를 바꾼다.

```markdown
| U1 | 파티·개인 신뢰 패널 | 파티원별 직업·성격·신뢰 상태와 최근 변화 사유가 보이고, 개인별 차이를 확인할 수 있음 | — | **U5 Q2** | LatteBun | ✅ |
```

그리고 `U1`을 선행으로 갖고 있는 행에서 `U1`을 지운다. `U5`가 그 대상이다. 병합
직후 `U5` 행의 `선행` 열을 실제 값으로 확인한 뒤 `U1`만 지운다. `P1`이 아직
안 끝났다면 다음처럼 남는다.

```markdown
| U5 | 30초 온보딩 | 첫 실행부터 첫 카드 선택 결과 확인까지 30초 내 도달하고 온보딩 목표 6개가 화면에서 전달됨 | P1 U2 | **Q2** | | ⬜ |
```

`풀리는 것`은 완료 여부와 무관한 전체 구조이므로 `U1` 행에서도 그대로 둔다.
의존성 그래프는 고치지 않는다. 새 의존 관계를 만든 것이 아니다.

- [ ] **Step 3: 배정표 무결성 검사를 먼저 실행한다**

Run:

```bash
pnpm test -- docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts
```

Expected: 배정표 규약 테스트가 모두 PASS한다. 완료된 ID가 다른 행의 `선행`에
남아 있으면 여기서 잡힌다.

- [ ] **Step 4: 전체 검증 넷을 실행한다**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 네 명령 모두 exit code 0이다.

- [ ] **Step 5: 개인 파일이 섞이지 않았는지 확인한다**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` 출력이 없다. `git status --short`에는 배정표 변경과
미추적 파일 `dungeon-schemer-handoff.md`만 보인다. 개인 파일은 stage하지 않는다.

- [ ] **Step 6: 배정표 변경을 커밋한다**

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "문서: 파티·개인 신뢰 패널 완료 기록" -m "U1 구현과 전체 검증이 끝나 후속 작업의 남은 선행을 갱신한다.
U5 담당자가 현재 시작 조건을 배정표에서 바로 확인할 수 있게 한다."
```

- [ ] **Step 7: 최종 상태를 확인한다**

Run:

```bash
git status --short
git log --oneline -6
```

Expected: 추적 파일 변경은 없고 `dungeon-schemer-handoff.md`만 미추적 상태다.
최근 커밋에 설계, 성격 프로필, 신뢰 이력, 제공자 분리, 펼침 화면, 배정표 갱신이
나타난다.

PR 본문에는 Task 1과 Task 2의 발동 확인 결과, Task 4의 수동 확인 결과를 함께
적는다.
