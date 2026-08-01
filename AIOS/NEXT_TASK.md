# GUI's Arc 다음 단일 작업

- 공식 기준 버전: v0.24.4
- 직접 기준 ZIP: `GUI_Arc_Integrated_v0.24.4_Integrated.zip`
- 공식 SHA-256: `455A993C035AD55722DEC5D71324158894159E11BEB3860BD3F98BDBD5560BA8`
- 현재 구현 상태: 상위 Skill 5개와 전문 Skill 10개, 정적 검증과 Trigger 평가 자료를 갖추고 v0.24.3 직영 배정 기능을 유지한다.
- 배포 상태: v0.24.4 Integration Worker·Pages 배포 및 D1 Migration 0027 적용 완료, Production `NOT_CHANGED`.
- 운영 검증 상태: `OPERATIONAL_VERIFICATION_PENDING`.
- 변경 금지 범위: 요청과 무관한 기능 코드, R2, 인증 구조, Today Provider, Construction Rule, Production.

## 남은 검증과 다음 작업 후보

1. 인증된 원도급 관리자 세션에서 직영 단건 배정 검증
2. 직영 일괄 배정 검증
3. 협력업체·직영·미배정 전환 검증
4. 권한별 접근 격리 검증
5. Revision·Idempotency·Audit 실제 원격 검증
6. 신규 Codex 세션에서 Skill Trigger 자동 선택 검증
7. 사용자의 다음 명시적 기능 요청
8. npm 취약점 3건 별도 보안 검토

실행하지 않은 검증은 `NOT_EXECUTED`로 보고하고 Production은 명시적 승인 없이 변경하지 않는다.

이 문서는 누적 이력이 아니며 위 후보가 자동으로 개발 범위를 결정하지 않는다. 다음 작업은 현재 사용자의 명시적 요청으로만 확정하고, 새 릴리스나 다음 작업이 확정되면 전체 내용을 현재 사실로 교체한다.
