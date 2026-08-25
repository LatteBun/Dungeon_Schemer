# Dungeon Schemer 문서 안내

## 문서의 목적

이 폴더는 Dungeon Schemer의 게임 방향, 시스템 규칙, 사용자 경험, 기술 구성을 관리한다.

개발을 시작하거나 기능을 변경할 때는 먼저 [게임 원칙](GAME_PRINCIPLES.md)을 확인한다. 기존 아이디어 메모와 초기 논의는 출처 자료로 보존하지만, 실제 구현 판단은 공식 문서를 기준으로 한다.

## 문서 우선순위

문서 내용이 서로 충돌하면 다음 순서를 적용한다.

1. [게임 원칙](GAME_PRINCIPLES.md)
2. `design`과 `systems`의 공식 설계 문서
3. `experience`와 `technical`의 분야별 문서
4. `any-ideas`와 `initialization`의 기존 원본 자료

새 아이디어가 공식 규칙이 되려면 해당 내용을 관련 공식 문서에 반영해야 한다.

## 추천 읽기 순서

처음 프로젝트를 이해하는 경우:

1. [게임 원칙](GAME_PRINCIPLES.md)
2. [게임 개요](design/GAME_OVERVIEW.md)
3. [핵심 게임 루프](design/CORE_GAME_LOOP.md)
4. 작업하려는 기능과 관련된 시스템 문서
5. UI 작업이면 [화면 규격](experience/SCREEN_LAYOUT.md), [온보딩과 인터페이스](experience/ONBOARDING_AND_INTERFACE.md), [UI 구현 가이드](experience/UI_IMPLEMENTATION_GUIDE.md)를 함께 읽고, 새 화면/에셋 지시서는 [UI 작업 지시서 템플릿](experience/UI_TASK_TEMPLATE.md)을 복사해 작성한다.
6. 흐름을 그림으로 확인하려면 [시각 자료](diagram/README.md)
7. 무엇을 구현할 차례인지 찾으려면 [캠페인 개편 작업 배정표](technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)
8. 프로젝트 설정 작업이면 [개발 환경](technical/DEVELOPMENT_ENVIRONMENT.md)

## 공식 문서

### 최상위 기준

- [GAME_PRINCIPLES.md](GAME_PRINCIPLES.md): 모든 개발 판단에 적용하는 게임의 핵심 원칙과 기능 검토 체크리스트

### 게임 설계

- [GAME_OVERVIEW.md](design/GAME_OVERVIEW.md): 고블린 길잡이의 역할, 던전 15개 캠페인, 생존과 배신의 핵심 재미
- [CORE_GAME_LOOP.md](design/CORE_GAME_LOOP.md): 게시판부터 탐험, 정산, 다음 공고와 캠페인 엔딩까지의 반복 구조

### 핵심 시스템

- [CHARACTERS_AND_TRUST.md](systems/CHARACTERS_AND_TRUST.md): 캐릭터 상태, 직업, 성격, 신뢰 판정과 신뢰 0 누적
- [CHARACTER_POOL_AND_WORLDTURN.md](systems/CHARACTER_POOL_AND_WORLDTURN.md): 풀 30명, 임시 파티 편성, 월드턴과 중상
- [INFORMATION_AND_DECEPTION.md](systems/INFORMATION_AND_DECEPTION.md): 생태 규칙과 현장 단서로 판단하는 도움·방해·중립 조언과 사후 검증
- [DUNGEON_THEMES_AND_ECOLOGY.md](systems/DUNGEON_THEMES_AND_ECOLOGY.md): 테마 3종, 생태 규칙과 활성 규칙, 몬스터·보스 계약
- [DUNGEON_EVENTS_AND_BOSSES.md](systems/DUNGEON_EVENTS_AND_BOSSES.md): 위험도별 지도, 진입 한계, 사건 행동, 자동 보스전과 재도전
- [PROGRESSION_AND_ENDINGS.md](systems/PROGRESSION_AND_ENDINGS.md): 위험도별 보상, 명성·골드 승급, 엔딩 5종과 판정 순서

### 사용자 경험

- [SCREEN_LAYOUT.md](experience/SCREEN_LAYOUT.md): 3:2 게임 셸(좌 60%·우 40%), 기준 해상도, 화면별 좌·우 구조와 색 외 단서 원칙
- [ONBOARDING_AND_INTERFACE.md](experience/ONBOARDING_AND_INTERFACE.md): 메인 메뉴에서 캠페인·업적 기록으로 갈리는 진입과 인트로부터 엔딩까지의 화면 정보 구조
- [UI_IMPLEMENTATION_GUIDE.md](experience/UI_IMPLEMENTATION_GUIDE.md): UI·파티원·지도·배경·이미지 에셋 구현 시 재사용, 반응형, 가독성, 레퍼런스 스타일·시점 계승과 벡터/아이콘화 금지 기준
- [UI_TASK_TEMPLATE.md](experience/UI_TASK_TEMPLATE.md): 화면별 UI와 이미지 에셋 작업에서 필수 정보, 시각 계약, 슬롯 비율, viewport 검증 조건을 전달하기 위한 작업 지시서 템플릿

### 시각 자료

- [diagram/README.md](diagram/README.md): 캠페인·탐험 시퀀스, 상태 전이, 캠페인 화면 일곱 장과 메타 화면 두 장의 이미지 인덱스
- [캠페인 대표 화면 전체 모음](diagram/png/screen-overview.png): 인트로부터 캠페인 엔딩까지 화면 일곱 장의 실제 캡처
- [메인 메뉴](diagram/png/screen-main-menu.png) · [길잡이 업적 기록](diagram/png/screen-achievements.png): 두 메타 화면의 실제 1920×1080 캡처

### 기술

- [DEVELOPMENT_ENVIRONMENT.md](technical/DEVELOPMENT_ENVIRONMENT.md): GitHub Codespaces, Next.js, React, TypeScript, Tailwind CSS, Framer Motion, Zustand, Supabase, Vercel의 책임
- [CAMPAIGN_REWORK_WORK_ASSIGNMENT.md](technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md): 캠페인 개편의 유일한 작업 기준. 계층, 의존성 그래프, 담당과 상태
- [SCREEN_ADAPTER_CONTRACT.md](technical/SCREEN_ADAPTER_CONTRACT.md): 화면이 아직 없는 규칙 자리를 어떤 fixture로 메우고 있는지. 우선권은 로직에 있다
- [DEFERRED_WORK.md](technical/DEFERRED_WORK.md): 배정표 밖에서 나중에 하기로 미룬 일과 그 근거
- [SESSION_PERSISTENCE_REVIEW.md](technical/SESSION_PERSISTENCE_REVIEW.md): 뒤로가기·bfcache 검토와 저장해야 할 상태 목록. I1 시작 전에 읽는다
- [TEAM_DEVELOPMENT_WORKFLOW.md](technical/TEAM_DEVELOPMENT_WORKFLOW.md): 브랜치, 리뷰, 병합 규약

## 회의 기록

논의한 날의 기록이다. 이후 규칙이 바뀌어도 고치지 않는다. 지금 규칙은 위의 공식 문서를 따른다.

- [2026-08-17 캠페인 개편 회의](meetings/DUNGEON_SCHEMER_MEETING_2026-08-17.md): 캐릭터 풀, 위험도, 생태 규칙, 엔딩 재정의
- [2026-08-18 화면 방향 논의](meetings/SCREEN_UI_DIRECTION_2026-08-18.md): 당시 3:1 셸 논의 기록, 화면별 구조와 참고 시안

## 기존 원본 자료

다음 자료는 초기 아이디어와 논의의 원문이다. 이동하거나 내용을 덮어쓰지 않고 출처로 보존한다.

- [free-ideas.md](any-ideas/free-ideas.md): 랜덤 파티, 능력 성장, 정보 카드, 30초 튜토리얼, 보스 후보, 개인 신뢰도에 관한 자유 아이디어
- [initial discussion.md](initialization/initial%20discussion.md): 게임 소개, 전체 루프, 핵심 시스템, 엔딩, 초기 화면 구성에 관한 최초 논의
- [Development_Environment.md](initialization/Development_Environment.md): 초기 기술 스택 메모
- [proto_image.png](initialization/proto_image.png): 메인 화면, 선택 패널, 던전 경로, 결과 화면의 초기 스케치

## 문서 갱신 규칙

- 기능을 구현하기 전에 관련 공식 문서와 [게임 원칙](GAME_PRINCIPLES.md)을 확인한다.
- UI·이미지 에셋 작업은 [UI 구현 가이드](experience/UI_IMPLEMENTATION_GUIDE.md)를 함께 확인하고, 승인된 레퍼런스의 스타일·시점·카메라 방향을 계승한다.
- 사용자가 명시적으로 요청하지 않은 경우 장면형 이미지나 캐릭터 에셋을 플랫 벡터·아이콘·로고 느낌으로 임의 단순화하지 않는다.
- 기능의 규칙이 바뀌면 구현과 같은 변경 단위에서 관련 공식 문서를 함께 갱신한다.
- 같은 규칙을 여러 문서에 복사하지 않고 가장 직접적인 시스템 문서를 기준으로 연결한다.
- 확정되지 않은 수치와 콘텐츠를 사실처럼 기록하지 않는다.
- 기존 원본 자료는 수정하지 않는다. 새로운 아이디어는 먼저 검토한 뒤 공식 문서에 반영한다.
- 게임의 중심 방향을 바꾸는 변경은 [게임 원칙](GAME_PRINCIPLES.md)부터 명시적으로 수정한다.

## 이번 개편 설계

- [U5 행동/조언 헤더와 현재 상황 패널 가독성 개선 설계](superpowers/specs/2026-08-25-lattebun-u5-console-situation-readability-design.md): 행동·조언 탭과 현재 상황 패널을 금속 명패 계열로 맞추고, 상황 글자 확대와 조언 카드 하단 정렬을 정의하는 UI 경계
- [U5 행동/조언 헤더와 현재 상황 패널 가독성 개선 구현 계획](superpowers/plans/2026-08-25-lattebun-u5-console-situation-readability.md): JSX·CSS 계약, FHD 브라우저 containment, 문서 색인을 테스트 우선으로 구현·검증하는 순서
- [U5 조언 카드 번호 제거 설계](superpowers/specs/2026-08-25-lattebun-u5-advice-number-removal-design.md): 조언 카드 세 장의 숫자 배지만 제거하고 내부 슬롯 선택 계약을 유지하는 UI 변경
- [U5 조언 카드 번호 제거 구현 계획](superpowers/plans/2026-08-25-lattebun-u5-advice-number-removal.md): 조언 카드의 숫자 배지를 테스트 우선으로 제거하고 내부 슬롯 선택 계약을 유지하는 구현 순서
- [보스전 정산 CTA 게이트 설계](superpowers/specs/2026-08-25-lattebun-boss-battle-exit-gate-design.md): 보스전 재생 중 정산을 잠그고 우측 하단 CTA를 `전투 건너뛰기`에서 `정산으로`로 전환하는 계약
- [보스전 정산 CTA 게이트 구현 계획](superpowers/plans/2026-08-25-lattebun-boss-battle-exit-gate.md): 공용 playback 제어 분리, 일반전·보스전 exit 정책 연결, 실제 브라우저 전환 검증의 테스트 우선 순서
- [진행 화면 UX 개선 설계](superpowers/specs/2026-08-25-lattebun-progress-screen-ux-design.md): 낮은 금속 명패형 조언 카드, 비전투 파티 장면, 일반전 재생 상태에 따른 우측 하단 CTA 전환 계약
- [진행 화면 UX 개선 구현 계획](superpowers/plans/2026-08-25-lattebun-progress-screen-ux.md): 전투 재생 제어 분리, 일반전 CTA 게이트, 비전투 파티와 A1 카드의 테스트 우선 구현 순서
- [U6 정산 복귀 CTA 크기 개선 설계](superpowers/specs/2026-08-25-lattebun-u6-settlement-continue-size-design.md): 공통 다음 단계 CTA 크기를 유지하면서 정산 복귀 버튼을 내용 폭으로 줄이는 배치 기준
- [U6 정산 복귀 CTA 크기 개선 구현 계획](superpowers/plans/2026-08-25-lattebun-u6-settlement-continue-size.md): CSS 계약 테스트부터 내용 폭 우측 정렬과 실제 정산 화면 검증까지의 테스트 우선 순서
- [U4 지도 우측 패널 순서 개선 설계](superpowers/specs/2026-08-25-lattebun-u4-map-right-panel-order-design.md): 계약 전 답사를 선택 지점 위로 옮기고 이동 CTA를 우측 최하단에 고정하는 배치 기준
- [U4 지도 우측 패널 순서 개선 구현 계획](superpowers/plans/2026-08-25-lattebun-u4-map-right-panel-order.md): DOM 읽기 순서와 3행 CSS 계약을 테스트 우선으로 변경하고 실제 캠페인 지도에서 확인하는 순서
- [브라우저 안정성 스모크 테스트 설계](superpowers/specs/2026-08-25-lattebun-browser-stability-smoke-design.md): 공개 경로·첫 사건 클릭 흐름·공식 viewport의 Chromium 회귀 계약
- [브라우저 안정성 스모크 테스트 구현 계획](superpowers/plans/2026-08-25-lattebun-browser-stability-smoke.md): Playwright 실행 기반부터 경로·캠페인·캔버스·문서 검증까지의 테스트 우선 순서
- [E3 경로별 몬스터 최소 보장 설계](superpowers/specs/2026-08-24-lattebun-e3-monster-path-minimum-design.md): 위험도별 실제 선택 경로의 몬스터 하한과 결정적 전역 배정 계약
- [E3 경로별 몬스터 최소 보장 구현 계획](superpowers/plans/2026-08-24-lattebun-e3-monster-path-minimum.md): E3 동시 제약 배정·실제 프로필 회귀의 테스트 우선 실행 순서
- [캠페인 개편 설계](superpowers/specs/2026-08-19-lattebun-campaign-rework-design.md): 확정 규칙, 폐기 규칙, 문서 개정 지도
- [B1 현행 캠페인 백테스트 설계](superpowers/specs/2026-08-24-lattebun-b1-current-campaign-backtest-design.md): 실제 Store 기반 3전략×2정확도 calibration·holdout 진단과 조건부 B1-B 경계
- [B1 현행 캠페인 백테스트 구현 계획](superpowers/plans/2026-08-24-lattebun-b1-current-campaign-backtest.md): 공개 정보 전략·실제 Store driver·calibration 승인·독립 holdout의 테스트 우선 실행 순서
- [B1-B 캠페인 생존 밸런스 재설계](superpowers/specs/2026-08-24-lattebun-b1-balance-redesign-design.md): B1-A 전 조합 완주율 0%를 해소하는 재도전·월드턴·보스·조언 누적 규칙과 재측정 기준
- [B1-B 캠페인 생존 밸런스 구현 계획](superpowers/plans/2026-08-24-lattebun-b1-balance-redesign.md): 공통 설정부터 조언 압력·전투·계측·단계별 calibration·독립 holdout까지의 테스트 우선 실행 순서
- [B1 위험도별 던전 클리어율 보정 설계](superpowers/specs/2026-08-25-lattebun-b1-risk-clearance-calibration-design.md): 첫 시도·초기 위험도 기준 목표 곡선과 보스 병목 분리, calibration·holdout 판정 기준
- [B1 위험도별 던전 클리어율 보정 구현 계획](superpowers/plans/2026-08-25-lattebun-b1-risk-clearance-calibration.md): 원정 trace·위험도별 funnel·acceptance gate·단계별 보스 배율 calibration과 승인 뒤 holdout 실행 순서
  - `backtest:structure`(조합당 50시드 구조 검증), `backtest:tune`(100시드 1차 보정), `backtest:quick`(200시드 최종 calibration), `backtest`(승인 뒤 조합당 2,000시드 holdout)을 사용한다.
- [B1-C 캠페인 손실 원인 판정·보정 설계](superpowers/specs/2026-08-25-lattebun-b1-campaign-depletion-attribution-design.md): 원정·월드턴·캠페인 종료 손실을 같은 원장으로 계측하고, 지배 원인 하나만 보정하는 경계와 재측정 기준
- [B1 생존형 진행 정책 교정 설계](superpowers/specs/2026-08-25-lattebun-b1-survival-progression-policy-design.md): 등급 잠금 구간에서 현재 접근 가능한 최고 위험도를 우선해 생존형 백테스트의 실직 편향을 교정하는 공개 정보 전략 계약
- [B1 생존형 진행 정책 교정 구현 계획](superpowers/plans/2026-08-25-lattebun-b1-survival-progression-policy.md): 승급·잔여 던전 진단 기준선을 먼저 보존하고 생존형 정책을 테스트 우선으로 교정한 뒤 같은 50·200시드로 비교하는 실행 순서
- [B1 위험도 곡선 v2 보정 설계](superpowers/specs/2026-08-25-lattebun-b1-risk-curve-v2-calibration-design.md): ★1 85~90%에서 ★5 55~65%까지의 새 첫 시도 목표와 보스 배율 단일 축, risk-curve 전용 gate 범위를 정의하는 후속 calibration 계약
- [B1 위험도 곡선 v2 보정 구현 계획](superpowers/plans/2026-08-25-lattebun-b1-risk-curve-v2-calibration.md): focus별 gate 분리부터 독립 namespace, 테스트 수집 경계, 50·100·200시드 보스 배율 보정과 공식 문서 동기화까지의 테스트 우선 실행 순서
- [B1 백테스트 최신 보고서](technical/BACKTEST_REPORT.md): `b1-risk-curve-v2` 200시드 결과, 위험도별 첫 시도 곡선과 잔여 `OBSERVE` gate
- [C4 원정 정산 설계](superpowers/specs/2026-08-23-lattebun-c4-expedition-settlement-design.md): 정산 계약, 유품, 응급 편성, C7·C8·U6 경계
- [C4 원정 정산 구현 계획](superpowers/plans/2026-08-23-lattebun-c4-expedition-settlement.md): C4와 연계 계약의 테스트 우선 구현 순서
- [C4 PR 리뷰 수정 구현 계획](superpowers/plans/2026-08-23-lattebun-c4-pr-review-fixes.md): 전멸 전용 다음 보상과 중상 경계 판정 수정 순서
- [C5 길잡이 승급 설계](superpowers/specs/2026-08-23-lattebun-c5-guide-promotion-design.md): 게시판에서 명성 또는 골드로 길잡이 등급을 승급하는 규칙과 화면 경계
- [C6 엔딩·신뢰 붕괴 설계](superpowers/specs/2026-08-23-lattebun-c6-ending-trust-collapse-design.md): 신뢰 0 누적 보정, 원정 중 즉시 불신 전이, 정상 경로 4종 엔딩 판정과 C7 경계
- [C7 캠페인 상태 전이 설계](superpowers/specs/2026-08-23-lattebun-c7-campaign-state-transition-design.md): 8개 phase 전이, 활성 원정 컨텍스트, C2~C6·C8 경계와 종료 보존 계약
- [C7 캠페인 상태 전이 구현 계획](superpowers/plans/2026-08-23-lattebun-c7-campaign-state-transition.md): C2~C6 결과를 단일 순수 전이로 적용하는 테스트 우선 구현 순서
- [C8-A 캠페인 정산 통계 설계](superpowers/specs/2026-08-23-lattebun-c8-campaign-statistics-design.md): C7 정산 결과의 단일 기록, 정산 누계·이력, C8-B telemetry 분리 경계
- [C8-A 캠페인 정산 통계 구현 계획](superpowers/plans/2026-08-23-lattebun-c8-campaign-statistics.md): 고정 던전 순서, 불변 정산 reducer, C7 조합 회귀의 테스트 우선 구현 순서
- [C8-B 캠페인 이력 이벤트 설계](superpowers/specs/2026-08-23-lattebun-c8-b-campaign-history-events-design.md): 결정적 이벤트 이력, 전환점 파생, C8-A·C7·I1·U6 경계
- [C8-B 캠페인 이력 이벤트 구현 계획](superpowers/plans/2026-08-23-lattebun-c8-b-campaign-history-events.md): 도메인 계약, 순수 이력 reducer, C7·C8-A 조합 경계의 테스트 우선 구현 순서
- [C1 캠페인 초기화·생태 패키지 설계](superpowers/specs/2026-08-20-sanghwan-yoo-c1-campaign-initialization-design.md): 고정 던전 슬롯, 생태 패키지, 초기 캠페인 상태의 구현 경계
- [C1 캠페인 초기화·생태 패키지 구현 계획](superpowers/plans/2026-08-20-sanghwan-yoo-c1-campaign-initialization.md): 도메인 계약, 콘텐츠 검증, 시드 초기화의 구현 순서
- [U2 인트로 게시판 진입 연결 설계](superpowers/specs/2026-08-20-sanghwan-yoo-u2-intro-board-navigation-design.md): U2 CTA와 기존 U1 게시판 프리뷰의 라우팅 계약
- [U2 인트로 게시판 진입 연결 구현 계획](superpowers/plans/2026-08-20-sanghwan-yoo-u2-intro-board-navigation.md): 테스트·구현·검증·PR 순서
- [인트로 본문 글자 크기 개선 설계](superpowers/specs/2026-08-25-lattebun-intro-body-typography-design.md): 실제 캠페인 인트로 본문만 약 15% 확대하는 타이포그래피 경계
- [인트로 본문 글자 크기 개선 구현 계획](superpowers/plans/2026-08-25-lattebun-intro-body-typography.md): CSS 계약 테스트부터 실제 캠페인 화면 확인까지의 실행 순서
- [게시판 수배지 UX·던전 명칭 개선 설계](superpowers/specs/2026-08-25-lattebun-board-notice-ux-design.md): 작은 수배지의 불규칙 배치, 보스 전설형 던전 이름, 계약 상세 배경 이미지 제거 기준
- [게시판 수배지 UX·던전 명칭 개선 구현 계획](superpowers/plans/2026-08-25-lattebun-board-notice-ux.md): 던전 이름, 계약 상세 배경, 수배지 배치를 테스트 우선으로 변경하고 실제 캠페인에서 확인하는 순서
- [캠페인 개편 작업 배정표](technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md): 무엇을 어떤 순서로 구현하는지

## 이전 개편 기록

아래는 그때 무엇을 왜 결정했는지의 기록이다. 지금 규칙과 다를 수 있고, 지금 값으로 덮어쓰지 않는다. 여기에 나오는 `F1`~`Q2`는 이번 개편의 같은 글자와 완전히 다른 작업이다.

### 설계 및 실행 기록

- [게임 흐름 다이어그램 설계](superpowers/specs/2026-08-13-sanghwan-yoo-game-flow-diagrams-design.md)
- [게임 흐름 다이어그램 구현 계획](superpowers/plans/2026-08-13-sanghwan-yoo-game-flow-diagrams.md)
- [게임 방향 개편 설계](superpowers/specs/2026-08-13-sanghwan-yoo-game-direction-rework-design.md)
- [게임 방향 개편 구현 계획](superpowers/plans/2026-08-13-sanghwan-yoo-game-direction-rework.md)
- [게임 방향 개편 질문지](superpowers/2026-08-13-game-direction-brainstorming-questionnaire.md)
- [문서 구조 설계](superpowers/specs/2026-08-11-documentation-architecture-design.md)
- [문서 구조 실행 계획](superpowers/plans/2026-08-11-documentation-architecture.md)

### F2 실행 기록

- [F2 콘텐츠 계약 설계](superpowers/specs/2026-08-13-sanghwan-yoo-event-card-item-content-design.md)
- [F2 콘텐츠 구현 계획](superpowers/plans/2026-08-13-sanghwan-yoo-event-card-item-content.md)
- [F2 자동·브라우저 테스트](technical/F2_TESTING.md)

### C1 실행 기록

- [C1 캠페인 초기화·게시판 설계](superpowers/specs/2026-08-14-sanghwan-yoo-c1-campaign-initialization-board-design.md)
- [C1 캠페인 초기화·게시판 구현 계획](superpowers/plans/2026-08-14-sanghwan-yoo-c1-campaign-initialization-board.md)
- [C1·F1·F2 통합 검증 하네스 설계](superpowers/specs/2026-08-14-sanghwan-yoo-c1-f1-f2-integration-harness-design.md)
- [F1·F2·C1 통합 검증 하네스 구현 계획](superpowers/plans/2026-08-14-sanghwan-yoo-f1-f2-c1-integration-harness.md)
