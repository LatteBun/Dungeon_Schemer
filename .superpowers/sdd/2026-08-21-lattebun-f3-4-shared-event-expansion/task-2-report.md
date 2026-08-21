# Task 2 보고서

## 변경 파일

- `lib/content/shared-event-builders.ts`: 기존 `advice`와 `sharedEvent` 계약을 공용 builder로 분리했다.
- `lib/content/shared-rest-events.ts`: Spec R01–R30의 휴식 사건 30개를 추가했다. 기존 5개 ID를 보존하고 신규 slug를 계획대로 사용했으며, 각 선택에 관찰 단서를 가리키는 고유한 고블린 대사를 명시했다.
- `lib/content/shared-events.ts`: 새 휴식 배열을 entry point에 연결하고 builder import를 사용하도록 갱신했다. merchant/special 데이터와 validator 의미는 변경하지 않았으며 legacy rest 블록을 제거했다.

## 검증

- `pnpm typecheck`: 통과
- `pnpm exec vitest run --config vitest.config.mts lib/content/shared-events.test.ts lib/content/situation-validation.test.ts --exclude '.worktrees/**'`: validator 테스트 46개 통과. 기존 수량 테스트 중 merchant/special/전체 3개는 후속 Task 3–4 데이터가 아직 없어 예상대로 실패(현재 merchant 5, special 5, 전체 40)했다.
- `git diff --check`: 통과
- 리뷰 수정 후에도 `pnpm typecheck`: 통과

## 우려/후속

- 현재 브랜치는 Task 2 단계이므로 merchant와 special이 각각 30개가 되기 전까지 전체 수량 assertion은 실패한다.
- merchant/special이 각각 30개가 되기 전까지 기존 수량 assertion 3개는 계속 실패한다.
