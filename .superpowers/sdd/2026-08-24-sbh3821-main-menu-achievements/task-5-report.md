# Task 5 구현 보고서: 길잡이 업적 기록 화면과 문양

## TDD 기록

### RED

`pnpm test -- components/game/AchievementScreen.test.tsx components/game/AchievementAssets.test.ts app/achievements/page.test.ts`를 먼저 실행했다.

- `AchievementScreen`과 `/achievements/page` 모듈이 없어서 화면·실제 RootLayout 통합 테스트가 실패했다.
- 신규 문양 네 개가 없어 자산 계약 테스트가 모두 `ENOENT`로 실패했다.

### GREEN

- `achievementCardViewsFor()`가 카탈로그 순서와 unlock 상태를 view로 투영한다. 잠긴 hidden 항목은 이름·설명·진행도를 모두 redaction한다.
- 순수 `AchievementScreen`은 8개 카드, 상태 문구, 접근 가능한 누적 progressbar, UTC 날짜, 메인 메뉴 링크와 확인 dialog를 표시한다. `Achievements` client wrapper만 Provider와 초기화 상태를 연결한다.
- `/achievements`는 `Achievements`만 반환하고, 실제 `RootLayout` 통합 렌더 테스트가 초기 8개 미달성 카드와 3개 progressbar를 확인한다.
- 자산 계약은 모든 catalog `imageSrc`와 신규 PNG 네 개의 PNG 서명·정사각 크기를 확인한다.

## 생성 문양

모드는 built-in `image_gen`이었고, 기존 U6 네 문양을 스타일 레퍼런스로 먼저 육안 검토했다. 생성 결과는 프로젝트로 복사한 뒤 네 파일을 다시 `view_image`로 검토했다.

| 자산 | built-in 생성 경로 | 저장 경로 | 육안 검토 |
| --- | --- | --- | --- |
| S급 문양 | `/Users/semin/.codex/generated_images/01a0341e-31d5-7d21-b17b-2a708d91d10b/exec-0d9079a1-b70c-4c59-9e8a-d10e573a7ee3.png` | `public/assets/achievements/achievement_s_rank.png` | 중앙 별·월계, 문자 없음 |
| 조언 문양 | `/Users/semin/.codex/generated_images/01a0341e-31d5-7d21-b17b-2a708d91d10b/exec-68f5be99-20e1-4338-a93d-a45e6005e0fc.png` | `public/assets/achievements/achievement_advice.png` | 열린 지도·대각 깃펜·작은 봉인, 문자 없음 |
| 원정 문양 | `/Users/semin/.codex/generated_images/01a0341e-31d5-7d21-b17b-2a708d91d10b/exec-532c86e4-3f79-4846-bec5-06581e25be56.png` | `public/assets/achievements/achievement_expedition.png` | 갈래길과 합류하는 발자국, 문자 없음 |
| 전멸 문양 | `/Users/semin/.codex/generated_images/01a0341e-31d5-7d21-b17b-2a708d91d10b/exec-865a2a75-770d-46d8-b4ac-aa84082948f0.png` | `public/assets/achievements/achievement_wipe.png` | 깨진 방패·꺼진 횃불, 피나 고어 없음 |

공통적으로 어두운 금속 방패, 낡은 양피지, 낮은 채도, 따뜻한 금 테두리와 회화적인 게임 UI 질감을 확인했다. 투명 배경은 승인된 시안과 맞지 않아 요청하지 않았다.

### 최종 프롬프트

#### `achievement_s_rank.png`

```text
Use case: stylized-concept
Asset type: game UI achievement emblem, 1024x1024 square raster PNG
Input images: the four preceding images are style references only; preserve their dark metal shield, weathered gold edging, centered heraldic game-UI composition, not their literal motifs.
Primary request: an original dignified guide-rank achievement crest with a central five-point star embraced by a laurel wreath; communicate the highest guild rank without any literal rank letter.
Scene/backdrop: aged parchment behind a frontal heraldic emblem.
Subject: central star, laurel leaves, dark monochrome weathered metal shield.
Style/medium: painterly game UI emblem, textured and ornate—not flat vector.
Composition/framing: square 1024 x 1024, symmetrical frontal crest centered with generous margin.
Lighting/mood: restrained warm gold highlights, solemn and prestigious.
Color palette: low saturation, charcoal and deep muted green metal, aged parchment, warm old gold border.
Materials/textures: scratched dark metal, worn gold trim, subtle parchment fibers.
Constraints: no literal text, no letters, no numbers, no logo, no watermark, no flat-vector styling, no people.
```

#### `achievement_advice.png`

```text
Use case: stylized-concept
Asset type: game UI achievement emblem, 1024x1024 square raster PNG
Input images: the preceding emblem images are style references only; inherit their dark weathered metal, aged gold edging, and centered heraldic game-UI composition while creating a distinct motif.
Primary request: an original achievement crest showing a feather quill laid diagonally across an open expedition map with a small round wax seal.
Scene/backdrop: aged parchment behind a frontal heraldic emblem.
Subject: open map, quill, small wax seal, dark monochrome weathered metal frame.
Style/medium: painterly game UI emblem, textured and ornate—not flat vector.
Composition/framing: square 1024 x 1024, symmetrical frontal crest centered with generous margin.
Lighting/mood: restrained warm gold highlights, thoughtful and archival.
Color palette: low saturation, charcoal and deep muted green metal, aged parchment, warm old gold border.
Materials/textures: scratched dark metal, worn gold trim, subtle parchment fibers, feather barbs.
Constraints: no text, no letters, no numbers, no logo, no watermark, no flat-vector styling, no people.
```

#### `achievement_expedition.png`

```text
Use case: stylized-concept
Asset type: game UI achievement emblem, 1024x1024 square raster PNG
Input images: the preceding emblem images are style references only; inherit their dark weathered metal, aged gold edging, and centered heraldic game-UI composition while creating a distinct motif.
Primary request: an original achievement crest of multiple branching expedition paths and accumulated boot footprints converging at the center.
Scene/backdrop: aged parchment behind a frontal heraldic emblem.
Subject: branching paths, a trail of expedition footprints converging, dark monochrome weathered metal frame.
Style/medium: painterly game UI emblem, textured and ornate—not flat vector.
Composition/framing: square 1024 x 1024, symmetrical frontal crest centered with generous margin.
Lighting/mood: restrained warm gold highlights, persevering and seasoned.
Color palette: low saturation, charcoal and deep muted green metal, aged parchment, warm old gold border.
Materials/textures: scratched dark metal, worn gold trim, subtle parchment fibers, impressed path and footprint details.
Constraints: no text, no letters, no numbers, no logo, no watermark, no flat-vector styling, no people.
```

#### `achievement_wipe.png`

```text
Use case: stylized-concept
Asset type: game UI achievement emblem, 1024x1024 square raster PNG
Input images: the preceding emblem images are style references only; inherit their dark weathered metal, aged gold edging, and centered heraldic game-UI composition while creating a distinct motif.
Primary request: an original achievement crest showing a broken expedition shield beside an extinguished torch, conveying a total expedition wipe with no gore.
Scene/backdrop: aged parchment behind a frontal heraldic emblem.
Subject: fractured shield, extinguished torch with a thin curl of harmless smoke, dark monochrome weathered metal frame.
Style/medium: painterly game UI emblem, textured and ornate—not flat vector.
Composition/framing: square 1024 x 1024, symmetrical frontal crest centered with generous margin.
Lighting/mood: restrained warm gold highlights, somber and reflective rather than violent.
Color palette: low saturation, charcoal and deep muted green metal, aged parchment, warm old gold border.
Materials/textures: scratched dark metal, worn gold trim, subtle parchment fibers, cracked shield surface, spent wood and ash.
Constraints: no text, no letters, no numbers, no logo, no watermark, no flat-vector styling, no people, no blood, no gore.
```

## 검증

- `pnpm test -- components/game/AchievementScreen.test.tsx components/game/AchievementAssets.test.ts app/achievements/page.test.ts components/game/FixedCanvas.test.ts && pnpm typecheck`: 108 test files, 1,050 tests 통과; typecheck 통과.
- `pnpm lint`: 오류 0건. 기존 파일의 `img` 사용 및 미사용 변수 경고 45건은 그대로 남는다.
- `git diff --check`: 통과.
- 네 신규 PNG는 모두 정사각 1254×1254이고 PNG 서명 및 최소 512px 계약을 통과했다.
- `pnpm build`: 이 Task의 acceptance 범위 밖이다. 첫 build가 `.next/lock`을 점유한 상태로 완료 출력을 반환하지 않았고, 이어진 build는 그 lock 때문에 실행되지 않았다. 활성 프로세스일 수 있는 lock은 삭제하지 않았다.

## 커밋

- `기능: 길잡이 업적 기록 화면을 연다`
- 본문: `결과형과 누적형 업적 8개를 잠금·해금·진행 상태와 일관된 문양으로 보여준다.`

## 우려 사항

- built-in image generation은 프롬프트의 1024×1024 요청에도 1254×1254 PNG를 반환했다. 규격은 정사각이며 승인된 자산 테스트의 최소 512px 조건을 충족한다. 이미지 조작 금지 지침에 따라 셸 리사이즈는 하지 않았다.
- 실행 환경 Node는 `v24.13.1`이고 프로젝트 기준은 `24.19.0`이라 pnpm 실행마다 기존 engine warning이 나타난다.

## 리뷰 후속 수정: 누적 progressbar ARIA 범위

### RED

- `AchievementScreen.test.tsx`에 101회 조언을 렌더하는 회귀 테스트를 추가했다. 화면 문구는 `101 / 100`을 유지하면서 `aria-valuemax="100"`과 `aria-valuenow="100"`을 요구한다.
- `pnpm test -- components/game/AchievementScreen.test.tsx`는 예상대로 실패했다. 실제 마크업이 `aria-valuemax="100" aria-valuenow="101"`을 출력해 progressbar 범위가 유효하지 않았다.

### GREEN

- `AchievementCard`가 progressbar의 `aria-valuenow`에만 `Math.min(current, target)`을 적용한다. 원본 누계와 보이는 `101 / 100` 텍스트는 그대로 보존한다.

### 검증

- `pnpm test -- components/game/AchievementScreen.test.tsx`: 108 test files, 1,051 tests 통과.
- `pnpm typecheck`: 통과.
- `git diff --check`: 통과.
