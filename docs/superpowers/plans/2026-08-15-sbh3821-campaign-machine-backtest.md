# C4 캠페인 전이 함수와 백테스트 실행 계획

- 작성일: 2026-08-15
- 작성자: sbh3821
- 근거 spec: [캠페인 전이 함수와 10,000시드 백테스트](../specs/2026-08-15-sbh3821-campaign-machine-backtest-design.md)
- 상위 plan: [게임 방향 개편 구현 계획](2026-08-13-sanghwan-yoo-game-direction-rework.md)의 **Task 10**과 **Task 8** 중 전이 함수 부분

실패 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다. 세 덩어리를 순서대로 한다.

## 1단계 전이 함수

1. **실패 테스트 작성** — `lib/flow/campaign-machine.test.ts`
   - 허용 전이, 금지 전이, 없는 ID, 전멸 건너뛰기, 재현성, 끝까지 진행
2. **실패 확인** — Run: `pnpm test lib/flow/campaign-machine.test.ts`
3. **구현** — `lib/flow/campaign-machine.ts`
   - `CampaignAction` 유니온과 `CampaignMachineContext`
   - 검증을 상태 생성 전에 끝내 절반만 적용된 상태를 만들지 않는다
   - 난수는 `state.seed`와 안정된 식별자에서만 파생한다
4. **통과 확인** — Run: `pnpm test lib/flow`

## 2단계 기준 시나리오

5. **실패 테스트 작성** — `lib/backtest/campaign-simulator.test.ts`의 checkpoint
6. **구현** — `lib/backtest/fixtures.ts`
   - 난수 없이 정산만 순서대로 적용해 B 120 / A 274 / S 370을 재현한다

## 3단계 전략 시뮬레이터와 보고서

7. **실패 테스트 작성** — 세 전략 완주, 생성 오류 0건, 관찰 항목 존재
8. **구현** — `lib/backtest/campaign-simulator.ts`
   - `Strategy` 인터페이스와 `survivalFirst`·`balanced`·`wipeGoldFirst`
   - 전략은 `transitionCampaign` action만 호출한다
   - `simulateCampaign`, `runBacktest`
   - 밸런스 관찰 세 항목을 보고서에 담는다
9. **통과 확인과 성능 측정**
   - Run: `pnpm test lib/backtest`
   - 10,000시드 실행 시간을 재고 테스트 기본값을 정한다. 테스트가 느려지면
     시드 수를 줄이고 근거를 테스트 주석에 남긴다.

## 마무리

10. **밸런스 보고** — 관찰 세 건의 실제 수치를 배정표와 PR에 적는다
11. **배정표 갱신** — C4 담당 `sbh3821`, 상태 갱신, `I1` 선행에서 C4 제거
12. **전체 검증** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

## 완료 기준

- 게시판에서 엔딩까지 한 캠페인이 전이 함수만으로 진행된다
- 잘못된 전이가 상태를 바꾸지 않고 구조화 오류를 낸다
- 같은 시드와 같은 선택이 같은 최종 상태를 만든다
- `simulateFixture("baseline")`이 B 120 / A 274 / S 370을 정확히 재현한다
- 10,000시드에서 생성 오류와 진행 불가 시드가 0건이다
- 밸런스 관찰 세 항목의 수치가 보고서에 담긴다
- 병합 전 검증 명령 넷 통과

## 이번 범위에서 제외하고 근거를 남기는 것

상위 plan Task 8·10의 Files에 적힌 다음은 하지 않는다.

| 항목 | 이유 |
| --- | --- |
| `lib/stores/campaign-store.ts` | 화면이 쓰는 물건이라 `I1`이 만든다. 백테스트는 순수 전이만 쓴다 |
| `app/play` 소비자 이행 | `I1`·`U2`·`U3`의 범위다 |
| `run-machine.ts` 등 단일 런 코드 삭제 | 화면이 아직 쓰고 있다. 소비자를 옮긴 뒤 지워야 한다 |
| 개발용 화면의 `CampaignState` 이행 | 위와 같은 이유로 `I1`에서 함께 한다 |
