# F3 정보 카드 확장 실행 계획

- 작성일: 2026-08-15
- 작성자: sbh3821
- 근거 spec: [정보 카드 확장과 지점 분류 연동](../specs/2026-08-15-sbh3821-info-card-expansion-design.md)

실패 테스트를 먼저 쓰고 실패를 확인한 뒤 콘텐츠와 규칙을 고친다.

## 단계

1. **실패 테스트 작성**
   - `lib/content/content.test.ts`: 주제·진위 조합마다 2장, 조합이 어긋난 풀 거부
   - `lib/rules/info.test.ts`: 지점 분류별 주제 선택, 보장 지점의 세 유형,
     실제 콘텐츠의 중립 보스 보정, 시드에 따른 변화
2. **실패 확인**
   - Run: `pnpm test lib/content/content.test.ts lib/rules/info.test.ts`
   - Expected: 카드가 12장이고 조합이 비어 있어 실패한다.
3. **카드 36장 작성**
   - `lib/content/info-cards.ts`
   - 기존 12장은 문구를 그대로 두고 식별자만 `card-{진위}-{주제}-{번호}`로 맞춘다
   - 새 24장은 기존 어조와 길이를 따른다
4. **검증 규칙 교체**
   - `lib/content/validation.ts`의 `전체 12장`·`진위별 4장` 검사를
     `조합마다 정확히 2장`으로 바꾼다
5. **제시 규칙 변경**
   - `lib/rules/info.ts`의 `createInfoOpportunity`를 입력 객체로 바꾸고
     지점 분류에서 주제를 정한다
6. **통과 확인**
   - Run: `pnpm test lib/content lib/rules app/f2-test`
7. **계약 문서와 배정표 갱신**
   - `docs/systems/INFORMATION_AND_DECEPTION.md`의 F2 카드 계약 문장
   - `app/f2-test`의 카드 수량 단정
   - 배정표 F3 행을 확장 범위로 다시 쓰고 상태 갱신
8. **전체 검증**
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

## 완료 기준

- 주제·진위 36조합이 각각 정확히 2장이다
- 지점 분류가 카드 주제를 정하고 여섯 주제가 모두 쓰인다
- 보장 지점이 진실·거짓·중립 세 장을 제시하고 `-10%` 보정이 실제로 발생한다
- 같은 지점이라도 시드가 다르면 다른 카드가 나온다
- 병합 전 검증 명령 넷 통과

## 이번 범위에서 제외하고 근거를 남기는 것

| 항목 | 이유 |
| --- | --- |
| 조합당 3장 이상 | 노출 분포는 `C4` 백테스트가 보고할 자료다. 먼저 재고 늘린다 |
| 카드별 개별 효과 | 진위와 주제로 결과가 정해지는 현재 계약을 바꾸는 별도 결정이다 |
| 한 던전 안 카드 중복 금지 | 중복 금지는 사건에만 걸린 규칙이다. `C4` 뒤에 판단한다 |
