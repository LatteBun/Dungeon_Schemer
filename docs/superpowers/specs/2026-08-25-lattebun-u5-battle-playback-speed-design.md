# U5 전투 재생 2배속 설계

- 작성자: LatteBun
- 작성 도구: Codex
- 작성일: 2026-08-25
- 상태: 사용자 설계 승인 완료, 서면 spec 검토 대기

## 1. 목적

일반 몬스터 전투와 보스전의 자동 재생에 `×1 / ×2` 속도 토글을 제공한다.
플레이어가 긴 전투를 빠르게 확인할 수 있게 하되, 이미 확정된 전투 기록과 최종
게임 상태는 어떤 속도에서도 동일하게 유지한다.

## 2. 사용자 동작

- 모든 일반전과 보스전은 `×1`로 시작한다.
- 전투 장면 우측 상단의 속도 버튼을 누르면 `×1`과 `×2`가 전환된다.
- 현재 속도는 버튼의 보이는 문구로 표시한다.
- 같은 전투에서 `다시 보기`를 선택하면 현재 속도를 유지한다.
- 다른 전투 replay로 바뀌면 속도는 `×1`로 초기화한다.
- complete frame에서도 속도 버튼을 유지한다. 따라서 속도를 먼저 고르고
  `다시 보기`를 시작할 수 있다.

속도 버튼은 전투 장면 안의 로컬 재생 조작이다. 우측 패널 최하단의
`전투 건너뛰기`, `지도로 돌아간다`, `정산으로` CTA 자리를 사용하지 않는다.

## 3. 속도 계약

### 프레임 진행

기존 phase별 기본 대기 시간은 `×1`의 기준값으로 유지한다.

| phase | ×1 | ×2 |
| --- | ---: | ---: |
| `idle` | 500ms | 250ms |
| `attack` | 360ms | 180ms |
| `impact` | 420ms | 210ms |
| `settle` | 520ms | 260ms |
| `complete` | 0ms | 0ms |

`×2`는 기본 시간을 2로 나눈 값이다. 현재 frame에서 속도를 바꾸면 기존 timeout을
정리하고 같은 frame을 새 속도의 전체 대기 시간으로 다시 예약한다. 남은 시간을
비례 계산하는 별도 시계는 만들지 않는다.

### 장면 애니메이션

프레임만 빨리 바꾸고 공격·피격 animation을 그대로 두면 다음 frame이 기존
animation 도중 시작한다. 따라서 `×2`에서는 다음 유한 animation 시간을 함께
절반으로 줄인다.

- 공격 lunge와 복귀
- 피격 shake
- 쓰러짐 opacity 전환
- 피해 숫자와 보스 조언 cue의 등장·퇴장
- HP bar 변화
- idle 호흡 주기와 일반 위치 복귀

`prefers-reduced-motion`에서 이미 0인 duration은 그대로 0이다. 속도 변경은
reduced-motion 설정을 무시하거나 움직임을 새로 만들지 않는다.

## 4. 상태와 데이터 흐름

`useU5BattlePlayback`이 현재 replay signature, frame index와 함께
`playbackRate: 1 | 2`를 소유한다.

```text
U5BattleReplay
  → useU5BattlePlayback
      ├→ phase 기본 시간 / playbackRate → 다음 frame 예약
      ├→ playbackRate + togglePlaybackRate
      └→ frame + replayFromStart + skipToComplete
  → U5ProgressScreen
      └→ U5BattleScene
          ├→ 속도 토글
          └→ playbackRate를 반영한 장면 animation
```

- replay signature가 같으면 frame index와 속도를 유지한다.
- `replayFromStart`는 frame index만 0으로 바꾸고 속도는 유지한다.
- `skipToComplete`는 마지막 frame으로 이동하고 속도는 유지한다.
- replay signature가 바뀌면 frame index 0, 속도 `×1`로 시작한다.
- replay가 없거나 frame이 비어 있으면 속도 버튼을 렌더링하지 않는다.

속도 상태는 화면 로컬 상태다. Store, 캠페인 상태, 전투 결과, 저장 데이터에
추가하지 않는다.

## 5. UI와 접근성

`U5BattleScene`의 기존 우측 상단 control 영역을 재생 중에도 항상 렌더링한다.

- 재생 중: 속도 버튼만 표시한다.
- complete frame: 속도 버튼과 `다시 보기`를 함께 표시한다.
- 버튼의 보이는 문구는 현재 상태에 따라 `×1` 또는 `×2`다.
- 속도 버튼의 접근 가능한 이름은 `전투 재생 속도`다.
- `aria-pressed="true"`는 `×2`, `false`는 `×1`을 뜻한다.
- 기존 focus-visible, 금속 테두리, 고정 캔버스 단위를 재사용한다.
- `×2` 활성 상태는 색만으로 알리지 않고 문구와 `aria-pressed`로 함께 알린다.

새 이미지 에셋은 추가하지 않는다.

## 6. 일반전과 보스전 경계

일반전과 보스전은 모두 `U5ProgressScreen → useU5BattlePlayback →
U5BattleScene` 경로를 사용한다. 호출부에서 전투 종류별 속도 분기를 추가하지
않는다.

- 일반전의 `전투 건너뛰기 → 지도로 돌아간다` 게이트는 유지한다.
- 보스전의 `전투 건너뛰기/정산으로` 정책은 현재 별도 작업 범위를 유지한다.
- 속도 토글은 complete 판정이나 다음 단계 CTA 노출 조건을 바꾸지 않는다.
- 일반전과 보스전 모두 같은 속도 상태와 animation 배율을 사용한다.

## 7. 규칙 불변 조건

- BattleEngine, E3 일반전 결과와 E4 보스전 결과를 다시 계산하지 않는다.
- 새 RNG를 소비하지 않는다.
- 피해, HP, 신뢰, 승패, 행동 순서와 complete frame을 바꾸지 않는다.
- `×1`, `×2`, `전투 건너뛰기`는 모두 같은 최종 상태를 표시한다.
- 속도는 순차 재생 시간만 바꾸며 도메인 상태의 소유자가 되지 않는다.

## 8. 구현 경계

### 재생 상태

`components/game/use-u5-battle-playback.ts`에서 속도 타입, phase별 duration 계산,
토글과 replay 전환 초기화를 소유한다.

### 전투 장면

`components/game/U5BattleScene.tsx`는 현재 속도와 토글 callback을 받아 control을
표시하고 Framer Motion의 유한 duration에 속도 배율을 적용한다.

`app/u5-battle.css`는 HP bar transition과 control 그룹의 배치·활성 상태를
담당한다. 새 `vw`, `vh`, 미디어 쿼리를 추가하지 않는다.

### 진행 화면

`components/game/U5ProgressScreen.tsx`는 hook이 반환한 속도와 callback을
`U5BattleScene`에 전달한다. 일반전·보스전 판정이나 replay 데이터는 만들지 않는다.

## 9. 공식 문서 반영

- `docs/experience/SCREEN_LAYOUT.md`에 전투 장면 우측 상단의 `×1 / ×2` 토글,
  다시 보기 유지와 다음 전투 초기화를 기록한다.
- `docs/experience/UI_IMPLEMENTATION_GUIDE.md`에 frame duration과 장면 animation을
  함께 배율 적용하고 규칙 결과를 바꾸지 않는 구현 계약을 기록한다.
- `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`에는 이미 재생 속도가 최종 상태를
  바꾸지 않는 계약이 있으므로 수정하지 않는다.
- 게임 원칙과 전투 규칙은 바뀌지 않으므로 `docs/GAME_PRINCIPLES.md`는 수정하지
  않는다.

## 10. 검증

1. phase별 `×1 / ×2` duration과 complete 0ms를 순수 함수 테스트로 고정한다.
2. 같은 replay의 다시 보기는 속도를 유지하고, 다른 signature는 `×1`로
   초기화하는 상태 계약을 검사한다.
3. 전투 장면에서 속도 버튼이 재생 중·complete에 모두 있고, `×1 / ×2`,
   `aria-pressed`, 다시 보기 조합이 올바른지 검사한다.
4. 공격·피격·쓰러짐·idle·피해 숫자·cue와 HP bar duration이 속도 배율을
   소비하는지 검사한다.
5. 실제 일반전과 보스전 화면 모두 속도 control을 렌더링하며 기존 다음 단계
   CTA와 건너뛰기 계약을 바꾸지 않는지 검사한다.
6. Chromium에서 속도 버튼을 눌러 `×2` 상태, complete 도달, 다시 보기 속도
   유지와 다음 replay `×1` 초기화를 확인한다.
7. 전체 unit test, E2E, typecheck, lint와 production build를 실행한다.

## 11. 완료 조건

- 일반전과 보스전 모두 `×1 / ×2` 속도 토글을 제공한다.
- `×2`에서 frame 진행과 장면 animation이 함께 2배 빨라진다.
- 다시 보기는 현재 속도를 유지하고 다음 전투는 `×1`로 시작한다.
- 속도와 건너뛰기 여부가 전투 결과와 다음 단계 상태를 바꾸지 않는다.
- 관련 공식 문서, 자동 테스트와 실제 Chromium 검증이 구현과 일치한다.
