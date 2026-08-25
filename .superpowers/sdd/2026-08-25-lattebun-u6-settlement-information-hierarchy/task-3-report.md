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

## 리뷰 수정 1/5

- 사망한 신뢰 0 인물 회귀는 실제 화면 문구인 `정체 발각`과 `원정 출전 불가`가 모두 없음을 확인하도록 바꿔, 존재하지 않는 `이후 원정 출전 불가`를 검사하던 false-pass를 제거했다.
- 화면 단위 검증을 보강했다: ★5 위험도 상한과 상승 불가, 전멸 재도전 보상의 조건부 표시, 변화 없는 양수 신뢰 숨김, 결과→원인→원정대의 DOM 순서와 세 인물, 사망·중상 `<em>` 배지를 다룬다.
- RED/mutation 증거: `pnpm vitest run components/game/U6SettlementScreen.test.ts -t "위험도 상한"`에서 상한 문구를 일시적으로 `상한에 도달했다`로 바꾸자 1개 실패했고, `최대 위험도라 더 오르지 않는다` 기대가 실패 원인이었다. 즉시 원문을 복원했다.
- GREEN: `pnpm vitest run components/game/U6SettlementScreen.test.ts components/game/u6-settlement-model.test.ts components/game/campaign-render.test.tsx && pnpm typecheck` → 3 files, 45 tests 통과 및 `tsc --noEmit` 성공.
- 이번 수정은 화면 테스트와 보고서만 변경했다. Task 4 CSS/프리뷰 데이터와 Task 5의 `causeInputs` 원천 이전은 건드리지 않았다.
