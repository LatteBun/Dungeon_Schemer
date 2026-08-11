# Dungeon Schemer

Dungeon Schemer는 용사 파티를 안내하는 던전 길잡이가 되어 정보와 신뢰를 다루는 로그라이크 전략 게임입니다. 플레이어는 용사와 던전 사이에서 거래와 배신을 선택하며 각자의 이야기를 만듭니다.

## 문서

- [문서 안내](docs/README.md)
- [게임 원칙](docs/GAME_PRINCIPLES.md)
- [팀 개발 워크플로](docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md)
- [AI 개발 전 사전 점검표](docs/technical/AI_DEVELOPMENT_PRECHECK.md)

## AI 작업 규칙

새 기능 또는 기존 동작 변경은 다음 순서로 진행합니다.

brainstorming으로 사용자와 합의 → 관련 `docs/` 공식 문서 갱신 → spec 작성 및 사용자 검토 → plan 작성 → 구현

spec과 plan이 모두 없으면 새 기능 또는 동작 변경을 구현하지 않습니다.

세부 실행 규칙은 [AGENTS.md](AGENTS.md)와 [docs/superpowers/](docs/superpowers/)를 참조합니다.
