# RICE Prioritization Framework

## 공식
**RICE Score = (Reach × Impact × Confidence) / Effort**

## 요소
- **Reach**: 분기당 영향받는 사용자/고객 수 (정수)
- **Impact**: 0.25 (최소) / 0.5 (낮음) / 1 (중간) / 2 (높음) / 3 (대규모)
- **Confidence**: 100% (높음) / 80% (중간) / 50% (낮음) — 데이터 기반 추정치
- **Effort**: 인-주(person-weeks) 단위 (최소 0.5)

## 분석 규칙
- 모든 항목에 동일 기준 적용 (비교 가능해야 함)
- Confidence가 50% 미만이면 먼저 리서치/실험 추천
- Effort 과소평가 주의 — 최초 추정의 1.5배 적용 권장
- 상위 5개와 하위 5개 이유 설명

## 안티패턴
- Impact를 감으로 3 주기
- Effort를 "쉬움/어려움"으로 퉁치기
- Confidence 100%를 데이터 없이 사용
