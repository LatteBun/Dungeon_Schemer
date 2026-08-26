# 의심 인원 상태 칩과 경고 팝업 설계

## 문서 정보

- 작성자: LatteBun
- 작성 도구: Codex + Superpowers Brainstorming
- 작성일: 2026-08-26
- 대상: PR #195 상단 신뢰 0 상태 칩

## 목표

공통 상단 상태 바의 `신뢰 0` 레이블을 플레이어 언어인 `의심 인원`으로 바꾸고, 칩을 누르면 누적 고발의 위험을 서사적으로 설명하는 비모달 팝오버를 연다.

## 규칙 경계

- 표시 수치는 계속 현재 살아 있는 `trust === 0` 인원 / `DENOUNCE_THRESHOLD`다.
- 사망자는 수치에서 제외한다.
- 이 변경은 신뢰·정산·월드턴·엔딩 판정과 저장 상태를 바꾸지 않는다.
- 즉시 `불신의 대가` 경로를 새 게이지나 별도 조건으로 설명하지 않는다.

## 상호작용 계약

- 모든 `GameShell` 화면에서 칩 레이블은 `의심 인원`이고 값은 기존처럼 `n / 5`다.
- 칩은 버튼이며 `aria-label`에 레이블과 값이 포함된다.
- 클릭하면 `role="dialog"`, 이름 `의심 인원`인 하나의 비모달 팝오버가 칩 바로 아래의 공용 앵커에서 열린다.
- `Escape`, 바깥 클릭, `닫기` 버튼으로 닫히며, 닫은 뒤 초점은 칩으로 돌아간다.
- 열린 동안에도 배경은 조작·포커스를 받으며, 상태 수치와 게임 흐름도 멈추거나 변경하지 않는다.
- 팝오버는 새 전역 chrome이 아니라 `TopStatusBar`/`GameShell` 공통 경계의 화면 내 UI다. 같은 공용 앵커 동작을 쓰고, 화면별 CSS 재정의나 상태 바 내부 스크롤을 만들지 않는다.

## 고정 문구

제목: `의심 인원`

본문:

> 신뢰를 완전히 잃은 용사가 다섯 명 이상이면, 이번 던전이 끝난 뒤 누적 고발이 시작됩니다.
>
> 결국 고블린은 처형되고 당신의 길잡이 일도 끝나겠죠. 다만 죽은 용사는 집계에서 제외됩니다. 신뢰를 잃은 자가 돌아오지 못하게 하는 편이 나을지도 모릅니다.

## 구현과 검증

- 기존 `StatusItem`의 action 경로를 재사용하되 승급 전용 test id·상태와 섞지 않는다.
- `TopStatusBar`의 공용 앵커 팝오버 경로를 재사용하며, 배경 차단 처리나 focus trap을 두지 않는다.
- `TopStatusBar` unit test는 새 레이블, 버튼/값/aria-label, 팝오버 문구와 바깥 클릭·Escape·닫기 동작을 검증한다.
- `GameShell` 또는 browser test는 캠페인 화면에서 열기·Escape 닫기·focus 복귀와 비모달 배경 조작을 검증한다.
- `docs/experience/SCREEN_LAYOUT.md`, `docs/experience/ONBOARDING_AND_INTERFACE.md`, `docs/technical/SCREEN_ADAPTER_CONTRACT.md`, `docs/README.md`에 상호작용과 규칙 경계를 갱신한다.
