# E2 용사 대상 정보 판정 실행 계획

- 작성일: 2026-08-15
- 작성자: sbh3821
- 근거 spec: [용사 대상 정보 판정](../specs/2026-08-15-sbh3821-party-info-evaluation-design.md)
- 상위 plan: [게임 방향 개편 구현 계획](2026-08-13-sanghwan-yoo-game-direction-rework.md)의 **Task 6** 중 정보 카드 부분

상위 plan의 Global Constraints에 따라 **실패 테스트를 먼저 작성하고 실행해
실패를 확인한 뒤** 구현한다. Task 6의 나머지인 `resolveEventChoice`와 사건 효과는
`E3`에서 한다.

## 단계

1. **계약 확장 (Task 6 Step 1 준비)**
   - `lib/domain/info.ts`에 `InfoReaction`, `InfoRecord`를 옮겨 담는다.
   - `lib/domain/expedition.ts`의 `ExpeditionState`에 `infoRecords`를 더한다.
   - `lib/rules/fixtures.ts`의 탐험 fixture를 새 필드에 맞춘다.
2. **실패 테스트 작성 (Task 6 Step 1)**
   - `lib/rules/info.test.ts`를 새 계약으로 다시 쓴다. 보스 수신 테스트는
     지우고 spec의 테스트 목록을 담는다.
   - 로컬 헬퍼 `bossTruthCard`, `party`, `cardRng`, `trustRng`,
     `acceptedBossTruthRecord`는 테스트 파일 안에만 둔다.
3. **실패 확인 (Task 6 Step 2)**
   - Run: `pnpm test lib/rules/info.test.ts`
   - Expected: `evaluatePartyInfoCard`·`createInfoOpportunity`가 없어 실패한다.
4. **구현 (Task 6 Step 3)**
   - `lib/rules/info.ts`
   - `evaluateInfoCard`를 `evaluatePartyInfoCard`로 바꾸고 보스 분기를 지운다.
   - `evaluateTrust`와 함께 인물 타입을 제네릭으로 바꾼다. 확률표와 성격 보정,
     신뢰 계산 규칙은 건드리지 않는다.
   - `createInfoOpportunity(node, rng, options)`: 보장 지점은 보스 주제만,
     일반 지점은 보스가 아닌 주제만, 진실·거짓·중립에서 한 장씩 뽑는다.
   - `bossDamageModifier(card, reaction)`: 보스 주제 수용만 값을 만든다.
   - `toInfoRecords(card, evaluation)`와 `applyInfoRecord(expedition, record)`.
5. **하네스 정리**
   - `lib/dev-tools/test-snapshots.ts`와 `app/info-card-test`에서 보스 수신
     선택을 지우고 파티 전용으로 줄인다.
6. **통과 확인 (Task 6 Step 4)**
   - Run: `pnpm test lib/rules/info.test.ts lib/rules/trust.test.ts lib/rules/map.test.ts lib/dev-tools`
7. **콘텐츠 공백 기록**
   - 중립 보스 카드가 없어 `-10%` 보정이 발생하지 않는 문제를 배정표에 남긴다.
8. **배정표 갱신**
   - E2 담당 `sbh3821`, 상태 갱신, `E3` 선행에서 E2 제거 후 `pnpm test`
9. **전체 검증**
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

## 완료 기준

- 살아 있는 파티원마다 독립 반응이 나오고 죽은 인물은 빠진다
- 보스 수신 계약이 코드에서 사라진다
- 보장 지점은 보스 카드만, 일반 지점은 보스가 아닌 카드만 제시한다
- 보스 주제 수용의 보정이 진실 -0.2, 중립 -0.1, 거짓 +0.25이고 그 밖은 0이다
- 등급별 경로에서 실제 전달된 보스 정보 수가 `E1`의 보장과 같다
- 같은 시드가 같은 반응을 재현한다
- 병합 전 검증 명령 넷 통과

## 이번 범위에서 제외하고 근거를 남기는 것

상위 plan Task 6의 Files에는 다음 파일 수정이 함께 적혀 있으나 `E3`에서 한다.
Task 6이 `E2`와 `E3`에 걸쳐 있기 때문이며, 나중에 누락으로 오해되지 않도록
여기에 남긴다.

| 파일 | 이유 |
| --- | --- |
| `lib/rules/event.ts`, `event.test.ts` | `resolveEventChoice`는 사건 행동이라 `E3`의 범위다 |
| `lib/content/items.ts` | 아이템 효과는 사건 행동에서 쓰이므로 `E3`에서 함께 본다 |
| `lib/content/events.ts` | 선택지 효과 계산이 `E3`이라 지금은 읽기만 한다 |
