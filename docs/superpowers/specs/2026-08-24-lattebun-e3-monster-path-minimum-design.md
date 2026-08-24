# E3 경로별 몬스터 최소 보장 설계

- 작성일: 2026-08-24
- 작성자: lattebun
- 작성 도구: Codex
- 대상 작업: `E3`, GitHub issue #117
- 기준 브랜치: `main`
- 기준 커밋: `b61fe96` (PR #149·#150 병합)

## 1. 문서의 지위

이 문서는 E3가 원정 지도 category를 준비할 때 실제로 선택 가능한 모든
입구→보스 경로에 필요한 몬스터 전투 기회를 보장하도록 바꾸는 설계다.

현재 공식 규칙은 네 category의 경로별 동시 보장을 요구하지 않는다. 이 때문에
★3 이상에서 보스 정보 `special` cut 두 개가 여러 노드를 차지하면, 플레이어가
고른 경로에 `monster`가 0~1개만 남을 수 있다. 그 결과 위험도는 전투 경험의
강도를 설명하지 못하고 U5 일반 몬스터 장면 수도 크게 흔들린다.

이 변경은 monster만 보장한다. `rest`, `merchant`, 일반 `special`의 횟수와 위치는
계속 시드 기반 다양성에 맡긴다. 보스 정보 cut, strong link, 실제 사건 물질화의
소유자는 계속 E3다.

## 2. 목표와 비목표

### 2.1 목표

- 모든 실제 선택 경로에서 현재 위험도별 최소 monster 수를 보장한다.
- ★1~2는 경로마다 `monster` 2개 이상, ★3~5는 3개 이상을 보장한다.
- 보스 정보 cut의 exact-once 계약과 strong link 계약을 바꾸지 않는다.
- 동일한 시드·던전·attempt·현재 위험도에서 동일한 category 예약을 재현한다.
- 사건 후보 수용량 부족이나 구조 불가능을 재추첨으로 숨기지 않고 명시적으로
  실패시킨다.

### 2.2 비목표

- `rest`, `merchant`, 일반 `special`의 경로별 최소 또는 최대 횟수를 새로 보장하지
  않는다.
- 지도 템플릿, 일반 Depth 수, 보스 정보 cut 수, strong link 수를 변경하지 않는다.
- 일반 몬스터의 전투 수치·콘텐츠·U5 표현을 조정하지 않는다.
- B1 밸런스 수치의 calibration을 이 변경 단위에서 수행하지 않는다.

## 3. 공식 규칙 변경

`docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`의 사건 분류 계약을 다음으로 바꾼다.

| 현재 위험도 | 모든 선택 경로의 최소 `monster` 수 |
| --- | ---: |
| ★1~2 | 2 |
| ★3~5 | 3 |

보스방은 일반 사건 수에 포함하지 않는다. 보스 정보 cut의 `special`은 이 보장을
대체하지 않는다. 이외 category는 남은 일반 노드에서 시드 RNG로 배정한다.

## 4. 생성 알고리즘

초기 설계는 monster 보호 슬롯을 먼저 고정하고 남은 노드만 후보 수용량 보정에
사용하려 했다. 실제 `CampaignDungeon` 3시드 × 15던전 × 두 attempt 회귀에서 이
순서가 `경로별 사건 후보 용량을 만족하는 정상 분류를 만들 수 없다`로 실패했다.
monster 하한을 만족하는 greedy 예약이 존재해도, 그 예약이 실제 사건 후보 풀과
양립하는 배정이라는 보장은 없기 때문이다.

따라서 `prepareExpeditionEvents`는 category를 순차 고정하지 않고, 경로 하한과 후보
수용량을 같은 전역 탐색의 제약으로 다룬다.

```text
보스 정보 special cut
→ strong link 역할·허용 category 확정
→ normal node category 후보 순서 생성
→ 경로별 monster 하한 + 사건 후보 수용량 동시 전역 배정
→ 최종 계약 검증
```

### 4.1 고정 역할과 category 후보

1. 기존 계산으로 보스 정보 cut과 그 `special` 노드를 먼저 확정한다.
2. strong link의 predecessor/follower 노드와 단서 ID를 기존 계약대로 확정한다.
   역할이 요구하는 사건 종류가 하나뿐이면 해당 category를 고정하고, 여러 종류를
   허용하면 그 집합만 후보로 둔다.
3. bossInfo와 strong-link 역할이 아닌 normal 노드는 네 category를 후보로 갖는다.
   현재 시드 RNG가 처음 고른 category를 첫 후보로 두고 나머지는 seeded 순서로 둔다.
4. E1 논리 DAG의 가능한 모든 입구→보스 경로를 안정된 NodeId 순서로 열거한다.

현재 지도는 모든 경로가 같은 일반 Depth 수를 지나고, ★1~2는 보스 정보 cut 1개,
★3~5는 2개만 갖는다. 따라서 위 최소치는 현 지도 계약 안에서 충족 가능해야 한다.
이 전제가 깨지는 새 템플릿은 테스트에서 즉시 드러난다.

### 4.2 동시 전역 배정

기존 `findDeterministicCapacityAssignment`의 완전 탐색 경계를 확장해 각 normal
node에 category를 하나씩 배정한다. 탐색은 다음 두 조건을 동시에 검사한다.

- **monster 가능성 pruning:** 부분 배정에서 어떤 경로의 현재 monster 수와 아직
  배정하지 않은 monster 가능 노드 수를 더해도 하한에 못 미치면 그 가지를 버린다.
- **사건 후보 가능성 pruning:** 기존 `categoryCapacityDeficit`의 partial 검사로 이미
  고정된 역할·category가 후보 풀을 넘으면 그 가지를 버린다.
- **완성 조건:** 모든 경로가 위험도별 monster 하한을 만족하고 전체 경로의 사건
  후보 수용량 deficit이 0이어야 한다.

첫 유효 배정을 채택한다. 후보와 node 순서가 결정적이므로 같은 입력은 같은 결과를
낸다. 완성 배정이 없으면 `RuleError("INVALID_GENERATION", ...)`으로 실패하며,
monster 하한을 낮추거나 새 RNG로 재시도하지 않는다.

## 5. 경계와 결정성

- 전역 탐색 자체는 RNG를 소비하지 않는다. 최초 category와 후보 순서는 기존 seeded
  RNG로 한 번 만들고, 탐색은 그 고정 순서를 따른다.
- `bossInfo` 역할, strong predecessor/follower 역할, 실제 방문 시 event ID 물질화는
  외부 API와 소유 경계를 유지한다.
- 최종 배정 후 모든 입구→보스 경로의 monster 수를 다시 검증한다. 내부 예약 또는
  뒤 단계 보정이 계약을 깨면 명시적 생성 오류다.

## 6. 테스트 계약

1. 모든 공식 던전, 여러 고정 시드, attempt 0과 1에서 가능한 모든 선택 경로를
   열거한다. 최종 category의 monster 수가 위험도별 하한을 만족해야 한다.
2. 동일한 입력으로 두 번 준비한 이벤트의 category·숨은 역할이 완전히 같아야 한다.
3. 기존 강한 연계와 category별 사건 후보 수용량 회귀를 유지한다.
4. 실제 `CampaignDungeon` 생태 프로필을 사용해 준비·경로별 물질화가 오류 없이
   끝나는 통합 회귀를 유지한다.
5. 새 테스트는 monster가 적은 기존 난수 사례와 ★3 이상 두 cut 사례를 명시적으로
   포함해, 단순 지도 총합이 아니라 각 경로 하한을 검증한다.

## 7. 영향 파일

- `lib/rules/expedition-events.ts`: 경로별 monster 가능성 pruning과 후보 수용량을
  결합한 결정적 category 전역 배정, 최종 검증
- `lib/rules/expedition-events.test.ts` 또는 책임이 분리된 E3 회귀 테스트: 경로별
  최소치·결정성·기존 계약 검증
- `lib/rules/campaign-profile-event-materialization.test.ts`: 실제 생태 프로필 통합
  회귀가 존재하는 경우 경로 monster 계약을 함께 검증
- `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`: 사건 분류의 경로별 monster 최소 보장
  공식화
- `docs/README.md`: 새 설계 및 구현 계획 링크 추가

## 8. 완료 기준

- 문서와 구현이 ★1~2의 경로당 monster 2개, ★3~5의 경로당 monster 3개를 같은
  의미로 사용한다.
- 어떤 실제 선택 경로도 보장 미만 monster로 끝나지 않는다.
- 동일 입력은 동일한 준비 결과를 내고, 보장·수용량·콘텐츠 불가능 상태를 RNG
  재시도로 숨기지 않는다.
- 기존 E3 사건 생성 및 실제 CampaignDungeon 프로필 회귀가 통과한다.
