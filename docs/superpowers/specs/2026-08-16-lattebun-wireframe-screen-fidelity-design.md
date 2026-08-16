# 와이어프레임 화면 충실도 설계

- 작성일: 2026-08-16
- 작성자: lattebun
- 작성 도구: Claude Code (Opus 5)
- 대상 action ID: `U4`
- 분기 기준: `main` = `35f3f81`

## 1. 배경

`docs/diagram/png`의 대표 화면 와이어프레임 5장과 `I1`이 완성한 `/play` 구현이
정보 구조에서 어긋난다. 와이어프레임은 개편 상위 spec이 요구하는 화면 정보
배치를 그린 것이고, 구현은 화면 트랙(`U1`~`U3`)이 하네스 단위로 각각 만든 것을
`I1`이 실제 흐름으로 이었다. 두 트랙이 만난 적이 없어 차이가 남았다.

`docs/diagram/README.md`와 `screen-wireframes.md`는 와이어프레임이 "최종 아트나
실제 React 구현을 확정하지 않는다"고 적고 있다. 따라서 지금의 차이는 규약
위반이 아니다. 이 작업은 **정보 구조와 계층을 와이어프레임에 맞추는 것**이며,
고정 픽셀 레이아웃 재현이 아니다.

## 2. 목표와 비목표

### 목표

- 5개 대표 화면의 패널 배치, 순서, 표시 항목을 와이어프레임과 일치시킨다.
- 이미 계산되어 있으나 렌더되지 않는 값을 화면에 드러낸다.
- 화면마다 오른쪽 사이드바가 다르다는 사실을 구조로 표현한다.

### 비목표

- 1920×1080 고정 좌표, 패널 픽셀 비율, 폰트 크기(본문 24px·제목 36px),
  선 굵기 3px의 재현. 반응형 레이아웃과 `app/globals.css`의 기존 토큰을 유지한다.
- `lib/rules/**`와 `lib/flow/**`의 변경. 규칙 트랙은 한 줄도 고치지 않는다.
- 새 도메인 필드 추가. `CampaignState`·`CampaignMember`를 확장하지 않는다.

## 3. 확인된 차이

5개 화면을 대조한 결과 차이가 세 종류로 갈린다.

### 3-1. 구조가 빠진 것 (이번 범위)

| 화면 | 와이어프레임 | 현재 |
| --- | --- | --- |
| 공통 | HUD 왼쪽에 화면 제목 | `CampaignHeader`에 제목 없음 |
| 02 지도 | 좌 범례 / 중 지도 / 우 파티의 단일 3열 | 범례가 지도 안에 중첩되어 브레이크포인트가 어긋남 |
| 02 지도 | 보스방을 별 도형으로 구분 | 모든 지점이 같은 원. `MapNodeView.isBoss`가 쓰이지 않음 |
| 02 지도 | 입장 버튼이 오른쪽 하단 | 지도 패널 안 |
| 03 정보 | 위쪽 관람 영역 / 아래 조작 영역 | 한 패널에 섞여 있음 |
| 05 엔딩 | 중앙 정렬 대형 타이포와 3열 요약 | 단일 패널 안의 좌우 2단 |

### 3-2. 데이터는 있으나 배선이 끊긴 것 (이번 범위)

- `MemberStatusView.trustDelta`가 항상 0이다. `PlayChrome`이
  `toPartyStatusView(participants)`를 두 번째 인자 없이 호출한다.
  `PartyStatusSidebar`는 이미 `▲`/`▼`를 그릴 줄 안다.
- `InfoSceneView`의 `sceneText`·`riskSummary`·`memberNames`가 와이어프레임의
  관람 영역과 같은 데이터인데 한 패널 안에 문단으로 눌려 있다.

### 3-3. 이미지가 규칙·확정 흐름과 충돌하는 것 (보류)

두 건은 **고치지 않고 기록만 한다.** 이미지가 낡았지만, 지금 이미지를 다시
그리는 것도 구현을 되돌리는 것도 이 작업의 범위가 아니다.

| 충돌 | 이미지 | 코드 | 판단 |
| --- | --- | --- | --- |
| 정산 단계 수 | 5칸 | `SETTLEMENT_STEP_ORDER` 6단계 | 규칙이 단일 출처다. 6칸을 유지한다 |
| 정보·사건 배치 | 한 화면에 카드와 행동 | `infoOpportunity` → `event` 2단계 | 커밋 `577b688`이 정한 흐름을 유지한다 |

## 4. 설계

### 4-1. 셸과 레이아웃 소유권

`PlayChrome`을 HUD 셸로 축소하고, 레이아웃은 각 라우트가 소유한다.

```text
PlayChrome
├ CampaignHeader (화면 제목 + 칩 5개)
└ <main>{children}</main>
```

파티 사이드바 렌더와 참가자 계산을 셸에서 제거한다.

**근거**: 셸이 `participants.length > 0`이면 항상 `PartyStatusSidebar`를 띄우는데,
`app/play/encounter/page.tsx`가 같은 화면에서 `PartyReactionSidebar`를 또
띄운다. 정보 전달 화면에 오른쪽 사이드바가 두 개 겹쳐 나오는 결함이 있다.
와이어프레임에서 오른쪽 패널은 화면마다 다르며, 셸이 그걸 알아야 하는 구조가
결함의 원인이다.

| 화면 | 오른쪽 |
| --- | --- |
| 01 게시판·계약 | 없음. `ContractPanel`이 파티를 보여준다 |
| 02 지도 | 파티 상태. `footer`에 입장 버튼 |
| 03 정보 전달 | 개인별 정보 반응만 |
| 03 사건 | 파티 상태 |
| 04 보스·정산, 05 엔딩 | 없음 |

`PartyStatusSidebar`에 이미 쓰이지 않는 `footer` 슬롯이 있다. 02의 입장 버튼이
그리로 간다. 두 화면이 파티 사이드바를 쓰므로
`app/play/expedition-party-aside.tsx`로 한 번만 만든다.

### 4-2. 화면 제목

제목은 `phase`와 `expedition`에서 전부 파생되므로, 페이지가 셸에 올리지 않고
셸이 상태에서 파생한다. `components/game/campaign-view-model.ts`에 순수 함수
`toScreenTitle(campaign)`을 추가하고 Vitest로 고정한다.

| phase | 제목 |
| --- | --- |
| `board`, `contract` | 캠페인 게시판 |
| `map` | `{던전명} · 공개 분기 지도` |
| `infoOpportunity` | `정보 전달 · {사건명}` |
| `event` | `사건 · {사건명}` |
| `boss`, `settlement` | `자동 보스전 결과 · {던전명}` |
| `ended` | 캠페인 엔딩 |

**근거**: 화면이 문장을 지어내지 않고 상태에서 파생한다는 기존 원칙과 같다.
Next App Router의 layout은 `children`만 받으므로 페이지가 위쪽 HUD에 제목을
주려면 context가 필요한데, 파생으로 풀면 그 비용이 사라진다.

### 4-3. 화면별 그리드

좁은 폭에서는 세로로 쌓인다. 가로 스크롤을 만들지 않는다.

| 화면 | 그리드 |
| --- | --- |
| 01 | `lg:grid-cols-[3fr_2fr]` |
| 02 | `lg:grid-cols-[13rem_1fr_18rem]` |
| 03 | `lg:grid-cols-[1fr_20rem]` |
| 04 | 세로 스택 |
| 05 | 중앙 정렬 헤더 + `sm:grid-cols-[minmax(0,14rem)_1fr]` |

### 4-4. 컴포넌트 변경

**02 지도**

- `components/game/MapLegend.tsx`를 신설하고 `DungeonMapView`에서 범례
  `<Panel>`을 들어낸다. `DungeonMapView`는 지도 하나만 그린다.
- 입장 버튼을 `DungeonMapView`에서 빼 파티 사이드바 `footer`로 옮긴다.
- 보스 노드를 별 도형으로 그린다. `MapNodeView.isBoss`가 계산되어 있으나
  쓰이지 않는다.

  **근거**: `EVENT_KIND_MARKS.special`과 보스의 `categoryMark`가 둘 다 `★`다.
  범례가 `★ 특수 사건`과 `★ 보스방`을 함께 가르쳐 같은 기호가 두 뜻을 갖는다.
  기호를 바꾸면 `EVENT_KIND_MARKS`를 건드려 다른 화면과 테스트에 번지므로,
  보스만 도형을 달리해 구분한다. 와이어프레임도 보스를 별 도형으로 그린다.

**03 정보·사건**

- `InfoOpportunityPanel`을 둘로 쪼갠다.
  - `EncounterScenePanel` — 관람 영역: 파티원, 상황 문장, 공개 위험
  - `InfoCardChoices` — 조작 영역: 카드 3장
- 사건 화면도 `EncounterScenePanel`을 쓴다. `EventView`에 `title`·
  `description`·`riskSummary`가 있어 그대로 들어가고, 두 단계 사이에 위쪽
  관람 영역이 유지되어 흐름이 끊기지 않는다.

**04 보스·정산**

- `SettlementTimeline`의 그리드를 `lg:grid-cols-6`으로 바꿔 6단계가 한 줄로
  읽히게 한다. 좁으면 쌓인다.

**05 엔딩**

- 헤더를 `Panel` 밖 중앙 정렬로 올린다: 시드 → 엔딩명 → 판정 원인.
- 요약을 `최종 영구 등급` / `캠페인 요약` 2열로 둔다. 와이어프레임의
  `대표 정보 선택` 열은 데이터가 없어 넣지 않는다.
- `새 캠페인 시작 →` 버튼을 넣는다. 스토어에 `startCampaign(seed)`와
  `resetCampaign()`이 이미 있다.

### 4-5. 데이터 배선 한 건

`신뢰 74 ↑2` 증감 표시를 살린다.

- `app/play/encounter/page.tsx`가 `prepareInfoCardReview`로 이미 개인별 delta를
  계산한다. 그 결과를 스토어에 보관한다.
- 스토어에는 **`lastTrustDeltas: Record<string, number> | null`** 만 넣는다.
  `MemberReactionView`는 `components/`의 타입이므로 `lib/stores`가 그것을
  import하면 의존 방향이 뒤집힌다. 숫자 맵만 넘긴다.
- `I1`이 정한 스토어 타이밍 규칙을 따른다. `acceptContract`에서
  `EMPTY_RESULTS`와 함께 비운다.

## 5. 검증

DOM 테스트는 없다. `U1`~`U3`에서 정한 결정을 유지한다. 로직은 view-model
테스트가, 컴포넌트는 typecheck·lint·build와 브라우저가 게이트한다.

### 새 Vitest

| 대상 | 검증 |
| --- | --- |
| `toScreenTitle` | 8개 phase가 각각 기대 제목을 낸다. 던전명·사건명이 실제 상태에서 온다 |
| `campaign-store` | `lastTrustDeltas`가 저장되고 `acceptContract`에서 비워진다 |

**판별력을 확인한다.** `toScreenTitle`에서 `map`과 `boss`의 제목을 서로 바꿔
테스트가 실제로 깨지는지 보고, 확인 내용을 PR 본문에 적은 뒤 되돌린다.
`git diff --stat`으로 복원을 확인한다.

### 브라우저 검증

시각 작업이므로 이것이 주 게이트다.

- `pnpm dev` 후 Playwright로 5개 화면을 1920×1080으로 캡처한다.
- `docs/diagram/png/screen-0N-*.png`와 나란히 놓고 패널 배치·순서·항목 유무를
  확인한다. 픽셀 일치가 아니라 정보 구조 일치를 본다.
- 1024·768 폭에서 세로로 쌓이는지, 가로 스크롤이 생기지 않는지 확인한다.
- 캡처는 스크래치패드에 두고 커밋하지 않는다.

### 회귀

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm backtest
```

규칙을 고치지 않으므로 `git diff docs/technical/BACKTEST_REPORT.md`가 비어야
한다. 비어 있지 않으면 규칙을 건드린 것이니 멈춘다.

하네스 3종(`/u1-test`~`/u3-test`)은 남긴다. `DungeonMapView`의 시그니처가
바뀌면 하네스도 따라 고쳐야 하며, 안 고치면 build가 깨지므로 누락되지 않는다.

## 6. 범위 밖과 근거

| 항목 | 이유 | 후속 |
| --- | --- | --- |
| 정산 5칸 vs 6단계 | 규칙이 단일 출처다 | 이미지를 다시 그릴지는 별도 판단 |
| 정보·사건 한 화면 | `577b688`이 정한 흐름이다 | 같음 |
| 공고별 `위험: 함정 / 정보` | 게시판 단계에 지도가 없다. 미리 생성하는 것은 규칙 호출 추가다 | `C5` |
| 계약 `공개 위험: 함정 2 / 정보 2 / 전투 1` | 같음 | `C5` |
| 엔딩 통계, 가장 큰 전환점 | `CampaignState` 확장이 필요하다 | `C6` |
| 엔딩 `같은 시드 기록 보기`·`상세 원정 연대기` | 기능이 없다 | `C6` |
| 파티원 소지 아이템 | `CampaignMember`에 필드가 없다. 한 필드짜리라 별도 행을 만들지 않는다 | `C6`에 함께 |
| 04 하단 원인 사슬 띠 | 정산 타임라인과 다른 정보다. 선택한 카드부터 캠페인 변화까지의 인과를 추적하려면 탐험 전체 이력이 필요하다 | `C6` |
| 밸런스 조정 | 규칙 상수 변경이다 | `B1` |

## 7. 관련 문서

- [대표 화면 와이어프레임](../../diagram/screen-wireframes.md)
- [온보딩과 인터페이스](../../experience/ONBOARDING_AND_INTERFACE.md)
- [작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)
- [I1 캠페인 통합 설계](2026-08-16-lattebun-i1-campaign-integration-design.md)
