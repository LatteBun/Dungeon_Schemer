# 고정 캐릭터 로스터 성별·이름 정비 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공식 캐릭터 30명의 성별 메타데이터와 승인된 유럽 판타지풍 이름을 고정 로스터에 반영한다.

**Architecture:** `lib/content/character-roster.ts`가 ID·이름·성별·직업·초상 변형의 유일한 소유자로 남는다. 성별은 콘텐츠 메타데이터로만 추가하고 `generateCharacterPool`이 만드는 도메인 `Character`, Store, UI, RNG에는 복사하지 않는다. 기존 ID와 A–F 초상 매핑을 유지하므로 이미지 경로와 시드 소비 순서는 변하지 않는다.

**Tech Stack:** TypeScript 5, Vitest 4, pnpm 11, Markdown 공식 설정집

**Spec:** `docs/superpowers/specs/2026-08-26-lattebun-character-roster-gender-names-design.md`

## Global Constraints

- `CharacterGender` 값은 정확히 `"male" | "female"`이다.
- 공식 로스터는 30명이며 `male` 15명, `female` 15명이다.
- `character-mage-f`의 이름은 `헨서라`, 성별은 `female`이다.
- 캐릭터 ID, `classId`, `portraitVariant`, `/assets/characters/live/...` 경로는 바꾸지 않는다.
- `gender`는 `CharacterRosterEntry`에만 두고 `lib/domain`의 `Character`, Store, UI, 게임 규칙에는 추가하지 않는다.
- `generateCharacterPool`의 RNG 호출, 셔플, 성격·HP·신뢰·골드 생성 순서를 바꾸지 않는다.
- `public/assets/characters/dead/`를 다시 만들거나 참조하지 않는다.
- 과거 `docs/superpowers` 설계·계획과 공식 ID를 사용하지 않는 예시 fixture 이름은 당시 기록으로 유지한다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

## File Map

- Modify: `lib/content/character-roster.ts` — 성별 타입, 승인 이름 30개, 로스터 불변식의 단일 소유자
- Modify: `lib/content/character-roster.test.ts` — 정확한 ID·이름·성별·직업·변형 계약
- Modify: `lib/content/character-pool.test.ts` — 성별이 콘텐츠 경계를 넘지 않고 기존 풀 생성이 유지되는 회귀
- Modify: `components/game/U4Assets.test.ts` — 30개 live 초상 존재와 dead 디렉터리 부재 회귀
- Modify: `docs/systems/CHARACTER_POOL_AND_WORLDTURN.md` — 승인된 공식 로스터와 성별 메타데이터의 설정집
- Do not modify: `lib/domain/character.ts`, `lib/content/character-pool.ts`, `components/game/character-labels.ts`, `public/assets/characters/**`

---

### Task 1: 로스터 성별·이름 콘텐츠 계약

**Files:**
- Modify: `lib/content/character-roster.test.ts:7-85`
- Modify: `lib/content/character-pool.test.ts:88-112`
- Modify: `lib/content/character-roster.ts:9-87`

**Interfaces:**
- Consumes: `CharacterId`, `ClassId`, `CHARACTER_POOL_SIZE`, `CHARACTERS_PER_CLASS`
- Produces: `CHARACTER_GENDERS`, `CharacterGender`, `CharacterRosterEntry.gender`, 승인된 `CHARACTER_ROSTER`
- Preserves: `characterRosterEntryFor(characterId): CharacterRosterEntry`, `generateCharacterPool(rng): CharacterPool`

- [ ] **Step 1: 정확한 30개 튜플과 성별 경계의 실패 테스트를 작성한다**

`lib/content/character-roster.test.ts`에서 `CHARACTER_GENDERS`를 import하고 `EXPECTED_ROSTER`와 매핑 검증을 다음 계약으로 바꾼다.

```ts
import {
  CHARACTER_GENDERS,
  CHARACTER_ROSTER,
  PORTRAIT_VARIANTS,
  characterRosterEntryFor,
} from "./character-roster";

const EXPECTED_ROSTER = [
  ["character-warrior-a", "발드릭", "male", "warrior", "a"],
  ["character-warrior-b", "브리엘라", "female", "warrior", "b"],
  ["character-warrior-c", "로데릭", "male", "warrior", "c"],
  ["character-warrior-d", "마르셀라", "female", "warrior", "d"],
  ["character-warrior-e", "토르벤", "male", "warrior", "e"],
  ["character-warrior-f", "이솔라", "female", "warrior", "f"],
  ["character-archer-a", "엘리시아", "female", "archer", "a"],
  ["character-archer-b", "알렌", "male", "archer", "b"],
  ["character-archer-c", "카엘", "male", "archer", "c"],
  ["character-archer-d", "레오니스", "male", "archer", "d"],
  ["character-archer-e", "리비아", "female", "archer", "e"],
  ["character-archer-f", "아델린", "female", "archer", "f"],
  ["character-cleric-a", "세드릭", "male", "cleric", "a"],
  ["character-cleric-b", "세실리아", "female", "cleric", "b"],
  ["character-cleric-c", "루시엔", "male", "cleric", "c"],
  ["character-cleric-d", "로레나", "female", "cleric", "d"],
  ["character-cleric-e", "아멜리아", "female", "cleric", "e"],
  ["character-cleric-f", "에드윈", "male", "cleric", "f"],
  ["character-mage-a", "발테르", "male", "mage", "a"],
  ["character-mage-b", "비비안", "female", "mage", "b"],
  ["character-mage-c", "오스카르", "male", "mage", "c"],
  ["character-mage-d", "셀레네", "female", "mage", "d"],
  ["character-mage-e", "에리온", "male", "mage", "e"],
  ["character-mage-f", "헨서라", "female", "mage", "f"],
  ["character-rogue-a", "라울", "male", "rogue", "a"],
  ["character-rogue-b", "카밀라", "female", "rogue", "b"],
  ["character-rogue-c", "다미안", "male", "rogue", "c"],
  ["character-rogue-d", "니콜라스", "male", "rogue", "d"],
  ["character-rogue-e", "베로니카", "female", "rogue", "e"],
  ["character-rogue-f", "이네스", "female", "rogue", "f"],
] as const;
```

정확한 튜플 테스트의 매핑과 설명을 다음처럼 바꾼다.

```ts
it("Spec의 30개 고정 ID·이름·성별·직업·변형을 순서대로 가진다", () => {
  expect(CHARACTER_ROSTER.map((entry) => [
    entry.id,
    entry.name,
    entry.gender,
    entry.classId,
    entry.portraitVariant,
  ])).toEqual(EXPECTED_ROSTER);
});

it("지원 성별을 각각 15명씩 가진다", () => {
  expect(CHARACTER_GENDERS).toEqual(["male", "female"]);
  expect(CHARACTER_ROSTER.filter((entry) => entry.gender === "male")).toHaveLength(15);
  expect(CHARACTER_ROSTER.filter((entry) => entry.gender === "female")).toHaveLength(15);
});
```

조회 테스트는 고정 캐릭터를 직접 확인한다.

```ts
expect(characterRosterEntryFor("character-mage-f" as CharacterId)).toMatchObject({
  name: "헨서라",
  gender: "female",
  classId: "mage",
  portraitVariant: "f",
});
```

`lib/content/character-pool.test.ts`에는 콘텐츠 전용 경계를 추가한다.

```ts
it("성별은 로스터 메타데이터에만 두고 런타임 캐릭터 상태에는 복사하지 않는다", () => {
  const pool = generateCharacterPool(createRng("fixed-roster-gender-boundary"));

  for (const entry of CHARACTER_ROSTER) {
    expect(["male", "female"]).toContain(entry.gender);
    expect(pool.byId[entry.id]).not.toHaveProperty("gender");
  }
});
```

- [ ] **Step 2: 실패 테스트를 실행한다**

Run:

```powershell
pnpm.cmd exec vitest run lib/content/character-roster.test.ts lib/content/character-pool.test.ts
```

Expected: FAIL. `CHARACTER_GENDERS` export 또는 `entry.gender`가 없고 기존 이름이 새 튜플과 일치하지 않는다.

- [ ] **Step 3: 로스터에 성별 타입·값과 승인 이름을 최소 구현한다**

`lib/content/character-roster.ts`에서 초상 변형 선언 앞에 성별 계약을 추가하고 인터페이스를 확장한다.

```ts
export const CHARACTER_GENDERS = ["male", "female"] as const;

export type CharacterGender = (typeof CHARACTER_GENDERS)[number];

export const PORTRAIT_VARIANTS = ["a", "b", "c", "d", "e", "f"] as const;

export type PortraitVariant = (typeof PORTRAIT_VARIANTS)[number];

export interface CharacterRosterEntry {
  readonly id: CharacterId;
  readonly name: string;
  readonly gender: CharacterGender;
  readonly classId: ClassId;
  readonly portraitVariant: PortraitVariant;
}
```

`CHARACTER_ROSTER`는 다음 값으로 교체한다.

```ts
export const CHARACTER_ROSTER = [
  { id: "character-warrior-a" as CharacterId, name: "발드릭", gender: "male", classId: "warrior" as ClassId, portraitVariant: "a" },
  { id: "character-warrior-b" as CharacterId, name: "브리엘라", gender: "female", classId: "warrior" as ClassId, portraitVariant: "b" },
  { id: "character-warrior-c" as CharacterId, name: "로데릭", gender: "male", classId: "warrior" as ClassId, portraitVariant: "c" },
  { id: "character-warrior-d" as CharacterId, name: "마르셀라", gender: "female", classId: "warrior" as ClassId, portraitVariant: "d" },
  { id: "character-warrior-e" as CharacterId, name: "토르벤", gender: "male", classId: "warrior" as ClassId, portraitVariant: "e" },
  { id: "character-warrior-f" as CharacterId, name: "이솔라", gender: "female", classId: "warrior" as ClassId, portraitVariant: "f" },
  { id: "character-archer-a" as CharacterId, name: "엘리시아", gender: "female", classId: "archer" as ClassId, portraitVariant: "a" },
  { id: "character-archer-b" as CharacterId, name: "알렌", gender: "male", classId: "archer" as ClassId, portraitVariant: "b" },
  { id: "character-archer-c" as CharacterId, name: "카엘", gender: "male", classId: "archer" as ClassId, portraitVariant: "c" },
  { id: "character-archer-d" as CharacterId, name: "레오니스", gender: "male", classId: "archer" as ClassId, portraitVariant: "d" },
  { id: "character-archer-e" as CharacterId, name: "리비아", gender: "female", classId: "archer" as ClassId, portraitVariant: "e" },
  { id: "character-archer-f" as CharacterId, name: "아델린", gender: "female", classId: "archer" as ClassId, portraitVariant: "f" },
  { id: "character-cleric-a" as CharacterId, name: "세드릭", gender: "male", classId: "cleric" as ClassId, portraitVariant: "a" },
  { id: "character-cleric-b" as CharacterId, name: "세실리아", gender: "female", classId: "cleric" as ClassId, portraitVariant: "b" },
  { id: "character-cleric-c" as CharacterId, name: "루시엔", gender: "male", classId: "cleric" as ClassId, portraitVariant: "c" },
  { id: "character-cleric-d" as CharacterId, name: "로레나", gender: "female", classId: "cleric" as ClassId, portraitVariant: "d" },
  { id: "character-cleric-e" as CharacterId, name: "아멜리아", gender: "female", classId: "cleric" as ClassId, portraitVariant: "e" },
  { id: "character-cleric-f" as CharacterId, name: "에드윈", gender: "male", classId: "cleric" as ClassId, portraitVariant: "f" },
  { id: "character-mage-a" as CharacterId, name: "발테르", gender: "male", classId: "mage" as ClassId, portraitVariant: "a" },
  { id: "character-mage-b" as CharacterId, name: "비비안", gender: "female", classId: "mage" as ClassId, portraitVariant: "b" },
  { id: "character-mage-c" as CharacterId, name: "오스카르", gender: "male", classId: "mage" as ClassId, portraitVariant: "c" },
  { id: "character-mage-d" as CharacterId, name: "셀레네", gender: "female", classId: "mage" as ClassId, portraitVariant: "d" },
  { id: "character-mage-e" as CharacterId, name: "에리온", gender: "male", classId: "mage" as ClassId, portraitVariant: "e" },
  { id: "character-mage-f" as CharacterId, name: "헨서라", gender: "female", classId: "mage" as ClassId, portraitVariant: "f" },
  { id: "character-rogue-a" as CharacterId, name: "라울", gender: "male", classId: "rogue" as ClassId, portraitVariant: "a" },
  { id: "character-rogue-b" as CharacterId, name: "카밀라", gender: "female", classId: "rogue" as ClassId, portraitVariant: "b" },
  { id: "character-rogue-c" as CharacterId, name: "다미안", gender: "male", classId: "rogue" as ClassId, portraitVariant: "c" },
  { id: "character-rogue-d" as CharacterId, name: "니콜라스", gender: "male", classId: "rogue" as ClassId, portraitVariant: "d" },
  { id: "character-rogue-e" as CharacterId, name: "베로니카", gender: "female", classId: "rogue" as ClassId, portraitVariant: "e" },
  { id: "character-rogue-f" as CharacterId, name: "이네스", gender: "female", classId: "rogue" as ClassId, portraitVariant: "f" },
] as const satisfies readonly CharacterRosterEntry[];
```

`createRosterById`의 Set 선언과 반복문에 런타임 지원 성별 검사를 추가한다.

```ts
const supportedGenders = new Set<string>(CHARACTER_GENDERS);

for (const entry of CHARACTER_ROSTER) {
  assertRoster(!ids.has(entry.id), `ID가 중복되었다: ${entry.id}`);
  assertRoster(!names.has(entry.name), `이름이 중복되었다: ${entry.name}`);
  assertRoster(supportedGenders.has(entry.gender), `지원하지 않는 성별이다: ${entry.gender}`);
  assertRoster(CLASSES.some((classDef) => classDef.id === entry.classId), `직업을 찾을 수 없다: ${entry.classId}`);
  assertRoster(
    entry.id === `character-${entry.classId}-${entry.portraitVariant}`,
    `ID와 직업·변형이 일치하지 않는다: ${entry.id}`,
  );
  ids.add(entry.id);
  names.add(entry.name);
  byId.set(entry.id, entry);
}
```

`lib/content/character-pool.ts`와 `lib/domain/character.ts`는 수정하지 않는다. 기존 `Character` 생성 객체가 `gender`를 복사하지 않는 것이 승인된 경계다.

- [ ] **Step 4: 로스터와 풀 경계 테스트를 통과시킨다**

Run:

```powershell
pnpm.cmd exec vitest run lib/content/character-roster.test.ts lib/content/character-pool.test.ts
```

Expected: 두 테스트 파일 전체 PASS.

- [ ] **Step 5: 타입 계약을 확인한다**

Run:

```powershell
pnpm.cmd typecheck
```

Expected: exit 0. `CharacterRosterEntry`에는 `gender`가 있고 도메인 `Character`에는 없다.

- [ ] **Step 6: 콘텐츠 구현을 커밋한다**

```powershell
git add -- lib/content/character-roster.ts lib/content/character-roster.test.ts lib/content/character-pool.test.ts
git commit -m "콘텐츠: 캐릭터 성별과 이름을 반영한다" -m "공식 로스터에 성별 메타데이터와 승인된 이름 30개를 추가하고 런타임 캐릭터 상태 경계를 보존한다."
```

---

### Task 2: 공식 문서·live 전용 자산 회귀와 전체 검증

**Files:**
- Modify: `components/game/U4Assets.test.ts:56-68`
- Modify: `docs/systems/CHARACTER_POOL_AND_WORLDTURN.md:87-104`

**Interfaces:**
- Consumes: Task 1의 `CHARACTER_ROSTER`, `CharacterRosterEntry.gender`
- Produces: 공식 설정집의 확정 로스터, `dead/` 부재 회귀
- Preserves: `portraitSrcForCharacterId(characterId): string`의 live 전용 경로

- [ ] **Step 1: dead 디렉터리 부재 회귀를 명시한다**

`components/game/U4Assets.test.ts`의 `describe("U4 assets")`에 다음 테스트를 추가한다.

```ts
it("keeps official character portraits live-only", () => {
  expect(existsSync("public/assets/characters/dead")).toBe(false);
  expect(CHARACTER_ROSTER).toHaveLength(30);

  for (const entry of CHARACTER_ROSTER) {
    expect(
      existsSync(
        `public/assets/characters/live/${entry.classId}/${entry.classId}_${entry.portraitVariant}.png`,
      ),
    ).toBe(true);
  }
});
```

- [ ] **Step 2: 자산 회귀 테스트를 실행한다**

Run:

```powershell
pnpm.cmd exec vitest run components/game/U4Assets.test.ts components/game/character-labels.test.ts
```

Expected: PASS. 30개 공식 ID가 기존 live 경로를 사용하고 `dead/` 디렉터리는 없다.

- [ ] **Step 3: 공식 캐릭터 설정집을 승인 로스터로 갱신한다**

`docs/systems/CHARACTER_POOL_AND_WORLDTURN.md`의 `고정 캐릭터 로스터` 절에서 소유 필드와 경계를 다음처럼 고친다.

```markdown
캠페인은 정확히 30명의 공식 캐릭터를 사용한다. ID, 이름, 성별, 직업, 초상화
variant는 `lib/content/character-roster.ts`가 유일하게 소유한다.
`generateCharacterPool`은 이 로스터와 성격 슬롯을 각각 섞으므로 시드가 바뀌어도
캐릭터 정체성은 바뀌지 않는다. 성별은 이름과 콘텐츠 정체성을 위한 메타데이터이며
게임 규칙, 능력치, 성격 배정, UI 표시에는 관여하지 않는다.

| 직업 | a | b | c | d | e | f |
| --- | --- | --- | --- | --- | --- | --- |
| warrior | 발드릭 (male) | 브리엘라 (female) | 로데릭 (male) | 마르셀라 (female) | 토르벤 (male) | 이솔라 (female) |
| archer | 엘리시아 (female) | 알렌 (male) | 카엘 (male) | 레오니스 (male) | 리비아 (female) | 아델린 (female) |
| cleric | 세드릭 (male) | 세실리아 (female) | 루시엔 (male) | 로레나 (female) | 아멜리아 (female) | 에드윈 (male) |
| mage | 발테르 (male) | 비비안 (female) | 오스카르 (male) | 셀레네 (female) | 에리온 (male) | 헨서라 (female) |
| rogue | 라울 (male) | 카밀라 (female) | 다미안 (male) | 니콜라스 (male) | 베로니카 (female) | 이네스 (female) |

- ID 형식은 `character-{class}-{a..f}`이다.
- `male`과 `female`은 각각 15명이다.
- 성격, 초기 HP, 신뢰, 소지 골드는 시드로 결정된다.
- 공식 로스터 밖의 ID는 콘텐츠·초상화 경계에서 오류로 처리한다.
```

`docs/experience/CHARACTER_UI_ASSETS.md`의 live 30개·dead 미제공 계약은 이미 최신이므로 수정하지 않는다.

- [ ] **Step 4: 활성 로스터와 공식 문서에 예전 이름이 남지 않았는지 확인한다**

Run:

```powershell
rg -n "가론|라이문드|바스티안|하르멜|헬가|브릭스턴|네리사|다이린|파에린|노엘라|실바나|카트린|마요라|세라핀|이졸데|로자린드|제라딘|미라벨|아드리크|타리엘|베로니크|사이러스|루시안|이반드로|카심|델런|무렌|오린|코르빈|펠릭스" lib/content/character-roster.ts lib/content/character-roster.test.ts docs/systems/CHARACTER_POOL_AND_WORLDTURN.md
```

Expected: 출력 없음, `rg` exit 1. 과거 `docs/superpowers` 기록과 공식 ID를 사용하지 않는 독립 테스트 fixture는 검색 범위에서 제외한다.

- [ ] **Step 5: 변경 금지 경계를 확인한다**

Run:

```powershell
git diff --name-only -- lib/domain/character.ts lib/content/character-pool.ts components/game/character-labels.ts public/assets/characters
```

Expected: 출력 없음. 성별이 도메인·UI로 전파되지 않았고 에셋 파일도 바뀌지 않았다.

- [ ] **Step 6: 관련 회귀와 전체 품질 게이트를 실행한다**

Run:

```powershell
pnpm.cmd exec vitest run lib/content/character-roster.test.ts lib/content/character-pool.test.ts components/game/character-labels.test.ts components/game/U4Assets.test.ts components/game/campaign-render.test.tsx
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd build
git diff --check
```

Expected: 집중 회귀 Vitest, typecheck, lint, production build, `git diff --check`는 모두 exit 0이어야 한다. `pnpm.cmd test`도 반드시 실행하되, 변경 파일 범위 밖의 실패는 정확한 실패 테스트 파일과 함께 문서화하고 본 Task 범위에서 수정하지 않는다. 전체 Vitest suite에 실패가 없어야 한다는 조건은 변경 파일 범위 밖의 baseline 실패에는 적용하지 않으며, production build가 완료되고 whitespace 오류가 없어야 한다.

- [ ] **Step 7: 문서와 자산 회귀를 커밋한다**

```powershell
git add -- components/game/U4Assets.test.ts docs/systems/CHARACTER_POOL_AND_WORLDTURN.md
git commit -m "문서: 캐릭터 로스터 계약을 최신화한다" -m "승인된 이름과 성별을 공식 설정집에 반영하고 live 전용 초상화 회귀를 고정한다."
```

- [ ] **Step 8: 최종 작업트리와 커밋 범위를 확인한다**

Run:

```powershell
git status --short --branch
git log --oneline -2
```

Expected: 사용자 소유 `.omo/`, `dungeon-schemer-handoff.md` 외 구현 변경이 남지 않고, 위 두 개의 한글 제목·본문 커밋이 최신 이력에 있다.
