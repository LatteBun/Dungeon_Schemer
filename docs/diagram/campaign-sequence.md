# 캠페인 시퀀스

한 캠페인은 던전 15개, 완성 파티 15팀과 예비 인원 6명으로 시작한다. 게시판에서
계약한 탐험의 결과는 매번 캠페인 상태에 병합되며, 엔딩이 발생하지 않으면 갱신된
상태로 다음 게시판을 만든다.

[SVG로 크게 보기](svg/campaign-sequence.svg) ·
[PNG로 보기](png/campaign-sequence.png)

```mermaid
sequenceDiagram
    autonumber
    actor Player as 플레이어
    participant UI as 캠페인 화면
    participant Flow as 캠페인 흐름
    participant Rules as 캠페인 규칙
    participant State as CampaignState
    Player->>UI: 새 캠페인 시작(seed)
    UI->>Flow: 캠페인 생성 요청
    Flow->>Rules: 던전 15 · 완성 파티 15 · 예비 6 생성
    Rules-->>State: 초기 상태 저장
    Flow->>Rules: 남은 던전과 완성 파티 공고 연결(최대 5)
    Rules-->>State: 현재 게시판 저장
    State-->>UI: 잠긴 공고 포함 게시판
    Note over UI,State: 화면 재진입은 재추첨·난수 소비 없음
    Player->>UI: 공고 선택
    UI->>Flow: 계약 요청
    Flow->>Rules: 현재 명성·지원 조건 검증
    alt 지원 가능
        Rules-->>State: ExpeditionState 생성
        Flow-->>UI: 파티 확인과 탐험 시작
        Note over Player,State: 세부 상호작용은 탐험 시퀀스 참조
        Flow->>Rules: 탐험 결과 정산
        Rules->>State: 보상/유품 → 던전 → 승급 → 파티/회복
        Rules->>State: 엔딩 우선순위 판정
        alt 엔딩 없음
            Rules->>State: 다음 게시판 생성
            State-->>UI: 갱신된 공고
        else 엔딩 발생
            State-->>UI: 엔딩 원인·최종 등급·캠페인 회고
        end
    else 지원 불가
        Rules-->>UI: 필요한 명성과 부족한 수치
    end
```

## 읽을 때 볼 것

- 현재 명성은 공고 지원을 제한하지만, 이미 얻은 영구 길잡이 등급은 내려가지 않는다.
- 잠긴 공고도 숨기지 않고 필요한 명성과 부족한 수치를 알려준다.
- 화면을 다시 열기만 해서는 게시판을 재추첨하거나 난수를 소비하지 않는다.
- 같은 시드와 같은 사용자 선택 순서는 같은 상태와 결정 기록을 만든다.
- 탐험 결과는 보상·던전·승급·파티·엔딩의 순서로 다음 캠페인 상태에 남는다.

## 관련 문서

- [핵심 게임 루프](../design/CORE_GAME_LOOP.md)
- [성장과 엔딩](../systems/PROGRESSION_AND_ENDINGS.md)
- [대표 화면 와이어프레임](screen-wireframes.md)
