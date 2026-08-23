# C5 — Guide Promotion Specification

- 작성자: LatteBun
- 작성 도구: Codex

## 1. 목적

C5는 용사 파티가 아닌 **고블린 길잡이(플레이어)의 영구 등급 성장 시스템**을 담당한다.

승급은 전투 능력 증가가 아니라 더 높은 위험도의 던전에 접근할 수 있는 권한 해금이다.

등급:

```
C급 → B급 → A급 → S급
```

S급은 최고 등급이며 추가 성장/특수 계약 해금 없이 캠페인 목표 및 엔딩 평가 기준으로 사용한다.

---

## 2. 등급별 진입 제한

| 길잡이 등급 | 접근 가능 위험도 |
|---|---|
| C | ★1~★2 |
| B | ★1~★3 |
| A | ★1~★4 |
| S | ★1~★5 |

승급 시 다음 위험도 범위의 던전 계약이 게시판에서 등장한다.

C5는 등급과 승급에 필요한 자원만 변경하고 이전 공고를 무효화한다. 새 던전 공고 생성은 C2가 담당한다.

---

## 3. 승급 조건

승급은 두 가지 방법 중 하나를 선택한다.

### 명성 승급

- 요구 명성 충족
- 명성 차감 없음
- 골드 유지

### 골드 승급

- 요구 골드 지불
- 골드 차감
- 명성 유지

비용:

| 승급 | 명성 조건 | 골드 조건 |
|---|---:|---:|
| C→B | 60 | 150G |
| B→A | 120 | 320G |
| A→S | 200 | 600G |

두 조건을 모두 만족할 경우 플레이어가 승급 방식을 선택한다.

---

## 4. 규칙 계약과 상태 전이

### 4.1 공개 타입

```ts
type PromotionMethod = "reputation" | "gold";

interface PromotionResult {
  fromRank: GuideRank;
  toRank: GuideRank;
  method: PromotionMethod;
  reputationBefore: number;
  reputationAfter: number;
  goldBefore: number;
  goldAfter: number;
  newlyUnlockedRiskLevel: RiskLevel;
}

interface PromotionExecution {
  campaign: CampaignState;
  result: PromotionResult;
}

interface PromotionEligibility {
  fromRank: GuideRank;
  toRank: Exclude<GuideRank, "C">;
  newlyUnlockedRiskLevel: RiskLevel;
  reputationRequired: number;
  goldRequired: number;
  currentReputation: number;
  currentGold: number;
  canPromoteByReputation: boolean;
  canPromoteByGold: boolean;
}
```

`newlyUnlockedRiskLevel`은 승급 뒤 새로 진입 가능한 최대 위험도다. UI는 이 값을 사용해 `★3 던전 계약 해금`처럼 결과를 표시하며, 위험도·비용·다음 등급을 독자적으로 계산하지 않는다.

### 4.2 순수 전이 API

```ts
openGuidePromotion(campaign: CampaignState): CampaignState
cancelGuidePromotion(campaign: CampaignState): CampaignState
promoteGuide(campaign: CampaignState, method: PromotionMethod): PromotionExecution
getGuidePromotionEligibility(campaign: CampaignState): PromotionEligibility | null
```

`getGuidePromotionEligibility`는 S급에서만 `null`을 반환한다. U3은 이 반환값으로 등급 버튼의 강조, 선택 화면의 조건·비활성 사유를 표시하며 다음 등급·비용·가능 여부를 다시 계산하지 않는다.

상태 전이는 아래로 고정한다.

| 동작 | 허용 이전 단계 | 이후 단계 | 자원·등급 변화 |
|---|---|---|---|
| `openGuidePromotion` | `board` | `promotion` | 없음 |
| `cancelGuidePromotion` | `promotion` | `board` | 없음 |
| `promoteGuide` | `promotion` | `board` | 정확히 한 단계 승급 |

`promotion` 단계는 **게시판 셸 안에 표시되는 선택 화면**을 뜻한다. 별도 정산 화면이나 별도 라우트를 만들지 않는다. `PromotionResult`를 받은 U3는 결과 오버레이를 표시하고, 닫으면 갱신된 게시판을 계속 표시한다.

C7은 이 순수 전이를 전체 캠페인 전이 디스패처에 조합하고, I1은 같은 전이를 Store에 연결한다. C5는 UI 상태나 라우팅을 직접 소유하지 않는다.

### 4.3 성공·실패와 불변식

- 한 번의 `promoteGuide` 호출은 C→B, B→A, A→S 중 **정확히 한 단계**만 올린다. 등급 건너뛰기와 강등은 없다.
- 명성 방식은 `reputation >= 다음 등급의 요구치`여야 한다. 성공해도 명성·골드·누적 획득 골드는 변하지 않는다.
- 골드 방식은 `gold >= 다음 등급의 요구치`여야 한다. 성공하면 현재 골드만 정확히 요구치만큼 줄고, 명성·누적 획득 골드는 변하지 않는다.
- 모든 조건을 먼저 검증한 뒤 새 `CampaignState`를 반환한다. 실패한 호출은 입력 상태를 부분 변경하지 않는다.
- S급은 승급 화면을 열 수 없고 어떤 방식으로도 다시 승급할 수 없다.
- 다른 캠페인 단계에서 열기·취소·확인을 시도하면 `INVALID_STATE`로 거부한다. S급 또는 명성 방식의 조건 미달은 새 `INVALID_PROMOTION` 오류 코드로 거부한다. 골드 방식의 골드 부족은 기존 `INSUFFICIENT_GOLD`를 사용한다. 오류 상세에는 최소 `rank`, `method`(해당 시), `required`, `actual`을 담는다.
- `promoteGuide` 성공 시 기존 `offers`는 빈 배열로 무효화한다. C2는 반환된 캠페인의 새 `rank`와 기존 `seed`·`worldTurn`으로 게시판을 즉시 다시 생성한다. 승급 자체는 월드턴·던전·파티·엔딩을 바꾸거나 난수를 소비하지 않는다.

---

## 5. 승급 접근 위치

승급은 던전 선택 게시판 화면에서 수행한다.

상단 길잡이 등급 버튼:

```
게시판 화면 상단
        ↓
현재 길잡이 등급 표시
        ↓
승급 가능 여부 확인
        ↓
승급 화면 진입
```

정산 화면은 승급 가능 여부만 결과로 보여주며, 승급 버튼·선택·결과 화면을 제공하지 않는다. 승급의 유일한 진입과 실행 위치는 게시판이다.

---

## 6. 승급 가능 알림

승급 조건을 만족하면 게시판 상단 등급 버튼에 시각 효과를 적용한다.

조건:

```
현재 등급 < S급
그리고
명성 승급 또는 골드 승급 조건 만족
```

표현:

- 버튼 강조
- 빛나는 효과
- 작은 애니메이션

목적:

플레이어가 새로운 성장 기회를 놓치지 않도록 한다.

---

## 7. 승급 화면

승급 버튼 선택 시 전용 화면을 표시한다.

표시 정보:

- 현재 등급
- 다음 등급
- 해금 위험도
- 명성 승급 조건
- 골드 승급 조건
- 현재 보유 자원

예:

```
C급 길잡이

다음 등급
B급 길잡이

해금:
★3 던전 계약 가능

[명성으로 승급]
[골드로 승급]
[취소]
```

C·B·A 등급의 상단 버튼은 조건 미달이어도 다음 목표를 확인할 수 있게 선택 화면을 연다. 각 승급 방식 버튼은 해당 조건을 만족할 때만 활성화하고, 미달이면 현재값·요구값과 비활성 사유를 함께 표시한다. S급은 버튼을 열지 않는다.

`취소`는 `cancelGuidePromotion`만 호출하며 자원·등급·공고를 바꾸지 않는다. 키보드 포커스는 선택 화면 안에 유지하고, `Escape`는 취소와 동일하게 동작한다. 빛나는 효과와 작은 애니메이션은 `prefers-reduced-motion`에서 정지 상태의 비색상 강조로 대체한다.

---

## 8. 승급 완료 연출

승급 완료 시 별도 결과 화면을 제공한다.

표시:

- 이전 등급 → 신규 등급 변화
- 사용한 승급 방식
- 소비한 자원
- 새롭게 열린 위험도

예:

```
승급 완료!

C급 길잡이
      ↓
B급 길잡이

★3 던전 계약이 해금되었습니다.
```

결과 화면은 `PromotionResult`만 소비한다. `goldAfter`와 `goldBefore`가 같으면 `명성으로 승급 · 자원 소비 없음`을, 다르면 실제 골드 차감을 표시한다. 결과 확인 전에도 캠페인 상태는 이미 갱신되어 있으며, 결과를 닫아도 승급을 되돌리지 않는다.

---

## 9. 책임 분리

C4:

- 원정 정산
- 명성/골드 변화

C5:

- 승급 가능 판정
- 게시판↔승급 선택 순수 전이
- 등급 변경
- 승급 비용 처리
- PromotionResult 생성

C2:

- 변경된 길잡이 등급 기준 게시판 생성

C5는 원정 진행, 던전 생성, 엔딩 판정, Store·라우팅·컴포넌트 상태를 담당하지 않는다.

---

## 10. UI 요구사항

필요 화면:

1. 게시판 상단 등급 버튼
2. 승급 가능 알림 효과
3. 승급 선택 화면
4. 승급 완료 결과 화면

배정표에서 C5 규칙과 U3 게시판 승급 UI를 함께 반영한다. 정산 UI(U6)는 승급을 소유하지 않는다.

---

## 11. 검증 기준

- 각 등급의 명성·골드 경계값에서 두 방식을 독립적으로 검증한다. 경계값과 같으면 성공하고, 1 부족하면 실패한다.
- 명성 승급은 자원을 차감하지 않고, 골드 승급은 현재 골드만 정확히 차감하며 `cumulativeGold`를 바꾸지 않는다.
- C→B·B→A·A→S의 한 단계 전환, S급 거부, 잘못된 단계 거부, 취소 무변경을 검증한다.
- 성공·실패 모두 입력 `CampaignState`를 변경하지 않고, 성공 뒤 공고가 무효화되며 C2 재생성이 새 등급의 위험도 제한을 따른다는 것을 검증한다.
- U3은 조건 충족 강조, 조건 미달 사유, 두 방식 선택, 취소, 결과 표시, 결과 뒤 갱신 공고를 렌더링 테스트로 검증한다. 정산 U6에는 승급 진입 제어가 없음을 검증한다.
