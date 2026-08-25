# Task 2 구현 보고서

## 결과

메인 메뉴의 `캠페인 시작` 링크에 `prefetch={false}`를 지정해 `/campaign` 사전 탐색으로 새 캠페인 시드가 미리 생성되지 않도록 했다. 업적 링크와 전역 prefetch 설정은 변경하지 않았다.

## RED

`MainMenuScreen.test.tsx`에서 `next/link`를 모킹하고 캠페인 링크의 `data-prefetch="false"`를 검증하도록 테스트를 먼저 추가했다.

실행:

```text
./node_modules/.bin/vitest run components/game/MainMenuScreen.test.tsx
```

결과: 2개 중 1개 실패. 렌더링된 캠페인 링크의 값은 `data-prefetch="undefined"`였다.

## GREEN

`MainMenuScreen.tsx`의 캠페인 링크에만 `prefetch={false}`를 추가했다.

실행:

```text
./node_modules/.bin/vitest run components/game/MainMenuScreen.test.tsx app/campaign/page.test.ts
./node_modules/.bin/eslint components/game/MainMenuScreen.tsx components/game/MainMenuScreen.test.tsx
```

결과: Vitest 테스트 파일 2개, 테스트 7개 모두 통과. 대상 ESLint도 통과.

## 변경 파일

- `components/game/MainMenuScreen.tsx`
- `components/game/MainMenuScreen.test.tsx`

## 커밋

`3533cdd 수정: 새 캠페인 링크의 사전 생성을 막는다`

## 자체 검토

- 캠페인 링크의 `href`, 레이블, CSS 클래스는 유지했다.
- 업적 링크에는 `prefetch`를 추가하지 않았다.
- 저장소에 이미 존재하던 문서 변경은 건드리지 않았다.
- 요구된 범위에서 추가 우려 사항은 없다.
