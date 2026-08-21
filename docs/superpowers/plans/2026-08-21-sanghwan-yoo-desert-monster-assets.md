# 사막 몬스터 에셋 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공식 사막 일반 몬스터 5종과 보스 4종을 개별 투명 PNG 에셋으로 추가하고, 자동 자산 검사와 반응형 검수 카탈로그를 제공한다.

**Architecture:** `public/assets/monsters/desert/`가 런타임에서 재사용할 단일 소스가 되고, `components/game/DesertMonsterCatalog.tsx`와 `/desert-monsters-test`는 개발 검수만 담당한다. 자동 테스트는 파일 계약과 컴포넌트 참조를 검사하고, 시점·화풍·실루엣 품질은 Chromium 다중 viewport 캡처로 사람이 검수한다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript strict, Vitest 4, CSS, PNG RGBA assets, Chromium browser verification.

**Spec:** `docs/superpowers/specs/2026-08-21-sanghwan-yoo-desert-monster-assets-design.md`

## Global Constraints

- 공식 이름과 특성은 `lib/content/themes.ts`를 그대로 따른다.
- 일반 몬스터는 사막전갈·모래도마뱀·사막코브라·모래정령·미이라 5종이다.
- 보스는 거대 전갈 자카르·샌드웜 카르둠·모래거신 오벨론·스핑크스 네프리스 4종이다.
- 에셋은 반실사 다크 판타지 회화풍이며 플랫 벡터·아이콘·로고 느낌을 사용하지 않는다.
- 시점은 화면 왼쪽을 향한 약 30도 3/4 시점으로 통일한다.
- 모든 개별 이미지 파일은 최소 1024×1024 RGBA PNG이며 투명 배경을 사용한다.
- 이미지 안에 텍스트, UI 프레임, 이름표, 완성된 장면 배경을 넣지 않는다.
- 파일은 `public/assets/monsters/desert/` 아래에 둔다.
- 기존 거미 에셋을 변경하지 않는다.
- 모든 커밋 제목과 본문은 한글로 작성한다.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `public/assets/monsters/desert/*.png` | 사막 9종의 실제 런타임 이미지 자산 |
| `components/game/DesertMonsterAssets.ts` | 9종의 ID·표시명·파일 경로·검수용 공식 설명을 한 곳에 매핑 |
| `components/game/DesertMonsterAssets.test.ts` | PNG 존재·signature·크기·alpha와 9종 누락 여부 검사 |
| `components/game/DesertMonsterCatalog.tsx` | 검수 카드 그리드 렌더링 |
| `components/game/DesertMonsterCatalog.test.ts` | 9종 이름·경로와 섹션 구조 정적 렌더 검사 |
| `app/desert-monsters-test/page.tsx` | 개발용 검수 route |
| `app/desert-monsters-test/page.test.ts` | route가 카탈로그를 렌더링하는지 검사 |
| `app/desert-monsters-test/desert-monsters.css` | 반응형 검수 카탈로그 스타일 |

---

### Task 1: 사막 에셋 계약과 실패 테스트를 고정한다

**Files:**
- Create: `components/game/DesertMonsterAssets.ts`
- Create: `components/game/DesertMonsterAssets.test.ts`

**Interfaces:**
- Consumes: 공식 사막 몬스터·보스 이름과 특성.
- Produces: `DESERT_MONSTER_ASSETS` readonly 배열. 각 항목은 `id`, `name`, `kind`, `src`, `description`을 가진다.

- [ ] **Step 1: 9종 manifest를 작성한다.**

```ts
export interface DesertMonsterAsset {
  id: string;
  name: string;
  kind: "monster" | "boss";
  src: string;
  description: string;
}

export const DESERT_MONSTER_ASSETS = [
  {
    id: "desert-scorpion",
    name: "사막전갈",
    kind: "monster",
    src: "/assets/monsters/desert/monster-desert-scorpion.png",
    description: "물가 근처에 굴을 파고 밤에 활동",
  },
  {
    id: "desert-lizard",
    name: "모래도마뱀",
    kind: "monster",
    src: "/assets/monsters/desert/monster-desert-lizard.png",
    description: "열을 저장하고 낮에 활동",
  },
  {
    id: "desert-cobra",
    name: "사막코브라",
    kind: "monster",
    src: "/assets/monsters/desert/monster-desert-cobra.png",
    description: "그늘을 선호하고 열기에 예민",
  },
  {
    id: "desert-spirit",
    name: "모래정령",
    kind: "monster",
    src: "/assets/monsters/desert/monster-desert-spirit.png",
    description: "건조 지대에 서식하고 물기를 꺼림",
  },
  {
    id: "desert-mummy",
    name: "미이라",
    kind: "monster",
    src: "/assets/monsters/desert/monster-desert-mummy.png",
    description: "발자국을 남기지 않고 무덤을 수호",
  },
  {
    id: "boss-desert-1",
    name: "거대 전갈 자카르",
    kind: "boss",
    src: "/assets/monsters/desert/boss-desert-01-zakar.png",
    description: "모래 아래 매복하고 출현 직후 잠깐 움직임이 멈춤",
  },
  {
    id: "boss-desert-2",
    name: "샌드웜 카르둠",
    kind: "boss",
    src: "/assets/monsters/desert/boss-desert-02-kardum.png",
    description: "모래 속에서 진동을 좇고 크게 솟은 뒤 재잠복에 시간이 걸림",
  },
  {
    id: "boss-desert-3",
    name: "모래거신 오벨론",
    kind: "boss",
    src: "/assets/monsters/desert/boss-desert-03-obelon.png",
    description: "신전 돌더미가 뭉친 거신이며 떨어진 돌을 다시 끌어모음",
  },
  {
    id: "boss-desert-4",
    name: "스핑크스 네프리스",
    kind: "boss",
    src: "/assets/monsters/desert/boss-desert-04-nephris.png",
    description: "마지막 관문을 지키며 질문 후 답을 들을 때까지 움직이지 않음",
  },
] as const satisfies readonly DesertMonsterAsset[];
```

- [ ] **Step 2: 파일 계약 테스트를 작성한다.**

`components/game/DesertMonsterAssets.test.ts`에서 각 `src`를 `public` 아래 실제 경로로 바꾸고 다음을 검사한다.

```ts
expect(DESERT_MONSTER_ASSETS).toHaveLength(9);
expect(new Set(DESERT_MONSTER_ASSETS.map((asset) => asset.id)).size).toBe(9);
expect(DESERT_MONSTER_ASSETS.filter((asset) => asset.kind === "monster")).toHaveLength(5);
expect(DESERT_MONSTER_ASSETS.filter((asset) => asset.kind === "boss")).toHaveLength(4);
```

PNG 검사 helper는 signature와 IHDR을 직접 읽는다.

```ts
function readPngContract(path: string) {
  const file = readFileSync(path);
  expect(file.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const colorType = file[25];
  return { width, height, colorType };
}
```

각 파일에 대해 `width >= 1024`, `height >= 1024`, `colorType`이 `4` 또는 `6`인지 검사한다.

- [ ] **Step 3: 실패를 확인한다.**

Run: `pnpm test components/game/DesertMonsterAssets.test.ts`

Expected: FAIL. 아직 `public/assets/monsters/desert/*.png` 파일이 없으므로 `ENOENT`로 실패한다.

- [ ] **Step 4: manifest 파일만 커밋한다.**

```bash
git add components/game/DesertMonsterAssets.ts components/game/DesertMonsterAssets.test.ts
git commit -m "테스트: 사막 몬스터 에셋 계약을 고정한다" -m "공식 사막 일반 몬스터 5종과 보스 4종의 경로, 이름, PNG 크기와 alpha 계약을 테스트로 정의한다."
```

### Task 2: 개별 투명 PNG 9종을 제작하고 자산 테스트를 통과시킨다

**Files:**
- Create: `public/assets/monsters/desert/monster-desert-scorpion.png`
- Create: `public/assets/monsters/desert/monster-desert-lizard.png`
- Create: `public/assets/monsters/desert/monster-desert-cobra.png`
- Create: `public/assets/monsters/desert/monster-desert-spirit.png`
- Create: `public/assets/monsters/desert/monster-desert-mummy.png`
- Create: `public/assets/monsters/desert/boss-desert-01-zakar.png`
- Create: `public/assets/monsters/desert/boss-desert-02-kardum.png`
- Create: `public/assets/monsters/desert/boss-desert-03-obelon.png`
- Create: `public/assets/monsters/desert/boss-desert-04-nephris.png`

**Interfaces:**
- Consumes: Task 1의 `src` 계약.
- Produces: 모든 manifest 경로에서 직접 로드할 수 있는 1024×1024 이상 RGBA PNG.

- [ ] **Step 1: 승인된 시각 계약으로 9종을 개별 제작한다.**

각 에셋은 spec의 공식 시각 해석과 공통 계약을 따른다. 생성 또는 추출 뒤 피사체 주변 안전 여백을 유지하고 1:1 투명 캔버스에 배치한다.

- [ ] **Step 2: PNG 메타데이터를 로컬로 확인한다.**

```bash
python - <<'PY'
from PIL import Image
from pathlib import Path
for path in sorted(Path('public/assets/monsters/desert').glob('*.png')):
    image = Image.open(path)
    print(path.name, image.mode, image.size, image.getchannel('A').getextrema())
PY
```

Expected: 9 files, `RGBA`, each side >= 1024, alpha channel extrema의 최솟값이 255보다 작다.

- [ ] **Step 3: 자산 계약 테스트를 통과시킨다.**

Run: `pnpm test components/game/DesertMonsterAssets.test.ts`

Expected: PASS.

- [ ] **Step 4: 에셋을 커밋한다.**

```bash
git add public/assets/monsters/desert
git commit -m "에셋: 사막 몬스터와 보스 9종을 추가한다" -m "공식 사막 생태와 보스 행동을 반영한 투명 1대1 다크 판타지 개별 PNG를 추가한다."
```

### Task 3: 반응형 검수 카탈로그를 구현한다

**Files:**
- Create: `components/game/DesertMonsterCatalog.tsx`
- Create: `components/game/DesertMonsterCatalog.test.ts`
- Create: `app/desert-monsters-test/page.tsx`
- Create: `app/desert-monsters-test/page.test.ts`
- Create: `app/desert-monsters-test/desert-monsters.css`

**Interfaces:**
- Consumes: `DESERT_MONSTER_ASSETS`.
- Produces: `<DesertMonsterCatalog />`와 `/desert-monsters-test` route.

- [ ] **Step 1: 카탈로그 실패 테스트를 작성한다.**

```ts
const html = renderToStaticMarkup(createElement(DesertMonsterCatalog));
expect(html).toContain("일반 몬스터 5종");
expect(html).toContain("보스 4종");
for (const asset of DESERT_MONSTER_ASSETS) {
  expect(html).toContain(asset.name);
  expect(html).toContain(asset.src);
}
```

route 테스트는 `DesertMonstersTestPage()`를 정적 렌더하고 `사막전갈`, `스핑크스 네프리스`가 모두 존재하는지 검사한다.

- [ ] **Step 2: 실패를 확인한다.**

Run: `pnpm test components/game/DesertMonsterCatalog.test.ts app/desert-monsters-test/page.test.ts`

Expected: FAIL. 컴포넌트와 route가 아직 없다.

- [ ] **Step 3: 카탈로그 컴포넌트를 최소 구현한다.**

`DesertMonsterCatalog.tsx`는 manifest를 `kind`로 나눠 두 섹션을 렌더링한다. 이미지는 직접 `<img>`를 사용하며 다음 속성을 포함한다.

```tsx
<img src={asset.src} alt={`${asset.name} 검수 에셋`} loading="eager" />
```

각 카드에는 `name`, `id`, `description`을 표시한다.

- [ ] **Step 4: route와 CSS를 구현한다.**

`page.tsx`는 CSS를 import하고 `<DesertMonsterCatalog />`만 렌더링한다.

CSS 핵심 계약:

```css
.desert-monster-catalog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
  gap: clamp(0.8rem, 1.2vw, 1.5rem);
}

.desert-monster-card__art {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.desert-monster-card__art img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
```

- [ ] **Step 5: 카탈로그 테스트를 통과시킨다.**

Run: `pnpm test components/game/DesertMonsterCatalog.test.ts app/desert-monsters-test/page.test.ts`

Expected: PASS.

- [ ] **Step 6: 카탈로그를 커밋한다.**

```bash
git add components/game/DesertMonsterCatalog.tsx components/game/DesertMonsterCatalog.test.ts app/desert-monsters-test
git commit -m "화면: 사막 몬스터 에셋 검수 페이지를 추가한다" -m "일반 5종과 보스 4종을 반응형 그리드에서 이름, 공식 특성, 실제 투명 PNG와 함께 검수할 수 있게 한다."
```

### Task 4: 브라우저 다중 viewport 검증과 전체 검증을 완료한다

**Files:**
- Verify only; 필요하면 Task 3 CSS를 수정한다.

**Interfaces:**
- Consumes: `/desert-monsters-test`.
- Produces: 캡처와 PR 검증 기록.

- [ ] **Step 1: 전체 정적 검증을 실행한다.**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 모두 exit code 0.

- [ ] **Step 2: 개발 서버를 실행한다.**

```bash
pnpm dev
```

- [ ] **Step 3: Chromium에서 필수 viewport를 검수한다.**

다음 viewport를 사용한다.

```text
1024×640
1280×720
1366×768
1536×720
1536×864
1920×1080
2560×1440
3440×1440
```

각 viewport에서 `document.documentElement.scrollWidth === innerWidth`인지 확인한다. 각 카드 이미지의 `naturalWidth >= 1024`, `naturalHeight >= 1024`, 렌더 박스가 카드 art 영역 밖으로 나가지 않는지 확인한다.

- [ ] **Step 4: 대표 캡처 3장을 남긴다.**

```text
1366×768
1920×1080
2560×1440 또는 3440×1440
```

- [ ] **Step 5: 문제가 있으면 CSS만 최소 수정하고 다시 검증한다.**

카드/텍스트 overflow가 있으면 이미지 비율을 왜곡하지 않고 grid 최소폭, padding, font-size clamp를 조정한다.

- [ ] **Step 6: 검증 결과를 커밋한다.**

CSS 수정이 있었다면:

```bash
git add app/desert-monsters-test/desert-monsters.css
git commit -m "검증: 사막 몬스터 카탈로그 반응형을 보정한다" -m "노트북부터 울트라와이드까지 이미지 잘림과 가로 스크롤 없이 검수할 수 있도록 그리드와 카드 간격을 조정한다."
```

### Task 5: Draft PR을 열고 검증 결과를 기록한다

**Files:**
- GitHub PR metadata only.

**Interfaces:**
- Consumes: `feature/desert-monster-assets` branch.
- Produces: `main` 대상 Draft PR.

- [ ] **Step 1: branch가 최신 main을 기반으로 하는지 확인한다.**

```bash
git fetch origin
git merge-base --is-ancestor origin/main HEAD
```

Expected: exit code 0. main이 진행됐다면 충돌 없이 최신 main을 merge한 뒤 검증을 다시 실행한다.

- [ ] **Step 2: Draft PR을 만든다.**

PR 제목:

```text
에셋: 사막 몬스터와 보스 9종을 추가한다
```

PR 본문에 다음을 기록한다.

- 공식 콘텐츠 출처
- 개별 에셋 9종 목록
- 투명 1:1 PNG와 파일 규칙
- `/desert-monsters-test` 검수 route
- 실행한 viewport와 캡처
- `lint`, `typecheck`, `test`, `build` 결과
- 범위 밖: U5 전투 연결, 애니메이션, 묘지 에셋

- [ ] **Step 3: PR 상태를 확인한다.**

Draft이며 base=`main`, head=`feature/desert-monster-assets`인지 확인한다.
