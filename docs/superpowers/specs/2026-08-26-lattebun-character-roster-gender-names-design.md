# 고정 캐릭터 로스터 성별·이름 정비 설계

**작성일:** 2026-08-26
**작성자:** LatteBun
**작성 도구:** Codex
**상태:** 성별 확정 · 이름 제안 대기

## 목적

공식 30명 캐릭터에 이름 결정용 성별 메타데이터를 명시하고, 확정된 성별에 맞춰
이름을 다시 짓는다. `dead/` 초상화 디렉터리는 PR #190에서 이미 제거됐으므로,
이번 범위에서는 그 부재를 유지하고 문서 계약만 현재 구조로 정리한다.

## 범위와 비범위

포함:

- `CharacterRosterEntry`의 `gender` 콘텐츠 필드
- 30명 각각의 성별과 성별을 고려한 고유 이름
- 로스터 불변식·정확한 콘텐츠 회귀 테스트
- 현재 `live` 전용 초상화 계약에 맞춘 공식 문서 정리

제외:

- 게임 화면에서 성별을 표시하는 UI
- 전투, 신뢰, 성격, 능력치, 편성, 월드턴 규칙의 성별 분기
- `lib/domain`의 런타임 `Character` 또는 Store 상태 확장
- 캐릭터 ID, 직업, `portraitVariant`, 초상화 파일의 이동·이름 변경
- `dead/` 디렉터리 재도입

## 콘텐츠 계약

```ts
export const CHARACTER_GENDERS = ["male", "female"] as const;
export type CharacterGender = (typeof CHARACTER_GENDERS)[number];

interface CharacterRosterEntry {
  readonly id: CharacterId;
  readonly name: string;
  readonly gender: CharacterGender;
  readonly classId: ClassId;
  readonly portraitVariant: PortraitVariant;
}
```

- `gender`는 이름 선정과 향후 콘텐츠 참조를 위한 로스터 메타데이터다.
- 값은 `male` 또는 `female`만 허용한다. 표시 문구와 게임 규칙에는 사용하지 않는다.
- `generateCharacterPool`은 기존처럼 `id`, `name`, `classId`만 도메인 `Character`에
  옮긴다. 새 필드는 RNG 소비·셔플 순서·시드 결과를 바꾸지 않는다.
- 이름은 30명 전체에서 고유해야 하며, ID·직업·초상 변형은 바뀌지 않는다.

## 성별 입력표

사용자 입력에서 `M`은 `male`, `작성 필요`는 `female`을 뜻한다. 아래 표는 이를
콘텐츠 계약값으로 정규화한 결과다. `새 이름`은 동일한 ID와 초상화에 맞춰
제안·검토하며, `character-mage-f`의 `코코`는 사용자 고정값이다.

| ID                    | 직업    | 변형 | 현재 이름 | 성별      | 새 이름 |
| --------------------- | ------- | ---- | --------- | --------- | ------- |
| `character-warrior-a` | warrior | a    | 가론      | male      | 미정    |
| `character-warrior-b` | warrior | b    | 라이문드  | female    | 미정    |
| `character-warrior-c` | warrior | c    | 바스티안  | male      | 미정    |
| `character-warrior-d` | warrior | d    | 하르멜    | female    | 미정    |
| `character-warrior-e` | warrior | e    | 헬가      | male      | 미정    |
| `character-warrior-f` | warrior | f    | 브릭스턴  | female    | 미정    |
| `character-archer-a`  | archer  | a    | 네리사    | female    | 미정    |
| `character-archer-b`  | archer  | b    | 다이린    | male      | 미정    |
| `character-archer-c`  | archer  | c    | 파에린    | male      | 미정    |
| `character-archer-d`  | archer  | d    | 노엘라    | male      | 미정    |
| `character-archer-e`  | archer  | e    | 실바나    | female    | 미정    |
| `character-archer-f`  | archer  | f    | 카트린    | female    | 미정    |
| `character-cleric-a`  | cleric  | a    | 마요라    | male      | 미정    |
| `character-cleric-b`  | cleric  | b    | 세라핀    | female    | 미정    |
| `character-cleric-c`  | cleric  | c    | 이졸데    | male      | 미정    |
| `character-cleric-d`  | cleric  | d    | 로자린드  | female    | 미정    |
| `character-cleric-e`  | cleric  | e    | 제라딘    | female    | 미정    |
| `character-cleric-f`  | cleric  | f    | 미라벨    | male      | 미정    |
| `character-mage-a`    | mage    | a    | 아드리크  | male      | 미정    |
| `character-mage-b`    | mage    | b    | 타리엘    | female    | 미정    |
| `character-mage-c`    | mage    | c    | 베로니크  | male      | 미정    |
| `character-mage-d`    | mage    | d    | 사이러스  | female    | 미정    |
| `character-mage-e`    | mage    | e    | 루시안    | male      | 미정    |
| `character-mage-f`    | mage    | f    | 이반드로  | female    | 코코 (고정) |
| `character-rogue-a`   | rogue   | a    | 카심      | male      | 미정    |
| `character-rogue-b`   | rogue   | b    | 델런      | female    | 미정    |
| `character-rogue-c`   | rogue   | c    | 무렌      | male      | 미정    |
| `character-rogue-d`   | rogue   | d    | 오린      | male      | 미정    |
| `character-rogue-e`   | rogue   | e    | 코르빈    | female    | 미정    |
| `character-rogue-f`   | rogue   | f    | 펠릭스    | female    | 미정    |

## 검증 계약

- 로스터의 정확한 30개 튜플은 ID·이름·성별·직업·변형을 순서대로 검증한다.
- 로스터 초기화는 수, ID 고유성, 이름 고유성, 지원 성별, 직업별 여섯 명과 A–F
  변형을 검증한다.
- 기존 풀 생성 회귀는 모든 ID가 같은 이름·직업을 유지하고, 성별 필드 추가가
  도메인 상태나 시드 재현성을 바꾸지 않음을 보장한다.
- 초상 해석과 자산 존재 테스트는 30개 `live` 경로를 계속 검증하고 `/dead/`를
  참조하지 않는다.

## 문서 반영

- `docs/systems/CHARACTER_POOL_AND_WORLDTURN.md`의 고정 로스터 표에 확정된
  이름과 성별을 반영한다.
- `docs/experience/CHARACTER_UI_ASSETS.md`는 `live` 전용 30개 자산과 상태 표시
  규칙을 기준으로 유지한다.
- 과거 `docs/superpowers` 문서는 당시 결정 기록이므로 수정하지 않는다.

## 승인 기준

1. 성별 값은 15명 `male`, 15명 `female`로 확정한다.
2. `character-mage-f`의 새 이름은 `코코`로 고정한다.
3. 나머지 29명의 새 이름이 중복 없이 승인된다.
4. 이 설계와 후속 구현 계획을 검토·승인한 뒤에만 코드를 변경한다.
