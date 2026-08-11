# Dungeon Schemer Documentation Architecture Design

## 목적

이 문서 체계는 기존 아이디어 원문을 보존하면서, 개발 중 반복해서 참조할 공식 기준 문서를 제공한다. 개발자는 구현 판단이 필요할 때 `docs/GAME_PRINCIPLES.md`를 가장 먼저 확인하고, 세부 결정은 해당 시스템 문서를 따른다.

## 문서 우선순위

문서 간 내용이 충돌하면 다음 우선순위를 적용한다.

1. `docs/GAME_PRINCIPLES.md`
2. `docs/design/` 및 `docs/systems/`의 공식 설계 문서
3. `docs/experience/` 및 `docs/technical/`의 분야별 문서
4. `docs/any-ideas/` 및 `docs/initialization/`의 기존 원본 자료

기존 원본 자료는 아이디어의 출처이지만 구현 기준은 아니다. 새 아이디어가 공식 기준이 되려면 관련 공식 문서에 반영해야 한다.

## 디렉터리 구조

```text
docs/
├─ README.md
├─ GAME_PRINCIPLES.md
├─ design/
│  ├─ GAME_OVERVIEW.md
│  └─ CORE_GAME_LOOP.md
├─ systems/
│  ├─ PARTY_AND_TRUST.md
│  ├─ INFORMATION_AND_DECEPTION.md
│  ├─ DUNGEON_EVENTS_AND_BOSSES.md
│  └─ PROGRESSION_AND_ENDINGS.md
├─ experience/
│  └─ ONBOARDING_AND_INTERFACE.md
├─ technical/
│  └─ DEVELOPMENT_ENVIRONMENT.md
├─ any-ideas/
├─ initialization/
└─ superpowers/
   └─ specs/
```

## 파일별 책임

### `docs/README.md`

공식 문서의 지도다. 문서 우선순위, 추천 읽기 순서, 각 파일의 역할, 기존 원본 자료의 위치를 설명한다.

### `docs/GAME_PRINCIPLES.md`

모든 개발 판단에 적용하는 게임의 헌법이다. 다음 원칙을 반드시 포함한다.

- 플레이어는 전투원이 아니라 던전 길잡이다.
- 핵심 재미는 전투 자체보다 정보, 신뢰, 배신, 정치에서 나온다.
- 용사와 던전 중 어느 한쪽도 정답으로 취급하지 않는다.
- 중요한 선택에는 이득과 위험이 함께 존재해야 한다.
- 신뢰도는 파티원 개인별로 관리한다.
- 진실, 거짓, 중립 정보 선택은 핵심 의사결정 수단이다.
- 플레이어의 선택은 실제 던전 진행과 결과에 영향을 줘야 한다.
- 게임 시작 후 30초 안에 플레이어 역할과 단기 목표를 이해할 수 있어야 한다.
- 구현 편의를 이유로 핵심 원칙을 훼손하지 않는다.

또한 기능 추가 전 확인할 짧은 체크리스트를 제공한다.

### `docs/design/GAME_OVERVIEW.md`

게임의 한 줄 소개, 플레이어 역할, 핵심 재미, 양쪽 세력 사이의 줄타기, 차별화 지점을 설명한다.

### `docs/design/CORE_GAME_LOOP.md`

용사 파티 등장부터 결과 정산과 다음 파티 모집까지 한 판의 흐름을 설명한다. 각 단계에서 플레이어가 내리는 결정과 결과 피드백을 연결한다.

### `docs/systems/PARTY_AND_TRUST.md`

3~5명의 랜덤 파티, 직업과 성격, 파티원별 개별 신뢰도, 신뢰도 변화와 신뢰도 0의 처형 엔딩을 정의한다.

### `docs/systems/INFORMATION_AND_DECEPTION.md`

용사와 보스에게 제공하는 진실, 거짓, 중립 카드의 역할과 위험·보상 구조를 정의한다. 능력치와 신뢰도가 카드 효과 및 성공 확률에 미치는 관계도 설명한다.

### `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`

던전 이동, 몬스터, 휴식, 상인, 특수 사건, 보스전, 양 진영 지원과 직접 개입 조건을 정리한다.

### `docs/systems/PROGRESSION_AND_ENDINGS.md`

설득력, 기만, 생존, 정보 수집, 협상, 은신 성장과 던전의 강화·약화, 영웅·마왕·지배자·상인 왕 엔딩을 설명한다.

### `docs/experience/ONBOARDING_AND_INTERFACE.md`

30초 안에 이해해야 할 정보, 초반 스토리 또는 튜토리얼의 목표, 메인 화면·선택지·자원·던전 경로의 정보 배치를 설명한다. 기존 `proto_image.png`는 초기 참고 이미지로 연결한다.

### `docs/technical/DEVELOPMENT_ENVIRONMENT.md`

GitHub Codespaces, Next.js, React, TypeScript, Tailwind CSS, Framer Motion, Zustand, Supabase, Vercel로 이어지는 기술 구성을 공식 문서 형식으로 정리한다.

## 내용 작성 원칙

- 기존 문서에서 확정된 내용과 새로 해석한 내용을 구분한다.
- 아직 정해지지 않은 수치나 콘텐츠는 임의로 확정하지 않는다.
- 같은 규칙을 여러 문서에 복제하지 않고 기준 문서로 연결한다.
- 각 시스템 문서는 목적, 핵심 규칙, 플레이어에게 보이는 결과, 다른 시스템과의 연결을 포함한다.
- 파일명과 주요 용어는 일관된 영문 대문자 스네이크 표기를 사용한다.
- 본문은 한국어로 작성한다.

## 기존 자료 보존 정책

다음 파일은 이동, 이름 변경, 내용 수정을 하지 않는다.

- `docs/any-ideas/free-ideas.md`
- `docs/initialization/Development_Environment.md`
- `docs/initialization/initial discussion.md`
- `docs/initialization/proto_image.png`

새 공식 문서는 이 자료를 요약하고 구조화하되 원문을 대체하거나 삭제하지 않는다.

## 완료 조건

- 제안한 공식 문서 10개가 모두 생성되어 있다.
- `docs/README.md`에서 모든 공식 문서와 기존 원본 자료로 이동할 수 있다.
- `docs/GAME_PRINCIPLES.md`만 읽어도 구현 시 지켜야 할 핵심 기준을 알 수 있다.
- 세부 시스템 문서가 원칙 문서와 모순되지 않는다.
- 기존 Markdown과 이미지가 변경되지 않는다.
- 문서에 작업 표식, 임시 문구, 미확정 값을 확정한 표현이 없다.
