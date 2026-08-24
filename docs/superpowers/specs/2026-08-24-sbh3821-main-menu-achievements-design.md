# 메인 메뉴·브라우저 업적 기록 설계

- 작성자: sbh3821
- 작성 도구: Codex
- 상태: 사용자 승인
- 기준 브랜치: `origin/main` (`670dff8`)

## 1. 목적

현재 `/`는 캠페인 개편 중이라는 자리 표시자이고, 실제 한 판은 `/campaign`에서
시작한다. 두 주소가 이어져 있지 않고 캠페인이 끝나도 이전 플레이의 성취가 다음
방문에 남지 않는다.

이 작업은 두 가지를 함께 만든다.

1. `/`를 게임의 메인 메뉴로 바꾸고 `캠페인 시작`과 `업적 기록`의 두 진입점을 둔다.
2. 엔딩에 도달한 캠페인의 최종 결과만 브라우저 프로필에 누적해 `/achievements`에서
   해금 업적과 누적 진행을 확인하게 한다.

업적 기록은 캠페인 상태 저장과 다른 기능이다. 진행 중인 캠페인을 새로고침 뒤에
복원하지 않고, 로그인·서버 동기화·기기 간 공유도 도입하지 않는다.

## 2. 현재 구현과 변경 경계

### 2.1 이미 있는 것

- `/campaign`은 `CampaignStoreProvider` 하나에서 한 판을 진행한다.
- `CampaignState.ending`은 엔딩 5종과 최종 등급을 확정한다.
- `CampaignState.statistics`는 원정·클리어·전멸·사망을 누적한다.
- `CampaignState.history`는 확정 이벤트와 조언 결과를 보관한다.
- U6에는 업적 문양 PNG 4종이 있으나, 현재는 엔딩 화면 장식이다.
- 브라우저 저장소 호출은 없으며 캠페인 Store는 탭 메모리에만 존재한다.

### 2.2 이 작업의 책임

- 정적 업적 카탈로그와 순수 판정 함수
- 버전이 있는 `PlayerProgress` 계약
- `localStorage` 읽기·검증·쓰기 어댑터
- 엔딩 결과를 정확히 한 번 기록하는 React 연결부
- 메인 메뉴와 업적 기록 화면
- 업적 문양 8종의 일관된 프레젠테이션
- 관련 공식 문서와 화면 흐름 갱신

### 2.3 범위 밖

- 진행 중 캠페인 저장·이어하기
- 서버 DB, Supabase, 로그인, 클라우드 동기화
- 여러 브라우저나 기기 사이의 기록 병합
- 캠페인 도중 실시간 업적 팝업
- 업적 보상으로 규칙 수치나 콘텐츠를 해금하는 메타 성장
- 과거 배포판의 저장 데이터 마이그레이션. 이번 버전이 최초 스키마다.

## 3. 채택한 접근

캠페인 Zustand Store에 `persist`를 붙이지 않고 별도 브라우저 프로필 계층을 둔다.

```text
CampaignState(ended)
        │ 최종 결과만 추출
        ▼
CompletedCampaignRecord
        │ 순수 누적·업적 판정
        ▼
PlayerProgress
        │ 직렬화 경계
        ▼
localStorage
```

캠페인 Store는 한 판의 권위 상태이고 `PlayerProgress`는 여러 판을 가로지르는
메타 기록이다. 둘을 나누면 업적 저장 실패가 캠페인 진행을 망치지 않고, 나중에
브라우저 저장소를 서버 저장으로 교체해도 규칙과 화면을 다시 만들 필요가 없다.

## 4. 데이터 계약

### 4.1 저장 키와 버전

```ts
const PLAYER_PROGRESS_STORAGE_KEY = "dungeon-schemer.player-progress.v1";
const PLAYER_PROGRESS_VERSION = 1 as const;
```

키 이름과 payload의 `version`을 모두 둔다. 키는 다른 로컬 데이터와 충돌하지 않게
하고, payload 버전은 읽은 값의 계약을 명시한다.

### 4.2 프로필

```ts
type AchievementId =
  | "first-record"
  | "dungeon-conqueror"
  | "s-rank-guide"
  | "everyone-returned"
  | "five-endings"
  | "hundred-advices"
  | "seasoned-expedition"
  | "death-in-the-plan";

interface AchievementUnlock {
  readonly unlockedAt: string; // ISO 8601, 최초 달성 시각
}

interface PlayerProgressTotals {
  readonly completedCampaigns: number;
  readonly expeditions: number;
  readonly clearedExpeditions: number;
  readonly wipedExpeditions: number;
  readonly deaths: number;
  readonly advices: number;
}

interface PlayerProgressV1 {
  readonly version: 1;
  readonly totals: PlayerProgressTotals;
  readonly endingCounts: Readonly<Record<EndingKind, number>>;
  readonly unlocked: Readonly<Partial<Record<AchievementId, AchievementUnlock>>>;
  /** 같은 엔딩 화면을 다시 그려도 한 판을 두 번 세지 않게 하는 원장이다. */
  readonly recordedRunIds: readonly string[];
}
```

`recordedRunIds`는 완료한 캠페인마다 UUID 하나를 남긴다. 프로토타입의 예상 플레이
횟수에서는 저장 크기가 문제가 되지 않으며, 오래된 ID를 버려 중복 가능성을 다시
여는 것보다 전부 보관하는 편이 안전하다.

### 4.3 한 판의 완료 기록

업적 계층은 전체 `CampaignState`를 저장하지 않는다. 엔딩에서 필요한 사실만
다음 값으로 추출한다.

```ts
interface CompletedCampaignRecord {
  readonly runId: string;
  readonly ending: EndingKind;
  readonly finalRank: GuideRank;
  readonly totalExpeditions: number;
  readonly clearedExpeditions: number;
  readonly wipedExpeditions: number;
  readonly deaths: number;
  readonly advices: number;
}
```

`advices`는 `CampaignHistory.events` 중 `ADVICE_RESOLVED`만 센다. U6 어댑터가
이미 같은 정의를 사용하므로 보스전이나 정산 이벤트가 조언 수에 섞이지 않는다.

## 5. 업적 카탈로그

업적 이름, 설명, 문턱, 잠금 상태 공개 여부, 문양은 하나의 정적 카탈로그가
소유한다. 화면이 ID별 조건을 다시 쓰지 않는다.

| ID | 표시명 | 종류 | 해금 조건 | 잠금 중 공개 |
| --- | --- | --- | --- | --- |
| `first-record` | 첫 기록 | 결과형 | 캠페인 1회 종료 | 공개 |
| `dungeon-conqueror` | 던전 정복자 | 결과형 | `completed` 엔딩 | 공개 |
| `s-rank-guide` | S급 길잡이 | 결과형 | S등급 `completed` 엔딩 | 공개 |
| `everyone-returned` | 모두 함께 돌아오다 | 결과형 | 사망자 0명으로 `completed` 엔딩 | 공개 |
| `five-endings` | 다섯 갈래의 결말 | 결과형·누적 | 엔딩 5종을 각각 1회 이상 경험 | 비공개 |
| `hundred-advices` | 백 번의 조언 | 누적형 | 누적 조언 100회 | 공개 |
| `seasoned-expedition` | 노련한 원정대 | 누적형 | 누적 원정 클리어 30회 | 공개 |
| `death-in-the-plan` | 죽음도 계획의 일부 | 누적형 | 누적 전멸 10회 | 공개 |

`five-endings`는 잠금 상태에서 이름과 조건 대신 `알 수 없는 기록`을 표시한다.
발견한 엔딩 수 같은 부분 진행도 노출하지 않아 숨은 엔딩의 총수와 종류를 화면이
추가로 설명하지 않는다. 다른 누적형은 현재 값과 목표 값을 함께 보여준다.

해금은 단조 증가한다. 이미 해금된 업적은 다시 판정 결과가 거짓이어도 잠기지 않고
`unlockedAt`도 최초 값에서 바뀌지 않는다.

## 6. 누적과 중복 방지

```ts
recordCompletedCampaign(
  current: PlayerProgressV1,
  record: CompletedCampaignRecord,
  unlockedAt: string,
): PlayerProgressV1
```

이 함수는 브라우저 API를 호출하지 않는 순수 함수다.

1. `runId`가 `recordedRunIds`에 있으면 현재 프로필을 그대로 반환한다.
2. 없으면 완료 캠페인 수, 엔딩별 횟수, 원정·클리어·전멸·사망·조언을 한 번 더한다.
3. 갱신된 전체 프로필로 카탈로그의 모든 조건을 평가한다.
4. 새 업적에만 전달받은 ISO 시각을 넣는다.
5. `runId`를 원장 끝에 붙인 새 불변 값을 반환한다.

캠페인 페이지가 마운트될 때 `crypto.randomUUID()`로 실행 ID 하나를 만들고 캠페인이
끝날 때까지 유지한다. 엔딩 화면 진입을 감지하는 effect가 완료 기록을 전달한다.
개발 환경의 Strict Mode effect 재실행, 부모 재렌더링, bfcache 복귀가 같은 UUID를
다시 보내더라도 순수 reducer가 두 번째 집계를 거부한다.

새로고침은 현재 캠페인 자체를 초기화하므로 새 실행 ID를 받는다. 같은 seed를 다시
플레이하는 것은 별도의 캠페인이며 정상적으로 한 번 더 집계한다.

## 7. 브라우저 저장 어댑터

저장 어댑터는 다음 네 결과를 구별한다.

```ts
type ProgressLoadResult =
  | { readonly status: "ready"; readonly progress: PlayerProgressV1 }
  | { readonly status: "empty"; readonly progress: PlayerProgressV1 }
  | { readonly status: "recovered"; readonly progress: PlayerProgressV1 }
  | { readonly status: "unavailable"; readonly progress: PlayerProgressV1 };
```

- 값이 없으면 빈 V1 프로필을 반환한다.
- JSON 문법이나 V1 무결성이 손상됐으면 빈 프로필로 복구하고 개발 경고를 남긴다.
- 알 수 없는 더 높은 버전은 조용히 덮어쓰지 않는다. 해당 탭에서는 빈 메모리
  프로필로 동작하되 저장을 `unavailable`로 두고 호환되지 않는 기록임을 알린다.
- `localStorage` 읽기·쓰기가 예외를 던지면 메모리 프로필로 계속 동작한다.

손상된 V1은 다음 정상 저장 직전에 원문을
`dungeon-schemer.player-progress.corrupt-backup`에 한 번 보관한 뒤 새 V1 값으로
교체한다. 백업조차 실패하면 게임과 메모리 업적은 계속 동작한다.

검증기는 모든 카운터가 0 이상의 안전한 정수인지, 엔딩 키가 정확한지,
`recordedRunIds`가 비어 있지 않은 고유 문자열인지, 업적 ID와 ISO 시각이 유효한지
확인한다. 손상 값을 부분적으로 믿어 합계를 섞지 않는다.

## 8. React 연결

### 8.1 `PlayerProgressProvider`

루트 `app/layout.tsx`의 `.game-canvas` 안쪽에 Client Provider를 둔다. Provider는
캠페인 Store와 별개이며 다음을 공급한다.

- 현재 `PlayerProgressV1`
- `loading | ready | recovered | unavailable` 저장 상태
- 완료 캠페인 기록 액션
- 확인을 거친 전체 기록 초기화 액션

서버 렌더에서는 빈 자리 크기를 먼저 그린 뒤 mount effect에서 `localStorage`를
읽는다. 메인 메뉴의 `달성 — / 8`이 `달성 N / 8`로 바뀌어도 버튼과 제목의 위치는
움직이지 않는다.

### 8.2 엔딩 기록 연결

캠페인 규칙과 U6 화면은 저장을 직접 호출하지 않는다. 작은
`CampaignCompletionRecorder`가 `campaign.phase === "ended"`와
`campaign.ending !== null`을 관찰하고 `CompletedCampaignRecord`를 만든다.

저장 실패는 캠페인 Store의 `rejected`가 아니다. 규칙 전이 실패와 로컬 브라우저
기능 실패를 같은 오류로 보여 주지 않는다.

## 9. 화면 설계

두 화면은 진행 중 캠페인의 일부가 아니므로 `GameShell`과 `TopStatusBar`를 쓰지
않고 승인된 전체 캔버스 화면으로 둔다. 최상위 요소는 `.game-canvas`의 1920×1080을
전부 점유한다.

### 9.1 메인 메뉴 `/`

- U2의 어두운 길드·던전 분위기와 배경 자산을 계승한다.
- 배경 위에 텍스트 가독성을 위한 암색 비네팅을 두되 표제와 CTA를 가리지 않는다.
- 중앙 상단에 `Dungeon Schemer`와 한 줄 소개를 둔다.
- 중앙 하단에 두 링크를 세로로 정렬한다.
  - 주요 금빛 CTA `캠페인 시작` → `/campaign`
  - 보조 금속·양피지 CTA `업적 기록` → `/achievements`
- 업적 CTA 안에 로딩 자리를 고정하고 준비 뒤 `달성 N / 8`을 표시한다.
- 두 항목은 실제 Next.js `Link`이며 버튼 안에 링크를 중첩하지 않는다.

### 9.2 업적 기록 `/achievements`

- 길드의 기록 보관소를 연상시키는 전체 캔버스 화면이다.
- 상단에 `길잡이 업적 기록`, `N / 8 달성`, 메인 메뉴 링크를 둔다.
- 본문은 4열×2행 카드다. 1920×1080 기준 한 화면 안에서 스크롤 없이 보인다.
- 결과형과 누적형은 카드 라벨과 금색 구분선으로 함께 구별한다.
- 해금 카드는 문양·이름·조건·최초 달성 날짜를 보여준다.
- 잠금 카드는 명암, 잠금 문양, `미달성` 텍스트를 함께 사용한다.
- 공개 누적형은 `현재 / 목표`와 진행 막대를 제공한다. `progressbar`에는
  `aria-valuemin`, `aria-valuemax`, `aria-valuenow`를 둔다.
- 숨은 업적은 해금 전 대체 이름과 대체 설명만 보인다.
- 하단의 `기록 초기화`는 즉시 삭제하지 않고 확인 dialog를 거친다.
- 저장 불가·복구 상태는 `role="status"` 안내로 알리되 페이지 사용을 막지 않는다.

### 9.3 문양

기존 U6 문양을 다음 네 업적에 재사용한다.

| 업적 | 기존 자산 |
| --- | --- |
| 첫 기록 | `achievement_guild.png` |
| 던전 정복자 | `achievement_conquest.png` |
| 모두 함께 돌아오다 | `achievement_together.png` |
| 다섯 갈래의 결말 | `achievement_return.png` |

나머지 네 업적은 같은 금속·양피지 재질, 정면 문장, 낮은 채도와 금빛 가장자리의
래스터 PNG를 만든다. 대상은 S급 문장, 펼친 지도와 흔적, 조언을 뜻하는 지도·깃펜,
전멸을 뜻하는 깨진 원정 문장이다. 기존 장면형 UI에 플랫 SVG나 SaaS 배지를
섞지 않는다.

새 자산은 `public/assets/achievements/`에 두고 실제 카드 슬롯 비율과 최대 표시
크기를 기준으로 제작한다. 기존 U6 자산은 이동하거나 복제하지 않고 manifest가
원래 경로를 참조한다.

## 10. 기록 초기화

초기화 dialog는 삭제 대상이 이 브라우저의 업적과 누적 통계 전부임을 명시한다.
취소가 기본 포커스이며, 확인해야만 저장 키와 손상 백업 키를 삭제하고 빈 프로필로
바꾼다. 캠페인 진행 상태에는 영향을 주지 않는다.

삭제는 되돌릴 수 없으므로 화면 안에서 한 번 더 확인하며, 앱이 임의로 저장 기록을
정리하거나 만료시키지 않는다.

## 11. 공식 문서 갱신

구현과 같은 변경 단위에서 다음을 갱신한다.

- `docs/GAME_PRINCIPLES.md`: 캠페인 이어하기·서버 저장은 범위 밖이지만 브라우저
  단위 업적 기록은 허용한다고 경계를 좁힌다.
- `docs/systems/PROGRESSION_AND_ENDINGS.md`: 엔딩 결과가 메타 업적 기록으로 전달되는
  책임과 업적이 규칙 보상을 주지 않는다는 점을 적는다.
- `docs/experience/SCREEN_LAYOUT.md`: 메인 메뉴와 업적 기록을 전체 캔버스 예외로
  추가하고 업적 4×2 구조를 기록한다.
- `docs/experience/ONBOARDING_AND_INTERFACE.md`: 메인 메뉴에서 캠페인과 기록으로
  갈리는 진입 흐름을 추가한다.
- `docs/technical/DEVELOPMENT_ENVIRONMENT.md`: 허용된 유일한 브라우저 영속 상태가
  버전 있는 업적 프로필임을 적는다.
- `docs/technical/SESSION_PERSISTENCE_REVIEW.md`: 캠페인 상태와 업적 프로필의 수명
  차이를 현재 구현 기준으로 갱신한다.
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`: 캠페인 개편 뒤 메타 화면·업적
  저장 작업의 책임과 완료 상태를 별도 항목으로 남긴다.
- `docs/diagram/screens.md`: 구현 캡처가 준비되면 메인 메뉴와 업적 화면을 대표
  화면 목록에 추가한다.

## 12. 검증 계약

### 12.1 순수 규칙

- 빈 V1 프로필 생성
- 8개 업적 각각의 경계값 직전·도달·초과
- S등급이지만 정상 완주가 아닌 경우 `s-rank-guide` 미해금
- 정상 완주지만 사망자가 있으면 `everyone-returned` 미해금
- 엔딩 5종의 마지막 종류가 들어오는 순간 `five-endings` 해금
- 누적 합산과 입력 불변성
- 같은 `runId`의 두 번째 기록 무시
- 최초 `unlockedAt` 보존

### 12.2 저장 어댑터

- 값 없음, 정상 V1, 문법 오류, 구조 오류, 중복 run ID, 알 수 없는 버전
- 읽기 예외와 쓰기 예외에서 메모리 fallback
- 손상 원문의 단일 백업과 정상 V1 교체
- 초기화가 기본 키와 백업 키만 지움

### 12.3 React·화면

- 엔딩 전에는 기록하지 않고 엔딩에서 한 번만 기록
- Strict Mode 재실행과 재렌더링에서 중복되지 않음
- `/`의 `/campaign`, `/achievements` 링크와 `N / 8` 요약
- 잠금·해금·숨김·누적 진행 카드
- 최초 달성 날짜와 저장 상태 안내
- 초기화 확인·취소·완료 흐름
- 실제 링크·dialog·progressbar의 접근성 이름과 키보드 포커스

### 12.4 전체 검증

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build --webpack`
- 1920×1080, 2560×1440, 1440×900, 1280×1024에서 레터박스·오버플로·
  줄바꿈·포커스 확인
- 업적 0개, 일부 해금, 8개 전부 해금, 저장 불가 상태의 브라우저 확인

## 13. 완료 기준

- 루트에서 실제 캠페인과 업적 기록 화면으로 이동할 수 있다.
- 엔딩에 도달한 한 판은 새로고침 없이 정확히 한 번 누적된다.
- 브라우저를 닫았다 다시 열어도 업적과 누적 통계가 복원된다.
- 진행 중 캠페인은 저장·복원되지 않는다.
- 저장소가 없거나 손상돼도 캠페인은 계속 플레이할 수 있다.
- 업적 화면이 8개 조건의 잠금·해금·진행 상태를 정확히 표시한다.
- 기존 캠페인 규칙과 U2~U6 화면의 판정 책임은 바뀌지 않는다.
