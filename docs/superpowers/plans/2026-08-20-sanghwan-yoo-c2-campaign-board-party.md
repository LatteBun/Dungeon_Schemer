# C2 게시판·임시 파티 편성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 현재 캠페인 상태에서 공개 환경 특성을 가진 최대 5개 공고와, 서로 겹치지 않는 서로 다른 직업 3인의 임시 파티를 결정적으로 생성한다.

**Architecture:** 테마 콘텐츠가 환경 특성 후보 세 개와 패키지별 참조를 소유하고 검증기가 출현 몬스터 특성을 근거로 검사한다. lib/rules/board.ts는 캠페인 시드와 worldTurn에서 독립 board·party 스트림을 파생해 공고와 최대 수의 완전 파티를 만들며, 계약·상태 전이·엔딩은 소유하지 않는다.

**Tech Stack:** TypeScript strict, Vitest 4, createRng와 derive("board" | "party"), 기존 RuleError.

**Spec:** docs/superpowers/specs/2026-08-20-sanghwan-yoo-c2-campaign-board-party-design.md

## Global Constraints

- 공개 API는 createBoardOffers(state: CampaignState): readonly BoardOffer[] 하나이며 입력을 바꾸지 않고 시간·전역 가변 상태·Math.random()을 읽지 않는다.
- 공고는 최대 5개다. 모든 공고에는 서로 다른 직업 정확히 3명의 파티가 있고, 같은 게시판 안에서 캐릭터 ID를 재사용하지 않는다.
- 같은 캠페인 시드와 worldTurn은 공고·순서·파티를 재현한다. 다음 worldTurn은 새 공고 ID와 새 파티 스냅샷을 만든다.
- 진입 가능한 미클리어 던전을 현재 위험도 내림차순으로 먼저 넣고 동률만 board 스트림으로 섞는다. 남은 자리는 가까운 잠금 위험도부터 채운다.
- 3직업 3인을 만들 수 없는 것은 정상 게임 상태다. 빈 배열을 반환하며 C6이 엔딩을 해석한다. 부분 파티·캐릭터 재사용·조용한 대체를 만들지 않는다.
- 테마별 환경 특성 후보는 정확히 세 개이며, 패키지는 하나를 참조한다. 해당 패키지의 출현 몬스터 traits가 근거가 되어야 하며 콘텐츠 결함은 RuleError("INVALID_GENERATION")이다.
- 계약 수락·phase 변경·지도·정산·월드턴·엔딩·UI를 구현하지 않는다. 새 의존성을 추가하지 않는다.
- 모든 커밋 제목과 본문은 한글로 쓴다.

## File Structure

| 파일 | 책임 |
| --- | --- |
| lib/domain/ids.ts, dungeon.ts, campaign.ts, index.ts | 환경 특성 ID·정의·패키지 참조·공고 공개값 타입 |
| lib/content/themes.ts, themes.test.ts | 후보 세 개와 15개 패키지 매핑 |
| lib/content/theme-validation.ts, theme-validation.test.ts | 후보 수·참조·몬스터 근거 검증 |
| lib/rules/board.ts, board.test.ts | 결정적 공고 우선순위와 최대 완전 파티 |
| docs/systems 및 docs/design 문서 | 확정된 공식 게임 규칙 |
| docs/README.md, CAMPAIGN_REWORK_WORK_ASSIGNMENT.md | 색인과 C2 완료 기록 |

---

### Task 1: 환경 특성 타입과 승인된 테마 콘텐츠를 추가한다

**Files:**

- Modify: lib/domain/ids.ts
- Modify: lib/domain/dungeon.ts
- Modify: lib/domain/campaign.ts
- Modify: lib/domain/index.ts
- Modify: lib/domain/contract.test.ts
- Modify: lib/content/themes.ts
- Modify: lib/content/themes.test.ts

**Interfaces:**

~~~ts
export type PublicEnvironmentTagId = Brand<string, "PublicEnvironmentTagId">;

export interface PublicEnvironmentTag {
  id: PublicEnvironmentTagId;
  label: string;
}

export interface EnvironmentTagDefinition extends PublicEnvironmentTag {
  evidenceMonsterTraits: readonly string[];
}

export interface EcologyProfile {
  // existing fields
  publicEnvironmentTagId: PublicEnvironmentTagId;
}

export interface ThemeContent {
  // existing fields
  publicEnvironmentTags: readonly EnvironmentTagDefinition[];
}

export interface BoardOffer {
  // existing fields
  publicEnvironmentTag: PublicEnvironmentTag;
}
~~~

- [ ] **Step 1: 실패하는 도메인·실제 콘텐츠 테스트를 쓴다.**

lib/domain/contract.test.ts에서 PublicEnvironmentTagId와 EnvironmentTagDefinition을 public barrel에서 import하고, ThemeContent.publicEnvironmentTags, EcologyProfile.publicEnvironmentTagId, BoardOffer.publicEnvironmentTag를 쓰는 fixture를 추가한다. lib/content/themes.test.ts에는 실제 각 테마가 후보 세 개를 가지고, 모든 생태 패키지가 자기 테마 후보를 참조한다고 단정한다.

~~~ts
expect(theme.publicEnvironmentTags).toHaveLength(3);
expect(new Set(theme.publicEnvironmentTags.map((tag) => tag.id)).size).toBe(3);
expect(theme.ecologyProfiles.every((profile) =>
  theme.publicEnvironmentTags.some((tag) => tag.id === profile.publicEnvironmentTagId),
)).toBe(true);
~~~

Run: pnpm typecheck

Expected: FAIL. 새 ID·타입·필드가 없고 기존 THEMES가 새 ThemeContent 계약을 만족하지 않는다.

- [ ] **Step 2: 도메인 타입과 barrel export를 구현한다.**

ids.ts에 PublicEnvironmentTagId 브랜드를 EcologyProfileId 옆에 추가한다. dungeon.ts의 MonsterDef 뒤에 PublicEnvironmentTag와 EnvironmentTagDefinition을 선언한다. EcologyProfile에 publicEnvironmentTagId, ThemeContent에 publicEnvironmentTags를 추가한다. campaign.ts BoardOffer의 riskLevel 바로 다음에 publicEnvironmentTag를 추가한다. index.ts에서 새 ID와 세 타입을 type export한다.

- [ ] **Step 3: 후보 9개와 확정 패키지 매핑을 구현한다.**

themes.ts의 ecologyProfile() 마지막 인자를 publicEnvironmentTagId: string으로 추가해 브랜드 ID로 변환한다. 각 ThemeContent에 후보 세 개를 연결한다.

~~~ts
const SPIDER_PUBLIC_ENVIRONMENT_TAGS: readonly EnvironmentTagDefinition[] = [
  { id: "spider-vibration-alert" as PublicEnvironmentTagId, label: "진동 경계", evidenceMonsterTraits: ["진동 감지"] },
  { id: "spider-carrion-trace" as PublicEnvironmentTagId, label: "시체 흔적", evidenceMonsterTraits: ["부패한 시체를 먹음"] },
  { id: "spider-dark-ambush" as PublicEnvironmentTagId, label: "어둠 잠복", evidenceMonsterTraits: ["어둠 속에서만 활동"] },
];
~~~

사막 후보는 desert-heat-exposure/열기 노출/[열기에 예민, 열을 저장함], desert-water-zone/수분 지대/[물가 근처에 굴을 팜], desert-erased-tracks/발자국 소실/[발자국을 남기지 않음]으로 둔다. 묘지 후보는 graveyard-sound-alert/소리 경계/[소리에 민감], graveyard-light-exposure/빛 노출/[빛에 이끌림], graveyard-burial-guard/매장물 수호/[부장품 수호]로 둔다.

패키지 참조는 다음을 정확히 사용한다.

| 테마 | 패키지 → 태그 ID |
| --- | --- |
| 거미굴 | shallow-a → vibration-alert, shallow-b·dark-passage·queens-forecourt → dark-ambush, carrion-route → carrion-trace |
| 사막 | scorched-well·dry-trail → water-zone, wind-well·burning-waste → heat-exposure, buried-trail → erased-tracks |
| 묘지 | quiet-guard·grave-robber → burial-guard, dim-crypt → light-exposure, hunters·blighted-tomb → sound-alert |

- [ ] **Step 4: 15개 매핑을 명시적으로 검증한다.**

themes.test.ts에서 profile ID → 태그 label 조회표를 만들고 15개 전부를 exact object 비교한다. 적어도 다음 값들이 포함되어야 한다.

~~~ts
expect(labelsByProfileId).toEqual({
  "spider-shallow-a": "진동 경계",
  "spider-shallow-b": "어둠 잠복",
  "spider-carrion-route": "시체 흔적",
  "spider-dark-passage": "어둠 잠복",
  "spider-queens-forecourt": "어둠 잠복",
  "desert-scorched-well": "수분 지대",
  "desert-wind-well": "열기 노출",
  "desert-buried-trail": "발자국 소실",
  "desert-dry-trail": "수분 지대",
  "desert-burning-waste": "열기 노출",
  "graveyard-quiet-guard": "매장물 수호",
  "graveyard-dim-crypt": "빛 노출",
  "graveyard-grave-robber": "매장물 수호",
  "graveyard-hunters": "소리 경계",
  "graveyard-blighted-tomb": "소리 경계",
});
~~~

Run: pnpm test lib/domain/contract.test.ts lib/content/themes.test.ts && pnpm typecheck

Expected: PASS. 새 공개 계약과 승인된 실제 콘텐츠가 strict typecheck를 통과한다.

- [ ] **Step 5: 이 단위를 커밋한다.**

~~~bash
git add lib/domain/ids.ts lib/domain/dungeon.ts lib/domain/campaign.ts lib/domain/index.ts lib/domain/contract.test.ts lib/content/themes.ts lib/content/themes.test.ts
git commit -m "도메인: 공고 환경 특성 계약을 추가한다" -m "생태 패키지와 출현 몬스터의 근거를 공고 공개 정보로 안전하게 연결한다."
~~~

### Task 2: 환경 특성의 몬스터 근거를 검증한다

**Files:**

- Modify: lib/content/theme-validation.ts
- Modify: lib/content/theme-validation.test.ts

**Consumes:** Task 1의 EnvironmentTagDefinition, EcologyProfile.publicEnvironmentTagId, ThemeContent.publicEnvironmentTags.

**Produces:** validateThemes()가 후보·참조·출현 몬스터 특성 불일치를 RuleError("INVALID_GENERATION")으로 거부한다.

- [ ] **Step 1: 실패하는 검증 fixture를 쓴다.**

theme-validation.test.ts의 monster()가 traits 인자를 받고 validTheme()이 후보 세 개와 profile 태그 ID를 가진 유효 fixture가 되게 고친다. m1은 "진동 감지" trait를 갖는다. expectInvalidGeneration()으로 다음 네 경우를 추가한다: 후보가 둘뿐임, 후보 ID 중복, profile이 outside 태그를 참조함, 선택 태그 evidenceMonsterTraits가 ["존재하지 않는 특성"]임.

Run: pnpm test lib/content/theme-validation.test.ts

Expected: FAIL. 현재 검증기는 환경 특성 필드를 읽지 않는다.

- [ ] **Step 2: 후보 정의 검증을 구현한다.**

theme-validation.ts에 PUBLIC_ENVIRONMENT_TAGS_PER_THEME = 3과 아래 보조 함수를 추가한다.

~~~ts
function validatePublicEnvironmentTags(
  tags: readonly EnvironmentTagDefinition[],
  theme: string,
): void;
~~~

수량 3, ID 고유성, 비어 있지 않은 label, 비어 있지 않은 evidenceMonsterTraits, 근거 trait의 공백·중복 없음을 순서대로 검사한다. 실패는 기존 invalid()로 만들고 details에 contentType: "publicEnvironmentTag", theme, 가능한 tagId와 expected/actual을 기록한다.

- [ ] **Step 3: profile 참조와 출현 몬스터 근거 검증을 구현한다.**

validateEcologyProfiles() 인자에 tags를 추가한다. tagById와 monsterById를 만든 후 모든 profile의 태그가 존재하는지 검사한다. profile.activeMonsterIds가 가리키는 몬스터 중 하나라도 선택 tag.evidenceMonsterTraits에 포함된 trait를 가져야 한다.

~~~ts
const evidenceFound = profile.activeMonsterIds.some((monsterId) => {
  const monster = monsterById.get(monsterId);
  return monster?.traits.some((trait) => tag.evidenceMonsterTraits.includes(trait));
});
if (!evidenceFound) invalid("생태 패키지의 공개 환경 특성에 몬스터 근거가 없다", {
  contentType: "ecologyProfile",
  theme,
  profileId: profile.id,
  publicEnvironmentTagId: profile.publicEnvironmentTagId,
});
~~~

validateThemes()는 몬스터 검증 후 후보를 검증하고, tags를 넘겨 validateEcologyProfiles()를 호출한다.

- [ ] **Step 4: 검증 단위를 통과시키고 커밋한다.**

Run: pnpm test lib/content/theme-validation.test.ts lib/content/themes.test.ts && pnpm typecheck

Expected: PASS. 모든 음수 fixture는 INVALID_GENERATION이고 실제 15개 패키지는 몬스터 근거를 가진다.

~~~bash
git add lib/content/theme-validation.ts lib/content/theme-validation.test.ts
git commit -m "콘텐츠: 공고 환경 특성 근거를 검증한다" -m "공개 태그가 해당 던전의 실제 출현 몬스터와 어긋나지 않게 막는다."
~~~

### Task 3: 결정적 게시판과 최대 완전 파티를 구현한다

**Files:**

- Create: lib/rules/board.ts
- Create: lib/rules/board.test.ts

**Consumes:** CampaignState, BoardOffer, RANK_RISK_LIMIT, BOARD_OFFER_MAX, canDeploy, createRng, Task 1 태그 콘텐츠.

**Produces:**

~~~ts
export function createBoardOffers(state: CampaignState): readonly BoardOffer[];
~~~

- [ ] **Step 1: 공고 API의 실패 테스트를 쓴다.**

board.test.ts에서 initializeCampaign("c2-board") fixture와 상태 복사 보조 함수를 만든다. 초기 C급 생성 결과가 공고 다섯 개이며 위험도는 [2, 2, 2, 2, 1]인지, 모든 offer ID가 offer-0-으로 시작하는지, offer riskLevel이 원본 던전 현재 riskLevel과 같은지, publicEnvironmentTag가 해당 profile의 실제 후보 ID·label인지 단정한다.

동일 입력의 deep equal과 공고·party·memberIds 참조 비공유도 단정한다.

Run: pnpm test lib/rules/board.test.ts

Expected: FAIL. board.ts와 createBoardOffers()가 없다.

- [ ] **Step 2: 던전 후보 정렬과 공개 태그 해석을 구현한다.**

board.ts에 dungeon의 theme, ecologyProfileId, publicEnvironmentTagId를 따라 새 { id, label }을 만드는 private publicTagForDungeon()을 만든다. 테마·패키지·태그가 없으면 RuleError("INVALID_GENERATION")을 던지고 콘텐츠 객체를 그대로 반환하지 않는다.

createRng(state.seed + "/" + state.worldTurn).derive("board")로 동률만 섞는다. selectDungeons(state, limit)는 미클리어 던전을 accessible와 locked로 나눈다. accessible는 riskLevel 내림차순, locked는 riskLevel 오름차순이며 같은 위험도 그룹만 shuffle한다. 먼저 accessible를 limit까지 넣고 남은 자리에 locked를 넣는다.

- [ ] **Step 3: 최대 완전 파티 수를 요구하는 실패 테스트를 추가한다.**

모든 offer가 memberIds 세 개이고 내부 classId가 모두 다르며, 전체 memberIds Set 크기가 공고 수 × 3인 테스트를 추가한다. 특히 전사 5명·도적 2명·성직자 2명·마법사 2명인 11명 fixture가 세 개 공고를 만든다고 단정한다. 이 fixture는 단순히 매번 후보가 많은 상위 세 직업을 고르면 두 파티로 끝나는 회귀 사례다.

출전 가능한 직업이 둘뿐이면 빈 배열, 9명으로 정확히 세 완전 파티만 가능하면 세 공고, 어떤 공고도 1~2명이나 이전 공고의 캐릭터를 쓰지 않는지도 단정한다.

Run: pnpm test lib/rules/board.test.ts

Expected: FAIL. 파티 편성과 공고 상한이 없다.

- [ ] **Step 4: 작은 탐색으로 최대 파티 직업 조합을 만들고 캐릭터를 배정한다.**

직업별 deployable ID 배열을 party RNG로 먼저 섞는다. 가능한 직업 3개 조합은 최대 5 choose 3 = 10개이므로, 남은 직업별 수와 남은 공고 칸을 인자로 받는 재귀 탐색으로 가장 긴 조합열을 찾는다. 최대 길이가 동률이면 party RNG로 섞은 조합 순서 중 먼저 발견한 것을 쓴다.

~~~ts
function bestClassPlan(
  remaining: ReadonlyMap<ClassId, number>,
  remainingSlots: number,
  partyRng: Rng,
): readonly (readonly [ClassId, ClassId, ClassId])[];
~~~

각 선택 조합에서 세 직업 수를 1씩 줄여 재귀하고, 자식 계획 앞에 현재 조합을 붙인 후보 중 가장 긴 것을 고른다. 조합열을 따라 섞인 직업별 ID 배열에서 하나씩 꺼내 ExpeditionParty를 만든다. 따라서 같은 ID를 두 번 꺼낼 수 없다.

parties.length가 0이면 빈 배열을 반환한다. 선택 공고 수는 Math.min(BOARD_OFFER_MAX, parties.length)이며 selectDungeons() 결과와 parties를 같은 순서로 조립한다. 각 offer는 새 id, dungeonId, riskLevel, party, lockReason, publicEnvironmentTag 객체를 가진다.

- [ ] **Step 5: 정렬·잠금·재편성 회귀 테스트를 추가한다.**

100개 seed에서 초기 C급의 네 ★2 공고는 항상 있고, ★1 dungeon ID는 dungeon-spider-01·dungeon-spider-02·dungeon-desert-01 중 둘 이상이 관측되는지 단정한다. 낮은 위험도 던전을 cleared로 바꾼 fixture에서 잠금 공고가 ★3, ★4, ★5 순으로 나오고 모두 rankTooLow인지 단정한다.

worldTurn: 1 fixture는 offer-1- ID를 만들고, 여러 seed에서 worldTurn: 0과 동일 dungeonId → memberIds 연결이 최소 한 번은 달라지는지 단정한다. 호출 전후 state, pool, dungeons, 기존 offers가 변하지 않는지도 확인한다.

Run: pnpm test lib/rules/board.test.ts lib/content/theme-validation.test.ts lib/domain/contract.test.ts && pnpm typecheck

Expected: PASS. C2 규칙이 재현성·최대 편성·잠금 우선순위·태그 공개·참조 비공유를 통과한다.

- [ ] **Step 6: 게시판 규칙 단위를 커밋한다.**

~~~bash
git add lib/rules/board.ts lib/rules/board.test.ts
git commit -m "규칙: C2 게시판과 임시 파티를 생성한다" -m "공고 간 인물 중복 없이 시드와 차수로 재현되는 완전 3인 편성을 제공한다."
~~~

### Task 4: 공식 문서와 작업 배정표를 동기화한다

**Files:**

- Modify: docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md
- Modify: docs/systems/CHARACTER_POOL_AND_WORLDTURN.md
- Modify: docs/design/CORE_GAME_LOOP.md
- Modify: docs/README.md
- Modify: docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md

**Consumes:** Task 1~3의 통과한 규칙과 spec의 확정 매핑.

**Produces:** 공식 문서, 문서 색인, 작업 배정표가 C2 코드 계약을 설명한다.

- [ ] **Step 1: 세 공식 문서를 갱신한다.**

DUNGEON_THEMES_AND_ECOLOGY.md의 생태 패키지 절 뒤에 테마별 후보 세 개와 15개 패키지 매핑 표를 추가하고, 태그가 테마명이 아닌 넓은 환경 성격이며 출현 몬스터 traits로 검증됨을 적는다.

CHARACTER_POOL_AND_WORLDTURN.md의 임시 파티 절에 같은 게시판의 캐릭터 공고 간 중복 금지, 완전 3인 파티 수만큼의 공고 노출, 원정 뒤 해체와 다음 worldTurn의 전면 재편성 규칙을 적는다.

CORE_GAME_LOOP.md의 공고 게시판 절에 진입 가능 우선·위험도 동률 시 시드 정렬, 가까운 잠금 위험도 우선, 공고 수가 중복 없는 완전 파티 수를 넘지 않음, 다음 게시판에서 공고-파티 관계를 재사용하지 않음을 적는다.

- [ ] **Step 2: README와 배정표 완료 기록을 갱신한다.**

README.md의 이번 개편 설계 절에 C2 spec과 이 plan 링크를 추가한다. CAMPAIGN_REWORK_WORK_ASSIGNMENT.md에서 C2 담당을 SangHwan Yoo, 상태를 ✅로 바꾸고 C4와 U3 선행 열에서 C2를 제거한다. C2 완료 기준에는 공개 환경 특성, 공고 간 인물 중복 금지, 완전 3인 파티 수 제한, worldTurn 재편성을 명시한다. C2 완료 기록 절에는 날짜, 핵심 검증 명령, 확정 규칙을 남긴다.

- [ ] **Step 3: 문서 무결성과 전체 검증을 실행한다.**

Run:

~~~bash
pnpm test docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
~~~

Expected: PASS. 배정표 의존성·상태 규약, lint, 타입 검사, 전체 테스트, 프로덕션 빌드, 공백 검사가 모두 통과한다.

- [ ] **Step 4: 문서 단위를 커밋한다.**

~~~bash
git add docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md docs/systems/CHARACTER_POOL_AND_WORLDTURN.md docs/design/CORE_GAME_LOOP.md docs/README.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "문서: C2 게시판 규칙 완료를 기록한다" -m "공고 우선순위와 매 게시판 재편성 규칙을 공식 문서와 작업 기준에 맞춘다."
~~~

## Plan Self-Review

- **Spec coverage:** Task 1~2는 후보 세 개·15개 매핑·몬스터 근거 검증을, Task 3은 최대 5개 공고·정렬·잠금 우선순위·중복 없는 최대 완전 파티·시드/worldTurn 재생성을, Task 4는 공식 문서와 완료 기록을 담당한다.
- **Placeholder scan:** 타입, 후보 ID·문구·근거 trait, 함수 시그니처, 실패·통과 명령, 커밋 명령을 명시했다. 미정 항목이나 후속 구현 지시는 없다.
- **Type consistency:** PublicEnvironmentTagId → EnvironmentTagDefinition/PublicEnvironmentTag → EcologyProfile/ThemeContent → BoardOffer 순으로 정의하며, createBoardOffers signature는 모든 task에서 같다.
