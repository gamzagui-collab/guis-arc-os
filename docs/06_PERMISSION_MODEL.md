# Permission Model

모듈 접근 권한은 `module.<code>.access` 형식이다. role_permission의 유효 permission과 user의 ACTIVE module entitlement 교집합만 허용한다. site role은 company/site scope를 보존한다.

SUPER 역할도 실제 permission/entitlement record가 필요하다. URL 직접 접근, API 호출, site context 변경은 서버에서 재검증한다. 권한 변경 시 user `context_version`을 증가시켜 기존 session을 fail-closed 처리한다.
