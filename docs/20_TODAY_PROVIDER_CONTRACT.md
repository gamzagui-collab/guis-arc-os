# Today Provider Contract — v0.3.0

| Provider | Status | Canonical source |
| --- | --- | --- |
| Core | IMPLEMENTED | Integrated session Context, memberships, roles and entitlements |
| Issue | IMPLEMENTED | Canonical `issue_items` and Issue policy |
| Workforce | PLACEHOLDER | Not connected |
| Construction | PLACEHOLDER | Not connected |
| Safety | PLACEHOLDER | Not connected |
| Quality | PLACEHOLDER | Not connected |
| Materials | PLACEHOLDER | Not connected |
| Equipment | PLACEHOLDER | Not connected |
| Weather | NOT_CONNECTED | No external weather API in v0.3.0 |

Each provider is timed independently. A provider exception yields that provider's explicit `ERROR` state while other provider results remain available. Placeholder providers return no count or operational value.
# v0.20.0 공사 Today 카드 표현 계약

- 공사 Today 카드는 실제 회사가 있으면 회사, 공종·예정 인원, 위치, 작업내용, 시간, 주의사항 순으로 표시한다.
- 회사가 없으면 공종·인원을 주 제목으로 사용하고 `회사 미지정`은 작은 보조 정보로만 표시한다. 회사·위치·작업내용을 다른 원본에서 추론하거나 결합하지 않는다.
- 위치 미등록과 시간 미정은 보조 문구이며 작업내용보다 강하게 표시하지 않는다. 주의사항은 실제 값이 있을 때만 제목과 내용을 표시한다.
- 날짜 구역의 `확정 공사일보 기준` 또는 `월간계획 기준`을 출처 단일 표시로 사용하고 동일 출처를 카드마다 반복하지 않는다.
- Provider가 반환한 순서를 유지한다. PC는 충분한 폭에서 2열, 좁은 화면과 모바일은 1열이며 자동 갱신 뒤 스크롤 위치를 복원한다.
- Provider 데이터·우선순위, API, DB, Migration, R2는 변경하지 않는다. Integration은 미배포이며 Production은 변경하지 않았다.
