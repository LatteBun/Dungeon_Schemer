# C3 정산·승급·엔딩 실행 계획

- 작성일: 2026-08-15
- 작성자: sbh3821
- 근거 spec: [정산·승급·엔딩](../specs/2026-08-15-sbh3821-settlement-promotion-ending-design.md)
- 상위 plan: [게임 방향 개편 구현 계획](2026-08-13-sanghwan-yoo-game-direction-rework.md)의 **Task 7** 중 정산·승급·엔딩 부분

상위 plan의 Global Constraints에 따라 **실패 테스트를 먼저 작성하고 실행해
실패를 확인한 뒤** 구현한다. Task 7의 보스전은 `E3`에서 끝냈다.

## 단계

1. **실패 테스트 작성**
   - `lib/rules/promotion.test.ts`에 `promote` 검사를 더한다
   - `lib/rules/settlement.test.ts`, `lib/rules/ending.test.ts`
   - spec의 테스트 목록 전부를 담는다
2. **실패 확인**
   - Run: `pnpm test lib/rules/settlement.test.ts lib/rules/ending.test.ts lib/rules/promotion.test.ts`
   - Expected: `settleExpedition`·`resolveEnding`·`promote`가 없어 실패한다
3. **승급 완성**
   - `lib/rules/promotion.ts`에 `promote(rank, score)`를 더한다
   - 조건을 만족하는 가장 높은 등급으로 올리고 강등하지 않는다
4. **엔딩 구현**
   - `lib/rules/ending.ts`
   - `distrust → expeditionComplete → supportUnavailable → partyExhausted` 순
   - 3·4위는 `C1`의 `createBoardEnding`을 그대로 쓴다
5. **정산 구현**
   - `lib/rules/settlement.ts`
   - 보상·손실 → 던전 → 승급 → 파티(`C2`) → 게시판 → 엔딩 순서
   - 각 단계마다 `SettlementStep`을 남긴다
6. **통과 확인**
   - Run: `pnpm test lib/rules`
7. **밸런스 발견 기록**
   - 명성 음수가 곧 `길잡이 자격 박탈`이 되는 절벽을 배정표 `C4` 항목에 남긴다
8. **배정표 갱신**
   - C3 담당 `sbh3821`, 상태 갱신, `C4`·`U3` 선행에서 C3 제거 후 `pnpm test`
9. **전체 검증**
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

## 완료 기준

- 생존 3·2·1명 보상이 100·60·30%이고 버림이 적용된다
- 전멸이 명성을 깎고 유품을 회수하며 던전 등급을 올린다
- 승급 checkpoint B 120, A 274, S 370이 정확히 재현되고 강등이 없다
- 네 엔딩이 우선순위대로 판정된다
- 정산 단계가 정해진 순서로 기록된다
- 병합 전 검증 명령 넷 통과

## 이번 범위에서 제외하고 근거를 남기는 것

| 항목 | 이유 |
| --- | --- |
| `transitionCampaign` 연결 | `Task 8`이 한다. `C3`은 순수 규칙까지다 |
| 정산 화면 | `U3`의 범위다 |
| 명성 하한 도입 | 문서가 `최솟값 제한 없음`으로 정했다. 바꾸려면 `C4` 보고서가 먼저다 |
