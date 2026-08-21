# 사막 몬스터 UI 에셋 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사막 잡몹 5종과 보스 4종의 PNG를 브랜치에 추가하고, 향후 UI에서 재사용할 수 있는 자산 카탈로그와 공식 테마 문서 연결을 제공한다.

**Architecture:** 기존 `public/assets/monsters/dessert/` 경로와 파일명 계약을 유지한다. `components/game/DesertMonsterAssets.ts`는 UI·게임 데이터의 source of truth가 아닌 9종 검수용 manifest를 제공하고, 대응 테스트는 PNG 계약을 고정한다. 자산 세부 목록과 표시 규칙은 `docs/experience/DESERT_MONSTER_ASSETS.md`가 소유하고, `DUNGEON_THEMES_AND_ECOLOGY.md`는 카탈로그로 연결하는 진입점만 제공한다. `/desert-monsters-test` 별도 검수 라우트와 게임 데이터는 추가하지 않는다.

**Tech Stack:** PNG 정적 자산, Markdown, Git, 기존 문서 검증·TypeScript 테스트 명령

**Spec:** `docs/superpowers/specs/2026-08-21-sanghwan-yoo-desert-monster-ui-assets-design.md`

## Global Constraints

- 사막 잡몹 5개와 보스 4개만 이 브랜치에 포함한다.
- 폴더명 `public/assets/monsters/dessert/`는 유지한다.
- 모든 이미지 경로는 `/assets/monsters/dessert/<파일명>`으로 문서화한다.
- 원본 정사각형 비율을 보존하고 UI의 기본 표시 방식은 `object-fit: contain`으로 기록한다.
- 실제 출현 몬스터·초기 위험도 구간은 공식 테마 문서를 따르며 자산 문서에서 재정의하지 않는다.
- `DESERT_MONSTER_ASSETS`는 정확히 잡몹 5종·보스 4종, 고유 ID, `/assets/monsters/dessert/` 경로를 가진다.
- PNG 계약 테스트는 signature, 정사각형 최소 1024px, 허용 color type, palette PNG의 `tRNS` 투명도를 검증한다.
- `/desert-monsters-test` 검수 라우트는 별도 UI 작업으로 남기고 이 브랜치에 포함하지 않는다.
- UI 컴포넌트, 게임 데이터, 이미지 변환, 캐릭터·거미굴·묘지 에셋은 변경하지 않는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

---

### Task 1: 사막 몬스터 PNG 추가

**Files:**
- Create: `public/assets/monsters/dessert/boss-desert-01-zakar.png`
- Create: `public/assets/monsters/dessert/boss-desert-02-kardum.png`
- Create: `public/assets/monsters/dessert/boss-desert-03-obelon.png`
- Create: `public/assets/monsters/dessert/boss-desert-04-nephris.png`
- Create: `public/assets/monsters/dessert/monster-desert-cobra.png`
- Create: `public/assets/monsters/dessert/monster-desert-lizard.png`
- Create: `public/assets/monsters/dessert/monster-desert-mummy.png`
- Create: `public/assets/monsters/dessert/monster-desert-scorpion.png`
- Create: `public/assets/monsters/dessert/monster-desert-spirit.png`

**Interfaces:**
- Consumes: 승인된 이미지 파일 `/workspaces/Dungeon_Schemer/public/assets/monsters/dessert/*.png`
- Produces: 사막 자산 9개와 공식 파일명 세트

- [ ] **Step 1: 승인된 사막 이미지 9개를 브랜치의 자산 경로에 복사한다**

```bash
mkdir -p public/assets/monsters/dessert
cp -- /workspaces/Dungeon_Schemer/public/assets/monsters/dessert/*.png public/assets/monsters/dessert/
```

- [ ] **Step 2: 파일 수와 PNG 해상도를 확인한다**

```bash
test "$(find public/assets/monsters/dessert -maxdepth 1 -type f -name '*.png' | wc -l)" -eq 9
for image_path in public/assets/monsters/dessert/*.png; do
  test "$(od -An -tx1 -N8 "$image_path" | tr -d ' \n')" = 89504e470d0a1a0a
done
```

Expected: 9개 파일이 존재하고 모든 파일의 PNG signature가 확인된다.

- [ ] **Step 3: 자산만 첫 커밋으로 기록한다**

```bash
git add -- public/assets/monsters/dessert
git commit -m '추가: 사막 몬스터 UI 에셋을 포함한다' -m '사막 잡몹과 보스 이미지 9개를 정적 자산으로 추가한다.'
```

### Task 2: 사막 자산 manifest와 PNG 계약 테스트

**Files:**
- Create: `components/game/DesertMonsterAssets.ts`
- Create: `components/game/DesertMonsterAssets.test.ts`

**Interfaces:**
- Consumes: Task 1의 PNG 9개와 `DESERT_MONSTER_ASSETS.md`의 공식 매핑
- Produces: 9종 readonly manifest와 PNG 형식·수량·투명도 자동 계약

- [ ] **Step 1: 실패하는 계약 테스트를 먼저 작성한다**

다음 기준을 테스트에 고정한다.

- manifest가 정확히 9개이며 고유 ID를 가진다.
- `kind`가 잡몹 5개와 보스 4개로 나뉜다.
- 각 `src`의 실제 파일이 PNG signature를 갖는다.
- 각 이미지가 정사각형이고 가로·세로가 1024px 이상이다.
- PNG color type은 `3`, `4`, `6`만 허용하고 color type `3`은 `tRNS` 청크를 포함한다.

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DESERT_MONSTER_ASSETS } from "./DesertMonsterAssets";

function readPngContract(src: string) {
  const file = readFileSync(join(process.cwd(), "public", src.replace(/^\//, "")));
  expect(file.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );

  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
    colorType: file[25],
    hasTransparencyChunk: file.includes(Buffer.from("tRNS", "ascii")),
  };
}

describe("DESERT_MONSTER_ASSETS", () => {
  it("contains exactly five monsters and four bosses", () => {
    expect(DESERT_MONSTER_ASSETS).toHaveLength(9);
    expect(new Set(DESERT_MONSTER_ASSETS.map((asset) => asset.id)).size).toBe(9);
    expect(DESERT_MONSTER_ASSETS.filter((asset) => asset.kind === "monster")).toHaveLength(5);
    expect(DESERT_MONSTER_ASSETS.filter((asset) => asset.kind === "boss")).toHaveLength(4);
  });

  it.each(DESERT_MONSTER_ASSETS)("validates $id PNG contract", (asset) => {
    const png = readPngContract(asset.src);

    expect(png.width).toBeGreaterThanOrEqual(1024);
    expect(png.height).toBeGreaterThanOrEqual(1024);
    expect(png.width).toBe(png.height);
    expect([3, 4, 6]).toContain(png.colorType);
    if (png.colorType === 3) expect(png.hasTransparencyChunk).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트가 manifest 부재로 실패하는지 확인한다**

```bash
npm test -- components/game/DesertMonsterAssets.test.ts
```

Expected: 아직 `DesertMonsterAssets` 모듈이 없으므로 실패한다.

- [ ] **Step 3: 실제 9개 파일과 `/assets/monsters/dessert/` 경로를 manifest에 등록한다**

`id`, 공식 이름, `kind`, `src`, 설명을 모두 등록하고 `as const satisfies readonly DesertMonsterAsset[]`로 타입을 고정한다. manifest는 UI 표시용 매핑을 제공하지만 게임 도메인 규칙을 정의하지 않는다.

- [ ] **Step 4: 계약 테스트가 통과하는지 확인한다**

```bash
npm test -- components/game/DesertMonsterAssets.test.ts
```

Expected: 9개 자산의 수량·분류·PNG signature·정사각형 최소 해상도·투명도 계약이 통과한다.

- [ ] **Step 5: manifest와 계약 테스트를 한글 커밋으로 기록한다**

```bash
git add -- components/game/DesertMonsterAssets.ts components/game/DesertMonsterAssets.test.ts
git commit -m '테스트: 사막 몬스터 PNG 계약을 고정한다' -m '사막 자산 manifest와 PNG 형식·수량·투명도 검증을 추가한다.'
```

### Task 3: 사막 자산 카탈로그 작성

**Files:**
- Create: `docs/experience/DESERT_MONSTER_ASSETS.md`

**Interfaces:**
- Consumes: Task 1·2의 자산 경로와 manifest, `DUNGEON_THEMES_AND_ECOLOGY.md`, `UI_IMPLEMENTATION_GUIDE.md`
- Produces: 경로·콘텐츠 이름·해상도·향후 UI 사용 조건을 담은 카탈로그

- [ ] **Step 1: 9개 자산의 공식 매핑 표를 작성한다**

카탈로그에 다음 행을 모두 포함한다.

| 구분 | 공식 콘텐츠 | 파일 | 원본 해상도 |
| --- | --- | --- | --- |
| 잡몹 | 사막전갈 | `monster-desert-scorpion.png` | 1024×1024 |
| 잡몹 | 모래도마뱀 | `monster-desert-lizard.png` | 1024×1024 |
| 잡몹 | 사막코브라 | `monster-desert-cobra.png` | 1254×1254 |
| 잡몹 | 모래정령 | `monster-desert-spirit.png` | 1254×1254 |
| 잡몹 | 미이라 | `monster-desert-mummy.png` | 1254×1254 |
| 보스 ★1 | 거대 전갈 자카르 | `boss-desert-01-zakar.png` | 1254×1254 |
| 보스 ★2 | 샌드웜 카르둠 | `boss-desert-02-kardum.png` | 1024×1024 |
| 보스 ★3 | 모래거신 오벨론 | `boss-desert-03-obelon.png` | 1024×1024 |
| 보스 ★4~5 | 스핑크스 네프리스 | `boss-desert-04-nephris.png` | 1254×1254 |

- [ ] **Step 2: 향후 UI 재사용 규칙을 문서화한다**

카탈로그에 다음 내용을 명시한다.

- 진행 화면 장면 슬롯, 몬스터 정보, 보스 정보·정산 UI에서 이 카탈로그를 먼저 확인한다.
- 도메인 데이터가 가리키는 현재 출현 몬스터·보스만 표시한다.
- 정사각형 비율을 보존하고 기본 표시 방식은 `object-fit: contain`으로 한다.
- 실제 출현 패키지에 없는 몬스터를 장식용으로 임의 노출하지 않는다.
- 새 사막 이미지 작업 전 카탈로그·테마 문서·UI 구현 가이드를 함께 확인한다.

- [ ] **Step 3: 카탈로그 링크와 파일 경로를 확인한다**

```bash
rg -n 'DESERT_MONSTER_ASSETS|boss-desert-01-zakar|monster-desert-scorpion|object-fit' docs/experience/DESERT_MONSTER_ASSETS.md
test -f public/assets/monsters/dessert/boss-desert-01-zakar.png
```

Expected: 카탈로그의 핵심 링크·경로·재사용 규칙이 검색되고 실제 자산 파일이 존재한다.

### Task 4: 공식 테마 문서에 카탈로그 진입점 추가

**Files:**
- Modify: `docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md` 관련 문서 목록

**Interfaces:**
- Consumes: Task 3의 `docs/experience/DESERT_MONSTER_ASSETS.md`
- Produces: 사막 테마 문서에서 UI 자산 카탈로그로 가는 Markdown 링크

- [ ] **Step 1: 관련 문서 목록에 카탈로그 링크를 추가한다**

사막 몬스터·보스 콘텐츠를 설명하는 문서의 관련 문서 목록에 다음 링크를 추가한다.

```markdown
- [사막 몬스터 UI 에셋](../experience/DESERT_MONSTER_ASSETS.md): 사막 잡몹·보스의 정적 경로, 해상도, UI 재사용 규칙
```

시스템 문서에 자산 표를 복제하지 않는다.

- [ ] **Step 2: Markdown 링크와 범위를 검사한다**

```bash
rg -n '사막 몬스터 UI 에셋|DESERT_MONSTER_ASSETS' docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md
git diff --check
```

Expected: 링크가 한 번 존재하고 whitespace 오류가 없다.

- [ ] **Step 3: 문서 연결을 한글 커밋으로 기록한다**

```bash
git add -- docs/experience/DESERT_MONSTER_ASSETS.md docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md
git commit -m '문서: 사막 몬스터 UI 에셋 사용법을 정리한다' -m '사막 테마 문서에서 몬스터 자산 카탈로그를 참조하도록 연결한다.'
```

### Task 5: 브랜치 전체 검증

**Files:**
- Test: `public/assets/monsters/dessert/*.png`
- Test: `components/game/DesertMonsterAssets.ts`
- Test: `components/game/DesertMonsterAssets.test.ts`
- Test: `docs/experience/DESERT_MONSTER_ASSETS.md`
- Test: `docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md`

**Interfaces:**
- Consumes: Task 1~4의 자산과 문서
- Produces: PR에 올릴 clean working tree와 검증 결과

- [ ] **Step 1: 전체 자산 목록과 문서 링크를 검증한다**

```bash
set -e
test "$(find public/assets/monsters/dessert -maxdepth 1 -type f -name '*.png' | wc -l)" -eq 9
rg -n 'DESERT_MONSTER_ASSETS' docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md
git diff --check
```

- [ ] **Step 2: 전체 검증 명령을 실행한다**

```bash
npm run typecheck
npm test
```

Expected: typecheck exit 0, test exit 0.

- [ ] **Step 3: 최종 변경 범위를 확인한다**

```bash
git status --short
git diff main...HEAD --stat
```

Expected: 사막 PNG 9개, manifest·계약 테스트, 카탈로그, 테마 문서 링크, spec, plan만 포함된다.
