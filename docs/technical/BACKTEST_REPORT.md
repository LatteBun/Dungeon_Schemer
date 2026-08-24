# B1 현행 캠페인 백테스트 보고서

- 모드: calibration
- namespace: b1b-calibration-v1
- source revision: b6220f5
- 전략: survival, opportunist, selective-betrayal
- 정확도: 0.4, 0.7
- 조합당 표본: 50

## 설정 revision과 현재 수치

- revision: b1b-initial-v1
- 휴식 회복: 0.20
- 비출전 HP 손실: 5–10%
- 초기 위험도별 보스 배율: ★1: 0.80, ★2: 0.80, ★3: 0.78, ★4: 0.78, ★5: 0.80

| 조언 압력 | 받는 피해 배율 | 주는 피해 배율 |
| ---: | ---: | ---: |
| 0 | 1.00 | 1.00 |
| 1 | 1.05 | 1.00 |
| 2 | 1.15 | 0.90 |
| 3 | 1.30 | 0.80 |

## 고정 무결성 gate

| Gate | 결과 | 근거 |
| --- | --- | --- |
| accuracy-interval | PASS | survival@0.4 0.3677–0.4129 포함; survival@0.7 0.6652–0.7065 포함; opportunist@0.4 0.3697–0.4181 포함; opportunist@0.7 0.6776–0.7195 포함; selective-betrayal@0.4 0.3820–0.4306 포함; selective-betrayal@0.7 0.6557–0.7054 포함 |
| betrayal-can-complete | PASS | 배신 완주 182건 |
| no-run-errors | PASS | 실행 오류 0건 |
| not-all-rank-s | PASS | 각 조합 S 도달률 100% 미만 |

## B1-B 완주율·완주 전멸 gate

| Gate | 결과 | 근거 |
| --- | --- | --- |
| completed-wipe-mean:selective-betrayal@0.4 | FAIL | 완주 전멸 평균 표본 없음 (기준 3.00–4.00) |
| completed-wipe-mean:selective-betrayal@0.7 | FAIL | 완주 전멸 평균 표본 없음 (기준 3.00–4.00) |
| completed-wipe-mean:survival@0.4 | FAIL | 완주 전멸 평균 표본 없음 (기준 3.00–4.00) |
| completed-wipe-mean:survival@0.7 | FAIL | 완주 전멸 평균 표본 없음 (기준 2.00–3.00) |
| completion-rate:opportunist@0.4 | FAIL | 완주율 0.0000 (기준 0.20–0.30) |
| completion-rate:opportunist@0.7 | FAIL | 완주율 0.0000 (기준 0.40–0.60) |
| completion-rate:selective-betrayal@0.4 | FAIL | 완주율 0.0000 (기준 0.05–0.15) |
| completion-rate:selective-betrayal@0.7 | FAIL | 완주율 0.0000 (기준 0.20–0.40) |
| completion-rate:survival@0.4 | FAIL | 완주율 0.0000 (기준 0.30–0.40) |
| completion-rate:survival@0.7 | FAIL | 완주율 0.0000 (기준 0.60–0.80) |

## 조합별 완주율·완주 전멸 평균·5+ 비율·압력·보스 진입 HP

| 전략 | 정확도 | 표본 | 완주율 | 완주 전멸 평균 | 5+ 전멸 비율 | 평균 최대 압력 | 보스 진입 HP 비율 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| survival | 0.4 | 50 | 0.0000 | — | — | 1.2454 | 0.8925 |
| survival | 0.7 | 50 | 0.0000 | — | — | 0.6900 | 0.9209 |
| opportunist | 0.4 | 50 | 0.0000 | — | — | 1.2015 | 0.8928 |
| opportunist | 0.7 | 50 | 0.0000 | — | — | 0.6606 | 0.9081 |
| selective-betrayal | 0.4 | 50 | 0.0000 | — | — | 1.5276 | 0.8074 |
| selective-betrayal | 0.7 | 50 | 0.0000 | — | — | 1.9801 | 0.7838 |

## 위험도·테마별 보스 진입/클리어/전멸

| 전략 | 정확도 | 초기 위험도 | 테마 | 진입 | 클리어 | 전멸 | 평균 진입 HP 비율 |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| survival | 0.4 | 1 | desert | 50 | 50 | 0 | 0.9366 |
| survival | 0.4 | 1 | spider | 102 | 100 | 2 | 0.9116 |
| survival | 0.4 | 2 | desert | 142 | 89 | 53 | 0.8946 |
| survival | 0.4 | 2 | graveyard | 67 | 46 | 21 | 0.8771 |
| survival | 0.4 | 2 | spider | 69 | 44 | 25 | 0.8889 |
| survival | 0.4 | 3 | desert | 67 | 8 | 59 | 0.9073 |
| survival | 0.4 | 3 | graveyard | 126 | 15 | 111 | 0.8754 |
| survival | 0.4 | 3 | spider | 58 | 14 | 44 | 0.8957 |
| survival | 0.4 | 4 | desert | 28 | 1 | 27 | 0.8581 |
| survival | 0.4 | 4 | graveyard | 29 | 0 | 29 | 0.8617 |
| survival | 0.4 | 4 | spider | 28 | 0 | 28 | 0.8817 |
| survival | 0.7 | 1 | desert | 50 | 50 | 0 | 0.9612 |
| survival | 0.7 | 1 | spider | 101 | 100 | 1 | 0.9346 |
| survival | 0.7 | 2 | desert | 113 | 100 | 13 | 0.9270 |
| survival | 0.7 | 2 | graveyard | 56 | 49 | 7 | 0.9342 |
| survival | 0.7 | 2 | spider | 57 | 50 | 7 | 0.9223 |
| survival | 0.7 | 3 | desert | 74 | 30 | 44 | 0.9165 |
| survival | 0.7 | 3 | graveyard | 142 | 37 | 105 | 0.9001 |
| survival | 0.7 | 3 | spider | 72 | 34 | 38 | 0.9340 |
| survival | 0.7 | 4 | desert | 47 | 0 | 47 | 0.8965 |
| survival | 0.7 | 4 | graveyard | 47 | 1 | 46 | 0.9165 |
| survival | 0.7 | 4 | spider | 47 | 2 | 45 | 0.9117 |
| survival | 0.7 | 5 | graveyard | 7 | 0 | 7 | 0.8113 |
| opportunist | 0.4 | 1 | desert | 38 | 37 | 1 | 0.8995 |
| opportunist | 0.4 | 1 | spider | 81 | 80 | 1 | 0.9048 |
| opportunist | 0.4 | 2 | desert | 134 | 88 | 46 | 0.9199 |
| opportunist | 0.4 | 2 | graveyard | 63 | 47 | 16 | 0.9028 |
| opportunist | 0.4 | 2 | spider | 68 | 45 | 23 | 0.8997 |
| opportunist | 0.4 | 3 | desert | 57 | 7 | 50 | 0.8722 |
| opportunist | 0.4 | 3 | graveyard | 114 | 10 | 104 | 0.8715 |
| opportunist | 0.4 | 3 | spider | 61 | 8 | 53 | 0.8838 |
| opportunist | 0.4 | 4 | desert | 16 | 0 | 16 | 0.8481 |
| opportunist | 0.4 | 4 | graveyard | 20 | 0 | 20 | 0.8201 |
| opportunist | 0.4 | 4 | spider | 23 | 0 | 23 | 0.9084 |
| opportunist | 0.7 | 1 | desert | 37 | 37 | 0 | 0.9416 |
| opportunist | 0.7 | 1 | spider | 72 | 72 | 0 | 0.9167 |
| opportunist | 0.7 | 2 | desert | 117 | 97 | 20 | 0.9437 |
| opportunist | 0.7 | 2 | graveyard | 60 | 47 | 13 | 0.9158 |
| opportunist | 0.7 | 2 | spider | 64 | 50 | 14 | 0.9153 |
| opportunist | 0.7 | 3 | desert | 74 | 29 | 45 | 0.9182 |
| opportunist | 0.7 | 3 | graveyard | 162 | 29 | 133 | 0.8835 |
| opportunist | 0.7 | 3 | spider | 72 | 25 | 47 | 0.8982 |
| opportunist | 0.7 | 4 | desert | 37 | 0 | 37 | 0.8664 |
| opportunist | 0.7 | 4 | graveyard | 33 | 0 | 33 | 0.8820 |
| opportunist | 0.7 | 4 | spider | 44 | 1 | 43 | 0.9042 |
| opportunist | 0.7 | 5 | graveyard | 3 | 0 | 3 | 0.7654 |
| selective-betrayal | 0.4 | 1 | desert | 48 | 46 | 2 | 0.8396 |
| selective-betrayal | 0.4 | 1 | spider | 102 | 91 | 11 | 0.8152 |
| selective-betrayal | 0.4 | 2 | desert | 135 | 65 | 70 | 0.8208 |
| selective-betrayal | 0.4 | 2 | graveyard | 80 | 31 | 49 | 0.8106 |
| selective-betrayal | 0.4 | 2 | spider | 69 | 36 | 33 | 0.8463 |
| selective-betrayal | 0.4 | 3 | desert | 61 | 5 | 56 | 0.7895 |
| selective-betrayal | 0.4 | 3 | graveyard | 103 | 8 | 95 | 0.7674 |
| selective-betrayal | 0.4 | 3 | spider | 53 | 11 | 42 | 0.8390 |
| selective-betrayal | 0.4 | 4 | desert | 13 | 0 | 13 | 0.6479 |
| selective-betrayal | 0.4 | 4 | graveyard | 11 | 0 | 11 | 0.6638 |
| selective-betrayal | 0.4 | 4 | spider | 12 | 0 | 12 | 0.8162 |
| selective-betrayal | 0.7 | 1 | desert | 49 | 42 | 7 | 0.8031 |
| selective-betrayal | 0.7 | 1 | spider | 84 | 74 | 10 | 0.7819 |
| selective-betrayal | 0.7 | 2 | desert | 146 | 51 | 95 | 0.7714 |
| selective-betrayal | 0.7 | 2 | graveyard | 72 | 22 | 50 | 0.7987 |
| selective-betrayal | 0.7 | 2 | spider | 72 | 27 | 45 | 0.8428 |
| selective-betrayal | 0.7 | 3 | desert | 45 | 8 | 37 | 0.7758 |
| selective-betrayal | 0.7 | 3 | graveyard | 81 | 9 | 72 | 0.7450 |
| selective-betrayal | 0.7 | 3 | spider | 43 | 2 | 41 | 0.7789 |
| selective-betrayal | 0.7 | 4 | desert | 2 | 0 | 2 | 0.7611 |
| selective-betrayal | 0.7 | 4 | graveyard | 1 | 0 | 1 | 0.9072 |
| selective-betrayal | 0.7 | 4 | spider | 4 | 0 | 4 | 0.6228 |

## 엔딩·최종 등급 분포

| 전략 | 정확도 | 정상 완주 | 소진 | 실업 | 고발 | 불신 | 실행 오류 | S 도달률 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| survival | 0.4 | 0 | 50 | 0 | 0 | 0 | 0 | 0.0000 |
| survival | 0.7 | 0 | 45 | 5 | 0 | 0 | 0 | 0.2600 |
| opportunist | 0.4 | 0 | 43 | 7 | 0 | 0 | 0 | 0.0000 |
| opportunist | 0.7 | 0 | 50 | 0 | 0 | 0 | 0 | 0.1000 |
| selective-betrayal | 0.4 | 0 | 50 | 0 | 0 | 0 | 0 | 0.0000 |
| selective-betrayal | 0.7 | 0 | 47 | 0 | 3 | 0 | 0 | 0.0000 |

## paired 정확도 비교

| 전략 | 0.7−0.4 평균 | 95% CI 하한 | 95% CI 상한 |
| --- | ---: | ---: | ---: |
| survival | 0.000 | 0.000 | 0.000 |
| opportunist | 0.000 | 0.000 | 0.000 |
| selective-betrayal | 0.000 | 0.000 | 0.000 |

## 오류와 재현 seed

- 총 오류: 0
- 대표 실패 seed: 없음
