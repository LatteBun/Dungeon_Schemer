# 캐릭터 UI 에셋

## 목적

직업별 캐릭터 초상을 파티 UI와 결과 UI에서 재사용하기 위한 자산 카탈로그다.
캐릭터의 생존·사망·신뢰·출전 가능 의미는
[캐릭터와 신뢰 시스템](../systems/CHARACTERS_AND_TRUST.md)이 소유하고, 이 문서는
그 상태를 표시할 때 사용하는 정적 파일의 경로와 시각 규칙을 소유한다.

## 정적 경로 규칙

```text
/assets/characters/live/{archer|cleric|mage|rogue|warrior}/{class}_{a..f}.png
```

직업 디렉터리와 `live` 디렉터리를 모두 포함한다. `a`부터 `f`는
`lib/content/character-roster.ts`의 공식 캐릭터 ID에 고정된 초상 변형이다.
성격·신뢰·능력치·생존 상태를 뜻하지 않는다.

## 공식 에셋 목록

공식 초상은 다섯 직업마다 여섯 변형, 총 30개다. 원본 해상도와 비율은 서로
다를 수 있으며 UI는 이를 강제 통일하지 않는다.

| 직업 디렉터리 | 표시 직업 | 파일 |
| --- | --- | --- |
| `archer` | 궁수 | `archer_a.png` ~ `archer_f.png` |
| `cleric` | 성직자 | `cleric_a.png` ~ `cleric_f.png` |
| `mage` | 마법사 | `mage_a.png` ~ `mage_f.png` |
| `rogue` | 도적 | `rogue_a.png` ~ `rogue_f.png` |
| `warrior` | 전사 | `warrior_a.png` ~ `warrior_f.png` |

예를 들어 궁수의 초상은 다음 경로를 사용한다.

```text
/assets/characters/live/archer/archer_a.png
/assets/characters/live/archer/archer_b.png
```

`dead/` 자산은 제공하지 않는다.

## 상태별 UI 사용 규칙

### 생존

도메인 상태가 생존인 캐릭터는 위의 `live` 초상을 사용한다.

- 게시판 계약 상세의 출전 파티원 카드
- 지도 화면의 파티 상태 패널
- 진행 화면 우측 파티 상태와 반응 영역
- 생존 파티원을 보여주는 정산·캠페인 결과 UI

### 사망·신뢰 0·중상·미출전

사망한 캐릭터도 같은 `live` 초상을 유지하고, 카드의 상태·텍스트·형태·HP로
구분한다. 필요할 때 grayscale 또는 저채도 처리를 더할 수 있으나, 상태를 색만으로
전달하지 않는다.

신뢰 0, 중상, 현재 미출전, 잠시 출전 불가도 사망이 아니다. 이 상태들은 공식
상태 문구·테두리·아이콘·HP 표시로 구분한다.

## 변형 매핑 규칙

캐릭터 ID와 초상 변형의 매핑은 `lib/content/character-roster.ts`가 유일하게
소유한다.

- 같은 캐릭터는 모든 화면과 세션에서 같은 변형을 쓴다.
- 변형 선택으로 성격·신뢰·직업·능력치를 추론하게 만들지 않는다.
- 화면 컴포넌트가 파일명을 임의로 조립하지 않는다. `portraitSrcForCharacterId`를
  통해 로스터를 해석한다.

## 표시 기준

- 원본은 세로 초상이다. 기본 표시 방식은 비율 왜곡이 없는 `object-fit: contain`이다.
- `cover` crop이 필요한 화면은 해당 UI 작업 문서에서 머리·장비·실루엣이 잘리지
  않는지 확인하고 별도로 승인한다.
- 원본을 임의로 다시 저장하거나 리사이즈하지 않는다. 목표 슬롯보다 원본이 큰 경우
  UI 표시 크기에서 축소한다.
- 캐릭터 상태를 색만으로 전달하지 않는다. `생존`, `사망`, `중상`, `신뢰 0`처럼
  공식 상태 의미에 맞는 텍스트·형태·수치 단서를 함께 사용한다.
- 새 파티 UI를 배치하거나 기존 UI를 확장할 때는
  [UI 구현 가이드](UI_IMPLEMENTATION_GUIDE.md)와
  [화면 규격](SCREEN_LAYOUT.md)을 함께 확인한다.

## 관련 문서

- [캐릭터와 신뢰 시스템](../systems/CHARACTERS_AND_TRUST.md)
- [캐릭터 풀과 월드턴](../systems/CHARACTER_POOL_AND_WORLDTURN.md)
- [UI 구현 가이드](UI_IMPLEMENTATION_GUIDE.md)
- [화면 규격](SCREEN_LAYOUT.md)

이 카탈로그는 캐릭터의 생존·신뢰·출전 가능 규칙을 새로 정의하지 않는다.
상태의 의미와 판정은 [캐릭터와 신뢰 시스템](../systems/CHARACTERS_AND_TRUST.md)을
기준으로 한다.
