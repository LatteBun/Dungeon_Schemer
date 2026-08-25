# 고정 캐릭터 로스터와 초상 매핑 설계

작성일: 2026-08-26

작성 도구: Codex

## 목적

현재 캐릭터 풀은 이름·직업·성격을 각각 독립적으로 섞은 뒤 같은 인덱스끼리 결합하고, 캐릭터 초상은 `CharacterId` 해시로 `a` 또는 `b` 변형을 고른다. 그 결과 같은 이름이 캠페인마다 다른 직업이 될 수 있고, 직업당 6명이 있는데 초상은 2종뿐이라 서로 다른 인물이 같은 얼굴을 반복해서 사용한다.

이 작업은 캐릭터 30명을 **고정된 인물 로스터**로 바꾼다. 각 인물은 이름·직업·초상 변형을 사전에 1:1로 고정하고, 캠페인마다 달라져야 하는 성격·초기 신뢰·초기 골드·표시 순서만 기존 시드 기반 랜덤화를 유지한다.

사망 상태는 별도 `dead` PNG를 사용하지 않는다. 살아 있을 때와 동일한 초상을 계속 사용하고, UI의 `alive=false` 상태 표현으로 회색 처리와 사망 문구를 적용한다.

## 현재 문제

### 이름과 직업의 정체성이 고정되지 않는다

현재 `lib/content/character-names.ts`는 32개의 이름 후보만 제공한다. `generateCharacterPool()`은 직업 슬롯, 성격 슬롯, 이름 후보를 각각 따로 섞은 뒤 인덱스로 결합한다.

따라서 `가론`이 한 캠페인에서는 전사이고 다른 캠페인에서는 마법사가 될 수 있다. 캐릭터가 캠페인 사이에서 기억되는 고유 인물로 읽히기 어렵다.

### 직업당 6명인데 초상은 2종뿐이다

현재 캐릭터 풀은 5직업 × 6명 = 30명이다. 반면 공식 캐릭터 초상은 직업별 `a`, `b` 두 변형만 있고, `portraitVariantForCharacterId()`가 ID 해시로 둘 중 하나를 고른다.

단순히 해시 범위를 `a~f`로 늘리는 방식도 직업 내 중복을 막지 못한다. 같은 직업 6명에게 `a`, `a`, `c`, `d`, `d`, `f`처럼 중복 변형이 배정될 수 있다.

### 사망 초상 파일과 CSS 효과가 역할을 중복한다

현재 초상 경로는 `alive`에 따라 `/live/`와 `/dead/`를 전환한다. 동시에 공용 `PartyMemberCard`와 U6 정산 목록은 사망 상태에 이미 grayscale 효과와 사망 문구를 적용한다.

별도 사망 이미지를 계속 유지하면 캐릭터 변형을 6종으로 확장할 때 `live` 30장 외에 `dead` 30장을 추가로 관리해야 한다. 사망의 의미는 도메인 `alive`가 이미 소유하므로 이미지 파일을 복제할 필요가 없다.

## 설계 원칙

1. **한 이름은 한 인물이다.** 이름, 직업, 초상은 캠페인 시드가 바뀌어도 변하지 않는다.
2. **직업별 여섯 인물은 서로 다른 초상을 쓴다.** 각 직업에 `a~f`를 정확히 한 번씩 배정한다.
3. **게임플레이 랜덤성은 유지한다.** 성격, 초기 신뢰 편차, 초기 골드, 캐릭터 풀의 표시/배치 순서는 시드 기반으로 계속 달라진다.
4. **사망은 상태이지 별도 캐릭터 그림이 아니다.** 생존/사망 모두 같은 원본 초상을 사용하고 UI 상태 효과로 구분한다.
5. **초상 선택을 이름 문자열이나 런타임 해시에 의존하지 않는다.** 고정된 캐릭터 ID가 공식 로스터 정의를 가리킨다.
6. **색만으로 사망을 전달하지 않는다.** grayscale 효과와 함께 기존 `사망`, `돌아오지 못했다` 같은 텍스트 상태를 유지한다.
7. **도메인 ID와 공식 콘텐츠 ID의 책임을 분리한다.** `CharacterId`는 규칙 계층에서 일반적인 branded string으로 유지하고, 공식 로스터 포함 여부는 초상·콘텐츠 조회 경계에서 검증한다.

## 고정 캐릭터 로스터

공식 로스터는 정확히 30명이다. 각 행은 하나의 고정된 캐릭터 정체성을 뜻한다.

| 직업 | 변형 | 고정 ID | 이름 | 초상 파일 |
| --- | --- | --- | --- | --- |
| 전사 | `a` | `character-warrior-a` | 가론 | `warrior_a.png` |
| 전사 | `b` | `character-warrior-b` | 라이문드 | `warrior_b.png` |
| 전사 | `c` | `character-warrior-c` | 바스티안 | `warrior_c.png` |
| 전사 | `d` | `character-warrior-d` | 하르멜 | `warrior_d.png` |
| 전사 | `e` | `character-warrior-e` | 헬가 | `warrior_e.png` |
| 전사 | `f` | `character-warrior-f` | 브릭스턴 | `warrior_f.png` |
| 궁수 | `a` | `character-archer-a` | 네리사 | `archer_a.png` |
| 궁수 | `b` | `character-archer-b` | 다이린 | `archer_b.png` |
| 궁수 | `c` | `character-archer-c` | 파에린 | `archer_c.png` |
| 궁수 | `d` | `character-archer-d` | 노엘라 | `archer_d.png` |
| 궁수 | `e` | `character-archer-e` | 실바나 | `archer_e.png` |
| 궁수 | `f` | `character-archer-f` | 카트린 | `archer_f.png` |
| 성직자 | `a` | `character-cleric-a` | 마요라 | `cleric_a.png` |
| 성직자 | `b` | `character-cleric-b` | 세라핀 | `cleric_b.png` |
| 성직자 | `c` | `character-cleric-c` | 이졸데 | `cleric_c.png` |
| 성직자 | `d` | `character-cleric-d` | 로자린드 | `cleric_d.png` |
| 성직자 | `e` | `character-cleric-e` | 제라딘 | `cleric_e.png` |
| 성직자 | `f` | `character-cleric-f` | 미라벨 | `cleric_f.png` |
| 마법사 | `a` | `character-mage-a` | 아드리크 | `mage_a.png` |
| 마법사 | `b` | `character-mage-b` | 타리엘 | `mage_b.png` |
| 마법사 | `c` | `character-mage-c` | 베로니크 | `mage_c.png` |
| 마법사 | `d` | `character-mage-d` | 사이러스 | `mage_d.png` |
| 마법사 | `e` | `character-mage-e` | 루시안 | `mage_e.png` |
| 마법사 | `f` | `character-mage-f` | 이반드로 | `mage_f.png` |
| 도적 | `a` | `character-rogue-a` | 카심 | `rogue_a.png` |
| 도적 | `b` | `character-rogue-b` | 델런 | `rogue_b.png` |
| 도적 | `c` | `character-rogue-c` | 무렌 | `rogue_c.png` |
| 도적 | `d` | `character-rogue-d` | 오린 | `rogue_d.png` |
| 도적 | `e` | `character-rogue-e` | 코르빈 | `rogue_e.png` |
| 도적 | `f` | `character-rogue-f` | 펠릭스 | `rogue_f.png` |

기존 후보 32개 중 `오스왈드`, `텔라`는 이번 30명 공식 로스터에서는 사용하지 않는다. 별도 예비 이름 시스템은 만들지 않는다. 향후 캐릭터 수 자체를 확장하는 작업이 생기면 그 작업에서 다시 다룬다.

## 고정 로스터 데이터 계약

새 공식 콘텐츠 모듈은 개념적으로 다음 정보를 소유한다.

```ts
type PortraitVariant = "a" | "b" | "c" | "d" | "e" | "f";

interface CharacterRosterEntry {
  readonly id: CharacterId;
  readonly name: string;
  readonly classId: ClassId;
  readonly portraitVariant: PortraitVariant;
}
```

`CHARACTER_ROSTER`는 정확히 30개 항목을 가진다.

검증해야 하는 불변식은 다음과 같다.

- 전체 로스터 수는 `CHARACTER_POOL_SIZE`와 같다.
- 각 직업은 정확히 `CHARACTERS_PER_CLASS`인 6명을 가진다.
- 각 직업 안에서 `a~f`는 중복 없이 정확히 한 번씩 존재한다.
- 이름은 30명 전체에서 중복되지 않는다.
- `CharacterId`는 30명 전체에서 중복되지 않는다.
- ID의 직업/변형 부분과 `classId`, `portraitVariant`가 서로 일치한다.

기존 `CHARACTER_NAMES` 문자열 배열은 더 이상 캐릭터 정체성의 공식 소스가 아니다. 구현에서는 별도 이름 후보 소스를 유지하지 않고 고정 로스터를 단일 진실 공급원으로 사용한다.

## CharacterId 계약

현재 `generateCharacterPool()`은 최종 섞인 인덱스로 `character-001`부터 `character-030`까지 ID를 만든다. 고정 로스터로 전환한 뒤에는 ID도 인물 정체성의 일부로 고정한다.

예:

```text
character-warrior-a
character-archer-c
character-mage-f
```

캠페인 시드가 달라져도 가론은 항상 `character-warrior-a`이고, 같은 ID는 항상 같은 이름·직업·초상을 뜻한다.

게임 시스템은 ID 문자열의 내부 구조를 파싱해 규칙을 결정하지 않는다. 직업과 초상 정보는 공식 로스터 데이터에서 읽는다. 구조화된 ID는 디버깅과 콘텐츠 추적성을 위한 안정적인 식별자일 뿐이다.

`CharacterId` 타입 자체를 30개 공식 ID의 유니온으로 좁히지 않는다. 도메인 규칙과 독립 단위 테스트는 캐릭터 ID의 내부 문자열 구조를 몰라도 동작해야 한다. 공식 로스터 포함 여부는 로스터 조회 또는 초상 조회를 수행하는 콘텐츠·표현 경계의 책임이다.

## 캐릭터 풀 생성

`generateCharacterPool()`은 30명의 정체성을 새로 조립하지 않는다. 공식 `CHARACTER_ROSTER`를 입력으로 사용한다.

생성 흐름은 다음과 같다.

1. 고정 로스터 30명을 가져온다.
2. 캠페인 시드의 `pool` RNG로 로스터의 생성/표시 순서를 섞는다.
3. 기존과 동일하게 성격 슬롯 30개를 섞어 각 인물에 배정한다.
4. 성격에 따른 초기 신뢰 기본값과 `-5~+5` 편차를 계산한다.
5. 초기 골드를 기존 범위에서 생성한다.
6. 이름, 직업, 최대 HP, 고정 ID는 로스터 정의에서 가져온다.
7. `alive=true`, `gravelyWounded=false`로 시작한다.

이 방식은 다음 두 성질을 동시에 보장한다.

- 캐릭터 정체성은 고정된다.
- 캠페인별 성격·신뢰·골드·순서의 재현 가능한 랜덤성은 유지된다.

기존 5직업 × 6명, 5성격 × 6명 분포 계약도 그대로 유지한다.

### 기존 시드와의 호환 범위

같은 구현 버전에서 같은 시드는 계속 같은 결과를 만든다. 다만 고정 로스터 전환 전과 전환 후의 동일 시드가 똑같은 성격·신뢰·골드 값을 만들 필요는 없다.

현재 구현은 직업 슬롯, 성격 슬롯, 32개 이름 후보를 차례로 섞은 뒤 신뢰와 골드를 생성한다. 새 구현에서 이름 후보 shuffle이 사라지면 `pool` RNG 소비 순서가 달라지므로, 전환 전과 같은 시드라도 신뢰와 골드가 달라질 수 있다. 이것은 허용되는 결정적 콘텐츠 마이그레이션이다.

이전 호출 횟수를 맞추기 위한 더미 shuffle이나 의미 없는 RNG 소비는 추가하지 않는다. 보존해야 하는 계약은 다음과 같다.

- 같은 구현 버전과 같은 시드의 결과는 결정적이다.
- 직업과 성격의 인원 분포, 신뢰·골드 범위는 유지된다.
- 다른 시드에서는 성격·신뢰·골드·표시 순서가 달라질 수 있다.
- `pool` 외의 파생 RNG stream은 기존처럼 독립적이다.

## 초상 자산 계약

공식 캐릭터 초상 경로는 `live` 하나만 사용한다.

```text
public/assets/characters/live/{archer|cleric|mage|rogue|warrior}/{class}_{a|b|c|d|e|f}.png
```

런타임 정적 경로는 다음과 같다.

```text
/assets/characters/live/{class}/{class}_{variant}.png
```

직업별로 A~F 여섯 파일이 존재하여 총 30개가 된다.

사용자가 준비한 신규 C~F 이미지는 구현 단계에서 기존 A/B와 같은 직업 디렉터리에 추가한다. 파일명은 본 문서의 표와 동일해야 한다.

원본 이미지는 임의로 재압축·리사이즈하지 않는다. 화면에서는 기존 초상 슬롯 규칙에 따라 표시한다.

신규 파일의 원본 해상도와 종횡비가 직업 안에서도 완전히 같다고 가정하지 않는다. 현재 준비된 전사 자산은 1086×1448과 1024×1536 원본이 함께 존재한다. 자산 검증은 직업별 동일 해상도를 요구하지 않고 PNG 유효성, 파일명, 필요한 30개 경로의 존재를 검사한다. `object-fit: cover`를 쓰는 화면은 A~F에서 얼굴·장비·실루엣이 과도하게 잘리지 않는지 시각적으로 확인한다.

## 사망 초상 정책

`dead` 이미지는 공식 자산 계약에서 제거한다.

캐릭터가 사망해도 초상 경로는 바뀌지 않는다.

```text
alive=true
/assets/characters/live/warrior/warrior_c.png

alive=false
/assets/characters/live/warrior/warrior_c.png
```

달라지는 것은 UI 상태다.

- `PartyMemberCard`는 `alive=false`일 때 기존 `is-dead` 클래스를 유지한다.
- 사망 카드는 grayscale 효과를 적용한다.
- 카드의 `사망` 라벨을 유지한다.
- U6 정산의 사망자 행은 grayscale 효과와 `돌아오지 못했다` 문구를 유지한다.
- 신뢰 0, 중상, 미출전은 사망이 아니므로 grayscale 사망 효과를 사용하지 않는다.
- 전투 재생에서 전투 중 쓰러짐을 보여주는 효과는 별도 전투 상태가 계속 담당한다. 초상 파일이 사망 이미지를 선행해서 보여주지 않는다.

기존 `public/assets/characters/dead/`의 A/B 파일은 모든 소비자가 live-only 계약으로 전환된 뒤 구현 PR에서 삭제한다. C~F 사망 이미지는 만들지 않는다.

## 초상 조회 API

현재 `portraitVariantForCharacterId()`의 해시 기반 A/B 선택은 제거한다. 초상 변형은 공식 로스터 정의에서 직접 조회한다.

초상 경로 조회는 `alive`를 입력으로 받지 않는다. 생사 상태가 파일 경로를 결정하지 않기 때문이다.

개념적으로 다음 책임을 갖는다.

```ts
portraitVariantForCharacterId(characterId)
// 공식 로스터에서 a~f를 반환

portraitSrcForCharacterId(characterId)
// 공식 로스터의 classId + variant로 live 경로를 반환
```

공식 로스터에 없는 `CharacterId`에 임의 해시 fallback을 제공하지 않는다. 초상 조회를 호출하는 프리뷰와 테스트 fixture는 공식 캐릭터 ID를 사용하도록 바꾼다. 알 수 없는 ID가 UI까지 도달하면 데이터 계약 위반으로 명확히 실패해야 한다.

이 요구는 모든 도메인 테스트 fixture를 공식 로스터에 결합하라는 뜻이 아니다.

- 초상 조회 API를 호출하는 런타임 adapter, 프리뷰, 통합 테스트 fixture는 공식 캐릭터 ID를 사용한다.
- 초상 조회와 무관한 도메인·규칙 단위 테스트는 의도를 드러내는 임의 `CharacterId`를 계속 사용할 수 있다.
- 알 수 없는 ID에 대한 실패 테스트는 초상·로스터 조회 경계에 둔다.

실패 방식은 조용한 빈 문자열이나 임의 placeholder 반환이 아니라, 문제의 `CharacterId`를 포함한 명시적 오류다.

## 화면 영향

### U3 게시판

계약 상세의 파티원 초상은 캐릭터의 고정 ID를 통해 공식 로스터 초상을 사용한다. 같은 이름은 언제나 같은 직업과 얼굴로 보인다.

현재 `createU3BoardView()`의 선택적 `portraitByCharacterId` 주입은 공식 resolver보다 우선하여 같은 ID의 얼굴을 바꿀 수 있다. 런타임은 이 주입을 사용하지 않고 테스트만 사용하므로, 구현에서는 해당 override와 전용 테스트를 제거하고 공식 resolver를 단일 경로로 사용한다.

### U4 지도

파티 상태 카드가 A~F 매핑을 사용한다. 현재 `live ↔ dead` 경로 전환 테스트는 제거하고, 사망 전후 같은 경로를 유지하는 계약으로 교체한다.

### U5 진행·전투

진행 화면 파티 카드는 고정 초상을 사용한다. 전투 재생은 전투 시작 당시 생존 초상을 사용한다는 기존 의미를 유지하지만, 이제 그 경로는 별도 dead 자산과 무관하다. 전투 중 쓰러짐은 재생 상태의 defeated 효과가 담당한다.

### U6 정산

생존자와 사망자는 모두 같은 고정 live 초상을 사용한다. 사망자 여부는 `alive`와 기존 CSS/문구로 구분한다.

## 문서 변경

구현 단계에서는 `docs/experience/CHARACTER_UI_ASSETS.md`를 새 계약으로 갱신한다.

기존:

```text
/assets/characters/{live|dead}/{class}/{class}_{a|b}.png
```

변경:

```text
/assets/characters/live/{class}/{class}_{a|b|c|d|e|f}.png
```

문서에는 다음을 명확히 적는다.

- 공식 초상은 5직업 × 6변형 = 30개다.
- 이름·직업·변형은 고정 캐릭터 로스터가 소유한다.
- 사망은 같은 초상에 UI 상태 효과를 적용한다.
- 신뢰 0과 사망을 혼동하지 않는다.
- 별도 `dead` 초상은 더 이상 공식 계약이 아니다.

다음 공식·운영 문서도 함께 갱신한다.

- `docs/systems/CHARACTER_POOL_AND_WORLDTURN.md`: 이름·직업·초상의 고정 정체성과 성격·신뢰·골드·순서의 랜덤 배정을 구분한다. 이름·직업·성격이 모두 중복되지 않는다는 기존의 부정확한 문장을 바로잡는다.
- `docs/experience/U4_DUNGEON_MAP.md`: A/B 및 `dead` 경로 계약을 A~F live-only 계약과 상태 기반 grayscale 표현으로 바꾼다.
- `docs/technical/DEFERRED_WORK.md`: 구현 완료 시 `캐릭터 고유 초상` 유예 항목을 제거한다.

과거 spec과 plan은 당시 결정의 기록이므로 일괄 수정하지 않는다. 현행 공식·운영 문서와 런타임 코드에서만 `/characters/dead/` 참조가 0개여야 한다.

## 예상 구현 파일

구현 계획을 작성할 때 최소한 다음 범위를 검토한다.

- Create or replace: `lib/content/character-roster.ts`
- Remove or retire: `lib/content/character-names.ts`
- Modify: `lib/content/character-pool.ts`
- Modify: `lib/content/character-pool.test.ts`
- Modify: `components/game/character-labels.ts`
- Modify: `components/game/u3-board-model.ts`
- Modify: `components/game/u3-board-model.test.ts`
- Modify: `components/game/u4-dungeon-map-model.ts`
- Modify: `components/game/u4-dungeon-map-model.test.ts`
- Modify consumers/fixtures that call portrait lookup with non-canonical CharacterIds
- Modify: `docs/experience/CHARACTER_UI_ASSETS.md`
- Modify: `docs/systems/CHARACTER_POOL_AND_WORLDTURN.md`
- Modify: `docs/experience/U4_DUNGEON_MAP.md`
- Modify: `docs/technical/DEFERRED_WORK.md`
- Add: `public/assets/characters/live/*/*_{c,d,e,f}.png`
- Delete after migration: `public/assets/characters/dead/`

실제 Plan 단계에서는 코드 검색으로 모든 `portraitSrcForCharacter`, `portraitVariantForCharacterId`, `/characters/dead/`, 임시 CharacterId 사용처를 다시 열거하고 누락 없이 작업 단위를 만든다.

## 테스트와 검증

### 로스터 불변식

자동 테스트에서 다음을 검증한다.

- 고정 로스터가 정확히 30명이다.
- 직업별 정확히 6명이다.
- 각 직업의 변형 집합이 정확히 `a,b,c,d,e,f`다.
- 모든 이름과 ID가 고유하다.
- 각 캐릭터의 이름·직업·초상 변형이 시드가 달라도 바뀌지 않는다.

### 랜덤성 보존

- 동일 시드의 생성 결과는 계속 결정적이다.
- 성격은 전체 5종 × 6명 분포를 유지한다.
- 초기 신뢰와 골드는 기존 범위를 유지한다.
- 서로 다른 시드에서는 성격·신뢰·골드·순서가 달라질 수 있다.
- 전환 전과 전환 후의 동일 시드 결과가 같을 필요는 없으며, 더미 RNG 소비로 과거 호출 횟수를 흉내 내지 않는다.

### 초상 계약

- 공식 캐릭터 30명 모두 기대한 live PNG 경로를 반환한다.
- 사망 전후 `portraitSrc`가 동일하다.
- 어떤 공식 런타임 경로도 `/characters/dead/`를 사용하지 않는다.
- 존재하지 않는 캐릭터 ID를 임의 변형으로 조용히 매핑하지 않는다.

### 상태 표현

- `alive=false`일 때 공용 파티 카드가 기존 사망 클래스와 텍스트를 표시한다.
- U6 사망자 행이 기존 사망 스타일과 문구를 유지한다.
- `trust=0` 또는 `gravelyWounded=true`만으로 사망 스타일이 적용되지 않는다.

### 자산 검증

- `public/assets/characters/live` 아래 PNG가 정확히 30개다.
- 5개 직업 모두 A~F 파일을 가진다.
- 신규 C~F 파일이 유효한 PNG인지 확인한다.
- 서로 다른 원본 해상도를 허용하며 직업별 동일 해상도를 불변식으로 검사하지 않는다.
- 구현 완료 후 코드·문서에서 `/characters/dead/` 참조가 0개인지 확인한다.

### 시각 검증

- U3·U4·U5·U6에서 공식 A~F 초상이 깨진 경로 없이 표시되는지 확인한다.
- `object-fit: cover`를 사용하는 슬롯에서 혼합 종횡비 자산의 얼굴·장비·실루엣이 과도하게 잘리지 않는지 확인한다.
- 동일 캐릭터가 생존·사망 상태에서 같은 원본 초상을 쓰고, 사망 상태에서는 기존 grayscale과 텍스트 단서가 함께 보이는지 확인한다.
- 구현 전 전체 테스트 기준선을 기록한다. 백테스트의 기존 5초 timeout처럼 부하에 민감한 실패는 기능 회귀와 구분하여 보고하며, 이번 기능 범위에서 관련 없는 timeout 상향이나 백테스트 변경으로 숨기지 않는다.

## 비목표

이번 작업에서는 다음을 하지 않는다.

- 새 직업을 추가하지 않는다.
- 캐릭터 수를 30명보다 늘리지 않는다.
- 성격 종류나 신뢰 계산 공식을 바꾸지 않는다.
- 직업 능력치나 전투 밸런스를 바꾸지 않는다.
- 이름별 고유 대사, 성격, 스킬, 배경 설정을 추가하지 않는다.
- 사망 애니메이션이나 새로운 UI 레이아웃을 만들지 않는다.
- 캠페인 저장/불러오기 기능을 추가하지 않는다.

## 완료 조건

다음 조건을 모두 만족하면 구현 작업이 완료된 것으로 본다.

1. 공식 캐릭터 로스터가 30명의 고정 이름·직업·ID·초상 A~F 매핑을 소유한다.
2. 캠페인 시드가 달라져도 동일 캐릭터의 이름·직업·초상은 변하지 않는다.
3. 성격·초기 신뢰·초기 골드·순서의 기존 시드 랜덤성은 유지된다.
4. 각 직업의 6명이 A~F 초상을 하나씩 중복 없이 사용한다.
5. 사용자가 준비한 C~F PNG가 기존 A/B와 함께 공식 live 자산으로 사용된다.
6. 별도 사망 초상을 만들지 않고 live 초상에 기존 grayscale/사망 문구 효과를 적용한다.
7. `public/assets/characters/dead/`와 런타임 dead 경로 의존이 제거된다.
8. U3·U4·U5·U6에서 한 캐릭터가 항상 같은 얼굴로 표시된다.
9. 관련 단위 테스트, 타입 검사, 전체 테스트가 통과한다.
10. 현행 공식·운영 문서가 고정 로스터와 live-only 초상 계약을 일관되게 설명하고, 완료된 `캐릭터 고유 초상` 유예 항목이 제거된다.
