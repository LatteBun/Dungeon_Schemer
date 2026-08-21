# 캐릭터 UI 에셋 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 다섯 직업의 생존·사망·변형 캐릭터 PNG 20개를 브랜치에 추가하고, 향후 파티 UI에서 상태에 맞게 재사용할 수 있는 자산 카탈로그와 공식 캐릭터 문서 연결을 제공한다.

**Architecture:** 기존 `public/assets/characters/{live|dead}/{class}/` 구조를 그대로 사용한다. 자산 세부 목록과 표시 규칙은 `docs/experience/CHARACTER_UI_ASSETS.md`가 소유하고, `CHARACTERS_AND_TRUST.md`는 카탈로그로 연결하는 진입점만 제공한다. 캐릭터 ID 매핑과 UI 코드는 수정하지 않는다.

**Tech Stack:** PNG 정적 자산, Markdown, Git, 기존 문서 검증·TypeScript 테스트 명령

**Spec:** `docs/superpowers/specs/2026-08-21-sanghwan-yoo-character-ui-assets-design.md`

## Global Constraints

- `live`·`dead` 각각에 5직업 × 2변형, 총 20개 PNG를 포함한다.
- `live`는 생존 상태에만, `dead`는 실제 사망 상태에만 사용한다.
- 신뢰 0·중상·미출전·일시적 출전 불가는 `dead`로 표현하지 않는다.
- `a`·`b`는 시각 변형이며 성격·신뢰·캐릭터 ID·능력치를 뜻하지 않는다.
- 원본 세로 비율을 보존하고 UI의 기본 표시 방식은 `object-fit: contain`으로 기록한다.
- 캐릭터 ID별 안정적 변형 매핑은 별도 UI·도메인 작업으로 남긴다.
- UI 컴포넌트, 게임 상태·신뢰 규칙, 이미지 변환, 몬스터·보스 에셋은 변경하지 않는다.
- 커밋 제목과 본문은 모두 한글로 작성한다.

---

### Task 1: 캐릭터 PNG 추가

**Files:**
- Create: `public/assets/characters/live/archer/archer_a.png`, `archer_b.png`
- Create: `public/assets/characters/live/cleric/cleric_a.png`, `cleric_b.png`
- Create: `public/assets/characters/live/mage/mage_a.png`, `mage_b.png`
- Create: `public/assets/characters/live/rogue/rogue_a.png`, `rogue_b.png`
- Create: `public/assets/characters/live/warrior/warrior_a.png`, `warrior_b.png`
- Create: `public/assets/characters/dead/archer/archer_a.png`, `archer_b.png`
- Create: `public/assets/characters/dead/cleric/cleric_a.png`, `cleric_b.png`
- Create: `public/assets/characters/dead/mage/mage_a.png`, `mage_b.png`
- Create: `public/assets/characters/dead/rogue/rogue_a.png`, `rogue_b.png`
- Create: `public/assets/characters/dead/warrior/warrior_a.png`, `warrior_b.png`

**Interfaces:**
- Consumes: 승인된 이미지 파일 `/workspaces/Dungeon_Schemer/public/assets/characters/{live|dead}/...`
- Produces: 상태·직업·변형 조합이 완성된 캐릭터 자산 20개

- [ ] **Step 1: 승인된 캐릭터 이미지 20개를 브랜치의 자산 경로에 복사한다**

```bash
mkdir -p public/assets/characters
cp -R -- /workspaces/Dungeon_Schemer/public/assets/characters/live public/assets/characters/
cp -R -- /workspaces/Dungeon_Schemer/public/assets/characters/dead public/assets/characters/
```

- [ ] **Step 2: 상태·직업·변형 조합과 PNG signature를 확인한다**

```bash
test "$(find public/assets/characters -type f -name '*.png' | wc -l)" -eq 20
for image_path in public/assets/characters/{live,dead}/{archer,cleric,mage,rogue,warrior}/*.png; do
  test "$(od -An -tx1 -N8 "$image_path" | tr -d ' \n')" = 89504e470d0a1a0a
done
```

Expected: 20개 파일과 모든 상태·직업 조합이 존재하고 PNG signature가 확인된다.

- [ ] **Step 3: 자산만 첫 커밋으로 기록한다**

```bash
git add -- public/assets/characters
git commit -m '추가: 캐릭터 UI 에셋을 포함한다' -m '다섯 직업의 생존·사망 상태별 초상 변형 20개를 정적 자산으로 추가한다.'
```

### Task 2: 캐릭터 자산 카탈로그 작성

**Files:**
- Create: `docs/experience/CHARACTER_UI_ASSETS.md`

**Interfaces:**
- Consumes: Task 1의 자산 경로, `CHARACTERS_AND_TRUST.md`, `UI_IMPLEMENTATION_GUIDE.md`
- Produces: 경로 패턴·직업·변형·해상도·상태별 UI 사용 조건을 담은 카탈로그

- [ ] **Step 1: 경로 패턴과 직업별 해상도 표를 작성한다**

카탈로그에 다음 경로 패턴과 행을 모두 포함한다.

```text
/assets/characters/{live|dead}/{archer|cleric|mage|rogue|warrior}/{class}_{a|b}.png
```

| 직업 디렉터리 | 표시 직업 | 변형 | `live`·`dead` 원본 해상도 |
| --- | --- | --- | --- |
| `archer` | 궁수 | `archer_a`, `archer_b` | 1024×1536 |
| `cleric` | 성직자 | `cleric_a`, `cleric_b` | 1024×1536 |
| `mage` | 마법사 | `mage_a`, `mage_b` | 1024×1536 |
| `rogue` | 도적 | `rogue_a`, `rogue_b` | 1024×1536 |
| `warrior` | 전사 | `warrior_a`, `warrior_b` | 1086×1448 |

- [ ] **Step 2: 상태 기반 UI 사용 규칙을 문서화한다**

카탈로그에 다음 내용을 명시한다.

- `live`는 생존 캐릭터의 파티 카드, 우측 상태 패널, 게시판 계약 상세, 진행 화면에 사용한다.
- `dead`는 실제 사망이 확정된 캐릭터의 정산·사망 결과·기록 UI에만 사용한다.
- 신뢰 0·중상·미출전·일시적 출전 불가는 `dead`를 사용하지 않는다.
- `a`·`b`는 시각 변형이며 캐릭터 속성을 의미하지 않는다.
- 캐릭터 ID별 변형 선택은 별도 매핑 설계로 분리하고, 화면·세션 사이에서 안정적으로 유지한다.
- 세로 비율을 보존하고 기본 표시 방식은 `object-fit: contain`으로 한다.

- [ ] **Step 3: 카탈로그 링크와 파일 패턴을 확인한다**

```bash
rg -n 'CHARACTER_UI_ASSETS|live|dead|object-fit|1024×1536|1086×1448' docs/experience/CHARACTER_UI_ASSETS.md
test -f public/assets/characters/live/warrior/warrior_a.png
test -f public/assets/characters/dead/warrior/warrior_b.png
```

Expected: 상태·직업·해상도·재사용 규칙이 검색되고 실제 파일이 존재한다.

### Task 3: 공식 캐릭터 문서에 카탈로그 진입점 추가

**Files:**
- Modify: `docs/systems/CHARACTERS_AND_TRUST.md` 관련 문서 목록

**Interfaces:**
- Consumes: Task 2의 `docs/experience/CHARACTER_UI_ASSETS.md`
- Produces: 캐릭터 시스템 문서에서 UI 자산 카탈로그로 가는 Markdown 링크

- [ ] **Step 1: 관련 문서 목록에 카탈로그 링크를 추가한다**

캐릭터 상태·직업을 설명하는 문서의 관련 문서 목록에 다음 링크를 추가한다.

```markdown
- [캐릭터 UI 에셋](../experience/CHARACTER_UI_ASSETS.md): 직업·생존 상태·변형별 정적 경로와 UI 재사용 규칙
```

시스템 문서에 자산 표를 복제하지 않는다.

- [ ] **Step 2: Markdown 링크와 범위를 검사한다**

```bash
rg -n '캐릭터 UI 에셋|CHARACTER_UI_ASSETS' docs/systems/CHARACTERS_AND_TRUST.md
git diff --check
```

Expected: 링크가 한 번 존재하고 whitespace 오류가 없다.

- [ ] **Step 3: 문서 연결을 한글 커밋으로 기록한다**

```bash
git add -- docs/experience/CHARACTER_UI_ASSETS.md docs/systems/CHARACTERS_AND_TRUST.md
git commit -m '문서: 캐릭터 UI 에셋 사용법을 정리한다' -m '캐릭터 시스템 문서에서 상태별 자산 카탈로그를 참조하도록 연결한다.'
```

### Task 4: 브랜치 전체 검증

**Files:**
- Test: `public/assets/characters/{live,dead}/{archer,cleric,mage,rogue,warrior}/*.png`
- Test: `docs/experience/CHARACTER_UI_ASSETS.md`
- Test: `docs/systems/CHARACTERS_AND_TRUST.md`

**Interfaces:**
- Consumes: Task 1~3의 자산과 문서
- Produces: PR에 올릴 clean working tree와 검증 결과

- [ ] **Step 1: 전체 자산 조합과 문서 링크를 검증한다**

```bash
set -e
test "$(find public/assets/characters -type f -name '*.png' | wc -l)" -eq 20
rg -n 'CHARACTER_UI_ASSETS' docs/systems/CHARACTERS_AND_TRUST.md
git diff --check
```

- [ ] **Step 2: 기존 검증 명령을 실행한다**

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

Expected: 캐릭터 PNG 20개, 카탈로그, 캐릭터 문서 링크, spec, plan만 포함된다.
