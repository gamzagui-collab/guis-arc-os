# Site Space & SST Auxiliary Engine Design

- 상태: `DESIGN_APPROVED_FOR_FUTURE_IMPLEMENTATION`
- 구현: `IMPLEMENTATION_DEFERRED`
- 적용 기준: Issue v0.27.2 Candidate 이후 별도 승인

## 1. 최상위 계약

```text
AUXILIARY ENGINE FAILURE MUST NOT BLOCK CORE WORKFLOW
```

SST/STT 위치 보조, Site Space Resolver와 Speech Correction Learning은 Issue Core의 선택적 보조계층이다. 사진, 내용, 수동 위치, Issue Create, 공유, 조치, 확인, 완료는 보조 엔진의 설정·가용성·정확도와 무관하게 동작해야 한다.

## 2. Source of Truth

향후 Site Space Master를 현장별 실제 물리공간의 Source of Truth로 사용한다.

```text
SITE SPACE MASTER
       |
       +-- STT Resolver
       +-- Issue Location
       +-- Elevation Projection
```

Master는 Space ID, parent 관계, aliases, Unit Type, Room Template을 관리한다. 도면 입력은 `Import Draft -> Confirm -> Master` 절차를 거치며, 공정전개도와 향후 실별 전개도는 Master의 projection이다. 전개도 UI 자체는 위치 원본이 아니다.

## 3. Resolver 안전 상태

Resolver 상태는 `RESOLVED`, `PARTIAL`, `AMBIGUOUS`, `UNRESOLVED`, `UNAVAILABLE`, `ERROR_FALLBACK`으로 구분한다. 모든 상태에서 Issue Create를 허용한다.

- Site Space 없음 또는 Engine OFF: resolver bypass, 위치 null, raw-only fallback
- 부분 해석: 확실한 canonical 위치만 적용하고 나머지는 null
- 충돌 또는 불확실: 임의 canonical 선택 금지
- 오류: 원문을 유지하고 Issue Create 계속

잘못된 canonical 위치 ID는 저장하지 않는다. 위치 연결 실패 때문에 Issue 자체를 버리지 않는다.

## 4. Raw transcript

SpeechRecognition raw transcript는 immutable source다. Parser, Resolver, Correction 결과는 별도 snapshot으로 보관하며 description 원문을 덮어쓰지 않는다. 엔진의 목적은 문장을 수정하는 것이 아니라 발화 표현을 canonical Space로 해석하는 것이다.

## 5. 사용자 안내

- Exact: `현장 위치정보로 위치를 확인했습니다.`
- Alias: `위치 보조 · “A”를 “B”로 해석했습니다.`
- Partial: `위치 일부 확인 · 202동 확인 / “1501호”는 찾지 못했습니다.`
- OFF: `위치 보조 미사용 · 원문 그대로 등록합니다.`
- Error: `위치 보조를 사용할 수 없습니다 · 원문 그대로 등록할 수 있습니다.`

Description 자체가 변경된 것으로 오해할 수 있는 “교정” 표현은 피한다.

## 6. 학습 방향

STT alias learning은 Site scope의 confirmed evidence만 사용한다. 학습 결과는 resolver의 alias 후보이며 raw transcript를 변경하지 않는다. 불충분하거나 충돌하는 evidence는 자동 적용하지 않는다.

## 7. 현재 구현 경계

이번 Issue Core recovery에서는 Site Space DB, Migration, 도면 분석, 전개도 생성, fuzzy matcher 또는 신규 AI 모델을 구현하지 않는다. Speech 위치 자동 mutation과 dynamic location 생성은 OFF이며, parser snapshot 및 기존 Safe Mode evidence 수집만 유지한다. 향후 구현은 별도 설계·Migration·Integration 승인 후 진행한다.