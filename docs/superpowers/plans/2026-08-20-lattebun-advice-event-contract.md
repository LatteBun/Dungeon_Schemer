# 조언·사건 통합 계약 구현 계획 (`D9` + `F1-2`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카드와 사건을 하나로 합치는 규칙을 설정집에 반영하고(`D9`), 그 규칙을 담는 도메인 타입으로 갈아끼운다(`F1-2`).

**Architecture:** 문서를 먼저 고치고 타입을 그 뒤에 맞춘다. 이 개편의 교훈이 `상수의 근거는 코드가 아니라 문서에 먼저 적혀 있다`이므로, 타입이 문서보다 앞서면 그 타입은 근거를 대지 못한다. 콘텐츠(`F3-1`~`F3-3`)와 규칙(`E2'`·`E3'`)은 이 계획의 범위가 아니다. 이 계획이 끝나면 타입은 컴파일되지만 그 타입을 쓰는 데이터는 아직 없다 — `F1`이 그랬던 것과 같은 상태다.

**Tech Stack:** TypeScript, Vitest, pnpm

**Spec:** [조언·사건 통합 설계](../specs/2026-08-20-lattebun-advice-event-merge-design.md)

## Global Constraints

- 커밋 메시지는 제목과 본문을 포함해 **항상 한글**로 쓴다
- `main`에 직접 push하지 않는다. `feature/` 또는 `docs/` 브랜치에서 작업하고 PR을 만든다
- 검증 명령은 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` 넷이다
- 규칙 수치를 바꾸면 근거가 되는 설정집 문서를 **같은 변경 단위에서** 함께 고친다
- 문서 정합성은 파일 하나가 아니라 `docs/` 전체를 훑어 확인한다
- 콘텐츠 검증 실패는 조용히 재추첨하지 않고 `RuleError("INVALID_GENERATION", ...)`로 보고한다
- 성격 5종(`suspicious` `righteous` `greedy` `prudent` `impulsive`)과 신뢰 범위 0~100은 이 계획에서 바꾸지 않는다

> **Task 7~9는 하나의 타입 마이그레이션이다.** 옛 타입을 지우는 순간 그 타입을 내보내는 배럴과 참조하는 파일이 함께 깨지므로, 중간 커밋에서 `pnpm typecheck`가 실패하는 것이 정상이다. 각 Task는 자기 단위 테스트(`lib/domain/advice.test.ts`)만 통과시키고, **전체 초록은 Task 10 Step 4에서 확인한다.** 중간에 typecheck가 빨갛다고 멈추지 않는다. 대신 Task 10을 건너뛰지 않는다.

## 이 계획이 정한 것 (spec에 없던 결정)

spec이 타입 수준까지 정하지 않은 셋을 여기서 확정한다.

| 타입 | 결정 | 근거 |
| --- | --- | --- |
| `InfoSubject` · `INFO_SUBJECTS` | 제거 | `EventKind`와 분류가 겹친다. 체계를 둘 두면 한쪽만 고쳐진다. `boss` 주제는 `bossDamageModifier` 유무가 대신한다 |
| `InfoCard` · `INFO_CARDS` | 제거 | spec의 폐기 목록에 `떠 있는 카드 풀 36장`이 있다 |
| `InfoClaim` | 제거 | 소비처가 없고 `InfoRecord.pendingVerification`과 역할이 같다 |

`route` 주제는 사라진다. 합병 모델에서 경로 선택은 지도 화면의 몫이고 사건이 다루지 않는다.

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `docs/GAME_PRINCIPLES.md` | 최상위 기준 | 원칙 2 교체 |
| `docs/systems/INFORMATION_AND_DECEPTION.md` | 조언 규칙 | 대폭 개정 |
| `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md` | 사건·지도·보스 | 정보 기회표·사건 계약·연계 |
| `docs/systems/CHARACTERS_AND_TRUST.md` | 신뢰 판정 | 공통 행동 2줄 추가 |
| `docs/design/CORE_GAME_LOOP.md` | 루프 | 2단 선택 → 1단 |
| `docs/experience/SCREEN_LAYOUT.md` | 화면 규격 | 진행 화면 구조 |
| `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` | 작업 기준 | 항목 재편 |
| `lib/domain/ids.ts` | 브랜드 ID | `ClueId` 추가 |
| `lib/domain/info.ts` | 조언 판정 타입 | 대폭 교체 |
| `lib/domain/content.ts` | 사건 콘텐츠 타입 | `SituationEvent`로 흡수 |
| `lib/domain/index.ts` | 배럴 | 내보내기 갱신 |
| `lib/domain/__checks__.ts` | 컴파일 타임 계약 | 새 닫힌 목록 검사 |
| `lib/content/info-cards.ts` | 옛 카드 36장 | **삭제** |

---

## Task 1: 브랜치를 만들고 게임 원칙 2를 고친다

**Files:**
- Modify: `docs/GAME_PRINCIPLES.md:21-31`

**Interfaces:**
- Consumes: 없음
- Produces: 원칙 2가 조언 모델을 규정한다. 이후 모든 문서가 이 원칙을 근거로 삼는다

- [ ] **Step 1: main에서 브랜치를 딴다**

PR을 쌓지 않는다. 항상 `main`에서 딴다.

```bash
git checkout main
git pull --ff-only
git checkout -b feature/d9-f1-2-advice-contract
```

- [ ] **Step 2: 고칠 문구가 실제로 있는지 확인한다**

```bash
grep -n "진실·거짓·중립 카드를 받는 대상" docs/GAME_PRINCIPLES.md
```

Expected: 1건 나온다. 0건이면 누가 먼저 고친 것이므로 멈추고 확인한다.

- [ ] **Step 3: 원칙 2를 교체한다**

`docs/GAME_PRINCIPLES.md`에서 `### 2. 정보는 용사 파티에게 전달한다` 제목부터 `보스에게 파티 정보를 넘기거나 보스와 거래하는 행동은 프로토타입에서 제거한다.`까지를 통째로 아래로 바꾼다.

```markdown
### 2. 길잡이는 조언으로 개입한다

플레이어는 직접 행동하지 않는다. 살아 있는 용사 파티원에게 조언하고, 한 명이라도 받아들이면 실행된다. 조언은 도움·방해·중립 세 유형이다.

- 도움은 던전의 생태 규칙과 정합하며 파티에게 이롭다.
- 방해는 생태 규칙과 모순되며 파티에게 해롭다. 적발 위험이 따른다.
- 중립은 규칙과 무관해 효과가 약하지만 안전하다.

조언의 유형은 선택 전에 어떤 방식으로도 표시하지 않는다. 플레이어는 던전의 생태 규칙과 현장 단서로 어느 조언이 무엇을 낳을지 추론한다.

한 지점에서 고르는 것은 한 번뿐이다. 정보 전달과 사건 행동을 따로 고르지 않는다.

보스에게 파티 정보를 넘기거나 보스와 거래하는 행동은 프로토타입에서 제거한다.
```

- [ ] **Step 4: 옛 표현이 사라졌는지 확인한다**

```bash
grep -n "진실·거짓·중립\|진실은 안정적인\|거짓은 큰 전술적" docs/GAME_PRINCIPLES.md
```

Expected: 0건. `docs/GAME_PRINCIPLES.md` 안에서만 확인한다. 다른 문서는 이후 Task가 고친다.

- [ ] **Step 5: 커밋한다**

```bash
git add docs/GAME_PRINCIPLES.md
git commit -m "$(cat <<'EOF'
문서: 게임 원칙 2를 조언 모델로 바꾼다

플레이어가 카드를 전달하는 것이 아니라 조언한다. 진실·거짓·중립을
도움·방해·중립으로 바꾸고 한 지점에서 한 번만 고른다는 조항을 넣는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 정보와 기만 문서를 조언 모델로 개정한다

**Files:**
- Modify: `docs/systems/INFORMATION_AND_DECEPTION.md`

**Interfaces:**
- Consumes: Task 1의 원칙 2
- Produces: 조언 판정의 공식 규칙. `F1-2` 타입과 `E2'` 구현이 이 문서를 근거로 삼는다

- [ ] **Step 1: `대상과 주제` 절을 `대상과 조언`으로 바꾼다**

`## 대상과 주제`부터 `` `보스 관련 정보`는 보스에게 주는 카드가 아니라 파티에게 보스에 관해 알려주는 카드다. ``까지를 아래로 교체한다.

```markdown
## 대상과 조언

조언을 받는 대상은 살아 있는 용사 파티원뿐이다. 보스에게 파티 정보를 제공하거나 보스와 거래하지 않는다.

한 지점은 상황 묘사와 조언 3개로 이루어진다. 조언은 도움·방해·중립을 한 개씩 담고, 유형은 선택 전에 감춘다.

조언은 효과가 언제 나타나는지로 갈린다.

| 시점 | 뜻 | 예 |
| --- | --- | --- |
| 즉시형 | 이 사건의 결과를 바꾼다 | 「횃불을 던지세요」로 거미가 흩어져 용사 피해가 준다 |
| 지연형 | 보스전까지 효과를 들고 간다 | 「보스의 왼쪽은 굳어 있습니다」로 보스 피해가 준다 |

대부분은 즉시형이다. 지연형은 보스 관련 정보뿐이며 위험도별로 횟수를 보장한다.

`보스 관련 정보`는 보스에게 주는 조언이 아니라 파티에게 보스에 관해 알려주는 조언이다.
```

- [ ] **Step 2: `정보 전달 기회` 표를 교체한다**

`## 정보 전달 기회` 절의 표와 그 아래 문단을 아래로 바꾼다. 흐름 도식(```text 블록)도 함께 교체한다.

```markdown
## 조언 기회

**모든 일반 지점이 조언 기회다.** 지점 수가 곧 조언 횟수이므로 따로 세지 않는다. 지연형만 횟수를 보장한다.

| 현재 위험도 | ★1 | ★2 | ★3 | ★4 | ★5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 일반 지점 = 조언 기회 | 6 | 6 | 7 | 8 | 8 |
| 그중 보스 정보 보장(지연형) | 1 | 1 | 2 | 2 | 2 |

일반 지점 수는 초기 위험도로 정해 고정하고, 보스 정보 보장은 현재 위험도를 따른다. 실패로 위험도가 오른 던전은 다음 도전에서 보스 정보 기회가 늘어난다.

방문하지 않은 갈림길의 조언은 횟수에 포함하지 않는다.

```text
지점 선택
→ 상황 묘사 확인
→ 조언 3개 중 하나 선택
→ 살아 있는 파티원별 수용·의심·적발 판정
→ 한 명이라도 수용하면 실행, 아무도 수용하지 않으면 기본 결과
→ 결과와 신뢰 변화
```
```

- [ ] **Step 3: `진위와 생태 규칙` 절을 `유형과 생태 규칙`으로 바꾼다**

`## 진위와 생태 규칙`부터 `활성 규칙마다 진실·거짓·중립이 각각 2장 이상 있어야 한다.`까지를 교체한다.

```markdown
## 유형과 생태 규칙

조언의 유형은 그 던전의 **활성 규칙**에 대해 정해진다. 각 조언은 `참조 규칙` 식별자와 정합·모순 태그를 가진다. 규칙 자체의 계약은 [던전 테마와 생태](DUNGEON_THEMES_AND_ECOLOGY.md)에 있다.

| 유형 | 활성 규칙과의 관계 | 파티에게 |
| --- | --- | --- |
| 도움 | 정합 | 이롭다 |
| 방해 | 모순 | 해롭다 |
| 중립 | 무관 | 약한 효과 |

### 도움

- 참조 규칙과 정합한다.
- 수용되면 안정적인 효과와 신뢰 상승을 제공한다.
- 의심받으면 효과를 적용하지 않고 이후 결과를 검증한다.

### 방해

- 참조 규칙과 모순된다.
- 수용되면 파티가 손해를 보고, 적발되지 않으면 실수로 보인다.
- 적발되거나 이후 사실이 드러나면 개인 신뢰가 크게 하락한다.

### 중립

- 규칙과 무관하지만 해롭지 않다.
- 수용되면 도움보다 약한 효과를 준다.
- 즉시 신뢰를 바꾸지 않는 비교적 안전한 선택이다.

같은 조언이라도 참조하는 규칙이 활성이 아닌 던전에서는 제시되지 않는다. 활성 규칙마다 도움·방해·중립이 각각 2개 이상 있어야 한다.
```

- [ ] **Step 4: 반응 확률표의 유형 이름을 바꾸고 실행 규칙을 넣는다**

`## 파티원별 독립 반응` 절에서 표의 `진실`·`중립`·`거짓`을 `도움`·`중립`·`방해`로 바꾼다. `적발은 거짓에서만 나온다`를 `적발은 방해에서만 나온다`로 바꾼다. 보정표의 `정의로움 | 진실 +15, 거짓 -10`을 `정의로움 | 도움 +15, 방해 -10`으로 바꾼다. `정의로운 성격의 수용 보정은 중립에 적용하지 않는다. 진실·중립의 수용 확률은...` 문단에서 `진실·중립`을 `도움·중립`으로, `거짓은 적발률을`을 `방해는 적발률을`로 바꾼다.

그리고 `## 파티원별 독립 반응` 절 끝에 아래를 덧붙인다.

```markdown
### 실행

파티원 3명이 각자 판정하지만 행동은 하나다. **한 명이라도 수용하면 실행된다.**

- 수용한 파티원 중 하나가 조언대로 행동하고, 상황 효과는 파티 전체에 적용된다
- 의심한 파티원은 실행에 참여하지 않았지만 결과는 함께 받는다
- 아무도 수용하지 않으면 조언은 실행되지 않고 사건은 **기본 결과**로 흘러간다

기본 결과는 사건마다 콘텐츠가 제공한다. 파티원 전원이 의심할 확률이 방해 조언에서 약 6%, 도움에서 약 3%라 원정마다 한두 번은 나온다. 기본 결과는 파티가 길잡이 없이 처리한 결과이며 효과는 중립보다도 약하거나 없다. 조언을 실행하지 않았으므로 신뢰는 움직이지 않는다.

즉시형은 파티 전체가 결과를 받는다. **지연형만 수용한 파티원에게 적용한다** — 보스 피해 보정은 개인이 들고 가는 믿음이기 때문이다.
```

- [ ] **Step 5: 반응 결과와 보스 보정표의 유형 이름을 바꾼다**

`## 반응 결과` 절을 아래로 교체한다.

```markdown
## 반응 결과

- 도움 수용: 효과 적용, `adviceHelped` 신뢰 판정
- 방해 수용: 효과 적용, `adviceHarmed` 신뢰 판정, 미검증 기록
- 중립 수용: 약한 효과 적용, 즉시 신뢰 변화 없음
- 의심: 효과 없음, 의심 검증 기록
- 방해 적발: 효과 없음, `adviceHarmed`와 `deceptionExposed` 신뢰 판정
```

`## 보스 관련 정보` 절의 표에서 `진실`→`도움`, `거짓`→`방해`로 바꾼다. `보스 관련 보장이 2회인 위험도에서 보스 카드 두 장을 수용하면`을 `보스 관련 보장이 2회인 위험도에서 보스 조언 둘을 수용하면`으로 바꾼다.

- [ ] **Step 6: 단서와 연계 절을 새로 넣는다**

`## 미검증 정보와 사후 검증` 절 **앞에** 아래를 삽입한다.

```markdown
## 단서와 연계

모든 사건의 상황 묘사는 관찰 가능한 사실을 담는다. 규칙을 직접 말하지 않고 보이는 것으로만 드러낸다.

> 바닥과 벽에는 오래된 거미줄이 잔뜩 붙어 있다

**단서 목록을 화면에 상시 표시하지 않는다.** 던전이 6~8지점이라 기억 부담이 감당 가능하고, 목록이 있으면 관찰이 체크리스트가 된다. 놓친 단서는 원정이 끝난 뒤 정산 회고가 짚는다.

연계는 단서 하나로 표현하고 세기만 둘로 나눈다.

| 세기 | 규칙 |
| --- | --- |
| 약한 연계 | 단서를 보유하면 조언 세 슬롯 중 하나가 강화판으로 교체된다 |
| 강한 연계 | 단서를 보유하지 않으면 그 사건이 배치되지 않는다 |

강화판은 네 번째 선택지로 추가되지 않는다. 선택지는 항상 3개다. 교체 대상 슬롯은 콘텐츠가 정하며, 도움 슬롯일 수도 방해 슬롯일 수도 있다. 관찰의 보상은 정답을 알려주는 것이 아니라 수단이 늘어나는 것이다.
```

- [ ] **Step 7: 카드 풀 계약 절을 조언 콘텐츠 계약으로 교체한다**

문서 맨 끝 `## 카드 풀 계약` 절 전체를 아래로 바꾼다.

```markdown
## 조언 콘텐츠 계약

사건 하나는 상황 묘사와 조언 3개로 이루어지고, 조언은 도움·방해·중립을 정확히 한 개씩 담는다.

각 사건은 다음을 가진다.

- 상황 묘사. 관찰 가능한 사실을 담고 단서를 실어 나른다
- 조언 3개. 각각 선택지 문구, 고블린의 근거 대사, 결과 문구를 가진다
- 각 조언의 참조 규칙 식별자와 정합·모순 태그. 중립은 참조 규칙이 없다
- 아무도 수용하지 않았을 때의 기본 결과 문구
- 강화판이 있으면 교체할 슬롯과 그 대체 조언

사건은 생태 규칙을 참조하면 테마 전용이고, 참조하지 않으면 공용이다. 공용 사건은 모든 테마의 던전에 나온다.

| 구분 | 수량 |
| --- | ---: |
| 테마 전용 | 테마당 16 |
| 공용 | 15 |
| 한 테마에서 만날 수 있는 것 | 31 |

사건 식별자·문구는 중복되거나 비어 있을 수 없다. 한 던전 안에서 같은 사건을 두 번 쓰지 않는다.

콘텐츠 검증은 수량·문구·태그를 확인하며 유형 판정, 수용·의심·적발 확률, 개인별 반응, 보스 피해 보정은 계산하지 않는다. 이 데이터 계약을 실제 결과로 해석하는 것은 규칙의 몫이다.

계약을 만족하지 않으면 조용히 재추첨하지 않고 생성 오류로 보고한다.
```

- [ ] **Step 8: 남은 옛 표현을 훑는다**

```bash
grep -n "진실\|거짓\|카드" docs/systems/INFORMATION_AND_DECEPTION.md
```

Expected: `진실`·`거짓`은 0건. `카드`는 문서 제목이나 링크가 아닌 본문에서 0건이어야 한다. 남아 있으면 문맥에 맞게 `조언`으로 바꾼다.

- [ ] **Step 9: 커밋한다**

```bash
git add docs/systems/INFORMATION_AND_DECEPTION.md
git commit -m "$(cat <<'EOF'
문서: 정보와 기만을 조언 모델로 개정한다

카드를 상황에 묶인 조언으로 바꾸고 즉시형과 지연형으로 가른다. 정보 기회표를
폐기하고 모든 지점을 조언 기회로 삼되 보스 정보만 횟수를 보장한다. 한 명이라도
수용하면 실행한다는 규칙과 단서·연계를 새로 적는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 던전 이벤트와 보스 문서를 개정한다

**Files:**
- Modify: `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`

**Interfaces:**
- Consumes: Task 2의 조언 규칙
- Produces: 사건 배치 계약과 전 경로 공통 지점 요구. `E1`·`E3'`가 근거로 삼는다

- [ ] **Step 1: 공개 정보 절의 카드 언급을 고친다**

`## 공개 정보` 절에서 `- 정보 전달 기회가 있는 지점` 줄을 삭제한다(모든 지점이 조언 기회이므로 표시할 것이 없다). `정확한 피해·보상·난수 결과와 카드 내용은 숨긴다. 카드 유형은 선택 전에 어떤 방식으로도 표시하지 않는다.`를 아래로 바꾼다.

```markdown
정확한 피해·보상·난수 결과와 조언 내용은 숨긴다. 조언 유형은 선택 전에 어떤 방식으로도 표시하지 않는다.
```

- [ ] **Step 2: 지도 절에 전 경로 공통 지점을 넣는다**

`## 위험도별 지도` 절의 첫 문단 `던전의 위험은 ★1~★5로 표시한다...` 바로 뒤에 아래 문단을 넣는다.

```markdown
지도는 각 지점이 **모든 경로가 반드시 지나는 지점인지**를 함께 정한다. 강한 연계로 묶인 사건 쌍을 놓으려면 선행과 후행이 둘 다 공통 지점이어야 하기 때문이다. 분기 위에 선행을 놓으면 다른 길로 간 플레이어는 조건을 영영 채우지 못한다.
```

`어떤 경로를 골라도 길이와 정보 전달 기회 수가 같다.`를 `어떤 경로를 골라도 길이와 조언 기회 수가 같다.`로 바꾼다.

- [ ] **Step 3: 사건 분류 절에 조언 통합과 연계를 반영한다**

`각 사건은 하나 이상의 행동을 가지며 행동 대상, 예상 이득, 알려진 위험을 함께 제공한다. 정보 전달 기회가 있는 지점에서도 카드 반응 뒤에 사건 행동을 별도로 선택한다.`를 아래로 교체한다.

```markdown
각 사건은 상황 묘사와 조언 3개를 가진다. **한 지점에서 고르는 것은 한 번뿐이다.** 조언 반응 뒤에 사건 행동을 따로 고르지 않는다.

사건은 생태 규칙을 참조하면 테마 전용이고, 참조하지 않으면 공용이다. `monster`는 전부 테마 전용이고 `rest`·`merchant`는 공용이며 `special`은 양쪽에 걸친다.

### 강한 연계

일부 사건은 선행 단서를 요구한다. 그 단서를 남기는 사건을 방문하지 않았으면 배치되지 않는다.

| 초기 위험도 | ★1 | ★2 | ★3 | ★4 | ★5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 강한 연계 쌍 | 0 | 0 | 1 | 1 | 2 |

★1·★2가 0인 것은 의도다. 저위험 던전은 플레이어가 생태를 배우는 곳이라 조건부 콘텐츠 없이 깨끗해야 한다.

연계 쌍 하나가 전 경로 공통 지점 2곳을 쓴다. 따라서 지도는 ★3·★4에서 공통 지점을 2곳 이상, ★5에서 4곳 이상 보장해야 한다. 만족하지 못하면 연계 쌍 수를 줄이지 않고 생성 오류를 반환한다. 조용히 줄이면 위험도별 난이도가 시드마다 달라진다.
```

- [ ] **Step 4: 일반 진행 도식을 1단으로 고친다**

`## 일반 진행` 절의 ```text 블록을 아래로 바꾼다.

```text
계약 수락 후 답사 기록과 지도 확인
→ 지도에서 지점 선택
→ 상황 묘사 확인
→ 조언 3개 중 하나 선택
→ 파티원별 수용·의심·적발과 실행
→ HP·신뢰·자원 변화와 사유
→ 다음 지도
```

- [ ] **Step 5: 보스전 절의 유형 이름을 바꾼다**

`## 보스전` 절에서 `- 수용한 보스 정보 카드`를 `- 수용한 보스 조언`으로, `- 파티원별 카드 반응과 미검증 기록`을 `- 파티원별 조언 반응과 미검증 기록`으로 바꾼다. `보스방에서는 새 카드를 제시하지 않는다.`를 `보스방에서는 새 조언을 제시하지 않는다.`로 바꾼다.

프로토타입 피해 보정 목록의 `수용한 진실`→`수용한 도움`, `수용한 중립`→그대로, `수용한 거짓`→`수용한 방해`로 바꾼다.

- [ ] **Step 6: 콘텐츠 데이터 계약 절을 고친다**

`## 콘텐츠 데이터 계약` 절의 목록에서 `- 사건마다 선택지 2개 이상을 가진다`를 아래로 바꾼다.

```markdown
- 사건마다 조언을 정확히 3개 가지며 도움·방해·중립을 한 개씩 담는다
- 사건마다 아무도 수용하지 않았을 때의 기본 결과를 가진다
```

- [ ] **Step 7: 남은 옛 표현을 훑는다**

```bash
grep -n "정보 전달 기회\|카드 유형\|카드 반응\|진실\|거짓" docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
```

Expected: 0건.

- [ ] **Step 8: 커밋한다**

```bash
git add docs/systems/DUNGEON_EVENTS_AND_BOSSES.md
git commit -m "$(cat <<'EOF'
문서: 사건을 조언과 합치고 전 경로 공통 지점을 요구한다

한 지점에서 조언을 한 번만 고른다. 강한 연계 쌍이 공통 지점 2곳을 쓰므로
지도가 위험도별 공통 지점 하한을 보장하고, 못 채우면 생성 오류를 낸다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 신뢰 판정에 조언 결과 두 줄을 더한다

**Files:**
- Modify: `docs/systems/CHARACTERS_AND_TRUST.md`

**Interfaces:**
- Consumes: Task 2의 반응 결과
- Produces: `adviceHelped` · `adviceHarmed` 공통 행동. `E2'`가 이 값으로 신뢰를 계산한다

- [ ] **Step 1: 공통 행동 의미표에 두 줄을 더한다**

`| 위험 회피 | 안전을 우선해 위험을 피하는 선택 |` 줄 뒤에 아래를 넣는다.

```markdown
| 조언 성공 | 조언대로 해서 결과가 좋았던 상황 |
| 조언 실패 | 조언대로 했는데 결과가 나빴던 상황 |
```

- [ ] **Step 2: 성격별 변화량표에 두 줄을 더한다**

`| 위험 회피 | +7 | +3 | 0 | +12 | -10 |` 줄 뒤에 아래를 넣는다.

```markdown
| `adviceHelped` 조언 성공 | +2 | +3 | +2 | +3 | +4 |
| `adviceHarmed` 조언 실패 | -4 | -3 | -3 | -4 | -2 |
```

- [ ] **Step 3: 왜 작은 값인지 근거를 적는다**

성격별 변화량표 바로 아래, `정보 카드 판정 추가 행동:` 앞에 아래 문단을 넣는다.

```markdown
`adviceHelped`와 `adviceHarmed`만 값이 작다. 모든 일반 지점이 조언 기회라 원정 하나에서 18~24회 판정하기 때문이다. 다른 행동과 같은 크기를 쓰면 던전 하나에서 신뢰가 바닥과 천장을 오간다.

작게 자주 움직이는 것이 맞는 이유가 하나 더 있다. 캐릭터 30명에 원정마다 3명이면 1인당 평균 출전이 1.5회다. 신뢰가 극적인 순간에만 움직이면 대부분의 캐릭터가 시작 신뢰 그대로 캠페인을 끝낸다.

방해를 골랐는데 적발되지 않으면 `adviceHarmed`만 적용된다. 파티는 조언이 그냥 틀렸다고 본다. 적발되면 `deceptionExposed`가 추가로 발동해 크게 하락한다. 고의와 실수의 차이가 여기서 갈린다.
```

- [ ] **Step 4: 정보 카드 판정 추가 행동표의 이름을 고친다**

`정보 카드 판정 추가 행동:`을 `조언 사후 검증 추가 행동:`으로 바꾼다. 그 표의 `deceptionAccepted` 설명 `거짓 정보가 믿어져 일시적으로 신뢰를 얻음`을 `방해 조언이 믿어져 일시적으로 신뢰를 얻음`으로, `suspicionWasCostly`의 `정보를 의심해 파티가 손해를 봄`을 `조언을 의심해 파티가 손해를 봄`으로, `suspicionWasCorrect`의 `정보를 의심해 파티가 이득을 봄`을 `조언을 의심해 파티가 이득을 봄`으로 바꾼다.

- [ ] **Step 5: 남은 옛 표현을 훑는다**

```bash
grep -n "정보 카드\|진실·거짓" docs/systems/CHARACTERS_AND_TRUST.md
```

Expected: 0건.

- [ ] **Step 6: 커밋한다**

```bash
git add docs/systems/CHARACTERS_AND_TRUST.md
git commit -m "$(cat <<'EOF'
문서: 조언 결과로 신뢰가 움직이는 두 행동을 더한다

모든 지점이 조언 기회라 원정당 18~24회 판정하므로 값을 작게 둔다. 1인당
평균 출전이 1.5회라 자주 조금씩 움직여야 신뢰가 표현될 자리를 얻는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 루프와 화면 규격 문서를 1단 선택으로 고친다

**Files:**
- Modify: `docs/design/CORE_GAME_LOOP.md`
- Modify: `docs/experience/SCREEN_LAYOUT.md`
- Modify: `docs/experience/ONBOARDING_AND_INTERFACE.md`

**Interfaces:**
- Consumes: Task 2·3의 규칙
- Produces: `U5` 진행 화면이 근거로 삼을 구조

> **주의: 「카드」가 둘 있다.** `SCREEN_LAYOUT.md`의 47행과 87행, 97행의 `공고 카드`·`클릭 가능한 카드`는 **게시판 공고**를 가리키며 조언과 무관하다. 절대 고치지 않는다. 아래 지정한 자리만 고친다.

- [ ] **Step 1: `CORE_GAME_LOOP.md`를 고친다**

51행 `→ 정보 전달 기회가 있으면 카드 선택과 개인별 반응`을 아래로 바꾼다.

```text
→ 상황 묘사를 보고 조언 3개 중 하나를 선택, 개인별 반응
```

58행 문단 전체를 아래로 바꾼다.

```markdown
모든 일반 지점이 조언 기회다. 지연형 조언인 보스 관련 정보만 현재 위험도를 따라 ★1·★2 1회, ★3~★5 2회를 보장한다. 조언의 유형은 선택 전에 보이지 않으며, 플레이어는 공개된 생태 규칙과 현장 단서로 판단한다. 사건 행동을 조언과 별도로 선택하지 않는다.
```

62행에서 `보스방에서는 새 카드나 직접 전투 개입을 제공하지 않는다.`를 `보스방에서는 새 조언이나 직접 전투 개입을 제공하지 않는다.`로, `수용한 보스 정보 카드를 입력으로`를 `수용한 보스 조언을 입력으로`로, `보스 정보의 진위와 의심 결과도`를 `보스 조언의 유형과 의심 결과도`로 바꾼다.

88행 표 줄을 아래로 바꾼다.

```markdown
| 조언 | `adviceOpportunity` | 상황 묘사를 보고 조언 세 개 중 하나를 선택 |
```

113행 `- 즉시: 카드 반응, 사건 결과, HP·신뢰·아이템 변화`를 `- 즉시: 조언 반응, 사건 결과, HP·신뢰·아이템 변화`로 바꾼다.

- [ ] **Step 2: `SCREEN_LAYOUT.md`를 고친다**

38행 표 줄을 아래로 바꾼다.

```markdown
| 진행 | 상 40% 장면 슬롯 / 하 60% 상황 묘사 + 조언 3개 | 실시간 파티 상태 · 최근 반응 |
```

67행 문단을 아래로 바꾼다.

```markdown
왼쪽을 위아래로 나눈다. 위 40%는 파티가 움직이고 싸우는 장면 슬롯이고, 아래 60%는 상황 묘사와 조언 3개다. 상황 묘사가 추론의 근거를 실어 나르므로 조언보다 먼저 읽히도록 놓는다. 조언 본문이 넓은 자리를 필요로 해 비율을 조정하더라도, 조작 영역이 장면보다 넓다는 원칙은 유지한다.
```

69행 문단에서 `카드 3장은 항상 같은 디자인이다.`를 `조언 3개는 항상 같은 디자인이다.`로, `화면이 지는 몫은 세 장이 시각적으로 구별되지 않게 하는 것과`를 `화면이 지는 몫은 셋이 시각적으로 구별되지 않게 하는 것과`로, `추론의 근거인 상황 설명과 답사 기록을`을 `추론의 근거인 상황 묘사와 답사 기록을`로 바꾼다.

109행 `카드 유형은 색으로도 텍스트로도 표시하지 않는다.`를 `조언 유형은 색으로도 텍스트로도 표시하지 않는다.`로 바꾼다.

123행에서 `카드 선택, 반응 표시`를 `조언 선택, 반응 표시`로 바꾼다.

97행의 `장면·선택 카드·최근 반응 구획`은 레퍼런스 이미지의 구획 이름이므로 `장면·선택지·최근 반응 구획`으로 바꾼다.

- [ ] **Step 3: `ONBOARDING_AND_INTERFACE.md`를 고친다**

19행에서 `첫 던전의 정보 전달 기회에서는 같은 카드가 파티원마다 다르게 받아들여지는 모습을 즉시 보여준다.`를 `첫 던전의 조언 기회에서는 같은 조언이 파티원마다 다르게 받아들여지는 모습을 즉시 보여준다.`로 바꾼다. 같은 행 앞부분의 `첫 정보 전달에 붙인다`는 `첫 조언에 붙인다`로 바꾼다.

29행 표 줄을 아래로 바꾼다. 사건 행동이 따로 없어졌다.

```markdown
| 5 | 던전 진행 | 상황 묘사와 조언 3개, 파티원별 반응 |
```

74행 `숨기기로 한 정확한 피해·보상과 카드 내용을`을 `숨기기로 한 정확한 피해·보상과 조언 내용을`로 바꾼다.

82행 `카드 세 장은 같은 디자인으로 놓이고`를 `조언 셋은 같은 디자인으로 놓이고`로 바꾼다.

86행 `그 카드가 어떤 활성 규칙과 정합했는지`를 `그 조언이 어떤 활성 규칙과 정합했는지`로 바꾼다.

98행 `- 수용한 보스 정보 카드와 피해 보정`을 `- 수용한 보스 조언과 피해 보정`으로 바꾼다.

100행 `- 거짓 또는 의심의 사후 검증`을 `- 방해 또는 의심의 사후 검증`으로 바꾼다.

- [ ] **Step 4: 세 문서를 훑는다**

```bash
grep -n "진실\|거짓\|카드 3장\|카드 세 장\|카드 유형\|정보 전달 기회" docs/design/CORE_GAME_LOOP.md docs/experience/SCREEN_LAYOUT.md docs/experience/ONBOARDING_AND_INTERFACE.md
```

Expected: 0건.

```bash
grep -n "카드" docs/experience/SCREEN_LAYOUT.md
```

Expected: 47행과 87행만 남는다. 둘 다 게시판 공고를 가리키므로 그대로 두는 것이 맞다.

- [ ] **Step 5: docs 전체를 훑는다**

관리 원칙이 `문서 정합성은 파일 하나가 아니라 docs/ 전체를 훑어 확인한다`고 요구한다.

```bash
grep -rn "진실·거짓·중립\|정보 전달 기회" docs/ --include="*.md" | grep -v "docs/meetings/" | grep -v "docs/superpowers/" | grep -v "docs/any-ideas/" | grep -v "docs/initialization/"
```

Expected: 0건. 회의록·spec·원본 자료는 기록이므로 고치지 않는다.

- [ ] **Step 6: 커밋한다**

```bash
git add docs/design/CORE_GAME_LOOP.md docs/experience/SCREEN_LAYOUT.md docs/experience/ONBOARDING_AND_INTERFACE.md
git commit -m "$(cat <<'EOF'
문서: 루프와 화면을 조언 한 번 고르는 구조로 맞춘다

한 지점에서 카드와 사건 행동을 따로 고르던 흐름을 지운다. 진행 화면 좌측
하단이 상황 묘사와 조언 3개를 함께 담는다. 셸 비율은 건드리지 않는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 배정표를 재편한다

**Files:**
- Modify: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`
- Test: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.test.ts` (실행만)

**Interfaces:**
- Consumes: Task 1~5의 문서 개정
- Produces: `D9` `F1-2` `F3-1` `F3-2` `F3-3` `F5'` 항목. 이후 모든 작업이 이 표를 기준으로 삼는다

- [ ] **Step 1: 무결성 검사가 지금 통과하는지 먼저 본다**

```bash
pnpm test -- CAMPAIGN_REWORK_WORK_ASSIGNMENT
```

Expected: PASS. 고치기 전 기준선을 잡는다.

- [ ] **Step 2: 새 행을 넣고 기존 행을 고친다**

배정표의 `## 배정표` 표에서 다음을 한다.

`D8` 행 뒤에 새 행을 넣는다.

```markdown
| D9 | 조언·사건 통합 문서 개정 | 게임 원칙 2가 조언 모델로 바뀌고, `진실·거짓·중립`과 `정보 전달 기회`가 `docs/`(회의록·spec·원본 제외)에서 0건이며, 조언 콘텐츠 계약과 강한 연계·전 경로 공통 지점이 적힘 | — | **F1-2** |  | ⬜ |
```

`F1` 행 뒤에 새 행을 넣는다.

```markdown
| F1-2 | 조언 도메인 타입 개정 | `AdviceOutcome`·`EcologyRelation`·`ClueId`·`SituationEvent`·`AdviceOption`이 있고 `TruthType`·`InfoCard`·`InfoSubject`·`InfoClaim`·`DungeonEvent`·`EventChoice`가 제거되며 타입 검사와 전체 테스트 통과 | D9 | **F3-1** |  | ⬜ |
```

`F3` 행을 삭제하고 그 자리에 세 행을 넣는다.

```markdown
| F3-1 | 조언 콘텐츠 계약·검증기와 공용 사건 | 사건 검증기가 조언 3개·도움방해중립 각 1개·기본 결과·중복·빈 문구를 검사하고 위반 시 생성 오류를 반환하며, 생태 규칙을 참조하지 않는 공용 사건 15개가 검증을 통과 | F1-2 | **F3-2 F3-3 E3** |  | ⬜ |
| F3-2 | 조언 콘텐츠 · 거미굴 | 거미굴 생태 규칙을 참조하는 전용 사건 16개가 있고, 활성 규칙마다 도움·방해·중립이 각각 2개 이상이며, 단서를 남기는 사건과 강한 연계 사건이 각각 1개 이상 존재하고 검증 통과 | F3-1 | **E2 E3** |  | ⬜ |
| F3-3 | 조언 콘텐츠 · 사막·묘지 | 사막·묘지도 같은 계약으로 전용 사건 16개씩을 채우고 검증 통과 | F3-1 | **E2 E3** |  | ⬜ |
```

`F5` 행을 아래로 교체한다.

```markdown
| F5 | 아이템 콘텐츠 | 치료제·독·식량·정보 두루마리·유인용 미끼 5종과 가격이 있고, 식별자·문구 중복과 빈 값이 없으며 부족하면 생성 오류를 반환 | — | **E3** |  | ⬜ |
```

`E1` 행의 완료 기준 끝에 아래를 덧붙인다.

```text
, 각 지점이 전 경로 공통인지 노출하고 ★3·★4에 공통 지점 2곳·★5에 4곳을 보장하며 못 채우면 생성 오류
```

`E2` 행을 아래로 교체한다.

```markdown
| E2 | 조언 판정 | 던전마다 활성 규칙 3개를 뽑고 위험도별로 3/2/1개를 공개하며, 조언의 정합·모순이 활성 규칙으로 판정되고, 살아 있는 파티원별 수용·의심·적발을 독립 판정해 한 명이라도 수용하면 실행하며, 아무도 수용하지 않으면 기본 결과가 나오고 보스 정보 보장 1~2회를 모든 경로가 충족 | F3-2 E1 | **E4 U5** |  | ⬜ |
```

`E3` 행을 아래로 교체한다.

```markdown
| E3 | 사건 배치·단서·연계 | 몬스터·휴식·상인·특수 네 분류가 모든 경로에 한 번 이상 나오고 한 던전 안에서 사건이 중복되지 않으며, 방문한 사건의 단서가 누적되어 약한 연계가 슬롯을 교체하고, 위험도별 강한 연계 쌍이 전 경로 공통 지점에 배치되는 테스트 통과 | E1 F3-1 F5 | **E4 U5** |  | ⬜ |
```

`U5` 행의 완료 기준에서 `카드 3장이 같은 디자인으로 유형·발각 위험·예상 신뢰 변화를 감추며`를 `상황 묘사 아래 조언 3개가 같은 디자인으로 유형·발각 위험·예상 신뢰 변화를 감추며`로 바꾼다.

- [ ] **Step 3: 의존성 그래프를 고친다**

```mermaid 블록에서 다음을 한다.

`D8["D8 대표 화면 이미지"]` 뒤에 `D9["D9 조언·사건 문서"]`를 넣는다.
`F1["F1 도메인 계약"]` 뒤에 `F1-2["F1-2 조언 타입"]`을 넣는다.
`F3["F3 카드 풀"]`을 지우고 `F3-1["F3-1 계약·공용"]` `F3-2["F3-2 거미굴"]` `F3-3["F3-3 사막·묘지"]`를 넣는다.
`F5["F5 사건·아이템 콘텐츠"]`를 `F5["F5 아이템 콘텐츠"]`로 바꾼다.

간선에서 `F3 --> E2`를 지우고 아래를 넣는다.

```text
  D9 --> F1-2
  F1-2 --> F3-1
  F3-1 --> F3-2 & F3-3 & E3
  F3-2 --> E2 & E3
  F3-3 --> E2 & E3
```

- [ ] **Step 4: 항목 수와 임계 경로를 고친다**

`아래 37개 항목을 모두 완료하면`을 `아래 41개 항목을 모두 완료하면`으로 바꾼다. (37 − `F3` 1개 + `D9` `F1-2` `F3-1` `F3-2` `F3-3` 5개 = 41)

`### 임계 경로` 절의 ```text 블록을 아래로 바꾼다.

```text
D9 → F1-2 → F3-1 → F3-2 → E3 → E2 → E4 → C4 → C6 → C7 → I1 → I2 → B1 → Q1 → Q2
```

그 아래 설명 문단을 아래로 교체한다.

```markdown
카드와 사건을 합치면서 문서(`D9`)와 타입(`F1-2`)이 앞에 붙었다. 그 뒤의 병목은 조언 콘텐츠다. `F3-3`(사막·묘지)은 임계 경로에 없다 — 거미굴 콘텐츠만으로 `E2`·`E3`·`E4`·`U5`를 전부 개발할 수 있으므로 나중에 채운다.
```

`### 시작 가능한 작업` 절도 새 상태에 맞게 고친다. `D9`가 선행 없이 시작 가능하고, `F3`은 더 이상 시작 가능하지 않다.

- [ ] **Step 5: 무결성 검사와 전체 테스트를 돌린다**

```bash
pnpm test -- CAMPAIGN_REWORK_WORK_ASSIGNMENT
pnpm test
```

Expected: 둘 다 PASS. 무결성 검사가 깨지면 표 형식이나 `선행`·`풀리는 것` 정합성이 어긋난 것이므로 검사가 지적한 곳을 고친다.

- [ ] **Step 6: 커밋한다**

```bash
git add docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md
git commit -m "$(cat <<'EOF'
배정표: 조언·사건 통합에 맞춰 항목을 재편한다

F3과 F5를 F3-1~3과 아이템 전용 F5로 가르고 D9 문서 개정과 F1-2 타입 개정을
연다. E1에 전 경로 공통 지점 요구를 더하고 E2·E3의 경계를 판정과 배치로
나눈다. 임계 경로 앞에 D9와 F1-2가 붙는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `ClueId`와 닫힌 목록 두 개를 만든다

**Files:**
- Modify: `lib/domain/ids.ts`
- Modify: `lib/domain/info.ts`
- Test: `lib/domain/advice.test.ts` (Create)

**Interfaces:**
- Consumes: Task 1~6의 문서
- Produces: `AdviceOutcome`, `ADVICE_OUTCOMES`, `EcologyRelation`, `ECOLOGY_RELATIONS`, `ClueId`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `lib/domain/advice.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { ADVICE_OUTCOMES, ECOLOGY_RELATIONS } from "@/lib/domain";

describe("ADVICE_OUTCOMES", () => {
  it("도움·방해·중립 셋이다", () => {
    expect([...ADVICE_OUTCOMES].toSorted()).toEqual(["harm", "help", "neutral"]);
  });
});

describe("ECOLOGY_RELATIONS", () => {
  it("정합·모순·무관 셋이다", () => {
    expect([...ECOLOGY_RELATIONS].toSorted()).toEqual([
      "consistent",
      "contradictory",
      "unrelated",
    ]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm test -- lib/domain/advice.test.ts
```

Expected: FAIL — `ADVICE_OUTCOMES`를 `@/lib/domain`에서 찾을 수 없다.

- [ ] **Step 3: `ClueId`를 더한다**

`lib/domain/ids.ts`의 `export type MonsterId = Brand<string, "MonsterId">;` 뒤에 넣는다.

```typescript
/** 상황 묘사가 남기는 관찰 결과. 약한 연계와 강한 연계의 유일한 화폐다. */
export type ClueId = Brand<string, "ClueId">;
```

- [ ] **Step 4: `lib/domain/info.ts` 앞부분을 교체한다**

파일 첫 줄부터 `] as const satisfies readonly InfoSubject[];`까지를 아래로 바꾼다.

import 줄은 **바꾸지 않는다.** `InfoCard`와 `InfoClaim`이 아직 남아 있어 `CardId`·`ClaimId`가 계속 필요하다. 둘은 Task 9가 지운다.

```typescript
import type { CardId, ClaimId, CharacterId } from "./ids";

/**
 * 조언의 유형. 플레이어의 의도를 가리킨다.
 *
 * 진위 축은 여기 있지 않다. 조언이 생태 규칙과 어떤 관계인지는
 * EcologyRelation이 따로 들고 있다.
 * docs/systems/INFORMATION_AND_DECEPTION.md
 */
export type AdviceOutcome = "help" | "harm" | "neutral";

export const ADVICE_OUTCOMES = [
  "help",
  "harm",
  "neutral",
] as const satisfies readonly AdviceOutcome[];

/** 조언이 참조 규칙과 맺는 관계. 중립은 unrelated다. */
export type EcologyRelation = "consistent" | "contradictory" | "unrelated";

export const ECOLOGY_RELATIONS = [
  "consistent",
  "contradictory",
  "unrelated",
] as const satisfies readonly EcologyRelation[];

/** 조언의 수신자는 살아 있는 용사 개인으로 제한한다. */
export type Target = { kind: "member"; id: CharacterId };

/** 사건 행동은 역사적 호환성을 위해 보스를 대상으로 삼을 수 있다. */
export type EventTarget = Target | { kind: "boss" };
```

`InfoSubject`와 `INFO_SUBJECTS`는 이 교체로 사라진다.

- [ ] **Step 5: 배럴에 내보낸다**

`lib/domain/index.ts`의 `export { INFO_SUBJECTS, TRUTH_TYPES } from "./info";`를 아래로 바꾼다.

```typescript
export { ADVICE_OUTCOMES, ECOLOGY_RELATIONS } from "./info";
```

같은 파일의 `export type { ... } from "./ids";` 목록에 `ClueId`를 알파벳 순서에 맞게 넣는다(`ClaimId`와 `ClassId` 사이).

- [ ] **Step 6: 통과를 확인한다**

```bash
pnpm test -- lib/domain/advice.test.ts
```

Expected: PASS. 다른 테스트와 타입 검사는 아직 깨져 있다 — Task 8·9가 고친다.

- [ ] **Step 7: 커밋한다**

```bash
git add lib/domain/ids.ts lib/domain/info.ts lib/domain/index.ts lib/domain/advice.test.ts
git commit -m "$(cat <<'EOF'
타입: 조언 유형과 생태 관계를 닫힌 목록으로 놓는다

유형은 도움·방해·중립으로 플레이어의 의도를 가리키고, 생태 규칙과의 관계는
정합·모순·무관으로 따로 둔다. 진위 축이 유형 이름에서 관계 태그로 옮겨간다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `SituationEvent`와 `AdviceOption`을 만든다

**Files:**
- Modify: `lib/domain/content.ts`
- Modify: `lib/domain/index.ts`
- Test: `lib/domain/advice.test.ts` (Modify)

**Interfaces:**
- Consumes: Task 7의 `AdviceOutcome`, `EcologyRelation`, `ClueId`
- Produces: `AdviceOption`, `AdviceUpgrade`, `SituationEvent`. `F3-1`의 검증기와 콘텐츠가 이 모양을 채운다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/domain/advice.test.ts` 끝에 덧붙인다.

```typescript
import type {
  AdviceOption,
  ChoiceId,
  EventId,
  RuleId,
  SituationEvent,
} from "@/lib/domain";

describe("SituationEvent", () => {
  function advice(id: string, outcome: AdviceOption["outcome"]): AdviceOption {
    return {
      id: id as ChoiceId,
      label: "횃불을 하나 집어 거미들 사이의 바닥에 던지세요",
      line: "거미는 불을 싫어한다고 들었어!",
      outcome,
      ruleId: "spider-fire" as RuleId,
      relation: "consistent",
      effectTags: ["support"],
      resultText: "거미들이 불을 피해 한쪽으로 몰린다.",
    };
  }

  it("조언 3개와 기본 결과를 담는다", () => {
    const event: SituationEvent = {
      id: "spider-webbed-hunter" as EventId,
      kind: "monster",
      theme: "spider",
      title: "실에 걸린 사냥꾼",
      description: "바닥과 벽에는 오래된 거미줄이 잔뜩 붙어 있다.",
      advice: [advice("a", "help"), advice("b", "harm"), advice("c", "neutral")],
      defaultResultText: "파티가 알아서 거미를 밀어낸다.",
    };

    expect(event.advice).toHaveLength(3);
    expect(event.defaultResultText).not.toBe("");
  });

  it("단서와 연계를 선택적으로 담는다", () => {
    const event: SituationEvent = {
      id: "spider-molt" as EventId,
      kind: "special",
      theme: "spider",
      title: "허물",
      description: "통로 구석에 커다란 허물이 벗겨져 있다.",
      advice: [advice("a", "help"), advice("b", "harm"), advice("c", "neutral")],
      defaultResultText: "파티가 허물을 지나친다.",
      revealsClue: "spider-molt-seen" as ClueId,
      requiresClue: "spider-brood-seen" as ClueId,
      upgrades: [
        {
          clueId: "spider-molt-seen" as ClueId,
          slotIndex: 0,
          replacement: advice("a-upgraded", "help"),
        },
      ],
    };

    expect(event.revealsClue).toBe("spider-molt-seen");
    expect(event.upgrades?.[0].slotIndex).toBe(0);
  });
});
```

파일 위쪽 import에 `ClueId`를 더한다.

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm test -- lib/domain/advice.test.ts
```

Expected: FAIL — `SituationEvent`와 `AdviceOption`을 찾을 수 없다.

- [ ] **Step 3: `lib/domain/content.ts`의 타입을 교체한다**

`export interface EventChoice { ... }`와 `export interface DungeonEvent { ... }`를 아래로 바꾼다. `EventKind`·`EVENT_KINDS`·`EventEffectTag`·`EVENT_EFFECT_TAGS`·`ItemKind`·`ITEM_KINDS`·`ItemDef`는 그대로 둔다.

```typescript
/**
 * 조언 하나. 상황 안에서 고블린이 건네는 말이다.
 *
 * outcome은 플레이어의 의도이고 relation은 생태 규칙과의 관계다. 둘을 따로
 * 두는 이유가 있다. 유형 이름만으로는 "왜 이것이 도움인가"를 데이터가 설명하지
 * 못해, 검증기가 활성 규칙마다 세 유형이 갖춰졌는지 셀 수 없다.
 * docs/systems/INFORMATION_AND_DECEPTION.md
 */
export interface AdviceOption {
  id: ChoiceId;
  /** "횃불을 하나 집어 거미들 사이의 바닥에 던지세요" */
  label: string;
  /** "거미는 불을 싫어한다고 들었어!" — 고블린이 대는 근거 */
  line: string;
  outcome: AdviceOutcome;
  /** relation이 unrelated면 없다. */
  ruleId?: RuleId;
  relation: EcologyRelation;
  effectTags: readonly EventEffectTag[];
  /** 지연형만 갖는다. 수용한 파티원의 보스 피해를 바꾼다. */
  bossDamageModifier?: number;
  /** 수용됐을 때 보여줄 결과 문구. */
  resultText: string;
}

/** 단서를 보유했을 때 조언 한 슬롯을 강화판으로 바꾼다. */
export interface AdviceUpgrade {
  clueId: ClueId;
  /** 교체할 슬롯. 0·1·2 */
  slotIndex: number;
  replacement: AdviceOption;
}

/**
 * 한 지점에서 벌어지는 일 전체다.
 *
 * 옛 DungeonEvent와 InfoCard를 합친 것이다. 카드가 사건과 따로 있으면 카드가
 * 지금 눈앞의 상황과 무관한 문장이 되어, 플레이어가 대조할 재료가 문장 하나뿐이
 * 된다.
 * docs/superpowers/specs/2026-08-20-lattebun-advice-event-merge-design.md
 */
export interface SituationEvent {
  id: EventId;
  kind: EventKind;
  /** 생태 규칙을 참조하면 테마 전용이고, 공용이면 없다. */
  theme?: ThemeId;
  title: string;
  /** 관찰 가능한 사실을 담는다. 단서가 여기 실린다. */
  description: string;
  /** 도움·방해·중립을 한 개씩, 정확히 3개. */
  advice: readonly AdviceOption[];
  /** 아무도 수용하지 않았을 때. 파티가 자기 방식대로 처리한 결과다. */
  defaultResultText: string;
  /** 이 사건을 방문하면 얻는 단서. */
  revealsClue?: ClueId;
  /** 강한 연계. 이 단서가 없으면 배치되지 않는다. */
  requiresClue?: ClueId;
  /** 약한 연계. */
  upgrades?: readonly AdviceUpgrade[];
}
```

파일 첫 줄의 import를 아래로 바꾼다.

```typescript
import type { ChoiceId, ClueId, EventId, ItemId, RuleId } from "./ids";
import type { AdviceOutcome, EcologyRelation } from "./info";
import type { ThemeId } from "./dungeon";
```

- [ ] **Step 4: 배럴을 고친다**

`lib/domain/index.ts`의 `export type { ... } from "./content";` 목록에서 `DungeonEvent`와 `EventChoice`를 빼고 `AdviceOption`·`AdviceUpgrade`·`SituationEvent`를 넣는다.

- [ ] **Step 5: 통과를 확인한다**

```bash
pnpm test -- lib/domain/advice.test.ts
```

Expected: PASS.

- [ ] **Step 6: 커밋한다**

```bash
git add lib/domain/content.ts lib/domain/index.ts lib/domain/advice.test.ts
git commit -m "$(cat <<'EOF'
타입: 상황과 조언 3개를 담는 사건 타입을 놓는다

옛 DungeonEvent와 InfoCard를 SituationEvent 하나로 합친다. 단서를 남기는
필드와 약한·강한 연계 조건을 함께 둬서 연계가 한 화폐로 표현된다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 옛 타입을 걷어내고 `InfoRecord`를 지연형으로 좁힌다

**Files:**
- Modify: `lib/domain/info.ts`
- Modify: `lib/domain/index.ts`
- Modify: `lib/domain/expedition.ts:50-51`
- Delete: `lib/content/info-cards.ts`

**Interfaces:**
- Consumes: Task 7·8의 새 타입
- Produces: `InfoRecord`가 `outcome` 필드를 갖는 지연형 기록이 된다. `E2'`·`E4`가 이 기록으로 보스 보정과 사후 검증을 한다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/domain/advice.test.ts` 끝에 덧붙인다.

```typescript
describe("InfoRecord", () => {
  it("지연형 조언의 수용 기록을 담는다", () => {
    const record: InfoRecord = {
      eventId: "spider-boss-hint" as EventId,
      adviceId: "a" as ChoiceId,
      outcome: "help",
      characterId: "character-001" as CharacterId,
      reaction: "accepted",
      modifier: -0.2,
      pendingVerification: false,
    };

    expect(record.outcome).toBe("help");
    expect(record.modifier).toBeLessThan(0);
  });
});
```

import에 `InfoRecord`와 `CharacterId`를 더한다.

- [ ] **Step 2: 실패를 확인한다**

```bash
pnpm test -- lib/domain/advice.test.ts
```

Expected: FAIL — `InfoRecord`에 `eventId`·`adviceId`·`outcome`이 없다.

- [ ] **Step 3: `InfoRecord`를 고치고 `InfoCard`·`InfoClaim`을 지운다**

`lib/domain/info.ts`에서 `export interface InfoCard { ... }` 전체와 `export interface InfoClaim { ... }` 전체를 삭제한다. `InfoRecord`를 아래로 바꾼다.

```typescript
/** 조언 하나에 대한 파티원 한 명의 반응. */
export type InfoReaction = "accepted" | "suspected" | "exposed";

/**
 * 지연형 조언을 한 파티원이 수용한 기록이다.
 *
 * 즉시형은 그 자리에서 끝나므로 남기지 않는다. 지연형만 보스전까지 들고
 * 가야 하고, 보스전과 사후 검증이 `누가 무엇을 믿었는지`를 알아야 한다.
 * docs/systems/INFORMATION_AND_DECEPTION.md
 */
export interface InfoRecord {
  eventId: EventId;
  adviceId: ChoiceId;
  /** 그 조언이 실제로 무엇이었는지. 보스전 뒤 의심을 검증할 때 쓴다. */
  outcome: AdviceOutcome;
  characterId: CharacterId;
  reaction: InfoReaction;
  /** 이 조언 하나가 만드는 보스 피해 보정. 합산과 상한은 보스전이 한다. */
  modifier: number;
  /** 수용된 방해라 보스전 뒤 검증할 대상이다. */
  pendingVerification: boolean;
}
```

파일 첫 줄 import를 아래로 바꾼다. 이 파일에 남는 것은 `AdviceOutcome`·`ADVICE_OUTCOMES`·`EcologyRelation`·`ECOLOGY_RELATIONS`·`Target`·`EventTarget`·`InfoReaction`·`InfoRecord` 여덟이고, 그중 ID를 쓰는 것은 `Target`(`CharacterId`)과 `InfoRecord`(`EventId`·`ChoiceId`·`CharacterId`)뿐이다.

```typescript
import type { CharacterId, ChoiceId, EventId } from "./ids";
```

`CardId`·`ClaimId`·`ClueId`·`RuleId`는 이 파일에서 쓰지 않는다. `ClueId`는 `content.ts`가, `RuleId`도 `content.ts`가 쓴다.

- [ ] **Step 4: 원정 상태의 주석을 고친다**

`lib/domain/expedition.ts:50`의 주석을 바꾼다.

```typescript
  /** 수용한 지연형 조언과 개인별 반응. 보스전과 사후 검증의 입력이다. */
  infoRecords: readonly InfoRecord[];
```

- [ ] **Step 5: 배럴에서 지운 타입을 뺀다**

`lib/domain/index.ts`의 `export type { ... } from "./info";` 목록에서 `InfoCard`·`InfoClaim`·`InfoSubject`·`TruthType`을 뺀다. `EventTarget`·`InfoReaction`·`InfoRecord`·`Target`은 남긴다.

- [ ] **Step 6: 옛 카드 콘텐츠를 지운다**

```bash
git rm lib/content/info-cards.ts
```

떠 있는 카드 36장은 `F3-1`~`F3-3`의 사건 콘텐츠로 대체된다. 문구가 필요하면 git 히스토리에서 본다.

- [ ] **Step 7: 통과를 확인한다**

```bash
pnpm test -- lib/domain/advice.test.ts
```

Expected: PASS.

- [ ] **Step 8: 커밋한다**

```bash
git add lib/domain/info.ts lib/domain/index.ts lib/domain/expedition.ts
git commit -m "$(cat <<'EOF'
타입: 옛 카드 타입을 걷고 기록을 지연형으로 좁힌다

InfoCard·InfoClaim·InfoSubject·TruthType을 지우고 InfoRecord가 사건과 조언을
가리키도록 바꾼다. 즉시형은 그 자리에서 끝나므로 기록하지 않는다. 떠 있는
카드 36장은 F3의 사건 콘텐츠로 대체되므로 함께 지운다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 컴파일 타임 계약을 갱신하고 전체를 검증한다

**Files:**
- Modify: `lib/domain/__checks__.ts:14-35,59-61`

**Interfaces:**
- Consumes: Task 7~9의 모든 타입
- Produces: 새 닫힌 목록이 실제로 닫혀 있음을 타입 검사가 보장한다

- [ ] **Step 1: 타입 검사가 지금 깨져 있는지 확인한다**

```bash
pnpm typecheck
```

Expected: FAIL — `__checks__.ts`가 없어진 `TRUTH_TYPES`·`TruthType`을 가져온다.

- [ ] **Step 2: 검사를 갈아끼운다**

`lib/domain/__checks__.ts`의 두 import 목록에서 `TRUTH_TYPES`와 `TruthType`을 빼고 `ADVICE_OUTCOMES`·`ECOLOGY_RELATIONS`·`AdviceOutcome`·`EcologyRelation`을 알파벳 순서에 맞게 넣는다.

`TruthListCoversEveryTruthType` 선언을 아래로 바꾼다.

```typescript
export type OutcomeListCoversEveryOutcome = Assert<
  IsExhaustive<AdviceOutcome, typeof ADVICE_OUTCOMES>
>;
export type RelationListCoversEveryRelation = Assert<
  IsExhaustive<EcologyRelation, typeof ECOLOGY_RELATIONS>
>;
```

- [ ] **Step 3: 검사가 실제로 발동하는지 본다**

규칙과 테스트를 만들면 일부러 위반을 넣어 잡히는지 본다.

`lib/domain/info.ts`의 `ADVICE_OUTCOMES`에서 `"neutral"` 한 줄을 잠시 지우고 실행한다.

```bash
pnpm typecheck
```

Expected: FAIL. `satisfies`나 `Assert` 중 하나가 잡아야 한다. 통과하면 검사가 작동하지 않는 것이므로 멈추고 원인을 찾는다.

확인했으면 지운 줄을 되돌린다.

- [ ] **Step 4: 네 명령을 모두 돌린다**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: 넷 다 통과. 실패하면 원인을 고친 뒤 다시 돌린다.

- [ ] **Step 5: 옛 이름이 코드에 남았는지 훑는다**

```bash
grep -rn "truthType\|TruthType\|TRUTH_TYPES\|InfoCard\|InfoClaim\|InfoSubject\|INFO_SUBJECTS\|INFO_CARDS\|DungeonEvent\|EventChoice" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

Expected: 0건.

- [ ] **Step 6: 커밋한다**

```bash
git add lib/domain/__checks__.ts
git commit -m "$(cat <<'EOF'
타입: 조언 유형과 생태 관계의 컴파일 타임 계약을 건다

닫힌 목록에서 값을 빠뜨리면 타입 검사가 먼저 깨진다. 일부러 neutral을 빼서
검사가 실제로 발동하는지 확인했다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: PR을 만든다**

```bash
git push -u origin feature/d9-f1-2-advice-contract
gh pr create --title "D9·F1-2: 조언·사건 통합 문서와 타입" --body "$(cat <<'EOF'
## 무엇을 했나

[조언·사건 통합 설계](docs/superpowers/specs/2026-08-20-lattebun-advice-event-merge-design.md)의 `D9`(문서 개정)와 `F1-2`(타입 개정)를 구현했다.

- 게임 원칙 2를 조언 모델로 교체
- 정보와 기만·던전 이벤트·캐릭터와 신뢰·루프·화면 규격 개정
- 배정표를 `F3-1`~`F3-3`·`F5`·`D9`·`F1-2`로 재편
- `AdviceOutcome`·`EcologyRelation`·`ClueId`·`SituationEvent`·`AdviceOption` 추가
- `TruthType`·`InfoCard`·`InfoSubject`·`InfoClaim`·`DungeonEvent`·`EventChoice`와 옛 카드 36장 제거

## 리뷰가 필요한 지점

**게임 원칙 2를 고친다.** 원칙 문서가 명시적 합의를 요구하므로 이 변경의 승인이 그 합의다.

**spec에 없던 결정 셋.** `InfoSubject`·`InfoCard`·`InfoClaim`을 지웠다. 근거는 계획 문서의 「이 계획이 정한 것」에 있다. `route` 주제가 사라지는 것이 유일하게 아까운 부분이다.

**타입만 있고 데이터가 없다.** `F1`이 그랬듯 이 PR 이후 사건 콘텐츠가 채워질 때까지 조언을 쓰는 코드가 없다.

## 검증

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] 닫힌 목록에서 값을 일부러 빼 타입 검사가 잡는지 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 이 계획이 다루지 않는 것

| 항목 | 별도 계획 |
| --- | --- |
| `F3-1` 조언 검증기와 공용 사건 15개 | 다음 계획 |
| `F3-2` 거미굴 전용 사건 16개 | 그다음 |
| `F3-3` 사막·묘지 32개 | 임계 경로 밖 |
| `F5` 아이템 5종 | 언제든 병렬 |
| `E1` 전 경로 공통 지점 구현 | 지도 트랙 |
| `E2` 조언 판정 · `E3` 사건 배치 | 규칙 트랙 |
| `U5` 진행 화면 | 화면 트랙 |
