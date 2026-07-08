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

## v7.5 AI Field Assistant
- AI 현장비서 탭 추가
- 일정·공종·날씨·사고사례 기반 사고위험 TOP5 / 품질 TOP3 / 감리지적 TOP3 자동 요약
- 역할별 오늘 할 일 자동 분리
- TBM 자동 문구 복사/출력

## v7.6 D1 Site Sync
- 현장코드+PIN D1 로그인 강화
- 현장 기본정보/일정 서버 저장 기반 추가
- /site/create, /site/profile, /site/bundle, /daily-work API 추가
- 로컬 저장 + D1 저장 병행 구조

## v7.7 Admin Settings & Backup
- 설정 탭 추가
- Worker API 주소 테스트/저장
- 글자크기·고대비·화면밀도 설정
- 게스트 데이터 JSON 백업/복원
- /admin/status Worker route 추가

## v7.8 DevOps Toolkit
- 회사/집 PC 공통 작업용 install/update/deploy 배치파일 추가
- Pages 프로젝트명 `guis-arc-os` 기준 정리
- GitHub Actions 예시 추가
- 저장소 정리 문서 추가

## v8.1 Split Deploy Config
- Worker와 Pages 배포 설정 분리
- `wrangler.worker.toml`, `wrangler.pages.toml` 추가
- 배치파일을 `guis-arc-os-enterprise` Pages 기준으로 정리
- 환경 점검용 `scripts/doctor.bat` 추가

## v8.2 Weather Engine
- 예보처별 3시간 강수 비교 테이블 추가
- 콘크리트 타설 판단 카드 고도화
- 07~17시 작업시간 추천
- Worker `/weather/demo` route 추가

## v8.3 Site Creation System
- 현장 생성/현장관리 화면 고도화
- 현장형태별 대표 공법·추천 공종·주요 위험·품질 중점 자동 구성
- 현장형태 선택 시 오늘 공정 자동 추천

## v8.4 Construction Stress Index
- 체감위험 탭 추가
- 건설 작업종류·위치까지 반영한 CSI 점수 산출
- 수분·휴식·관리조치·체크리스트 자동 생성

## v8.5 Quality Knowledge Engine
- 품질관리 탭 추가
- 콘크리트 타설 공시체 계산기
- 현장시험·체크리스트·사진 기록 포인트 자동 정리
