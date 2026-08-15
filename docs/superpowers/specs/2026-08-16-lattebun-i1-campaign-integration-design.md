# I1 캠페인 전체 통합 설계

> 상태: 사용자 검토 요청
> 작성일: 2026-08-16
> 작성자: LatteBun
> 작성 도구: Claude Code (Opus 5)

## 목적

던전 15개 캠페인 개편의 통합 작업 `I1`을 구현한다. `C4`가 만든 전이 함수 위에 Zustand 스토어를 올리고, `U1`·`U2`·`U3`가 만든 화면을 하나의 흐름으로 연결해 게시판부터 엔딩까지 실제로 플레이할 수 있게 한다. 함께, 더 이상 쓰지 않는 구 단일 런 코드를 지운다.

지금까지 화면 트랙은 프리뷰 하네스(`/u1-test`·`/u2-test`·`/u3-test`)로 각자 검증해 왔다. `I1`은 그 화면들을 실제 상태 위에 올리는 첫 작업이다.

## 근거와 기준 문서

- 배정표: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`의 `I1` 행(완료 기준 = 게시판→탐험→정산→다음 공고/엔딩 흐름이 시드로 재현되고 전체 검증 통과)
- 상위 spec: `docs/superpowers/specs/2026-08-13-sanghwan-yoo-game-direction-rework-design.md`의 "상태 전이와 화면"
- 화면 spec: `2026-08-14-lattebun-u1-campaign-board-hud-design.md`, `2026-08-15-lattebun-u2-map-info-event-design.md`, `2026-08-15-lattebun-u3-settlement-ending-design.md`
- 규칙 계약: `lib/flow/campaign-machine.ts`(`transitionCampaign`·`CampaignAction`), `lib/rules/*`
- 최상위 기준: `docs/GAME_PRINCIPLES.md`

## 범위

### 포함

- 캠페인 Zustand 스토어와 provider
- `transitionCampaign`이 버리던 결과(`BossResolution`·`SettlementStep[]`)를 밖으로 내보내는 계약 확장
- `/play` 라우트를 캠페인 흐름으로 교체하고 `U1`·`U2`·`U3` 컴포넌트를 배선
- 단계가 화면을 결정하는 라우팅 가드를 캠페인 단계로 이행
- 구 단일 런 코드 삭제
- 시드 재현: 같은 `?seed=`가 같은 화면과 같은 선택지를 만든다
- `PartyStatusSidebar`가 사망한 파티원을 구분해 표시하도록 보완. `U2`의 `MemberStatusView`에 `alive`가 없어 죽은 사람이 산 사람과 같게 보인다. 하네스에서는 아무도 죽지 않아 드러나지 않았지만 실제 흐름에서는 사망이 발생하므로 통합과 함께 고친다

### 제외

- 새 규칙·새 화면. `I1`은 이미 있는 것을 연결하고 지우는 작업이다
- 접근성 전면 점검과 브라우저 흐름 회귀 (`Q1`)
- 데모 배포 (`Q2`)
- 캠페인 누적 통계 등 `U3`가 데이터 부족으로 제외한 항목. `CampaignState` 확장이 필요하므로 별도 작업으로 남긴다
- 프리뷰 하네스(`/u1-test`·`/u2-test`·`/u3-test`) 삭제. 화면별 격리 확인 수단이고 `Q1`에서도 쓰므로 남긴다

## 전이 함수 계약 확장

`transitionCampaign`은 `CampaignState`만 돌려주므로 화면이 원인 사슬을 그릴 수 없다. `U3` 설계에서 확인한 문제다.

| 행동 | 규칙이 만드는 것 | 전이 함수가 남기는 것 | 잃는 것 |
| --- | --- | --- | --- |
| `resolveBoss` | `BossResolution` | `bossResult`(생존·사망·피해만) | 피해 보정, 사후 검증 원인 |
| `applySettlement` | `{ state, steps }` | `state`만 | 6단계 원인 사슬 |

호출부가 20곳(백테스트 6, `campaign-machine.test.ts` 헬퍼, `u3-test` 하네스 12)이므로 반환 타입을 바꾸면 전부 깨진다. 그래서 **결과를 돌려주는 함수를 진실로 두고 기존 이름을 그 위의 얇은 래퍼로 남긴다.**

```ts
export interface CampaignTransition {
  readonly state: CampaignState;
  /** resolveBoss일 때만 있다. */
  readonly bossResolution?: BossResolution;
  /** applySettlement일 때만 있다. */
  readonly settlementSteps?: SettlementStep[];
}

export function transitionCampaignDetailed(
  state: CampaignState,
  action: CampaignAction,
  context: CampaignMachineContext,
): CampaignTransition;

/** 결과가 필요 없는 호출부를 위한 편의 함수다. */
export function transitionCampaign(
  state: CampaignState,
  action: CampaignAction,
  context: CampaignMachineContext,
): CampaignState;
```

`transitionCampaign`은 `transitionCampaignDetailed(...).state`를 돌려준다. 구현이 둘로 갈라지지 않으므로 규칙의 진실은 하나다. 기존 호출부와 `C4` 테스트는 수정하지 않으며, 그 테스트가 그대로 통과하는 것이 이 변경의 회귀 검사다.

`C4`는 `sbh3821`의 작업이므로 PR 본문에 이 변경을 명시한다.

## 스토어

```ts
interface CampaignStoreState {
  campaign: CampaignState;
  lastBossResolution: BossResolution | null;
  lastSettlementSteps: SettlementStep[] | null;
  /** 보스전 직전 출전 파티 스냅샷. */
  membersBeforeBoss: CampaignMember[] | null;
}

interface CampaignStoreActions {
  dispatch(action: CampaignAction): void;
  startCampaign(seed: string): void;
  resetCampaign(): void;
}
```

기존 `run-store`가 쓰던 구조를 따른다. `createStore`(zustand/vanilla)로 스토어를 만들고 React context로 공급하며 `useStore(store, selector)`로 읽는다.

### 세 가지 타이밍 규칙

1. **보스전 스냅샷은 전이 전에 찍는다.** `dispatch`가 `resolveBoss`를 받으면 전이를 부르기 전에 현재 출전 파티를 복사해 `membersBeforeBoss`에 넣는다. 전이 후에는 HP가 이미 깎여 있어 `U3`의 `toBossResultView`가 요구하는 전투 전 HP를 복원할 수 없다.
2. **새 탐험을 시작할 때 결과를 비운다.** `acceptContract`를 처리하면 `lastBossResolution`·`lastSettlementSteps`·`membersBeforeBoss`를 모두 `null`로 되돌린다. 지난 탐험의 결과가 새 화면에 남으면 화면이 거짓말을 한다.
3. **결과는 전이가 준 것만 보관한다.** `transitionCampaignDetailed`가 돌려준 `bossResolution`·`settlementSteps`가 있을 때만 갱신하고, 없으면 기존 값을 유지한다.

### 오류

`RuleError`를 삼키지 않는다. 기존 `useRunTransition`이 세운 원칙을 그대로 따른다 — 화면은 유효한 행동만 제시하므로 여기서 던져진 오류는 화면 버그이며, 감추면 잘못된 화면이 조용히 살아남는다.

## 라우트와 화면 배선

단계가 화면을 결정하는 기존 구조(`phase-route.ts`의 `ROUTE_BY_PHASE` + `usePhaseGuard`)를 캠페인 단계로 이행한다. URL을 직접 입력해 단계를 건너뛰는 우회가 라우팅 수준에서 막히는 성질을 그대로 유지한다.

```ts
export const ROUTE_BY_PHASE: Record<CampaignPhase, string> = {
  board: "/play",
  contract: "/play",
  map: "/play/map",
  infoOpportunity: "/play/encounter",
  event: "/play/encounter",
  boss: "/play/result",
  settlement: "/play/result",
  ended: "/play/result",
};
```

| 라우트 | 단계 | 렌더 |
| --- | --- | --- |
| `/play` | `board` · `contract` | `Board` + `ContractPanel` (U1) |
| `/play/map` | `map` | `DungeonMapView` (U2) |
| `/play/encounter` | `infoOpportunity` · `event` | `InfoOpportunityPanel` + `PartyReactionSidebar` / `EventActions` (U2) |
| `/play/result` | `boss` · `settlement` · `ended` | `BossResultPanel` → `SettlementTimeline` → `EndingPanel` (U3) |

`board`와 `contract`가 같은 라우트인 이유는 계약 확인이 게시판에서 공고를 고른 뒤의 같은 화면 안 단계이기 때문이다(`U1` 설계). `boss`·`settlement`·`ended`가 같은 라우트인 이유는 정산 화면이 보스 결과부터 엔딩까지 하나의 원인 사슬을 이어 보여주기 때문이다(`U3` 설계).

### 셸

`app/play/play-chrome.tsx`의 구 `ResourceBar`·`PartySidebar`를 `U1`의 `CampaignHeader`와 `U2`의 `PartyStatusSidebar`로 교체한다. 헤더는 영구 등급·현재 명성·현재/누적 골드·승급 점수·남은 던전을 모든 단계에서 유지한다.

### Provider와 시드

`PlayRunProvider`를 `PlayCampaignProvider`로 바꾼다. 시드 처리는 기존 코드의 방식을 그대로 옮긴다 — URL의 `?seed=`로 재현하고 없으면 `createSeed()`, 무작위 시드는 서버가 미리 알 수 없으므로 마운트 후 초기화해 hydration 불일치를 피한다. 준비 전에는 짧은 안내만 보인다.

## 구 단일 런 코드 정리

`2026-08-13` 개편 plan의 Task 10이 요구했으나 아직 남아 있는 정리다.

**삭제**

- `lib/stores/run-store.ts`, `run-store.test.ts`, `game-store-provider.tsx`
- `lib/flow/run-machine.ts`, `initial-run.ts`, `path.ts`와 각 테스트
- `app/state-preview/` 전체
- `components/game/`에서 캠페인 화면이 쓰지 않는 구 컴포넌트

**살린다**

`lib/domain/run.ts`의 `TrustChange`는 현역 규칙(`lib/rules/boss.ts`·`event.ts`·`trust.ts`·`trust-history.ts`)이 쓴다. `lib/domain/party.ts`로 옮기고 `lib/domain/index.ts`의 재export를 맞춘 뒤 `run.ts`의 나머지(`RunState`·`Resources`·`RunPhase`·`RUN_PHASES`·`DecisionRecord`)를 지운다. `components/game/labels.ts`의 `PHASE_LABELS`도 `RunPhase`에 묶여 있으므로 함께 정리한다.

**삭제 판단 기준**: 지우기 전에 `rg`로 참조를 확인하고, 지운 뒤 다시 확인해 제품 경로에 잔여 참조가 없음을 보인다. 확인 결과를 PR 본문에 적는다.

## 테스트

### 단위 테스트

`lib/stores/campaign-store.test.ts`:
- `resolveBoss` dispatch 전에 `membersBeforeBoss`가 전투 전 HP를 담는다
- `acceptContract` dispatch 후 세 결과 필드가 모두 `null`이다
- `resolveBoss`·`applySettlement` dispatch 후 각각 `lastBossResolution`·`lastSettlementSteps`가 채워진다
- `startCampaign(seed)`가 그 시드의 캠페인을 만든다

`lib/flow/campaign-machine.test.ts`(추가):
- `transitionCampaignDetailed`가 `resolveBoss`에서 `bossResolution`을, `applySettlement`에서 `settlementSteps`를 함께 돌려준다
- 그 외 행동에서는 두 필드가 없다
- **기존 369줄 테스트가 수정 없이 통과한다** — 래퍼가 계약을 지켰다는 회귀 검사다

### 통합·시각 검증

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 통과
- 브라우저로 `/play`에서 **게시판 → 계약 → 지도 → 정보 → 사건 → 보스 → 정산 → 다음 게시판** 한 바퀴를 돈다
- 같은 `?seed=`로 두 번 열어 같은 게시판과 같은 첫 지도가 나오는지 확인한다
- URL로 단계를 건너뛰려 할 때(`/play/result`를 `board` 단계에서 열기) 현재 단계 화면으로 되돌아가는지 확인한다

### 검사 발동 확인

스토어의 보스 스냅샷 타이밍을 일부러 전이 **후**로 옮겨 테스트가 실패하는지 확인하고 되돌린다. 이 순서가 깨지면 화면의 HP 변화가 조용히 틀리므로 검사가 실제로 잡는지 보아야 한다.

## 완료 기준

- `/play`에서 게시판부터 엔딩까지 새로고침 없이 진행된다.
- 보스 결과와 정산 원인 사슬이 라이브 화면에 나온다(전이 함수가 결과를 내보낸다).
- 같은 `?seed=`가 같은 화면을 만든다.
- 단계에 맞지 않는 URL은 현재 단계 화면으로 돌아간다.
- 구 단일 런 코드가 제품 경로에 남지 않고, `TrustChange`는 현역 위치에서 계속 동작한다.
- `C4`의 기존 테스트가 수정 없이 통과한다.
- 네 검증 명령이 모두 통과한다.

## 후속 연결

- `Q1`이 접근성(키보드 조작, 색 외 단서, 변화 사유)과 브라우저 흐름 회귀를 전면 점검한다. `U2`에서 발견한 함정(SVG `role="button"`의 키보드 접근성을 lint가 못 잡음)을 `Q1`이 다시 확인해야 한다.
- `U1`의 게시판 `riskSummary`(공고별 위험)는 `E1` 지도가 있으므로 이제 채울 수 있다. `I1` 범위 밖이지만 후속 후보다.
- 캠페인 누적 통계는 `CampaignState` 확장이 필요해 계속 미뤄져 있다.
