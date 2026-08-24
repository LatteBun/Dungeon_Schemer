# B1-B event candidate capacity repair report

- 작성 도구: Codex
- 범위: 승인된 B1-B 무결성 수리. 밸런스 상수, B1-B acceptance, 전략, 보고서 namespace는 변경하지 않았다.
- 근거: `integration-candidate-repair-brief.md`, `candidate-exhaustion-diagnosis.md`, E3 물질화 설계 4-5/14-1.

## 원인과 수정

`i2-run-3`의 `dungeon-graveyard-05` attempt 0에서, 실제 경로가 normal `monster`를 5번 요구했지만 활성 생태 뒤 normal monster EventId는 4개뿐이었다. `materializeNodeEvent`의 중복 금지와 후보 0개 거부는 올바르므로 변경하지 않았다.

`prepareExpeditionEvents`는 strong predecessor/follower의 실제 미래 역할까지 포함하여 모든 Entry→Boss 경로의 category/hidden-role별 요구량을 계산한다. 후보 풀이 모자라면 strong-link와 bossInfo 예약은 고정하고, 아직 역할이 없는 normal 노드의 공개 category만 기존 event RNG의 결정적 순서로 재배정한다. 어떤 단일 재배정도 deficit을 줄이지 못하면 `INVALID_GENERATION`으로 중단한다.

bossInfo는 prepare 입력에 target boss가 없으므로 테마의 보스별 후보 수 중 최솟값으로 보수 검증한다. 따라서 어느 보스의 후보 풀도 cut 수를 채우지 못하면 준비 단계에서 실패하며, 보스 정보의 target 계약은 그대로다.

## RED 증거

추가한 회귀 테스트:

`후보 용량을 넘기던 묘지 경로도 중복 EventId 없이 모두 물질화한다`

명령:

```text
pnpm vitest run lib/rules/expedition-events.test.ts --reporter=verbose
```

수정 전 결과:

```text
Test Files  1 failed (1)
Tests  1 failed | 11 passed (12)
RuleError: 방문 노드의 사용 가능한 사건이 없다
details: {
  nodeId: 'dungeon-graveyard-05:attempt:0:depth:8:node:0',
  category: 'monster',
  role: 'normal'
}
```

테스트는 진단 문서의 정확한 8개 방문 노드를 순서대로 물질화하고, 단서가 나오면 production과 같은 `activateStrongFollower`를 적용한다. 마지막으로 8개 EventId의 `Set` 크기가 8인지 검증한다.

## GREEN 및 검증 증거

```text
pnpm vitest run lib/rules/expedition-events.test.ts components/game/campaign-render.test.tsx --reporter=verbose
Test Files  2 passed (2)
Tests  19 passed (19)

pnpm typecheck
$ tsc --noEmit
exit 0

pnpm test
Test Files  109 passed (109)
Tests  1001 passed (1001)
Duration  47.76s
exit 0
```

## 변경 파일

- `lib/rules/expedition-events.ts`: 경로별 후보 용량 preflight와 결정적 normal category 보정.
- `lib/rules/expedition-events.test.ts`: `i2-run-3` 묘지 경로의 중복 없는 물질화 회귀.
- `.superpowers/sdd/2026-08-24-lattebun-b1-balance-redesign/candidate-repair-report.md`: 본 검증 보고서.

## 자체 검토와 경계

- `usedEventIds`와 `materializeNodeEvent`의 후보 0개 오류 계약은 바꾸지 않았다.
- 공개 뒤 category 변경, 방문 시점 fallback, EventId 사전 예약을 추가하지 않았다.
- strong predecessor/follower의 순서·단서 활성화와 bossInfo cut은 재배정 대상에서 제외했다.
- 활성 생태 필터 뒤 후보 수를 사용했고, 유효한 기존 plan은 보정 RNG를 소비하지 않아 기존 결정성을 유지한다.
- `docs/technical/BACKTEST_REPORT.md`의 기존 작업 트리 변경은 이 수리와 무관하여 수정하거나 stage하지 않는다.
