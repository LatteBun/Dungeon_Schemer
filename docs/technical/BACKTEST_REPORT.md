# B1 현행 캠페인 백테스트 보고서

- 모드: calibration
- namespace: b1-calibration-v1
- source revision: fc5309e
- 전략: survival, opportunist, selective-betrayal
- 정확도: 0.4, 0.7
- 조합당 표본: 200

## 고정 gate

| Gate | 결과 | 근거 |
| --- | --- | --- |
| accuracy-has-effect | FAIL | paired 통계 차이 없음; 실질 기준 승인 대기 |
| accuracy-interval | PASS | survival@0.4 0.3936–0.4197 포함; survival@0.7 0.6938–0.7176 포함; opportunist@0.4 0.3858–0.4125 포함; opportunist@0.7 0.6948–0.7192 포함; selective-betrayal@0.4 0.3931–0.4199 포함; selective-betrayal@0.7 0.6894–0.7148 포함 |
| betrayal-can-complete | PASS | 배신 완주 535건 |
| no-run-errors | PASS | 실행 오류 0건 |
| not-all-rank-s | PASS | 각 조합 S 도달률 100% 미만 |

## 조정 가능한 기준

- calibration 결과 검토 및 사용자 승인 대기

## 조합별 결과

| 전략 | 정확도 | 표본 | 정상 완주율 | S 도달률 | 조언 적중률 | 배신 시도 | 배신 완주 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| survival | 0.4 | 200 | 0.0000 | 0.0000 | 0.4066 | 0 | 0 |
| survival | 0.7 | 200 | 0.0000 | 0.0000 | 0.7059 | 0 | 0 |
| opportunist | 0.4 | 200 | 0.0000 | 0.0000 | 0.3991 | 0 | 0 |
| opportunist | 0.7 | 200 | 0.0000 | 0.0000 | 0.7072 | 0 | 0 |
| selective-betrayal | 0.4 | 200 | 0.0000 | 0.0000 | 0.4064 | 1918 | 575 |
| selective-betrayal | 0.7 | 200 | 0.0000 | 0.0000 | 0.7022 | 1837 | 535 |

## paired 비교

| 전략 | 0.7−0.4 평균 | 95% CI 하한 | 95% CI 상한 |
| --- | ---: | ---: | ---: |
| survival | 0.000 | 0.000 | 0.000 |
| opportunist | 0.000 | 0.000 | 0.000 |
| selective-betrayal | 0.000 | 0.000 | 0.000 |

## 오류와 재현 seed

- 총 오류: 0
- 대표 실패 seed: 없음

## B1 판정

- holdout 승인 기준 판정: calibration/실패 근거 검토 필요
- B1-B 필요 여부: holdout 결과에 따라 결정
