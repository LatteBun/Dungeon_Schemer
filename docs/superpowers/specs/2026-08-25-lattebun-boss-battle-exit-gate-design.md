# 보스전 정산 CTA 게이트 설계

## 문서 정보

- 작성자: LatteBun
- 작성 도구: Codex
- 작성일: 2026-08-25
- 대상: 보스전 재생 중 우측 하단 CTA와 정산 진입 게이트
- 기준 브랜치: `main` (`e831909`)

## 1. 목표

보스전 재생 중에는 정산으로 즉시 넘어갈 수 없게 하고, 일반 몬스터 전투와 같은 방식으로 우측 하단 CTA가 현재 재생 상태를 나타내게 한다.

완료 목표는 다음과 같다.

- 보스전 재생 중 우측 하단에는 `전투 건너뛰기`만 표시한다.
- 자연 재생 완료 또는 건너뛰기 뒤 같은 자리를 `정산으로`로 바꾼다.
- 완료 장면에서 `다시 보기`를 시작하면 `정산으로`를 다시 잠그고 `전투 건너뛰기`를 표시한다.
- 건너뛰기와 다시 보기는 이미 확정된 전투 기록의 로컬 재생 위치만 바꾸며 캠페인 상태를 변경하지 않는다.
- 일반 몬스터 전투와 비전투 사건의 기존 다음 단계 흐름을 보존한다.

## 2. 근거와 현재 문제

근거 문서는 다음과 같다.

- `docs/GAME_PRINCIPLES.md` — 전투는 직접 조작이 아니라 앞선 판단이 드러나는 결과 장면이다.
- `docs/design/CORE_GAME_LOOP.md` — 보스전은 누적 상태로 자동 해결되고 확인 뒤 정산으로 이어진다.
- `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md` — UI는 확정된 보스전 기록을 순차 재생하며 스킵 여부가 게임 상태를 바꾸지 않는다.
- `docs/experience/SCREEN_LAYOUT.md` — 진행 화면의 주요 CTA는 우측 하단 한 자리를 공유한다.
- `docs/experience/UI_IMPLEMENTATION_GUIDE.md` — 전투 replay의 complete frame과 다음 단계 이동을 연결한다.
- `docs/superpowers/specs/2026-08-25-lattebun-progress-screen-ux-design.md` — 일반 몬스터 전투의 `전투 건너뛰기 → 지도로 돌아간다` 상태 계약과 playback 소유권을 정의한다.

현재 `CampaignScreen`은 보스전 결과 화면에 `onAcknowledge`와 `정산으로` 문구를 즉시 전달한다. 현재 브랜치의 `U5ProgressScreen`은 replay 진행 상태를 모르고 이 콜백을 바로 우측 하단에 연결하며, `U5BattleScene`이 별도로 장면 안의 건너뛰기 버튼과 frame index를 소유한다. 따라서 보스전이 재생 중이어도 `정산으로`가 노출되고 실행될 수 있다.

일반전 CTA 개선의 기준 구현은 `94bdfa1`과 `de14133`에 있으나 현재 기준 브랜치에는 포함되지 않았다. 이 작업은 관련 없는 최신 변경을 일괄 병합하지 않고, 해당 playback 소유권과 exit gate 패턴을 현재 브랜치에 필요한 범위로 적용한다.

## 3. CTA 상태 계약

```text
replaying
  우측 하단: 전투 건너뛰기
  정산 진입: 불가
  ├─ 자연 재생 완료 ─────────┐
  └─ 전투 건너뛰기 ─────────┤
                              ▼
complete
  우측 하단: 정산으로
  정산 진입: 가능
  └─ 다시 보기 → replaying
```

우측 하단에는 동시에 하나의 주요 CTA만 둔다.

### 3.1 재생 중

- `정산으로` 대신 `전투 건너뛰기`를 표시한다.
- `전투 건너뛰기`는 replay의 마지막 complete frame으로 이동한다.
- 이 버튼에는 `COMPLETE_EXPEDITION` 또는 `onAcknowledge`를 연결하지 않는다.
- 장면 안에 같은 목적의 건너뛰기 버튼을 중복 표시하지 않는다.

### 3.2 완료 후

- 자연 종료와 건너뛰기는 같은 complete 상태에 도달한다.
- complete 상태에서만 우측 하단 CTA를 `정산으로`로 바꾸고 기존 `onAcknowledge`를 연결한다.
- 장면 안의 `다시 보기`는 유지한다.
- `다시 보기`가 frame index를 처음으로 되돌리면 우측 CTA도 즉시 `전투 건너뛰기`로 돌아가며 정산을 다시 잠근다.

## 4. 컴포넌트와 상태 소유권

```text
CampaignScreen
  └─ 보스전 결과에 명시적 after-playback 정책 지정
      └─ U5ProgressScreen
          ├─ playback controller: frame, isComplete, skip, replay
          ├─ U5BattleScene: 현재 frame 표현과 완료 후 다시 보기
          └─ RightPanel CTA: 재생 상태에 따른 단일 버튼
```

`U5ProgressScreen`이 replay frame index와 timer를 사용할 수 있도록 재생 제어를 별도 hook으로 분리한다. hook은 현재 frame, complete 여부, 마지막 frame으로 건너뛰기, 처음부터 다시 보기를 제공한다. replay 내용이 바뀌면 첫 frame으로 초기화하고, complete frame에서는 timer를 만들지 않으며 replay 변경 또는 unmount 때 기존 timer를 정리한다.

`U5BattleScene`은 전달받은 현재 frame을 표현하고 complete 상태에서 `다시 보기`를 알리는 역할만 맡는다. 다음 단계의 종류와 캠페인 전이는 알지 못한다.

`U5ProgressScreen`의 exit gate는 호출부가 명시적으로 지정한다. 정책이 활성이고 replay가 진행 중이면 우측 CTA는 건너뛰기이며, complete 뒤에는 원래의 `onAcknowledge`와 `acknowledgeLabel`을 복원한다. replay 존재 여부나 `정산으로` 문자열만으로 정책을 추론하지 않는다.

`CampaignScreen`은 다음 두 위치에 같은 정책을 명시한다.

- 실제 일반 몬스터 전투 결과: complete 뒤 `지도로 돌아간다`
- 실제 보스전 결과: complete 뒤 `정산으로`

비전투 사건과 replay가 없는 전멸 결과는 정책을 사용하지 않고 기존 확인 흐름을 유지한다.

독립 `/u5-2-test` 전투 프리뷰는 넘어갈 다음 단계 콜백이 없지만 재생을 조작할 수 있어야 한다. 프리뷰 호출부는 별도의 명시적 preview playback controls를 켜 재생 중 우측 하단 `전투 건너뛰기`와 complete 장면의 `다시 보기`를 유지한다. 실제 캠페인 exit 정책과 프리뷰 여부를 하나의 암묵 조건으로 합치지 않는다.

## 5. 데이터와 규칙 경계

- frame 이동은 브라우저의 로컬 표현 상태다.
- 건너뛰기는 replay의 마지막 frame을 선택할 뿐 BattleEngine, E3, E4, C4를 다시 호출하지 않는다.
- 자연 종료와 건너뛰기는 동일한 `BossResult`, HP, 신뢰, 생존자, 정산 snapshot을 사용한다.
- `정산으로`가 활성화된 뒤의 기존 `COMPLETE_EXPEDITION`과 snapshot 생성 계약은 변경하지 않는다.
- 전투 피해, HP, 신뢰, RNG, 보스 난이도, 정산 계산은 이번 변경 범위 밖이다.

## 6. 접근성과 경계 조건

- `전투 건너뛰기`, `정산으로`, `다시 보기`는 모두 실제 `button`을 사용한다.
- 우측 CTA가 전환될 때 보이는 문구와 accessible name이 함께 바뀐다.
- replay frame이 비어 있으면 건너뛰기 CTA를 만들지 않고 기존 다음 단계 CTA도 재생 완료로 간주하지 않는다.
- 연속 건너뛰기는 마지막 frame을 넘지 않으며 정산 콜백을 호출하지 않는다.
- 새 replay로 바뀌면 이전 replay의 complete 상태를 재사용하지 않는다.
- reduced motion 설정도 frame 진행과 CTA 게이트 의미는 바꾸지 않는다.

## 7. 테스트 계약

### 7.1 재생 제어 단위 테스트

- 같은 내용의 replay는 안정적인 signature를 가진다.
- replay 내용이 바뀌면 새 replay로 식별한다.
- 다음 frame 계산과 건너뛰기가 마지막 frame을 넘지 않는다.
- replay가 없거나 frame이 비어 있는 경계를 안전하게 처리한다.

### 7.2 진행 화면 상호작용 테스트

- 정책이 활성화된 보스전의 최초 CTA는 `전투 건너뛰기` 하나다.
- 재생 중 `정산으로`가 없고 정산 콜백도 호출되지 않는다.
- 건너뛰기 또는 자연 완료 뒤 CTA가 `정산으로`로 바뀐다.
- 완료 뒤 `정산으로`를 눌러야만 기존 콜백이 한 번 호출된다.
- `다시 보기` 뒤 CTA가 다시 `전투 건너뛰기`로 바뀐다.
- 정책이 없는 비전투 결과의 기존 CTA를 보존한다.
- 독립 전투 프리뷰도 재생 중 `전투 건너뛰기`와 완료 후 `다시 보기`를 계속 제공한다.

### 7.3 실제 캠페인 렌더·브라우저 검증

- 실제 보스전 직후 server render에는 `전투 건너뛰기`가 있고 `정산으로`가 없다.
- 실제 일반 몬스터 전투에서도 재생 중 지도 이동이 계속 잠긴다.
- 브라우저에서 보스전 `전투 건너뛰기 → 정산으로 → 다시 보기 → 전투 건너뛰기` 전환을 확인한다.
- `정산으로`를 누른 뒤 기존 정산 화면으로 정상 이동한다.

전체 검증은 관련 Vitest, Playwright 시나리오, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check`를 포함한다. 게임 수치를 바꾸지 않으므로 backtest는 실행하지 않는다.

## 8. 완료 조건

- 보스전 재생 중 `정산으로`가 노출되거나 실행되지 않는다.
- 보스전 재생 중 우측 하단에는 `전투 건너뛰기`만 있다.
- 자연 종료 또는 건너뛰기 후 같은 자리가 `정산으로`로 바뀐다.
- 다시 보기 동안 정산이 다시 잠긴다.
- 일반 몬스터 전투의 동일 CTA 계약과 비전투 흐름에 회귀가 없다.
- 전투 결과와 정산 규칙은 재생 방식과 무관하게 동일하다.

## 9. 변경하지 않는 것

- 전투와 정산의 domain/rules 계산
- 캠페인 phase와 action 종류
- 전투 속도와 frame 표현 순서
- 파티·보스 이미지와 CSS 시각 방향
- 비전투 사건 결과 확인 흐름
- 관련 없는 최신 브랜치 변경의 병합
