# Canonical Navigation

Top-level order is fixed: 오늘 현장, 출역, 공사, 이슈, 안전, 품질, 자재, 장비, 문서, 통합관리.

Desktop Sidebar and Mobile More use the same accordion metadata. The module matching the current URL opens on load and reload; opening another module closes the prior module. Triggers expose `aria-expanded` and `aria-controls`, support Enter and Space, and remain real links when JavaScript is unavailable.

The canonical document children are 문서 작성 `/documents`, 문서 양식 `/documents/templates`, 결재 대기 `/documents/approvals`, 보관함 `/documents/archive`. `/documents/reports` is not canonical.

