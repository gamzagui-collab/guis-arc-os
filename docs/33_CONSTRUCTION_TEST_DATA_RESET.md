# Integration 공사일보 테스트 데이터 완전 초기화

이 절차는 Integration의 공사일보 업로드·세션·Revision·작업 항목·비교 기록·Preview와 연결된 R2 원본만 “한 번도 업로드하지 않은 상태”로 되돌린다. 사용자·회사·현장·역할·권한·인증, 다른 모듈, 출력일보 문서·사진, Parser와 공종 엔진은 유지한다. Production에서는 코드가 실행을 거부한다.

## 실행 순서

1. `GUI_Arc_Integrated_v0.18.2_Integrated.zip`과 제공된 SHA-256이 일치하는지 확인한다.
2. `npm.cmd install`로 의존성을 준비하거나 기존 `node_modules`를 확인한다.
3. 다음 Dry Run을 실행한다.

```powershell
npm.cmd run admin:reset-construction-test-data -- --dry-run --target=integration --site=2a8867c5-c04a-4560-8a95-36637f98fa0f
```

4. `[삭제 대상 현황]`의 실제 개수와 날짜 범위를 확인한다.
5. `[R2 삭제 대상]`의 모든 키가 해당 현장의 `construction/` Prefix인지 확인한다.
6. `[유지 대상]`에서 사용자·회사·현장과 다른 모듈이 유지되는지 확인한다.
7. `[백업 계획]`의 D1 JSON, 복구 SQL, R2 백업 Prefix, 키 목록, 결과 JSON 경로를 확인한다. Dry Run은 계획만 표시하고 파일을 만들지 않는다.
8. 사람이 직접 TTY 터미널에서 다음 명령을 입력한다.

```powershell
npm.cmd run admin:reset-construction-test-data -- --execute --confirm=DELETE-INTEGRATION-CONSTRUCTION-TEST-DATA --target=integration --site=2a8867c5-c04a-4560-8a95-36637f98fa0f
```

9. 동일한 삭제 계획을 다시 확인한 뒤 `DELETE-CONSTRUCTION-TEST-DATA`를 대소문자와 앞뒤 공백까지 정확히 입력한다. 다른 입력은 취소된다. CI, GitHub Actions, 배포 파이프라인, 비대화형 stdin에서는 실행할 수 없다.
10. 완료 화면의 삭제 전·삭제·삭제 후 0건, 보호 대상, 백업 위치를 확인한다.
11. Integration 공사일보 화면에 이전 내역이 없는지 확인한다.
12. 2026년 7월 공사일보를 최초 업로드한다.
13. 모든 날짜가 `NEW`인지 확인한다.
14. 확정 후 각 날짜가 Revision 1인지 확인한다.
15. 같은 파일을 다시 올려 `UNCHANGED`인지 확인한다.

Reset 도구는 엑셀을 자동 업로드하거나 Revision을 자동 생성하지 않는다.

## 안전장치와 백업

R2 키는 D1 공사일보 메타데이터에서만 수집한다. 빈 키, 다른 현장·모듈 Prefix, `..` 또는 역슬래시가 있는 비정상 경로, 백업 Prefix가 하나라도 발견되면 Dry Run부터 실패한다. 중복 키는 제거하며, 민감정보 가능성이 있는 파일명은 식별 가능한 범위에서 마스킹해 표시한다.

실행 시 삭제보다 먼저 다음 자료를 만든다.

- `d1-backup.json`: D1 대상 행 전체
- `restore.sql`: D1 복구 SQL
- `r2-keys.json`: 삭제 대상 R2 키
- `backup-manifest.json`: R2 백업 객체와 SHA-256
- `reset-result.json`: 성공 또는 실패 결과
- R2 `construction-reset-backups` Prefix: 원본 객체 사본

Integration Remote D1에 전달하는 삭제·복구 SQL에는 Wrangler가 허용하지 않는 명시적 `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `RELEASE`를 사용하지 않는다. 실행 직전에 실제 생성된 SQL 파일의 주석·문자열을 제외한 토큰, SHA-256, 문장 수와 대상 테이블을 다시 검사한다. 검증 후 파일이 변경되거나 금지 토큰이 발견되면 Wrangler를 호출하지 않는다.

Wrangler 실행이 실패하면 R2 삭제를 시작하지 않고 Construction 대상 수를 다시 조회한다. 변경이 0건이면 복구 불필요로 보고하며, 일부 변경이 확인되면 D1 백업과 복구 SQL로 복구를 시도한다. R2 삭제 또는 감사 단계에서 실패하면 D1과 R2 자동 복구를 시도하고 각각의 성공·실패를 출력한다. Cloudflare가 보장하지 않는 원격 다중 SQL 원자성을 전제로 하지 않으며, `reset-result.json`의 `status`가 `SUCCESS`가 아니면 완료로 취급하지 않는다.

## v0.18.3 Remote D1 Hotfix

v0.18.2 도구는 실제 `delete.sql`에 `BEGIN IMMEDIATE`와 `COMMIT`을 포함해 Remote D1에서 거부됐다. Hotfix 적용 전 v0.18.2 실제 Reset 명령을 다시 실행하지 않는다.

같은 Wrangler 오류가 발생하면 출력된 백업 폴더의 `delete.sql`을 열고 `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `RELEASE`가 없는지 확인한다. `[Remote D1 삭제 SQL 감사]`의 SHA-256과 실제 파일 SHA-256도 비교한다. D1 실패 직후 R2 원본 삭제가 시작되지 않았는지 실패 보고의 R2 복구 상태에서 확인한다.

## 잘못 실행했을 때 복구

1. 터미널의 실패 단계와 D1·R2 복구 결과를 확인한다.
2. 자동 복구가 모두 성공하면 Integration에서 기존 공사일보가 다시 조회되는지 확인한다.
3. 부분 복구 실패이면 추가 실행을 중단한다.
4. 출력된 백업 폴더의 `restore.sql`, `d1-backup.json`, `r2-keys.json`, `backup-manifest.json`을 보존한다.
5. D1은 해당 `restore.sql`로 복구하고, R2는 manifest의 `backupKey`를 `originalKey`로 복사한다.
6. 사용자·회사·현장·권한·Issue와 다른 R2 객체 수가 실행 전 결과와 동일한지 다시 확인한다.

DB 스키마와 Migration은 변경하지 않는다.
