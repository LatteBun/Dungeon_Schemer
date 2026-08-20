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
5. UI 작업이면 [화면 규격](experience/SCREEN_LAYOUT.md)과 [온보딩과 인터페이스](experience/ONBOARDING_AND_INTERFACE.md)
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
- [ONBOARDING_AND_INTERFACE.md](experience/ONBOARDING_AND_INTERFACE.md): 인트로부터 엔딩까지 화면 정보 구조, 30초 온보딩과 결과 피드백

### 시각 자료

- [diagram/README.md](diagram/README.md): 캠페인·탐험 시퀀스, 상태 전이, 대표 화면 6개의 Markdown 원본과 이미지 인덱스
- [대표 화면 전체 모음](diagram/svg/screen-overview.svg): 인트로부터 캠페인 엔딩까지의 화면 와이어프레임

### 기술

- [DEVELOPMENT_ENVIRONMENT.md](technical/DEVELOPMENT_ENVIRONMENT.md): GitHub Codespaces, Next.js, React, TypeScript, Tailwind CSS, Framer Motion, Zustand, Supabase, Vercel의 책임
- [CAMPAIGN_REWORK_WORK_ASSIGNMENT.md](technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md): 캠페인 개편의 유일한 작업 기준. 계층, 의존성 그래프, 담당과 상태
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
- 기능의 규칙이 바뀌면 구현과 같은 변경 단위에서 관련 공식 문서를 함께 갱신한다.
- 같은 규칙을 여러 문서에 복사하지 않고 가장 직접적인 시스템 문서를 기준으로 연결한다.
- 확정되지 않은 수치와 콘텐츠를 사실처럼 기록하지 않는다.
- 기존 원본 자료는 수정하지 않는다. 새로운 아이디어는 먼저 검토한 뒤 공식 문서에 반영한다.
- 게임의 중심 방향을 바꾸는 변경은 [게임 원칙](GAME_PRINCIPLES.md)부터 명시적으로 수정한다.

## 이번 개편 설계

- [캠페인 개편 설계](superpowers/specs/2026-08-19-lattebun-campaign-rework-design.md): 확정 규칙, 폐기 규칙, 문서 개정 지도
- [C1 캠페인 초기화·생태 패키지 설계](superpowers/specs/2026-08-20-sanghwan-yoo-c1-campaign-initialization-design.md): 고정 던전 슬롯, 생태 패키지, 초기 캠페인 상태의 구현 경계
- [C1 캠페인 초기화·생태 패키지 구현 계획](superpowers/plans/2026-08-20-sanghwan-yoo-c1-campaign-initialization.md): 도메인 계약, 콘텐츠 검증, 시드 초기화의 구현 순서
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
