# U6 정산 정보 위계 개선 설계

## 문서 정보

- 작성자: LatteBun
- 작성 도구: ChatGPT (GPT-5.6 Pro)
- 작성일: 2026-08-25
- 보완 도구: Codex (GPT-5)
- 보완일: 2026-08-26
- 대상: `U6SettlementScreen`과 정산 ViewModel 경계
- 기준 브랜치: `main`

## 1. 이 설계의 지위

이 문서는 `docs/superpowers/specs/2026-08-22-sbh3821-u6-settlement-ending-design.md`의 **정산 화면 부분만** 보완하고 대체한다. 기존 문서의 엔딩 화면 계약은 그대로 유지한다.

정산 규칙의 보상 수치, 위험도 상승, 유품 회수, 신뢰 0 누적, 엔딩 판정은 바꾸지 않는다. 이번 변경은 이미 계산된 결과를 어떤 구조와 문구로 보여줄지, 그리고 화면이 어떤 구조화된 값을 받아야 하는지를 다시 정한다.

## 2. 배경과 현재 문제

현재 정산 화면은 `마지막 조언 → 파티의 반응 → 피해 → 보상·손실 → 캠페인 변화` 다섯 칸을 항상 만든다. 이 구조에서 다음 문제가 확인됐다.

### 2.1 클리어를 위험도 유지로 설명한다

`settleExpedition`은 클리어한 던전의 상태를 `cleared`로 바꾸지만 위험도 숫자는 바꾸지 않는다. 동시에 `SettlementCauseChain.campaignChange`는 오직 `riskBefore === riskAfter`만 비교해 `던전 위험도 ★N 유지`라는 문장을 만든다.

따라서 실제 상태는 `정복 완료, 게시판에서 제거`인데 원인 사슬은 `위험도 유지`라고 말한다. 오른쪽 패널은 이미 `정복`으로 분기하므로 한 화면 안에 서로 다른 두 설명이 존재한다.

### 2.2 신뢰 0이 일반 신뢰 변화처럼 숨는다

현재 인물 목록은 살아 있는 인물의 신뢰가 전후로 달라졌을 때만 신뢰 줄을 표시한다. 다음 상태는 보이지 않을 수 있다.

- 이번 원정에서 신뢰가 `N → 0`이 된 인물
- 원정 전부터 신뢰 0이어서 `0 → 0`인 인물
- 사망하면서 신뢰가 0이 된 인물

신뢰 0은 단순한 숫자가 아니다. 살아 있는 신뢰 0 인물은 이후 플레이어 원정에 출전할 수 없고, 누적 인원은 조언 수용과 거짓 적발 보정 및 `누적 고발` 엔딩으로 이어진다. 정산 화면은 이 영구 결과를 일반 수치 변화보다 강하게 보여야 한다.

### 2.3 같은 결과를 여러 곳에서 반복한다

왼쪽의 피해, 보상·손실, 캠페인 변화는 오른쪽의 인물 HP, 명성·골드, 던전 결과와 중복된다. 반대로 캐릭터 사망, 신뢰 붕괴, 중상처럼 다음 원정에 남는 결과는 작은 보조 문구에 묻힌다.

고정된 다섯 칸을 채우는 일이 정보 전달보다 앞서면서, 의미가 없는 문장을 만들고 의미가 큰 상태를 약하게 보여주는 구조가 됐다.

## 3. 목표

정산 화면은 다음 네 질문에 순서대로 답한다.

1. **결국 어떻게 끝났는가**
2. **내가 무엇을 골랐고 파티가 어떻게 받아들였는가**
3. **각 인물에게 무엇이 남았는가**
4. **캠페인이 어떻게 바뀌었는가**

완료 기준은 다음과 같다.

- 클리어 결과 어디에도 `던전 위험도 유지`가 나타나지 않는다.
- 클리어는 `던전 정복`과 `게시판에서 제거됨`으로 설명한다.
- 전멸에서만 위험도 전후 또는 ★5 상한을 설명한다.
- 살아 있는 신뢰 0 인물은 변화량이 0이어도 항상 보인다.
- 이번 원정에서 신뢰 0이 된 생존자는 `정체 발각`과 `이후 원정 출전 불가`를 함께 표시한다.
- 살아 있는 신뢰 0 누적 인원과 현재 캠페인 보정을 우측 패널에 표시한다.
- 사망, 중상, 신뢰 0을 일반 HP·신뢰 변화보다 강하게 표시한다.
- 계약 골드와 전멸 유품 골드를 합쳐 숨기지 않고 출처별로 나눈다.
- 보상·피해·캠페인 변화가 좌우에 중복되지 않는다.

## 4. 제외 범위

이번 변경에서는 다음을 하지 않는다.

- 위험도별 보상 수치 변경
- 전멸 명성 손실 공식 변경
- 신뢰 변화량 또는 신뢰 0 누적 보정 변경
- 월드턴 처리와 월드턴 결과 표시 추가
- 승급 조건 또는 승급 진입점 변경
- 엔딩 화면 변경
- 새 이미지 에셋 추가
- 자동 전투 또는 진행 기록 변경

승급 가능 여부는 기존 상단 상태 바가 계속 알린다. 정산 우측 패널에 같은 정보를 다시 만들지 않는다.

## 5. 화면 정보 구조

공용 `GameShell`의 좌 60%, 우 40% 구조와 상단 상태 바는 유지한다.

### 5.1 좌측 본문

좌측은 세 구역으로 구성한다.

```text
[원정 결과 표제]
[마지막 조언] [파티의 판단]
[원정대 결과: 파티원 3명]
```

#### 원정 결과 표제

클리어:

```text
라그나의 산란굴 정복
2명 귀환 · 카일 사망
```

전원 생환 클리어:

```text
라그나의 산란굴 정복
전원 귀환
```

전멸:

```text
원정대 전멸
3명 전원 사망 · 계약 실패
```

`생존 인원 비율만큼 계약 보상을 받는다` 같은 일반 규칙 설명은 제거한다. 이번 원정의 실제 결과만 말한다.

#### 원인 요약

고정 다섯 단계와 번호를 없애고 다음 두 항목만 둔다.

1. `마지막 조언`: `SettlementCauseInputs.choice`
2. `파티의 판단`: `SettlementCauseInputs.reactions`

피해 수치, 보상, 캠페인 변화는 각자의 전용 구역에서 보여준다. `SettlementCauseInputs.damage`는 정산 근거로 보존하지만 별도 카드로 반복하지 않는다.

#### 원정대 결과

기존 우측의 `다녀온 사람`을 좌측으로 옮기고 제목을 `원정대 결과`로 바꾼다. 사망자도 포함되므로 `다녀온 사람`이라는 이름을 사용하지 않는다.

세 인물은 생존 여부와 관계없이 같은 3열 세로형 카드로 표시한다. 각 카드는 위에서부터 직사각형 초상, 이름·직업, HP·신뢰 변화, 중대 상태 순서로 읽힌다. 초상 높이는 기존 공용 파티 상태 카드의 `--party-portrait-height`와 같은 `clamp(5.5rem, 8.6cqw, 11.5rem)` 체감을 기준으로 하되 정산 카드 폭을 전부 사용한다. 이름과 상태 수치는 기존 가로 행보다 크게 표시하고, 사망·중상·정체 발각은 색상과 텍스트 배지를 함께 유지한다.

카드 내부의 남는 세로 공간은 새로운 보상·위험도 문장을 중복해 채우지 않는다. 상태 배지를 카드 하단에 두어 시각적 무게를 분산하고, 생환자가 있는 정산과 전멸 정산이 같은 배치를 사용해 결과를 비교할 수 있게 한다.

인물 행과 결과 표제의 사망자 이름은 `SettlementResult.memberChanges` 순서를 그대로 따른다. `settleExpedition`은 호출자가 넘긴 `finalMembers` 배열 순서에 기대지 않고 `SettlementSnapshot.party.memberIds`의 계약 파티 순서로 `memberChanges`를 만든다. 어댑터는 `CampaignState.pool.order`나 이름으로 다시 정렬하지 않는다. 프리뷰와 테스트 fixture도 같은 계약 파티 순서로 `memberChanges`를 만든다.

### 5.2 우측 패널

우측은 캠페인 전체에 남는 변화만 보여준다.

```text
[던전 결과]
[명성·계약 골드·유품 골드]
[신뢰 0 누적과 현재 보정]
[전멸 시 재도전 보상]
[인주]
[길드로 돌아간다]
```

`길드로 돌아간다` CTA는 현재와 같이 우측 최하단, 내용 폭, 우측 정렬을 유지한다.

## 6. 결과별 표시 규칙

### 6.1 던전 결과

정산 View는 생존자 수로 결과를 추론하지 않고 `SettlementResult.status`를 직접 보존한다.

| 상태 | 표시 |
| --- | --- |
| `cleared` | `이 던전 / 정복 / 게시판에서 제거됨` |
| `wiped`, 위험도 상승 | `던전 위험도 / ★N → ★N+1 / 실패로 위험도가 올랐다` |
| `wiped`, ★5 상한 | `던전 위험도 / ★5 / 최대 위험도라 더 오르지 않는다` |

클리어에서는 위험도 별을 보여주지 않는다. 위험도 숫자가 같다는 사실은 다시 들어갈 수 없는 던전에서 행동 정보를 주지 못한다.

### 6.2 자원 변화

클리어에서는 다음을 보여준다.

- 명성 증감
- 계약 골드 증감

전멸에서는 다음을 보여준다.

- 명성 손실
- `계약 보상 없음`
- 유품 골드 회수량

`goldDelta + relicGold`를 하나의 골드 숫자로 합치지 않는다. 계약 이익과 배신 경로의 유품 수입은 서로 다른 선택의 결과다.

### 6.3 인물 상태

#### 생존자

- HP가 변했으면 `HP 24 → 18 / 32`로 전후를 표시한다.
- HP가 그대로면 `HP 24 / 32`로 현재값만 표시한다.
- 신뢰가 0보다 큰 값 사이에서 변했으면 `신뢰 45 → 41`을 표시한다.
- 신뢰가 0보다 큰 상태에서 0이 되었으면 `신뢰 11 → 0`과 `정체 발각 · 이후 원정 출전 불가`를 표시한다.
- 원정 전부터 신뢰 0이었다면 변화가 없어도 `신뢰 0 · 정체 발각 상태 · 원정 출전 불가`를 표시한다.
- `after.gravelyWounded`가 참이면 `중상`을 표시한다.

#### 사망자

- `사망 · HP 24 → 0`을 가장 먼저 표시한다.
- 신뢰가 변했다면 `마지막 신뢰 8 → 0`처럼 보조 정보로 남긴다.
- 사망자는 살아 있는 신뢰 0 누적에 포함되지 않으므로 `이후 원정 출전 불가`나 캠페인 신뢰 불이익의 원인으로 표시하지 않는다.

### 6.4 신뢰 0 누적

정산 ViewModel은 정산 뒤 `CampaignState`와 `SettlementResult.memberChanges`를 함께 받아 정산 전후의 살아 있는 신뢰 0 인원을 계산한다.

- 정산 뒤 인원: `countLivingZeroTrust(campaignAfterSettlement)` 사용
- 정산 전 인원: 정산 뒤 풀에서 이번 파티원만 `memberChanges.before`로 되돌린 가상 풀을 세어 계산
- 기준 인원: `DENOUNCE_THRESHOLD`
- 현재 보정: `getCampaignTrustModifier(campaignAfterSettlement)` 사용

`campaignAfterSettlement`는 반드시 같은 `settlement`가 적용된 직후 상태다. 이후 원정까지 진행된 캠페인과 과거 정산을 섞어 어댑터에 넘기지 않는다. 실제 `/campaign` 호출부와 `/u6-test` 프리뷰는 `settleExpedition` 또는 같은 `COMPLETE_EXPEDITION` 전이가 함께 반환한 캠페인과 결과를 한 쌍으로 전달한다.

신뢰 0 여부는 숫자 리터럴을 별도 규칙으로 만들지 않고 도메인의 `TRUST_MIN`을 사용한다. 출전 불가 설명은 기존 `canDeploy` 계약과 모순되지 않아야 하며, 누적 인원과 보정 수치는 각각 `countLivingZeroTrust`와 `getCampaignTrustModifier`의 결과를 다시 계산하지 않고 옮긴다.

화면은 둘 중 하나가 0보다 클 때만 누적 구역을 만든다.

| 정산 뒤 누적 | 설명 |
| ---: | --- |
| 0 | 기존 누적이 사망으로 사라졌다면 `살아 있는 신뢰 0 인물이 없어 누적 불이익이 해제됐다` |
| 1 | `신뢰 0 인물은 플레이어 원정에 출전할 수 없다` |
| 2 | `모든 파티원의 조언 수용 -5` |
| 3 | `조언 수용 -10 · 거짓 적발 +5` |
| 4 | `조언 수용 -15 · 거짓 적발 +15` |
| 5 이상 | `누적 고발 기준 5명에 도달했다` |

인원 수가 변하면 `1 → 2 / 5`처럼 전후를 함께 보여준다. 변하지 않으면 `2 / 5`로 현재값만 보여준다.

## 7. 도메인과 ViewModel 경계

### 7.1 정산 결과에서 UI 문장을 제거한다

현재 `SettlementResult`에는 구조화된 결과와 함께 `SettlementCauseChain.economy`, `SettlementCauseChain.campaignChange`라는 완성 문장이 들어 있다. 이 중복이 클리어를 `위험도 유지`라고 설명한 직접 원인이다.

기존 `SettlementCauseInputs`를 정산 근거의 유일한 텍스트 계약으로 사용한다.

```ts
export interface SettlementResult {
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly status: ExpeditionStatus;
  readonly survivorIds: readonly CharacterId[];
  readonly survivorCount: 0 | 1 | 2 | 3;
  readonly memberChanges: readonly SettlementMemberChange[];
  readonly reputationDelta: number;
  readonly goldDelta: number;
  readonly relicGold: number;
  readonly riskBefore: RiskLevel;
  readonly riskAfter: RiskLevel;
  readonly riskCapped: boolean;
  readonly nextReward: Reward | null;
  readonly causeInputs: SettlementCauseInputs;
}
```

`SettlementCauseChain` 타입과 `createCauseChain` 함수는 제거한다. `settleExpedition`은 `snapshot.causeInputs`를 복사해 결과에 보존하며, 경제와 던전 상태 문장은 만들지 않는다.

보상과 위험도 계산은 기존 구조화된 필드가 계속 소유한다.

이 타입 변경은 U6만의 로컬 변경이 아니다. `SettlementResult` 원본을 보관하는 캠페인 통계와 이력 테스트 fixture, 실제 Store 재현성 테스트, 캠페인 렌더 통합 테스트도 같은 계약을 소비한다. 기존 `causeChain.choice/reactions/damage` 검증은 삭제하지 않고 `causeInputs.choice/reactions/damage` 보존 검증으로 이전한다. `SettlementCauseChain`의 도메인 barrel export와 모든 수동 `SettlementResult` fixture도 함께 제거하거나 새 필드로 옮긴다.

### 7.2 U6 View 타입

```ts
export interface U6SettlementOutcome {
  readonly kind: ExpeditionStatus;
  readonly title: string;
  readonly summary: string;
}

export interface U6SettlementCause {
  readonly kind: "choice" | "reactions";
  readonly label: "마지막 조언" | "파티의 판단";
  readonly detail: string;
}

export type U6DungeonOutcome =
  | { readonly kind: "cleared" }
  | { readonly kind: "riskIncreased"; readonly before: RiskLevel; readonly after: RiskLevel }
  | { readonly kind: "riskCapped"; readonly level: RiskLevel };

export interface U6TrustPressureView {
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly threshold: number;
  readonly acceptModifier: number;
  readonly exposeModifier: number;
  readonly reachedThreshold: boolean;
}

export interface U6SettlementMember {
  readonly id: string;
  readonly name: string;
  readonly classLabel: string;
  readonly portraitSrc: string;
  readonly alive: boolean;
  readonly diedThisExpedition: boolean;
  readonly gravelyWounded: boolean;
  readonly hp: { readonly before: number; readonly after: number; readonly max: number };
  readonly trust: {
    readonly before: number;
    readonly after: number;
    readonly changed: boolean;
    readonly isZero: boolean;
    readonly becameZero: boolean;
    readonly countsTowardCampaign: boolean;
  };
}

export interface U6SettlementView {
  readonly dungeonName: string;
  readonly themeId: ThemeId;
  readonly outcome: U6SettlementOutcome;
  readonly causes: readonly U6SettlementCause[];
  readonly members: readonly U6SettlementMember[];
  readonly dungeonOutcome: U6DungeonOutcome;
  readonly reputationDelta: number;
  readonly goldDelta: number;
  readonly relicGold: number;
  readonly nextReward: Reward | null;
  readonly trustPressure: U6TrustPressureView | null;
}
```

`U6SettlementView`는 `riskBefore === riskAfter`를 의미로 해석하지 않는다. `dungeonOutcome`의 구분은 `status`와 `riskCapped`에서 한 번만 만든다.

### 7.3 어댑터 시그니처

```ts
export function createU6SettlementView(
  campaignAfterSettlement: CampaignState,
  settlement: SettlementResult,
  dungeonName: string,
  themeId: ThemeId,
): U6SettlementView;
```

화면 컴포넌트는 `CampaignState`를 직접 읽지 않는다. 캠페인 전체가 필요한 신뢰 누적 계산은 어댑터가 맡는다.

호출자는 `campaignAfterSettlement`와 `settlement`를 같은 정산 실행 또는 전이에서 얻은 쌍으로 넘긴다. 어댑터는 과거 정산을 임의의 최신 캠페인에 적용하는 이력 조회 API가 아니다.

## 8. 데이터 흐름

```text
SettlementSnapshot.causeInputs
        ↓
settleExpedition
        ↓
SettlementResult
  - status
  - memberChanges
  - 자원·위험도 구조화 값
  - causeInputs
        + CampaignState 정산 뒤 상태
        ↓
createU6SettlementView
        ↓
U6SettlementScreen
```

규칙은 수치와 상태를 계산한다. 어댑터는 화면용 분류와 문구를 만든다. 화면은 이미 분류된 View를 배치하고 강조한다.

## 9. 예외와 방어

- 실제 정산은 파티원 3명을 보장한다. 프리뷰와 테스트도 빈 `members`를 정상 화면으로 취급하지 않고 실제 3명 데이터를 사용한다.
- `cleared`인데 사망자가 0명이면 `전원 귀환`을 쓴다.
- `cleared`인데 사망자가 있으면 `memberChanges`의 계약 파티 순서대로 사망자 이름을 나열한다.
- `wiped`는 항상 `3명 전원 사망 · 계약 실패`를 쓴다.
- `riskCapped`가 참인 전멸만 `riskCapped` View로 만든다.
- 신뢰 0 누적 계산은 `TRUST_MIN`인 살아 있는 인물만 센다. 사망자의 `trust === TRUST_MIN`은 인물 행의 마지막 변화로만 남는다.
- 신뢰 보정 문구는 어댑터가 받은 실제 보정값을 출력하며 별도 수치표를 다시 계산하지 않는다.
- 같은 정산 직후 캠페인과 결과를 한 쌍으로 전달한다. 이후 캠페인과 과거 정산을 섞은 입력은 지원하지 않는다.

## 10. 시각·접근성 계약

- 새 에셋을 만들지 않고 기존 조언, 신뢰, 사망, 명성, 골드 아이콘과 인주를 재사용한다.
- 원인 요약 아이콘에는 번호를 겹치지 않는다.
- 사망, 중상, 정체 발각은 색뿐 아니라 텍스트 배지로 표시한다.
- 1920×1080 고정 캔버스에서 스크롤 없이 파티원 세 행과 우측 캠페인 변화를 모두 보여준다.
- `vw`, `vh`, 화면별 미디어 쿼리를 추가하지 않는다.
- `길드로 돌아간다` CTA의 공용 크기와 우측 하단 배치는 유지한다.

## 11. 테스트 전략

### 도메인

- `SettlementResult`가 `causeInputs`를 그대로 보존한다.
- 결과에 `causeChain`, `economy`, `campaignChange`가 남지 않는다.
- 보상, 유품, 위험도 계산의 기존 테스트는 그대로 통과한다.
- 입력 `finalMembers` 순서와 무관하게 `memberChanges`가 `snapshot.party.memberIds` 순서를 따른다.
- `lib/store/campaign-reproducibility.test.ts`의 실제 한 판 검증은 `causeInputs`가 비어 있지 않고 보스전 결과까지 보존하는지 계속 확인한다.
- 캠페인 통계·이력 테스트의 수동 `SettlementResult` fixture와 도메인 barrel export가 새 계약을 사용한다.

### ViewModel

- 클리어는 `dungeonOutcome.kind === "cleared"`다.
- 전멸 위험도 상승과 ★5 상한을 서로 다른 union으로 만든다.
- `SettlementResult.status`를 생존자 수로 재추론하지 않는다.
- 신뢰 `N → 0`, 기존 `0 → 0`, 사망자의 `N → 0`을 서로 다른 플래그로 만든다.
- 정산 전후 살아 있는 신뢰 0 누적과 현재 보정값이 정확하다.
- 사망한 신뢰 0 인물은 누적에서 빠진다.
- `memberChanges`의 계약 파티 순서가 인물 행과 사망자 이름 순서에 그대로 보존된다.
- 같은 정산 실행에서 나온 캠페인과 결과를 전달하는 호출부 계약을 검증한다.

### 화면

- 클리어 화면 전체에 `위험도 유지`가 없다.
- 원정 결과 표제에 정복, 귀환자 수, 사망자 이름이 나타난다.
- 살아 있는 신뢰 0은 변화가 없어도 `정체 발각`과 `원정 출전 불가`가 보인다.
- 사망자는 `사망 · HP 전 → 후`가 보이고 캠페인 신뢰 누적 원인으로 표시되지 않는다.
- 계약 골드와 유품 골드가 별도 항목이다.
- 왼쪽에는 보상과 위험도 변화가 중복되지 않는다.

### 통합

실제 `settleExpedition → createU6SettlementView → U6SettlementScreen` 흐름으로 다음 두 경우를 렌더링한다.

1. 2명 생환, 1명 사망, 생존자 1명이 신뢰 0에 도달한 클리어
2. 3명 전멸, 유품 회수, 위험도 상승

첫 번째 결과에는 `위험도 유지`가 없어야 하고, 두 번째 결과에는 위험도 전후와 유품이 있어야 한다.

기존 `components/game/campaign-render.test.tsx`는 새 어댑터 시그니처로 실제 캠페인 정산을 렌더링하며, 선택과 반응은 표시되고 `causeInputs.damage`는 중복 카드로 표시되지 않는지 확인한다. `components/game/u6-preview-data.test.ts`는 더 이상 제거된 `causeChain`에서 피해 줄을 찾지 않고, 세 프리뷰가 실제 3명 `members`와 결과별 구조화 값을 갖는지 검증한다.

## 12. 공식 문서 영향

구현 시작 시 다음 문서를 먼저 갱신한다.

- `docs/experience/SCREEN_LAYOUT.md`
  - 정산 좌측을 결과 표제, 조언·판단, 원정대 결과로 변경
  - 우측을 던전·자원·신뢰 누적으로 한정
- `docs/experience/ONBOARDING_AND_INTERFACE.md`
  - 정산 표시 순서를 이번 원정 결과 중심으로 개정
- `docs/technical/SCREEN_ADAPTER_CONTRACT.md`
  - U6가 실제 C4/C6/C8을 소비한다는 현재 상태와 새 어댑터 시그니처 기록
- `docs/technical/DEFERRED_WORK.md`
  - `SettlementResult.memberChanges`를 U6가 의도적으로 사용하지 않는다는 유예 항목 제거
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
  - U6가 `memberChanges`를 사용하지 않는다는 현재 상태 설명을 새 정보 위계와 소비 계약으로 교체
- `docs/README.md`
  - 이 설계와 구현 계획 색인

## 13. 완료 조건

- 클리어 결과에 `던전 위험도 유지`가 나타나지 않는다.
- 정산 화면이 `결과 → 선택과 반응 → 인물별 영구 변화 → 캠페인 변화` 순서로 읽힌다.
- 살아 있는 신뢰 0과 누적 불이익을 놓치지 않는다.
- 사망, 중상, 정체 발각이 텍스트로 구분된다.
- 정산 수치 규칙과 엔딩 규칙은 바뀌지 않는다.
- `SettlementCauseChain` 참조가 구현 코드, 도메인 export, 테스트 fixture에 남지 않고 실제 원정 근거 검증은 `causeInputs`로 유지된다.
- 정산 ViewModel 호출부가 같은 정산 직후 캠페인과 결과를 한 쌍으로 전달한다.
- 단위 테스트, 통합 테스트, lint, typecheck, build가 통과한다.
- `/u6-test` 세 정산 상태와 실제 `/campaign` 정산을 1920×1080 고정 캔버스에서 확인한다.
