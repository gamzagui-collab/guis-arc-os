# Integration Migration Analysis

Platform user ID는 UUID/text 혼합 가능성을 유지해야 한다. OS는 platform_user_id와 별도 os_user_id, Issue는 platform_user_id와 legacy local user reference를 가진다. site/company ID는 이름으로 자동 병합하지 않는다.

위험:
- 정규화된 전화번호·이메일 중복
- 같은 이름의 다른 사용자
- OS site와 Platform site의 불완전 mapping
- Issue 업무 기록의 legacy author ID
- R2 key namespace 충돌
- OS KST 업무일과 D1 UTC timestamp 차이

자동 병합은 동일 canonical identifier와 검증된 Platform mapping이 모두 있을 때만 후보가 된다. 충돌은 수동 review queue로 분리한다. R2는 `<module>/<record>/<uuid>` namespace로 복사 검증 후 전환한다.
