# 고정 캐릭터 로스터와 초상 매핑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

작성일: 2026-08-26

작성자: lattebun

작성 도구: Codex

**Goal:** 30명의 고정 캐릭터 정체성과 A~F live 초상을 단일 로스터에서 제공하고, 모든 캠페인 화면이 생사 상태와 무관하게 같은 인물 초상을 사용하게 한다.

**Architecture:** `lib/content/character-roster.ts`가 이름·고정 ID·직업·초상 변형을 소유하고, `generateCharacterPool()`은 이 로스터를 섞은 뒤 성격·신뢰·골드만 시드로 배정한다. `components/game/character-labels.ts`는 로스터 조회만으로 live 경로를 만들며, U3~U6 adapter는 그 단일 resolver를 사용한다. `CharacterId` 도메인 타입은 일반 branded string으로 유지하고, 공식 ID 검증은 로스터/초상 조회 경계에서만 수행한다.

**Tech Stack:** TypeScript 5, Vitest 4, React 19, Next.js 16, PNG 정적 자산, pnpm 11

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-character-fixed-roster-portraits-design.md`

## Global Constraints

- 공식 로스터는 5직업 × 6명, 정확히 30개의 고정 ID·이름·직업·`a`~`f` 변형을 가진다.
- 같은 구현 버전에서 같은 seed는 결정적이어야 한다. 전환 전 seed와 전환 후 seed의 신뢰·골드 값이 같을 필요는 없으며 더미 RNG 소비를 추가하지 않는다.
- 성격은 5종 × 6명, 초기 신뢰는 0~100, 초기 골드는 20~45, `alive=true`, `gravelyWounded=false`를 유지한다.
- 공식 초상은 `/assets/characters/live/{class}/{class}_{a|b|c|d|e|f}.png`뿐이다. `alive`는 경로를 바꾸지 않는다.
- 알 수 없는 ID는 초상 조회 경계에서 ID를 포함한 명시적 오류를 내며, 해시·placeholder fallback을 쓰지 않는다.
- 초상 resolver를 호출하지 않는 도메인·규칙 단위 테스트는 임의 `CharacterId`를 계속 사용할 수 있다.
- 원본 PNG는 재압축·리사이즈하지 않는다. 직업 내 원본 해상도 차이는 허용한다.
- `dead` 자산·런타임 참조·현행 공식/운영 문서 참조는 구현 완료 후 제거한다. 과거 spec/plan은 역사 기록으로 수정하지 않는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.
- PowerShell에서는 실행 정책 영향을 피하기 위해 모든 패키지 명령을 `pnpm.cmd`로 실행한다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `lib/content/character-roster.ts` | 30명 공식 정체성, `PortraitVariant`, 로스터 불변식 검증, ID 기반 strict 조회 |
| `lib/content/character-roster.test.ts` | 로스터 수·직업별 인원·A~F·고유성·ID 구성 계약 |
| `lib/content/character-pool.ts` | 로스터를 시드 순서로 섞고 상태만 랜덤 배정 |
| `lib/content/character-pool.test.ts` | 고정 정체성, 결정성, 기존 분포·범위 회귀 |
| `components/game/character-labels.ts` | 로스터 기반 variant/path resolver와 unknown-ID 오류 경계 |
| `components/game/u3-board-model.ts` | 주입 초상 override 없이 공식 resolver만 사용하는 U3 view model |
| `components/game/u4-dungeon-map-model.ts` | U4 view 변환만 소유; portrait resolver re-export 제거 |
| `components/game/campaign-adapters.ts`, `u5-preview-data.ts`, `u5-battle-preview-data.ts`, `u6-settlement-model.ts` | 중앙 resolver의 새 ID 기반 API를 호출하는 화면 adapter |
| `components/game/*portrait*.test.ts`, `app/u4-test/page.test.ts`, `components/game/U4Assets.test.ts` | live-only 경로, 사망 표현, 30개 PNG 계약 |
| `public/assets/characters/live/*/*_{c,d,e,f}.png` | 사용자가 준비한 20개 원본 PNG |
| `docs/systems/CHARACTER_POOL_AND_WORLDTURN.md`, `docs/experience/*.md`, `docs/technical/DEFERRED_WORK.md`, `docs/README.md` | 고정 로스터·live-only 계약과 문서 색인 |

---

### Task 1: 공식 로스터 콘텐츠와 불변식 추가

**Files:**

- Create: `lib/content/character-roster.ts`
- Create: `lib/content/character-roster.test.ts`
- Remove: `lib/content/character-names.ts`
- Remove: `lib/content/character-names.test.ts`

**Interfaces:**

- Consumes: `CharacterId`, `ClassId`, `CHARACTER_POOL_SIZE`, `CHARACTERS_PER_CLASS`.
- Produces: `PortraitVariant`, `CharacterRosterEntry`, `CHARACTER_ROSTER`, `characterRosterEntryFor(characterId)`.

- [ ] **Step 1: 로스터 불변식의 실패 테스트를 작성한다**

`character-roster.test.ts`에서 아래 검사를 작성한다. 테스트의 기대 로스터는 Spec 표의 30개 행을 `id/name/classId/portraitVariant`로 명시해, 순서 또는 이름 변경도 검출한다.

```ts
expect(CHARACTER_ROSTER).toHaveLength(CHARACTER_POOL_SIZE);
expect(new Set(CHARACTER_ROSTER.map((entry) => entry.id)).size).toBe(30);
expect(new Set(CHARACTER_ROSTER.map((entry) => entry.name)).size).toBe(30);

for (const classDef of CLASSES) {
  const entries = CHARACTER_ROSTER.filter((entry) => entry.classId === classDef.id);
  expect(entries).toHaveLength(CHARACTERS_PER_CLASS);
  expect(entries.map((entry) => entry.portraitVariant).sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
}

expect(characterRosterEntryFor("character-mage-f" as CharacterId)).toMatchObject({
  name: "이반드로", classId: "mage", portraitVariant: "f",
});
expect(() => characterRosterEntryFor("fixture-member" as CharacterId))
  .toThrow(/공식 캐릭터 로스터에 없는 ID: fixture-member/);
```

- [ ] **Step 2: 실패를 확인한다**

Run:

```powershell
pnpm.cmd vitest run lib/content/character-roster.test.ts
```

Expected: FAIL — `character-roster` 모듈 또는 export가 아직 없다.

- [ ] **Step 3: 단일 공식 로스터와 strict 조회를 구현한다**

`character-roster.ts`에 아래 형태의 API를 만든다. `CHARACTER_ROSTER`에는 Spec 표의 30개 행을 직업 순서 `warrior`, `archer`, `cleric`, `mage`, `rogue`와 variant 순서 `a`~`f`로 모두 적는다. `CharacterId`를 유니온으로 바꾸지 않는다.

```ts
export const PORTRAIT_VARIANTS = ["a", "b", "c", "d", "e", "f"] as const;
export type PortraitVariant = (typeof PORTRAIT_VARIANTS)[number];

export interface CharacterRosterEntry {
  readonly id: CharacterId;
  readonly name: string;
  readonly classId: ClassId;
  readonly portraitVariant: PortraitVariant;
}

export const CHARACTER_ROSTER: readonly CharacterRosterEntry[] = [
  { id: "character-warrior-a" as CharacterId, name: "가론", classId: "warrior" as ClassId, portraitVariant: "a" },
  { id: "character-warrior-b" as CharacterId, name: "라이문드", classId: "warrior" as ClassId, portraitVariant: "b" },
  { id: "character-warrior-c" as CharacterId, name: "바스티안", classId: "warrior" as ClassId, portraitVariant: "c" },
  { id: "character-warrior-d" as CharacterId, name: "하르멜", classId: "warrior" as ClassId, portraitVariant: "d" },
  { id: "character-warrior-e" as CharacterId, name: "헬가", classId: "warrior" as ClassId, portraitVariant: "e" },
  { id: "character-warrior-f" as CharacterId, name: "브릭스턴", classId: "warrior" as ClassId, portraitVariant: "f" },
  { id: "character-archer-a" as CharacterId, name: "네리사", classId: "archer" as ClassId, portraitVariant: "a" },
  { id: "character-archer-b" as CharacterId, name: "다이린", classId: "archer" as ClassId, portraitVariant: "b" },
  { id: "character-archer-c" as CharacterId, name: "파에린", classId: "archer" as ClassId, portraitVariant: "c" },
  { id: "character-archer-d" as CharacterId, name: "노엘라", classId: "archer" as ClassId, portraitVariant: "d" },
  { id: "character-archer-e" as CharacterId, name: "실바나", classId: "archer" as ClassId, portraitVariant: "e" },
  { id: "character-archer-f" as CharacterId, name: "카트린", classId: "archer" as ClassId, portraitVariant: "f" },
  { id: "character-cleric-a" as CharacterId, name: "마요라", classId: "cleric" as ClassId, portraitVariant: "a" },
  { id: "character-cleric-b" as CharacterId, name: "세라핀", classId: "cleric" as ClassId, portraitVariant: "b" },
  { id: "character-cleric-c" as CharacterId, name: "이졸데", classId: "cleric" as ClassId, portraitVariant: "c" },
  { id: "character-cleric-d" as CharacterId, name: "로자린드", classId: "cleric" as ClassId, portraitVariant: "d" },
  { id: "character-cleric-e" as CharacterId, name: "제라딘", classId: "cleric" as ClassId, portraitVariant: "e" },
  { id: "character-cleric-f" as CharacterId, name: "미라벨", classId: "cleric" as ClassId, portraitVariant: "f" },
  { id: "character-mage-a" as CharacterId, name: "아드리크", classId: "mage" as ClassId, portraitVariant: "a" },
  { id: "character-mage-b" as CharacterId, name: "타리엘", classId: "mage" as ClassId, portraitVariant: "b" },
  { id: "character-mage-c" as CharacterId, name: "베로니크", classId: "mage" as ClassId, portraitVariant: "c" },
  { id: "character-mage-d" as CharacterId, name: "사이러스", classId: "mage" as ClassId, portraitVariant: "d" },
  { id: "character-mage-e" as CharacterId, name: "루시안", classId: "mage" as ClassId, portraitVariant: "e" },
  { id: "character-mage-f" as CharacterId, name: "이반드로", classId: "mage" as ClassId, portraitVariant: "f" },
  { id: "character-rogue-a" as CharacterId, name: "카심", classId: "rogue" as ClassId, portraitVariant: "a" },
  { id: "character-rogue-b" as CharacterId, name: "델런", classId: "rogue" as ClassId, portraitVariant: "b" },
  { id: "character-rogue-c" as CharacterId, name: "무렌", classId: "rogue" as ClassId, portraitVariant: "c" },
  { id: "character-rogue-d" as CharacterId, name: "오린", classId: "rogue" as ClassId, portraitVariant: "d" },
  { id: "character-rogue-e" as CharacterId, name: "코르빈", classId: "rogue" as ClassId, portraitVariant: "e" },
  { id: "character-rogue-f" as CharacterId, name: "펠릭스", classId: "rogue" as ClassId, portraitVariant: "f" },
] as const;

export function characterRosterEntryFor(characterId: CharacterId): CharacterRosterEntry {
  const entry = rosterById.get(characterId);
  if (entry === undefined) {
    throw new Error(`공식 캐릭터 로스터에 없는 ID: ${characterId}`);
  }
  return entry;
}
```

모듈 내부에서 30명 수, 이름·ID 고유성, 직업별 6명, 직업별 A~F, `character-{class}-{variant}` ID 구성과 필드 일치를 검증한 뒤 `rosterById`를 만든다. 불변식이 깨진 정적 콘텐츠는 import 시 즉시 오류를 내야 한다.

- [ ] **Step 4: 로스터 테스트를 통과시킨다**

Run:

```powershell
pnpm.cmd vitest run lib/content/character-roster.test.ts
```

Expected: PASS — 30개 행, 각 직업의 A~F, 이름·ID 고유성, strict unknown-ID 오류가 모두 검증된다.

- [ ] **Step 5: 이전 이름 후보 모듈을 제거하고 콘텐츠 단위로 커밋한다**

`character-names.ts`와 전용 테스트를 삭제한다. 다른 파일의 import가 남지 않았음을 확인한다.

```powershell
rg -n 'character-names|CHARACTER_NAMES' lib components app e2e
git add -- lib/content/character-roster.ts lib/content/character-roster.test.ts lib/content/character-names.ts lib/content/character-names.test.ts
git commit -m "콘텐츠: 고정 캐릭터 로스터를 추가한다" -m "30명의 이름·직업·초상 변형을 단일 로스터로 정의하고 공식 ID 조회 계약을 검증한다."
```

Expected: 검색 결과 0개, 로스터 콘텐츠만 포함한 커밋 1개.

### Task 2: 캐릭터 풀을 로스터 기반 결정적 생성으로 전환

**Files:**

- Modify: `lib/content/character-pool.ts`
- Modify: `lib/content/character-pool.test.ts`

**Interfaces:**

- Consumes: Task 1의 `CHARACTER_ROSTER`, `characterRosterEntryFor`, 기존 `CLASSES`, `Rng`.
- Produces: 기존 `generateCharacterPool(rng): CharacterPool`; 각 `Character.id/name/classId`는 로스터와 일치한다.

- [ ] **Step 1: 고정 정체성 및 랜덤 상태 분리의 실패 테스트를 작성한다**

`character-pool.test.ts`에 다음을 추가한다.

```ts
const first = generateCharacterPool(createRng("roster-seed-a"));
const second = generateCharacterPool(createRng("roster-seed-b"));

for (const entry of CHARACTER_ROSTER) {
  expect(first.byId[entry.id]).toMatchObject({
    id: entry.id, name: entry.name, classId: entry.classId,
  });
  expect(second.byId[entry.id]).toMatchObject({
    id: entry.id, name: entry.name, classId: entry.classId,
  });
}
expect(first.order).not.toEqual(second.order);
```

기존 테스트에는 성격 5종 × 6명, 신뢰 0~100, 골드 20~45, 초기 생존/중상 상태, 같은 seed 재현성을 그대로 둔다. 전환 전과 같은 seed의 정확한 신뢰·골드를 비교하는 expectation은 작성하지 않는다.

- [ ] **Step 2: 실패를 확인한다**

Run:

```powershell
pnpm.cmd vitest run lib/content/character-pool.test.ts
```

Expected: FAIL — 현재 `character-001`~`character-030` ID와 독립 이름 shuffle이 로스터 기대값과 다르다.

- [ ] **Step 3: 로스터 shuffle 뒤 상태만 배정하도록 구현한다**

`generateCharacterPool()`에서 `classSlots`와 `CHARACTER_NAMES`를 제거한다. `pool` stream으로 아래 순서를 구현한다.

```ts
const shuffledRoster = pool.shuffle(CHARACTER_ROSTER);
const shuffledPersonalities = pool.shuffle(personalitySlots);

for (const [index, entry] of shuffledRoster.entries()) {
  const classDef = CLASSES.find((candidate) => candidate.id === entry.classId);
  if (classDef === undefined) throw new Error(`로스터 직업을 찾을 수 없다: ${entry.classId}`);
  const personality = shuffledPersonalities[index]!;
  // 기존 TRUST_BASE_BY_PERSONALITY, -5~+5 spread, GOLD_MIN~GOLD_MAX를 그대로 사용한다.
  byId[entry.id] = {
    id: entry.id, name: entry.name, classId: entry.classId,
    personality, maxHp: classDef.maxHp, hp: classDef.maxHp,
    trust, gold, alive: true, gravelyWounded: false,
  };
  order.push(entry.id);
}
```

이름 후보 shuffle을 보존하기 위한 호출은 추가하지 않는다. `byId`에는 고정 ID를 키로 사용하고 `order`만 campaign seed에 따라 바꾼다.

- [ ] **Step 4: 풀·초기화 회귀를 통과시킨다**

Run:

```powershell
pnpm.cmd vitest run lib/content/character-roster.test.ts lib/content/character-pool.test.ts lib/rules/campaign-init.test.ts lib/store/campaign-reproducibility.test.ts
```

Expected: PASS — 고정 정체성과 기존 분포/범위/결정성 모두 통과한다.

- [ ] **Step 5: 풀 생성 변경을 커밋한다**

```powershell
git add -- lib/content/character-pool.ts lib/content/character-pool.test.ts
git commit -m "콘텐츠: 캐릭터 풀을 고정 로스터에서 생성한다" -m "인물의 이름·직업·ID는 고정하고 성격·신뢰·골드·표시 순서만 시드로 배정한다."
```

### Task 3: 중앙 초상 resolver를 strict live-only API로 전환하고 U3 우회를 제거

**Files:**

- Modify: `components/game/character-labels.ts`
- Modify: `components/game/u3-board-model.ts`
- Modify: `components/game/u3-board-model.test.ts`
- Modify: `components/game/u4-dungeon-map-model.ts`
- Modify: `components/game/u4-dungeon-map-model.test.ts`

**Interfaces:**

- Consumes: Task 1의 `PortraitVariant`, `characterRosterEntryFor`.
- Produces: `portraitVariantForCharacterId(characterId): PortraitVariant`, `portraitSrcForCharacterId(characterId): string`, `portraitSrcForCharacter({ id }): string`.

- [ ] **Step 1: live-only 경로·unknown ID·U3 단일 경로의 실패 테스트를 작성한다**

`u4-dungeon-map-model.test.ts`의 해시·dead 경로 테스트를 다음 계약으로 바꾼다.

```ts
const id = "character-cleric-d" as CharacterId;
expect(portraitVariantForCharacterId(id)).toBe("d");
expect(portraitSrcForCharacterId(id))
  .toBe("/assets/characters/live/cleric/cleric_d.png");
expect(() => portraitSrcForCharacterId("fixture-member" as CharacterId))
  .toThrow(/공식 캐릭터 로스터에 없는 ID: fixture-member/);
```

`u3-board-model.test.ts`에서는 세 번째 `portraitByCharacterId` 인자 사용 테스트를 제거하고, 실제 공고 멤버의 `portraitSrc`가 그 ID의 공식 live path와 같은지 검증한다.

```ts
const member = firstDetail?.party.find((one) => one.id === firstMemberId);
expect(member?.portraitSrc).toBe(portraitSrcForCharacterId(firstMemberId));
```

- [ ] **Step 2: 실패를 확인한다**

Run:

```powershell
pnpm.cmd vitest run components/game/u3-board-model.test.ts components/game/u4-dungeon-map-model.test.ts
```

Expected: FAIL — 현재 resolver는 해시 A/B와 `alive` 기반 `dead` 폴더를 사용하고 U3 override를 받는다.

- [ ] **Step 3: resolver API와 U3/U4 경계를 구현한다**

`character-labels.ts`에서 FNV hash와 `lifeFolder`를 제거한다.

```ts
export function portraitVariantForCharacterId(characterId: CharacterId): PortraitVariant {
  return characterRosterEntryFor(characterId).portraitVariant;
}

export function portraitSrcForCharacterId(characterId: CharacterId): string {
  const { classId, portraitVariant } = characterRosterEntryFor(characterId);
  return `/assets/characters/live/${classId}/${classId}_${portraitVariant}.png`;
}

export function portraitSrcForCharacter(input: Pick<Character, "id">): string {
  return portraitSrcForCharacterId(input.id);
}
```

`u3-board-model.ts`에서 `U3PortraitMap`과 세 번째 `portraitByCharacterId` 매개변수를 제거하고, 각 실제 멤버에 `portraitSrcForCharacterId(character.id)`를 직접 사용한다. `u4-dungeon-map-model.ts`에서는 resolver re-export를 제거하고 U4 view 변환에 필요한 `portraitSrcForCharacter(character)`만 import한다. 테스트도 `character-labels.ts`에서 resolver를 import한다.

- [ ] **Step 4: resolver와 U3/U4 모델 테스트를 통과시킨다**

Run:

```powershell
pnpm.cmd vitest run components/game/u3-board-model.test.ts components/game/u4-dungeon-map-model.test.ts components/game/U3BoardScreen.test.ts components/game/U4DungeonMapScreen.test.tsx
```

Expected: PASS — U3가 공식 path를 쓰고 U4 사망 카드도 같은 live path와 별도 `is-dead` 표현을 사용한다.

- [ ] **Step 5: 중앙 resolver 정리를 커밋한다**

```powershell
git add -- components/game/character-labels.ts components/game/u3-board-model.ts components/game/u3-board-model.test.ts components/game/u4-dungeon-map-model.ts components/game/u4-dungeon-map-model.test.ts
git commit -m "화면: 캐릭터 초상을 공식 로스터로 조회한다" -m "해시와 사망 이미지 경로를 제거하고 U3부터 U4까지 단일 live 초상 resolver를 사용한다."
```

### Task 4: U4~U6 adapter·preview·화면 fixture를 새 resolver 계약으로 이행

**Files:**

- Modify: `components/game/campaign-adapters.ts`
- Modify: `components/game/u5-preview-data.ts`
- Modify: `components/game/u5-battle-preview-data.ts`
- Modify: `components/game/u6-settlement-model.ts`
- Modify: `components/game/u4-preview-data.test.ts`
- Modify: `app/u4-test/page.test.ts`
- Modify: `components/game/U4DungeonMapScreen.test.tsx`
- Modify: `components/game/campaign-adapters.test.ts`
- Modify: `components/game/campaign-render.test.tsx`

**Interfaces:**

- Consumes: Task 3의 `portraitSrcForCharacterId` 또는 `{ id }`만 받는 `portraitSrcForCharacter`.
- Produces: U3·U4·U5·U6에서 생존/사망 여부와 무관한 같은 official live `portraitSrc`.

- [ ] **Step 1: 사망 전후 같은 경로를 요구하는 실패 테스트를 작성한다**

U4 preview/page/screen fixture의 dead PNG expectation을 아래처럼 바꾼다. fixture ID는 공식 로스터 ID로 바꾼다.

```ts
const live = createU4PreviewData({ deadPreview: false });
const dead = createU4PreviewData({ deadPreview: true });
const deadMember = dead.party.find((member) => !member.alive)!;
const liveMember = live.party.find((member) => member.id === deadMember.id)!;

expect(deadMember.portraitSrc).toBe(liveMember.portraitSrc);
expect(deadMember.portraitSrc).toContain("/assets/characters/live/");
expect(deadMember.portraitSrc).not.toContain("/characters/dead/");
```

`app/u4-test/page.test.ts`와 `U4DungeonMapScreen.test.tsx`는 `party-card is-dead`와 `사망` 텍스트는 계속 기대하되 `/characters/dead/` expectation은 제거한다. U5 battle replay fixture의 문자열 경로는 presentation-only 입력이므로 공식 로스터 path를 사용하되 `party-1` 같은 battle participant ID는 변경하지 않는다.

- [ ] **Step 2: 실패를 확인한다**

Run:

```powershell
pnpm.cmd vitest run components/game/u4-preview-data.test.ts app/u4-test/page.test.ts components/game/U4DungeonMapScreen.test.tsx components/game/campaign-adapters.test.ts components/game/campaign-render.test.tsx
```

Expected: FAIL — adapter literal이 이전 `{ id, classId, alive }` API를 호출하거나 dead 경로 expectation이 남아 있다.

- [ ] **Step 3: 모든 생산 코드 호출을 ID 기반 resolver로 바꾼다**

다음 패턴을 적용한다.

```ts
// 이전
portraitSrcForCharacter({ id: member.id, classId: member.classId, alive: member.alive });

// 이후
portraitSrcForCharacterId(member.id);
```

`campaign-adapters.ts`의 전투 재생 호출은 기존처럼 전투 시작 당시 멤버 ID를 사용한다. 따라서 사망 결과가 난 멤버도 첫 프레임부터 죽은 이미지가 되지 않는다. `u5-battle-preview-data.ts`는 U4 model re-export 대신 `character-labels.ts`에서 직접 import한다. `u6-settlement-model.ts`는 사망자를 포함해 같은 live path를 넣고 `alive` 필드는 그대로 전달한다.

- [ ] **Step 4: 화면 adapter 회귀를 통과시킨다**

Run:

```powershell
pnpm.cmd vitest run components/game/campaign-adapters.test.ts components/game/campaign-render.test.tsx components/game/u4-preview-data.test.ts app/u4-test/page.test.ts components/game/U4DungeonMapScreen.test.tsx components/game/U5BattleScene.test.tsx components/game/U6SettlementScreen.test.ts
```

Expected: PASS — U3~U6 path가 live-only이고 사망의 CSS/텍스트 표현과 전투 replay 의미가 유지된다.

- [ ] **Step 5: adapter 이행을 커밋한다**

```powershell
git add -- components/game/campaign-adapters.ts components/game/u5-preview-data.ts components/game/u5-battle-preview-data.ts components/game/u6-settlement-model.ts components/game/u4-preview-data.test.ts app/u4-test/page.test.ts components/game/U4DungeonMapScreen.test.tsx components/game/campaign-adapters.test.ts components/game/campaign-render.test.tsx components/game/u5-battle-replay.test.ts components/game/u5-battle-test-fixture.ts components/game/U5BattleScene.test.tsx components/game/U6SettlementScreen.test.ts
git commit -m "화면: 사망 상태에도 같은 초상을 유지한다" -m "U4부터 U6까지 공식 live 경로를 공유하고 사망은 기존 상태 스타일과 문구로만 표현한다."
```

### Task 5: 30개 live 자산 계약과 현행 문서를 갱신

**Files:**

- Verify: `public/assets/characters/live/archer/archer_{c,d,e,f}.png`
- Verify: `public/assets/characters/live/cleric/cleric_{c,d,e,f}.png`
- Verify: `public/assets/characters/live/mage/mage_{c,d,e,f}.png`
- Verify: `public/assets/characters/live/rogue/rogue_{c,d,e,f}.png`
- Verify: `public/assets/characters/live/warrior/warrior_{c,d,e,f}.png`
- Remove: `public/assets/characters/dead/`
- Modify: `components/game/U4Assets.test.ts`
- Modify: `docs/systems/CHARACTER_POOL_AND_WORLDTURN.md`
- Modify: `docs/experience/CHARACTER_UI_ASSETS.md`
- Modify: `docs/experience/U4_DUNGEON_MAP.md`
- Modify: `docs/technical/DEFERRED_WORK.md`
- Modify: `docs/README.md`
- Modify: `docs/DOCUMENT_LINKS.test.ts` only if the new README links require an explicit assertion.

**Interfaces:**

- Consumes: 사용자가 원본으로 준비한 C~F PNG 20개와 Task 1의 로스터.
- Produces: 5직업 × A~F 30개 live PNG, dead directory 없는 문서·자산 계약.

- [ ] **Step 1: 파일 조합과 PNG 유효성의 실패 테스트를 작성한다**

`U4Assets.test.ts`의 dead 파일 존재 assertion을 삭제하고, 모든 로스터 항목의 live path 존재와 PNG signature를 검사한다.

```ts
import { readFileSync, existsSync } from "node:fs";
import { CHARACTER_ROSTER } from "@/lib/content/character-roster";

for (const entry of CHARACTER_ROSTER) {
  const path = `public/assets/characters/live/${entry.classId}/${entry.classId}_${entry.portraitVariant}.png`;
  expect(existsSync(path)).toBe(true);
  expect(readFileSync(path).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}
expect(existsSync("public/assets/characters/dead")).toBe(false);
```

동일 해상도를 검사하지 않는다. A~F 모두가 U4 `cover` slot에 적합한지 시각 검증에서 판단한다.

- [ ] **Step 2: 실패를 확인한다**

Run:

```powershell
pnpm.cmd vitest run components/game/U4Assets.test.ts
```

Expected: FAIL — C~F 파일은 이미 존재하지만 `dead` 디렉터리가 남아 있다.

- [x] **Step 3: 원본 C~F PNG를 브랜치에 추가한다**

승인된 원본 20개를 각 직업의 기존 `live` 디렉터리에 정확히 아래 이름으로 복사했다. 변환, 리사이즈, 재저장을 하지 않았으며, 원본 SHA-256과 PNG signature가 일치하는지 확인했다.

```text
archer_{c,d,e,f}.png   cleric_{c,d,e,f}.png   mage_{c,d,e,f}.png
rogue_{c,d,e,f}.png    warrior_{c,d,e,f}.png
```

완료 커밋: `6ccf0f9` (`자산: 캐릭터 live 초상 C부터 F를 추가한다`).

- [ ] **Step 4: 모든 dead 참조 제거 뒤 dead 자산을 삭제한다**

모든 생산 코드와 현행 문서에서 dead 참조가 제거된 뒤에만 정확한 대상 `public/assets/characters/dead`를 삭제한다. 삭제 직전 `Get-ChildItem public/assets/characters/dead -Recurse -File`로 10개 기존 A/B PNG만 있는지 확인한다.

- [ ] **Step 5: 공식·운영 문서를 새 계약으로 갱신한다**

다음 내용을 한 번만 직접 소유하고 나머지 문서는 연결한다.

- `CHARACTER_UI_ASSETS.md`: 경로를 live-only A~F로 바꾸고, 30개 공식 자산·로스터 소유·사망 UI 효과·혼합 원본 해상도 허용·`object-fit` 기준을 기록한다.
- `CHARACTER_POOL_AND_WORLDTURN.md`: 이름·직업·초상은 고정, 성격·신뢰·골드·표시 순서는 seed로 배정된다고 고친다. 이름·직업·성격이 모두 중복되지 않는다는 문장을 제거한다.
- `U4_DUNGEON_MAP.md`: A/B와 dead 파일 경로를 A~F live-only로 바꾸고, 사망은 grayscale·`사망` 텍스트로만 표현한다고 고친다.
- `DEFERRED_WORK.md`: 완료된 `캐릭터 고유 초상` 항목 전체를 삭제한다.
- `docs/README.md`: 이번 개편 설계 목록에 Spec과 이 Plan의 상대 링크를 각각 한 번 추가한다.

- [ ] **Step 6: 자산·문서 계약을 통과시키고 커밋한다**

Run:

```powershell
pnpm.cmd vitest run components/game/U4Assets.test.ts docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts
rg -n -g '!docs/superpowers/**' -g '!node_modules/**' '/characters/dead/|\{live\|dead\}|\{a\|b\}' docs components app lib
```

Expected: 테스트 PASS, 현행 문서·코드 검색 결과 0개.

```powershell
git add -- public/assets/characters/dead components/game/U4Assets.test.ts docs/systems/CHARACTER_POOL_AND_WORLDTURN.md docs/experience/CHARACTER_UI_ASSETS.md docs/experience/U4_DUNGEON_MAP.md docs/technical/DEFERRED_WORK.md docs/README.md docs/DOCUMENT_LINKS.test.ts
git commit -m "문서: 캐릭터 초상 live 전용 계약을 반영한다" -m "사망 이미지 자산을 제거하고 고정 로스터의 30개 live 초상 계약을 현행 문서와 검증에 반영한다."
```

### Task 6: 통합 검증과 시각 QA

**Files:**

- Verify: `lib/content/character-roster.test.ts`, `lib/content/character-pool.test.ts`
- Verify: `components/game/character-labels.ts` 소비자와 U3~U6 테스트
- Verify: `public/assets/characters/live/`
- Verify: `docs/experience/CHARACTER_UI_ASSETS.md`

**Interfaces:**

- Consumes: Task 1~5의 콘텐츠, 화면 adapter, 자산, 문서.
- Produces: 구현 범위가 Spec의 완료 조건을 만족한다는 검증 기록.

- [ ] **Step 1: 정적 계약과 타입 검사를 실행한다**

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd vitest run lib/content/character-roster.test.ts lib/content/character-pool.test.ts components/game/u3-board-model.test.ts components/game/u4-dungeon-map-model.test.ts components/game/U4Assets.test.ts components/game/campaign-adapters.test.ts components/game/campaign-render.test.tsx components/game/U4DungeonMapScreen.test.tsx components/game/U5BattleScene.test.tsx components/game/U6SettlementScreen.test.ts docs/DOCUMENT_LINKS.test.ts docs/DOCUMENT_TERMINOLOGY.test.ts
```

Expected: lint/typecheck exit 0, 지정 테스트 0 failures.

- [ ] **Step 2: dead 경로·자산 수·구현 전 기준선을 재검증한다**

```powershell
$pngs = Get-ChildItem public/assets/characters/live -Recurse -Filter *.png
if ($pngs.Count -ne 30) { throw "live PNG count: $($pngs.Count)" }
rg -n -g '!docs/superpowers/**' -g '!node_modules/**' '/characters/dead/' docs components app lib
pnpm.cmd test
```

Expected: live PNG 30개, dead 경로 검색 0개, 전체 테스트 PASS. 백테스트가 기존 5초 timeout으로 실패하면 timeout 상향이나 백테스트 변경을 하지 말고, 실패 파일·test name·실행 시간·Task 1~5 관련 여부를 PR에 분리 기록한다.

- [ ] **Step 3: 실제 브라우저에서 A~F와 사망 상태를 확인한다**

개발 서버를 실행한 뒤 다음을 확인한다.

```powershell
pnpm.cmd dev
```

- `/u4-test`와 `/u4-test?dead=1`에서 같은 파티원의 src가 live path로 유지되는지, `dead=1`에서만 grayscale와 `사망`이 함께 보이는지 확인한다.
- 실제 campaign U3·U4·U5·U6 흐름에서 각 직업 A~F 이미지가 깨지지 않고 렌더되는지 확인한다.
- 1920×1080과 1440×900에서 `object-fit: cover` 슬롯의 얼굴·장비·실루엣이 과도하게 잘리지 않는지 확인한다.
- 모든 화면에서 신뢰 0·중상만으로 `is-dead` 또는 grayscale 사망 표현이 생기지 않는지 확인한다.

브라우저 확인이 끝나면 서버를 종료한다.

- [ ] **Step 4: 최종 범위를 확인하고 검증 커밋을 만든다**

```powershell
git diff --check
git status --short
git diff origin/main...HEAD --stat
git add -- docs/superpowers/plans/2026-08-26-lattebun-character-fixed-roster-portraits.md
git commit -m "계획: 고정 캐릭터 로스터 구현 순서를 기록한다" -m "로스터 콘텐츠, live 초상 조회, 화면 이행, 자산과 문서 검증의 실행 순서를 남긴다."
```

Expected: 허용된 로스터·풀·resolver·U3~U6·자산·문서·테스트·Spec·Plan만 변경 목록에 존재한다.

## Spec Coverage Review

- 30명 고정 ID·이름·직업·A~F와 불변식: Task 1.
- 로스터 shuffle 및 성격·신뢰·골드·표시 순서의 결정적 랜덤화: Task 2.
- pre-migration seed 값 비호환과 더미 RNG 금지: Task 2의 테스트/구현.
- live-only strict portrait resolver와 unknown-ID 오류: Task 3.
- U3 override 제거와 U4~U6 생사 동일 경로: Task 3~4.
- 20개 신규 원본 PNG, dead 자산 제거, 해상도 차이 허용: Task 5.
- 공식·운영 문서 갱신 및 유예 항목 제거: Task 5.
- 단위·통합·전체·브라우저 검증과 기존 timeout 분리 기록: Task 6.

## Plan Self-Review

- Placeholder scan: 완료. `TBD`, `TODO`, placeholder 표기를 사용하지 않았다.
- Type consistency: 모든 consumer는 `portraitSrcForCharacterId(CharacterId)` 또는 `portraitSrcForCharacter(Pick<Character, "id">)`만 사용한다.
- Scope check: CharacterId 도메인 타입, 성격/신뢰/전투 규칙, 신규 UI 레이아웃, 캠페인 저장 기능은 변경하지 않는다.
