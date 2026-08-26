# 남은 용사 상태 칩 설계

## 문서 정보

- 작성자: LatteBun
- 작성 도구: Codex + Superpowers Brainstorming
- 작성일: 2026-08-26
- 대상: PR #195 공통 상단 상태 바

## 목표

모든 `GameShell`의 상단 상태 바에서 원정에 다시 동원할 수 있는 남은 용사 수를 확인하고, 칩을 눌러 `인력 소진` 엔딩 조건을 플레이어 언어로 이해하게 한다.

## 규칙과 View 경계

- `남은 용사`는 `canDeployEmergency(character)`가 참인 인원, 즉 살아 있고 신뢰가 1 이상인 용사 수다.
- 중상자는 마지막 응급 편성 후보이므로 포함하고 사망자와 신뢰 0 용사는 제외한다.
- 새 selector `countEmergencyEligibleAdventurers(campaign)`가 집계를 소유한다. `statusFor()`는 결과만 `TopStatusView.remainingAdventurers`로 옮기며 UI와 fixture가 조건을 다시 쓰지 않는다.
- 숫자만으로 엔딩 여부를 판정하지 않는다. 실제 `인력 소진`은 기존 `canCreateEmergencyParty()`가 서로 다른 직업 3명을 만들 수 있는지 판정한다.
- 저장 상태, 월드턴, 편성, 엔딩 우선순위는 변경하지 않는다.

## 표시와 순서

- 레이블: `남은 용사`
- 값: `{remainingAdventurers}명`
- 순서: `길잡이 등급 → 현재 명성 → 골드 → 승급 → 의심 인원 → 남은 용사 → 남은 던전 → 현재 던전(원정 중)`
- 기본 화면은 7칩, 원정 화면은 최대 8칩을 한 줄로 유지한다.
- 공통 `--status-*` 토큰만 측정 결과에 따라 조정하고 화면별 override, 줄바꿈, 텍스트 잘림, 내부 가로 스크롤을 만들지 않는다.
- 8칩과 두 앵커 팝오버는 전역 퀵 메뉴 트리거·열린 패널과 겹치지 않는다.

## 앵커 팝오버

- `남은 용사` 칩 바로 아래에 기존 `의심 인원`과 같은 비모달 `role="dialog"` 팝오버를 연다.
- 바깥 클릭, `Escape`, `닫기` 버튼으로 닫고 Escape 뒤 칩으로 초점을 돌린다.
- 제목: `남은 용사`
- 본문:

> 서로 다른 직업의 용사 세 명을 더는 모을 수 없으면, 이번 던전이 끝난 뒤 원정대를 꾸리지 못해 길잡이 일도 끝납니다.
>
> 중상을 입은 용사도 마지막 원정에는 나설 수 있지만, 죽거나 신뢰를 완전히 잃은 용사는 돌아오지 않습니다.

## 재사용과 검증

- `TopStatusBar`의 팝오버 열기·바깥 클릭·Escape·포커스 복귀를 공통 helper/component로 만들어 두 칩이 같은 계약을 사용한다.
- selector test는 생존·신뢰 0·사망·중상 포함을 검증하고, adapter test는 selector 결과 전달을 검증한다.
- 모든 정적 fixture는 필수 `remainingAdventurers` 값을 제공하고 캠페인 기반 preview는 selector를 사용한다.
- unit test는 값·순서·버튼·고정 문구를, Playwright는 8칩 한 줄·overflow 없음·팝오버 앵커 위치·퀵 메뉴 비겹침을 FHD/HD/5:4에서 검증한다.
- `docs/README.md`, `SCREEN_LAYOUT.md`, `ONBOARDING_AND_INTERFACE.md`, `SCREEN_ADAPTER_CONTRACT.md`를 함께 갱신한다.
