# E3 사건 행동과 자동 보스전 실행 계획

- 작성일: 2026-08-15
- 작성자: sbh3821
- 근거 spec: [사건 행동과 자동 보스전](../specs/2026-08-15-sbh3821-event-action-boss-fight-design.md)
- 상위 plan: [게임 방향 개편 구현 계획](2026-08-13-sanghwan-yoo-game-direction-rework.md)의 **Task 6** 사건 부분과 **Task 7** 보스전 부분

상위 plan의 Global Constraints에 따라 **실패 테스트를 먼저 작성하고 실행해
실패를 확인한 뒤** 구현한다. Task 7의 정산·승급·엔딩은 `C3`에서 한다.

## 단계

1. **효과 수치 콘텐츠 (Task 6 준비)**
   - `lib/content/effects.ts`: 분류 기본 HP, 태그 보정 HP, 등급 배율
   - `lib/domain/dungeon.ts`의 `EventChoice`에 `itemId`를 더한다. `trade`
     선택지가 어떤 상품을 사는지 가리킬 곳이 없다.
   - `lib/content/events.ts`의 선택지 27개에 spec의 표대로 태그를 붙이고
     거래 선택지에 `itemId`를 넣는다. 라벨과 이득·위험 문구는 건드리지 않는다.
2. **실패 테스트 작성 (Task 6~7 Step 1)**
   - `lib/rules/event.test.ts`, `lib/rules/boss.test.ts`
   - spec의 테스트 목록 전부를 담는다.
3. **실패 확인 (Step 2)**
   - Run: `pnpm test lib/rules/event.test.ts lib/rules/boss.test.ts`
   - Expected: `resolveEventChoice`·`resolveBossFight`가 없어 실패한다.
4. **사건 행동 구현 (Task 6 Step 3)**
   - `lib/rules/event.ts`
   - `hpDelta = round((분류 기본 + 행동 보정) × 등급 배율)`
   - 살아 있는 출전 파티원 전원에게 같은 변화를 적용하고 0 이하면 사망
   - `support`는 `protectAlly`, `sabotage`는 `betrayAlly`로 신뢰를 움직인다
   - 거래는 잔액을 먼저 확인하고 부족하면 `INSUFFICIENT_GOLD`를 던진 뒤
     아무것도 바꾸지 않는다
5. **보스전과 사후 검증 구현 (Task 7 Step 3)**
   - `lib/rules/boss.ts`
   - 파티원별 보스 주제 `modifier` 합산 후 `-0.3 ~ +0.5`로 자른다
   - `피해 = round(기본 피해 × (1 + 보정))`, 기본 피해에 한 번만 적용
   - 사후 검증: 수용한 거짓은 `deceptionExposed`, 의심은 카드가 거짓이면
     `suspicionWasCorrect`, 진실·중립이면 `suspicionWasCostly`
   - 죽은 파티원은 검증하지 않는다
6. **통과 확인 (Step 4)**
   - Run: `pnpm test lib/rules lib/content`
7. **후속 방향 기록**
   - 턴제 보스전을 배정표의 범위 밖 목록과 spec에 남긴다
8. **배정표 갱신**
   - E3 담당 `sbh3821`, 상태 갱신, `C3` 선행에서 E3 제거 후 `pnpm test`
9. **전체 검증**
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

## 완료 기준

- 분류 기본값과 행동 보정이 등급 배율까지 반영해 계산된다
- 관망도 분류 기본값만큼 HP를 바꾼다
- 잔액 부족 거래가 오류를 던지고 상태를 바꾸지 않는다
- 전원 사망이 전멸로 판정되고 남은 지점을 건너뛴다
- 보스 보정이 `-30%~+50%`로 잘리고 파티원마다 독립 적용된다
- 사후 검증이 세 가지 신뢰 행동으로 갈리고 죽은 사람은 제외된다
- 같은 입력과 시드가 같은 결과를 재현한다
- 병합 전 검증 명령 넷 통과

## 이번 범위에서 제외하고 근거를 남기는 것

| 항목 | 이유 |
| --- | --- |
| `lib/rules/settlement.ts`, `promotion.ts`, `ending.ts` | Task 7이지만 `C3`의 범위다 |
| 소지품 목록 | `ExpeditionState`에 자리가 없고 이번 결정 축이 아니다. 거래는 즉시 사용으로 처리한다 |
| `lib/content/items.ts` 수정 | 상품 데이터는 그대로 쓰고 가리키기만 한다. 가격·효과 태그를 바꿀 이유가 아직 없다 |
