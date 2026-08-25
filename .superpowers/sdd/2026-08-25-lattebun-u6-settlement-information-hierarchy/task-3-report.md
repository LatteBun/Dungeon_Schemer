# Task 3 보고서: 정산 화면 정보 위계

## 상태

완료. 정산 화면은 `outcome`, `causes`, `members`, `dungeonOutcome`, `trustPressure`만 소비하도록 전환했고, 고정 5단계 View 필드와 `다녀온 사람` DOM을 제거했다.

## RED / GREEN 증거

- RED: `pnpm vitest run components/game/U6SettlementScreen.test.ts` → 6개 실패. 새 fixture에 `causeChain`이 없어 기존 `CauseChain`의 `settlement.causeChain.map`에서 실패했다.
- GREEN: `pnpm vitest run components/game/U6SettlementScreen.test.ts components/game/u6-settlement-model.test.ts components/game/u6-preview-data.test.ts components/game/campaign-render.test.tsx` → 4 files, 48 tests 통과.
- 전체: `pnpm test` → 128 files, 1405 tests 통과.
- 타입: `pnpm typecheck` → `tsc --noEmit` 성공.
- lint: `pnpm lint`는 기존 `components/game/ScreenFit.tsx:118`의 `react-hooks/set-state-in-effect` 오류 1개와 기존 경고로 실패했다. 이번 변경에서 새 lint 오류는 없었다.

## 변경 파일

- `components/game/U6SettlementScreen.tsx`: 결과·원인 요약·원정대 결과·던전/자원/신뢰 누적 DOM을 새 View 계약으로 렌더링한다.
- `components/game/U6SettlementScreen.test.ts`: 실제 3인 fixture와 정복, 신뢰 0, 사망, 전멸 자원 분리 회귀를 검증한다.
- `components/game/u6-settlement-model.ts`, `components/game/u6-settlement-model.test.ts`: `CAUSE_ORDER`, 단계 타입, legacy View 필드를 제거하고 union 결과를 검증한다.
- `components/game/u6-preview-data.test.ts`: 삭제된 View 직접 참조만 `outcome`/`dungeonOutcome`으로 이전했다. 프리뷰 데이터와 Task 4 상태별 검증은 변경하지 않았다.
- `components/game/campaign-render.test.tsx`: 제거된 피해 원인 카드 기대를 실제 인물별 HP/사망 결과 기대로 이전했다.

## 자체 검토

- 화면과 화면 fixture에서 legacy View 필드 참조가 없음을 확인했다.
- `causeChain`은 Task 5에서 `causeInputs`로 교체할 도메인 원천으로만 남겼고, 이번 화면 DOM에는 남기지 않았다.
- CSS와 프리뷰 데이터 생성은 Task 4 범위를 침범하지 않았다.

## 우려 사항

- Task 4가 새 class의 시각 배치 및 프리뷰의 추가 상태 검증을 맡는다.
- lint의 기존 `ScreenFit.tsx:118` 오류는 범위 밖으로 유지했다.
