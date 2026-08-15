# U1 공고 게시판·캠페인 HUD 화면 설계

> 상태: 사용자 검토 요청
> 작성일: 2026-08-14
> 작성자: LatteBun
> 작성 도구: Claude Code (Opus 4.8)

## 목적

던전 15개 캠페인 개편(상위 spec `2026-08-13-sanghwan-yoo-game-direction-rework-design.md`)의 화면 트랙 첫 작업 `U1`을 구현한다. 캠페인 공통 헤더(HUD), 공고 게시판, 계약·파티 확인 패널을 만들어 플레이어가 첫 공고를 고르기 전 캠페인 상태와 계약 후보를 비교하게 한다.

이 작업은 화면 트랙을 **목·프리뷰 계약으로 병렬 진행**하고 라이브 상태 머신·스토어(`I1`)와의 연결은 하지 않는다. 규칙 데이터는 이미 완료된 `F1`(도메인 계약)과 `C1`(게시판 규칙)에서 가져온다.

## 근거와 기준 문서

- 화면 구조: `docs/diagram/screen-wireframes.md`와 `docs/diagram/png/screen-01-campaign-board.png`(공고 게시판·계약·파티 확인 와이어프레임)
- 표시 요구: `docs/experience/ONBOARDING_AND_INTERFACE.md`의 "캠페인 공통 헤더", "공고 게시판"
- 최상위 기준: `docs/GAME_PRINCIPLES.md`
- 배정표: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`의 `U1` 행(완료 기준 = 공고·지원 조건·파티 상태와 등급·명성·두 골드·점수·남은 던전 표시)
- 데이터 계약: `lib/domain/campaign.ts`, `lib/rules/board.ts`, `lib/content/dungeons.ts`

규칙이 충돌하면 게임 원칙 → 공식 시스템·경험 문서 → 상위 spec → 와이어프레임 순으로 해석한다. 와이어프레임은 "구조 참고용·최종 아트 아님"이므로 구조는 따르되 원칙과 충돌하는 표현(고유 던전명 등)은 원칙을 따른다.

## 범위

### 포함

- 캠페인 공통 헤더(HUD): 영구 등급, 현재 명성, 현재/누적 골드, 승급 점수와 다음 등급 기준, 남은 던전 수
- 공고 게시판: 최대 5개 공고의 등급·필요 명성·보상·지도 지점 수·연결 파티 요약·지원 가능 여부(부족 명성 포함)
- 계약·파티 확인 패널: 선택한 던전 상세와 출전 파티 3인의 직업·성격·HP·개인 신뢰·소지 골드·행동 기억 요약
- HUD 승급 점수 계산을 위한 최소 순수 규칙 모듈(`lib/rules/promotion.ts`)
- 화면 데이터 조인·파생을 담당하는 순수 view-model 계층과 단위 테스트
- 검증용 프리뷰 라우트(`app/u1-test`)와 fixture

### 제외

- 라이브 캠페인 스토어·상태 머신 연결과 실제 계약 수락 전이 (`I1`, Task 8)
- 던전 지도, 정보 전달, 사건, 보스, 정산, 엔딩 화면 (`U2`·`U3`)
- **공고·계약의 "위험" 표시**(함정/정보/전투 등 사건 분류). 지도 생성 `E1`이 제공하며 U1 완료 기준 밖이다. view-model에 자리(`riskSummary?`)만 주석으로 남기고 E1 통합 때 채운다
- 던전·파티 **고유명**. 프로토타입은 등급·번호로 표시한다(게임 원칙)
- 승급 판정·강등 없음 로직, 정산 반영(`C3`). U1은 점수·다음 기준의 **표시**만 한다
- 구 단일 런 화면(`app/play/*`, `ResourceBar`, `PartySidebar`)의 수정·삭제

### 원칙·데이터와의 충돌 처리(확정)

1. **던전·파티 이름** — 와이어프레임은 `잿빛 기록보관소`·`철의 서약`을 쓰지만 `CampaignDungeon`/`CampaignParty`에 이름 필드가 없고 원칙이 "고유 서사 없이 등급과 번호로 표시"를 못박는다. → 등급+번호(예: `C급 1번`), 파티는 번호(예: `1팀`)로 표시한다. 데이터 계약을 바꾸지 않는다.
2. **위험 표시** — 지도 사건 분류에 의존하고 `E1` 미착수이며 U1 완료 기준 밖이다. → U1에서 생략한다.

## 아키텍처

단방향 데이터 흐름. 도메인 상태를 순수 함수로 표시용 view로 변환하고, 순수 표시 컴포넌트가 렌더하며, 동작은 콜백 prop으로 위로 올린다.

```text
CampaignState (props 주입)
   → campaign-view-model.ts (순수 조인·파생)
   → CampaignHeader · Board · ContractPanel (순수 표시)
   → app/u1-test 하네스 (콜백을 로컬 useState로 처리, 실 전이 없음)
```

### 파일

| 파일 | 책임 |
| --- | --- |
| `lib/rules/promotion.ts` | `calculatePromotionScore`, 등급 기준 상수, `nextGradeTarget` |
| `lib/rules/promotion.test.ts` | 점수식·기준·다음 등급 단위 테스트 |
| `components/game/campaign-view-model.ts` | `toCampaignHeaderView`·`toBoardView`·`toContractView` |
| `components/game/campaign-view-model.test.ts` | 조인·파생·경계값 테스트 |
| `components/game/CampaignHeader.tsx` | HUD 헤더 |
| `components/game/Board.tsx` | 공고 목록과 계약 버튼 |
| `components/game/ContractPanel.tsx` | 선택 던전 상세와 출전 파티 |
| `app/u1-test/page.tsx` | 프리뷰 하네스 |
| `app/u1-test/u1-fixtures.ts` | 하네스용 CampaignState fixture |

### import 경계 (eslint 강제 규칙 준수)

- `components/**`는 `@/lib/mock`을 import하지 않는다. 데이터는 `app/u1-test`가 만들어 props로 주입한다.
- `components/ui/**`는 `@/lib/domain`을 import하지 않는다(프리미티브 유지). 새 컴포넌트는 `components/game/**`에 둔다.
- view-model과 컴포넌트는 `@/lib/domain`·`@/lib/rules`·`@/lib/content`만 참조한다.

## 규칙 모듈: `lib/rules/promotion.ts`

승급 점수와 다음 등급 기준은 상위 spec에서 확정된 값이다. C3(정산·승급, 미착수)이 그대로 재사용할 수 있는 순수 함수로 최소 구현한다.

```ts
export const PROMOTION_THRESHOLDS: Readonly<Record<Grade, number>> = {
  C: 0, B: 120, A: 274, S: 370,
};

// 승급 점수 = 현재 명성 × 2 + 누적 획득 골드
export function calculatePromotionScore(
  currentReputation: number,
  cumulativeGold: number,
): number;

// 현재 영구 등급 바로 위 등급과 그 기준. S면 null(최고 등급 달성).
export function nextGradeTarget(rank: Grade): { grade: Grade; threshold: number } | null;
```

`nextGradeTarget`은 현재 점수가 아니라 **현재 영구 등급**을 기준으로 바로 위 등급을 돌려준다. 강등이 없으므로 등급이 점수보다 앞설 수 있고, HUD의 "다음 등급 기준"은 영구 등급 기준으로 표시하는 것이 일관적이다.

> **merge 전 조율**: 이 모듈은 C3과 소유가 겹친다. merge 직전 `gh pr list`로 C3 진행 여부를 확인한다. C3이 먼저 병합됐으면 U1은 C3의 함수를 import하고 이 파일을 삭제한다. U1이 먼저면 C3이 이 파일 위에 `promote()`·정산을 쌓는다. 어느 경우든 점수식·기준의 단일 출처를 유지한다.

## view-model 계층: `components/game/campaign-view-model.ts`

### `CampaignHeaderView`

```ts
interface CampaignHeaderView {
  rank: Grade;
  currentReputation: number;
  currentGold: number;
  cumulativeGold: number;
  promotionScore: number;
  nextGrade: { grade: Grade; threshold: number } | null; // null = S 달성
  remainingDungeons: number;
  totalDungeons: number; // 항상 15
}
```

- `promotionScore = calculatePromotionScore(state.currentReputation, state.cumulativeGold)`
- `nextGrade = nextGradeTarget(state.rank)`
- `remainingDungeons = state.dungeons.filter((d) => d.status === "remaining").length`
- `totalDungeons = state.dungeons.length`

### `BoardOfferView`

```ts
interface BoardOfferView {
  offerId: BoardOfferId;
  order: number;            // 1..5 표시 순번
  dungeonLabel: string;     // "C급 1번" (현재 등급 + 던전 번호)
  grade: Grade;
  failureCount: number;     // >0이면 "실패 N회 상승" 표기
  requiredReputation: number;
  reputationReward: number; // baseReputationReward
  goldReward: number;       // baseGoldReward
  nodeCount: number;
  partyLabel: string;       // "1팀" (party 번호)
  survivorCount: number;    // 연결 파티의 생존 인원
  averageTrust: number;     // 생존 인원 개인 신뢰 평균, 반올림
  locked: boolean;
  shortfall: number | null; // locked & insufficientReputation이면 부족 명성, 아니면 null
  lockReason: BoardLockReason;
  // riskSummary?: RiskSummary — E1 통합 때 추가. U1에서는 없음.
}
```

- `state.board`(C1 `generateBoard` 결과)를 순회하며 `offer.dungeonId`로 `state.dungeons`, `offer.partyId`로 `state.parties`·`state.members`를 조인한다.
- `dungeonLabel`: 던전 번호는 `dungeon-00N` id에서 파싱하고 등급은 던전의 **현재 grade**를 쓴다. `failureCount>0`이면 원 등급과 실패 상승 이력을 함께 표기한다.
- `survivorCount`·`averageTrust`: 파티 `memberIds`로 `state.members`를 찾아 `alive`만 집계한다. 게시판은 완성 파티만 제안하므로 보통 3이지만 필드는 명시적으로 계산한다.
- `shortfall = locked && lockReason === "insufficientReputation" ? requiredReputation - state.currentReputation : null`

### `ContractView`

```ts
interface ContractMemberView {
  memberId: MemberId;
  name: string;
  className: string;        // CLASSES에서 조인
  personalityLabel: string; // PERSONALITY_LABELS
  currentHp: number;
  maxHp: number;
  trust: number;
  carriedGold: number;
  memorySummary: string;    // 최신 memory summary, 없으면 "최근 변화 없음"
}

interface ContractView {
  offerId: BoardOfferId;
  dungeonLabel: string;
  grade: Grade;
  requiredReputation: number;
  reputationReward: number;
  goldReward: number;
  nodeCount: number;
  branchCount: number;      // 항상 2("두 갈래"). 구조 상수이며 지도 생성 아님
  bossRevealed: boolean;    // 항상 true("보스방 공개")
  partyLabel: string;
  members: ContractMemberView[];
  acceptable: boolean;      // canAcceptOffer 결과
  acceptBlockReason: "insufficientReputation" | "partyUnavailable" | null;
}
```

- `toContractView(state, offerId)`는 `state.board`에서 offer를 찾지 못하면 `null`을 돌려준다.
- `acceptable`·`acceptBlockReason`은 C1 `canAcceptOffer(state, offer)`를 그대로 사용한다.
- `branchCount`는 상위 spec의 "두 갈래"에 따라 2로 고정한다. 갈래별 지점 수(C2/B3/A4/S5)는 지도 구조로 `E1` 소관이므로 U1에서 계산하지 않는다.

### 함수

```ts
export function toCampaignHeaderView(state: CampaignState): CampaignHeaderView;
export function toBoardView(state: CampaignState): BoardOfferView[];
export function toContractView(state: CampaignState, offerId: BoardOfferId): ContractView | null;
```

모두 순수 함수이며 입력 상태를 변경하지 않는다.

## 컴포넌트

와이어프레임(`screen-01-campaign-board.png`) 구도를 따른다. 모두 `"use client"` 없이 렌더 가능한 순수 표시 컴포넌트로 두되, 동작은 콜백 prop으로 받는다.

### `CampaignHeader`

- props: `view: CampaignHeaderView`
- 5개 그룹을 가로 배치: `영구 등급`, `현재 명성`, `골드(현재/누적)`, `승급(점수 / 다음등급 기준)`, `남은 던전(N / 15)`.
- **영구 등급과 현재 명성을 다른 그룹·라벨로 구분**한다. 명성이 내려가도 등급이 유지된다는 원칙을 시각적으로 드러낸다.
- `nextGrade`가 `null`이면 승급 그룹에 "최고 등급" 문구를 표시한다.

### `Board`

- props: `offers: BoardOfferView[]`, `selectedOfferId: BoardOfferId | null`, `onSelectOffer(offerId)`, `onAcceptContract(offerId)`
- 헤더: "원정 공고 · 최대 N개 비교"와 "지원 조건 / 보상 / 위험" 라벨(위험 열은 이번 범위에서 값 없이 자리만).
- 각 공고 카드: 번호+던전 라벨, `등급 · 필요 명성`, `보상 명성 +골드`, `파티: N팀 · 생존 N · 평균 신뢰 N`, 우측 상단 상태.
- 지원 가능: `✓ 지원 가능`. 잠금: `× 지원 불가 · 명성 N 부족`(`shortfall`).
- **색 외 단서**: 상태는 `✓`/`×` 기호와 텍스트로, 잠금은 점선 테두리, 선택은 강조 테두리와 `aria-selected`로 구분한다. 잠긴 카드는 `aria-disabled`로 표시하되 정보는 계속 보여준다(숨기지 않는다).
- 하단 "선택한 공고 계약하기 →" 버튼: 선택이 없거나 선택 공고가 `locked`이면 비활성(게시판 공고에서 `locked`은 곧 지원 불가이며, 정밀한 `acceptable` 판정은 계약 패널의 `canAcceptOffer` 결과를 쓴다).

### `ContractPanel`

- props: `contract: ContractView | null`
- `null`이면 "공고를 선택하세요" 안내.
- 상단: 던전 상세(`등급 · 필요 명성 · 명성 보상 + 골드`, `지도: 전체 N지점 · 두 갈래 · 보스방 공개`).
- 하단: "출전 파티 · N팀"과 파티원 3인 카드(이름·직업, 성격, `HP x / y`, `개인 신뢰 N`, `소지 NG`, 기억 요약).

## 데이터 흐름과 하네스

`app/u1-test/page.tsx`가 유일한 렌더 소비자다. 스토어·상태 머신을 만들지 않는다.

- `u1-fixtures.ts`는 CampaignState 몇 개를 만든다.
  - `initializeCampaign(seed)` 기반 초기 상태(등급 C, 명성 0 → B/A/S 공고 잠금 확인).
  - `lib/rules/fixtures.ts`의 `createFixtureCampaignState`를 손질한 중반 상태(등급 B·명성 38·일부 클리어·실패 상승 던전 1개 등 와이어프레임 상황 재현). 게시판은 `generateBoard`로 채운다.
- 하네스는 `selectedOfferId`를 로컬 `useState`로 관리한다. `onSelectOffer`가 선택을 바꾸고, `onAcceptContract`는 실제 전이 대신 "수락됨(실 전이는 I1에서 연결)" 문구를 표시한다.
- fixture import는 `app/**`에서만 한다. 컴포넌트·view-model은 목을 모른다.

## 오류·경계 처리

- `toContractView`가 offer를 찾지 못하면 `null`을 돌려주고 패널은 안내 문구를 표시한다.
- `averageTrust`는 생존 인원이 0이면(이론상 완성 파티에 없음) 0을 돌려주고 계산에서 0 나눗셈을 피한다.
- view-model은 도메인 상태를 변경하지 않는다. 입력 배열을 복사·파생만 한다.
- 잠긴 공고는 삭제·숨김 없이 상태와 부족 수치를 함께 노출한다(게임 원칙 6).

## 테스트

### 단위 테스트(Vitest, node 환경, DOM 없음)

`promotion.test.ts`:
- `calculatePromotionScore(66, 142) === 274`, `calculatePromotionScore(0, 0) === 0`
- `PROMOTION_THRESHOLDS`가 `{C:0,B:120,A:274,S:370}`
- `nextGradeTarget("C")` → `{grade:"B",threshold:120}`, `nextGradeTarget("A")` → `{grade:"S",threshold:370}`, `nextGradeTarget("S") === null`

`campaign-view-model.test.ts`:
- `toCampaignHeaderView`: 점수·`nextGrade`·`남은/전체 던전` 파생. S 등급이면 `nextGrade === null`.
- `toBoardView`: 던전·파티 조인, `averageTrust` 반올림, `survivorCount`, 잠금 공고의 `shortfall`, `failureCount>0` 라벨.
- `toContractView`: 파티원 직업·성격·HP·신뢰·골드 조인, 빈 memory → "최근 변화 없음", 등급별 `branchCount === 2`, offer 없으면 `null`, `acceptable`·`acceptBlockReason`이 `canAcceptOffer`와 일치.

### 통합·시각 검증

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 모두 통과.
- `/u1-test`를 브라우저로 열어 와이어프레임 대응(잠금 표시, 선택 강조, 파티 상세, HUD 5그룹)과 색 외 단서를 눈으로 확인한다.

### 검사 발동 확인(습관)

view-model의 조인·잠금 로직은 일부러 위반을 넣어(예: `averageTrust` 기대값을 틀리게, 잠금 공고에 `shortfall` 누락) 테스트가 실제로 잡는지 확인하고, 확인 내용을 PR 본문에 적은 뒤 되돌린다.

## 완료 기준

- HUD가 영구 등급, 현재 명성, 현재/누적 골드, 승급 점수와 다음 등급 기준, 남은 던전 수를 표시한다.
- 게시판이 최대 5개 공고의 등급·필요 명성·보상·지점 수·파티 요약과 지원 가능/부족 명성을 표시하고, 잠긴 공고도 숨기지 않는다.
- 계약 패널이 선택 던전 상세와 출전 파티 3인의 직업·성격·HP·개인 신뢰·소지 골드·기억 요약을 표시한다.
- 던전·파티는 등급·번호로 표시하고 고유명을 쓰지 않는다.
- 상태·잠금·선택을 색뿐 아니라 기호·형태·aria 속성으로 구분한다.
- view-model·promotion 단위 테스트와 네 검증 명령이 모두 통과한다.
- 구 단일 런 화면과 스토어·상태 머신을 수정하지 않는다.

## 후속 연결

- `I1`이 `app/u1-test`의 fixture 대신 라이브 캠페인 스토어를 붙이고 `onAcceptContract`를 `transitionCampaign`에 연결한다.
- `E1` 통합 때 `BoardOfferView`·`ContractView`에 `riskSummary`를 추가해 위험 표시를 채운다.
- `C3` 병합 시 `lib/rules/promotion.ts`의 소유를 조율한다(위 "merge 전 조율").
- 배정표 `U1` 상태 갱신은 작업 마지막에 main 동기화 후 수행한다.
