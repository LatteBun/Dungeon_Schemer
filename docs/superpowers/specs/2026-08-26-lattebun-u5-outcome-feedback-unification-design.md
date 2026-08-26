# U5 전투·비전투 결과 피드백 통합 설계

## 문서 정보

- 작성자: LatteBun
- 작성 도구: ChatGPT · Superpowers Brainstorming
- 작성일: 2026-08-26
- 기준 브랜치: `main` (`98d65c091cebcc72fe27977f38828685e081ff01`)
- 관련 변경: PR #182, PR #189
- 대상: U5 사건 결과 공개 순서, U4·U5 파티 상태, 상단 골드와 개인 보스 정보·상인 예약 효과
- 상태: 사용자 승인 완료, 구현 전

## 1. 배경

PR #182와 이를 최신 `main`에 통합한 PR #189는 일반전·보스전의 결과를 한꺼번에 공개하지 않고 다음 인과 순서로 보여주는 전투 피드백 시퀀스를 도입했다.

```text
조언 선택
→ 핵심 파티원의 수용·의심·적발
→ 전투를 부른 사건 결과
→ 자동 전투
→ HP 변화
→ 핵심 파티원의 사후 반응
→ 신뢰 변화
→ 다음 단계
```

하지만 현재 `eventCombatFeedbackFor()`는 `pendingOutcome.battle`이 없으면 피드백 View를 만들지 않는다. `U5ProgressScreen`은 그 경우 기존 `Outcome` 컴포넌트로 떨어져 다음 세 구역을 동시에 렌더링한다.

```text
파티원별 반응
사건 결과
수치·신뢰 변화
```

그 결과 같은 조언 선택이라도 전투 사건은 원인과 결과를 시간 순서대로 체험하는 반면, 휴식·상인·특수 사건과 전투를 회피한 몬스터 사건은 최종 보고서를 즉시 받는다. Store에는 골드·HP·신뢰·보스 정보·상인 예약 효과가 이미 반영되어 있어 우측 카드와 상단 상태도 결과 공개보다 앞서 최종 값으로 바뀔 수 있다.

이번 변경은 규칙 계산 시점을 늦추지 않는다. 조언 선택 시 결과를 확정하는 현재 계약은 유지하고, **이미 확정된 결과 중 현재 피드백 단계까지 공개해도 되는 projection**을 전투와 비전투에서 하나의 상태 머신으로 관리한다.

## 2. 목표

1. 전투 여부와 관계없이 모든 `pendingOutcome`을 같은 인과형 결과 피드백 흐름으로 보여준다.
2. 비전투 사건에서도 대표 파티원 반응, 사건 결과, 상태 반영, 사후 반응과 신뢰 변화를 시간 순서대로 공개한다.
3. 적발된 방해 조언의 신뢰 변화는 사건 결과보다 먼저 즉시 보여준다.
4. HP·신뢰·골드·개인 보스 정보·상인 예약 효과를 각 값이 원래 속한 UI에서 표현한다.
5. 일반 단서는 우측 파티 상태에 표시하지 않고 현재 E3 연계·생태 기록 계약을 유지한다.
6. 개인 보스 정보는 수용·의심한 파티원 카드에만 아이콘으로 표시하고 현재 원정 attempt 동안 유지한다.
7. 다음 전투 상인 효과는 `파티 상태` 제목과 같은 줄에 실제 효과를 짧게 표시하고, 실제 전투에서 소비될 때 제거한다.
8. 전투 피드백의 HP 동기화, 건너뛰기, 다시 보기, 단일 CTA와 미래 정보 누출 방지 계약을 보존한다.
9. `U5ProgressScreen`의 구형 3단 `Outcome` fallback을 제거한다.
10. U3 공용 카드와 원정 밖 화면의 기존 DOM·높이·동작을 불필요하게 바꾸지 않는다.

## 3. 비목표

이번 변경에서 다음은 만들지 않는다.

- 결과 계산 자체의 지연 적용
- 전투·신뢰·골드·상인 효과 수치 재조정
- 일반 단서의 우측 HUD 표시
- 일반 단서 이름·내용·진위 공개
- 보스 정보의 이름, 보스 특징, 도움·방해 정답 공개
- 성격별 신규 대사 작성
- 비전투 결과 다시 보기
- 결과 단계마다 누르는 `다음` 버튼
- 파티원 세 명의 반응을 현재 장면에 순차 또는 동시 전시
- 보스 정보 성공·실패를 나타내는 세 번째 아이콘 상태
- 커스텀 결과 모달 또는 새 우측 패널
- 이번 Spec PR에서 최종 아이콘 PNG 제작
- U6 정산 이후 보스 정보·상인 효과 유지

## 4. 승인된 사용자 흐름

### 4.1 공통 상태 전이

```text
preReaction
  핵심 파티원 한 명의 수용·의심·적발
  ├─ 전투 전 적발 신뢰 있음 → immediateTrust
  └─ 그 외 → consequence

immediateTrust
  적발한 인물의 즉시 신뢰 변화
  └─ 자동 → consequence

consequence
  조언 실행 또는 파티의 기본 처리로 생긴 사건 결과
  └─ 자동 → stateApply 또는 battle 또는 postDialogue 또는 complete

stateApply
  전투 전 HP·골드·개인 보스 정보·상인 예약 효과를 원래 UI에 동시 반영
  └─ 자동 → battle 또는 postDialogue 또는 complete

battle
  기존 자동 전투 replay
  └─ 자연 종료 또는 건너뛰기 → postBattleHp

postBattleHp
  최종 HP·사망 상태와 사건 전체 HP 변화량 확인
  └─ 자동 → postDialogue 또는 complete

postDialogue
  핵심 파티원의 사후 대사
  └─ 사용자 `반응 확인` → postTrust

postTrust
  사후 신뢰 변화
  └─ 자동 → complete

complete
  일반 사건 `지도로 돌아간다`
  전멸 사건은 원정 종료 흐름
  보스전 `정산으로`
```

필요한 정보가 없는 phase는 생성하지 않는다. 상태 머신이 모든 phase를 강제로 밟은 뒤 빈 문구를 보여주는 방식은 금지한다.

### 4.2 자동 진행과 수동 관문

- `preReaction`, `immediateTrust`, `consequence`, `stateApply`, `postBattleHp`, `postTrust`는 자동 진행한다.
- 사후 대사와 사후 신뢰 변화가 있을 때만 `postDialogue`에서 `반응 확인`을 요구한다.
- 신뢰 변화가 없으면 `postDialogue`와 `postTrust`를 함께 생략한다.
- 최종 `complete`에 도달하기 전에는 지도·정산 CTA를 만들지 않는다.
- 비전투 사건에 단계별 `다음` 버튼을 추가하지 않는다.

기본 유지 시간은 다음으로 확정한다.

| phase | 기본 유지 시간 |
| --- | ---: |
| `preReaction` | 1,100ms |
| `immediateTrust` | 650ms |
| `consequence` | 1,100ms |
| `stateApply` | 800ms |
| `postBattleHp` | 500ms |
| `postTrust` | 650ms |

전투 `×1 / ×2` 재생 속도는 텍스트·상태 확인 시간에 영향을 주지 않는다. `prefers-reduced-motion`은 흔들림·점멸·진입 이동만 제거하고 phase 순서와 유지 시간, `반응 확인` 관문은 유지한다.

## 5. 사건 유형별 예시

### 5.1 일반 비전투 사건

```text
preReaction
→ consequence
→ postDialogue
→ 반응 확인
→ postTrust
→ complete
```

### 5.2 변화 없는 중립 비전투 사건

```text
preReaction
→ consequence
→ complete
```

### 5.3 적발이 발생한 비전투 사건

```text
preReaction
→ immediateTrust
→ consequence
→ 필요한 stateApply
→ 다른 사후 검증이 있으면 postDialogue → postTrust
→ complete
```

적발된 인물은 거짓을 이미 알아차렸으므로 신뢰 변화가 사건 결과 뒤로 밀리지 않는다.

### 5.4 상인 사건

```text
preReaction
→ consequence
→ stateApply
   상단 골드 감소
   개인 HP 회복
   파티 상태 헤더에 다음 전투 효과 등장
→ 필요한 postDialogue → postTrust
→ complete
```

여러 변화가 있어도 HP, 골드와 예약 효과를 별도 phase로 나누지 않고 하나의 `stateApply`에서 동시에 반영한다.

### 5.5 보스 정보 사건

```text
preReaction
→ immediateTrust?    적발된 인물만
→ consequence
→ stateApply
   accepted / suspected 인물 카드에 개인 아이콘 추가
→ complete
```

보스 정보의 최종 신뢰 검증은 이 사건에서 하지 않는다. 기존처럼 실제 보스전 뒤 적용·미적용 결과를 검증한다.

### 5.6 전투를 회피한 몬스터 사건

```text
preReaction
→ consequence
→ 필요한 stateApply
→ 필요한 postDialogue → postTrust
→ complete
```

사건 분류가 `monster`여도 `BattleResolution`이 없으면 `battle`과 `postBattleHp`를 만들지 않는다. 예약된 상인 효과도 소비하지 않는다.

### 5.7 일반 전투 사건

```text
preReaction
→ immediateTrust?
→ consequence
→ stateApply?        전투 전에 발생한 상태만
→ battle
→ postBattleHp
→ postDialogue?
→ postTrust?
→ complete
```

### 5.8 보스전

```text
stateApply?          예약 상인 효과 발동 강조
→ battle
→ postBattleHp
→ postDialogue?
→ 반응 확인
→ postTrust?
→ complete
```

보스방에서는 새 조언을 선택하지 않으므로 사전 반응과 사건 결과가 없으면 `stateApply` 또는 `battle`에서 시작한다.

## 6. 대표 파티원 선택

현재 시퀀스에서는 파티원 한 명만 강조한다. 나머지 반응과 변화는 진행 기록과 카드 원정 이력에 보존한다.

### 6.1 사전 반응

1. 즉시 신뢰 변화가 있는 `exposed` 인물 중 절댓값 변화가 가장 큰 인물
2. 그 외 `accepted` 인물 중 첫 번째
3. 아무도 수용하지 않았으면 `suspected` 인물 중 첫 번째
4. 동률은 결정적인 파티 자리 순서

### 6.2 사후 반응

1. 아직 공개하지 않은 사후 신뢰 변화의 절댓값이 가장 큰 인물
2. 동률은 파티 자리 순서
3. 사후 신뢰 변화가 없으면 사후 대사와 `반응 확인`을 만들지 않는다

현재 PR #182/#189의 고정 대사 계약은 유지하고, 이번 범위에서 성격별 말투를 추가하지 않는다.

## 7. 결과 표시 스냅샷

### 7.1 원칙

조언 선택 시 Store에는 최종 골드·파티 상태·`infoRecords`·`pendingMerchantEffect`가 이미 반영된다. UI가 최종 Store에서 이전 값을 추측하면 안 된다. 규칙 계층이 결과를 계산하는 순간 공개 순서에 필요한 전후 상태를 함께 기록한다.

화면은 다음을 역산하지 않는다.

```text
최종 골드에서 구매 가격을 빼 이전 골드 추측
최종 infoRecords의 마지막 항목을 새 정보라고 추측
최종 HP에서 전투 피해를 빼 전투 전 HP 복원
event.kind만 보고 상인 효과가 소비됐다고 추측
```

### 7.2 공통 presentation 타입

`ExpeditionOutcome`과 보스 결과가 다음 표시 스냅샷을 공유한다.

```ts
interface OutcomePresentationSnapshot {
  readonly preBattleHpChanges: readonly {
    readonly characterId: CharacterId;
    readonly before: number;
    readonly after: number;
  }[];

  readonly goldChange: {
    readonly before: number;
    readonly after: number;
  } | null;

  readonly infoRecordCountBefore: number;

  readonly bossInfoAdded: readonly {
    readonly characterId: CharacterId;
    readonly reaction: "accepted" | "suspected";
  }[];

  readonly merchantEffectBefore: PendingMerchantEffect | null;
  readonly merchantEffectAfter: PendingMerchantEffect | null;
}
```

- `preBattleHpChanges`는 사건 즉시 효과와 상인 회복처럼 전투 전에 확정된 HP 변화만 담는다.
- 기존 `hpChanges`는 사건 시작부터 최종 상태까지의 전체 HP 변화량을 유지한다.
- `goldChange`는 캠페인 공용 골드의 전후다.
- `infoRecordCountBefore`는 현재 결과 전까지 존재하던 개인 보스 정보 기록의 경계다.
- `bossInfoAdded`는 이번 사건에서 새로 생긴 개인 표시 상태다.
- `bossInfoAdded`에는 `BossRuleId`, 도움·방해 정답과 표시할 필요가 없는 내부 내용을 넣지 않는다.
- `merchantEffectBefore`와 `merchantEffectAfter`로 구매·유지·소비를 명시한다.

### 7.3 HP 연속성

전투가 있는 경우:

```text
사건 시작 HP
→ preBattleHpChanges.after
→ replay participant.initialHp
→ replay participant.finalHp
→ 사건 최종 HP
```

다음 계약을 검증한다.

```text
preBattleHpChanges의 최종 after
=== replay participant.initialHp

replay participant.finalHp
=== pendingOutcome 최종 HP
```

전투 전 HP 변화가 없는 인물은 사건 시작 HP가 replay initial HP와 같아야 한다.

전투가 없는 경우:

```text
preBattleHpChanges.after
=== pendingOutcome 최종 HP
```

화면에서 끊어진 HP chain을 임의 보정하지 않는다.

### 7.4 신뢰 분할

`trustChanges`의 인물별 연속 chain은 그대로 보존한다.

- `exposed` 인물의 전투 전 변화는 `immediateTrust`
- 그 외 즉시 사건 검증 변화는 `postTrust`
- 보스 정보 `accepted`·`suspected`는 이번 사건에서 사후 신뢰를 만들지 않고 보스전 뒤 검증
- 같은 인물에게 여러 변화가 있으면 각 묶음의 첫 `before`와 마지막 `after`를 사용하되 중간 사유는 기록에 유지

## 8. 범용 피드백 모델

현재 `U5CombatFeedbackView`, `U5CombatFeedbackPhase`, `useU5CombatFeedback`을 사건 전체를 나타내는 이름과 계약으로 일반화한다.

```text
U5OutcomeFeedbackView
U5OutcomeFeedbackPhase
useU5OutcomeFeedback
outcomeFeedbackFor
```

구현 중 최종 이름은 이 의미를 유지해야 하며, 전투가 없는 결과를 `combatFeedback`이라는 이름으로 억지로 밀어 넣지 않는다.

### 8.1 phase 생성

순수 함수가 View를 보고 필요한 phase 배열을 만든다.

```ts
[
  preReaction?,
  immediateTrust?,
  consequence?,
  stateApply?,
  battle?,
  postBattleHp?,
  postDialogue?,
  postTrust?,
  complete,
]
```

### 8.2 허용 이벤트

```ts
type OutcomeFeedbackEvent =
  | "AUTO_ADVANCE"
  | "BATTLE_COMPLETE"
  | "ACKNOWLEDGE_REACTION";
```

- 자동 phase는 `AUTO_ADVANCE`만 수용
- `battle`은 `BATTLE_COMPLETE`만 수용
- `postDialogue`는 `ACKNOWLEDGE_REACTION`만 수용
- `complete`는 로컬 reducer 이벤트로 벗어나지 않음
- 잘못된 이벤트는 phase를 바꾸지 않음

### 8.3 signature

피드백 인스턴스는 다음 의미를 포함하는 안정적 signature로 식별한다.

```text
expeditionId
current node 또는 boss
event identity
records length
presentation snapshot identity
```

새 결과가 들어오면 첫 phase로 초기화하고 이전 결과의 모든 타이머를 정리한다.

## 9. 단계별 projection

### 9.1 상단 골드

```text
stateApply 이전  goldChange.before
stateApply 이후  goldChange.after
```

`stateApply`에서 값과 함께 `골드 ±N`을 짧게 강조한다. 골드 변화가 없으면 effect와 빈 슬롯을 만들지 않는다.

### 9.2 파티 HP

- `stateApply` 전에는 사건 시작 HP
- `stateApply`에서 전투 전 HP 효과를 반영하고 `HP ±N` 표시
- `battle`에서는 기존 replay frame HP와 우측 카드 HP를 같은 시계로 동기화
- `postBattleHp` 이후에는 replay final HP
- `complete`에서는 사건 전체 `HP ±N` 총합을 유지
- 완료 후 다시 보기 중 우측 카드는 최종 HP를 유지

예시:

```text
사건 시작 10
상태 반영 HP +3 → 13
전투 피해 HP -5 → 8
완료 변화량 HP -2
```

### 9.3 신뢰

- `immediateTrust` 전에는 이전 신뢰
- `immediateTrust`에서 적발 신뢰 반영
- `postTrust` 전에는 사후 변화 전 신뢰
- `postTrust`에서 최종 신뢰 반영
- `complete`에서 이번 결과의 전체 `신뢰 ±N`을 카드 앞면에 유지

### 9.4 개인 보스 정보

`InfoRecord`는 개인별 기록이다. 각 파티원 카드에는 그 사람에게 실제로 남은 기록만 표시한다.

```text
accepted  채워진 아이콘
suspected 외곽선 아이콘
exposed   표시 없음
neutral   기록 없음, 표시 없음
```

현재 결과의 새 아이콘은 Store에 이미 있어도 `stateApply` 전에는 숨긴다.

```text
stateApply 이전  infoRecords[0 .. infoRecordCountBefore)
stateApply 이후  최종 infoRecords
```

같은 보스 정보 조언을 세 명이 각각 받아들였으면 각 카드에 하나씩 표시한다. 한 카드에서는 `eventId + adviceId + characterId`가 같은 지연 기록을 중복으로 허용하지 않는다. 다른 사건에서 같은 보스 특성에 대한 정보를 다시 얻었다면 별도 기록이며 아이콘도 하나 더 표시한다.

보스전 뒤에도 아이콘 채움 상태는 `accepted / suspected`의 원래 선택을 나타내며 성공·실패 상태로 변환하지 않는다.

### 9.5 상인 예약 효과

`merchantEffectBefore`와 `merchantEffectAfter`를 다음처럼 해석한다.

| before | after | 실제 전투 | 표시 |
| --- | --- | --- | --- |
| 없음 | 있음 | 없음 | `stateApply`에서 예약 배지 등장 |
| 있음 | 있음 | 없음 | 기존 배지 유지 |
| 있음 | 없음 | 있음 | 전투 직전 `효과 발동` 강조, `battle` 진입 시 제거 |
| 있음 | 있음 | 전투 회피 | 소비하지 않고 유지 |
| 없음 | 없음 | 무관 | 배지 없음 |

사건 종류가 `monster`라는 이유만으로 예약 효과를 소비하지 않는다. 실제 전투가 생성되고 규칙이 효과를 소비했을 때만 제거한다.

## 10. 우측 파티 상태 UI

### 10.1 공통 파티 상태 헤더

U4와 U5가 각각 직접 그리는 `파티 상태` 제목을 공용 헤더로 추출한다.

```text
파티 상태                       [방패] 받는 피해 감소
```

공격형 효과:

```text
파티 상태                         [검] 주는 피해 증가
```

- 제목은 왼쪽 정렬
- 예약 효과는 같은 줄 오른쪽 정렬
- 아이콘과 실제 효과를 사람이 읽는 짧은 문구로 함께 표시
- 예약 상태는 `다음 전투 · 받는 피해 감소` 또는 `다음 전투 · 주는 피해 증가`
- 발동 강조는 `효과 발동 · ...`
- 내부 배율 숫자는 노출하지 않음
- 효과 유무와 관계없이 제목 행 높이는 고정
- 배지가 길어져 제목을 침범하지 않도록 최대 폭과 말줄임 또는 안전한 축약 문구를 사용
- 배지는 U4 지도와 U5 사건·전투·보스 결과에서 같은 View를 사용
- U3와 U6에는 표시하지 않음

### 10.2 파티원 카드 footer

현재 골드 행을 골드와 개인 보스 정보가 함께 있는 footer로 확장한다.

```text
[골드 아이콘] 41                       [수용] [의심] [수용]
```

- 골드는 왼쪽 정렬
- 개인 보스 정보 아이콘 그룹은 같은 줄 오른쪽 정렬
- 아이콘은 획득 시간순
- 아이콘이 없어도 footer 높이는 동일
- 아이콘 그룹은 골드 값을 침범하지 않음
- 최대 폭을 넘으면 카드 안에서 안전하게 감기되 카드 외곽 폭을 늘리지 않음
- 결과 변화량 슬롯과 별도 영역으로 유지
- 보스 정보 추가로 카드 외곽 높이가 phase마다 달라지지 않게 U4·U5 footer 공간을 안정화
- U3는 `bossInfoStates`를 전달하지 않으며 기존 카드 표현을 유지

개념 View:

```ts
type BossInfoIconState = "accepted" | "suspected";

interface PartyMemberCardView {
  // 기존 필드
  readonly bossInfoStates?: readonly BossInfoIconState[];
}
```

DOM에는 `eventId`, `adviceId`, `bossRuleId`, 도움·방해 내부 판정을 넣지 않는다.

### 10.3 아이콘 에셋 계약

이번 Spec PR에는 PNG를 추가하지 않는다. 후속 에셋 작업에서 다음 경로를 채운다.

```text
public/assets/shared/party-status/boss-info-accepted.png
public/assets/shared/party-status/boss-info-suspected.png
```

두 파일은 다음 계약을 지킨다.

- 투명 배경 정사각형 PNG
- 같은 실루엣, 같은 비율, 같은 아트 스타일
- `accepted`는 내부가 채워진 상태
- `suspected`는 같은 형태의 외곽선 또는 비어 있는 상태
- 텍스트와 독립 배경 없음
- 작은 HUD 렌더 크기에서도 구분 가능
- 원본 권장 크기 128×128px
- 실제 카드 렌더 크기 16~18 CSS px
- 접근성 의미는 이미지별 `alt` 반복이 아니라 카드 단위 수량 문구가 담당

최종 아이콘 에셋이 들어오기 전에는 구현 완료로 판정하지 않는다. 품질이 맞지 않았던 대화 중 임시 생성 이미지는 저장하거나 사용하지 않는다.

### 10.4 접근성

카드별로 한 번만 다음 의미를 제공한다.

```text
수용한 보스 정보 2개, 의심 중인 보스 정보 1개
```

- 장식 이미지 자체는 빈 `alt`와 `aria-hidden`
- 아이콘 색·채움만으로 의미를 전달하지 않고 카드 단위 텍스트를 제공
- 상인 효과 배지는 사람이 읽는 실제 효과 문구를 포함
- 값 변화 output은 기존 HP·신뢰와 같은 중복 낭독을 만들지 않음

## 11. 비전투 장면과 현재 beat

`U5NonBattlePartyScene`에도 기존 전투 장면 하단 대화 리본을 연결한다.

- `preReaction`에서 대표 인물의 사전 대사
- `postDialogue`에서 대표 인물의 사후 대사
- 대사 리본에는 이름과 한 줄 대사만 표시
- 모든 파티원 반응을 반복하지 않음
- 좌측 콘솔과 같은 문장을 중복 표시하지 않음
- 리본은 장면과 파티를 가리는 모달이 아님
- 리본 유무로 장면·콘솔 높이가 달라지지 않음
- 새 대사는 `aria-live="polite"`로 한 번만 알림

좌측 `행동 / 조언` 모드는 현재 phase 하나만 보여준다.

| phase | 좌측 콘솔 |
| --- | --- |
| `preReaction` | 선택한 조언과 대표 반응의 맥락 |
| `immediateTrust` | 거짓이 즉시 드러났다는 짧은 상태 |
| `consequence` | 사건 결과 문장 |
| `stateApply` | `상태가 반영됩니다.` |
| `battle` | `전투가 진행 중입니다.`와 전투 원인 |
| `postBattleHp` | 승패와 HP 반영 중이라는 짧은 상태 |
| `postDialogue` | 짧은 사건 결말, 직접 대사는 장면 리본 |
| `postTrust` | `신뢰가 변했습니다.` |
| `complete` | 짧은 결말과 다음 단계 안내 |

좌측에 HP·신뢰·골드·보스 정보 변화 목록을 다시 만들지 않는다.

## 12. 진행 기록과 카드 뒤집기 공개 경계

Store에 현재 사건의 전체 기록이 이미 있어도 현재 phase보다 미래의 정보는 숨긴다.

- 이전 지점 기록과 공개 생태·관찰 단서는 계속 확인 가능
- 선택한 조언은 선택 직후부터 공개
- 대표 반응은 `preReaction`부터 공개
- 적발 신뢰는 `immediateTrust`부터 공개
- 사건 결과는 `consequence`부터 공개
- 전투 전 HP·골드·개인 보스 정보·상인 효과는 `stateApply`부터 공개
- 전투 행동은 현재 replay frame까지 공개
- 최종 승패·HP 요약은 `postBattleHp`부터 공개
- 사후 대사와 사후 신뢰는 해당 phase 이전에 공개하지 않음
- 필터를 바꿔도 공개 경계를 우회할 수 없음
- `complete` 뒤에는 기존 전체 원정 기록을 다시 제공

현재 결과가 `complete`가 되기 전에는 U5 파티 카드 뒤집기 버튼을 DOM에서 제거한다. disabled 복제본을 두지 않는다. U4 지도에서는 현재 진행 중인 결과가 없으므로 기존 카드 뒤집기 동작을 유지한다.

## 13. CTA, 건너뛰기와 다시 보기

### 13.1 CTA

우측 하단에는 동시에 하나의 주요 CTA만 둔다.

| phase | CTA |
| --- | --- |
| 자동 phase | 없음 |
| `battle` 재생 중 | `전투 건너뛰기` |
| `postDialogue` | `반응 확인` |
| `complete` 일반 사건 | `지도로 돌아간다` |
| `complete` 전멸 사건 | 원정 종료 흐름에 맞는 CTA |
| `complete` 보스전 | `정산으로` |
| 완료 전투 다시 보기 | 재생 중 `전투 건너뛰기`, 종료 후 원래 CTA |

CTA 문구로 규칙 상태를 추측하지 않는다. 호출부가 다음 정책을 명시한다.

### 13.2 건너뛰기

`전투 건너뛰기`는 replay frame만 complete로 옮긴다.

- `postBattleHp`, `postDialogue`, `postTrust`를 건너뛰지 않음
- 일반 사건 ACK, 원정 완료와 정산을 자동 dispatch하지 않음
- 자연 종료와 건너뛰기는 같은 final HP·대사·신뢰·CTA에 도달
- 연타로 마지막 frame을 넘거나 후속 phase를 중복 실행하지 않음

### 13.3 다시 보기

전체 피드백 완료 뒤 다시 보기는 전투 replay만 되감는다.

유지하는 값:

```text
상단 골드
전투 전 HP 효과
개인 보스 정보 아이콘
상인 예약 효과의 최종 소비 상태
최종 HP와 사망
최종 신뢰
완료 변화량
사후 대사 확인 여부
```

중앙 전투 장면만 초기 frame으로 돌아가며 Store, RNG, 규칙 결과를 다시 계산하지 않는다. 비전투 사건에는 다시 보기 기능을 추가하지 않는다.

## 14. 전멸과 원정 종료

비전투 상태 효과 또는 전투로 파티가 전멸해도 현재 결과 피드백은 필요한 phase를 끝까지 보여준다.

```text
사건 결과
→ 상태·HP·사망 반영
→ 필요한 사후 반응·신뢰
→ complete
→ 원정 종료·정산 흐름
```

전멸 결과에서 `지도로 돌아간다`를 눌러 다음 노드를 선택할 수 있게 만들지 않는다. 화면은 `wiped` 여부를 CTA 문구로 역추론하지 않고 호출부 정책을 따른다.

## 15. 오류와 경계 조건

다음 상황은 조용한 fallback으로 숨기지 않는다.

- `pendingOutcome`이 있는데 범용 피드백 View를 만들 수 없음
- presentation snapshot 누락
- HP chain 불일치
- 신뢰 변화 chain 불일치
- `goldChange.after`와 조언 적용 후 캠페인 골드 불일치
- `infoRecordCountBefore`가 최종 기록 길이보다 큼
- `bossInfoAdded`와 실제 추가된 지연 기록 불일치
- 같은 `eventId + adviceId + characterId`의 중복 보스 정보 기록
- `exposed` 또는 `neutral`이 개인 보스 정보 아이콘 상태로 들어옴
- 상인 효과 before/after와 실제 소비 여부 불일치
- `battle` phase인데 replay 없음
- 비전투 흐름에서 `BATTLE_COMPLETE` 수신
- replay 참가자와 현재 파티원 연결 불일치
- 새 결과 signature 뒤 이전 타이머가 phase를 진행시킴

오류가 있으면 기존 3단 `Outcome`, 최종 Store 값 또는 지어낸 문구를 대신 표시하지 않는다.

## 16. 컴포넌트와 소유권

```text
campaign-transition.ts
  ├─ 규칙 결과 계산
  ├─ ExpeditionOutcome / BossResult
  └─ OutcomePresentationSnapshot 기록과 연속성 검증

campaign-adapters.ts
  ├─ U4·U5 파티 View
  ├─ 개인 infoRecords → bossInfoStates
  ├─ 상인 효과 → 짧은 헤더 배지
  └─ phase별 log projection

u5-outcome-feedback-adapter.ts
  ├─ 일반 사건·보스 결과 → U5OutcomeFeedbackView
  ├─ 대표 인물과 대사
  └─ 내부 식별자를 제거한 표시 projection

u5-outcome-feedback.ts
  ├─ 필요한 phase 배열
  ├─ 순수 reducer
  └─ phase별 visible value helper

use-u5-outcome-feedback.ts
  ├─ 자동 타이머
  ├─ 반응 확인
  └─ signature 변경·unmount 정리

U5ProgressScreen.tsx
  ├─ 현재 beat 하나
  ├─ phase별 상단·카드 projection
  ├─ 전투 playback 연결
  └─ 단일 CTA

U5BattleScene / U5NonBattlePartyScene
  └─ 현재 장면과 대표 인물 대화 리본

ExpeditionPartyHeader
  └─ 파티 상태 제목 + 공용 상인 예약 효과

PartyMemberCard
  └─ 골드 footer + 개인 보스 정보 아이콘 + 기존 결과 변화량
```

Campaign Store에는 frame index, feedback phase, 대사 확인 여부를 저장하지 않는다. 이 값은 결과 signature에 묶인 UI 로컬 상태다.

## 17. U3·U4·U5·U6 호환성

| 화면 | 개인 보스 정보 | 상인 효과 헤더 | 결과 시퀀스 |
| --- | ---: | ---: | ---: |
| U3 공고·파티 | 미표시 | 미표시 | 없음 |
| U4 던전 지도 | 표시 | 표시 | 없음 |
| U5 비전투 사건 | 표시 | 표시 | 범용 |
| U5 일반 전투 | 표시 | 발동 전까지 표시 | 범용 |
| U5 보스 전투·결과 | 표시 | 발동 전까지 표시 | 범용 |
| U6 정산 이후 | 미표시 | 미표시 | 없음 |

`PartyMemberCardView.bossInfoStates`는 optional이다. U3처럼 주지 않는 화면에는 새 footer 공간이나 아이콘 DOM을 강제로 만들지 않는다. U4·U5에서는 아이콘이 없는 카드도 footer 정렬이 맞도록 원정 화면 범위에서 높이를 안정화한다.

## 18. 테스트 계약

### 18.1 순수 상태 머신

- 비전투 결과가 `preReaction → consequence → complete` 기본 흐름으로 전이
- 상태 변화가 있으면 `stateApply` 삽입
- 적발 신뢰가 있으면 `immediateTrust` 삽입
- 사후 신뢰가 있으면 `postDialogue → postTrust` 삽입
- 전투 결과만 `battle → postBattleHp` 삽입
- 보스전은 불필요한 사전 phase 없이 시작
- 잘못된 event가 phase를 바꾸지 않음
- signature 변경과 unmount가 이전 timer를 정리
- reduced motion에서도 phase 순서와 사용자 확인 유지

### 18.2 규칙과 presentation snapshot

- 비전투 HP 효과의 before/after 기록
- 상인 구매의 골드 before/after 기록
- 상인 HP 회복과 예약 효과 before/after 기록
- 전투 전 HP와 replay initial HP 연결
- replay final HP와 사건 최종 HP 연결
- 전투 회피 시 예약 효과 미소비
- 일반전·보스전에서 예약 효과 소비 전 상태 보존
- `infoRecordCountBefore`와 새 지연 기록 경계
- accepted/suspected만 `bossInfoAdded`에 포함
- exposed/neutral은 포함하지 않음
- 전멸 결과에서도 presentation snapshot 보존

### 18.3 어댑터

- 대표 인물 선택이 변화량과 파티 자리 순서를 따름
- 내부 `eventId`, `adviceId`, `bossRuleId`, 도움·방해 key가 presentation DOM에 없음
- U4 최종 카드에 개인별 accepted/suspected 아이콘 상태가 정확히 배치
- U5 `stateApply` 전에는 새 보스 정보가 숨고 이후에만 나타남
- 상인 효과 badge가 구매·유지·발동·소비 상태에 맞게 변환
- 일반 단서는 개인 보스 정보 아이콘으로 변환하지 않음
- phase별 log projection이 미래 항목 제거

### 18.4 렌더와 접근성

- 모든 `pendingOutcome`이 구형 `Outcome` 없이 현재 beat 하나만 렌더링
- 비전투 사전·사후 대사가 장면 하단 리본에 대표 인물 이름과 함께 표시
- `stateApply`에서 골드, HP, 개인 보스 정보, 예약 효과가 각 원래 위치에 동시 반영
- 파티원 footer에서 골드는 왼쪽, 보스 정보는 오른쪽
- accepted와 suspected가 서로 다른 에셋 경로를 사용
- 아이콘 유무와 phase 변화로 카드 외곽 크기가 움직이지 않음
- `파티 상태` 제목과 상인 효과가 같은 행에 배치
- 효과 유무로 제목 행 높이가 움직이지 않음
- 카드 단위 접근성 문구가 accepted/suspected 수량을 전달
- `complete` 전 카드 뒤집기와 다음 단계 CTA가 DOM에 없음
- 동시에 하나의 주요 CTA만 존재
- U3 카드에는 보스 정보·상인 효과 DOM이 추가되지 않음

### 18.5 브라우저 E2E

실제 `/campaign`에서 다음을 검증한다.

1. 휴식·특수 비전투 사건이 구형 세 구역 보고서를 표시하지 않음
2. 비전투 조언 뒤 대표 반응, 사건 결과, 상태 반영, 사후 신뢰가 승인된 순서로 진행
3. 적발 신뢰가 사건 결과 전에 표시
4. 상인 구매 시 골드·HP·예약 효과가 `stateApply`에서 함께 반영
5. U4 복귀 뒤 상인 예약 효과와 개인 보스 정보가 유지
6. 보스 정보 accepted/suspected가 해당 개인 카드에만 추가
7. exposed 인물에는 아이콘이 추가되지 않음
8. 전투를 회피하면 상인 효과가 유지
9. 실제 일반전·보스전 시작 시 효과 발동 강조 후 배지가 제거
10. 일반전의 frame HP와 우측 카드 HP가 동기화
11. 건너뛰기가 사후 대사·신뢰 단계를 건너뛰지 않음
12. 다시 보기에서 중앙 전투만 되감기고 카드·골드·아이콘·상인 효과 최종 상태는 유지
13. 전멸 결과가 피드백 완료 뒤 지도 선택으로 돌아가지 않음
14. 1920×1080, 2560×1440, 1440×900, 1280×1024에서 카드 footer·헤더 배지·CTA가 겹치거나 잘리지 않음
15. 네 viewport에서 스크롤, 카드 높이 이동, 이미지 왜곡과 콘솔 오류가 없음

### 18.6 전체 검증

구현 완료 전 다음을 실행한다.

```bash
pnpm exec vitest run
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright test
git diff --check
```

규칙 상태 모양과 기록이 바뀌므로 관련 campaign backtest와 결정성 검증도 실행한다. 수치 밸런스 기대값은 바꾸지 않되, 같은 시드에서 결과와 기록이 재현되는지 확인한다.

## 19. 예상 변경 파일

### Domain·rules

- `lib/domain/campaign-transition.ts`
  - `OutcomePresentationSnapshot`
  - `ExpeditionOutcome.presentation`
- `lib/domain/expedition.ts`
  - 보스 결과의 presentation 또는 공통 결과 snapshot 연결
- `lib/rules/campaign-transition.ts`
  - 골드·전투 전 HP·보스 정보·상인 효과 전후 기록
  - 일반 사건과 보스전 snapshot 생성
  - 연속성 검증
- 관련 rules tests와 backtest fixtures

### U5 상태와 어댑터

- `components/game/u5-combat-feedback.ts`
- `components/game/use-u5-combat-feedback.ts`
- `components/game/u5-combat-feedback-adapter.ts`

위 세 파일은 범용 outcome 이름으로 rename하거나 동일 의미의 새 파일로 대체한다. 과도한 compatibility wrapper를 장기간 남기지 않는다.

- `components/game/campaign-adapters.ts`
  - 파티 개인 보스 정보와 상인 효과 View
  - phase별 진행 기록 projection
- `components/game/CampaignScreen.tsx`
  - 모든 pending outcome에 범용 View 전달
  - U4·U5 공용 원정 상태 전달

### 화면과 스타일

- `components/game/U5ProgressScreen.tsx`
  - 구형 `Outcome` 제거
  - 범용 phase projection과 비전투 리본
- `components/game/U5NonBattlePartyScene.tsx`
  - 대표 인물 대화 리본 host
- `components/game/PartyMemberCard.tsx`
  - 골드 + 보스 정보 footer
- `components/game/U4DungeonMapScreen.tsx`
  - 개인 보스 정보와 공용 헤더 연결
- `components/game/ExpeditionPartyHeader.tsx`
  - 신규 공용 헤더
- `app/party-card.css`
- `app/u4-dungeon-map.css`
- `app/u5-progress.css`
- 관련 Vitest·Playwright 파일

### 문서와 에셋

구현 PR에서 다음 공식 문서를 현재 계약에 맞게 갱신한다.

- `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- `docs/systems/INFORMATION_AND_DECEPTION.md`
- `docs/experience/SCREEN_LAYOUT.md`
- `docs/experience/ONBOARDING_AND_INTERFACE.md`
- `docs/experience/UI_IMPLEMENTATION_GUIDE.md`
- `docs/README.md`

후속 에셋 작업:

- `public/assets/shared/party-status/boss-info-accepted.png`
- `public/assets/shared/party-status/boss-info-suspected.png`

## 20. 구현 순서 제약

1. presentation snapshot과 rules 테스트를 먼저 만든다.
2. 범용 순수 상태 머신 테스트를 작성한다.
3. 기존 전투 흐름이 새 상태 머신에서도 동일하게 통과하도록 옮긴다.
4. 비전투 adapter와 projection을 연결한다.
5. 구형 `Outcome` fallback을 제거한다.
6. 골드·HP·신뢰 projection을 연결한다.
7. U4·U5 개인 보스 정보와 상인 효과 헤더를 연결한다.
8. 아이콘 최종 에셋을 별도 작업에서 추가한다.
9. E2E와 전체 회귀를 검증한다.
10. 공식 문서를 갱신한다.

기존 전투 흐름을 먼저 삭제하고 새 흐름을 한꺼번에 만드는 방식은 금지한다. 전투 계약을 범용 모델로 옮기는 동안 관련 테스트가 계속 통과하도록 작은 단계로 이전한다.

## 21. 완료 조건

- 모든 전투·비전투 `pendingOutcome`이 하나의 범용 상태 머신을 사용한다.
- 휴식·상인·특수·전투 회피 사건에서 구형 3단 결과 화면이 나타나지 않는다.
- 적발 신뢰, 사건 결과, 상태 반영, 사후 반응과 신뢰가 승인된 순서로 공개된다.
- 여러 상태 변화는 하나의 `stateApply`에서 각 원래 UI에 동시에 반영된다.
- 상단 골드와 우측 HP·신뢰가 phase 전에는 최종 값을 누출하지 않는다.
- 개인 보스 정보는 accepted/suspected 인물 카드에만 표시되고 U4·U5에서 attempt 종료까지 유지된다.
- 일반 단서는 우측 카드에 표시되지 않는다.
- 상인 예약 효과는 `파티 상태` 제목 오른쪽에 실제 효과와 함께 표시되고 실제 전투에서만 소비된다.
- 전투 HP 동기화, 건너뛰기, 다시 보기와 완료 변화량 계약이 유지된다.
- 결과 완료 전 진행 기록·카드 뒤집기로 미래 정보를 우회할 수 없다.
- 전멸 결과가 지도 선택으로 돌아가지 않는다.
- U3·U6에 원정 전용 HUD가 새지 않는다.
- accepted/suspected 최종 에셋 2종이 같은 아트 세트로 연결된다.
- 관련 unit, render, E2E, typecheck, lint, build, backtest와 `git diff --check`가 통과한다.

## 22. Spec PR 범위

이 PR은 설계 문서만 추가한다.

- React·TypeScript·CSS·rules 코드를 수정하지 않는다.
- 테스트·Plan·공식 시스템 문서를 수정하지 않는다.
- 임시 생성 아이콘 PNG를 추가하지 않는다.
- Spec 승인 뒤 Superpowers Writing Plans로 별도 구현 Plan을 작성한다.
- 구현은 Spec과 Plan 검토가 끝난 뒤 별도 단계에서 진행한다.
