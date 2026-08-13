# 프로토타입 작업 배정표 재설계 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`를 8행 배정표에서 의존성과 완료 기준을 담은 20행 배정표로 바꾸고, 이를 참조하는 상위 문서의 설명을 맞춘다.

**Architecture:** 문서만 변경한다. 배정표를 계층 L0~L4로 나눈 다섯 개 표로 재작성하고, 각 행에 `선행`과 `풀리는 것`을 양방향으로 기록한다. 두 열이 서로 정확한 역방향인지는 임시 검증 스크립트로 기계적으로 확인한다.

**Tech Stack:** Markdown, mermaid (GitHub 렌더링), 검증용 Python 3 스크립트(임시, 커밋하지 않음)

## Global Constraints

- 커밋 메시지는 제목과 본문을 포함해 항상 한글로 작성한다. (`AGENTS.md`)
- 작업 브랜치는 `feature/prototype-work-assignment-dependencies`이며 `main`에 직접 push하지 않는다. (`docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md`)
- 이 작업은 문서만 바꾼다. 게임 코드, 의존성, 설정 파일, 다른 공식 설계 문서의 규칙은 건드리지 않는다.
- 담당자 칸은 비워 둔다. 팀이 직접 채운다.
- 미확정 수치와 밸런스 값을 확정하지 않는다.
- 상태 표기는 `⬜ 대기`, `🟡 진행 중`, `✅ 완료` 셋만 사용한다.
- 새 배정표의 행은 정확히 20개다. L0 5행, L1 5행, L2 2행, L3 5행, L4 3행.

### 원본 콘텐츠의 출처

배정표 20행의 표 내용과 mermaid 그래프는 **이미 커밋된 spec 문서**에 확정된 형태로 들어 있다.

```text
docs/superpowers/specs/2026-08-12-lattebun-prototype-work-assignment-design.md
```

계획서에 같은 표를 다시 옮겨 적지 않는다. 두 벌이 되면 서로 어긋날 수 있기 때문이다. 아래 태스크에서 "spec의 `## 배정표` 섹션"이라고 지시하면 위 파일의 해당 섹션을 그대로 사용한다는 뜻이다.

---

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | 구현 영역, 의존성, 담당자, 진행 상태의 단일 출처 | 전면 재작성 |
| `docs/README.md` | 공식 문서 목록과 읽기 순서 | 배정표 항목 설명 1줄 수정 |
| `README.md` | 저장소 진입점 | 배정표 링크 설명 1줄 수정 |

검증 스크립트는 `/tmp/claude-1000/-workspaces-Dungeon-Schemer/a815e390-e843-4ed2-b622-1221ebbddf93/scratchpad/`에 두고 커밋하지 않는다.

---

## Task 1: 배정표 문서 재작성

**Files:**
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` (전체 27줄을 대체)

**Interfaces:**
- Consumes: spec 문서의 `## 배정표`, `## 의존성 그래프`, `## 진행 순서와 3트랙`, `## 관리 원칙`, `## 프로토타입 범위` 섹션
- Produces: 이후 태스크가 검증하고 참조할 20행 배정표. 행 ID는 `F1`~`F5`, `R1`~`R5`, `P1`, `P2`, `U1`~`U5`, `Q1`~`Q3`

- [ ] **Step 1: 기존 문서와 spec을 나란히 읽는다**

```bash
cat docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
cat docs/superpowers/specs/2026-08-12-lattebun-prototype-work-assignment-design.md
```

기존 문서의 `## 관리 원칙` 4개 항목 중 다음 두 가지는 새 문서에서도 유지한다는 점을 확인한다.

- 담당자는 구현을 맡기로 합의한 사람의 이름 또는 식별자를 적는다.
- 세부 작업은 각 영역의 spec과 plan에서 관리하며, 이 표에는 큰 구현 책임만 기록한다.

- [ ] **Step 2: 새 문서를 다음 6개 섹션 구조로 작성한다**

`docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`를 아래 순서로 전면 교체한다.

**1) `# 프로토타입 작업 배정표`** 다음에 `## 목적`:

```markdown
## 목적

이 문서는 Dungeon Schemer 프로토타입의 구현 영역, 구현 순서, 담당자를 한곳에서 관리한다.

작업을 시작하기 전에 `선행` 열의 항목이 모두 완료되었는지 확인하고, 담당자와 상태를 갱신한다.
```

**2) `## 프로토타입 범위`** — spec의 `## 프로토타입 범위` 섹션을 그대로 옮긴다. 포함(`CORE_GAME_LOOP.md` 1~7단계)과 범위 밖 5개 항목을 모두 적는다. 범위 밖 목록에 저장·복원이 들어 있는지 확인한다.

**3) `## 의존성 그래프`** — spec의 `## 의존성 그래프` 섹션의 mermaid 블록을 그대로 옮긴다. `Q3`을 그래프에서 제외한다는 주석 문장도 함께 옮긴다.

**4) `## 진행 순서와 3트랙`** — spec의 동명 섹션을 그대로 옮긴다. 1차 선행 스프린트 표, 2차 3트랙 표, 트랙 교차 2개 항목, 3차 마감을 모두 포함한다.

**5) `## 배정표`** — spec의 `## 배정표` 섹션의 다섯 개 표(`### L0 기반 — 선행 필수`, `### L1 규칙 — UI 없는 순수 로직`, `### L2 흐름`, `### L3 화면`, `### L4 마감`)를 그대로 옮긴다. 열 순서는 `ID | 구현 영역 | 완료 기준 | 선행 | 풀리는 것 | 담당 | 상태`이며 `담당`은 빈칸, `상태`는 전부 `⬜`이다.

**6) `## 관리 원칙`** — spec의 `## 관리 원칙` 섹션 8개 항목을 그대로 옮긴다.

문서 끝에 관련 문서 링크를 붙인다.

```markdown
## 관련 문서

- [게임 원칙](../GAME_PRINCIPLES.md)
- [핵심 게임 루프](../design/CORE_GAME_LOOP.md)
- [팀 개발 워크플로](TEAM_DEVELOPMENT_WORKFLOW.md)
- [개발 환경](DEVELOPMENT_ENVIRONMENT.md)
- [배정표 재설계 spec](../superpowers/specs/2026-08-12-lattebun-prototype-work-assignment-design.md)
```

- [ ] **Step 3: 행 개수와 섹션을 눈으로 확인한다**

```bash
grep -c '^| [FRPUQ][0-9] ' docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
grep '^## ' docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
```

기대 결과:

```text
20
## 목적
## 프로토타입 범위
## 의존성 그래프
## 진행 순서와 3트랙
## 배정표
## 관리 원칙
## 관련 문서
```

행 개수가 20이 아니면 빠진 행을 찾아 채운다.

- [ ] **Step 4: 범위 밖으로 옮긴 항목이 표에 남아 있지 않은지 확인한다**

```bash
grep -n '저장\|Supabase\|로그인\|엔딩\|성장' docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
```

기대 결과: 모든 결과가 `## 프로토타입 범위`의 "범위 밖" 목록 안에만 있어야 한다. 배정표의 20개 행 안에 나오면 안 된다.

- [ ] **Step 5: 커밋**

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "문서: 배정표를 의존성 포함 20행으로 재작성

8개 큰 영역을 계층 L0~L4의 20행으로 나누고 각 행에 완료 기준,
선행, 풀리는 것, 상태를 추가한다.

- 규칙과 화면을 분리해 규칙의 완료 기준을 테스트 통과로 정의한다.
- 의존성 그래프와 3트랙 진행 순서를 추가한다.
- 시드, 테스트 도구, 콘텐츠, 접근성, 배포 영역을 행으로 만든다.
- 범위 밖인 저장 전략을 표에서 빼고 범위 절에 명시한다."
```

---

## Task 2: 의존성 일관성 검증

**Files:**
- Create: `/tmp/claude-1000/-workspaces-Dungeon-Schemer/a815e390-e843-4ed2-b622-1221ebbddf93/scratchpad/check_deps.py` (커밋하지 않음)
- Modify: `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` (검증 실패 시에만)

**Interfaces:**
- Consumes: Task 1이 만든 배정표의 `ID`, `선행`, `풀리는 것` 열
- Produces: 세 가지가 보장된 배정표 — (1) `풀리는 것`이 `선행`의 정확한 역방향, (2) 존재하지 않는 ID 참조 없음, (3) 순환 의존 없음

- [ ] **Step 1: 검증 스크립트를 작성한다**

`check_deps.py`에 아래 내용을 그대로 쓴다. 배정표의 마크다운 표를 파싱해 `선행` 열에서 그래프를 만들고, 역방향을 계산해 `풀리는 것` 열과 대조한다.

```python
import re
import sys

DOC = "docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md"
ID_RE = re.compile(r"^[FRPUQ]\d$")

rows = {}
order = []
for line in open(DOC, encoding="utf-8"):
    if not line.startswith("|"):
        continue
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) != 7 or not ID_RE.match(cells[0]):
        continue
    row_id = cells[0]
    if row_id in rows:
        sys.exit(f"중복 ID: {row_id}")
    rows[row_id] = {
        "name": cells[1],
        "needs": re.findall(r"[FRPUQ]\d", cells[3]),
        "unlocks": re.findall(r"[FRPUQ]\d", cells[4]),
        "owner": cells[5],
        "status": cells[6],
    }
    order.append(row_id)

errors = []

if len(rows) != 20:
    errors.append(f"행 개수가 20이 아니라 {len(rows)}개")

# 1. 존재하지 않는 ID 참조
for rid, row in rows.items():
    for ref in row["needs"] + row["unlocks"]:
        if ref not in rows:
            errors.append(f"{rid}: 존재하지 않는 ID {ref} 참조")

# 2. 풀리는 것 == 선행의 역방향
expected = {rid: set() for rid in rows}
for rid, row in rows.items():
    for need in row["needs"]:
        if need in expected:
            expected[need].add(rid)
for rid in order:
    actual = set(rows[rid]["unlocks"])
    if actual != expected[rid]:
        missing = sorted(expected[rid] - actual)
        extra = sorted(actual - expected[rid])
        errors.append(
            f"{rid} 풀리는 것 불일치 | 빠짐: {missing or '없음'} | 잘못됨: {extra or '없음'}"
        )

# 3. 순환 의존
state = {}

def visit(rid, path):
    if state.get(rid) == "done":
        return
    if state.get(rid) == "visiting":
        errors.append("순환 의존: " + " -> ".join(path + [rid]))
        return
    state[rid] = "visiting"
    for need in rows[rid]["needs"]:
        if need in rows:
            visit(need, path + [rid])
    state[rid] = "done"

for rid in order:
    visit(rid, [])

# 4. 담당자는 비어 있고 상태는 대기
for rid, row in rows.items():
    if row["owner"]:
        errors.append(f"{rid}: 담당자 칸이 비어 있지 않음 ({row['owner']})")
    if row["status"] != "⬜":
        errors.append(f"{rid}: 상태가 ⬜ 가 아님 ({row['status']})")

if errors:
    print(f"실패 {len(errors)}건")
    for e in errors:
        print(" -", e)
    sys.exit(1)

print(f"통과: {len(rows)}행, 간선 {sum(len(r['needs']) for r in rows.values())}개, 순환 없음")
```

- [ ] **Step 2: 스크립트를 실행해 결과를 확인한다**

```bash
python3 "/tmp/claude-1000/-workspaces-Dungeon-Schemer/a815e390-e843-4ed2-b622-1221ebbddf93/scratchpad/check_deps.py"
```

기대 결과:

```text
통과: 20행, 간선 45개, 순환 없음
```

`실패 N건`이 나오면 출력된 항목을 그대로 읽고 `PROTOTYPE_WORK_ASSIGNMENT.md`의 해당 행을 고친다. `풀리는 것 불일치`가 나오면 `선행` 열을 정답으로 삼고 `풀리는 것`을 고친다. 고칠 때마다 Step 2를 다시 실행해 통과할 때까지 반복한다.

- [ ] **Step 3: mermaid 그래프의 간선이 표와 일치하는지 확인한다**

스크립트가 검사하는 것은 표뿐이다. 그래프는 눈으로 대조한다. 그래프의 각 `X --> Y` 간선에 대해 표에서 `Y`의 `선행`에 `X`가 있는지 확인한다. `&`로 묶인 줄은 각각을 개별 간선으로 센다.

예: 그래프의 `R2 --> R3 & R5 & U1`은 표에서 `R3`의 선행에 `R2`, `R5`의 선행에 `R2`, `U1`의 선행에 `R2`가 있어야 한다.

간선 총수는 Step 2가 출력한 숫자(45개)와 같아야 한다.

- [ ] **Step 4: 수정이 있었다면 커밋**

Step 2나 Step 3에서 문서를 고쳤을 때만 실행한다. 고칠 게 없었으면 이 단계를 건너뛴다.

```bash
git add docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md
git commit -m "문서: 배정표 의존성 열 불일치 수정

선행과 풀리는 것이 서로 역방향이 되도록 맞춘다."
```

---

## Task 3: 상위 문서의 배정표 설명 갱신

**Files:**
- Modify: `docs/README.md` (기술 섹션의 배정표 항목 1줄)
- Modify: `README.md` (문서 목록의 배정표 항목 1줄)

**Interfaces:**
- Consumes: Task 1이 확정한 배정표의 성격(의존성과 구현 순서를 포함)
- Produces: 없음. 마지막 문서 변경이다.

- [ ] **Step 1: `docs/README.md`의 배정표 설명을 바꾼다**

찾을 문자열:

```markdown
- [PROTOTYPE_WORK_ASSIGNMENT.md](technical/PROTOTYPE_WORK_ASSIGNMENT.md): 프로토타입의 큰 구현 영역과 담당자 배정표
```

바꿀 문자열:

```markdown
- [PROTOTYPE_WORK_ASSIGNMENT.md](technical/PROTOTYPE_WORK_ASSIGNMENT.md): 프로토타입의 구현 영역 20개와 선행 관계, 구현 순서, 담당자 배정표
```

- [ ] **Step 2: `README.md`의 배정표 설명을 바꾼다**

찾을 문자열:

```markdown
- [프로토타입 작업 배정표](docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md): 구현 영역과 담당자 배정 확인
```

바꿀 문자열:

```markdown
- [프로토타입 작업 배정표](docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md): 구현 영역, 선행 관계, 구현 순서, 담당자 배정 확인
```

- [ ] **Step 3: 배정표를 가리키는 다른 설명이 남아 있는지 확인한다**

```bash
grep -rn 'PROTOTYPE_WORK_ASSIGNMENT' --include='*.md' . | grep -v '^./docs/superpowers/'
```

기대 결과: `docs/README.md`와 `README.md`의 두 줄만 나온다. 다른 파일에 설명이 더 있으면 같은 기준으로 맞춘다.

- [ ] **Step 4: 커밋**

```bash
git add docs/README.md README.md
git commit -m "문서: 배정표 설명에 선행 관계와 구현 순서 반영

배정표가 의존성과 구현 순서를 담게 되었으므로 이를 가리키는
문서 목록의 설명을 맞춘다."
```

---

## Task 4: Pull Request 생성

**Files:** 없음 (git 작업만)

**Interfaces:**
- Consumes: Task 1~3의 커밋 전부
- Produces: `main`을 대상으로 하는 Pull Request

- [ ] **Step 1: 브랜치와 커밋 목록을 확인한다**

```bash
git branch --show-current
git log --oneline main..HEAD
git status --short
```

기대 결과: 브랜치가 `feature/prototype-work-assignment-dependencies`이고, 커밋이 4개 안팎(spec, 배정표 재작성, 필요 시 수정, 상위 문서 갱신)이며, 작업 트리가 깨끗하다.

- [ ] **Step 2: 변경 파일이 문서뿐인지 확인한다**

```bash
git diff --stat main..HEAD
```

기대 결과: `.md` 파일만 나온다. `package.json`, `app/`, `lib/`, 잠금 파일이 나오면 실수이므로 되돌린다.

이 변경은 코드를 건드리지 않으므로 `pnpm lint`, `pnpm typecheck`, `pnpm build`는 실행하지 않는다. `TEAM_DEVELOPMENT_WORKFLOW.md`의 검증 명령은 코드 변경에 적용된다.

- [ ] **Step 3: 브랜치를 push한다**

```bash
git push -u origin feature/prototype-work-assignment-dependencies
```

- [ ] **Step 4: Pull Request를 만든다**

```bash
gh pr create --base main --title "문서: 프로토타입 작업 배정표에 의존성과 구현 순서 추가" --body "$(cat <<'PRBODY'
## 배경

기존 배정표는 8개의 큰 영역과 담당자 칸만 있어서, 세 명이 병렬로 작업할 때 무엇을 먼저 끝내야 하는지 판단할 수 없었다.

## 변경

- 8행을 계층 L0~L4의 20행으로 나눈다.
- 규칙(L1)과 화면(L3)을 분리해 규칙의 완료 기준을 테스트 통과로 정의한다.
- 각 행에 `완료 기준`, `선행`, `풀리는 것`, `상태` 열을 추가한다.
- 의존성 그래프와 3트랙 진행 순서를 추가한다.
- 누락되어 있던 랜덤 시드, 테스트 도구, 콘텐츠 데이터, 접근성, 배포 연결을 행으로 만든다.
- 범위 밖인 저장 전략을 표에서 빼고 `프로토타입 범위` 절에 명시한다.

## 확인 방법

- 배정표의 `선행`과 `풀리는 것`이 서로 정확한 역방향인지 20행 전부 대조했다.
- 의존성 그래프에 순환이 없다.
- 문서만 변경했다. 코드와 의존성은 건드리지 않았다.

## 리뷰 요청 사항

- 20개 행의 분할이 실제 배정 단위로 적절한지
- `F1 도메인 타입`을 한 사람이 단독으로 먼저 끝내는 1차 스프린트 구성에 동의하는지
- 담당자 칸은 비워 두었다. 병합 후 또는 리뷰 중에 채운다.

## 관련 문서

- spec: `docs/superpowers/specs/2026-08-12-lattebun-prototype-work-assignment-design.md`
- plan: `docs/superpowers/plans/2026-08-12-lattebun-prototype-work-assignment.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
)"
```

- [ ] **Step 5: PR URL을 사용자에게 전달한다**

```bash
gh pr view --json url,title,number
```

출력된 URL을 사용자에게 알린다. `TEAM_DEVELOPMENT_WORKFLOW.md`에 따라 작업자가 아닌 팀원 한 명의 확인이 필요하다는 점도 함께 전달한다.

---

## 완료 조건

- `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`에 20행 배정표, 의존성 그래프, 3트랙 진행 순서, 관리 원칙이 있다.
- 검증 스크립트가 `통과: 20행, 간선 45개, 순환 없음`을 출력한다.
- `docs/README.md`와 `README.md`의 배정표 설명이 새 내용과 맞는다.
- `main`을 대상으로 하는 Pull Request가 열려 있고 URL을 사용자가 받았다.
- 코드와 의존성 파일은 변경되지 않았다.
