# 캠페인 복원 실패 안전장치 설계

- 작성자: sbh3821
- 작성 도구: Codex
- 작성일: 2026-08-26
- 상태: 검토 요청

## 배경

`/campaign`은 `dungeon-schemer.campaign-run.v1`의 시드와 성공한 액션을 처음부터
재생해 진행을 복원한다. 현재 저장 파서는 각 액션이 객체이고 문자열 `type`을
가졌는지만 확인한다. 액션 내부가 손상됐거나 규칙 구현이 예상하지 못한 런타임
예외를 내면 `replayRun` 밖으로 일반 예외가 빠져나간다.

Provider effect가 이 예외를 처리하지 않으므로 Next 오류 화면이 나타난다. 같은
저장이 남아 있어 Reload도 같은 자리에서 반복 실패한다. `?seed=...`가 저장 복원을
건너뛰었을 때 정상 진입하고 첫 액션이 기존 캠페인 저장을 덮어쓴 사실로 복원
경계가 실패 지점임을 확인했다.

## 목표

- 어떤 캠페인 저장도 `/campaign` 전체를 오류 화면으로 보내지 않는다.
- 복원할 수 없는 저장은 앞부분만 살리지 않고 새 캠페인으로 물러난다.
- 문제 원문과 실패 위치를 버그 분석용으로 한 건 보존한다.
- 업적 프로필과 오디오 설정은 복원 실패의 영향을 받지 않는다.
- 정상 저장의 결정적 replay와 명시적 `?seed=` 동작은 바꾸지 않는다.

## 비목표

- 모든 과거 액션 버전에 대한 마이그레이션
- `CampaignTransition` 전체를 중복 정의하는 런타임 스키마 도입
- 손상 보고서의 서버 자동 전송
- 여러 손상 원문의 무제한 누적
- 캠페인 앞부분만 복원하는 부분 복구

## 저장 계약

캠페인 진행 키는 기존과 같은 `dungeon-schemer.campaign-run.v1`을 쓴다. 복원할 수
없는 최신 원문 한 건은 다음 키에 저장한다.

```text
dungeon-schemer.campaign-run.corrupt-backup
```

백업 payload는 다음 정보를 가진 JSON이다.

```ts
interface CampaignRunCorruptBackup {
  readonly version: 1;
  readonly capturedAt: string;
  readonly reason: string;
  readonly failedAt: number | null;
  readonly raw: string;
}
```

- `failedAt`은 액션 replay 중 실패한 0 기반 위치이며, 파싱·읽기처럼 위치가 없으면
  `null`이다.
- 새 실패가 생기면 이전 캠페인 손상 백업을 최신 건으로 교체한다.
- 업적의 `dungeon-schemer.player-progress.corrupt-backup`과는 별개다.
- 업적 화면 저장 진단은 `dungeon-schemer.*` 키를 수집하므로 새 백업도 자동으로
  보고서에 포함된다.

## 복원 흐름

1. Provider는 캠페인 원문을 읽는다.
2. 저장이 비었으면 새 캠페인을 그대로 사용한다.
3. JSON 또는 최상위 구조가 쓸 수 없으면 원문이 있을 때 손상 백업을 시도하고
   캠페인 키 삭제를 시도한다.
4. 저장이 ready이면 모든 액션을 replay한다.
5. 규칙 거부와 예상하지 못한 예외를 모두 `failedAt`과 `reason`이 있는 실패 결과로
   바꾼다. 예외를 React effect로 다시 던지지 않는다.
6. replay 실패 원문을 백업하고 캠페인 키 삭제를 시도한다.
7. Provider가 이미 만든 새 무작위 캠페인을 유지한다.

백업 쓰기나 캠페인 삭제가 브라우저 정책 때문에 실패해도 예외를 UI로 전파하지
않는다. 현재 페이지는 새 캠페인으로 열린다. 삭제가 실패한 브라우저는 다음 reload에
같은 복원을 다시 시도할 수 있지만, 같은 안전 경계에서 다시 새 캠페인으로 물러나므로
오류 화면 반복에는 빠지지 않는다.

명시적 `?seed=...` 진입은 이전처럼 저장을 읽거나 격리하지 않는다. 재현 링크가
사용자의 기존 저장을 바꾸지 않는 계약을 유지한다.

## 오류 경계

`advanceRun`은 실시간 플레이의 프로그래밍 오류를 숨기지 않기 위해 기존처럼
`RuleError`가 아닌 예외를 다시 던진다. 저장 replay만 별도 신뢰 경계이므로
`replayRun`이 액션별 호출을 감싸 일반 예외를 실패 값으로 변환한다.

이렇게 하면 플레이 중 새 결함은 개발 단계에서 드러나고, 브라우저에 남은 비신뢰
입력만 앱 전체를 무너뜨리지 않는다.

## 보존 및 초기화 경계

자동 복원 실패가 변경할 수 있는 키는 다음 둘뿐이다.

- `dungeon-schemer.campaign-run.v1`
- `dungeon-schemer.campaign-run.corrupt-backup`

다음 값은 읽거나 삭제하지 않는다.

- `dungeon-schemer.player-progress.v1`
- `dungeon-schemer.player-progress.corrupt-backup`
- `dungeon-schemer.audio-settings.v1`
- 앱 밖 localStorage 키

업적 진단의 수동 `캠페인 초기화`는 기존처럼 진행 키만 지우고 캠페인 손상 백업은
보존한다.

## 테스트

- 내부 필드가 손상된 `START_EXPEDITION`이 일반 `TypeError`를 내도 `replayRun`은
  실패 값을 반환한다.
- 규칙 거부와 일반 예외 모두 정확한 `failedAt`을 남긴다.
- unusable 저장과 replay 실패 저장은 원문·이유·실패 위치를 백업하고 진행 키를
  제거한다.
- 백업 쓰기 또는 삭제가 실패해도 복원 함수는 던지지 않는다.
- 정상 저장은 기존 상태와 액션 기록으로 복원된다.
- `?seed=...`는 저장을 읽거나 변경하지 않는다.
- 자동 격리와 수동 캠페인 초기화 모두 업적·오디오·업적 손상 백업을 보존한다.
- `/campaign` 브라우저 회귀에서 손상 저장을 미리 넣어도 인트로가 보이고 Next 오류
  화면이 나타나지 않는다.

## 완료 기준

- 손상되거나 과거 형식인 캠페인 저장 때문에 `/campaign`이 오류 화면에 갇히지 않는다.
- 최신 손상 원문 한 건을 히든 저장 진단으로 복사할 수 있다.
- 정상 replay의 결정성과 다른 앱 저장의 보존 계약이 유지된다.
