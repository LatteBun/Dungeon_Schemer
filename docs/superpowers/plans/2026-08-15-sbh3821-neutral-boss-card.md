# F3 중립 보스 정보 카드 실행 계획

- 작성일: 2026-08-15
- 작성자: sbh3821
- 근거 spec: [중립 보스 정보 카드](../specs/2026-08-15-sbh3821-neutral-boss-card-design.md)

`E2` 구현 중 발견해 배정표에 남긴 콘텐츠 공백을 메운다. 실패 테스트를 먼저 쓰고
실패를 확인한 뒤 콘텐츠를 고친다.

## 단계

1. **실패 테스트 작성**
   - `lib/content/content.test.ts`에 보스 주제가 세 진위를 모두 갖는지 검사
   - `lib/rules/info.test.ts`에 보장 지점이 세 유형을 제시하는지, 실제 콘텐츠의
     중립 보스 카드가 `-0.1`을 만드는지 검사
2. **실패 확인**
   - Run: `pnpm test lib/content/content.test.ts lib/rules/info.test.ts`
   - Expected: 보스 카드가 진실·거짓 둘뿐이라 실패한다.
3. **콘텐츠 교체**
   - `lib/content/info-cards.ts`의 `card-neutral-route`를 `card-neutral-boss`로
     바꾼다. 전체 12장과 진위별 4장은 그대로 둔다.
4. **통과 확인**
   - Run: `pnpm test lib/content lib/rules/info.test.ts app/f2-test`
5. **배정표 갱신**
   - F3 담당 `sbh3821`, 상태 갱신, `C4` 선행에서 F3 제거 후 `pnpm test`
6. **전체 검증**
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

## 완료 기준

- 보스 주제 카드가 진실·거짓·중립 세 장이다
- 카드 12장과 진위별 4장이 유지된다
- 보장 지점이 세 유형을 모두 제시한다
- 실제 콘텐츠로 `-10%` 보정이 발생한다
- 병합 전 검증 명령 넷 통과

## 이번 범위에서 제외하고 근거를 남기는 것

| 항목 | 이유 |
| --- | --- |
| 카드 풀을 15장으로 확장 | 12장·진위별 4장은 F2 계약이다. 확장은 `C4` 보고서를 보고 판단할 콘텐츠 결정이지 죽은 규칙을 살리는 작업이 아니다 |
| A·S급 보장 2회의 카드 반복 | 위와 같은 이유로 남긴다. spec에 한계로 적는다 |
