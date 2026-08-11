# Dungeon Schemer Documentation Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 기획 원문을 보존하면서 개발 판단의 기준이 되는 공식 Markdown 문서 10개를 구축한다.

**Architecture:** `docs/GAME_PRINCIPLES.md`를 최상위 규칙으로 두고, 게임 개요와 루프는 `design`, 세부 규칙은 `systems`, 사용자 경험은 `experience`, 기술 선택은 `technical`에 둔다. `docs/README.md`가 모든 공식 문서와 기존 원본 자료를 연결하며, 문서 충돌 시 명시된 우선순위를 적용한다.

**Tech Stack:** Markdown, PowerShell 검증 명령, Git

## Global Constraints

- 기존 `docs/any-ideas/`와 `docs/initialization/` 파일은 이동, 이름 변경, 내용 수정을 하지 않는다.
- `docs/GAME_PRINCIPLES.md`가 모든 공식 문서보다 높은 우선순위를 가진다.
- 기존 문서에서 확정된 내용과 새로 해석한 내용을 구분한다.
- 아직 정해지지 않은 수치나 콘텐츠는 임의로 확정하지 않는다.
- 같은 규칙을 여러 문서에 복제하지 않고 기준 문서로 연결한다.
- 파일명과 주요 용어는 영문 대문자 스네이크 표기를 사용하고 본문은 한국어로 작성한다.
- Git 작성자 정보가 없으면 임의의 이름이나 이메일을 설정하지 않고 커밋 직전에 사용자에게 요청한다.

---

### Task 1: 최상위 게임 원칙 수립

**Files:**
- Create: `docs/GAME_PRINCIPLES.md`
- Source: `docs/initialization/initial discussion.md`
- Source: `docs/any-ideas/free-ideas.md`
- Reference: `docs/superpowers/specs/2026-08-11-documentation-architecture-design.md`

**Interfaces:**
- Consumes: 기존 기획의 플레이어 역할, 핵심 재미, 개인 신뢰도, 정보 카드, 30초 온보딩 요구
- Produces: 나머지 공식 문서가 참조할 최상위 규칙과 기능 검토 체크리스트

- [ ] **Step 1: 생성 전 상태를 확인한다**

Run:

```powershell
Test-Path -LiteralPath 'docs/GAME_PRINCIPLES.md'
```

Expected: `False`

- [ ] **Step 2: `GAME_PRINCIPLES.md`를 작성한다**

문서는 아래 순서와 내용을 사용한다.

```markdown
# Dungeon Schemer 게임 원칙

## 이 문서의 지위
모든 기능과 콘텐츠는 이 원칙을 따라야 하며, 충돌 시 이 문서가 우선한다.

## 변하지 않는 핵심
1. 플레이어는 전투원이 아니라 던전 길잡이다.
2. 핵심 재미는 전투 자체보다 정보, 신뢰, 배신, 정치에서 나온다.
3. 용사와 던전 중 어느 한쪽도 정답으로 취급하지 않는다.
4. 중요한 선택에는 이득과 위험이 함께 존재해야 한다.
5. 신뢰도는 파티원 개인별로 관리한다.
6. 진실, 거짓, 중립 정보 선택은 핵심 의사결정 수단이다.
7. 플레이어 선택은 실제 던전 진행과 결과에 영향을 줘야 한다.
8. 게임 시작 후 30초 안에 역할과 단기 목표를 이해할 수 있어야 한다.
9. 구현 편의를 이유로 핵심 원칙을 훼손하지 않는다.

## 기능 검토 체크리스트
- 이 기능이 길잡이라는 역할을 강화하는가?
- 정보와 신뢰를 이용한 의미 있는 결정을 제공하는가?
- 선택의 이득, 위험, 결과가 플레이어에게 전달되는가?
- 한쪽 선택만 항상 유리해지지 않는가?
- 파티원 개인의 성격과 신뢰도가 의미 있게 작동하는가?
- 핵심 원칙과 충돌한다면 기능을 수정하거나 제외했는가?
```

- [ ] **Step 3: 필수 원칙이 모두 포함됐는지 검증한다**

Run:

```powershell
rg -n "던전 길잡이|정보, 신뢰, 배신, 정치|개인별|진실, 거짓, 중립|30초" docs/GAME_PRINCIPLES.md
```

Expected: 각 검색어가 문서에서 한 번 이상 출력된다.

- [ ] **Step 4: 최상위 원칙 문서를 커밋한다**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- 'docs/GAME_PRINCIPLES.md'
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'docs: establish core game principles'
```

Expected: Git 작성자 정보가 설정되어 있으면 커밋 성공. 설정되어 있지 않으면 사용자에게 이름과 이메일을 요청한 후 재시도한다.

---

### Task 2: 게임 개요와 핵심 루프 문서화

**Files:**
- Create: `docs/design/GAME_OVERVIEW.md`
- Create: `docs/design/CORE_GAME_LOOP.md`
- Source: `docs/initialization/initial discussion.md`
- Reference: `docs/GAME_PRINCIPLES.md`

**Interfaces:**
- Consumes: Task 1의 최상위 원칙
- Produces: 세부 시스템 문서가 공유할 플레이어 역할, 핵심 재미, 한 판의 단계 정의

- [ ] **Step 1: 두 설계 문서가 아직 없는지 확인한다**

Run:

```powershell
Test-Path -LiteralPath 'docs/design/GAME_OVERVIEW.md'
Test-Path -LiteralPath 'docs/design/CORE_GAME_LOOP.md'
```

Expected: 두 결과 모두 `False`

- [ ] **Step 2: `GAME_OVERVIEW.md`를 작성한다**

다음 섹션을 순서대로 작성한다.

```markdown
# 게임 개요
## 한 줄 소개
## 플레이어 역할
## 핵심 재미
## 양쪽 세력과 줄타기
## 플레이어가 만드는 이야기
## 차별화 기준
## 관련 문서
```

반드시 포함할 사실:

- 플레이어는 용사 파티에 고용된 던전 길잡이다.
- 직접 전투 대신 길 선택, 정보 제공, 아이템 사용, 몰래 방해, 보스와의 거래로 결과에 개입한다.
- 용사를 도우면 사례비, 명성, 신뢰를 얻지만 용사가 강해진다.
- 던전을 도우면 유품, 보스 호감도, 던전 가치를 얻지만 용사의 의심을 산다.
- 게임의 차별점은 전투 관전이 아니라 누구를 믿게 만들고 언제 배신할지 결정하는 데 있다.
- 네 가지 장기 방향은 영웅, 마왕, 지배자, 상인 왕이다.

- [ ] **Step 3: `CORE_GAME_LOOP.md`를 작성한다**

다음 흐름을 기준으로 각 단계의 플레이어 결정과 즉시 피드백을 설명한다.

```text
새 용사 파티 등장
→ 던전 입장
→ 길 선택
→ 이벤트 발생
→ 용사 지원 또는 방해
→ 보스전
→ 결과 정산과 보상
→ 성장 후 새 파티
```

문서 섹션은 `루프 개요`, `단계별 결정`, `결과 피드백`, `반복 플레이의 변화`, `관련 문서`로 구성한다.

- [ ] **Step 4: 핵심 루프와 원칙 연결을 검증한다**

Run:

```powershell
rg -n "길 선택|정보 제공|보스와의 거래|새 용사 파티|결과 정산|관련 문서" docs/design
```

Expected: 두 문서에서 역할, 루프, 관련 문서 항목이 출력된다.

- [ ] **Step 5: 설계 문서를 커밋한다**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- 'docs/design/GAME_OVERVIEW.md' 'docs/design/CORE_GAME_LOOP.md'
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'docs: define game overview and core loop'
```

---

### Task 3: 파티·신뢰와 정보·기만 시스템 문서화

**Files:**
- Create: `docs/systems/PARTY_AND_TRUST.md`
- Create: `docs/systems/INFORMATION_AND_DECEPTION.md`
- Source: `docs/initialization/initial discussion.md`
- Source: `docs/any-ideas/free-ideas.md`
- Reference: `docs/GAME_PRINCIPLES.md`

**Interfaces:**
- Consumes: 개인 신뢰도 원칙과 진실·거짓·중립 선택 원칙
- Produces: 파티 생성, 신뢰 변화, 카드 선택, 능력치 확률 보정의 공식 정의

- [ ] **Step 1: 시스템 문서 생성 전 상태를 확인한다**

Run:

```powershell
Test-Path -LiteralPath 'docs/systems/PARTY_AND_TRUST.md'
Test-Path -LiteralPath 'docs/systems/INFORMATION_AND_DECEPTION.md'
```

Expected: 두 결과 모두 `False`

- [ ] **Step 2: `PARTY_AND_TRUST.md`를 작성한다**

섹션과 핵심 내용:

- `목적`: 파티원마다 다른 이해관계가 생기게 한다.
- `파티 생성`: 매번 3~5명, 직업과 성격 조합은 랜덤이다.
- `직업 예시`: 전사, 궁수, 성직자, 마법사, 도적.
- `성격 예시`: 의심 많음, 정의로움, 탐욕스러움, 신중함, 충동적.
- `개인 신뢰도`: 파티 총합이 아닌 파티원별 값이다.
- `높고 낮은 신뢰의 결과`: 정보 수용, 행동 성공률, 보상, 감시, 정보 무시.
- `신뢰도 0`: 정체 발각과 처형 엔딩.
- `설계 제약`: 구체적인 초기값과 증감량은 확정하지 않는다.
- `관련 문서`: 원칙, 정보 카드, 성장 문서 링크.

- [ ] **Step 3: `INFORMATION_AND_DECEPTION.md`를 작성한다**

섹션과 핵심 내용:

- `목적`: 정보 선택을 핵심 행동으로 만든다.
- `대상`: 용사와 보스 양쪽에 정보를 제공할 수 있다.
- `선택 구조`: 매번 진실, 거짓, 중립 카드 중 하나를 선택한다.
- `진실`: 신뢰 상승과 안정적인 효과.
- `거짓`: 성공 시 큰 이득, 실패 시 신뢰 하락과 적발 위험.
- `중립`: 안전하지만 효과가 약하다.
- `능력치 연결`: 설득력은 진실 효과, 기만은 거짓 성공률, 은신은 배신 적발률에 관여한다.
- `표시 원칙`: 선택 전 예상 위험을 알리고 선택 후 실제 영향을 보여준다.
- `미확정 범위`: 카드 수치, 성공 공식, 카드 풀 크기는 확정하지 않는다.
- `관련 문서`: 원칙, 파티·신뢰, 성장 문서 링크.

- [ ] **Step 4: 시스템 핵심어와 미확정 범위를 검증한다**

Run:

```powershell
rg -n "3~5명|개인 신뢰도|신뢰도 0|진실|거짓|중립|확정하지 않는다" docs/systems/PARTY_AND_TRUST.md docs/systems/INFORMATION_AND_DECEPTION.md
```

Expected: 파티 규모, 개인 신뢰, 카드 유형, 미확정 범위가 출력된다.

- [ ] **Step 5: 파티와 정보 시스템 문서를 커밋한다**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- 'docs/systems/PARTY_AND_TRUST.md' 'docs/systems/INFORMATION_AND_DECEPTION.md'
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'docs: define trust and information systems'
```

---

### Task 4: 던전·보스와 성장·엔딩 시스템 문서화

**Files:**
- Create: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- Create: `docs/systems/PROGRESSION_AND_ENDINGS.md`
- Source: `docs/initialization/initial discussion.md`
- Source: `docs/any-ideas/free-ideas.md`
- Reference: `docs/design/CORE_GAME_LOOP.md`

**Interfaces:**
- Consumes: 핵심 루프, 지원·방해 선택, 능력치와 신뢰도 관계
- Produces: 이벤트 분류, 보스전 개입, 던전 상태 변화, 성장과 엔딩 방향

- [ ] **Step 1: 대상 문서 생성 전 상태를 확인한다**

Run:

```powershell
Test-Path -LiteralPath 'docs/systems/DUNGEON_EVENTS_AND_BOSSES.md'
Test-Path -LiteralPath 'docs/systems/PROGRESSION_AND_ENDINGS.md'
```

Expected: 두 결과 모두 `False`

- [ ] **Step 2: `DUNGEON_EVENTS_AND_BOSSES.md`를 작성한다**

다음 내용을 포함한다.

- 던전 진행은 길 선택과 이벤트의 연속이다.
- 이벤트 분류는 몬스터, 휴식, 상인, 특수 사건이다.
- 가능한 행동 예시는 용사 지원, 몬스터 지원, 관망, 식량·치료 제공, 도둑질, 독 타기, 정보 수집, 구매다.
- 특수 사건에는 배신 제안, 보스 밀거래, 의문의 계약서, 암살 의뢰가 있다.
- 보스전에서는 양쪽 지원, 약점 공개, 함정 활성화, 정보 제공, 버프 제공이 가능하다.
- 특정 조건에서 직접 개입할 수 있으나 조건과 수치는 확정하지 않는다.
- 보스 종류와 총수는 기존 아이디어에 후보만 있으므로 확정하지 않는다.

- [ ] **Step 3: `PROGRESSION_AND_ENDINGS.md`를 작성한다**

다음 내용을 포함한다.

- 성장 능력치는 설득력, 기만, 생존, 정보 수집, 협상, 은신이다.
- 성장 효과는 행동과 정보 선택의 성공 가능성에 관여한다.
- 용사가 죽으면 던전 경험치, 몬스터 강화, 함정 생성, 보스 진화, 희귀 보상 증가 방향으로 변한다.
- 용사가 계속 클리어하면 던전 약화, 보물 감소, 보스 세력 약화 방향으로 변한다.
- 엔딩은 영웅, 마왕, 지배자, 상인 왕의 네 방향이다.
- 엔딩 판정의 정확한 임계값과 성장 수치는 확정하지 않는다.

- [ ] **Step 4: 이벤트와 성장 문서를 검증한다**

Run:

```powershell
rg -n "몬스터|휴식|상인|특수 사건|보스전|설득력|기만|영웅|마왕|지배자|상인 왕" docs/systems/DUNGEON_EVENTS_AND_BOSSES.md docs/systems/PROGRESSION_AND_ENDINGS.md
```

Expected: 이벤트 분류, 능력치, 네 엔딩 방향이 출력된다.

- [ ] **Step 5: 던전과 성장 시스템 문서를 커밋한다**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- 'docs/systems/DUNGEON_EVENTS_AND_BOSSES.md' 'docs/systems/PROGRESSION_AND_ENDINGS.md'
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'docs: define dungeon progression and endings'
```

---

### Task 5: 온보딩·인터페이스와 개발 환경 문서화

**Files:**
- Create: `docs/experience/ONBOARDING_AND_INTERFACE.md`
- Create: `docs/technical/DEVELOPMENT_ENVIRONMENT.md`
- Source: `docs/any-ideas/free-ideas.md`
- Source: `docs/initialization/initial discussion.md`
- Source: `docs/initialization/Development_Environment.md`
- Reference: `docs/initialization/proto_image.png`

**Interfaces:**
- Consumes: 30초 이해 원칙, 핵심 루프, 초기 화면 스케치, 기존 기술 선택
- Produces: 첫 사용자 경험 요구와 공식 기술 스택 설명

- [ ] **Step 1: 대상 문서 생성 전 상태를 확인한다**

Run:

```powershell
Test-Path -LiteralPath 'docs/experience/ONBOARDING_AND_INTERFACE.md'
Test-Path -LiteralPath 'docs/technical/DEVELOPMENT_ENVIRONMENT.md'
```

Expected: 두 결과 모두 `False`

- [ ] **Step 2: `ONBOARDING_AND_INTERFACE.md`를 작성한다**

다음 섹션과 내용을 포함한다.

- `온보딩 목표`: 30초 안에 내가 길잡이라는 점, 누구를 도울 수 있는지, 현재 목표를 이해시킨다.
- `첫 화면에서 보여줄 정보`: 현재 던전 위치, 파티와 적, 현재 이벤트, 행동 선택지, 자원과 신뢰 상태.
- `튜토리얼 전달 방식`: 짧은 초반 이야기와 첫 선택을 결합하고 설명만 이어지는 방식을 피한다.
- `주요 화면 영역`: 전투·이동 장면, 이벤트·선택 패널, 던전 분기 지도, 결과 화면.
- `피드백 원칙`: 선택 직후 신뢰, 자원, 전투 상태, 던전 상태 변화를 보여준다.
- `초기 참고 이미지`: `../initialization/proto_image.png` 링크와 초기 와이어프레임이라는 설명.
- `미확정 범위`: 최종 배치, 색상, 아트 스타일은 확정하지 않는다.

- [ ] **Step 3: `DEVELOPMENT_ENVIRONMENT.md`를 작성한다**

기존 선택을 다음 계층으로 정리한다.

```text
개발 환경: GitHub Codespaces
애플리케이션: Next.js, React, TypeScript
UI와 모션: Tailwind CSS, Framer Motion
클라이언트 상태: Zustand
백엔드와 데이터: Supabase
배포: Vercel
```

각 기술의 역할만 설명하며 버전, 패키지 구성, 인증 방식은 확정하지 않는다.

- [ ] **Step 4: UX와 기술 문서를 검증한다**

Run:

```powershell
rg -n "30초|던전 분기 지도|proto_image.png|Next.js|TypeScript|Zustand|Supabase|Vercel" docs/experience/ONBOARDING_AND_INTERFACE.md docs/technical/DEVELOPMENT_ENVIRONMENT.md
```

Expected: 온보딩 목표, 이미지 링크, 기존 기술 선택이 출력된다.

- [ ] **Step 5: UX와 기술 문서를 커밋한다**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- 'docs/experience/ONBOARDING_AND_INTERFACE.md' 'docs/technical/DEVELOPMENT_ENVIRONMENT.md'
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'docs: document onboarding and development stack'
```

---

### Task 6: 문서 지도 작성과 전체 무결성 검증

**Files:**
- Create: `docs/README.md`
- Verify: `docs/GAME_PRINCIPLES.md`
- Verify: `docs/design/*.md`
- Verify: `docs/systems/*.md`
- Verify: `docs/experience/*.md`
- Verify: `docs/technical/*.md`

**Interfaces:**
- Consumes: Task 1~5에서 생성한 공식 문서 9개
- Produces: 공식 문서 읽기 순서, 우선순위, 원본 자료 링크를 제공하는 단일 진입점

- [ ] **Step 1: 공식 문서 9개가 존재하는지 확인한다**

Run:

```powershell
$paths = @(
  'docs/GAME_PRINCIPLES.md',
  'docs/design/GAME_OVERVIEW.md',
  'docs/design/CORE_GAME_LOOP.md',
  'docs/systems/PARTY_AND_TRUST.md',
  'docs/systems/INFORMATION_AND_DECEPTION.md',
  'docs/systems/DUNGEON_EVENTS_AND_BOSSES.md',
  'docs/systems/PROGRESSION_AND_ENDINGS.md',
  'docs/experience/ONBOARDING_AND_INTERFACE.md',
  'docs/technical/DEVELOPMENT_ENVIRONMENT.md'
)
$paths | ForEach-Object { [pscustomobject]@{ Path = $_; Exists = Test-Path -LiteralPath $_ } }
```

Expected: 모든 항목의 `Exists`가 `True`

- [ ] **Step 2: `docs/README.md`를 작성한다**

섹션은 `문서의 목적`, `문서 우선순위`, `추천 읽기 순서`, `공식 문서`, `기존 원본 자료`, `문서 갱신 규칙`으로 구성한다.

추천 읽기 순서:

1. `GAME_PRINCIPLES.md`
2. `design/GAME_OVERVIEW.md`
3. `design/CORE_GAME_LOOP.md`
4. 작업 대상에 해당하는 `systems`, `experience`, `technical` 문서

공식 문서 9개와 기존 파일 4개를 모두 상대 링크로 연결한다. 기존 문서는 아이디어 출처이며 공식 규칙 변경은 관련 공식 문서에 반영해야 한다고 명시한다.

- [ ] **Step 3: 공식 문서 수와 원본 무변경 상태를 검증한다**

Run:

```powershell
$official = @(
  'docs/README.md',
  'docs/GAME_PRINCIPLES.md',
  'docs/design/GAME_OVERVIEW.md',
  'docs/design/CORE_GAME_LOOP.md',
  'docs/systems/PARTY_AND_TRUST.md',
  'docs/systems/INFORMATION_AND_DECEPTION.md',
  'docs/systems/DUNGEON_EVENTS_AND_BOSSES.md',
  'docs/systems/PROGRESSION_AND_ENDINGS.md',
  'docs/experience/ONBOARDING_AND_INTERFACE.md',
  'docs/technical/DEVELOPMENT_ENVIRONMENT.md'
)
($official | Where-Object { Test-Path -LiteralPath $_ }).Count
& 'C:\Program Files\Git\cmd\git.exe' diff --exit-code -- 'docs/any-ideas/free-ideas.md' 'docs/initialization/Development_Environment.md' 'docs/initialization/initial discussion.md' 'docs/initialization/proto_image.png'
```

Expected: 첫 결과가 `10`, Git diff 명령이 exit code `0`

- [ ] **Step 4: 임시 문구와 Markdown 공백 오류를 검사한다**

Run:

```powershell
$markers = @(
  (-join (84,79,68,79 | ForEach-Object { [char]$_ })),
  (-join (84,66,68 | ForEach-Object { [char]$_ })),
  (-join (102,105,108,108,32,105,110,32,100,101,116,97,105,108,115 | ForEach-Object { [char]$_ })),
  (-join (105,109,112,108,101,109,101,110,116,32,108,97,116,101,114 | ForEach-Object { [char]$_ }))
)
rg -n ([string]::Join('|', $markers)) docs/README.md docs/GAME_PRINCIPLES.md docs/design docs/systems docs/experience docs/technical
& 'C:\Program Files\Git\cmd\git.exe' diff --check
```

Expected: 첫 명령은 검색 결과 없이 exit code `1`, 두 번째 명령은 출력 없이 exit code `0`

- [ ] **Step 5: 문서 지도를 커밋한다**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- 'docs/README.md'
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'docs: add canonical documentation index'
```

- [ ] **Step 6: 최종 저장소 상태를 확인한다**

Run:

```powershell
& 'C:\Program Files\Git\cmd\git.exe' status --short
```

Expected: 계획·설계 문서를 제외한 공식 문서 변경이 모두 커밋되어 있고, 의도하지 않은 파일 변경이 없다.
