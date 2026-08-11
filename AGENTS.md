# AI 작업 지침

## 적용 범위

새 기능 또는 기존 동작 변경에 적용한다. 단순 질의, 읽기 전용 조사, 오탈자 수정은 제외한다.

## 필수 순서

1. `superpowers:brainstorming`으로 사용자와 설계를 합의한다.
2. `docs/README.md`, `docs/GAME_PRINCIPLES.md`, 관련 공식 문서를 확인하고 필요한 설정집을 갱신한다.
3. spec을 작성하고 사용자의 검토·승인을 받는다.
4. plan을 작성한다.
5. spec과 plan이 모두 있을 때만 구현을 시작한다.

## Spec과 plan 파일명

작성자 우선순위: 요청에 지정한 `작성자: <식별자>` → `git config user.name`

정규화: 소문자 영문·숫자·하이픈만 사용하고, 공백은 하이픈으로 바꾼다.

```text
spec: docs/superpowers/specs/YYYY-MM-DD-<topic>-<author>-design.md
plan: docs/superpowers/plans/YYYY-MM-DD-<feature>-<author>.md
```

요청자 지정 작성자와 Git 이름을 모두 찾을 수 없으면, 구현 전에 사용자에게 작성자 식별자를 묻는다. AI 도구 이름은 파일명에 넣지 않고 문서 본문의 `작성 도구` 항목에 기록한다.
