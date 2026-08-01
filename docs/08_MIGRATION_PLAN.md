# Migration Plan

v0.1.0은 Production 데이터를 이동하지 않는다. 이후 순서는 Core identity mapping dry-run, 수동 중복 확인, OS read adapter, Issue read adapter, module별 shadow validation, 승인된 write cutover 순이다. 각 단계는 별도 backup과 rollback을 갖는다.

기존 앱 client, secret, callback, source-session binding은 삭제하지 않는다. Integrated 전환이 검증될 때까지 legacy runtime을 rollback source로 유지한다.
