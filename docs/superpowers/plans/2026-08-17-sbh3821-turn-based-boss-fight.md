# 턴제 보스전 실행 계획

- 작성일: 2026-08-17
- 작성자: sbh3821
- 근거 spec: [턴제 보스전](../specs/2026-08-17-sbh3821-turn-based-boss-fight-design.md)

실패 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다.

## 단계

1. **계약 확장**
   - `lib/domain/content.ts`: `BossDef.maxHp`, `ClassDef.attack`·`hitWeight`
   - `lib/content/bosses.ts`·`classes.ts`: 수치 채우기
   - `lib/rules/boss.ts`: `BossTurn`과 `BossResolution.turns`
2. **실패 테스트 작성** — `lib/rules/boss.test.ts`를 새 계약으로 다시 쓴다
   - spec의 테스트 목록 전부. 피격 가중치는 시드를 여러 개 돌려 분포로 본다
3. **실패 확인** — Run: `pnpm test lib/rules/boss.test.ts`
4. **구현** — 턴 루프, 가중치 대상 선택, 턴마다 정보 보정, 50턴 상한
5. **소비자 확인**
   - `campaign-machine.ts`의 `damageByMember`가 합계로 채워지는지
   - `settlement.ts`의 원인 사슬, `settlement-view-model.ts`, `app/u3-test`
6. **통과 확인** — Run: `pnpm test`
7. **백테스트 재실행** — `pnpm backtest`로 보고서를 다시 만들고 동봉한다
8. **전체 검증** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

## 완료 기준

- 파티가 먼저 치고 보스가 되받으며 보스가 죽은 턴에는 반격하지 않는다
- 피격 가중치가 높은 직업이 통계적으로 더 많이 맞는다
- 정보 보정이 맞을 때마다 적용되고 상한이 지켜진다
- 같은 입력과 시드가 같은 전투를 재현한다
- 백테스트 보고서를 다시 만들어 동봉한다
- 병합 전 검증 명령 넷 통과

## 회의록 대조

회의록이 정리되면 spec의 `회의록이 나오면 대조할 것` 표와 맞춰 보고, 다른 값이 있으면 **상수만 바꾸는 커밋**으로 고치고 백테스트를 다시 돌린다. 구조는 그대로 쓸 수 있게 수치를 콘텐츠 파일에 모아 둔다.

## 이번 범위에서 제외하고 근거를 남기는 것

| 항목 | 이유 |
| --- | --- |
| 밸런스 상수 조정 | 보고서를 먼저 남긴다. `B1`이 그랬듯 조정은 별도 커밋이다 |
| 파티원 방어력 | 조정할 상수가 배로 는다. 피격 가중치로 먼저 잰다 |
| 보스전 화면 갱신 | 턴 기록을 계약에 넣기만 한다. 화면 표현은 별도 작업이다 |
