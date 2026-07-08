# GUI's Arc OS v8.2 Weather Engine

## 반영

- 예보처별 3시간 강수 비교 테이블
- 평균/최대 강수 자동 표시
- 콘크리트 타설 판단 카드
- 작업시간 추천
- Worker `/weather/demo` route 추가

## 아직 데모인 부분

현재 KMA / ECMWF / GFS / JMA 값은 데모 구조입니다.  
다음 단계에서 기존 v6.4의 실제 API 호출부를 이 구조에 연결합니다.

## 배포

```powershell
git add .
git commit -m "Apply v8.2 weather engine"
git push
.\scripts\deploy-pages-only.bat
```

Worker route까지 반영하려면:

```powershell
.\scripts\deploy-worker-only.bat
```
