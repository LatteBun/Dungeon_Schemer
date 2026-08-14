# E1 등급별 대칭 지도 실행 계획

- 작성일: 2026-08-15
- 작성자: sbh3821
- 근거 spec: [등급별 대칭 지도와 정보 기회 생성](../specs/2026-08-15-sbh3821-grade-map-generation-design.md)
- 상위 plan: [게임 방향 개편 구현 계획](2026-08-13-sanghwan-yoo-game-direction-rework.md)의 **Task 5**

상위 plan의 Global Constraints에 따라 **실패 테스트를 먼저 작성하고 실행해
실패를 확인한 뒤** 구현한다.

## 단계

1. **계약 확장 (Task 5 Step 1 준비)**
   - `lib/domain/expedition.ts`의 `MapPath`에 `bossRelatedInfoCount`를 더한다.
   - `lib/content/dungeons.ts`의 `CampaignGradeConfig`에 `branchLength`,
     `infoOpportunityCount`, `bossRelatedInfoCount`를 더한다.
   - `lib/rules/fixtures.ts`와 `lib/domain/expedition.test.ts`의 fixture 지도를
     새 필드에 맞춘다.
2. **실패 테스트 작성 (Task 5 Step 1)**
   - `lib/rules/map.test.ts`
   - spec의 테스트 목록 전부를 담는다.
   - 부족한 풀 fixture는 `map.test.ts` 안에만 두고 제품 코드로 내보내지 않는다.
3. **실패 확인 (Task 5 Step 2)**
   - Run: `pnpm test lib/rules/map.test.ts`
   - Expected: `generateGradeMap`이 없어 실패한다.
4. **구현 (Task 5 Step 3)**
   - `lib/rules/map.ts`
   - 지점 초안: 입구, 갈래 2개 × `L`, 합류, 보스
   - 정보 자리: 후보 `L+2`개에서 시드로 `L`개, 갈래 자리는 양쪽 대칭
   - 보스 보장 자리: 고른 정보 자리 중 시드로 `G`개
   - 분류 배치: 입구·합류에 서로 다른 두 분류, 각 갈래에 나머지 두 분류 필수,
     나머지 칸은 남은 풀 용량에서 시드로 채운다
   - 사건 배정: 분류별 대기열을 시드로 섞어 앞에서부터 소비한다
   - `lib/content/events.ts`에 분류별 위험 문구와 보스방 문구를 더한다
   - 생성 끝에 `validateGeneratedMap`을 호출해 스스로 검증한다
5. **통과 확인 (Task 5 Step 4)**
   - Run: `pnpm test lib/rules/map.test.ts lib/rules/dungeon.test.ts`
   - 다수 시드 불변식 테스트의 실행 시간을 재고, 기본 테스트 실행을 느리게 만들면
     시드 수를 줄인 근거를 spec이 아니라 테스트 주석에 남긴다.
6. **배정표 갱신**
   - E1 담당 `sbh3821`, 상태 `✅`, `E2`·`U2`의 선행에서 E1 제거 후 `pnpm test`
7. **전체 검증**
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

## 완료 기준

- 네 등급의 지점 수 7/9/11/13이 생성된다
- 두 실제 경로 모두 일반 사건 4/5/6/7, 정보 4등급 2/3/4/5, 보스 보장 1/1/2/2를
  만족한다
- 모든 경로에 네 사건 분류가 나오고 한 지도 안에서 사건이 중복되지 않는다
- 같은 시드가 같은 지도를 재현한다
- 부족한 풀과 손상된 지도가 `RuleError("INVALID_GENERATION")`을 낸다
- 병합 전 검증 명령 넷 통과

## 이번 범위에서 제외하고 근거를 남기는 것

상위 plan Task 5의 Files에는 `lib/domain/dungeon.ts`와 `lib/rules/dungeon.ts`
수정이 적혀 있으나 다음 이유로 손대지 않는다.

| 파일 | 이유 |
| --- | --- |
| `lib/domain/dungeon.ts` | `DungeonNode`·`DungeonState`는 단일 런 전용 타입이고 새 지도는 `GeneratedMap`을 쓴다. `EventKind`·`DungeonEvent`는 그대로 재사용하므로 바꿀 것이 없다 |
| `lib/rules/dungeon.ts` | `generateDungeon`은 등급을 모르는 단일 런 생성기다. 지금 지우면 `/play` 흐름과 개발용 화면이 함께 깨진다. 제거는 Task 10의 `RunState` 정리와 함께 한다 |

대신 상위 plan이 Step 5 커밋 목록에만 적어 둔 `lib/content/dungeons.ts`를
수정한다. 등급별 갈래 길이와 정보·보스 보장 수를 둘 곳이 여기뿐이다.
