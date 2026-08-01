# Git Release Workflow

`main` is the verified official source baseline. Unverified work is never committed directly to `main`. Each version or module is developed on a feature branch; urgent corrections use a `hotfix/<version>-<purpose>` branch from the current official tag.

Annotated version tags use `vMAJOR.MINOR.PATCH` and are created only after local tests, typecheck, validation, build, performance audit, Integration deployment, evidence documents and a clean secret scan agree. Integrated ZIP files are release and recovery artifacts, not substitutes for Git, and are never committed.

Merge prerequisites are `npm test`, `npm run typecheck`, `npm run validate`, `npm run build`, `npm run audit:performance`, the applicable Integration E2E, truthful FAIL/NOT_EXECUTED documentation, and disabled temporary controls. Production requires separate explicit approval and is never implied by a merge or tag.

Credentials, PINs, cookies, sessions, secrets, local D1 state, R2 temporary objects, sensitive screenshots, logs and release archives are forbidden in Git. `.env.example` may contain names and non-secret placeholders only.

Rollback selects the last verified tag, redeploys that source only to the authorized environment, and applies no destructive database rollback unless a separately reviewed migration rollback exists. Release ZIP restoration must verify its published SHA-256 and corresponding tag.

At task start Codex verifies the official ZIP hash, package/lock/Worker/frontend/service-worker/Version Matrix/BASELINE versions, Worker health, clean Git status, current branch and protected-control state. Development starts from the verified `main` tag on a feature branch.
