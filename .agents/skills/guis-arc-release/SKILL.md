---
name: guis-arc-release
description: Use when GUI's Arc needs an official checkpoint audit, commit, normal push, Integrated ZIP, SHA-256, or release artifact verification.
---

# GUI's Arc 공식 Release

검증된 checkpoint만 Commit·Push·패키징하고 Git 추적 commit snapshot을 기준으로 한다.

1. branch, HEAD, upstream, worktree, diff, untracked와 secret 후보를 감사한다.
2. 전체 test, syntax, validate, build와 필요한 검사를 fresh 실행한다.
3. 승인된 경우 단일 checkpoint Commit과 force 없는 일반 Push를 실행한다.
4. remote HEAD 일치와 clean worktree를 확인한다.
5. commit snapshot ZIP을 만들고 별도 폴더에서 파일·버전·SHA-256을 검증한다.

출처 불명 파일, 검증 실패, divergence, 인증 실패, secret 또는 snapshot 불일치가 있으면 다음 단계로 진행하지 않는다.
