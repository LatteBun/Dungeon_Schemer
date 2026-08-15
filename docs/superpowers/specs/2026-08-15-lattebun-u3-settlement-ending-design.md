# U3 보스전 결과·정산·엔딩 화면 설계

> 상태: 사용자 검토 요청
> 작성일: 2026-08-15
> 작성자: LatteBun
> 작성 도구: Claude Code (Opus 5)

## 목적

던전 15개 캠페인 개편의 화면 트랙 마지막 작업 `U3`를 구현한다. 자동 보스전 결과, 정산 원인 사슬, 캠페인 엔딩 화면을 만들어 플레이어가 자기 선택이 무엇을 바꿨는지 순서대로 확인하게 한다.

`U1`·`U2`와 같은 병렬 화면 트랙 방식을 따른다. 라이브 스토어 연결은 하지 않고(`I1`), 이미 완료된 `C3`(정산·승급·엔딩)와 `C4`(캠페인 전이 함수) 규칙을 실제로 소비한다.

## 근거와 기준 문서

- 화면 구조: `docs/diagram/screen-wireframes.md`와 `docs/diagram/png/screen-04-boss-settlement.png`(보스전·정산), `docs/diagram/png/screen-05-campaign-ending.png`(캠페인 엔딩)
- 표시 요구: `docs/experience/ONBOARDING_AND_INTERFACE.md`의 "보스전과 정산", "캠페인 엔딩"
- 최상위 기준: `docs/GAME_PRINCIPLES.md`
- 배정표: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`의 `U3` 행(완료 기준 = 생존부터 승급까지 원인 순서와 네 엔딩·최종 등급 표시)
- 규칙 계약: `lib/rules/settlement.ts`(`settleExpedition`·`SETTLEMENT_STEP_ORDER`), `lib/rules/ending.ts`(`resolveEnding`·`ENDING_PRIORITY`), `lib/rules/boss.ts`(`resolveBossFight`·`BossResolution`), `lib/rules/promotion.ts`, `lib/flow/campaign-machine.ts`(`transitionCampaign`)

규칙이 충돌하면 게임 원칙 → 공식 경험·시스템 문서 → 상위 spec → 와이어프레임 순으로 해석한다. 와이어프레임은 "구조 참고용·최종 아트 아님"이므로 구조는 따르되 데이터 계약에 없는 항목은 아래 "확정한 처리"를 따른다.

## 범위

### 포함

- 자동 보스전 결과 화면: 파티원별 생존·사망, HP 변화, 받은 피해, 정보 카드가 만든 피해 보정, 사후 검증 원인, 신뢰 변화
- 정산 화면: `C3`가 만든 6단계 원인 사슬(`survival`→`reward`→`dungeon`→`promotion`→`party`→`ending`)을 번호 순서로 표시
- 캠페인 엔딩 화면: 네 엔딩의 이름·판정 원인, 최종 영구 등급, 승급 점수, 캠페인 요약
- 화면 데이터 조인 view-model과 단위 테스트
- 검증용 프리뷰 라우트(`app/u3-test`)와 fixture

### 제외

- 라이브 캠페인 스토어 연결과 실제 화면 전이 (`I1`)
- 규칙 재구현. 보스·정산·승급·엔딩 계산은 `C3`·`C4`가 소유하며 `U3`는 표시·조립만 한다
- **캠페인 누적 통계**: 와이어프레임의 `진실 18회 / 거짓 12회 / 중립 9회 / 적발 7회`, `생존시킨 파티 11팀 / 전멸시킨 파티 2팀`, `가장 큰 전환점`. `InfoRecord`는 탐험마다 닫히고 `CampaignState`에 누적 필드가 없다. 데이터 계약을 넓히면 이미 병합된 `C3`·`C4`와 `I1`에 파급되므로 이번 범위에서 제외한다
- 엔딩 화면의 `같은 시드 기록 보기`·`상세 원정 연대기` 버튼(별도 기능), `새 캠페인 시작`(전이이므로 `I1`)
- 구 단일 런 화면(`app/play/*`)의 수정·삭제

### 확정한 처리

1. **엔딩 요약은 `CampaignState`에서 계산 가능한 것만 쓴다.** 클리어 던전 수, 사망자 수, 생존자 수와 생존률, 완성 파티 수, 최종 명성, 현재·누적 골드, 시드, 최종 등급과 승급 점수.
2. **정산 단계는 `C3`의 6단계를 그대로 쓴다.** 와이어프레임은 `던전`과 `승급`을 한 칸에 합쳐 5칸으로 그렸지만, `SETTLEMENT_STEP_ORDER`가 규칙의 단일 출처이므로 화면이 단계를 합치지 않는다.

## 아키텍처

`U1`·`U2`와 같은 단방향 흐름을 따른다.

```text
BossResolution · SettlementStep[] · CampaignState (props 주입)
   → settlement-view-model.ts (순수 조인)
   → BossResultPanel · SettlementTimeline · EndingPanel (순수 표시)
   → app/u3-test 하네스 (실제 캠페인을 한 탐험 진행시켜 데이터 생성)
```

### 전이 함수가 버리는 데이터

`C4`의 `transitionCampaign`은 상태만 반환하므로 화면이 필요한 두 가지를 잃는다.

| 행동 | 규칙 함수가 만드는 것 | 전이 함수가 남기는 것 | 잃는 것 |
| --- | --- | --- | --- |
| `resolveBoss` | `BossResolution`(`members[].damageModifier`, `verifications`) | `ExpeditionState.bossResult` = `survivorIds`·`casualtyIds`·`damageByMember` | 피해 보정, 사후 검증 원인 |
| `applySettlement` | `SettlementResult` = `{ state, steps }` | `state`만 | 6단계 원인 사슬 `steps` |

와이어프레임 `screen-04`가 요구하는 `원인: 거짓 수용 · 보스 피해 +25%`와 정산 timeline이 정확히 그 잃는 데이터다. 따라서 **하네스는 `resolveBossFight`와 `settleExpedition`을 직접 호출해** 전체 결과를 얻는다. 규칙을 다시 구현하는 것이 아니라 `transitionCampaign`이 내부에서 부르는 같은 함수를 부르는 것이다.

`I1`이 라이브 스토어를 붙일 때 같은 문제를 만난다. 전이 함수가 `steps`와 `BossResolution`을 밖으로 내보내거나, 스토어가 규칙 함수를 직접 부르고 결과를 보관해야 한다. 이 결정은 `I1`의 몫이며 이 spec은 문제만 기록한다.

### 파일

| 파일 | 책임 |
| --- | --- |
| `components/game/settlement-view-model.ts` | 보스 결과·정산 단계·엔딩 view 조인(순수) |
| `components/game/settlement-view-model.test.ts` | 조인·파생·경계값 테스트 |
| `components/game/BossResultPanel.tsx` | 파티원별 보스전 결과 |
| `components/game/SettlementTimeline.tsx` | 6단계 원인 사슬 |
| `components/game/EndingPanel.tsx` | 엔딩 이름·원인·최종 등급·요약 |
| `app/u3-test/u3-fixtures.ts` | 한 탐험을 실제로 진행시켜 정산·엔딩 데이터 생성 |
| `app/u3-test/page.tsx` | 프리뷰 하네스 |

**수정**: `components/game/labels.ts`에 엔딩 이름과 정산 단계 라벨을 추가한다. 규칙이 주는 것은 `id`와 `reason`뿐이고 사람이 읽는 화면 이름은 표시 계층의 책임이다.

**재사용(변경 없음)**: `components/game/CampaignHeader.tsx`(U1 HUD), `components/game/campaign-view-model.ts`의 `toCampaignHeaderView`, `components/ui/Panel.tsx`·`StatValue.tsx`.

### import 경계 (eslint 강제)

- `components/**`는 `@/lib/mock`을 import하지 않는다. 데이터는 `app/u3-test`가 만들어 props로 주입한다.
- view-model과 컴포넌트는 `@/lib/domain`·`@/lib/rules`·`@/lib/content`·`./labels`만 참조한다.

## 라벨 추가: `components/game/labels.ts`

```ts
export const ENDING_LABELS: Record<CampaignEndingId, string> = {
  distrust: "불신의 대가",
  expeditionComplete: "원정 종료",
  supportUnavailable: "길잡이 자격 박탈",
  partyExhausted: "용사들의 시대가 끝나다",
};

export const SETTLEMENT_STEP_LABELS: Record<SettlementStepKind, string> = {
  survival: "생존·신뢰",
  reward: "계약 보상",
  dungeon: "던전",
  promotion: "승급",
  party: "파티·회복",
  ending: "다음 상태",
};
```

엔딩 이름은 `docs/systems/PROGRESSION_AND_ENDINGS.md`와 상위 spec이 정한 네 이름을 그대로 쓴다.

## view-model: `settlement-view-model.ts`

모든 함수는 순수하며 입력을 변경하지 않는다.

**핵심 원칙**: 규칙이 만든 문장을 그대로 표시한다. `SettlementStep.summary`, `TrustChange.reason`, `CampaignEnding.reason`은 이미 사람이 읽는 문장이므로 view-model이 다시 쓰지 않는다. 화면은 순서·번호·라벨만 얹는다.

### 보스전 결과

```ts
export interface BossMemberView {
  memberId: MemberId;
  name: string;
  className: string;
  survived: boolean;
  survivalMark: string;        // "✓" | "×"
  survivalLabel: string;       // "생존" | "사망"
  hpBefore: number | null;     // clamp로 복원 불가한 누락 스냅샷은 null
  hpAfter: number;
  damage: number;
  modifierNote: string;        // "보스 피해 +25%" | "보스 피해 -20%" | "보정 없음"
  verificationNote: string | null; // verifications의 change.reason, 없으면 null
  trustDelta: number;          // verifications의 change.delta, 없으면 0
}

export interface BossResultView {
  outcome: BossOutcome;        // "clear" | "wipe"
  outcomeLabel: string;        // "클리어" | "전멸"
  members: BossMemberView[];
}

export function toBossResultView(
  resolution: BossResolution,
  membersBefore: readonly CampaignMember[],
): BossResultView;
```

- `hpBefore`는 `membersBefore`(보스전 입력 시점 스냅샷)에서 읽고, `hpAfter`는 이미 피해가 반영된 `resolution.members[].member.currentHp`를 그대로 쓴다. 스냅샷이 없는 생존자는 `min(maxHp, hpAfter + damage)`로 전투 전 HP를 복원한다. 사망자는 HP 0 clamp로 원래 값이 소실되므로 `null`로 두고 화면에 `미상`을 표시한다.
- `survived`는 `resolution.survivorIds` 포함 여부로 정한다.
- `modifierNote`는 `damageModifier`를 백분율로 포맷한다. `0`이면 `"보정 없음"`, 양수면 `+`를 붙인다. 소수 오차를 피하려 `Math.round(modifier * 100)`을 쓴다.
- `verificationNote`·`trustDelta`는 `resolution.verifications`에서 `memberId`가 같은 첫 항목의 `change.reason`·`change.delta`를 쓴다. 없으면 `null`·`0`.

### 정산 단계

```ts
export interface SettlementStepView {
  order: number;               // 1부터
  kind: SettlementStepKind;
  label: string;               // SETTLEMENT_STEP_LABELS
  summary: string;             // SettlementStep.summary 원문
}

export function toSettlementTimelineView(
  steps: readonly SettlementStep[],
): SettlementStepView[];
```

입력 순서를 그대로 유지하고 `order`만 1부터 매긴다. `summary`를 가공하지 않는다. `C3`가 단계를 건너뛰어 6개보다 적게 줄 수 있으므로 개수를 단정하지 않는다.

### 엔딩

```ts
export interface EndingSummaryView {
  clearedDungeons: number;
  totalDungeons: number;
  deadMembers: number;
  aliveMembers: number;
  survivalRate: number;        // 0~100 정수(반올림)
  completeParties: number;
  finalReputation: number;
  currentGold: number;
  cumulativeGold: number;
  seed: string;
}

export interface EndingView {
  endingId: CampaignEndingId;
  endingLabel: string;         // ENDING_LABELS
  reason: string;              // CampaignEnding.reason 원문
  finalRank: Grade;
  promotionScore: number;
  nextGrade: { grade: Grade; threshold: number } | null;
  summary: EndingSummaryView;
  retrospective: string;       // "S급 목표를 위해 어떤 선택을 했는가?"
}

export function toEndingView(
  state: CampaignState,
  ending: CampaignEnding | null,
): EndingView | null;
```

- `ending`이 `null`이면 `null`을 돌려준다. 캠페인이 계속되는 상태다.
- `promotionScore`·`nextGrade`는 `U1`이 만든 `calculatePromotionScore`·`nextGradeTarget`을 재사용한다.
- `survivalRate`는 `members`가 비면 0으로 두어 0 나눗셈을 피한다.
- `completeParties`는 `parties.filter((party) => party.complete).length`다.

## 컴포넌트

와이어프레임 `screen-04`·`screen-05` 구도를 따른다. 모두 순수 표시 컴포넌트다. 상태는 색뿐 아니라 기호·테두리 형태로 함께 구분한다.

### `BossResultPanel`

- props: `view: BossResultView`
- 제목에 결과(`클리어`/`전멸`)를 쓰고, 파티원 카드마다 `✓ 생존` 또는 `× 사망`, `HP {before} → {after} · 피해 {damage}`, `원인: {modifierNote}`, 검증이 있으면 `신뢰 {delta} · {verificationNote}`를 보여준다.
- 사망자는 점선 + `text-trust-down`, 생존자는 실선 + `text-trust-up`으로 구분하되 기호를 함께 쓴다.

### `SettlementTimeline`

- props: `steps: SettlementStepView[]`
- 번호 배지(`order`) + 단계 라벨 + `summary`를 순서대로 그린다. 반응형 그리드로 좁은 화면에서는 세로로 쌓는다.
- 순서가 의미이므로 `<ol>`로 마크업해 보조기술이 순서를 읽게 한다.

### `EndingPanel`

- props: `view: EndingView`
- 엔딩 이름을 가장 크게, 그 아래 `reason`. 최종 영구 등급을 큰 글자로 보여주고 승급 점수와 다음 기준(있으면)을 함께 쓴다.
- 캠페인 요약을 라벨·값 그리드로 배치하고, 마지막에 회고 문구를 넣는다.

## 데이터 흐름과 하네스

`app/u3-test/page.tsx`가 유일한 렌더 소비자다. 스토어를 만들지 않는다.

### `u3-fixtures.ts`

```ts
export interface ExpeditionOutcome {
  headerView: CampaignHeaderView;   // 정산 후 상태 기준
  bossResolution: BossResolution;
  membersBefore: CampaignMember[];  // 보스전 직전 스냅샷
  steps: SettlementStep[];
  stateAfter: CampaignState;
  ending: CampaignEnding | null;
}

export function runOneExpedition(seed: string): ExpeditionOutcome;
export function completedCampaignOutcome(seed: string): ExpeditionOutcome;
```

`runOneExpedition`은 다음 순서로 한 탐험을 실제로 진행한다.

1. `initializeCampaign(seed)`로 캠페인을 만들고 `createCampaignMachineContext`로 조회표를 준비한다.
2. `transitionCampaign`으로 `openBoard` → `acceptContract`(잠기지 않은 첫 공고).
3. `phase`가 `boss`가 될 때까지 반복한다. `map`이면 `selectNode`(현재 노드의 첫 다음 노드), `infoOpportunity`면 `chooseInfoCard`(첫 후보), `event`면 `chooseEvent`(`affordableChoiceIds`가 허용한 첫 선택지).
4. 보스전 직전 출전 파티원을 복사해 `membersBefore`로 보관하고, `resolveBossFight`를 직접 호출해 `BossResolution`을 얻는다. 입력은 `bossByGrade`가 준 보스, 출전 파티원, `expedition.infoRecords`, 시드에서 파생한 난수다.
5. `transitionCampaign(resolveBoss)`로 상태를 `settlement`로 옮긴 뒤 `settleExpedition`을 직접 호출해 `{ state, steps }`를 얻는다.
6. `resolveEnding(state, survivorIds)`로 엔딩을 판정한다.

`completedCampaignOutcome`은 `runOneExpedition` 결과의 `stateAfter`에서 모든 던전을 `cleared`로 바꾼 상태로 `resolveEnding`을 다시 불러 `원정 종료` 엔딩을 재현한다. 규칙을 우회하지 않고 규칙에 넣는 입력만 손질한다.

### 하네스 화면

- 탭 둘: `정산`(보스 결과 + timeline), `엔딩`(엔딩 화면).
- 상단에 `CampaignHeader`를 고정한다.
- `정산` 탭은 `runOneExpedition`의 결과를, `엔딩` 탭은 `completedCampaignOutcome`의 결과를 보여준다.
- 4단계는 무작위 선택이 아니라 항상 첫 유효 선택을 고르므로 같은 시드가 같은 화면을 만든다.

## 오류·경계 처리

- 4단계 진행 루프는 최대 반복 횟수를 두고, 초과하면 명시적으로 오류를 던진다. 규칙이 예상과 다르게 동작할 때 무한 루프로 브라우저를 멈추지 않기 위함이다.
- `toEndingView`는 `ending`이 `null`이면 `null`을 돌려주고, 하네스는 "캠페인이 계속된다" 안내를 보여준다.
- `toBossResultView`는 `membersBefore`에서 `memberId`가 같은 멤버를 찾아 `hpBefore`로 쓴다. 찾지 못한 생존자는 `BossMemberResult.member.currentHp`가 사후 HP라는 계약에 따라 `min(maxHp, currentHp + damage)`로 전투 전 HP를 복원하고, 사망자는 clamp 전 값을 알 수 없으므로 `null`로 둔다. `hpAfter`는 항상 규칙의 사후 HP를 쓰므로 피해를 두 번 차감하지 않는다. 어느 쪽이든 항목을 건너뛰지 않으며 두 폴백 경로를 테스트로 고정한다.
- view-model은 입력 배열을 복사·파생만 하고 변경하지 않는다.

## 테스트

### 단위 테스트(Vitest, node 환경, DOM 없음)

`settlement-view-model.test.ts`:
- `toBossResultView`: 사후 HP 원문과 스냅샷 누락 복원, 사망자 판정(`survivorIds` 미포함), 정확한 결과 라벨, `modifierNote` 포맷(`+25%`·`-20%`·`보정 없음`), `verifications`의 `reason`·`delta`가 해당 멤버에 매칭, 검증 없는 멤버는 `null`·`0`
- `toSettlementTimelineView`: `order`가 1부터, 입력 순서 유지, `summary` 원문 보존, 단계가 6개 미만이어도 동작
- `toEndingView`: 네 엔딩 이름 매핑, `ending === null`이면 `null`, 최종 등급·승급 점수, 생존률 반올림, 요약 수치가 `CampaignState`와 일치

테스트는 손으로 만든 fixture 대신 실제 규칙 출력을 쓴다. `runOneExpedition`과 같은 방식으로 한 탐험을 돌려 `BossResolution`·`steps`를 얻고 그것으로 검증한다.

### 통합·시각 검증

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 모두 통과
- `/u3-test`를 브라우저로 열어 보스전 결과(생존·사망 구분, HP 변화, 원인), 정산 6단계 순서, 엔딩 화면(이름·최종 등급·요약)을 확인한다

### 검사 발동 확인(습관)

`hpAfter` 계산의 하한(`Math.max(0, …)`)과 `toSettlementTimelineView`의 `order` 시작값을 일부러 틀리게 바꿔 테스트가 잡는지 확인하고, 확인 내용을 PR 본문에 적은 뒤 되돌린다.

## 완료 기준

- 보스전 결과 화면이 파티원별 생존·사망, HP 변화, 피해, 피해 보정 원인, 사후 검증과 신뢰 변화를 보여준다.
- 정산 화면이 `C3`의 단계를 순서와 번호로 보여주고 `summary`를 가공 없이 표시한다.
- 엔딩 화면이 네 엔딩의 이름과 판정 원인, 최종 영구 등급, 승급 점수, 캠페인 요약을 보여준다.
- 엔딩이 없으면 캠페인이 계속된다는 상태를 보여준다.
- 생존·사망과 단계 순서를 색뿐 아니라 기호·번호·마크업으로 구분한다.
- 규칙을 재구현하지 않는다. 보스·정산·엔딩 계산은 `C3`·`C4` 함수를 호출해 얻는다.
- view-model 단위 테스트와 네 검증 명령이 모두 통과한다.
- 구 단일 런 화면과 스토어를 수정하지 않는다.

## 후속 연결

- **`I1`이 반드시 해결할 것**: `transitionCampaign`이 `steps`와 `BossResolution`을 버리므로, 라이브 화면이 원인 사슬을 보이려면 전이 함수가 이 둘을 내보내거나 스토어가 규칙 함수를 직접 부르고 결과를 보관해야 한다.
- 캠페인 누적 통계(카드 반응 집계, 생존·전멸 파티 수, 가장 큰 전환점)는 `CampaignState` 확장이 필요하므로 별도 작업으로 남긴다.
- `U1`의 게시판 `riskSummary`와 함께 `I1`에서 화면 데이터 공백을 정리한다.
- 배정표 `U3` 상태 갱신은 작업 마지막에 main 동기화 후 수행한다.
