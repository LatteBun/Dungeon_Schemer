# F2-2 테마 콘텐츠·사막·묘지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사막·묘지 테마의 생태 규칙 6개씩·몬스터 5종씩·위험도 구간별 보스 4종씩을 `THEMES`에 더하고, 기존 검증기와 `selectThemeBoss`가 세 테마 모두에서 통과하는지 확인한다.

**Architecture:** `F2-1`이 만든 타입·검증기·선택 함수는 고치지 않는다. `lib/content/themes.ts`에 `DESERT_THEME`·`GRAVEYARD_THEME` 상수를 더하고 `THEMES` 배열에 넣는 것이 전부다. 테스트도 새 테마용 케이스만 추가한다.

**Tech Stack:** TypeScript 5, Vitest 4

**Spec:** `docs/superpowers/specs/2026-08-19-lattebun-f2-2-theme-desert-graveyard-design.md`

## Global Constraints

- 테마마다 생태 규칙 6개, 몬스터 5종, 보스 4종(`minRiskLevel` 1·2·3·4)
- 테마에 조건부 규칙 1개 이상 (spec은 각 테마 2개로 잡음)
- 보스 수치는 `F2-1`의 값(baseDamage 14/19/25/32, maxHp 100/150/210/280)을 구간별로 그대로 재사용
- ID는 테마 안에서만 유일하면 된다(브랜드 타입이 달라 테마 간 문자열 재사용은 문제 없음)
- 한국어로 쓰고 `lib/content/themes.ts`의 기존 문체·주석 밀도를 따른다

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/content/themes.ts` (수정) | `DESERT_THEME`·`GRAVEYARD_THEME` 추가, `THEMES` 배열 확장 |
| `lib/content/themes.test.ts` (수정) | 세 테마 검증·선택 테스트 추가 |

`lib/domain/dungeon.ts`와 `lib/content/theme-validation.ts`는 고치지 않는다.

---

## Task 1: 사막 테마 콘텐츠

**Files:**
- Modify: `lib/content/themes.ts`

**Interfaces:**
- Consumes: `EcologyRule`·`MonsterDef`·`BossDef`·`ThemeContent`(F1), `validateThemes`(F2-1)
- Produces: `DESERT_THEME: ThemeContent`

- [ ] **Step 1: `SPIDER_*` 상수 옆에 사막 생태 규칙 6개를 쓴다**

spec의 표를 그대로 옮긴다. `desert-heat`(비조건부) / `desert-lizard-heat`(조건부) / `desert-water`(비조건부) / `desert-spirit-dry`(조건부) / `desert-mummy-silent`(비조건부) / `desert-wind-track`(비조건부).

- [ ] **Step 2: 사막 몬스터 5종을 쓴다**

`desert-scorpion`(사막전갈) / `desert-lizard`(모래도마뱀) / `desert-cobra`(사막코브라) / `desert-spirit`(모래정령) / `desert-mummy`(미이라).

- [ ] **Step 3: 사막 보스 4종을 `minRiskLevel` 오름차순으로 쓴다**

거대 전갈 자카르(1) / 샌드웜 카르둠(2) / 모래거신 오벨론(3) / 스핑크스 네프리스(4). `baseDamage`·`maxHp`는 `SPIDER_BOSSES`와 같은 값(14/19/25/32, 100/150/210/280)을 구간별로 그대로 쓴다.

- [ ] **Step 4: `DESERT_THEME` 상수를 조립한다**

---

## Task 2: 묘지 테마 콘텐츠

**Files:**
- Modify: `lib/content/themes.ts`

**Interfaces:**
- Consumes: Task 1과 동일
- Produces: `GRAVEYARD_THEME: ThemeContent`

- [ ] **Step 1: 묘지 생태 규칙 6개를 쓴다**

`graveyard-silence`(비조건부) / `graveyard-ghoul-sound`(조건부) / `graveyard-light`(비조건부) / `graveyard-archer-light`(조건부) / `graveyard-guard`(비조건부) / `graveyard-desecration`(비조건부).

- [ ] **Step 2: 묘지 몬스터 5종을 쓴다**

`graveyard-zombie`(썩은 좀비) / `graveyard-ghoul`(구울) / `graveyard-soldier`(스켈레톤 병사) / `graveyard-archer`(스켈레톤 궁수) / `graveyard-mage`(해골 마법사).

- [ ] **Step 3: 묘지 보스 4종을 `minRiskLevel` 오름차순으로 쓴다**

스켈레톤 장군 바르칸(1) / 리치 모르비안(2) / 사신 아즈라엘(3) / 데스나이트 발드라크(4). 수치는 Task 1과 같은 값.

- [ ] **Step 4: `GRAVEYARD_THEME` 상수를 조립한다**

---

## Task 3: THEMES 배열 확장과 검증

**Files:**
- Modify: `lib/content/themes.ts`
- Modify: `lib/content/themes.test.ts`

**Interfaces:**
- Consumes: Task 1·2의 상수
- Produces: `THEMES`(길이 3), 갱신된 테스트

- [ ] **Step 1: `THEMES` 배열에 두 테마를 더한다**

```typescript
export const THEMES: readonly ThemeContent[] = [SPIDER_THEME, DESERT_THEME, GRAVEYARD_THEME];
```

`validateThemes(THEMES)`는 모듈 로드 시 이미 호출되고 있으므로 그대로 둔다. 계약 위반이 있으면 이 시점에 바로 예외가 던져진다.

- [ ] **Step 2: `themes.test.ts`의 "거미굴 하나만 있다" 테스트를 갱신한다**

`THEMES`가 이제 3개이고 `spider`·`desert`·`graveyard`를 모두 포함하는지 확인하도록 고친다.

- [ ] **Step 3: 사막·묘지용 `selectThemeBoss` 테스트를 추가한다**

`it.each`로 ★1~★5 각각의 기대 보스 이름을 확인하고, ★4·★5가 같은 보스로 묶이는지도 확인한다. 거미굴 테스트와 같은 구조를 반복한다.

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

```bash
npx vitest run lib/content/theme-validation.test.ts lib/content/themes.test.ts
```

---

## Task 4: 전체 검증과 배정표 갱신

**Files:**
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`

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

- [ ] **Step 3: `F2-2` 행을 ✅로 바꾸고 담당을 적는다**

- [ ] **Step 4: `C1`·`E2`·`E4`의 선행에서 `F2-2`를 지운다(`—`로)**

배정표 규약(완료된 ID는 예외 없이 모든 선행 칸에서 지운다)을 그대로 따른다. `F2-1`에서 이 규약을 잘못 적용했다가 검사가 잡은 적이 있으니 같은 실수를 반복하지 않는다.

- [ ] **Step 5: 문서 검사를 다시 돌려 확인한다**

```bash
npx vitest run docs/
```
