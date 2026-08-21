# Task 2 보고서

- 작업: 공식 문서와 작업 그래프에서 F5 제거 및 merchant 골드 계약 반영
- 작업일: 2026-08-21
- 작업자: Codex

## 1. 수행 범위

브리프가 지정한 다음 파일만 수정했다.

- `docs/GAME_PRINCIPLES.md`
- `docs/design/CORE_GAME_LOOP.md`
- `docs/experience/ONBOARDING_AND_INTERFACE.md`
- `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- `docs/systems/INFORMATION_AND_DECEPTION.md`
- `docs/systems/PROGRESSION_AND_ENDINGS.md`
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- `docs/DOCUMENT_TERMINOLOGY.test.ts`

런타임 TypeScript와 merchant 콘텐츠 데이터는 건드리지 않았다.

## 2. 회귀 테스트 선추가와 실패 재현

먼저 `docs/DOCUMENT_TERMINOLOGY.test.ts`에 다음 회귀 가드를 추가했다.

- `RETIRED_TERMS`
  - `정보·치료제·독·가짜 지도 등을 구매한다`
  - `식량과 개별 물품은 원정 자원 또는 아이템으로 별도 관리한다`
- `REQUIRED_ANCHORS`
  - `GAME_PRINCIPLES.md`: `상인 사건`, `현재 골드`
  - `design/CORE_GAME_LOOP.md`: `pending merchant effect`
  - `experience/ONBOARDING_AND_INTERFACE.md`: `골드 부족`, `효과 중복 불가`
  - `systems/DUNGEON_EVENTS_AND_BOSSES.md`: `다음 전투`, `정보 판매`

그 뒤 아래 명령으로 의도된 실패를 재현했다.

```powershell
pnpm.cmd test -- docs/DOCUMENT_TERMINOLOGY.test.ts
```

실패 원인:

- `design/CORE_GAME_LOOP.md`에 폐기 문구 `식량과 개별 물품은 원정 자원 또는 아이템으로 별도 관리한다`가 남아 있었음
- `experience/ONBOARDING_AND_INTERFACE.md`에 폐기 문구 `정보·치료제·독·가짜 지도 등을 구매한다`가 남아 있었음
- 새 merchant 계약 앵커 6개가 문서에 없었음

## 3. 문서 변경 내용

### 3.1 최상위/경험 문서

- `GAME_PRINCIPLES.md`
  - 기본 행동에서 독립 아이템 사용을 제거했다.
  - `상인 사건`이 공용 사건이며 현재 골드로 즉시 개입 또는 다음 전투 1회 개입을 수행한다고 명시했다.
- `ONBOARDING_AND_INTERFACE.md`
  - 정보·가짜 지도 구매 설명을 제거했다.
  - 가격 표시, `골드 부족`, `효과 중복 불가` 비활성 상태를 명시했다.
  - 선택 전에는 help/harm/neutral과 실제 수치를 노출하지 않는다고 적었다.

### 3.2 루프/시스템 문서

- `CORE_GAME_LOOP.md`
  - 보스전 입력에서 `아이템`을 제거하고 `pending merchant effect`를 추가했다.
  - 별도 아이템 관리 문장을 제거하고, pending effect가 하나이며 지도/사건의 사전 배치를 바꾸지 않는다고 명시했다.
  - 즉시 피드백 문구를 `아이템 변화`에서 `골드 변화`로 정리했다.
- `DUNGEON_EVENTS_AND_BOSSES.md`
  - merchant 대표 행동을 `현재 골드로 즉시 개입, 다음 전투 개입 예약, 0G 비구매`로 교체했다.
  - H/X 유료 개입, neutral 0G 비구매, 정보 판매/가짜 지도/생태 정답 판매 금지, 골드 부족 처리, 실제 수용 시 결제, pending 단일 슬롯, `효과 중복 불가`, 즉시형/다음 전투형 계약을 반영했다.
  - 보스전 입력에서 `사용한 아이템`을 `pending merchant effect`로 교체했다.
  - 콘텐츠 데이터 계약에서 독립 아이템 5종 설명을 제거하고 merchant 골드 계약으로 교체했다.
- `INFORMATION_AND_DECEPTION.md`
  - 공용 merchant 예시를 새 골드 개입 계약에 맞게 바꿨다.
  - merchant neutral은 0G 비구매이고 정보 판매/가짜 지도식 정답 제공을 하지 않는다고 정리했다.
- `PROGRESSION_AND_ENDINGS.md`
  - 현재 골드 용도를 `상인 사건 개입`에 맞게 정리했다.
  - 상인 사건은 실제 수용 시 결제되고 neutral 0G 비구매는 골드를 움직이지 않는다고 명시했다.

### 3.3 작업 배정표

- 총 작업 수를 `43개`에서 `42개`로 갱신했다.
- Mermaid 그래프에서 `F5` 노드와 `D3 → F5`, `F5 → E3`를 제거했다.
- 기반 계층 설명을 실제 남은 기반 항목인 `F1`, `F1-2`, `F2-1`, `F2-2`, `F3-1~F3-5`, `F4`로 교체했다.
- `시작 가능한 작업` 문단에서 F5 언급을 제거했다.
- `D3` 행의 `풀리는 것`에서 `F5`를 제거했다.
- `E3` 행의 `선행`에서 `F5`를 제거했다.
- `E3` 완료 기준에 merchant의 비용 확인, 실제 실행 시 결제, 즉시/다음 전투 효과, pending 폐기를 추가했다.
- `F5` 행을 삭제했다.
- 재사용 자산/새로 만드는 것 표에서 F5 아이템 콘텐츠 설명을 삭제했다.

## 4. 검증

실패 재현:

```powershell
pnpm.cmd test -- docs/DOCUMENT_TERMINOLOGY.test.ts
```

- 결과: FAIL
- 이유: 폐기 문구 2건 잔존, 신규 anchor 6건 부재

최종 검증:

```powershell
pnpm.cmd test -- docs/DOCUMENT_TERMINOLOGY.test.ts docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts docs/DOCUMENT_LINKS.test.ts
```

- 결과: PASS
- 상세: 36 files, 311 tests passed

## 5. 커밋 계획

브리프가 지정한 tracked 파일만 `git add` 대상으로 사용한다.

```powershell
git add docs/GAME_PRINCIPLES.md docs/design/CORE_GAME_LOOP.md docs/experience/ONBOARDING_AND_INTERFACE.md docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/systems/INFORMATION_AND_DECEPTION.md docs/systems/PROGRESSION_AND_ENDINGS.md docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md docs/DOCUMENT_TERMINOLOGY.test.ts .superpowers/sdd/2026-08-21-lattebun-f5-removal-merchant-gold-rework/task-2-report.md
git commit -m "문서: F5를 제거하고 상인 골드 계약을 반영한다" -m "공식 규칙과 작업 그래프를 골드 기반 즉시·다음 전투 개입 계약으로 갱신한다."
```

작업 디렉터리의 비추적 항목 `.omo/`, `dungeon-schemer-handoff.md`는 그대로 둔다.
