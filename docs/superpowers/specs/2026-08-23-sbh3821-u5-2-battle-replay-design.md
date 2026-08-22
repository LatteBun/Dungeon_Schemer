# U5-2 자동 전투 장면 재생 설계

## 문서 정보

- 작성자: sbh3821
- 작성 도구: Codex
- 작성일: 2026-08-23
- 대상 작업: `U5-2` 자동 전투 장면 연출의 Task 1~2
- 기준 브랜치: `main` (`49b9bc4`, PR #98·#99 병합 뒤)

## 1. 결정과 목표

U5 왼쪽 상단 장면 슬롯에 규칙 계층이 이미 계산한 자동 전투 결과를 순서대로
재생한다. 플레이어는 전투를 직접 조작하지 않으며, 앞서 내린 경로·조언·상인
선택이 누구의 공격과 피해, HP 감소, 사망으로 이어졌는지를 본다.

이번 작업은 두 Task만 구현한다.

1. 공통 `BattleResolution`을 화면용 replay timeline으로 바꾸는 순수 계약과
   전투 에셋 매핑을 만든다.
2. 정적 PNG와 Framer Motion으로 장면을 재생하고 `/u5-2-test`에서 실제 E3
   일반전과 보스 기록 fixture를 검증한다.

E4의 보스 정보 modifier 합산, 지연 신뢰 검증, 원정 승패 반영은 만들지 않는다.
오른쪽 파티 패널도 변경하지 않는다.

## 2. 상위 문서 범위 정합성

`CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`와 `UI_IMPLEMENTATION_GUIDE.md`는 U5-2의
정적 PNG + Framer Motion 결과 연출을 현재 범위로 둔다. 반면 가장 높은 우선순위의
`GAME_PRINCIPLES.md`와 이전 `SCREEN_LAYOUT.md`에는 자동 전투 애니메이션이 범위
밖이라는 오래된 문장이 남아 있다.

사용자가 2026-08-23에 U5-2 Task 1~2 진행을 명시적으로 승인했으므로 Task 1에서
공식 문서를 함께 정리한다.

- `GAME_PRINCIPLES.md`: 정적 PNG 기반 다섯 결과 표현은 포함하고 다프레임
  스프라이트·전용 이펙트·복잡한 카메라 연출만 범위 밖으로 좁힌다.
- `SCREEN_LAYOUT.md`: 왼쪽 상단 40% 장면 슬롯의 자동 전투 표현을 더 이상 범위
  밖으로 두지 않는다.
- `ONBOARDING_AND_INTERFACE.md`: `최종 아트 스타일과 애니메이션`은 후속 폴리시를
  뜻한다고 명확히 한다.

게임 규칙이나 전투 수치는 이 문서 정리로 바뀌지 않는다.

## 3. 선행 상태와 책임 경계

### 3.1 지금 사용할 수 있는 것

- U5 화면과 왼쪽 상단 40% 장면 슬롯은 PR #99로 `main`에 있다.
- E3 공통 `BattleEngine`은 `BattleResolution`과 `BattleActionRecord[]`를 만든다.
- `resolveMonsterEventBattle()`은 실제 일반 몬스터 전투 기록을 만든다.
- 캐릭터 live/dead PNG 20장과 세 테마의 몬스터·보스 PNG 27장이 있다.

### 3.2 아직 사용할 수 없는 것

E4는 `resolveBossBattle()` 어댑터까지 있으나 다음 완료 조건이 남아 있다.

- 보스 정보 기록의 파티원별 피해 modifier 합산과 상한
- 전투 뒤 help/harm·의심 기록의 신뢰 검증
- 최종 HP·승패의 `ExpeditionState` 반영

따라서 보스 장면은 Task 2에서 타입이 맞는 고정 `BattleResolution` fixture로만
보여준다. fixture는 시각 재생 계약을 검증할 뿐 E4 결과라고 주장하지 않는다.

## 4. 선택한 구조

```text
E3 일반전 BattleResolution ─┐
                            ├→ createU5BattleReplay()
E4 보스전 BattleResolution ─┘             │
                                          ▼
                             U5BattleReplay frames
                                          │
                                          ▼
                              U5BattleScene 표현
```

화면 컴포넌트가 `BattleResolution`을 직접 해석하지 않는다. 순수 replay adapter가
규칙 기록을 검증하고 표시 frame으로 바꾼 뒤 컴포넌트는 현재 frame만 그린다.

이 구조를 선택한 이유는 다음과 같다.

- E4가 완성돼도 같은 `BattleResolution` 경계 뒤에 연결할 수 있다.
- 피해·RNG·신뢰 계산이 React 컴포넌트에 들어갈 자리가 없다.
- 타이머 없이 timeline을 단위 테스트할 수 있다.
- 건너뛰기와 reduced motion이 같은 최종 frame을 사용한다.

컴포넌트가 `BattleResolution.actions`를 직접 순회하는 빠른 방식은 규칙 기록 검증,
HP snapshot, 애니메이션 상태가 한 파일에 섞이므로 사용하지 않는다. 전부 fixture로
만드는 방식도 실제 E3 연계를 증명하지 못하므로 사용하지 않는다.

## 5. Task 1: replay 계약과 에셋 매핑

### 5.1 파일 경계

```text
components/game/u5-battle-replay.ts
components/game/u5-battle-replay.test.ts
components/game/u5-battle-assets.ts
components/game/u5-battle-assets.test.ts
```

`u5-battle-replay.ts`는 React, DOM, 타이머, Framer Motion을 import하지 않는 순수
모듈이다. `u5-battle-assets.ts`는 공식 콘텐츠 ID와 정적 자산 경로만 연결하며
전투 출현 규칙을 소유하지 않는다.

### 5.2 입력과 출력

```ts
export interface U5BattleParticipantPresentation {
  readonly id: string;
  readonly name: string;
  readonly imageSrc: string;
}

export interface U5BattleReplayInput {
  readonly resolution: BattleResolution;
  readonly presentations: readonly U5BattleParticipantPresentation[];
}

export interface U5BattleReplayParticipant {
  readonly id: string;
  readonly side: "party" | "enemy";
  readonly name: string;
  readonly imageSrc: string;
  readonly maxHp: number;
  readonly initialHp: number;
  readonly finalHp: number;
}

export type U5BattleReplayPhase =
  | "idle"
  | "attack"
  | "impact"
  | "settle"
  | "complete";

export interface U5BattleReplayFrame {
  readonly phase: U5BattleReplayPhase;
  readonly actionIndex: number | null;
  readonly actorId: string | null;
  readonly targetId: string | null;
  readonly damage: number | null;
  readonly hpByParticipantId: Readonly<Record<string, number>>;
  readonly defeatedParticipantIds: readonly string[];
}

export interface U5BattleReplay {
  readonly participants: readonly U5BattleReplayParticipant[];
  readonly frames: readonly U5BattleReplayFrame[];
  readonly outcome: BattleResolution["status"];
  readonly termination: BattleResolution["termination"];
}

export function createU5BattleReplay(
  input: U5BattleReplayInput,
): U5BattleReplay;
```

파티 초상은 캐릭터별 안정적인 `imageSrc`를 외부에서 받는다. 캐릭터 ID를 해시해
`a`·`b`를 임의 선택하거나 컴포넌트에서 파일명을 조립하지 않는다. 이 경계는 현재
진행 중인 공용 파티 카드 작업이 portrait 계약을 확정해도 교체하기 쉽다.

몬스터와 보스는 `u5-battle-assets.ts`의 명시적 manifest에서 경로를 얻는다.
manifest는 세 테마의 잡몹 5종·보스 4종씩 총 27개를 빠짐없이 가진다.

### 5.3 frame 생성 규칙

초기 frame 하나와 action마다 세 frame, 마지막 complete frame 하나를 만든다.

```text
idle
→ action 0: attack → impact → settle
→ action 1: attack → impact → settle
→ ...
→ complete
```

- `attack`: 공격자 lunge를 시작한다. HP는 아직 바뀌지 않는다.
- `impact`: 대상 shake와 action record의 `damage` 숫자를 보여준다. HP는 아직
  `targetHpBefore`다.
- `settle`: HP를 action record의 `targetHpAfter`로 바꾸고 `defeated`를 반영한다.
- `complete`: `resolution.party`와 `resolution.enemies`의 최종 HP를 보여준다.

초기 HP는 각 참가자가 처음 target이 된 action의 `targetHpBefore`를 사용한다.
한 번도 target이 되지 않은 참가자는 resolution의 최종 HP와 초기 HP가 같다.
이는 피해를 다시 계산하는 것이 아니라 action record가 제공한 확정 전후 값을
시간 순 snapshot으로 옮기는 작업이다.

### 5.4 입력 검증

다음 기록은 표시하지 않고 명시적 오류로 거부한다.

- presentation 누락 또는 중복
- action의 알 수 없는 actor/target
- 이전 settle HP와 다음 action의 `targetHpBefore` 불일치
- `defeated` 뒤 같은 참가자가 다시 행동
- complete frame HP와 resolution 최종 HP 불일치

`damage`를 이용해 `targetHpAfter`를 다시 계산하지 않는다. UI 검증은 action record
사이의 연결과 최종 결과 일치만 확인한다.

## 6. Task 2: U5BattleScene과 테스트 프리뷰

### 6.1 파일 경계

```text
components/game/U5BattleScene.tsx
components/game/U5BattleScene.test.tsx
components/game/u5-battle-preview-data.ts
components/game/u5-battle-preview-data.test.ts
components/game/U5BattlePreview.tsx
app/u5-battle.css
app/u5-2-test/page.tsx
app/layout.tsx
components/game/U5ProgressScreen.tsx
package.json
pnpm-lock.yaml
```

`package.json`에는 Framer Motion 의존성을 추가한다. 새 전투 이미지나 기존 PNG
재가공은 하지 않는다.

`U5ProgressScreen`에는 optional `battleReplay` prop만 추가한다. 값이 없으면 기존
테마×종류 배경 장면을 그대로 렌더링한다. 값이 있으면 같은 `.u5-scene` 안에
`U5BattleScene`을 얹는다. 오른쪽 `rightPanel` JSX, 파티 카드, 파티 ViewModel은
변경하지 않는다.

### 6.2 장면 구성

```text
┌──────────────────── U5 왼쪽 상단 40% ────────────────────┐
│ [파티 1] [파티 2] [파티 3]       [적 1] [적 2 / 보스]    │
│ 이름 · HP bar                       이름 · HP bar          │
│                                                           │
│                 -12                                       │
│             현재 행동 설명                                │
│                                      [전투 건너뛰기]       │
└───────────────────────────────────────────────────────────┘
```

- 파티는 왼쪽, 적은 오른쪽에 둔다.
- 기존 테마×`monster|boss` 장면 이미지는 배경으로 유지한다.
- 캐릭터·몬스터 PNG는 `object-fit: contain`으로 비율을 왜곡하지 않는다.
- 공격 방향을 맞추는 반전이 필요하면 이미지 내부가 아니라 별도 orientation
  wrapper에 적용해 Framer Motion transform과 충돌하지 않게 한다.
- 참가자마다 이름과 숫자 HP를 함께 표시해 HP bar 색만으로 상태를 전달하지 않는다.
- 쓰러진 참가자는 불투명도와 `쓰러짐` 문구를 함께 사용한다.

### 6.3 모션 순서

한 action은 다음 순서를 지킨다.

```text
공격자 강조
→ Attack Lunge
→ Hit Shake + Damage Number
→ HP Bar settle
→ 원위치
```

Idle은 공격 중이 아닌 생존 참가자에게만 낮은 진폭으로 적용한다. 동시에 여러
action을 재생하지 않는다. 한 frame의 완료가 다음 frame 표시만 진행시키며 게임
상태를 확정하거나 callback으로 규칙을 실행하지 않는다.

기본 재생은 장면 진입 시 한 번 자동 시작한다. 재생 중 `전투 건너뛰기`는 즉시
complete frame으로 이동한다. 완료 뒤 `다시 보기`는 로컬 frame index만 0으로
되돌리며 전투 규칙을 다시 호출하지 않는다.

### 6.4 reduced motion과 접근성

- `prefers-reduced-motion`에서는 lunge·idle·shake의 공간 이동을 제거한다.
- action 순서, 행동 설명, 피해 숫자, HP 전후 상태는 유지한다.
- 현재 행동 한 문장만 `aria-live="polite"`로 알리고 모든 장식 효과를 개별
  live region으로 만들지 않는다.
- 건너뛰기와 다시 보기는 실제 `button`이며 `focus-visible`을 제공한다.
- 이미지 alt는 참가자 이름을 사용하고 배경은 장식으로 취급한다.

### 6.5 `/u5-2-test`

독립 프리뷰는 다음 두 상태를 제공한다.

1. **실제 E3 일반전**: 고정 seed와 실제 테마 사건·파티를
   `resolveMonsterEventBattle()`에 넣어 얻은 `BattleResolution` 전체를 재생한다.
2. **보스 기록 fixture**: E4 미완료를 명시한 타입 안전 fixture를 재생한다.

보스 fixture 생성에 `resolveBossBattle()`을 호출하지 않는다. E4 완료처럼 보이는
오해를 피하고 Task 2의 시각 계약만 검증한다.

프리뷰 선택기는 테스트 도구이며 실제 게임 조작으로 취급하지 않는다. 새로고침과
`다시 보기`에서 같은 record와 같은 순서가 나온다.

## 7. CSS와 고정 캔버스 계약

- 1920×1080 `.game-canvas` 전체 점유와 GameShell 60:40을 유지한다.
- U5 왼쪽은 기존 상단 장면 40%, 하단 콘솔 60%를 바꾸지 않는다.
- `rem`, `cqw`, `cqh`를 사용하고 `vw`, `vh`, `@media`를 추가하지 않는다.
- 기존 상단 상태 바와 오른쪽 패널 selector를 재정의하지 않는다.
- `app/u5-battle.css`는 `.u5-battle-*` namespace만 소유한다.
- 1920×1080, 2560×1440, 1440×900, 1280×1024에서 캔버스 배치와
  줄바꿈이 같고 스크롤·overflow가 없어야 한다.

## 8. 테스트 계약

### Task 1 자동 검증

- 동일 `BattleResolution`은 동일 replay를 만든다.
- action 하나가 정확히 `attack → impact → settle` 세 frame을 만든다.
- 피해 숫자와 HP 전후 값은 action record 값을 그대로 사용한다.
- 건너뛸 complete frame은 resolution 최종 HP와 일치한다.
- 잘못된 participant, 끊어진 HP chain, 사망 뒤 행동을 거부한다.
- 공식 테마의 몬스터·보스 27개가 manifest와 실제 PNG를 모두 갖는다.
- 캐릭터 portrait는 외부 presentation 없이는 임의 생성되지 않는다.

### Task 2 자동 검증

- `battleReplay`가 없으면 기존 U5 장면 DOM을 유지한다.
- `battleReplay`가 있으면 왼쪽 장면에 전투 참가자, HP, 현재 행동, 건너뛰기
  버튼을 렌더링한다.
- 오른쪽 파티 패널 markup은 이 작업으로 변경되지 않는다.
- 실제 E3 프리뷰는 비어 있지 않은 action record를 사용한다.
- 보스 프리뷰는 fixture임을 테스트 라벨과 코드 주석으로 명시한다.
- CSS에 `vw`, `vh`, `@media`와 공용 상태 바·오른쪽 패널 재정의가 없다.

### 최종 검증

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build --webpack
```

Chromium에서 두 프리뷰를 네 viewport로 확인한다. 이미지 로드 실패, hydration
오류, 스크롤, 장면·콘솔·오른쪽 패널 clipping이 없어야 한다. 자동 재생, 건너뛰기,
다시 보기, reduced motion을 확인한다.

## 9. 변경하지 않는 것

- `lib/`의 E2·E3·E4·BattleEngine과 도메인 타입
- E4 보스 정보 modifier·지연 신뢰·원정 승패 연결
- U5 오른쪽 파티 상태와 공용 파티 카드
- U5 조언·로그 콘솔의 구조와 동작
- U3·U4·U6 화면
- 기존 PNG 파일 내용과 이름
- 캠페인 상태 머신과 I2 실제 연결

## 10. 완료 조건

Task 1 완료 조건:

- 규칙 재계산 없는 replay adapter와 전투 에셋 manifest가 테스트를 통과한다.
- U5-2를 현재 범위로 승인한 공식 문서가 서로 모순되지 않는다.

Task 2 완료 조건:

- 실제 E3 일반전 record가 U5 왼쪽 장면 슬롯에서 다섯 기본 표현으로 재생된다.
- E4 없이도 보스 record fixture가 같은 컴포넌트에서 재생된다.
- 건너뛰기·다시 보기·reduced motion이 게임 결과를 바꾸지 않는다.
- 오른쪽 패널과 E4를 건드리지 않는다.
- 자동 검증과 네 viewport 브라우저 검증이 통과한다.

이 시점의 `U5-2`는 부분 완료다. E4 실제 보스 결과와 I2가 연결된 뒤에만 작업
배정표에서 전체 완료로 바꾼다.
