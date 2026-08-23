# C7 캠페인 상태 전이 설계

- 작성일: 2026-08-23
- 영역: Campaign Rework

## 1. Overview

C7은 Campaign Rework의 상태 전이 계층이다.

C6가 캠페인 엔딩 결과(`CampaignEnding`)를 생성한다면 C7은 해당 결과를 CampaignState에 적용하고 캠페인의 현재 상태를 안전하게 변경한다.

핵심 원칙:

> 캠페인의 phase 변경은 C7 Transition Layer를 통해서만 수행한다.

---

## 2. Goals

C7은 다음 책임을 가진다.

- Campaign phase 전이 관리
- 전이 가능 상태 검증
- 엔딩 결과 적용
- ended 상태 보존
- 다음 진행 단계 결정

---

## 3. Non Goals

C7은 아래 책임을 가지지 않는다.

- 엔딩 조건 계산 (C6)
- 신뢰 계산 (C6/E2)
- 보상 정산 (C4)
- 월드턴 처리 (C3)
- UI 표시 (U6)
- 저장 처리 (I1)
- 통계 계산 (C8)

---

## 4. Campaign Phase

```ts
 type CampaignPhase =
  | "board"
  | "expedition"
  | "settlement"
  | "worldTurn"
  | "ended";
```

정상 흐름:

```
board
 ↓
expedition
 ↓
settlement
 ↓
worldTurn
 ↓
board
```

종료 흐름:

```
active phase
 ↓
ended
```

---

## 5. Transition Ownership

각 시스템에서 직접 phase를 변경하지 않는다.

금지:

```ts
campaign.phase = "worldTurn";
```

허용:

```ts
transitionCampaign(campaign, transition)
```

C7 Transition Layer가 유일한 변경 지점이다.

---

## 6. Transition Contract

```ts
type CampaignTransition =
  | "START_EXPEDITION"
  | "EXPEDITION_COMPLETE"
  | "SETTLEMENT_COMPLETE"
  | "WORLD_TURN_COMPLETE"
  | "APPLY_ENDING";

interface TransitionResult {
  campaign: CampaignState;
  changed: boolean;
  reason?: string;
}
```

---

## 7. Transition Rules

### START_EXPEDITION

허용:

```
board → expedition
```

---

### EXPEDITION_COMPLETE

허용:

```
expedition → settlement
```

---

### SETTLEMENT_COMPLETE

허용:

```
settlement → worldTurn
```

---

### WORLD_TURN_COMPLETE

허용:

```
worldTurn → board
```

단, 종료 조건이 존재하면 ended 전환이 우선된다.

---

### APPLY_ENDING

C6에서 생성한 CampaignEnding을 적용한다.

결과:

```ts
campaign.phase = "ended";
campaign.ending = ending;
```

---

## 8. C6 Integration

C6 책임:

```
CampaignState
 ↓
CampaignEnding 생성
```

C7 책임:

```
CampaignEnding
 ↓
CampaignState.phase = ended
```

C7은 엔딩 조건을 재계산하지 않는다.

---

## 9. Ended State Rules

ended는 삭제 상태가 아니라 최종 기록 상태다.

유지:

- 캐릭터 상태
- Campaign History
- 마지막 원정 정보
- Ending Result
- Guide Rank
- 통계 데이터

---

ended 이후 게임 진행 전이는 허용하지 않는다.

금지:

```
ended → board
ended → expedition
```

가능:

```
ended → 결과 조회
ended → 기록 조회
```

---

## 10. Data Persistence Boundary

C7은 상태 변경만 담당한다.

담당하지 않음:

- Supabase 저장
- Zustand persist
- 서버 동기화

---

## 11. Test Cases

### 정상 루프

```
board
→ expedition
→ settlement
→ worldTurn
→ board
```

### 엔딩 적용

```
worldTurn
→ APPLY_ENDING
→ ended
```

### 종료 후 재진입 차단

```
ended
→ START_EXPEDITION
```

결과:

```
changed=false
```

### C6 결과 보존

입력:

```
CampaignEnding(kind="distrust")
```

결과:

```
campaign.ending.kind === "distrust"
```

---

## Decision Summary

| 항목 | 결정 |
| --- | --- |
| phase 변경 | C7 Transition Layer 전용 |
| ended 이후 데이터 | 유지 |
| 정상 종료 판정 | worldTurn 이후 |
| ended 재진입 | 게임 흐름 차단 |
| 저장 책임 | C7 제외 |
| 엔딩 생성 | C6 |
| 엔딩 적용 | C7 |
