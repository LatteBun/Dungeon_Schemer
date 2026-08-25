# 전역 오디오·퀵 메뉴 설계

- 작성자: sbh3821
- 작성 도구: Codex
- 작성일: 2026-08-26
- 상태: 구현 전 승인 완료

## 1. 목적

Dungeon Schemer의 모든 화면에서 같은 BGM을 끊김 없이 듣고, 우측 상단의 작은
메뉴에서 BGM과 UI 효과음을 각각 켜고 끌 수 있게 한다. 같은 메뉴에서 업적 기록을
열되 진행 중인 캠페인을 잃지 않고 원래 화면으로 돌아올 수 있어야 한다.

이 기능은 플레이어의 게임 선택이나 캠페인 규칙을 바꾸지 않는다. 다크 판타지
길드의 분위기를 보강하고 메타 기능에 일관된 진입점을 제공하는 앱 공통 계층이다.

## 2. 확정 범위

### 포함

- 메인 메뉴와 모든 캠페인 화면 우측 상단의 전역 퀵 메뉴
- 한 곡의 공통 BGM
- 일반 UI 선택음과 메뉴·토글음
- BGM과 효과음의 독립 ON/OFF
- 둘 다 OFF인 최초 기본값
- 같은 브라우저에 오디오 설정 저장
- 현재 화면 위에 여는 업적 기록 오버레이
- 독립 `/achievements` 페이지의 `이전 화면으로` 동작

### 제외

- 화면·던전·전투·엔딩별 복수 BGM
- 업적 해금 효과음
- 음량 슬라이더와 세부 믹서
- 음원 스트리밍, 외부 CDN, 서버 저장, 계정 동기화
- 캠페인 Store의 새로고침·탭 종료 뒤 복원
- 전투 행동별 효과음과 캐릭터 음성

## 3. 핵심 결정

1. 오디오는 루트의 단일 Provider가 소유한다.
2. 한 BGM이 라우트 전환에도 재생 위치를 유지한다.
3. 최초 설정은 BGM·효과음 모두 OFF다.
4. 사용자가 BGM을 ON으로 바꾼 클릭이 최초 재생 제스처다.
5. 전역 메뉴의 업적 기록은 라우트 이동이 아니라 오버레이다.
6. 독립 업적 페이지도 `메인 메뉴로` 대신 `이전 화면으로`를 쓴다.
7. 캠페인 규칙과 상태는 오디오·메뉴 계층을 알지 않는다.

## 4. 앱 구조

루트 레이아웃의 `.game-canvas` 안쪽을 다음 구조로 만든다.

```text
game-canvas 1920×1080
└─ AppAudioProvider
   └─ AppFrame
      ├─ AppScreenSlot
      │  └─ 현재 route 화면
      ├─ GlobalQuickMenu
      └─ AchievementOverlay (열렸을 때만)
```

`AppFrame`이 단일 최상위 DOM 요소가 되어 현재의 고정 캔버스 전체 점유 계약을
유지한다. 실제 route 화면은 `AppScreenSlot`을 가득 채운다. 메뉴와 오버레이는
레이아웃 흐름을 밀지 않는 공통 chrome 층이다.

`AppAudioProvider`는 `app/layout.tsx` 아래에서 한 번만 만들어진다. 따라서
`/`에서 `/campaign`으로 이동하거나 캠페인 안에서 화면 단계가 바뀌어도 BGM
element가 다시 만들어지지 않는다.

## 5. 오디오 설정 계약

```ts
interface AudioSettingsV1 {
  readonly version: 1;
  readonly bgmEnabled: boolean;
  readonly sfxEnabled: boolean;
}
```

- 저장 키: `dungeon-schemer.audio-settings.v1`
- 초기값: `{ version: 1, bgmEnabled: false, sfxEnabled: false }`
- 저장 위치: `localStorage`
- 다른 브라우저·기기와 동기화하지 않는다.
- 업적 프로필 키와 캠페인 상태를 수정하지 않는다.

파싱할 수 없거나 정확한 V1 구조가 아닌 값은 둘 다 OFF인 빈 설정으로 복구한다.
미래 버전은 현재 코드가 덮어쓰지 않고 사용 불가 상태로 둔다. 저장소 접근이
거부되면 현재 탭의 메모리 설정으로 계속 동작한다.

Provider가 내보내는 UI 경계는 다음 책임만 가진다.

```ts
interface AppAudioState {
  readonly settings: AudioSettingsV1;
  readonly status: "loading" | "ready" | "recovered" | "unavailable";
  readonly message: string | null;
  toggleBgm(): void;
  toggleSfx(): void;
  playUiSound(kind: "select" | "menu"): void;
}
```

게임 domain·rules·campaign store는 이 타입을 import하지 않는다.

## 6. 재생 동작

### BGM

- `bgmEnabled === false`이면 재생하지 않고 현재 위치를 유지한다.
- OFF에서 ON으로 바꾼 실제 클릭 안에서 `audio.play()`를 호출한다.
- ON에서 OFF로 바꾸면 즉시 pause한다.
- route 전환은 재생을 멈추거나 처음으로 돌리지 않는다.
- 한 번 끝나면 이음새 없이 처음으로 돌아가는 `loop` 음원이다.
- 탭이 백그라운드로 가는 것만으로 설정을 바꾸지 않는다. 브라우저가 일시 정지하면
  다시 활성화됐을 때 ON 설정에 맞춰 재생을 재시도한다.

재생 promise가 거부되거나 음원 오류가 발생하면 BGM을 OFF로 되돌리고 메뉴에
`BGM을 재생할 수 없습니다.`를 표시한다. 게임 화면과 조작은 계속 사용할 수 있다.

### UI 효과음

공통 click 경계에서 활성화된 `button`, `a`와 명시적
`[data-ui-sound]` 대상을 한 번만 찾는다.

- 일반 버튼·링크: `select`
- 메뉴 버튼·스위치·업적 열기: `menu`
- `disabled`, `aria-disabled="true"`, `[data-ui-sound="none"]`: 재생하지 않음
- 중첩된 아이콘·텍스트를 눌러도 `closest()`로 한 대상만 처리
- 효과음 OFF → ON: 상태를 켠 뒤 `menu` 음을 미리듣기로 한 번 재생
- 효과음 ON → OFF: 상태를 끄기 직전에 `menu` 음을 한 번 재생

효과음 재생 실패는 화면을 막지 않는다. 효과음 설정을 OFF로 되돌려 저장하고, 같은
실패가 반복돼 콘솔과 UI를 도배하지 않도록 한 번 상태 메시지를 남긴 뒤 해당 탭에서
추가 재생을 생략한다.

## 7. 음원 자산

외부 음원과 런타임 네트워크 요청을 사용하지 않는다. 표준 Node.js만 쓰는 결정적
생성 스크립트가 고정 seed로 PCM WAV를 만든다. 생성 결과와 스크립트를 함께
커밋하여 자산의 출처와 재생산 방법을 남긴다.

| 파일 | 길이 | 채널 | 용도 |
| --- | ---: | --- | --- |
| `dungeon-schemer-guild-loop.wav` | 64초 | stereo | 공통 BGM |
| `ui-select.wav` | 0.12~0.18초 | mono | 일반 선택 |
| `ui-menu.wav` | 0.18~0.28초 | mono | 메뉴·토글 |

공통 sample rate는 22,050Hz, PCM은 signed 16-bit little-endian으로 한다. BGM은
60 BPM 16마디를 한 주기로 삼아 첫 sample과 마지막 감쇠가 자연스럽게 이어지게
만든다. 구성은 낮은 드론, 류트·덜시머를 연상시키는 짧은 pluck, 낮은 프레임 드럼,
약한 공간 잔향이다. 보컬과 선명한 전투 리듬, 주의를 빼앗는 고음 반복은 쓰지
않는다.

UI 선택음은 둔한 목재·양피지 감촉, 메뉴음은 짧은 금속 걸쇠 감촉으로 구별한다.
모든 파일은 peak를 -1dBFS 이하로 제한하고 DC offset과 끝단 click이 없어야 한다.

재생 기준 음량은 다음과 같다.

- BGM: `0.25`
- UI 효과음: `0.45`

이번 범위에서는 사용자가 이 값을 세분화하지 않는다.

## 8. 전역 퀵 메뉴

### 위치와 시각 언어

- 메인 메뉴와 모든 캠페인 화면의 우측 상단에 둔다.
- 1920×1080 캔버스 기준 상태 칩과 겹치지 않는 안전 여백을 둔다.
- 작은 검은 금속 길드 문장 버튼과 금색 테두리를 사용한다.
- 플랫 SaaS 톱니바퀴 모양과 화면을 가리는 큰 설정 모달은 쓰지 않는다.
- 패널은 버튼 바로 아래에 열리는 짧은 세로형 철제 패널이다.
- 크기는 `rem`, 캔버스 상대 위치는 `cqw`·`cqh`를 쓰며 `vw`·`vh`와 미디어
  쿼리는 추가하지 않는다.

### 항목

```text
[BGM        OFF]
[효과음     OFF]
[업적 기록     >]
```

스위치는 실제 `button`에 `role="switch"`, `aria-checked`를 제공한다. ON/OFF를
항상 텍스트로 적어 색에만 기대지 않는다.

메뉴 버튼은 `aria-expanded`, `aria-controls`를 가진다. 바깥 클릭과 `Escape`로
닫히며 닫힌 뒤 포커스는 메뉴 버튼으로 돌아간다. 메뉴가 열린 동안 Tab 이동은
패널의 세 항목과 닫기 가능한 경계 안에서 예측 가능해야 한다.

독립 `/achievements` 페이지에서는 전역 메뉴를 숨긴다. 업적 오버레이가 열린
동안에도 아래 화면의 전역 메뉴는 조작할 수 없다.

## 9. 업적 기록 오버레이와 복귀

### 전역 메뉴에서 열기

전역 메뉴의 `업적 기록`은 URL을 바꾸지 않고 `AchievementOverlay`를 연다. 현재
route 화면과 `/campaign`의 `CampaignStoreProvider`는 unmount되지 않는다.

오버레이는 기존 업적 카드, 달성 수, 초기화 확인을 그대로 재사용한다. 하단의
복귀 CTA만 `이전 화면으로`가 되고 누르면 오버레이를 닫는다. `Escape`도 같은
동작을 하며 포커스는 업적을 열었던 메뉴 버튼으로 돌아간다.

오버레이가 열리면 아래 앱 화면은 포커스와 포인터 입력에서 제외한다. 업적 기록의
초기화 dialog가 열렸을 때는 그 확인 dialog가 최상위 상호작용 대상이다.

### `/achievements` 직접 진입

독립 route는 북마크와 직접 접근을 위해 유지한다. 메인 메뉴의 큰 업적 CTA는
`/achievements?returnTo=/`로 연결한다. `returnTo`는 앱 내부의 `/`로 시작하고
`//`로 시작하지 않는 경로만 허용한다.

독립 화면의 `이전 화면으로`는 검증된 `returnTo`로 이동하고, 값이 없거나 안전하지
않으면 `/`로 이동한다. 외부 referrer나 `history.length`를 신뢰해 앱 밖으로
보내지 않는다.

## 10. 기존 컴포넌트 변경 경계

- `app/layout.tsx`: Provider와 AppFrame을 한 번 연결
- `components/game/AchievementScreen.tsx`: 카드 화면과 복귀 동작을 분리해 route와
  overlay가 공유
- `components/game/MainMenuScreen.tsx`: 독립 업적 CTA에 안전한 `returnTo` 추가
- 새 공통 audio settings/storage/controller: 게임 규칙과 분리
- 새 전역 메뉴·오버레이 컴포넌트와 전용 CSS
- `public/assets/audio/`: 생성된 WAV 세 파일
- `scripts/`: 결정적 음원 생성 스크립트

기존 `GameShell`, 각 U2~U6 화면과 캠페인 규칙의 props를 메뉴 때문에 늘리지
않는다. 공통 chrome은 화면 바깥에서 합성한다.

## 11. 오류와 경계 상황

- SSR에서는 OFF 자리와 같은 크기의 메뉴를 그린 뒤 hydration에서 저장 설정을
  읽어 layout shift를 만들지 않는다.
- 저장소 읽기·쓰기 예외는 메모리 fallback으로 처리한다.
- 손상된 설정은 업적 기록이나 캠페인 상태를 삭제하지 않는다.
- 오디오를 켠 상태로 새로고침해도 브라우저 정책상 사용자 입력 전에는 재생을
  강제하지 않는다. 메뉴에는 ON 설정을 보이되 `재생 대기`를 알 수 있게 한다.
- 오버레이를 연 동안 캠페인 phase와 화면 로컬 상태는 바꾸지 않는다.
- 업적 초기화는 오디오 설정을 지우지 않고, 오디오 초기화도 업적을 지우지 않는다.

## 12. 테스트 계약

### 순수 설정·저장

- 빈 저장소는 둘 다 OFF인 V1 반환
- 정상 V1 round trip
- 손상 JSON·구조 오류 복구
- 미래 버전 덮어쓰기 방지
- 읽기·쓰기 예외의 메모리 fallback
- 업적 저장 키와 오디오 저장 키 분리

### 오디오 controller

- BGM ON에서 play, OFF에서 pause
- route rerender 뒤 같은 재생 인스턴스 유지
- play rejection에서 OFF 복구와 단일 메시지
- 효과음 OFF에서는 무재생
- ON/OFF 전환 미리듣기 순서
- disabled와 제외 대상 무재생
- 중첩 click 한 번당 효과음 한 번

### React UI

- 메뉴 버튼의 `aria-expanded`와 패널 연결
- BGM·효과음 `role="switch"`와 ON/OFF 문구
- 바깥 클릭·Escape 닫기와 포커스 복귀
- 업적 오버레이가 현재 route를 바꾸지 않음
- 오버레이 닫기 뒤 아래 화면 유지
- 독립 업적 화면의 안전한 `returnTo`와 `/` fallback
- 업적 초기화 dialog 동작 회귀 없음

### 실제 브라우저

- 1920×1080, 2560×1440, 1440×900, 1280×1024에서 메뉴 위치와 레터박스
- 상태 바·CTA·dialog와 겹치지 않음
- `/` → `/campaign` 전환 중 BGM 지속
- 메뉴 → 업적 → 이전 화면에서 캠페인 상태 유지
- BGM loop 경계의 click·공백 없음
- WAV peak·duration·sample rate 검사
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`,
  `pnpm build --webpack`

## 13. 공식 문서 갱신

구현과 같은 변경 단위에서 다음을 갱신한다.

- `docs/experience/SCREEN_LAYOUT.md`: 공통 chrome과 우측 상단 안전 영역
- `docs/experience/ONBOARDING_AND_INTERFACE.md`: 메뉴·업적 오버레이 진입과 복귀
- `docs/technical/SESSION_PERSISTENCE_REVIEW.md`: 오디오 설정 V1 localStorage와
  캠페인 비영속 경계
- `docs/technical/DEVELOPMENT_ENVIRONMENT.md`: 오디오 생성 스크립트와 검증 방법
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`: 메타 오디오·퀵 메뉴 작업
- `docs/diagram/screens.md`: 메뉴가 열린 대표 캡처

`GAME_PRINCIPLES.md`의 캠페인 규칙과 프로토타입 고정 범위는 바꾸지 않는다.

## 14. 완료 조건

- 사용자 선택 전에는 소리가 나지 않는다.
- 사용자가 BGM과 효과음을 독립적으로 켜고 끌 수 있다.
- 설정이 같은 브라우저의 다음 방문에 유지된다.
- BGM이 앱 route 전환에도 처음부터 다시 시작하지 않는다.
- 전역 메뉴가 기존 화면의 상태 바와 주요 CTA를 가리지 않는다.
- 메뉴에서 업적 기록을 열고 닫아도 캠페인이 초기화되지 않는다.
- 업적 화면의 복귀 CTA가 `메인 메뉴로`가 아니라 `이전 화면으로`다.
- 음원 세 파일이 로컬에서 재생되고 생성 과정이 재현 가능하다.
- 자동·브라우저·음원 검증과 공식 문서 갱신이 모두 통과한다.
