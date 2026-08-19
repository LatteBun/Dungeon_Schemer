# 캠페인 시퀀스

한 캠페인은 던전 15개와 캐릭터 30명으로 시작한다. 인트로에서 길잡이의 역할을
전달한 뒤 게시판으로 들어간다. 계약한 원정의 결과는 매번 캠페인 상태에
병합되고, 엔딩이 발생하지 않으면 갱신된 상태로 다음 게시판을 만든다.

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
    Flow->>Rules: 던전 15 · 캐릭터 30 · 명성 30 · 골드 10 생성
    Rules-->>State: 초기 상태 저장
    State-->>UI: 인트로 화면
    Player->>UI: 게시판으로 진입
    Flow->>Rules: 미클리어 던전을 위험도 높은 순으로 공고화(최대 5)
    Rules->>Rules: 출전 가능자 중 서로 다른 직업 3명 임시 편성
    Rules-->>State: 현재 게시판 저장
    State-->>UI: 진입 불가 공고 포함 게시판
    Note over UI,State: 화면 재진입은 재추첨·난수 소비 없음
    Player->>UI: 공고 선택
    UI->>Flow: 계약 요청
    Flow->>Rules: 길잡이 등급의 진입 한계 검증
    alt 진입 가능
        Rules-->>State: ExpeditionState 생성
        Flow-->>UI: 답사 기록·임시 파티 확인 후 탐험 시작
        Note over Player,State: 세부 상호작용은 탐험 시퀀스 참조
        Flow->>Rules: 탐험 결과 정산
        Rules->>State: 보상/유품 → 던전 위험도 → 명성
        Player->>UI: 승급하기 (선택)
        Flow->>Rules: 명성 승급 또는 골드 승급
        Flow->>Rules: 월드턴 처리
        Rules->>State: 휴식 · 백그라운드 · 중상
        Rules->>State: 엔딩 우선순위 판정
        alt 엔딩 없음
            Rules->>State: 다음 게시판 생성
            State-->>UI: 갱신된 공고
        else 엔딩 발생
            State-->>UI: 엔딩 원인·최종 등급·캠페인 회고
        end
    else 진입 불가
        Rules-->>UI: 사유와 필요한 길잡이 등급
    end
```

## 읽을 때 볼 것

- 인트로는 캠페인 시작 시 한 번 나오고, 길잡이의 역할·개입 수단·목표를 전달한다.
- 진입 한계를 정하는 것은 명성이 아니라 길잡이 등급이다. 명성은 승급 요구치다.
- 승급은 자동으로 일어나지 않는다. `승급하기`를 눌러야 오르고 강등은 없다.
- 진입 불가 공고도 숨기지 않고 사유와 함께 보여준다.
- 월드턴은 엔딩 판정보다 앞에 온다. 누가 다음 원정에 나갈 수 있는지가 정해져야 인력 소진을 판정할 수 있다.
- 화면을 다시 열기만 해서는 게시판을 재추첨하거나 난수를 소비하지 않는다.
- 같은 시드와 같은 선택 순서는 같은 상태와 결정 기록을 만든다.

## 관련 문서

- [핵심 게임 루프](../design/CORE_GAME_LOOP.md)
- [성장과 엔딩](../systems/PROGRESSION_AND_ENDINGS.md)
- [캐릭터 풀과 월드턴](../systems/CHARACTER_POOL_AND_WORLDTURN.md)
- [대표 화면 와이어프레임](screen-wireframes.md)
