# U1 파티·개인 신뢰 패널 설계

**작성자:** LatteBun
**작성 도구:** Claude Code

## 목적

파티원마다 신뢰가 따로 간다는 이 게임의 핵심 차별점을 화면에서 처음으로 보이게
한다. 플레이어가 파티원을 고르면 그 성격이 무엇을 좋아하고 무엇을 경계하는지,
그리고 그 사람에게 최근 무슨 일이 있었는지 확인할 수 있어야 한다.

이 작업은 [프로토타입 작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)의
`U1`이다. 완료되면 `U5` 온보딩과 `Q2` 접근성 점검이 파티 패널을 전제로 작업할 수
있다.

`R2`가 `TRUST_RULES`에 넣어둔 성격 차이는 지금 코드 안에만 있고 화면에 없다.
`U1`은 그것을 꺼내는 일이다.

## 설계 원칙

### 화면은 규칙표를 훑지 않는다

강도 구간, 정렬, 무반응 행동 제외는 전부 순수 함수가 맡고 컴포넌트는 결과만
그린다. `TRUST_RULES`가 바뀌면 화면이 자동으로 따라가고, 그 변환이 옳은지는
테스트가 지킨다.

### 수치를 그대로 노출하지 않는다

`R2`는 기본 변화량에 절댓값의 약 20% 범위 난수를 더한다. 상세에 `+8`이라고
적어두면 플레이어가 실제 결과 `▲7`을 보고 표시가 틀렸다고 느낀다. 따라서 상세는
정확한 수치가 아니라 3단계 강도로 표현한다. 실제로 일어난 변화의 수치는
[온보딩과 인터페이스](../../experience/ONBOARDING_AND_INTERFACE.md)의 원인 피드백
원칙대로 사유와 함께 그대로 보여준다.

이는 "모든 내부 확률을 공개할 필요는 없지만, 신뢰 변화가 무작위로 느껴져서는 안
된다"는 [파티와 신뢰](../../systems/PARTY_AND_TRUST.md)의 기준을 따른 것이다.

### 확정되지 않은 경계값을 발명하지 않는다

`PARTY_AND_TRUST.md`는 신뢰 구간별 반응이 바뀌는 경계값을 아직 정하지 않았다.
따라서 `U1`은 "신뢰가 낮으니 위험" 같은 구간 표시를 만들지 않는다. `R2`가 실제로
판정하는 신뢰 `0` = 정체 발각만 표시한다.

### 런 상태를 스토어로 옮기는 일은 `P1`의 몫이다

`U1`은 UI 상태만 스토어에 둔다. 런 데이터를 언제 어떻게 스토어에 넣을지는 게임
상태 머신의 결정이므로 선점하지 않는다.

## 공개 계약

### 성격 프로필

```ts
export type ReactionStrength = 1 | 2 | 3;

export interface TrustReaction {
  action: TrustAction;
  /** "정직한 행동" — PARTY_AND_TRUST.md 공통 행동 표의 이름 */
  label: string;
  strength: ReactionStrength;
}

export interface PersonalityProfile {
  /** baseDelta > 0. 강한 순 */
  likes: TrustReaction[];
  /** baseDelta < 0. 강한 순 */
  guards: TrustReaction[];
}

export function describePersonality(personality: Personality): PersonalityProfile;
export const PERSONALITY_PROFILES: Record<Personality, PersonalityProfile>;
```

`baseDelta`가 `0`인 행동은 `likes`와 `guards` 어디에도 넣지 않는다. 그 성격이 그
행동에 의미 있는 반응을 보이지 않는다는 뜻이므로 보여줄 반응이 없다.

### 강도 구간

| 조건 | 강도 | 기호 | 스크린 리더 |
| --- | --- | --- | --- |
| `abs(baseDelta) >= 10` | 3 | `▲▲▲` `▼▼▼` | 매우 좋아함 / 매우 경계함 |
| `abs(baseDelta) >= 6` | 2 | `▲▲` `▼▼` | 좋아함 / 경계함 |
| `abs(baseDelta) > 0` | 1 | `▲` `▼` | 조금 좋아함 / 조금 경계함 |

상위 경계를 `12`가 아니라 `10`으로 잡는다. `12`를 쓰면 충동적 파티원의 경계 행동
넷이 전부 같은 단계로 뭉쳐 구분이 사라지기 때문이다.

| 성격 | 경계 행동 값 | 경계 `12` | 경계 `10` |
| --- | --- | --- | --- |
| 충동적 | -10 -10 -8 -7 | `▼▼ ▼▼ ▼▼ ▼▼` | `▼▼▼ ▼▼▼ ▼▼ ▼▼` |
| 신중함 | -12 -10 -10 -7 | `▼▼▼ ▼▼ ▼▼ ▼▼` | `▼▼▼ ▼▼▼ ▼▼▼ ▼▼` |
| 의심 많음 | -14 -8 -5 -5 | `▼▼▼ ▼▼ ▼ ▼` | `▼▼▼ ▼▼ ▼ ▼` |
| 정의로움 | -16 -16 -6 -3 | `▼▼▼ ▼▼▼ ▼▼ ▼` | `▼▼▼ ▼▼▼ ▼▼ ▼` |
| 탐욕스러움 | -16 -6 -4 | `▼▼▼ ▼▼ ▼` | `▼▼▼ ▼▼ ▼` |

`10`을 쓰면 신중함의 경계 행동 셋이 최고 단계에 몰린다. 이는 받아들인다. 신중한
파티원이 기만·배신·위험 감수를 모두 강하게 경계하는 것은 규칙표가 실제로 정한
성질이며, 뭉개는 쪽보다 그대로 보이는 쪽이 정확하다.

두 성격의 프로필이 실제로 달라지는지는 테스트가 지킨다.

의심 많음의 `likes`에는 어떤 구간에서도 3단계가 나오지 않는다. 최고가 `+8`이기
때문이다. 이것도 규칙표를 정확히 반영한 결과이며 `PARTY_AND_TRUST.md`가 "높은
신뢰에 도달하기 어렵다"고 정해둔 성질과 일치한다.

### 정렬

같은 강도끼리는 `abs(baseDelta)` 내림차순, 그것도 같으면 `TRUST_ACTIONS` 배열
순서를 따른다. 정렬은 결정적이어야 한다. 같은 성격이 화면마다 다른 순서로 보이면
플레이어가 규칙을 학습할 수 없다.

### 신뢰 변화 이력

```ts
export interface TrustHistoryEntry {
  /** 로그 순번. 시각이 아니다. */
  at: number;
  /** DecisionRecord.summary — 무슨 사건이었는지 */
  summary: string;
  delta: number;
  reason: string;
}

export function recentTrustChanges(
  log: DecisionRecord[],
  memberId: MemberId,
  limit?: number,
): TrustHistoryEntry[];
```

`log`를 역순으로 훑어 해당 파티원에게 걸린 변화만 최신부터 모은다. 기본
`limit`은 3이다. `at`이 로그 순번이지 시각이 아니라는 `F1`의 결정을 그대로
따른다.

## 배선

### `UiStoreProvider` 분리

지금 `GameStoreProvider`는 런 스토어와 UI 스토어를 묶어 제공하며 `initialRun`을
필수로 받는다. `selectedMemberId` 하나를 쓰려고 런 데이터를 함께 넘겨야 하는
구조다.

`lib/stores/game-store-provider.tsx`에 `UiStoreProvider`를 따로 export하고,
기존 `GameStoreProvider`가 내부에서 그것을 쓰게 한다. 추가만 하는 변경이므로
`/state-preview`는 영향을 받지 않는다.

```tsx
export function UiStoreProvider({ children }: { children: ReactNode });

export function GameStoreProvider({ initialRun, children }: GameStoreProviderProps) {
  // RunStoreContext.Provider 안에서 UiStoreProvider를 감싼다
}
```

### 화면 배선

`app/play/layout.tsx`는 서버 컴포넌트로 남는다. 목 데이터를 계속 직접 읽고
props로 내려보낸다.

```tsx
<UiStoreProvider>
  <ResourceBar … />
  <PartySidebar
    party={MOCK_RUN.party}
    classes={MOCK_CLASSES}
    profiles={PERSONALITY_PROFILES}
    history={historyByMemberId}
  />
</UiStoreProvider>
```

`profiles`는 기존 `classes` prop과 같은 패턴이다. 앱이 데이터를 읽고 컴포넌트는
받기만 한다. `components/**`가 `@/lib/mock`을 가져오지 않는다는 기존 경계가
그대로 유지된다.

`PartySidebar`는 `"use client"`가 된다.

## 화면 구성

요약 줄이 버튼이 되고, 누르면 그 자리에서 상세가 펼쳐진다.

```text
┌ 파티와 개인 신뢰 ────────┐
│ ▼ 라그나 전사        72 │  ← button aria-expanded="true"
│   의심 많음             │
│   ┌───────────────┐ │
│   │ 좋아함           │ │
│   │  ▲▲ 정직한 행동   │ │
│   │  ▲▲ 위험 회피     │ │
│   │  ▲  동료 보호     │ │
│   │  ▲  본인 이익 확보 │ │
│   │ 경계함           │ │
│   │  ▼▼▼ 기만 적발    │ │
│   │  ▼▼ 동료 배신     │ │
│   │  ▼  본인 이익 박탈 │ │
│   │  ▼  위험 감수     │ │
│   │ 최근 변화         │ │
│   │  ▲6 정직한 태도…  │ │
│   │  ▼4 위험 감수를…  │ │
│   └───────────────┘ │
│ ▶ 미라 궁수          45 │
│ ▶ 세렌 성직자        88 │
└────────────────────┘
```

`selectedMemberId`가 하나이므로 한 번에 한 명만 펼쳐진다. 같은 행을 다시 누르면
`clearSelectedMember()`로 접힌다.

사이드바는 `app/play/layout.tsx`에 있으므로 파티 소개·지도·조우·결과 네 화면
어디서든 동작한다. 조우 화면에서 카드를 고르기 직전에 상대의 성격을 확인하는
것이 이 기능의 주된 사용 흐름이다.

### 접근성

`Q2` 접근성 점검을 미리 지키는 기존 방침을 따른다.

- 펼침 버튼은 `aria-expanded`와 `aria-controls`를 가진다. 키보드로 동작한다.
- 강도 기호는 `aria-hidden`이고 스크린 리더에는 한국어 라벨이 읽힌다.
- 신뢰 변화의 `▲`/`▼`는 기존 `TrustRow`의 처리를 유지한다. 색만으로 방향을
  전달하지 않는다.
- 정체 발각은 기호와 텍스트를 함께 쓴다.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `lib/rules/personality-profile.ts` | 강도 구간, 정렬, 무반응 제외, 프로필 |
| `lib/rules/personality-profile.test.ts` | 구간 경계, 정렬 결정성, 성격 차이 |
| `lib/rules/trust-history.ts` | 로그에서 파티원별 최근 변화 추출 |
| `lib/rules/trust-history.test.ts` | 필터, 순서, 개수 제한 |
| `components/game/MemberDetail.tsx` | 펼침 내용 표시 |
| `lib/stores/game-store-provider.tsx` | `UiStoreProvider` export 추가 |
| `app/play/layout.tsx` | provider로 감싸고 props 둘 추가 |
| `components/game/PartySidebar.tsx` | `"use client"`, props 둘 |
| `components/game/TrustRow.tsx` | 요약 줄을 버튼으로 |

두 새 모듈은 `lib/rules/trust.ts`를 읽기만 하고 고치지 않는다. `R3` 정보 카드
판정이 같은 디렉터리에서 진행 중이므로 파일을 나눠 충돌을 피한다.

## 테스트

### 성격 프로필

- `abs(baseDelta) = 10`은 3단계, `9`는 2단계, `6`은 2단계, `5`는 1단계다.
- `baseDelta = 0`인 행동은 `likes`와 `guards` 어디에도 없다.
- 탐욕스러움과 정의로움의 프로필이 실제로 다르다.
- 의심 많음의 `likes`에 3단계가 없다.
- 같은 강도의 정렬이 결정적이다. 두 번 호출하면 같은 순서다.
- 모든 성격이 `likes`와 `guards`를 각각 하나 이상 가진다.
- 모든 `label`이 비어 있지 않다.

### 신뢰 변화 이력

- 다른 파티원의 변화를 섞지 않는다.
- 최신 기록이 먼저 온다.
- `limit`을 넘지 않는다.
- 해당 파티원의 기록이 없으면 빈 배열이다.
- 한 `DecisionRecord`에 같은 파티원의 변화가 여럿이면 모두 담는다.

### 발동 확인

검사를 만들면 발동을 확인한다는 기존 습관을 따른다. 일부러 셋을 깨뜨려 잡히는지
본다.

1. 상위 경계를 `10`에서 `12`로 되돌린다
2. `baseDelta = 0` 필터를 제거한다
3. 정렬을 뒤집는다

확인 후 되돌리고 `git diff --stat`으로 복원을 확인한다. 확인 내용을 커밋과 PR
본문에 적는다.

### 수동 확인

Vitest 환경이 `node`이고 `include`가 `**/*.test.ts`이므로 컴포넌트를 렌더링하는
테스트는 지금 쓸 수 없다. 다음은 `pnpm dev`로 확인하고 결과를 PR 본문에 적는다.

- 행을 누르면 `aria-expanded`가 바뀌고 상세가 펼쳐진다
- 다른 행을 누르면 이전 행이 접힌다
- 같은 행을 다시 누르면 접힌다
- 키보드만으로 펼치고 접을 수 있다
- 스크린 리더에 강도 라벨이 읽힌다

전체 검증은 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` 넷이다.

## 제외 범위

- **`app/play/page.tsx`의 파티원 카드 중복.** 사이드바와 정보가 겹치지만 파티
  소개 화면의 구성은 `U5` 온보딩의 판단 영역이다. 지금 손대면 작업이 겹친다.
- **런 데이터의 스토어 이전.** `P1`의 몫이다.
- **신뢰 구간 라벨과 게이지 막대.** 경계값이 확정되지 않았다.
- **낮은 신뢰 경고.** `R2`가 판정하는 신뢰 `0`만 표시한다.
- **`jsdom`과 컴포넌트 렌더링 테스트 도구 도입.** 별도 작업으로 남긴다.
- **파티원 선택에 따른 다른 화면의 반응.** `selectedMemberId`를 읽는 곳은
  사이드바뿐이다. `U2`가 필요하면 그때 읽는다.

## 후속 작업에 남기는 계약

- `P1`은 `UiStoreProvider` 바깥에 `RunStoreProvider`를 추가하고, `layout.tsx`가
  목 대신 스토어에서 런을 읽도록 바꾸면 된다. 컴포넌트는 고치지 않아도 된다.
- `U2`는 `useUiStore`로 `selectedMemberId`를 읽어 카드 패널과 파티 패널의 선택을
  맞출 수 있다.
- `U5`는 `PERSONALITY_PROFILES`를 온보딩에서 재사용할 수 있다.
- `Q2`는 강도 기호와 신뢰 변화가 색 외 단서를 이미 가진다고 전제할 수 있다.
