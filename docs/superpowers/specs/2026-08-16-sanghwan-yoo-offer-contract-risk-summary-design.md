# 공고·계약 위험 요약 설계

- 작성일: 2026-08-16
- 작성자: sanghwan-yoo
- 작성 도구: Claude Code (Opus 5)
- 대상 action ID: `C5`
- 분기 기준: `main` = `3805a3e`

## 1. 배경

게시판은 최대 5개 공고를 나란히 놓고 고르게 하는 화면이다. 지금 그 카드가
보여주는 것은 필요 명성, 보상, 지점 수, 파티 상태뿐이다. **던전이 어떤 성격의
위험을 담고 있는지는 계약을 수락한 뒤 지도 화면에서야 처음 드러난다.**

이는 상위 원칙과 어긋난다. [게임 원칙](../../GAME_PRINCIPLES.md) 6번은 "중요한
선택의 이득과 위험을 이해시킨다"이며,
[던전 이벤트와 보스 시스템](../../systems/DUNGEON_EVENTS_AND_BOSSES.md)의 「공개
정보」는 길잡이가 던전을 미리 답사했으므로 **각 지점의 사건 분류와 대략적인
위험 성격을 입장 전에 안다**고 규정한다.
[핵심 게임 루프](../../design/CORE_GAME_LOOP.md)도 "계약 전에 (…) 전체 경로와
위험 성격 (…)을 확인한다"고 적는다.

즉 공개해야 할 정보가 이미 규정돼 있는데 화면이 그 시점에 전달하지 않는다.
`U1`이 게시판을 만들 때 지도 규칙(`E1`)이 아직 붙지 않아 미뤘고, 그 자리가
[campaign-view-model.ts:47](../../../components/game/campaign-view-model.ts)에
주석으로 남아 있다.

```ts
// riskSummary?: ... — E1 지도 통합 때 추가한다. U1에서는 없음.
```

`U4`는 이 항목을 "데이터 없음"으로 판단해 다시 미뤘다. `E1`·`I1`이 끝난 지금은
데이터가 있다.

## 2. 목표와 비목표

### 목표

- 게시판의 공고마다 사건 분류별 위험 요약을 보여준다.
- 계약 확인에서 분류별 개수를 보여준다.
- 게시판이 미리 보여준 위험이 계약 후 실제 탐험 지도와 **일치함**을 보장한다.

### 비목표

- 갈래별 분리 집계. 지도 전체 기준 한 벌만 낸다(3-1).
- 보스의 정체·이름·능력 공개. "보스전이 있다"까지만 알린다(3-3).
- 파티 상태 대비 상대 위험("이 파티에게 위험하다") 산출.
- 게임 규칙의 수치·확률·판정 변경. 이번 작업은 **이미 정해진 결과를 앞당겨
  보여주는 것**이며 새로운 무작위를 만들지 않는다.
- 백테스트 수치 변경. `docs/technical/BACKTEST_REPORT.md`가 그대로여야 한다.

## 3. 확정한 결정

### 3-1. 집계 단위는 지도 전체 한 벌

지도는 입구에서 두 갈래로 갈라져 합류한다. **두 갈래의 분류 구성은 서로 다를 수
있다.** 입구·합류 지점과 필수 분류만 보장되고, 남는 칸은 갈래마다 따로
뽑히기 때문이다([map.ts:127-133](../../../lib/rules/map.ts)).

그럼에도 게시판에서는 **지도 전체 기준 한 벌**만 낸다.

- 계약 단계의 질문은 "이 던전이 대체로 어떤 성격인가"이지 "어느 갈래로 갈까"가
  아니다. 갈래 선택은 지도 화면(`U2`)에서 지점마다 분류와 위험이 이미 보이는
  상태로 하는 결정이다.
- 게시판이 갈래별 표를 들면 지도 화면의 역할을 앞당겨 빼앗고, 카드 5장을
  나란히 비교하는 자리가 표 10줄이 된다.

**대신 오해를 막는 문구를 함께 적는다.** 전체 기준 개수는 실제로 통과하는 지점
수보다 많다. C급이면 보스방을 뺀 6곳을 세지만 한 경로에서 만나는 것은 4곳이다.
계약 확인에 `전체 지도 기준 · 한 갈래만 지난다`를 명시한다.

### 3-2. 게시판 카드는 기호와 개수 한 줄

카드에 다음 한 줄을 더한다.

```
◆몬스터 2 · ○휴식 2 · ◇상인 1 · ★특수 사건 1 · 보스전 1
```

- 기호는 지도 범례와 같은
  [`EVENT_KIND_MARKS`](../../../components/game/labels.ts)를 쓴다. 게시판에서
  본 기호가 지도에서 같은 뜻이어야 학습이 이어진다.
- **기호 옆에 분류명을 함께 적는다.** 기호만으로는 스크린리더가 읽지 못하고
  색·기호 외 단서를 요구하는 `Q1` 접근성 기준에 걸린다.
- 대표 문장 한 줄(`위험: 전투 위험 높음`)은 쓰지 않는다. 같은 등급 공고가 여러
  개일 때 문장이 겹쳐 비교가 되지 않는다.

**보스전에는 기호를 붙이지 않는다.** `EVENT_KIND_MARKS.special`과 보스의
`categoryMark`가 둘 다 `★`라서 같은 기호가 두 뜻을 갖는다. `U4`가 지도에서 이
충돌을 도형(별 vs 원)으로 풀었지만 텍스트 한 줄에는 도형을 쓸 수 없다. 글자
`보스전`으로 적어 충돌을 피한다.

### 3-3. 보스의 정체는 공개하지 않는다

지도는 보스방 **위치**를 공개하지만 보스가 누구인지는 공개하지 않는다. `E2`가
등급별로 1/1/2/2회의 보스 관련 정보 카드를 보장하는데, 계약 단계에서 보스를
미리 알려주면 그 카드들의 가치가 사라진다. 요약은 `보스전 1`까지만 적는다.

## 4. 왜 규칙이 아니라 화면 파생인가

위험 요약을 `BoardOffer`에 넣어 `generateBoard`가 계산하게 하는 방법을 먼저
검토했고, **버렸다.**

`generateBoard`는 다섯 곳에서 불린다.

| 호출부 | 시점 |
| --- | --- |
| [campaign-init.ts:135](../../../lib/rules/campaign-init.ts) | 캠페인 시작 |
| [settlement.ts:223](../../../lib/rules/settlement.ts) | 탐험 정산마다 |
| [campaign-simulator.ts:252](../../../lib/backtest/campaign-simulator.ts) | 백테스트 시작 |
| `campaign-machine`의 `openBoard` | 게시판 진입 |
| [board.ts:104](../../../lib/rules/board.ts)의 `createBoardEnding` | 엔딩 판정마다 |

백테스트는 시드 10,000개를 돌고 한 캠페인은 던전 15개를 지난다. 여기에 공고당
지도 생성을 얹으면 **약 75만 번의 지도 생성과 전체 검증**이 시뮬레이터에
붙는다(`createBoardEnding`까지 세면 더 는다). 지금 93초인 백테스트가 몇 배로
늘고, 게임 결과는 한 글자도 바뀌지 않는다. 시뮬레이터는 위험 요약을 읽지 않기
때문이다.

따라서 **위험 요약은 사람이 게시판을 보는 순간에만 계산하는 화면 파생값**으로
둔다. 도메인 `BoardOffer`와 `CampaignState`는 그대로다.

이 판단은 `U4`가 `lastTrustDeltas`에서 쓴 것과 같은 형태다. 규칙이 돌려주지 않는
표시용 값을 도메인에 밀어 넣지 않고, 화면 쪽이 필요할 때 파생시킨다.

## 5. 설계

### 5-1. 지도 시드 키를 단일 출처로 옮긴다

게시판 미리보기가 탐험과 같은 지도를 내려면 같은 시드 키를 써야 한다. 키는
지금 `lib/flow/campaign-machine.ts`에 비공개로 있다.

```ts
function expeditionKey(state: CampaignState, dungeon: CampaignDungeon): string {
  return `${state.seed}/${dungeon.id}#${dungeon.failureCount}`;
}
```

**이 키는 캠페인 시드·던전 id·실패 횟수에만 의존한다.** 공고나 파티가 들어가지
않으므로, 계약 전에 만든 지도와 계약 후 만든 지도는 같을 수밖에 없다. `C5`의
완료 기준인 "지도 생성 시드가 탐험과 일치"는 새 장치를 만들 필요 없이 이 성질을
쓰면 된다.

이 함수를 `lib/rules/expedition-key.ts`로 옮겨 export하고 `campaign-machine`이
import한다. **순수 이동이며 동작은 바뀌지 않는다.**

복사하지 않고 옮기는 이유: 두 벌이 되면 나중에 키가 바뀔 때 한쪽만 고쳐도
컴파일이 통과하고, 게시판이 보여준 위험과 실제 지도가 조용히 어긋난다. 한 벌을
공유하면 그 어긋남이 구조적으로 불가능하다.

### 5-2. 위험 요약 규칙 — `lib/rules/offer-risk.ts` (신설)

```ts
export interface OfferRiskSummary {
  /** 보스방을 뺀 전체 지점의 분류별 개수. 합은 nodeCount - 1이다. */
  readonly counts: Readonly<Record<EventKind, number>>;
  /** 보스방 수. 지도마다 항상 1이다. */
  readonly bossCount: number;
}

export function summarizeOfferRisk(
  state: CampaignState,
  offer: BoardOffer,
  pools: DungeonEventPools,
): OfferRiskSummary;
```

동작:

1. `offer.dungeonId`로 던전을 찾는다.
2. `generateGradeMap(dungeon.grade, createRng(expeditionKey(state, dungeon)).derive("map"), { eventPools: pools })`로 지도를 만든다.
3. `pools`에서 사건 id → 분류 조회표를 만들어 지점마다 분류를 읽어 센다.
4. 보스방은 `counts`에서 빼고 `bossCount`로 분리한다.

**세 번째 인자로 `CampaignMachineContext`를 받지 않는다.** 그 타입은
`lib/flow`에 있고, `lib/rules`는 지금 `lib/flow`를 한 곳도 import하지 않는다.
규칙이 상태 머신을 알게 되면 의존 방향이 뒤집힌다. 대신 `lib/content`의
`DungeonEventPools`만 받는다.

그래서 `context.eventKindById`(백테스트용 조회표)를 쓰지 못하고 조회표를 매번
만든다. `validateGeneratedMap`이 이미 같은 방식을 쓰고
([map.ts:328-331](../../../lib/rules/map.ts)) 이 경로는 사람이 게시판을 볼 때만
도므로 비용이 문제되지 않는다.

`RuleError`를 잡지 않고 그대로 올린다. 지도를 만들 수 없는 공고는 계약해도 만들
수 없으므로, 게시판에서 조용히 숨기면 원인을 더 늦게 발견하게 된다.

### 5-3. 화면 배선

view-model 두 함수가 요약을 인자로 받는다. 규칙 함수를 view-model 안에서
직접 부르지 않는다 — 렌더마다 지도 5개를 다시 만들게 된다.

```ts
export function toBoardView(
  state: CampaignState,
  riskByOfferId: ReadonlyMap<string, OfferRiskSummary>,
): BoardOfferView[];

export function toContractView(
  state: CampaignState,
  offerId: BoardOfferId,
  risk: OfferRiskSummary | null,
): ContractView | null;
```

[app/play/page.tsx](../../../app/play/page.tsx)가 `useMemo`로 `campaign.board`가
바뀔 때만 계산하고 `CAMPAIGN_CONTEXT.events`를 넘긴다. `CAMPAIGN_CONTEXT`는 같은
디렉터리의 `play-campaign-provider.tsx`가 이미 export하고 있고, 지도·사건
페이지가 같은 방식으로 가져다 쓴다.

`app/u1-test/page.tsx` 하네스는 바뀐 시그니처를 따라간다.

### 5-4. 표시 형식

**게시판 카드** — 파티 줄 아래 한 줄을 더한다.

```
01 C급 1번                              ✓ 지원 가능
필요 명성 0   보상 명성 3 + 120G   지점 7
파티: 4팀 · 생존 3 · 평균 신뢰 50
◆몬스터 2 · ○휴식 2 · ◇상인 1 · ★특수 사건 1 · 보스전 1
```

**네 분류를 항상 같은 순서로 전부 적는다.** 지도 검증이 모든 경로에 네 분류가
각각 최소 한 번 나오도록 강제하므로([map.ts:407-411](../../../lib/rules/map.ts))
전체 지도 기준 개수는 어떤 분류도 0이 될 수 없다. 자리가 고정되면 공고를 바꿔
볼 때 눈이 같은 자리의 숫자만 비교한다.

**계약 확인** — 기존 `지도: 전체 N지점 · 두 갈래 · 보스방 공개` 줄 아래에 표를
놓는다.

```
사건 분류 (전체 지도 기준 · 한 갈래만 지난다)
  ◆ 몬스터      2곳
  ○ 휴식        2곳
  ◇ 상인        1곳
  ★ 특수 사건   1곳
  ── 보스전     1곳
```

## 6. 불변식과 테스트

규칙 테스트(`lib/rules/offer-risk.test.ts`):

| 불변식 | 확인 방법 |
| --- | --- |
| 게시판 미리보기 지도 = 탐험 지도 | `summarizeOfferRisk`가 쓴 지도와 `acceptContract` 후 `state.expedition.map`이 깊은 값으로 같다 |
| 개수 합 + 보스 = 지점 수 | `sum(counts) + bossCount === offer.nodeCount` |
| 네 분류가 모두 나온다 | 모든 경로가 네 분류를 지나므로 전체 지도에서도 각 분류 ≥ 1 |
| 실패 횟수가 요약을 바꾼다 | `failureCount`를 올리면 시드 키가 달라져 요약이 달라진다 |
| 같은 입력 = 같은 요약 | 두 번 불러 같은 값 |

첫 줄이 `C5`의 완료 기준을 직접 검사하는 항목이다.

view-model 테스트는 요약이 카드 문자열로 옮겨지는 부분만 본다. Vitest가
`environment: node`이고 `@testing-library`가 없으므로 컴포넌트는
typecheck·lint·build와 브라우저로 게이트한다.

## 7. 검증 게이트

`lib/flow/campaign-machine.ts`를 건드리므로(5-1의 이동) 다음을 필수로 둔다.

```bash
pnpm backtest
git diff --stat docs/technical/BACKTEST_REPORT.md   # 출력이 없어야 한다
```

보고서가 달라지면 순수 이동이 아니었다는 뜻이므로 멈추고 원인을 찾는다.

여기에 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`와, 게시판에서
공고를 고르고 계약해 들어간 지도가 카드에 적힌 개수와 맞는지 브라우저로 대조하는
절차를 더한다.

## 8. 영향 범위

| 파일 | 변경 |
| --- | --- |
| `lib/rules/expedition-key.ts` | 신설 (campaign-machine에서 이동) |
| `lib/flow/campaign-machine.ts` | 지역 함수를 import로 교체 |
| `lib/rules/offer-risk.ts` | 신설 |
| `lib/rules/offer-risk.test.ts` | 신설 |
| `components/game/campaign-view-model.ts` | 두 함수 시그니처, `BoardOfferView`·`ContractView` 확장 |
| `components/game/Board.tsx` | 위험 한 줄 |
| `components/game/ContractPanel.tsx` | 분류별 개수 표 |
| `app/play/page.tsx` | `useMemo` 계산과 전달 |
| `app/u1-test/page.tsx` | 바뀐 시그니처 추종 |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | `C5` 완료 표시 |

**트랙 소유권:** `lib/rules`·`lib/flow`는 규칙 트랙(sbh3821) 영역이다. 이번에
그중 `campaign-machine.ts`를 건드리지만 함수 한 개를 파일 밖으로 옮기는
것뿐이고, 백테스트 보고서 무변경이 그것을 증명한다. 새 규칙 모듈
`offer-risk.ts`는 기존 규칙을 읽기만 하고 아무것도 바꾸지 않는다.

## 9. 후속 작업

- 갈래별 분류 개수. 지도 화면이 이미 지점마다 분류를 보여주므로 당장 필요는
  낮다. 갈래 선택이 어렵다는 신호가 나오면 다시 본다.
- 공고 정렬·필터를 위험 기준으로 거는 것. `B1` 밸런스 조정이 끝나 위험의 의미가
  안정된 뒤가 맞다.
- `C6` 캠페인 누적 통계는 별개 작업이다.
