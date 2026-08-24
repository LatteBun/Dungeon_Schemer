# E3 경로별 몬스터 최소 보장 설계

- 작성일: 2026-08-24
- 작성자: lattebun
- 작성 도구: Codex
- 대상 작업: `E3`, GitHub issue #117
- 기준 브랜치: `main`
- 기준 커밋: `109e626` (PR #148 병합)

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

`prepareExpeditionEvents`는 다음 우선순위로 category 역할을 정한다.

```text
보스 정보 special cut
→ 경로별 monster 최소치 예약
→ strong link 및 사건 후보 수용량 보정
→ 남은 노드의 기존 시드 RNG category
```

### 4.1 monster 예약

1. 기존 계산으로 보스 정보 cut과 그 `special` 노드를 먼저 확정한다.
2. cut을 제외한 일반 노드와 E1 논리 DAG에서 가능한 모든 입구→보스 경로를 얻는다.
3. 각 경로의 예약 monster 수가 해당 위험도 최소치에 도달할 때까지 반복한다.
4. 아직 부족한 경로를 가장 많이 통과하는 일반 노드를 하나 고른다. 동률은
   안정된 노드 ID 순서로 푼다. 선택한 노드를 `monster` 보호 슬롯으로 예약한다.
5. 어떤 후보 노드도 부족 경로를 늘릴 수 없으면
   `RuleError("INVALID_GENERATION", ...)`으로 실패한다. 재추첨하거나 보장값을
   낮추지 않는다.

현재 지도는 모든 경로가 같은 일반 Depth 수를 지나고, ★1~2는 보스 정보 cut 1개,
★3~5는 2개만 갖는다. 따라서 위 최소치는 현 지도 계약 안에서 충족 가능해야 한다.
이 전제가 깨지는 새 템플릿은 테스트에서 즉시 드러난다.

### 4.2 남은 category와 수용량 보정

monster 보호 슬롯 이외의 일반 노드는 기존 RNG 흐름으로 category를 먼저 고른다.
strong link 예약과 `repairNormalCategoryCapacity`는 이후에도 동작하지만 보호 슬롯을
다른 category로 바꾸지 못한다.

수용량 보정이 보호 슬롯을 제외하고 해결할 수 없으면 `INVALID_GENERATION`으로
실패한다. 이 실패는 콘텐츠·템플릿 계약이 monster 최소 보장과 양립하지 않는다는
신호이므로 조용한 RNG 재시도보다 우선한다.

## 5. 경계와 결정성

- 새 예약 선택은 RNG를 소비하지 않는다. 안정된 노드 ID와 현재 예약 상태만으로
  동률을 푼다.
- 기존 RNG가 소비하는 남은 category의 순서와 의미는 바꾸지 않는다.
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

- `lib/rules/expedition-events.ts`: monster 예약, 보호 슬롯을 고려한 수용량 보정,
  최종 경로 검증
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
