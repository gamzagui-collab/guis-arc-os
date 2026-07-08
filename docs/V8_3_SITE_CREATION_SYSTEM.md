# GUI's Arc OS v8.3 Site Creation System

## 반영

- 현장 생성/현장관리 화면 고도화
- 현장형태별 자동 구성
  - 대표 공법
  - 추천 공종
  - 주요 위험
  - 품질 중점
- 학교, 아파트, 오피스·관공서, 공장·창고, 문화시설·체육관, 도로·교량·터널 seed DB
- 현장형태 선택 시 오늘 선택 공정 자동 추천
- D1 현장 생성 버튼 유지

## 적용 후

```powershell
git add .
git commit -m "Apply v8.3 site creation system"
git push
.\scripts\deploy-pages-only.bat
```

Worker까지 반영:

```powershell
.\scripts\deploy-worker-only.bat
```
