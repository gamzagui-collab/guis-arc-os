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

## v7.2 Site Management Core
- 현장관리 탭 추가
- 현장형태별 공법·공종·위험요소 자동 추천
- 현장일정에 자재반입/장비운영 추가
- 일정 기반 역할별 업무가이드 자동 생성

## v7.3 Knowledge DB Foundation
- 공종 데이터베이스 검색/상세 화면 추가
- 사고위험 TOP5 / 품질 TOP3 / 감리지적 TOP3 / KCS / 법령 / 체크리스트 / TBM 연결
- 철근·거푸집·타설·갱폼·크레인·지게차 seed DB 추가

## v7.4 Accident & News Briefing
- 포스터형 건설사고 브리핑 추가
- 사고 상세: 원인, 관련 공종, 현장 확인사항, TBM 문구
- 건설업계 동향 카드 추가
- KOSHA 포스터/API 연결을 위한 D1 테이블 추가
