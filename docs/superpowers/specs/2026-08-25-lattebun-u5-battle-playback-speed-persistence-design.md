# U5 원정 단위 전투 재생 속도 유지 설계

- 작성자: LatteBun
- 작성 도구: Codex
- 작성일: 2026-08-25
- 상태: 사용자 방향 승인 완료, 서면 spec 검토 대기

## 1. 목적

플레이어가 전투 장면에서 `×2`를 선택하면 같은 원정의 다음 일반 몬스터전과 보스전에도 `×2`를 유지한다. 속도는 원정 세션의 편의 설정일 뿐이며, 전투 기록과 규칙 결과는 바꾸지 않는다.

## 2. 사용자 계약

- 새 원정은 항상 `×1`로 시작한다.
- 원정 중 어느 일반전 또는 보스전에서든 `×2`를 선택하면, 지도·사건을 거쳐 다음 전투로 넘어가도 `×2`를 유지한다.
- `×1`로 다시 누르면 이후 전투도 `×1`을 사용한다.
- 같은 전투의 `다시 보기`, `전투 건너뛰기`, 다른 replay signature 모두 현재 원정 속도를 유지한다.
- 원정 정산으로 넘어가 `ExpeditionScreens`가 unmount된 뒤 새 계약으로 원정을 시작하면 `×1`로 초기화한다.
- 브라우저 새로고침, 새 탭, 서버 저장·복원은 이 화면 로컬 preference를 보존하지 않으며 `×1`로 시작한다.
- U5-2 프리뷰에서 E3 일반전과 E4 보스전을 전환하는 것은 한 프리뷰 세션 안의 다음 전투로 취급해 선택한 속도를 유지한다.

## 3. 상태 경계와 데이터 흐름

속도 상태를 replay signature에 묶지 않는다. `useU5BattlePlayback`은 replay frame index와 timer만 맡고, 현재 속도를 입력으로 받는다.

~~~text
CampaignScreen
  └→ ExpeditionScreens (원정 mount 범위)
       └→ useU5BattlePlaybackRate: ×1 | ×2
            └→ U5ProgressScreen
                 ├→ useU5BattlePlayback(replay, playbackRate)
                 └→ U5BattleScene

U5BattlePreview (프리뷰 mount 범위)
  └→ useU5BattlePlaybackRate: ×1 | ×2
       └→ U5ProgressScreen
~~~

- `ExpeditionScreens`의 local state는 활성 원정의 지도·사건·일반전·보스전 child 교체 중 유지된다.
- 새 원정은 `ExpeditionScreens`를 새로 mount하므로 별도 reset action 없이 `×1`이 된다.
- `U5BattlePreview`는 selector 변경 중 mount를 유지하므로 현재 속도를 보존한다.
- Store, campaign domain, URL, localStorage, 저장 데이터에는 preference를 넣지 않는다.
- `U5ProgressScreen`은 속도의 소유자가 아니라 controlled props를 `useU5BattlePlayback`과 `U5BattleScene`으로 연결한다.

## 4. 구현 경계

### 재생 hook

`components/game/use-u5-battle-playback.ts`의 `U5BattlePlaybackState`는 signature와 frame index만 보관한다. speed 관련 타입과 `useU5BattlePlaybackRate()`는 이 파일에서 export하며, 다음 인터페이스를 제공한다.

~~~ts
export interface U5BattlePlaybackRateControl {
  readonly playbackRate: U5BattlePlaybackRate;
  readonly togglePlaybackRate: () => void;
}

export function useU5BattlePlaybackRate(): U5BattlePlaybackRateControl;
export function useU5BattlePlayback(
  replay: U5BattleReplay | undefined,
  playbackRate: U5BattlePlaybackRate,
): U5BattlePlayback;
~~~

signature 변경은 frame index만 0으로 되돌린다. timer는 전달받은 speed로 phase duration을 계산하고, speed 변경 시 현재 frame의 timeout을 새 duration으로 다시 예약한다.

### 화면

- `CampaignScreen.tsx`의 `ExpeditionScreens`가 `useU5BattlePlaybackRate()`를 한 번 호출하고 모든 `U5ProgressScreen` 호출에 같은 control을 전달한다.
- `U5BattlePreview.tsx`도 한 번 호출해 E3/E4 selector에 같은 control을 전달한다.
- `U5ProgressScreen.tsx`은 `playbackRate`와 `onTogglePlaybackRate`을 받아 playback hook과 battle scene에 전달한다.
- `U5BattleScene.tsx`, 버튼 문구, `aria-pressed`, animation speed 배율과 우측 하단 CTA 정책은 바꾸지 않는다.

## 5. 규칙 불변 조건

- E3/E4 replay, BattleEngine 결과, RNG, 피해, HP, 신뢰, 승패, 행동 순서는 바꾸지 않는다.
- speed preference는 원정 화면 메모리 안에만 있으며 campaign Store의 action·state·저장 계약을 바꾸지 않는다.
- 일반전·보스전의 `전투 건너뛰기`, `지도로 돌아간다`, `정산으로` gate는 현재 계약을 유지한다.
- `prefers-reduced-motion`과 고정 캔버스·접근성 계약을 유지한다.

## 6. 문서 반영

- `docs/experience/SCREEN_LAYOUT.md`의 다음 전투 `×1` 초기화 문구를 원정 종료·새 원정 초기화 문구로 바꾼다.
- `docs/experience/UI_IMPLEMENTATION_GUIDE.md`에 speed preference가 원정 화면 local state이며 replay 교체가 아닌 원정 종료에서 초기화됨을 기록한다.
- 게임 원칙과 domain 시스템은 바뀌지 않으므로 `docs/GAME_PRINCIPLES.md`와 시스템 규칙 문서는 수정하지 않는다.

## 7. 검증

1. 순수 playback state 테스트로 signature 교체가 frame index만 초기화하고 전달된 speed를 바꾸지 않음을 고정한다.
2. speed-control hook 또는 동등한 화면 상태 테스트로 기본 `×1`, toggle, component mount 초기화를 검사한다.
3. `CampaignScreen` 렌더 테스트로 일반전과 보스전 `U5ProgressScreen`이 한 원정 control을 공유하고 Store 상태를 확장하지 않음을 확인한다.
4. U5-2 Chromium에서 E3에서 `×2`를 선택하고 E4로 바꿔도 `×2`임을 확인한다.
5. 캠페인 Chromium에서 일반전 `×2` 선택 뒤 다음 전투와 보스전의 유지, 정산 뒤 새 원정의 `×1` 초기화를 확인한다.
6. 전체 unit test, Chromium E2E, typecheck, lint, production build를 실행한다.

## 8. 완료 조건

- 한 원정에서 선택한 `×1 / ×2`가 일반전과 보스전 사이에 유지된다.
- 새 원정과 새 브라우저 문서는 `×1`에서 시작한다.
- 전투 replay와 규칙 결과, Store 저장 계약, CTA gate는 변하지 않는다.
- 문서와 자동·브라우저 검증이 위 계약을 증명한다.
