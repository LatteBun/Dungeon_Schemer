# 최종 검토 중요 지적 수정 보고서

- 작업 브랜치: `codex/progress-screen-ux`
- 작업일: 2026-08-25
- 범위: 독립 `/u5-2-test` 전투 프리뷰의 재생 중 건너뛰기 회귀

## 원인과 범위 판단

`U5BattleScene`이 controlled component가 된 뒤, 장면 내부에는 complete 상태의 `다시 보기`만 남았다. `U5BattlePreview`는 `battleReplay`만 전달하고 일반 캠페인 전용 `battleExitPolicy="after-playback"`를 전달하지 않으므로, 재생 중 우측 CTA가 비었다.

spec 4.4에 따라 일반 캠페인의 지도 복귀 게이트는 `CampaignScreen`이 일반 몬스터 결과에만 명시적으로 지정하는 계약을 유지했다. 이번 수정은 `battleReplay` 존재나 CTA 문자열로 정책을 추론하지 않으며, 프리뷰에만 명시적으로 전달하는 `previewPlaybackControls` 경로로 skip 조작만 제공한다. 프리뷰에는 지도 이동 callback을 만들지 않는다.

## RED

먼저 `e2e/u5-battle-preview.spec.ts`에 실제 `/u5-2-test`에서 다음을 검증하는 회귀를 추가했다.

1. 재생 중 `전투 건너뛰기`를 누른다.
2. 완료 뒤 장면의 `다시 보기`를 누른다.
3. 재생 중 `전투 건너뛰기`가 다시 나타나고 `지도로 돌아간다`는 나타나지 않는다.

수정 전 Chromium 실행은 RED였다.

```text
locator.click: Test timeout of 30000ms exceeded.
waiting for getByRole('button', { name: '전투 건너뛰기' })
```

실패 시점의 페이지에는 complete frame의 `다시 보기`만 있고 `전투 건너뛰기`가 없었다. 따라서 테스트는 프리뷰의 누락된 재생 중 조작이라는 실제 결함을 재현했다.

## GREEN

- `U5ProgressScreen`에 기본값 `false`인 `previewPlaybackControls`를 추가했다.
- 이 값이 명시적으로 `true`이고 replay가 진행 중일 때만 기존 playback의 `skipToComplete()`를 우측 CTA에 연결했다.
- `U5BattlePreview`만 이 prop을 전달했다.
- 완료 후에는 프리뷰의 `onAcknowledge`가 없으므로 지도 CTA가 생기지 않고, 기존 장면 안 `다시 보기`가 playback을 처음으로 되돌린다.
- `battleExitPolicy="after-playback"`의 일반 몬스터 지도 이동 정책과 보스·비전투의 acknowledge 계약은 변경하지 않았다.

## 검증

| 명령 | 결과 |
| --- | --- |
| `pnpm exec playwright test e2e/u5-battle-preview.spec.ts --project=chromium` | PASS — 1/1, skip → replay → skip 및 지도 CTA 부재 |
| `pnpm exec vitest run components/game/U5BattleScene.test.tsx components/game/U5ProgressScreen.test.tsx components/game/u5-battle-preview-data.test.ts` | PASS — 3 files, 43 tests |
| `pnpm exec vitest run components/game/U5*.test.tsx components/game/u5-*.test.ts` | PASS — 9 files, 88 tests |
| `pnpm typecheck` | PASS |
| `git diff --check` | PASS — 출력 없음 |

`pnpm test -- components/...`도 한 번 시도했으나 Vitest의 인자 처리로 전체 저장소가 실행되어, 기존 `lib/backtest/campaign-driver.test.ts` 두 건이 각각 5초 timeout으로 실패했다(1,205 passed / 2 failed). 이 수정과 무관하며, 위의 직접 지정한 U5 범위 재실행은 모두 통과했다.

## 변경 파일

- `components/game/U5ProgressScreen.tsx` — 프리뷰 전용 명시적 playback CTA 경로
- `components/game/U5BattlePreview.tsx` — 프리뷰에서만 해당 경로 활성화
- `e2e/u5-battle-preview.spec.ts` — 실제 route skip/replay 회귀
- `.superpowers/sdd/2026-08-25-lattebun-progress-screen-ux/final-fix-report.md` — 본 보고서

새 자산, 의존성, 전투 규칙, 캠페인 phase 및 CampaignScreen의 일반전 exit 정책은 변경하지 않았다.

## 커밋

- 제목: `수정: 전투 프리뷰에 재생 중 건너뛰기를 복원한다`
- 본문: `독립 U5-2 프리뷰에만 명시적 재생 제어를 전달해 완료 전 건너뛰기와 완료 뒤 다시 보기를 모두 유지한다.`
