# F2-1 테마 콘텐츠·거미굴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 거미굴 테마의 생태 규칙 6개·몬스터 5종·위험도 구간별 보스 4종을 콘텐츠 데이터로 만들고, 수량·중복·빈 문구를 검증하는 테스트를 통과시킨다.

**Architecture:** 도메인 타입(`BossDef`·`ThemeContent`)을 먼저 고쳐 보스가 위험도 구간별 배열이 되게 한다. 그다음 콘텐츠 데이터와 검증기를 TDD로 쌓는다 — 검증기를 먼저 실패 상태로 만들고, 거미굴 데이터를 채워 통과시킨다. 검증기는 테마 배열을 받는 형태로 짜서 `F2-2`가 사막·묘지를 더할 때 다시 쓰지 않게 한다.

**Tech Stack:** TypeScript 5, Vitest 4

**Spec:** `docs/superpowers/specs/2026-08-19-lattebun-f2-1-theme-spider-design.md`

## Global Constraints

- 테마마다 생태 규칙 **6개**, 몬스터 **5종**, 보스 **4종**
- 테마에 조건부 규칙이 **1개 이상**
- 보스의 `minRiskLevel`은 1·2·3·4를 빠짐없이 정확히 담는다(중복 없음)
- 규칙·몬스터·보스의 식별자는 테마 안에서 중복되지 않는다
- 규칙 `text`, 몬스터 `name`, 보스 `name`·`description`은 비어 있을 수 없다
- 계약 위반은 조용히 다시 뽑지 않고 `RuleError("INVALID_GENERATION", message, details)`로 보고한다
- `minRiskLevel`에 `C`·`B`·`A`·`S` 같은 길잡이 등급 글자를 쓰지 않는다
- 카드 진위 조합 검증은 이번 범위가 아니다(`F3`)
- 한국어로 쓰고 기존 파일의 주석 밀도를 따른다

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/domain/dungeon.ts` (수정) | `BossDef`에 `minRiskLevel` 추가, `ThemeContent.boss` → `bosses` 배열 |
| `lib/domain/index.ts` (수정) | 배럴 export는 변경 없음(타입 이름 그대로) |
| `lib/content/theme-validation.ts` (신규) | 테마 배열을 받아 수량·중복·빈 문구를 검증 |
| `lib/content/theme-validation.test.ts` (신규) | 정상 통과와 위반마다의 실패를 확인 |
| `lib/content/themes.ts` (신규) | `THEMES` 배열(거미굴만)과 `selectThemeBoss` |
| `lib/content/themes.test.ts` (신규) | `selectThemeBoss`의 위험도별 선택과 검증기 통과를 확인 |

---

## Task 1: 도메인 타입 변경

**Files:**
- Modify: `lib/domain/dungeon.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `BossDef.minRiskLevel`, `ThemeContent.bosses`

- [ ] **Step 1: `BossDef`에 `minRiskLevel: RiskLevel` 필드를 추가한다**

주석으로 "이 값 이상인 초기 위험도의 던전이 이 보스를 만난다"를 남긴다.

- [ ] **Step 2: `ThemeContent.boss: BossDef`를 `bosses: readonly BossDef[]`로 바꾼다**

주석으로 "minRiskLevel 1·2·3·4 오름차순 4개"를 남긴다.

- [ ] **Step 3: 타입 검사를 확인한다**

```bash
npx tsc --noEmit
```

이 시점엔 `ThemeContent`나 `BossDef`를 쓰는 곳이 아직 없으므로 오류가 나지 않아야 한다.

---

## Task 2: 검증기를 실패 상태로 먼저 만든다

**Files:**
- Create: `lib/content/theme-validation.ts`
- Create: `lib/content/theme-validation.test.ts`

**Interfaces:**
- Consumes: `ThemeContent[]`
- Produces: 위반 시 `RuleError("INVALID_GENERATION")`을 던지는 `validateThemes(themes: readonly ThemeContent[]): void`

- [ ] **Step 1: 검증기 뼈대를 쓴다**

옛 `lib/content/validation.ts`(git 히스토리, 커밋 `dddd9bc` 이전)의 `invalid()`·`requireText()` 패턴을 참고한다. 확인 항목:

```typescript
export function validateThemes(themes: readonly ThemeContent[]): void {
  for (const theme of themes) {
    // 규칙 6개, 몬스터 5종, 보스 4종
    // 조건부 규칙 1개 이상
    // minRiskLevel이 [1,2,3,4]와 정확히 일치(정렬 후 비교)
    // 규칙/몬스터/보스 ID가 테마 안에서 각각 중복 없음
    // 규칙 text, 몬스터 name, 보스 name·description이 빈 문자열이 아님
  }
}
```

- [ ] **Step 2: 위반마다 실패하는 테스트를 먼저 쓴다**

`lib/content/theme-validation.test.ts`에 최소 fixture(계약을 만족하는 가짜 테마 하나)를 만들고, 각 위반을 하나씩 주입해 `RuleError`가 던져지는지 확인한다.

- 규칙이 5개뿐인 경우
- 보스가 3종뿐인 경우
- 보스 `minRiskLevel`이 `[1,2,3,3]`처럼 중복인 경우
- 조건부 규칙이 하나도 없는 경우
- 규칙 ID가 테마 안에서 중복인 경우
- 규칙 `text`가 빈 문자열인 경우

- [ ] **Step 3: 이 시점에 테스트를 돌려 실패를 확인한다**

```bash
npx vitest run lib/content/theme-validation.test.ts
```

정상 케이스 fixture 자체가 아직 없으므로 전부 실패해야 정상이다(red).

---

## Task 3: 거미굴 콘텐츠

**Files:**
- Create: `lib/content/themes.ts`
- Create: `lib/content/themes.test.ts`

**Interfaces:**
- Consumes: `lib/content/theme-validation.ts`
- Produces: `THEMES: readonly ThemeContent[]`, `selectThemeBoss(theme, riskLevel): BossDef`

- [ ] **Step 1: 거미굴 생태 규칙 6개를 쓴다**

spec의 표를 그대로 옮긴다. `spider-fire`(비조건부) / `spider-brood-light`(조건부) / `spider-vibration`(비조건부) / `spider-armor-vibration`(조건부) / `spider-carrion`(비조건부) / `spider-shadow`(비조건부).

- [ ] **Step 2: 몬스터 5종을 쓴다**

`spider-hatchling`(새끼거미) / `spider-corpse`(시체거미) / `spider-cave`(동굴거미) / `spider-armored`(철갑거미) / `spider-shadow`(그림자거미). 몬스터 ID `spider-shadow`와 규칙 ID `spider-shadow`가 같은 문자열이지만 `MonsterId`·`RuleId`는 서로 다른 브랜드 타입이라 섞이지 않는다.

- [ ] **Step 3: 보스 4종을 `minRiskLevel` 오름차순으로 쓴다**

거대거미 라그나(1) / 고치관리자 모르칸(2) / 아라크네 세리나(3) / 거미여왕 아라크샤(4). 수치는 spec의 표(baseDamage 14/19/25/32, maxHp 100/150/210/280)를 그대로 쓴다.

- [ ] **Step 4: `THEMES` 배열과 `selectThemeBoss`를 쓴다**

```typescript
export function selectThemeBoss(theme: ThemeContent, riskLevel: RiskLevel): BossDef {
  const candidates = theme.bosses.filter((boss) => boss.minRiskLevel <= riskLevel);
  const chosen = candidates.at(-1); // bosses는 minRiskLevel 오름차순이라 마지막이 가장 높은 구간
  if (chosen === undefined) {
    throw new RuleError("UNKNOWN_ID", `위험도 ${riskLevel}를 담당하는 보스가 없다`, { theme: theme.id, riskLevel });
  }
  return chosen;
}
```

모듈 로드 시 `validateThemes(THEMES)`를 호출해, 콘텐츠가 계약을 어기면 이 파일을 import하는 순간 바로 드러나게 한다.

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다(green)**

```bash
npx vitest run lib/content/theme-validation.test.ts lib/content/themes.test.ts
```

`themes.test.ts`에는 `selectThemeBoss`가 ★1~★5 각각에서 올바른 보스를 고르는지, ★4와 ★5가 같은 보스(아라크샤)로 묶이는지, `THEMES`가 `validateThemes`를 통과하는지를 확인한다.

---

## Task 4: 전체 검증

**Files:** 없음

- [ ] **Step 1: 전체 검증을 돌린다**

```bash
npx tsc --noEmit
npm run lint
npm run build
npx vitest run
```

- [ ] **Step 2: 문서 검사를 돌린다**

```bash
npx vitest run docs/
```

배정표 무결성·용어 감시·링크 검사가 모두 통과해야 한다. 이 단계에서는 `F2-1`을 아직 ✅로 바꾸지 않는다 — 배정표 갱신은 Task 5의 몫이다.

---

## Task 5: 배정표 갱신

**Files:**
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

**Interfaces:**
- Consumes: Task 1~4의 결과
- Produces: `F2-1` ✅, `F2-2`의 선행에서 `F2-1` 제거

- [ ] **Step 1: `F2-1` 행을 ✅로 바꾸고 담당을 적는다**

- [ ] **Step 2: `F2-2` 행의 선행에서 `F2-1`을 지운다(`—`로)**

`C1`·`E2`·`E4`의 선행에서도 `F2-1`을 지운다. 배정표 규약은 완료된 ID를 모든 선행 칸에서 예외 없이 지우도록 요구하며, 이 셋이 완료되려면 `F2-2`도 필요하지만 그건 `F2-2` 하나로 표현된다.

- [ ] **Step 3: 문서 검사를 다시 돌려 확인한다**

```bash
npx vitest run docs/
```
