# GUI's Arc OS v7 Starter

건설현장 운영 OS를 목표로 한 차세대 GUI's Arc 프로젝트입니다.

## 방향
- 게스트 모드: 브라우저 localStorage 저장
- 현장코드 + PIN 모드: Cloudflare D1 저장
- 날씨 비교 유지: KMA / ECMWF / GFS / JMA / Open-Meteo 확장 기반
- 현장 일정: 자재반입, 타설계획, 장비운영, 공정 일정
- 오늘의 요약: 안전·공사·품질·자재·장비 담당자가 바로 볼 수 있는 카드형 안내
- 공종 DB: 시공법, 안전관리, 품질관리, 법령, KCS, 사고사례, TBM 연결
- 가독성 우선: 큰 글자, 카드형 UI, 요약 우선, 상세는 펼침

## 배포
- Frontend: Cloudflare Pages
- Backend API: Cloudflare Workers
- DB: Cloudflare D1
- Cache: Cloudflare KV
- File/PDF/Image: Cloudflare R2 추후

## v7.1 Weather Intelligence Foundation
- 예보비교 페이지를 현장 의사결정 카드형으로 재구성
- 07~17시 작업시간 기준 체감온도/강수/풍속 요약
- 콘크리트 타설 판단 카드 초안
- v6.4 예보엔진 이관 준비
