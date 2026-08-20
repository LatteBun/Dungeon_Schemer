# C1 캠페인 초기화·생태 패키지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시드 하나로 고정 던전 15개, 의미적으로 유효한 생태 패키지와 보스, 30명 캐릭터 풀, C등급 시작 자원을 가진 첫 `CampaignState`를 결정적으로 만든다.

**Architecture:** `campaign-dungeons.ts`가 시드와 무관한 15개 슬롯을 소유한다. `ThemeContent`의 생태 패키지는 규칙 3개와 출현 잡몹을 원자적으로 보관한다. `campaign-init.ts`는 같은 테마·같은 초기 위험도 안에서만 패키지를 섞어 새 상태를 만들며 C2의 공고·임시 파티·전이는 만들지 않는다.

**Tech Stack:** TypeScript strict, Vitest 4, 기존 `createRng`/`derive("ecology")`, 기존 콘텐츠 검증기와 `RuleError`.

**Spec:** `docs/superpowers/specs/2026-08-20-sanghwan-yoo-c1-campaign-initialization-design.md`

## Global Constraints

- 공개 API는 `initializeCampaign(seed: string): CampaignState` 하나다. 시간, 전역 가변 상태, `Math.random()`을 읽지 않는다.
- ID·이름·테마·초기 위험도는 모든 시드에서 동일하다. 같은 테마·같은 위험도의 두 슬롯에서만 패키지 배정이 바뀔 수 있다.
- 패키지는 활성 규칙과 출현 잡몹을 함께 보관한다. 임의의 규칙 조합이나 패키지 밖 잡몹을 만들지 않는다.
- ★1~3 프로필에는 조건부 규칙이 없고, ★4~5에는 하나 이상 있다.
- 모든 콘텐츠 결함은 재추첨·대체 없이 `RuleError("INVALID_GENERATION")`으로 실패한다.
- C2가 소유한 공고, 임시 3인 파티, 계약·상태 전이, UI·저장은 범위 밖이다.
- 새 의존성을 추가하지 않고, 커밋 제목과 본문은 한국어로 쓴다.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `lib/domain/ids.ts`, `lib/domain/dungeon.ts`, `lib/domain/index.ts` | 생태 패키지 ID·타입과 CampaignDungeon 필드 공개 |
| `lib/content/themes.ts`, `lib/content/theme-validation.ts` | 승인된 패키지 데이터와 참조·조건부 검증 |
| `lib/content/campaign-dungeons.ts` | 고정 15개 슬롯 |
| `lib/rules/campaign-init.ts` | 시드 기반 패키지 배정과 첫 CampaignState 생성 |
| 각 인접 `*.test.ts` | 콘텐츠 계약, 초기화 재현성, 실패 경로 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | 성공한 구현의 완료 기록 |

---

### Task 1: 생태 패키지를 도메인 계약으로 고정한다

**Files:**

- Modify: `lib/domain/ids.ts`
- Modify: `lib/domain/dungeon.ts`
- Modify: `lib/domain/index.ts`
- Modify: `lib/domain/contract.test.ts`
- Modify: `lib/content/theme-validation.test.ts`

**Interfaces:**

```ts
export type EcologyProfileId = Brand<string, "EcologyProfileId">;

export interface EcologyProfile {
  id: EcologyProfileId;
  theme: ThemeId;
  initialRiskLevel: RiskLevel;
  activeRuleIds: readonly RuleId[];
  activeMonsterIds: readonly MonsterId[];
}

export interface ThemeContent {
  ecologyProfiles: readonly EcologyProfile[];
}

export interface CampaignDungeon {
  ecologyProfileId: EcologyProfileId;
  activeMonsterIds: readonly MonsterId[];
}
```

- [x] **Step 1: 새 타입과 필드가 없음을 보이는 실패 테스트를 작성한다.**

`contract.test.ts`에서 새 ID·타입을 public barrel로 import해 fixture에 사용한다. `theme-validation.test.ts`의 `validTheme()`에는 유효한 프로필 5개를 넣어 `ThemeContent`가 새 필드를 요구함을 먼저 드러낸다. 각 fixture는 규칙 3개, 잡몹 1개 이상을 가지며 ★1~3에는 비조건부 규칙만, ★4~5에는 조건부 규칙을 포함한다.

Run: `pnpm typecheck`

Expected: FAIL. 새 공개 타입과 ThemeContent/CampaignDungeon 필드가 아직 없다.

- [x] **Step 2: ID·도메인 타입·재수출을 구현한다.**

`ids.ts`에 `EcologyProfileId` 브랜드를 `RuleId`·`MonsterId`와 함께 추가한다. `dungeon.ts`의 `MonsterDef` 뒤에 `EcologyProfile`을 선언하고, `ThemeContent`에 `ecologyProfiles`, `CampaignDungeon`에 `ecologyProfileId`와 `activeMonsterIds`를 `activeRuleIds` 인접 위치에 추가한다. `index.ts`에서 ID와 타입을 type export한다.

- [x] **Step 3: 도메인 계약을 검증한다.**

Run: `pnpm test lib/domain/contract.test.ts lib/content/theme-validation.test.ts && pnpm typecheck`

Expected: PASS. 새 fixture와 기존 도메인 계약이 strict typecheck를 통과한다.

- [x] **Step 4: 도메인 단위를 커밋한다.**

```bash
git add lib/domain/ids.ts lib/domain/dungeon.ts lib/domain/index.ts lib/domain/contract.test.ts lib/content/theme-validation.test.ts
git commit -m "도메인: 생태 패키지 계약을 추가한다" -m "던전에 패키지 식별자와 출현 몬스터를 기록해 규칙과 전투 후보의 의미 연결을 보존한다."
```

### Task 2: 승인된 패키지와 콘텐츠 검증을 구현한다

**Files:**

- Modify: `lib/content/themes.ts`
- Modify: `lib/content/theme-validation.ts`
- Modify: `lib/content/theme-validation.test.ts`
- Modify: `lib/content/themes.test.ts`

**Validation contract:** 테마당 프로필은 정확히 5개다. ID는 고유하고 프로필 테마는 상위 테마와 같아야 한다. 규칙은 해당 테마에 존재하는 고유한 정확히 3개, 잡몹은 해당 테마에 존재하는 고유한 1개 이상이다. 저위험도 프로필은 조건부 규칙이 없고 고위험도 프로필은 하나 이상 있다.

- [x] **Step 1: 검증기의 실패 케이스를 작성한다.**

`theme-validation.test.ts`에 프로필 4/6개, 중복 ID, 다른 테마, 규칙 2/4개·중복·미존재 ID, 빈/중복/미존재 잡몹, ★2 조건부 포함, ★4 조건부 부재를 각각 추가한다. 모든 케이스는 `RuleError` 코드가 `INVALID_GENERATION`이고 메시지가 생태 패키지 위반을 가리키는지 단정한다.

Run: `pnpm test lib/content/theme-validation.test.ts`

Expected: FAIL. 현재 검증기는 프로필 위반을 검사하지 않는다.

- [x] **Step 2: 프로필 검증기를 추가한다.**

`theme-validation.ts`에 `ECOLOGY_PROFILES_PER_THEME = 5`와 `validateEcologyProfiles(theme)`를 추가한다. `rules`와 `monsters`에서 만든 ID Set을 써서 아래 순서로 검사하고, 모든 오류는 기존 `invalid()`을 통해 `RuleError("INVALID_GENERATION")`으로 던진다.

1. 수량 5·고유 프로필 ID·테마 일치
2. `ACTIVE_ECOLOGY_RULES`와 같은 규칙 수·규칙 ID 고유성·규칙 존재
3. 비어 있지 않은 잡몹·잡몹 ID 고유성·잡몹 존재
4. 위험도 1~3의 조건부 부재와 4~5의 조건부 존재

details에는 `contentType: "ecologyProfile"`, `theme`, `profileId`, 기대·실제 값을 가능한 경우 모두 기록한다. `validateThemes()`에서 rules·monsters 검증 뒤 프로필 검증을 호출한다.

- [x] **Step 3: 승인된 15개 프로필을 `themes.ts`에 기록한다.**

각 테마의 rules·monsters 상수 뒤에 profile 상수를 두고 ThemeContent의 `ecologyProfiles`에 연결한다. 아래 표의 ID·위험도·규칙·잡몹을 변경하지 않는다.

| 테마 | `id` | 위험도 | 규칙 | 출현 잡몹 |
| --- | --- | :-: | --- | --- |
| 거미굴 | `spider-shallow-a` | 1 | fire, vibration, carrion | cave, corpse |
| 거미굴 | `spider-shallow-b` | 1 | fire, vibration, shadow | cave, shadow |
| 거미굴 | `spider-carrion-route` | 2 | fire, carrion, shadow | corpse, shadow |
| 거미굴 | `spider-dark-passage` | 3 | vibration, carrion, shadow | cave, corpse, shadow |
| 거미굴 | `spider-queens-forecourt` | 4 | brood-light, armor-vibration, shadow | hatchling, armored, shadow |
| 사막 | `desert-scorched-well` | 1 | heat, water, mummy-silent | cobra, scorpion, mummy |
| 사막 | `desert-wind-well` | 2 | heat, water, wind-track | cobra, scorpion |
| 사막 | `desert-buried-trail` | 2 | heat, mummy-silent, wind-track | cobra, mummy |
| 사막 | `desert-dry-trail` | 3 | water, mummy-silent, wind-track | scorpion, mummy |
| 사막 | `desert-burning-waste` | 4 | lizard-heat, spirit-dry, wind-track | lizard, spirit |
| 묘지 | `graveyard-quiet-guard` | 2 | silence, light, guard | zombie, mage, soldier |
| 묘지 | `graveyard-dim-crypt` | 3 | silence, light, desecration | zombie, mage |
| 묘지 | `graveyard-grave-robber` | 3 | silence, guard, desecration | zombie, soldier |
| 묘지 | `graveyard-hunters` | 4 | ghoul-sound, archer-light, guard | ghoul, archer, soldier |
| 묘지 | `graveyard-blighted-tomb` | 5 | ghoul-sound, archer-light, desecration | ghoul, archer |

표의 축약어는 실제 코드에서는 기존 완전 ID로 쓴다. 예를 들어 `fire`는 `spider-fire`, `ghoul-sound`는 `graveyard-ghoul-sound`다. 프로필 ID는 `EcologyProfileId`, 규칙·잡몹은 기존 브랜드 ID로 명시한다. 기존 설명·traits·보스 수치는 바꾸지 않는다.

- [x] **Step 4: 실제 테마 콘텐츠와 음수 검증을 통과시킨다.**

`themes.test.ts`에서 실제 `THEMES`의 프로필 5개, 규칙 3개, 비어 있지 않은 잡몹과 위험도별 조건부 규칙 제약을 별도로 검사한다.

Run: `pnpm test lib/content/theme-validation.test.ts lib/content/themes.test.ts && pnpm typecheck`

Expected: PASS. 승인된 세 테마는 통과하고 모든 잘못된 fixture는 `INVALID_GENERATION`으로 실패한다.

- [x] **Step 5: 콘텐츠 단위를 커밋한다.**

```bash
git add lib/content/themes.ts lib/content/theme-validation.ts lib/content/theme-validation.test.ts lib/content/themes.test.ts
git commit -m "콘텐츠: 테마 생태 패키지를 검증한다" -m "규칙 세 개와 출현 잡몹을 함께 보관해 조건부 규칙과 몬스터 의미를 보존한다."
```

### Task 3: 고정 던전 슬롯의 콘텐츠 계약을 만든다

**Files:**

- Create: `lib/content/campaign-dungeons.ts`
- Create: `lib/content/campaign-dungeons.test.ts`

**Interface:**

```ts
export interface CampaignDungeonSlot {
  id: DungeonId;
  name: string;
  theme: ThemeId;
  initialRiskLevel: RiskLevel;
}

export const INITIAL_DUNGEON_SLOTS: readonly CampaignDungeonSlot[];
```

- [x] **Step 1: 고정 슬롯 매트릭스의 실패 테스트를 작성한다.**

`campaign-dungeons.test.ts`에서 총 15개, ID 고유성, 테마별 5개, 전체 위험도 빈도 `3/4/4/3/1`, 슬롯 이름·ID의 번호순 정렬을 단정한다. 테마별 위험도는 거미굴 `[1, 1, 2, 3, 4]`, 사막 `[1, 2, 2, 3, 4]`, 묘지 `[2, 3, 3, 4, 5]`로 단정한다.

Run: `pnpm test lib/content/campaign-dungeons.test.ts`

Expected: FAIL. 슬롯 모듈과 export가 없다.

- [x] **Step 2: 시드와 무관한 15개 리터럴 슬롯을 구현한다.**

배열을 거미굴 1~5, 사막 1~5, 묘지 1~5 순서로 선언한다. 각 ID와 표시명은 생성식이 아닌 리터럴로 기록한다.

```ts
{ id: "dungeon-spider-01" as DungeonId, name: "거미굴 1", theme: "spider", initialRiskLevel: 1 }
```

나머지도 `dungeon-{theme}-02`부터 `-05`, `거미굴|사막|묘지 {번호}`를 사용하며 위험도는 Step 1의 배열과 일치시킨다. 이 콘텐츠 파일은 생태 프로필과 보스 선택 로직을 import하지 않는다.

- [x] **Step 3: 슬롯 테스트와 타입 검사를 통과시킨다.**

Run: `pnpm test lib/content/campaign-dungeons.test.ts && pnpm typecheck`

Expected: PASS.

- [x] **Step 4: 고정 슬롯 단위를 커밋한다.**

```bash
git add lib/content/campaign-dungeons.ts lib/content/campaign-dungeons.test.ts
git commit -m "콘텐츠: C1 고정 던전 슬롯을 정의한다" -m "세 테마의 ID·표시명·초기 위험도를 시드와 무관한 15개 슬롯으로 고정한다."
```

### Task 4: 결정적 C1 초기화 규칙과 실패 경로를 구현한다

**Files:**

- Create: `lib/rules/campaign-init.ts`
- Create: `lib/rules/campaign-init.test.ts`

**Interface:**

```ts
export function initializeCampaign(seed: string): CampaignState;
```

- [x] **Step 1: 초기화 규칙의 실패 테스트를 작성한다.**

`campaign-init.test.ts`는 다음을 검증한다.

- 동일 시드 두 결과는 deep equal이지만 최상위·풀·던전 배열 참조는 다르다.
- 시작값은 `intro`, C등급, 명성 30, 골드 10, 누적 골드 0, 빈 `offers`, worldTurn 0, null ending, 풀 30명, 던전 15개다.
- 각 던전은 고정 슬롯의 ID·이름·테마·초기 위험도와 같고 `riskLevel`도 같으며 `unexplored`, attempts 0이다.
- 프로필은 같은 테마·위험도이고 규칙·잡몹은 배정 프로필 배열과 같으며 보스는 `selectThemeBoss(theme, initialRiskLevel)`과 같다.
- 100개 시드에서 거미굴 ★1, 사막 ★2, 묘지 ★3의 각 두 슬롯은 그 위험도의 서로 다른 두 프로필을 중복 없이 배정받고, 그룹별 배정 순서가 최소 두 가지 나온다.

모듈 격리 `vi.mock()`으로 특정 테마·위험도 프로필 후보가 슬롯 수보다 적은 콘텐츠를 제공해, `initializeCampaign()`이 `RuleError` 코드 `INVALID_GENERATION`을 던지는지도 검증한다.

Run: `pnpm test lib/rules/campaign-init.test.ts`

Expected: FAIL. 초기화 모듈과 API가 없다.

- [x] **Step 2: 안전한 프로필 배정 보조 함수를 구현한다.**

`campaign-init.ts`는 `INITIAL_DUNGEON_SLOTS`, `THEMES`, `selectThemeBoss`, `generateCharacterPool`, 시작 상수, `createRng`, `RuleError`만 사용한다. 비공개 `themeById`, `profilesFor`, `assignProfiles`를 둔다.

`assignProfiles(seed)`는 슬롯을 테마·초기 위험도 그룹으로 나누고 후보 수가 슬롯 수와 정확히 같은지 확인한다. 각 그룹에서 `createRng(`${seed}/${themeId}`).derive("ecology")`의 `shuffle()`을 한 번 사용하고, 원래 슬롯 순서에 배정한다. 다른 테마·위험도 사이 이동은 금지한다. 테마 누락, 후보 수 불일치, 배정 누락은 모두 `RuleError("INVALID_GENERATION")`으로 실패하며 details에 `seed`, `theme`, `initialRiskLevel`, `expected`, `actual`을 남긴다.

- [x] **Step 3: 새 CampaignState를 조립한다.**

각 슬롯과 프로필에서 아래처럼 새 던전 객체를 만들고 배열은 복사해 콘텐츠와 참조를 공유하지 않게 한다.

```ts
{
  id: slot.id,
  name: slot.name,
  theme: slot.theme,
  initialRiskLevel: slot.initialRiskLevel,
  riskLevel: slot.initialRiskLevel,
  ecologyProfileId: profile.id,
  activeRuleIds: [...profile.activeRuleIds],
  activeMonsterIds: [...profile.activeMonsterIds],
  bossId: selectThemeBoss(theme, slot.initialRiskLevel).id,
  status: "unexplored",
  attempts: 0,
}
```

풀은 `generateCharacterPool(createRng(seed))`으로 만들고, 상태는 도메인 시작 상수와 빈 `offers`로 만든다. 공고·파티·상태 전이는 생성하지 않는다.

- [x] **Step 4: 초기화·오류 경로를 통과시킨다.**

Run: `pnpm test lib/rules/campaign-init.test.ts && pnpm typecheck`

Expected: PASS. 같은 시드는 동일하고, 다른 시드는 유효한 같은-위험도 교환만 만들며, 불완전 콘텐츠는 `INVALID_GENERATION`으로 중단한다.

- [x] **Step 5: 초기화 규칙 단위를 커밋한다.**

```bash
git add lib/rules/campaign-init.ts lib/rules/campaign-init.test.ts
git commit -m "규칙: C1 캠페인 초기화를 구현한다" -m "고정 슬롯에 같은 테마·위험도의 생태 패키지와 보스를 결정적으로 배정한다."
```

### Task 5: 완료 문서와 전체 검증을 동기화한다

**Files:**

- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Modify: `docs/superpowers/specs/2026-08-20-sanghwan-yoo-c1-campaign-initialization-design.md`
- Modify: `docs/README.md`

- [x] **Step 1: 성공한 구현만 문서에 완료로 기록한다.**

전체 코드 검증이 성공한 뒤에만 배정표 C1 상태를 `✅`로 바꾸고 고정 슬롯·생태 패키지·출현 잡몹·보스·시드 재현성을 충족했다고 기록한다. spec 상태는 `구현 완료`로 변경한다. 현재 설계와 plan 색인 링크는 유지하고, 과거 C1 기록과 C2 이후 범위는 수정하지 않는다.

- [x] **Step 2: 문서·코드 전체 품질 게이트를 실행한다.**

Run: `pnpm test docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Expected: PASS. 문서 링크와 용어, C1 단위 테스트와 전체 테스트, lint, strict typecheck, 프로덕션 빌드가 모두 성공한다.

- [x] **Step 3: 구현 범위와 금지 요소를 최종 점검한다.**

Run: `git diff --check && rg -n "TODO|TBD|Math\\.random\\(" lib/content/campaign-dungeons.ts lib/content/themes.ts lib/content/theme-validation.ts lib/rules/campaign-init.ts`

Expected: `git diff --check` 출력 없음. 새 C1 코드에서 금지 검색 결과가 없고, diff에 다른 테마·위험도 패키지 이동, C2 공고·파티 생성, UI·저장 코드가 없다.

- [x] **Step 4: 완료 문서 단위를 커밋한다.**

```bash
git add docs/README.md docs/superpowers/specs/2026-08-20-sanghwan-yoo-c1-campaign-initialization-design.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "문서: C1 초기화 구현 완료를 기록한다" -m "고정 슬롯과 생태 패키지의 결정적 초기화 검증 결과를 작업 배정표와 설계 문서에 반영한다."
```
