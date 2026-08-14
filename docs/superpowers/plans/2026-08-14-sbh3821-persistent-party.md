# C2 지속 파티 실행 계획

- 작성일: 2026-08-14
- 작성자: sbh3821
- 근거 spec: [지속 파티 설계](../specs/2026-08-14-sbh3821-persistent-party-design.md)
- 상위 plan: [게임 방향 개편 구현 계획](2026-08-13-sanghwan-yoo-game-direction-rework.md)의 **Task 4**

상위 plan의 Global Constraints에 따라 **실패 테스트를 먼저 작성하고 실행해
실패를 확인한 뒤** 구현한다.

## 단계

1. **실패 테스트 작성 (Task 4 Step 1)**
   - `lib/rules/party-lifecycle.test.ts`
   - 로컬 헬퍼 `clearWithTwoSurvivors`, `memberWithHp`, `uniqueClassIds`를
     테스트 파일 안에만 둔다. 제품 코드로 내보내지 않는다.
   - 캠페인 상태는 `lib/rules/fixtures.ts`의 `createFixtureCampaignState`에서
     만들고 필요한 필드만 교체한다. 미병합 `C1`에 의존하지 않는다.
   - spec의 테스트 목록 전부를 담는다: 유지·충원, 재편, 개인 상태 보존,
     회복, 오류와 불변성
2. **실패 확인 (Task 4 Step 2)**
   - Run: `pnpm test lib/rules/party-lifecycle.test.ts`
   - Expected: lifecycle 함수가 없어 실패한다.
3. **구현 (Task 4 Step 3)**
   - `lib/rules/party-lifecycle.ts`
   - `healNonParticipants`: `max(1, round(hp × 0.05))`, `maxHp` 상한,
     사망자·출전자 제외
   - `regroupSurvivors`: `sum_i min(c_i, k) >= 3k`로 최대 파티 수를 계산한
     뒤, 남은 인원이 많은 직업부터 채우고 같은 직업 후보는 기존 동료를
     우선한다. 동률은 `regroup` 스트림으로 고른다.
   - `maintainPartiesAfterExpedition`: spec의 7단계 순서를 그대로 따른다.
     출전자 명단은 `result`에서만 읽는다.
   - 충원·재편·대기가 일어나면 `CampaignState.log`에 추가 전용 기록을
     남긴다. `at`은 기존 `log.length`부터 이어간다.
   - 검증은 상태를 만들기 전에 실행하고 `RuleError`를 던진다.
4. **통과 확인 (Task 4 Step 4)**
   - Run: `pnpm test lib/rules/party-lifecycle.test.ts lib/rules/party.test.ts`
5. **배정표 갱신**
   - C2 담당 `sbh3821`, 상태 갱신, C3 선행에서 C2 제거 후 `pnpm test`
6. **전체 검증**
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

## 완료 기준

- 3명 생존 유지, 1~2명 충원, 자동 재편, 비출전 5% 회복 테스트 통과
- 재편이 만드는 완성 파티 수가 계산된 최대값과 같고 직업 중복이 없다
- 재편 전후로 인물의 HP·신뢰·골드·기억이 보존된다
- 같은 입력과 시드가 같은 결과를 재현한다
- 병합 전 검증 명령 넷 통과

## 이번 범위에서 제외하고 근거를 남기는 것

상위 plan Task 4의 Files에는 `lib/rules/party.ts`와 `lib/domain/campaign.ts`
수정이 적혀 있으나 다음 이유로 손대지 않는다. 나중에 누락으로 오해되지
않도록 여기에 남긴다.

| 파일 | 이유 |
| --- | --- |
| `lib/domain/campaign.ts` | `waitingMemberIds`가 이미 있어 필드 추가 없이 구현된다. 불필요한 계약 변경을 만들지 않는다 |
| `lib/rules/party.ts` | 단일 런 전용 `generateParty`이며 캠페인 파티 생명주기와 무관하다. 정리는 Task 8의 `RunState` 제거와 함께 한다 |

구현 중 실제로 수정이 필요해지면 그때 반영하고 이 표를 갱신한다.
